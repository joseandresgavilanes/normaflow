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

/* ---------------------------------------------------------------------------
 * Lectura: qué cubre un requisito y qué se le puede vincular
 *
 * `linkRequirementCoverage` existía desde el principio, validada y auditada,
 * y no la importaba ningún componente: cero consumidores en todo src/. Por eso
 * `RequirementCoverage` estaba vacía y toda métrica de cobertura, factor de
 * reutilización o evidencia compartida entre normas salía en cero. Estas dos
 * lecturas son lo que faltaba para poder cablear una pantalla.
 * ------------------------------------------------------------------------ */

export type CoverageLink = {
  id: string;
  entityType: CoverageEntityType;
  entityId: string;
  label: string;
  coverageType: string | null;
  note: string | null;
};

/** Título legible de un elemento vinculado, por tipo. */
async function labelsFor(
  entityType: CoverageEntityType,
  ids: string[],
  organizationId: string,
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const where = { id: { in: ids }, organizationId };
  const rows = await (async () => {
    switch (entityType) {
      case "DOCUMENT": return prisma.document.findMany({ where, select: { id: true, code: true, title: true } });
      case "RISK": return prisma.risk.findMany({ where, select: { id: true, title: true } });
      case "EVIDENCE": return prisma.evidenceFile.findMany({ where, select: { id: true, title: true } });
      case "INDICATOR": return prisma.indicator.findMany({ where, select: { id: true, name: true } });
      case "AUDIT": return prisma.audit.findMany({ where, select: { id: true, title: true } });
      case "CAPA": return prisma.cAPA.findMany({ where, select: { id: true, code: true, title: true } });
      case "RECORD": return prisma.record.findMany({ where, select: { id: true, code: true, name: true } });
      case "PROCESS": return prisma.process.findMany({ where, select: { id: true, code: true, name: true } });
      default: return [];
    }
  })();
  return new Map(
    rows.map((row) => {
      const r = row as { id: string; code?: string | null; title?: string; name?: string };
      const nombre = r.title ?? r.name ?? r.id;
      return [r.id, r.code ? `${r.code} · ${nombre}` : nombre];
    }),
  );
}

/** Elementos que ya cubren un requisito. */
export async function listRequirementCoverage(requirementId: string): Promise<CoverageLink[]> {
  const ctx = await requirePermission("standards:read");
  const id = z.string().min(1).parse(requirementId);

  const links = await prisma.requirementCoverage.findMany({
    where: { organizationId: ctx.organization.id, requirementId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, entityType: true, entityId: true, coverageType: true, note: true },
  });

  // Se agrupan por tipo para resolver los títulos con una consulta por tabla
  // en vez de una por vínculo.
  const porTipo = new Map<CoverageEntityType, string[]>();
  for (const link of links) {
    porTipo.set(link.entityType, [...(porTipo.get(link.entityType) ?? []), link.entityId]);
  }
  const etiquetas = new Map<string, string>();
  await Promise.all(
    [...porTipo.entries()].map(async ([tipo, ids]) => {
      const mapa = await labelsFor(tipo, ids, ctx.organization.id);
      for (const [entityId, label] of mapa) etiquetas.set(`${tipo}:${entityId}`, label);
    }),
  );

  return links.map((link) => ({
    ...link,
    label: etiquetas.get(`${link.entityType}:${link.entityId}`) ?? link.entityId,
  }));
}

const searchSchema = z.object({
  entityType: z.enum(["DOCUMENT", "RISK", "EVIDENCE", "INDICATOR", "AUDIT", "CAPA", "RECORD", "PROCESS"]),
  query: z.string().max(120).optional(),
});

/** Candidatos vinculables de un tipo, para el buscador del diálogo. */
export async function searchCoverageCandidates(
  input: z.infer<typeof searchSchema>,
): Promise<{ id: string; label: string }[]> {
  const ctx = await requirePermission("standards:read");
  const data = searchSchema.parse(input);
  const organizationId = ctx.organization.id;
  const q = data.query?.trim();

  // `mode: "insensitive"` sobre el título: el usuario no recuerda el código
  // exacto del documento que quiere vincular, recuerda cómo se llama.
  const texto = q ? { contains: q, mode: "insensitive" as const } : undefined;

  const rows = await (async () => {
    switch (data.entityType) {
      case "DOCUMENT": return prisma.document.findMany({ where: { organizationId, ...(texto ? { title: texto } : {}) }, take: 40, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } });
      case "RISK": return prisma.risk.findMany({ where: { organizationId, ...(texto ? { title: texto } : {}) }, take: 40, orderBy: { title: "asc" }, select: { id: true, title: true } });
      case "EVIDENCE": return prisma.evidenceFile.findMany({ where: { organizationId, ...(texto ? { title: texto } : {}) }, take: 40, orderBy: { createdAt: "desc" }, select: { id: true, title: true } });
      case "INDICATOR": return prisma.indicator.findMany({ where: { organizationId, ...(texto ? { name: texto } : {}) }, take: 40, orderBy: { name: "asc" }, select: { id: true, name: true } });
      case "AUDIT": return prisma.audit.findMany({ where: { organizationId, ...(texto ? { title: texto } : {}) }, take: 40, orderBy: { title: "asc" }, select: { id: true, title: true } });
      case "CAPA": return prisma.cAPA.findMany({ where: { organizationId, ...(texto ? { title: texto } : {}) }, take: 40, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } });
      case "RECORD": return prisma.record.findMany({ where: { organizationId, ...(texto ? { name: texto } : {}) }, take: 40, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
      case "PROCESS": return prisma.process.findMany({ where: { organizationId, ...(texto ? { name: texto } : {}) }, take: 40, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
      default: return [];
    }
  })();

  return rows.map((row) => {
    const r = row as { id: string; code?: string | null; title?: string; name?: string };
    const nombre = r.title ?? r.name ?? r.id;
    return { id: r.id, label: r.code ? `${r.code} · ${nombre}` : nombre };
  });
}
