import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const organizationName =
    typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  if (!organizationName || organizationName.length < 2) {
    return NextResponse.json({ error: "Nombre de organización inválido" }, { status: 400 });
  }

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

  await prisma.$transaction(async tx => {
    const u = await tx.user.upsert({
      where: { email },
      create: { email, name, authUserId: user.id },
      update: { authUserId: user.id, name },
    });

    const existing = await tx.membership.count({ where: { userId: u.id } });
    if (existing > 0) return;

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
      },
    });

    await tx.membership.create({
      data: { userId: u.id, organizationId: org.id, role: "ORG_ADMIN" },
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
  });

  return response;
}
