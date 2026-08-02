"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getStandardSpec } from "@/lib/standards-catalog";
import { assertPackEntitlement, getPackForFamily, installCrosswalk, installPack, SIG_CROSSWALK_FAMILIES } from "@/lib/standard-packs";
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
  const result = await prisma.$transaction(async (tx) => {
    const adoption = await adoptStandardForOrganization({
      db: tx,
      organizationId: ctx.organization.id,
      standardCode: spec.code,
      standardId: edition.id,
      assessorId: ctx.user.id,
    });
    await writeAuditLog(tx, {
      ctx, action: "create", module: "gap", recordId: adoption.assessmentId,
      after: { standard: spec.code, version: spec.version, answersCreated: adoption.answersCreated },
      extra: { event: "adopt_standard" },
    });
    return adoption;
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
  if (pack) {
    // Catalog install is idempotent and touches no org data — fine outside the tx.
    await installPack(pack);
    // Real activation gate: plan + pack lifecycle + OrganizationPackEntitlement +
    // the standards:activate permission already checked above. No ALL_MODULES,
    // no env-flag bypass — every org needs its own entitlement row.
    await assertPackEntitlement(ctx, pack.code);
    // Activating any of the three SIG-related standards (or the SIG layer itself)
    // (re)installs the 9001/14001/45001 crosswalk — idempotent, catalog-level,
    // no-ops for endpoints that don't exist yet (e.g. only one norm active so far).
    if (SIG_CROSSWALK_FAMILIES.has(data.familyCode)) await installCrosswalk();
  }

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

  if (data.responsibleId) {
    const member = await prisma.membership.findFirst({
      where: { userId: data.responsibleId, organizationId: ctx.organization.id },
      select: { id: true },
    });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }

  const spec = getStandardSpec(data.familyCode);
  const sourcePackId = edition.packLinks[0]?.pack.id ?? null;

  const { orgStandard, assessmentId } = await prisma.$transaction(async (tx) => {
    const adoption = spec
      ? await adoptStandardForOrganization({
          db: tx, organizationId: ctx.organization.id, standardCode: spec.code,
          standardId: edition.id, assessorId: ctx.user.id,
        })
      : { adoptionId: null, assessmentId: null, answersCreated: 0 };

    const updated = await tx.organizationStandard.update({
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

    await writeAuditLog(tx, {
      ctx, action: "create", module: "standards", recordId: updated.id,
      after: { family: data.familyCode, edition: edition.editionCode, scope: data.scope ?? null },
      extra: { event: "activate_standard", assessmentId: adoption.assessmentId },
    });

    return { orgStandard: updated, assessmentId: adoption.assessmentId };
  });

  revalidatePath("/app/standards");
  revalidatePath("/app/gap");
  revalidatePath("/app/dashboard");
  return { orgStandardId: orgStandard.id, editionId: edition.id, assessmentId };
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

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.organizationStandard.update({
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
    await writeAuditLog(tx, {
      ctx, action: "update", module: "standards", recordId: row.id,
      after: { implementationStatus: row.implementationStatus, certified: row.certified },
    });
    return row;
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

  const spec = getStandardSpec(data.familyCode);

  const carried = await prisma.$transaction(async (tx) => {
    // Ensure the org has the target edition activated with a fresh GAP assessment.
    if (spec) {
      await adoptStandardForOrganization({ db: tx, organizationId: orgId, standardCode: spec.code, standardId: toEdition.id, assessorId: ctx.user.id });
    }

    // Carry forward the latest answers of the source edition using mappings.
    const sourceAssessment = await tx.assessment.findFirst({
      where: { organizationId: orgId, standardId: fromEdition.id },
      orderBy: { updatedAt: "desc" },
      include: { answers: true },
    });
    const targetAssessment = await tx.assessment.findFirst({
      where: { organizationId: orgId, standardId: toEdition.id, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      include: { answers: { select: { id: true, clauseId: true } } },
    });

    let carriedCount = 0;
    if (sourceAssessment && targetAssessment) {
      const sourceIds = sourceAssessment.answers.map((a) => a.clauseId);
      const mappings = await tx.requirementMapping.findMany({
        where: { sourceRequirementId: { in: sourceIds }, target: { standardId: toEdition.id } },
      });
      const bySource = new Map(sourceAssessment.answers.map((a) => [a.clauseId, a]));
      const targetByClause = new Map(targetAssessment.answers.map((a) => [a.clauseId, a.id]));
      for (const m of mappings) {
        const src = bySource.get(m.sourceRequirementId);
        const targetAnswerId = targetByClause.get(m.targetRequirementId);
        if (!src || !targetAnswerId) continue;
        await tx.assessmentAnswer.update({
          where: { id: targetAnswerId },
          data: { score: src.score, status: src.status, comment: src.comment ?? null },
        });
        carriedCount += 1;
      }
      // Preserve the prior assessment as history.
      await tx.assessment.update({ where: { id: sourceAssessment.id }, data: { status: "ARCHIVED" } });
    }

    await writeAuditLog(tx, {
      ctx, action: "update", module: "standards", recordId: toEdition.id,
      before: { edition: data.fromEditionCode }, after: { edition: data.toEditionCode },
      extra: { event: "transition_edition", answersCarried: carriedCount },
    });

    return carriedCount;
  });

  revalidatePath("/app/standards");
  revalidatePath("/app/gap");
  return { fromEditionId: fromEdition.id, toEditionId: toEdition.id, answersCarried: carried };
}
