"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { EvidenceStatus, EvidenceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { getCollaboratorScope, assertCollaboratorCanAccess, assertCollaboratorProcessAccess } from "@/lib/permissions/scope";
import { logAuditEvent, writeAuditLog, diff } from "@/lib/audit-log";
import { createSignedEvidenceUrl, deleteEvidenceFile, releaseStorageQuota, uploadEvidenceFile } from "@/lib/storage";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import { evidenceSchema } from "@/lib/validation/p1";

const PATH = "/app/evidence";

export type EvidenceLinksInput = {
  documentIds?: string[];
  riskIds?: string[];
  auditIds?: string[];
  findingIds?: string[];
  nonconformityIds?: string[];
  indicatorIds?: string[];
  managementReviewIds?: string[];
};

export type CreateEvidenceInput = {
  title: string;
  description?: string;
  evidenceType: EvidenceType;
  processId?: string;
  standardCode?: string;
  clauseId?: string;
  responsibleId?: string;
  issuedAt?: string;
  expiresAt?: string;
  file: File;
  links?: EvidenceLinksInput;
};

export type UpdateEvidenceInput = Partial<Omit<CreateEvidenceInput, "file" | "links" | "evidenceType">> & {
  evidenceType?: EvidenceType;
  links?: EvidenceLinksInput;
};

function optional(value?: string | null) {
  return value?.trim() || null;
}

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha de evidencia no es válida.");
  return parsed;
}

function uniqueIds(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeDates(issuedAt?: string | null, expiresAt?: string | null) {
  const issued = dateOrNull(issuedAt);
  const expires = dateOrNull(expiresAt);
  if (issued && expires && expires < issued) throw new Error("La fecha de vencimiento no puede ser anterior a la fecha de emisión.");
  return { issued, expires };
}

function effectiveStatus(status: EvidenceStatus, expiresAt: Date | null, now = new Date()): EvidenceStatus {
  if (status === EvidenceStatus.PENDING_REVIEW) return status;
  if (expiresAt && expiresAt < now) return EvidenceStatus.EXPIRED;
  return EvidenceStatus.VALID;
}

async function assertEvidenceReferences(input: {
  organizationId: string;
  processId?: string | null;
  standardCode?: string | null;
  clauseId?: string | null;
  responsibleId?: string | null;
  links?: EvidenceLinksInput;
}) {
  const { organizationId, links } = input;
  const [process, clause, responsible, standard, documentCount, riskCount, auditCount, findingCount, nonconformityCount, indicatorCount, managementReviewCount] = await Promise.all([
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId }, select: { id: true } }) : null,
    input.clauseId ? prisma.clause.findFirst({ where: { id: input.clauseId, standard: { ...(input.standardCode ? { code: input.standardCode } : {}), orgStandards: { some: { organizationId } } } }, select: { id: true, standard: { select: { code: true } } } }) : null,
    input.responsibleId ? prisma.membership.findFirst({ where: { organizationId, userId: input.responsibleId, active: true }, select: { userId: true } }) : null,
    input.standardCode ? prisma.organizationStandard.findFirst({ where: { organizationId, standard: { code: input.standardCode } }, select: { id: true } }) : null,
    links?.documentIds?.length ? prisma.document.count({ where: { organizationId, id: { in: uniqueIds(links.documentIds) } } }) : 0,
    links?.riskIds?.length ? prisma.risk.count({ where: { organizationId, id: { in: uniqueIds(links.riskIds) } } }) : 0,
    links?.auditIds?.length ? prisma.audit.count({ where: { organizationId, id: { in: uniqueIds(links.auditIds) } } }) : 0,
    links?.findingIds?.length ? prisma.auditFinding.count({ where: { id: { in: uniqueIds(links.findingIds) }, audit: { organizationId } } }) : 0,
    links?.nonconformityIds?.length ? prisma.nonconformity.count({ where: { organizationId, id: { in: uniqueIds(links.nonconformityIds) } } }) : 0,
    links?.indicatorIds?.length ? prisma.indicator.count({ where: { organizationId, id: { in: uniqueIds(links.indicatorIds) } } }) : 0,
    links?.managementReviewIds?.length ? prisma.managementReview.count({ where: { organizationId, id: { in: uniqueIds(links.managementReviewIds) } } }) : 0,
  ]);

  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.standardCode && !standard) throw new Error("La norma no está habilitada para la organización.");
  if (input.clauseId && !clause) throw new Error("La cláusula no pertenece a una norma habilitada para la organización.");
  if (clause && input.standardCode && clause.standard.code !== input.standardCode) throw new Error("La cláusula no corresponde a la norma seleccionada.");
  if (input.responsibleId && !responsible) throw new Error("El responsable no pertenece a la organización.");
  const checks = [
    [links?.documentIds, documentCount, "documentos"],
    [links?.riskIds, riskCount, "riesgos"],
    [links?.auditIds, auditCount, "auditorías"],
    [links?.findingIds, findingCount, "hallazgos"],
    [links?.nonconformityIds, nonconformityCount, "no conformidades"],
    [links?.indicatorIds, indicatorCount, "indicadores"],
    [links?.managementReviewIds, managementReviewCount, "revisiones por dirección"],
  ] as const;
  for (const [ids, count, label] of checks) if (ids?.length && count !== uniqueIds(ids).length) throw new Error(`Uno de los vínculos de ${label} no pertenece a la organización.`);
}

