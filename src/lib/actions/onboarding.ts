"use server";

import { OnboardingGoal, OnboardingStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { ensureOrganizationDefaults } from "@/lib/organization-defaults";
import { adoptStandardForOrganization, ensureStandardCatalog } from "@/lib/standards-adoption";
import { getStandardSpec } from "@/lib/standards-catalog";
import { parseInput } from "@/lib/validation/common";
import { onboardingSetupSchema } from "@/lib/validation/workflows";
import { installAllPacks, syncCommercialPackEntitlements } from "@/lib/standard-packs";

const STANDARD_CODES = ["ISO_9001", "ISO_27001"] as const;
type StandardCode = (typeof STANDARD_CODES)[number];

const STARTER_PROCESSES = [
  { code: "DIR", name: "Dirección y planificación", type: "strategic", description: "Objetivos, contexto y revisión del sistema de gestión." },
  { code: "COM", name: "Comercial y cliente", type: "core", description: "Necesidades del cliente, ofertas y satisfacción." },
  { code: "OPS", name: "Operación del servicio", type: "core", description: "Prestación del servicio y control operacional." },
  { code: "MEJ", name: "Mejora y cumplimiento", type: "support", description: "Auditorías, riesgos, no conformidades y mejora continua." },
] as const;

const STARTER_TEMPLATES = [
  ["TPL-POL", "Política del sistema de gestión", "DOCUMENT_TYPE"],
  ["TPL-PROC", "Procedimiento documentado", "DOCUMENT_TYPE"],
  ["TPL-FMT", "Formato de registro", "DOCUMENT_TYPE"],
] as const;

function text(value: unknown, label: string, max = 160) {
  if (typeof value !== "string") throw new Error(`${label} es obligatorio.`);
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} no es válido.`);
  return result;
}

function optionalText(value: unknown, max = 120) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function validStandards(values: unknown): StandardCode[] {
  if (!Array.isArray(values)) throw new Error("Selecciona al menos una norma.");
  const selected = [...new Set(values)].filter((value): value is StandardCode =>
    typeof value === "string" && (STANDARD_CODES as readonly string[]).includes(value),
  );
  if (!selected.length) throw new Error("Selecciona al menos una norma.");
  return selected;
}

function validGoal(value: unknown): OnboardingGoal {
  if (typeof value !== "string" || !Object.values(OnboardingGoal).includes(value as OnboardingGoal)) {
    throw new Error("Selecciona un objetivo para tu trial.");
  }
  return value as OnboardingGoal;
}

async function track(
  organizationId: string,
  userId: string,
  event: string,
  step?: number,
  metadata?: Record<string, unknown>,
) {
  await prisma.onboardingMetricEvent.create({
    data: {
      organizationId,
      userId,
      event,
      step: step ?? null,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function saveOnboardingSetup(input: {
  organizationName: string;
  industry?: string;
  country?: string;
  size?: string;
  standards: unknown;
  goal: unknown;
}) {
  const { ctx } = await requireAuthorization("org:update");
  const parsed = parseInput(onboardingSetupSchema, input);
  const organizationName = parsed.organizationName;
  const standards = parsed.standards;
  const goal = parsed.goal;

  await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: {
      name: organizationName,
      industry: parsed.industry || null,
      country: parsed.country || "ES",
      size: parsed.size || null,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      onboardingStep: 4,
      onboardingGoal: goal,
      onboardingStartedAt: ctx.organization.onboardingStartedAt ?? new Date(),
    },
  });

  await ensureOrganizationDefaults(ctx.organization.id);
  await installAllPacks();

  const entitlementSync = await syncCommercialPackEntitlements({
    organizationId: ctx.organization.id,
    plan: ctx.organization.plan,
    trialEndsAt: ctx.organization.trialEndsAt,
    grantedById: ctx.user.id,
  });

  for (const code of standards) {
    const spec = getStandardSpec(code);
    if (!spec) continue;
    const standard = await ensureStandardCatalog(spec);
    await adoptStandardForOrganization({
      organizationId: ctx.organization.id,
      standardCode: code,
      standardId: standard.id,
      assessorId: ctx.user.id,
    });
  }

  // Starter processes and templates make the first workspace useful immediately.
  const processCount = await prisma.process.count({ where: { organizationId: ctx.organization.id } });
  if (processCount === 0) {
    await prisma.process.createMany({
      data: STARTER_PROCESSES.map((process) => ({
        organizationId: ctx.organization.id,
        code: process.code,
        name: process.name,
        type: process.type,
        description: process.description,
        ownerId: ctx.user.id,
      })),
      skipDuplicates: true,
    });
  }
  await Promise.all(STARTER_TEMPLATES.map(([code, name, kind], sortOrder) =>
    prisma.organizationCatalogItem.upsert({
      where: { organizationId_kind_name: { organizationId: ctx.organization.id, kind: "DOCUMENT_TEMPLATE", name } },
      update: { description: `Plantilla inicial ${code}.`, sortOrder, active: true },
      create: { organizationId: ctx.organization.id, kind: "DOCUMENT_TEMPLATE", name, description: `Plantilla inicial ${code}.`, sortOrder, active: true },
    }),
  ));

  await track(ctx.organization.id, ctx.user.id, "onboarding_setup_saved", 4, { standards, goal, packEntitlements: entitlementSync.enabledCodes });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "onboarding",
    recordId: ctx.organization.id,
    after: { organizationName, standards, goal, onboardingStatus: OnboardingStatus.IN_PROGRESS, packEntitlements: entitlementSync.enabledCodes },
  });

  revalidatePath("/app/onboarding");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/processes");
  revalidatePath("/app/gap");
  revalidatePath("/app/settings/organization");
  return { ok: true };
}

export async function completeOnboarding() {
  const { ctx } = await requireAuthorization("org:update");
  const completedAt = new Date();
  await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: { onboardingStatus: OnboardingStatus.COMPLETED, onboardingCompletedAt: completedAt, activationAt: ctx.organization.activationAt ?? completedAt },
  });
  await track(ctx.organization.id, ctx.user.id, "onboarding_activated", 5, { activationAt: completedAt.toISOString() });
  await logAuditEvent({ ctx, action: "complete", module: "onboarding", recordId: ctx.organization.id, after: { onboardingStatus: OnboardingStatus.COMPLETED } });
  revalidatePath("/app/onboarding");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

export async function skipOnboarding() {
  const { ctx } = await requireAuthorization("org:update");
  await prisma.organization.update({ where: { id: ctx.organization.id }, data: { onboardingStatus: OnboardingStatus.SKIPPED } });
  await track(ctx.organization.id, ctx.user.id, "onboarding_skipped", ctx.organization.onboardingStep);
  await logAuditEvent({ ctx, action: "skip", module: "onboarding", recordId: ctx.organization.id });
  revalidatePath("/app/onboarding");
  return { ok: true };
}
