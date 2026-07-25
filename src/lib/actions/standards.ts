"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getStandardSpec } from "@/lib/standards-catalog";
import { canUseModule } from "@/lib/plan-entitlements";
import { getPackForFamily, installPack } from "@/lib/standard-packs";
import { adoptStandardForOrganization, ensureStandardCatalog } from "@/lib/standards-adoption";

/**
 * Adopción de una norma por la organización actual (compat: GAP CTA + onboarding).
 * Siembra el catálogo, crea el vínculo OrganizationStandard y la evaluación GAP.
 */
export async function adoptStandard(standardCode: "ISO_9001" | "ISO_27001") {
  const ctx = await requirePermission("gap:create");
  const spec = getStandardSpec(standardCode);
  if (!spec) throw new Error("Norma no soportada.");

  const edition = await ensureStandardCatalog(spec);
  const result = await adoptStandardForOrganization({
    organizationId: ctx.organization.id,
    standardCode: spec.code,
    standardId: edition.id,
    assessorId: ctx.user.id,
  });

  await logAuditEvent({
    ctx, action: "create", module: "gap", recordId: result.assessmentId,
    after: { standard: spec.code, version: spec.version, answersCreated: result.answersCreated },
    extra: { event: "adopt_standard" },
  });

  revalidatePath("/app/gap");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/standards");
  revalidatePath("/app/setup");
  return result;
}

const activateSchema = z.object({
  familyCode: z.string().min(1),
  editionCode: z.string().min(1).optional(),
  scope: z.string().max(2000).optional(),
  responsibleId: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  nextAuditDate: z.string().optional(),
});

/**
 * Activa una norma (edición) para la organización con los metadatos del Standard
 * Pack Engine (alcance, responsable, fechas). Instala el paquete si hace falta y
 * crea la evaluación GAP inicial. Idempotente por (organización, edición).
 */
export async function activateStandard(input: z.infer<typeof activateSchema>) {
  const ctx = await requirePermission("standards:activate");
  const data = activateSchema.parse(input);

  const pack = getPackForFamily(data.familyCode);
  if (pack) await installPack(pack);

  const edition = await prisma.standardEdition.findFirst({
    where: {
      family: { code: data.familyCode },
      ...(data.editionCode ? { editionCode: data.editionCode } : {}),
      status: { in: ["ACTIVE", "DRAFT"] },
    },
    orderBy: { editionCode: "desc" },
    include: { family: true, packLinks: { include: { pack: true } } },
  });
  if (!edition) throw new Error("La edición solicitada no existe en el catálogo.");

  // Plan gating: the pack's required modules must be in the org plan.
  const packModules = pack?.requiredModules ?? [];
  const missing = packModules.filter((m) => !canUseModule(ctx.organization, m));
  if (missing.length) {
    throw new Error(`Tu plan no incluye los módulos requeridos: ${missing.join(", ")}. Actualiza tu plan.`);
  }

  if (data.responsibleId) {
    const member = await prisma.membership.findFirst({
      where: { userId: data.responsibleId, organizationId: ctx.organization.id },
      select: { id: true },
    });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }

  const spec = getStandardSpec(data.familyCode);
  const adoption = spec
    ? await adoptStandardForOrganization({
        organizationId: ctx.organization.id, standardCode: spec.code,
        standardId: edition.id, assessorId: ctx.user.id,
      })
    : { adoptionId: null, assessmentId: null, answersCreated: 0 };

  const sourcePackId = edition.packLinks[0]?.pack.id ?? null;
  const orgStandard = await prisma.organizationStandard.update({
    where: { organizationId_standardId: { organizationId: ctx.organization.id, standardId: edition.id } },
    data: {
      scope: data.scope ?? null,
      responsibleId: data.responsibleId ?? null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      nextAuditDate: data.nextAuditDate ? new Date(data.nextAuditDate) : null,
      implementationStatus: "IN_PROGRESS",
      sourcePackId,
    },
  });

  await logAuditEvent({
    ctx, action: "create", module: "standards", recordId: orgStandard.id,
    after: { family: data.familyCode, edition: edition.editionCode, scope: data.scope ?? null },
    extra: { event: "activate_standard", assessmentId: adoption.assessmentId },
  });

  revalidatePath("/app/standards");
  revalidatePath("/app/gap");
  revalidatePath("/app/dashboard");
  return { orgStandardId: orgStandard.id, editionId: edition.id, assessmentId: adoption.assessmentId };
}