async function assertCollaboratorLinks(ctx: Awaited<ReturnType<typeof requireAuthorization>>["ctx"], input: { processId?: string | null; links?: EvidenceLinksInput }) {
  if (ctx.role !== "CONTRIBUTOR") return;
  await assertCollaboratorProcessAccess(ctx, input.processId);
  const checks: [keyof Omit<Awaited<ReturnType<typeof getCollaboratorScope>>, "isScoped">, string[] | undefined][] = [
    ["documentIds", input.links?.documentIds],
    ["riskIds", input.links?.riskIds],
    ["auditIds", input.links?.auditIds],
    ["nonconformityIds", input.links?.nonconformityIds],
    ["indicatorIds", input.links?.indicatorIds],
  ];
  for (const [scopeKey, ids] of checks) for (const id of uniqueIds(ids)) await assertCollaboratorCanAccess(ctx, scopeKey, id);
  const scope = await getCollaboratorScope(ctx);
  for (const findingId of uniqueIds(input.links?.findingIds)) {
    const finding = await prisma.auditFinding.findFirst({ where: { id: findingId, audit: { organizationId: ctx.organization.id } }, select: { auditId: true } });
    if (!finding || !scope.auditIds.includes(finding.auditId)) throw new Error("No tienes acceso al hallazgo vinculado.");
  }
  if (uniqueIds(input.links?.managementReviewIds).length) throw new Error("Los colaboradores no pueden vincular evidencia a revisiones por dirección.");
}

function linkData(evidenceId: string, organizationId: string, createdById: string, links: EvidenceLinksInput | undefined) {
  const base = { evidenceId, organizationId, createdById };
  return {
    document: uniqueIds(links?.documentIds).map((documentId) => ({ ...base, documentId })),
    risk: uniqueIds(links?.riskIds).map((riskId) => ({ ...base, riskId })),
    audit: uniqueIds(links?.auditIds).map((auditId) => ({ ...base, auditId })),
    finding: uniqueIds(links?.findingIds).map((findingId) => ({ ...base, findingId })),
    nonconformity: uniqueIds(links?.nonconformityIds).map((nonconformityId) => ({ ...base, nonconformityId })),
    indicator: uniqueIds(links?.indicatorIds).map((indicatorId) => ({ ...base, indicatorId })),
    managementReview: uniqueIds(links?.managementReviewIds).map((managementReviewId) => ({ ...base, managementReviewId })),
  };
}

