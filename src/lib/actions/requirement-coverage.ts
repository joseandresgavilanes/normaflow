"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CoverageEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const linkSchema = z.object({
  requirementId: z.string().min(1),
  entityType: z.enum(["DOCUMENT", "RISK", "EVIDENCE", "INDICATOR", "AUDIT", "CAPA", "RECORD", "PROCESS"]),
  entityId: z.string().min(1),
  coverageType: z.string().max(120).optional(),
  note: z.string().max(2000).optional(),
});

/** Verify the target entity belongs to the caller's organization. */
async function assertEntityInOrg(entityType: CoverageEntityType, entityId: string, organizationId: string) {
  const where = { id: entityId, organizationId };
  const exists = await (async () => {
    switch (entityType) {
      case "DOCUMENT": return prisma.document.findFirst({ where, select: { id: true } });
      case "RISK": return prisma.risk.findFirst({ where, select: { id: true } });
      case "EVIDENCE": return prisma.evidenceFile.findFirst({ where, select: { id: true } });
      case "INDICATOR": return prisma.indicator.findFirst({ where, select: { id: true } });
      case "AUDIT": return prisma.audit.findFirst({ where, select: { id: true } });
      case "CAPA": return prisma.cAPA.findFirst({ where, select: { id: true } });
      case "RECORD": return prisma.record.findFirst({ where, select: { id: true } });
      case "PROCESS": return prisma.process.findFirst({ where, select: { id: true } });
      default: return null;
    }
  })();
  if (!exists) throw new Error("El elemento no pertenece a la organización.");
}

/**
 * Vincula un elemento (documento, riesgo, evidencia, indicador, auditoría, CAPA,
 * registro o proceso) a un requisito. Un mismo elemento puede satisfacer varios
 * requisitos de distintas normas. Idempotente por (org, requisito, tipo, id).
 */
export async function linkRequirementCoverage(input: z.infer<typeof linkSchema>) {
  const ctx = await requirePermission("standards:activate");
  const data = linkSchema.parse(input);

  // The requirement must belong to an edition the org has activated.
  const requirement = await prisma.standardRequirement.findFirst({
    where: { id: data.requirementId, standard: { orgStandards: { some: { organizationId: ctx.organization.id } } } },
    select: { id: true },
  });
  if (!requirement) throw new Error("El requisito no pertenece a una norma activa de la organización.");

  await assertEntityInOrg(data.entityType, data.entityId, ctx.organization.id);

  const coverage = await prisma.requirementCoverage.upsert({
    where: {
      organizationId_requirementId_entityType_entityId: {
        organizationId: ctx.organization.id,
        requirementId: data.requirementId,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    },
    update: { coverageType: data.coverageType ?? null, note: data.note ?? null },
    create: {
      organizationId: ctx.organization.id,
      requirementId: data.requirementId,
      entityType: data.entityType,
      entityId: data.entityId,
      coverageType: data.coverageType ?? null,
      note: data.note ?? null,
      createdById: ctx.user.id,
    },
  });

  await logAuditEvent({
    ctx, action: "create", module: "standards", recordId: coverage.id,
    after: { requirementId: data.requirementId, entityType: data.entityType, entityId: data.entityId },
    extra: { event: "link_requirement_coverage" },
  });

  revalidatePath("/app/standards");
  return { id: coverage.id };
}

/** Elimina un vínculo de cobertura de requisito. */
export async function unlinkRequirementCoverage(coverageId: string) {
  const ctx = await requirePermission("standards:activate");
  const id = z.string().min(1).parse(coverageId);

  const existing = await prisma.requirementCoverage.findFirst({
    where: tenantWhere(ctx, { id }),
    select: { id: true, requirementId: true, entityType: true, entityId: true },
  });
  if (!existing) throw new Error("La cobertura no pertenece a la organización.");

  await prisma.requirementCoverage.delete({ where: { id: existing.id } });
  await logAuditEvent({
    ctx, action: "delete", module: "standards", recordId: existing.id,
    before: { requirementId: existing.requirementId, entityType: existing.entityType, entityId: existing.entityId },
    extra: { event: "unlink_requirement_coverage" },
  });

  revalidatePath("/app/standards");
  return { id: existing.id };
}