const updateSchema = z.object({
  orgStandardId: z.string().min(1),
  scope: z.string().max(2000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "CERTIFIED", "SUSPENDED"]).optional(),
  certified: z.boolean().optional(),
  certBody: z.string().nullable().optional(),
  certExpiresAt: z.string().nullable().optional(),
  nextAuditDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

/** Actualiza los metadatos de implementación / certificación de una norma activa. */
export async function updateOrganizationStandard(input: z.infer<typeof updateSchema>) {
  const ctx = await requirePermission("standards:activate");
  const data = updateSchema.parse(input);

  const existing = await prisma.organizationStandard.findFirst({
    where: tenantWhere(ctx, { id: data.orgStandardId }),
    select: { id: true },
  });
  if (!existing) throw new Error("La norma no pertenece a la organización.");

  const updated = await prisma.organizationStandard.update({
    where: { id: existing.id },
    data: {
      ...(data.scope !== undefined ? { scope: data.scope } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.implementationStatus ? { implementationStatus: data.implementationStatus } : {}),
      ...(data.certified !== undefined ? { certified: data.certified } : {}),
      ...(data.certBody !== undefined ? { certBody: data.certBody } : {}),
      ...(data.certExpiresAt !== undefined ? { certExpiresAt: data.certExpiresAt ? new Date(data.certExpiresAt) : null } : {}),
      ...(data.nextAuditDate !== undefined ? { nextAuditDate: data.nextAuditDate ? new Date(data.nextAuditDate) : null } : {}),
      ...(data.targetDate !== undefined ? { targetDate: data.targetDate ? new Date(data.targetDate) : null } : {}),
    },
  });

  await logAuditEvent({
    ctx, action: "update", module: "standards", recordId: updated.id,
    after: { implementationStatus: updated.implementationStatus, certified: updated.certified },
  });
  revalidatePath("/app/standards");
  return { id: updated.id };
}

const transitionSchema = z.object({
  familyCode: z.string().min(1),
  fromEditionCode: z.string().min(1),
  toEditionCode: z.string().min(1),
});

/**
 * Transición entre ediciones de una misma norma. Crea/activa la nueva edición,
 * arrastra las respuestas GAP de la edición anterior a través de las
 * correspondencias (RequirementMapping) y conserva la evaluación previa como
 * historial (marcada ARCHIVED). No borra datos.
 */
export async function transitionEdition(input: z.infer<typeof transitionSchema>) {
  const ctx = await requirePermission("standards:activate");
  const data = transitionSchema.parse(input);
  const orgId = ctx.organization.id;

  const [fromEdition, toEdition] = await Promise.all([
    prisma.standardEdition.findFirst({ where: { family: { code: data.familyCode }, editionCode: data.fromEditionCode } }),
    prisma.standardEdition.findFirst({ where: { family: { code: data.familyCode }, editionCode: data.toEditionCode } }),
  ]);
  if (!fromEdition || !toEdition) throw new Error("Edición de origen o destino no encontrada.");

  // Ensure the org has the target edition activated with a fresh GAP assessment.
  const spec = getStandardSpec(data.familyCode);
  if (spec) {
    await adoptStandardForOrganization({ organizationId: orgId, standardCode: spec.code, standardId: toEdition.id, assessorId: ctx.user.id });
  }

  // Carry forward the latest answers of the source edition using mappings.
  const sourceAssessment = await prisma.assessment.findFirst({
    where: { organizationId: orgId, standardId: fromEdition.id },
    orderBy: { updatedAt: "desc" },
    include: { answers: true },
  });
  const targetAssessment = await prisma.assessment.findFirst({
    where: { organizationId: orgId, standardId: toEdition.id, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    orderBy: { updatedAt: "desc" },
    include: { answers: { select: { id: true, clauseId: true } } },
  });

  let carried = 0;
  if (sourceAssessment && targetAssessment) {
    const sourceIds = sourceAssessment.answers.map((a) => a.clauseId);
    const mappings = await prisma.requirementMapping.findMany({
      where: { sourceRequirementId: { in: sourceIds }, target: { standardId: toEdition.id } },
    });
    const bySource = new Map(sourceAssessment.answers.map((a) => [a.clauseId, a]));
    const targetByClause = new Map(targetAssessment.answers.map((a) => [a.clauseId, a.id]));
    for (const m of mappings) {
      const src = bySource.get(m.sourceRequirementId);
      const targetAnswerId = targetByClause.get(m.targetRequirementId);
      if (!src || !targetAnswerId) continue;
      await prisma.assessmentAnswer.update({
        where: { id: targetAnswerId },
        data: { score: src.score, status: src.status, comment: src.comment ?? null },
      });
      carried += 1;
    }
    // Preserve the prior assessment as history.
    await prisma.assessment.update({ where: { id: sourceAssessment.id }, data: { status: "ARCHIVED" } });
  }

  await logAuditEvent({
    ctx, action: "update", module: "standards", recordId: toEdition.id,
    before: { edition: data.fromEditionCode }, after: { edition: data.toEditionCode },
    extra: { event: "transition_edition", answersCarried: carried },
  });

  revalidatePath("/app/standards");
  revalidatePath("/app/gap");
  return { fromEditionId: fromEdition.id, toEditionId: toEdition.id, answersCarried: carried };
}