async function replaceLinks(tx: Prisma.TransactionClient, evidenceId: string, organizationId: string, userId: string, links: EvidenceLinksInput | undefined) {
  const data = linkData(evidenceId, organizationId, userId, links);
  await Promise.all([
    tx.evidenceDocumentLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceRiskLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceAuditLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceFindingLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceNonconformityLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceIndicatorLink.deleteMany({ where: { evidenceId } }),
    tx.evidenceManagementReviewLink.deleteMany({ where: { evidenceId } }),
  ]);
  await Promise.all([
    data.document.length && tx.evidenceDocumentLink.createMany({ data: data.document }),
    data.risk.length && tx.evidenceRiskLink.createMany({ data: data.risk }),
    data.audit.length && tx.evidenceAuditLink.createMany({ data: data.audit }),
    data.finding.length && tx.evidenceFindingLink.createMany({ data: data.finding }),
    data.nonconformity.length && tx.evidenceNonconformityLink.createMany({ data: data.nonconformity }),
    data.indicator.length && tx.evidenceIndicatorLink.createMany({ data: data.indicator }),
    data.managementReview.length && tx.evidenceManagementReviewLink.createMany({ data: data.managementReview }),
  ].filter(Boolean));
}

export async function createEvidence(input: CreateEvidenceInput): Promise<{ id: string }> {
  const validated = parseInput(evidenceSchema, {
    title: input.title,
    description: input.description,
    evidenceType: input.evidenceType,
    processId: input.processId,
    standardCode: input.standardCode,
    clauseId: input.clauseId,
    responsibleId: input.responsibleId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    links: input.links,
  });
  input = { ...input, ...validated } as CreateEvidenceInput;
  const ctx = await requirePermission("evidence:create");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!Object.values(EvidenceType).includes(input.evidenceType)) throw new Error("Tipo de evidencia no válido.");
  const { issued, expires } = normalizeDates(input.issuedAt, input.expiresAt);
  await assertEvidenceReferences({ organizationId: ctx.organization.id, processId: input.processId, standardCode: input.standardCode, clauseId: input.clauseId, responsibleId: input.responsibleId, links: input.links });
  await assertCollaboratorLinks(ctx, input);

  const id = randomUUID();
  const uploaded = await uploadEvidenceFile({ organizationId: ctx.organization.id, evidenceId: id, file: input.file });
  try {
    const data = linkData(id, ctx.organization.id, ctx.user.id, input.links);
    await prisma.$transaction(async (tx) => {
      await tx.evidenceFile.create({ data: {
        id,
        organizationId: ctx.organization.id,
        title,
        description: optional(input.description),
        evidenceType: input.evidenceType,
        status: EvidenceStatus.PENDING_REVIEW,
        fileUrl: uploaded.path,
        fileSize: uploaded.size,
        mimeType: uploaded.mime,
        processId: input.processId || null,
        standardCode: optional(input.standardCode),
        clauseId: input.clauseId || null,
        responsibleId: input.responsibleId || null,
        issuedAt: issued,
        expiresAt: expires,
        uploadedById: ctx.user.id,
      } });
      await replaceLinks(tx, id, ctx.organization.id, ctx.user.id, input.links);
      await writeAuditLog(tx, { ctx, action: "create", module: "evidence", recordId: id, after: { title, evidenceType: input.evidenceType, fileSize: uploaded.size } });
      await writeAuditLog(tx, { ctx, action: "upload", module: "evidence", recordId: id, after: { title, evidenceType: input.evidenceType, fileSize: uploaded.size, links: input.links ?? {} } });
    });
  } catch (error) {
    await deleteEvidenceFile(uploaded.path, ctx.organization.id).catch(() => undefined);
    await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    throw error;
  }

  revalidatePath(PATH);
  return { id };
}

