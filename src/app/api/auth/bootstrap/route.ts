import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { getStandardSpec, withBaselineStandard } from "@/lib/standards-catalog";
import { adoptStandardForOrganization, ensureStandardCatalog } from "@/lib/standards-adoption";
import { ensureOrganizationDefaults } from "@/lib/organization-defaults";
import { sendWelcomeEmail } from "@/lib/resend";
import { OnboardingGoal, Prisma } from "@prisma/client";
import type { z } from "zod";
import { clientAddress, rateLimitResponse, takeRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation/common";
import { bootstrapSchema } from "@/lib/validation/workflows";
import { installAllPacks, syncCommercialPackEntitlements } from "@/lib/standard-packs";
import { ACTIVE_ORG_COOKIE, activeOrgCookieOptions } from "@/lib/auth/session-cookies";

async function runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      // Two signup tabs can race before the first membership is visible. A
      // serializable retry makes organization bootstrap idempotent for that
      // commercial onboarding path instead of creating duplicate tenants.
      if (attempt === 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
      throw error;
    }
  }
  throw new Error("No se pudo completar el alta de la organización.");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const limit = takeRateLimit(`bootstrap:${clientAddress(request)}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  let body: z.infer<typeof bootstrapSchema>;
  try { body = parseInput(bootstrapSchema, await request.json().catch(() => ({}))) as z.infer<typeof bootstrapSchema>; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 }); }
  const organizationName = body.organizationName;
  // Normas a adoptar al crear la organización. La base va siempre, aunque el
  // alta pida solo otra: una organización sin normas activas se queda sin
  // selector de norma ni cláusulas en documentos.
  const requestedStandards = withBaselineStandard(body.standards);
  const standardSpecs = requestedStandards
    .map((code) => getStandardSpec(code))
    .filter((spec): spec is NonNullable<typeof spec> => spec != null);
  const onboardingGoal = body.goal as OnboardingGoal | null;

  let response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as object);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return NextResponse.json({ error: "Sesión no válida. Inicia sesión de nuevo." }, { status: 401 });
  }

  const email = user.email;
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    email.split("@")[0];

  const outcome = await runSerializable(async tx => {
    const u = await tx.user.upsert({
      where: { email },
      create: { email, name, authUserId: user.id },
      // El nombre del perfil no se reescribe desde Supabase en cada alta.
      update: { authUserId: user.id },
    });

    /* Quien ya tiene organización no crea otra por aquí: esta ruta es el alta
       inicial. Antes se devolvía `null` y un 200 igualmente, así que el nombre
       de empresa del formulario se tiraba en silencio y la persona aterrizaba
       en la organización que ya tenía. Ahora se dice cuál es. */
    const existing = await tx.membership.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: "asc" },
      select: { organization: { select: { id: true, name: true } } },
    });
    if (existing) {
      return {
        created: false as const,
        organizationId: existing.organization.id,
        organizationName: existing.organization.name,
        userId: u.id,
      };
    }

    let base = slugify(organizationName) || "org";
    let slug = base;
    let n = 0;
    while (await tx.organization.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const org = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        plan: "STARTER",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        onboardingStatus: "IN_PROGRESS",
        onboardingStep: 1,
        onboardingGoal,
        onboardingStartedAt: new Date(),
        industry: typeof body.industry === "string" ? body.industry.trim() || null : null,
        country: typeof body.country === "string" ? body.country.trim() || "ES" : "ES",
        size: typeof body.size === "string" ? body.size.trim() || null : null,
      },
    });

    await tx.membership.create({
      data: { userId: u.id, organizationId: org.id, role: "OWNER" },
    });

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        plan: "STARTER",
        status: "TRIALING",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      },
    });

    await tx.onboardingMetricEvent.create({
      data: { organizationId: org.id, userId: u.id, event: "trial_started", step: 1, metadata: { trialDays: 14 } },
    });
    await tx.auditLog.create({
      data: { organizationId: org.id, userId: u.id, action: "create", module: "onboarding", recordId: org.id, metadata: { onboardingStatus: "IN_PROGRESS", trialDays: 14 } },
    });

    await ensureOrganizationDefaults(org.id, tx);

    return { created: true as const, organizationId: org.id, organizationName: org.name, userId: u.id };
  });

  if (outcome.created) {
    // Adopción de normas: catálogo global + evaluación GAP inicial por norma.
    // Fuera de la transacción principal — es idempotente y no debe bloquear el alta.
    await installAllPacks();
    const entitlementSync = await syncCommercialPackEntitlements({
      organizationId: outcome.organizationId,
      plan: "STARTER",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      grantedById: outcome.userId,
    });
    await prisma.auditLog.create({
      data: {
        organizationId: outcome.organizationId,
        userId: outcome.userId,
        action: "create",
        module: "packs",
        recordId: "COMMERCIAL_ONBOARDING",
        metadata: { event: "sync_commercial_pack_entitlements", enabledCodes: entitlementSync.enabledCodes },
      },
    });

    for (const spec of standardSpecs) {
      try {
        const standard = await ensureStandardCatalog(spec);
        await adoptStandardForOrganization({
          organizationId: outcome.organizationId,
          standardCode: spec.code,
          standardId: standard.id,
          assessorId: outcome.userId,
        });
      } catch (e) {
        console.error("[bootstrap] adoptStandard", spec.code, e);
      }
    }

    sendWelcomeEmail(email, name, outcome.organizationName).catch((e) =>
      console.error("[bootstrap] welcome email", e)
    );
  }

  /* El cuerpo del `NextResponse` no se puede reescribir, y `response` existe
     desde el principio solo para que el cliente de Supabase deposite ahí sus
     cookies de sesión. Se traslada esa cosecha a la respuesta final. */
  const result = NextResponse.json({
    ok: true,
    created: outcome.created,
    organizationId: outcome.organizationId,
    organizationName: outcome.organizationName,
  });
  for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
  // Deja fijada la organización recién creada: sin esto se resolvía por el
  // fallback de `getAppContext`, que con varias membresías es una lotería.
  result.cookies.set(ACTIVE_ORG_COOKIE, outcome.organizationId, activeOrgCookieOptions());
  return result;
}