export async function updateEvidence(id: string, patch: UpdateEvidenceInput) {
  if (patch.title !== undefined && (patch.title.trim().length === 0 || patch.title.length > 240)) throw new Error("El título de evidencia no es válido.");
  if (patch.description !== undefined && patch.description.length > 8000) throw new Error("La descripción de evidencia supera el límite permitido.");
  const ctx = await requirePermission("evidence:update");
  const existing = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id, deletedAt: null } });
  if (!existing) throw new Error("Evidencia no encontrada.");
  const { issued, expires } = normalizeDates(patch.issuedAt ?? existing.issuedAt?.toISOString(), patch.expiresAt ?? existing.expiresAt?.toISOString());
  await assertEvidenceReferences({ organizationId: ctx.organization.id, processId: patch.processId ?? existing.processId, standardCode: patch.standardCode ?? existing.standardCode, clauseId: patch.clauseId ?? existing.clauseId, responsibleId: patch.responsibleId ?? existing.responsibleId, links: patch.links });
  await assertCollaboratorLinks(ctx, { processId: patch.processId ?? existing.processId, links: patch.links });
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.evidenceFile.update({ where: { id }, data: {
      title: patch.title === undefined ? undefined : patch.title.trim(),
      description: patch.description === undefined ? undefined : optional(patch.description),
      evidenceType: patch.evidenceType,
      processId: patch.processId === undefined ? undefined : patch.processId || null,
      standardCode: patch.standardCode === undefined ? undefined : optional(patch.standardCode),
      clauseId: patch.clauseId === undefined ? undefined : patch.clauseId || null,
      responsibleId: patch.responsibleId === undefined ? undefined : patch.responsibleId || null,
      issuedAt: patch.issuedAt === undefined ? undefined : issued,
      expiresAt: patch.expiresAt === undefined ? undefined : expires,
      status: existing.status === EvidenceStatus.PENDING_REVIEW ? undefined : effectiveStatus(existing.status, expires),
    } });
    if (patch.title !== undefined && !patch.title.trim()) throw new Error("El título es obligatorio.");
    if (patch.links) await replaceLinks(tx, id, ctx.organization.id, ctx.user.id, patch.links);
    return updated;
  });
  const changes = diff(existing as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
  await logAuditEvent({ ctx, action: "update", module: "evidence", recordId: id, before: changes?.before, after: changes?.after });
  revalidatePath(PATH);
}

export async function reviewEvidence(id: string, decision: "APPROVE" | "REJECT", comment?: string) {
  const ctx = await requirePermission("evidence:approve");
  if (decision === "REJECT" && !comment?.trim()) throw new Error("El comentario es obligatorio para rechazar una evidencia.");
  const existing = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id, deletedAt: null } });
  if (!existing) throw new Error("Evidencia no encontrada.");
  const status = decision === "REJECT" ? EvidenceStatus.PENDING_REVIEW : effectiveStatus(EvidenceStatus.VALID, existing.expiresAt);
  const updated = await prisma.evidenceFile.update({ where: { id }, data: { status, reviewedAt: new Date(), reviewedById: ctx.user.id } });
  await logAuditEvent({ ctx, action: decision === "REJECT" ? "reject" : "approve", module: "evidence", recordId: id, before: { status: existing.status }, after: { status: updated.status, comment: optional(comment) } });
  revalidatePath(PATH);
}

export async function getEvidenceUrl(id: string) {
  const ctx = await requirePermission("evidence:read");
  const evidence = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id, deletedAt: null } });
  if (!evidence) throw new Error("Evidencia no encontrada.");
  const url = await createSignedEvidenceUrl(evidence.fileUrl, ctx.organization.id, 300);
  await logAuditEvent({ ctx, action: "download", module: "evidence", recordId: id, extra: { mimeType: evidence.mimeType, fileSize: evidence.fileSize } });
  return url;
}

export async function archiveEvidence(id: string) {
  const ctx = await requirePermission("evidence:delete");
  const existing = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id, deletedAt: null } });
  if (!existing) throw new Error("Evidencia no encontrada.");
  await prisma.evidenceFile.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAuditEvent({ ctx, action: "archive", module: "evidence", recordId: id, before: { title: existing.title, status: existing.status } });
  revalidatePath(PATH);
}

export async function exportEvidenceIndex(input: { format: "PDF" | "EXCEL"; filters?: { search?: string; status?: EvidenceStatus | "ALL"; evidenceType?: EvidenceType | "ALL"; processId?: string; standardCode?: string; clauseId?: string; responsibleId?: string } }) {
  const { ctx } = await requireAuthorization("evidence:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  if (!["PDF", "EXCEL"].includes(input.format)) throw new Error("Formato de exportación no válido.");
  const filters = input.filters ?? {};
  const scope = await getCollaboratorScope(ctx);
  const now = new Date();
  const statusFilter: Prisma.EvidenceFileWhereInput = filters.status === "EXPIRED"
    ? { OR: [{ status: EvidenceStatus.EXPIRED }, { status: EvidenceStatus.VALID, expiresAt: { lt: now } }] }
    : filters.status && filters.status !== "ALL" ? { status: filters.status } : {};
  const where: Prisma.EvidenceFileWhereInput = {
    organizationId: ctx.organization.id,
    deletedAt: null,
    ...(scope.isScoped ? {
      AND: [{ OR: [
        { uploadedById: ctx.user.id },
        ...(scope.processIds.length ? [{ processId: { in: scope.processIds } }] : []),
        ...(scope.documentIds.length ? [{ documentLinks: { some: { documentId: { in: scope.documentIds } } } }] : []),
        ...(scope.riskIds.length ? [{ riskLinks: { some: { riskId: { in: scope.riskIds } } } }] : []),
        ...(scope.auditIds.length ? [{ auditLinks: { some: { auditId: { in: scope.auditIds } } } }] : []),
        ...(scope.nonconformityIds.length ? [{ nonconformityLinks: { some: { nonconformityId: { in: scope.nonconformityIds } } } }] : []),
        ...(scope.indicatorIds.length ? [{ indicatorLinks: { some: { indicatorId: { in: scope.indicatorIds } } } }] : []),
      ] }],
    } : {}),
    ...statusFilter,
    ...(filters.evidenceType && filters.evidenceType !== "ALL" ? { evidenceType: filters.evidenceType } : {}),
    ...(filters.processId && filters.processId !== "ALL" ? { processId: filters.processId } : {}),
    ...(filters.standardCode && filters.standardCode !== "ALL" ? { standardCode: filters.standardCode } : {}),
    ...(filters.clauseId && filters.clauseId !== "ALL" ? { clauseId: filters.clauseId } : {}),
    ...(filters.responsibleId && filters.responsibleId !== "ALL" ? { responsibleId: filters.responsibleId } : {}),
    ...(filters.search?.trim() ? { AND: [{ OR: [{ title: { contains: filters.search.trim(), mode: "insensitive" } }, { description: { contains: filters.search.trim(), mode: "insensitive" } }] }] } : {}),
  };
  const rows = await prisma.evidenceFile.findMany({ where, include: { process: true, clause: { include: { standard: true } }, responsible: true }, orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }] });
  const exportRows = rows.map((row) => ({
    titulo: row.title,
    tipo: row.evidenceType,
    estado: effectiveStatus(row.status, row.expiresAt, now),
    norma: row.standardCode ?? row.clause?.standard.code ?? "",
    clausula: row.clause ? `${row.clause.code} — ${row.clause.title}` : "",
    proceso: row.process ? `${row.process.code ?? ""} — ${row.process.name}` : "",
    responsable: row.responsible?.name ?? "",
    emitida: row.issuedAt?.toISOString().slice(0, 10) ?? "",
    vence: row.expiresAt?.toISOString().slice(0, 10) ?? "",
    cargada: row.createdAt.toISOString().slice(0, 10),
  }));
  const date = now.toISOString().slice(0, 10);
  const fileName = `indice-evidencias-${date}.${input.format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = input.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const report = await queueReportForContext({ ctx, reportType: "evidence", title: "Índice de evidencias", format: input.format, fileName, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), status: filters.status && filters.status !== "ALL" ? filters.status : undefined, standardCode: filters.standardCode && filters.standardCode !== "ALL" ? filters.standardCode : undefined } });
  revalidatePath("/app/activity");
  return { id: report.id, fileName, mimeType, status: report.status, rowCount: report.rowCount };
}
