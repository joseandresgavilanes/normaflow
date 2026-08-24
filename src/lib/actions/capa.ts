"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { ACPMEfficacyStatus, ACPMOrigin, ACPMRootCauseMethod, CAPAEvidenceKind, CAPAStage, NCSeverity, Prisma, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization, requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { getCollaboratorScope } from "@/lib/permissions/scope";
import { logAuditEvent, writeAuditLog } from "@/lib/audit-log";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { uploadEvidenceFile, createSignedEvidenceUrl, deleteEvidenceFile, releaseStorageQuota } from "@/lib/storage";
import { canCloseCAPA, CAPA_NEXT_STAGE } from "@/lib/capa-workflow";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import { capaSchema, capaVerificationSchema } from "@/lib/validation/p1";

const PATH = "/app/actions";
const EXPORT_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function clean(value: unknown, field: string, required = false): string | null {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${field} es obligatorio.`);
  return result || null;
}

function dateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha límite no es válida.");
  return date;
}

async function nextCode(organizationId: string, db: Pick<Prisma.TransactionClient, "cAPA"> = prisma) {
  const year = new Date().getFullYear();
  const count = await db.cAPA.count({ where: { organizationId, createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } } });
  return `CAPA-${year}-${String(count + 1).padStart(3, "0")}`;
}

async function loadCAPA(id: string, organizationId: string) {
  const capa = await prisma.cAPA.findFirst({
    where: { id, organizationId },
    include: { evidences: { orderBy: { createdAt: "asc" } }, comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
  });
  if (!capa) throw new Error("ACPM/CAPA no encontrada.");
  return capa;
}

function assertCAPACollaborator(ctx: { scoped: boolean; user: { id: string } }, capa: { ownerId: string | null; requestedById: string }) {
  if (ctx.scoped && capa.ownerId !== ctx.user.id && capa.requestedById !== ctx.user.id) {
    throw new Error("No tienes acceso a esta CAPA porque no está asignada a tu usuario.");
  }
}

async function assertReferences(input: { processId?: string; clauseId?: string; standardCode?: string; ownerId?: string; nonconformityId?: string; findingId?: string }, organizationId: string) {
  const [process, clause, standard, owner, nc, finding] = await Promise.all([
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId }, select: { id: true } }) : null,
    input.clauseId ? prisma.standardRequirement.findFirst({ where: { id: input.clauseId, standard: { code: input.standardCode || undefined, orgStandards: { some: { organizationId } } } }, select: { id: true } }) : null,
    input.standardCode ? prisma.organizationStandard.findFirst({ where: { organizationId, standard: { code: input.standardCode } }, select: { id: true } }) : null,
    input.ownerId ? prisma.membership.findFirst({ where: { organizationId, userId: input.ownerId, active: true }, select: { id: true } }) : null,
    input.nonconformityId ? prisma.nonconformity.findFirst({ where: { id: input.nonconformityId, organizationId }, select: { id: true } }) : null,
    input.findingId ? prisma.auditFinding.findFirst({ where: { id: input.findingId, audit: { organizationId } }, select: { id: true } }) : null,
  ]);
  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.clauseId && !clause) throw new Error("La cláusula no pertenece a una norma habilitada para la organización.");
  if (input.standardCode && !standard) throw new Error("La norma no está habilitada para la organización.");
  if (input.ownerId && !owner) throw new Error("El responsable no pertenece a la organización.");
  if (input.nonconformityId && !nc) throw new Error("La no conformidad no pertenece a la organización.");
  if (input.findingId && !finding) throw new Error("El hallazgo no pertenece a la organización.");
}

export type CreateCAPAInput = {
  title: string;
  description: string;
  origin: ACPMOrigin;
  standardCode?: string;
  clauseId?: string;
  processId?: string;
  nonconformityId?: string;
  findingId?: string;
  severity: NCSeverity;
  priority: Priority;
  ownerId?: string;
  dueDate?: string;
  evidenceTitle?: string;
  evidenceFile?: File;
};

export async function createCAPA(input: CreateCAPAInput): Promise<{ id: string; code: string }> {
  const validated = parseInput(capaSchema, {
    title: input.title,
    description: input.description,
    origin: input.origin,
    standardCode: input.standardCode,
    clauseId: input.clauseId,
    processId: input.processId,
    nonconformityId: input.nonconformityId,
    findingId: input.findingId,
    severity: input.severity,
    priority: input.priority,
    ownerId: input.ownerId,
    dueDate: input.dueDate,
    evidenceTitle: input.evidenceTitle,
  });
  input = { ...input, ...validated } as CreateCAPAInput;
  const ctx = await requirePermission("actions:create");
  const title = clean(input.title, "El título", true)!;
  const description = clean(input.description, "La descripción", true)!;
  if (!Object.values(ACPMOrigin).includes(input.origin)) throw new Error("El origen no es válido.");
  if (!Object.values(NCSeverity).includes(input.severity)) throw new Error("La severidad no es válida.");
  if (!Object.values(Priority).includes(input.priority)) throw new Error("La prioridad no es válida.");
  await assertReferences(input, ctx.organization.id);
  if (ctx.scoped && input.processId) {
    const process = await prisma.process.findFirst({ where: { id: input.processId, organizationId: ctx.organization.id, ownerId: ctx.user.id }, select: { id: true } });
    if (!process) throw new Error("Solo puedes registrar ACPM en procesos asignados a tu usuario.");
  }
  const capaId = randomUUID();
  const uploaded = input.evidenceFile ? await uploadEvidenceFile({ organizationId: ctx.organization.id, evidenceId: capaId, file: input.evidenceFile }) : null;
  let capa;
  try {
    capa = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`capa:${ctx.organization.id}:${new Date().getUTCFullYear()}`}))`;
      const code = await nextCode(ctx.organization.id, tx);
      const created = await tx.cAPA.create({ data: {
        id: capaId, organizationId: ctx.organization.id, code, title, description, origin: input.origin,
        standardCode: input.standardCode?.trim() || null, clauseId: input.clauseId || null, processId: input.processId || null,
        nonconformityId: input.nonconformityId || null, severity: input.severity, priority: input.priority,
        findingId: input.findingId || null,
        ownerId: input.ownerId || null, dueDate: dateOrNull(input.dueDate), requestedById: ctx.user.id,
      } });
      if (uploaded) await tx.cAPAEvidence.create({ data: { id: randomUUID(), organizationId: ctx.organization.id, capaId, kind: CAPAEvidenceKind.NONCONFORMITY, title: clean(input.evidenceTitle, "El título de la evidencia", true)!, fileName: input.evidenceFile!.name.slice(0, 255), fileUrl: uploaded.path, fileSize: uploaded.size, mimeType: uploaded.mime, uploadedById: ctx.user.id } });
      await writeAuditLog(tx, { ctx, action: "create", module: "capa", recordId: created.id, after: { code, title, origin: input.origin, severity: input.severity, stage: created.stage } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (uploaded) {
      await deleteEvidenceFile(uploaded.path, ctx.organization.id).catch(() => undefined);
      await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    }
    await prisma.cAPA.delete({ where: { id: capaId } }).catch(() => undefined);
    throw error;
  }
  const code = capa.code;
  if (capa.ownerId && capa.ownerId !== ctx.user.id) await notifyUser({ organizationId: ctx.organization.id, userId: capa.ownerId, title: "Se te asignó una ACPM/CAPA", body: `${code} requiere análisis de causa raíz.`, type: "WARNING", link: PATH });
  revalidatePath(PATH); revalidatePath("/app/activity");
  return { id: capa.id, code };
}

export async function createCAPAFromFinding(findingId: string) {
  const ctx = await requirePermission("actions:create");
  const finding = await prisma.auditFinding.findFirst({ where: { id: findingId, audit: { organizationId: ctx.organization.id } }, include: { audit: { select: { title: true, standardCode: true, processId: true, auditorId: true } }, capa: { select: { id: true } } } });
  if (!finding) throw new Error("Hallazgo no encontrado.");
  if (finding.capa) throw new Error("Este hallazgo ya tiene una CAPA vinculada.");
  const result = await createCAPA({
    title: `CAPA · ${finding.title}`,
    description: finding.description?.trim() || `Plan de acción derivado del hallazgo de auditoría «${finding.audit.title}».`,
    origin: ACPMOrigin.AUDIT,
    standardCode: finding.audit.standardCode ?? undefined,
    processId: finding.audit.processId ?? undefined,
    findingId,
    severity: finding.severity,
    priority: finding.severity === "CRITICAL" ? "CRITICAL" : finding.severity === "MAJOR" ? "HIGH" : "MEDIUM",
    ownerId: finding.audit.auditorId ?? undefined,
  });
  await logAuditEvent({ ctx, action: "convert_finding_to_capa", module: "audit", recordId: finding.auditId, after: { findingId, capaId: result.id, capaCode: result.code } });
  revalidatePath("/app/audits");
  return result;
}

export type UpdateCAPAInput = {
  title?: string; description?: string; origin?: ACPMOrigin; standardCode?: string; clauseId?: string; processId?: string;
  nonconformityId?: string; severity?: NCSeverity; priority?: Priority; ownerId?: string; dueDate?: string;
  rootCauseMethod?: ACPMRootCauseMethod; fiveWhys?: string[]; ishikawaAnalysis?: string; rootCause?: string;
  correctiveAction?: string; progress?: number; implementationComments?: string; lessonsLearned?: string;
};

export async function updateCAPA(id: string, input: UpdateCAPAInput) {
  const ctx = await requirePermission("actions:update");
  const existing = await loadCAPA(id, ctx.organization.id);
  assertCAPACollaborator(ctx, existing);
  if (existing.stage === CAPAStage.CLOSED) throw new Error("Una CAPA cerrada no puede editarse.");
  await assertReferences(input, ctx.organization.id);
  if (input.title !== undefined && !clean(input.title, "El título", true)) throw new Error("El título es obligatorio.");
  if (input.description !== undefined && !clean(input.description, "La descripción", true)) throw new Error("La descripción es obligatoria.");
  const patch: Prisma.CAPAUpdateInput = {};
  for (const key of ["title", "description", "standardCode", "clauseId", "processId", "nonconformityId", "origin", "severity", "priority", "ownerId", "rootCauseMethod", "ishikawaAnalysis", "rootCause", "correctiveAction", "implementationComments", "lessonsLearned"] as const) {
    if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = typeof input[key] === "string" ? (input[key] as string).trim() || null : input[key];
  }
  if (input.fiveWhys !== undefined) patch.fiveWhys = input.fiveWhys.map((value) => value.trim()).filter(Boolean);
  if (input.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  if (input.dueDate !== undefined) patch.dueDate = dateOrNull(input.dueDate);
  await prisma.cAPA.update({ where: { id }, data: patch });
  await logAuditEvent({ ctx, action: "update", module: "capa", recordId: id, before: { stage: existing.stage }, after: patch as Record<string, unknown> });
  revalidatePath(PATH); revalidatePath("/app/activity");
}

export async function approveCAPARootCause(id: string) {
  const ctx = await requirePermission("actions:approve");
  const existing = await loadCAPA(id, ctx.organization.id);
  if (existing.stage !== CAPAStage.ROOT_CAUSE) throw new Error("La causa raíz solo puede aprobarse durante el análisis.");
  if (!existing.rootCause?.trim()) throw new Error("Documenta la causa raíz antes de aprobarla.");
  await prisma.$transaction(async (tx) => {
    const result = await tx.cAPA.updateMany({
      where: { id, organizationId: ctx.organization.id, stage: CAPAStage.ROOT_CAUSE, rootCauseApproved: false, updatedAt: existing.updatedAt },
      data: { rootCauseApproved: true, rootCauseApprovedById: ctx.user.id, rootCauseApprovedAt: new Date() },
    });
    if (result.count !== 1) throw new Error("La causa raíz cambió mientras se aprobaba. Recarga e inténtalo nuevamente.");
    await writeAuditLog(tx, { ctx, action: "approve", module: "capa", recordId: id, before: { rootCauseApproved: false }, after: { rootCauseApproved: true } });
  });
  revalidatePath(PATH); revalidatePath("/app/activity");
}

export async function advanceCAPA(id: string, comment?: string) {
  const auth = await getServerAuthorization();
  const ctx = auth.ctx;
  const existing = await loadCAPA(id, ctx.organization.id);
  assertCAPACollaborator(ctx, existing);
  const toStage = CAPA_NEXT_STAGE[existing.stage];
  if (!toStage) throw new Error("La CAPA ya está cerrada.");
  if (toStage === CAPAStage.ACTION_PLAN && (!existing.rootCauseApproved || !existing.rootCause?.trim())) throw new Error("La causa raíz debe estar documentada y aprobada.");
  if (toStage === CAPAStage.IMPLEMENTATION && (!existing.correctiveAction?.trim() || !existing.ownerId || !existing.dueDate)) throw new Error("Completa la acción correctiva, responsable y fecha límite.");
  if (toStage === CAPAStage.VERIFICATION) {
    if (existing.progress < 100) throw new Error("La implementación debe estar al 100%.");
    if (!existing.evidences.some((e) => e.kind === CAPAEvidenceKind.IMPLEMENTATION)) throw new Error("Adjunta evidencia de implementación antes de verificar.");
  }
  if (toStage === CAPAStage.CLOSED) {
    if (!canCloseCAPA({ efficacyStatus: existing.efficacyStatus, verifiedAt: existing.verifiedAt, evidenceKinds: existing.evidences.map((e) => e.kind) })) throw new Error("La eficacia debe estar verificada como eficaz y con evidencia antes de cerrar.");
    if (!auth.can("actions:approve")) throw new Error("Solo un rol aprobador puede cerrar una CAPA.");
  }
  await prisma.$transaction(async (tx) => {
    const result = await tx.cAPA.updateMany({
      where: { id, organizationId: ctx.organization.id, stage: existing.stage, updatedAt: existing.updatedAt },
      data: { stage: toStage, ...(toStage === CAPAStage.CLOSED ? { closedAt: new Date(), closedById: ctx.user.id, progress: 100 } : {}) },
    });
    if (result.count !== 1) throw new Error("La CAPA cambió mientras se procesaba la transición. Recarga e inténtalo nuevamente.");
    await writeAuditLog(tx, { ctx, action: toStage === CAPAStage.CLOSED ? "close" : "status_change", module: "capa", recordId: id, before: { stage: existing.stage }, after: { stage: toStage }, extra: { comment: comment?.trim() || null } });
  });
  await notifyUsers([existing.ownerId, existing.requestedById], { organizationId: ctx.organization.id, title: `ACPM/CAPA ${existing.code} actualizada`, body: `Avanzó a ${toStage}.`, type: toStage === CAPAStage.CLOSED ? "SUCCESS" : "INFO", link: PATH }, { skipUserId: ctx.user.id });
  revalidatePath(PATH); revalidatePath("/app/activity");
}

export async function verifyCAPA(id: string, input: { status: ACPMEfficacyStatus; comment: string }) {
  const verifiedInput = parseInput(capaVerificationSchema, { id, status: input.status, comment: input.comment });
  input = { status: verifiedInput.status, comment: verifiedInput.comment };
  const ctx = await requirePermission("actions:approve");
  const existing = await loadCAPA(id, ctx.organization.id);
  if (existing.stage !== CAPAStage.VERIFICATION) throw new Error("La eficacia solo puede verificarse en la etapa de verificación.");
  if (!input.comment.trim()) throw new Error("El comentario del verificador es obligatorio.");
  if (input.status === ACPMEfficacyStatus.EFFECTIVE && !existing.evidences.some((e) => e.kind === CAPAEvidenceKind.EFFECTIVENESS)) throw new Error("Adjunta evidencia de eficacia para marcarla como eficaz.");
  await prisma.$transaction(async (tx) => {
    const result = await tx.cAPA.updateMany({
      where: { id, organizationId: ctx.organization.id, stage: CAPAStage.VERIFICATION, efficacyStatus: ACPMEfficacyStatus.PENDING, updatedAt: existing.updatedAt },
      data: { efficacyStatus: input.status, verifierId: ctx.user.id, verifierComment: input.comment.trim(), verifiedAt: new Date() },
    });
    if (result.count !== 1) throw new Error("La verificación cambió mientras se guardaba. Recarga e inténtalo nuevamente.");
    await writeAuditLog(tx, { ctx, action: input.status === "EFFECTIVE" ? "approve" : "reject", module: "capa", recordId: id, before: { efficacyStatus: ACPMEfficacyStatus.PENDING }, after: { efficacyStatus: input.status, verifierComment: input.comment.trim() } });
  });
  revalidatePath(PATH); revalidatePath("/app/activity");
}

export async function addCAPAComment(id: string, content: string) {
  const ctx = await requirePermission("actions:update");
  const capa = await loadCAPA(id, ctx.organization.id);
  assertCAPACollaborator(ctx, capa);
  if (!content.trim()) throw new Error("El comentario es obligatorio.");
  await prisma.cAPAComment.create({ data: { id: randomUUID(), capaId: id, authorId: ctx.user.id, content: content.trim() } });
  await logAuditEvent({ ctx, action: "comment", module: "capa", recordId: id, extra: { content: content.trim().slice(0, 240) } });
  revalidatePath(PATH); revalidatePath("/app/activity");
}

export async function uploadCAPAEvidence(input: { capaId: string; kind: CAPAEvidenceKind; title: string; description?: string; file: File }) {
  const ctx = await requirePermission("actions:update");
  const capa = await loadCAPA(input.capaId, ctx.organization.id);
  assertCAPACollaborator(ctx, capa);
  if (capa.stage === CAPAStage.CLOSED) throw new Error("No puedes adjuntar evidencia a una CAPA cerrada.");
  if (!Object.values(CAPAEvidenceKind).includes(input.kind)) throw new Error("El tipo de evidencia no es válido.");
  const title = clean(input.title, "El título de la evidencia", true)!;
  const uploaded = await uploadEvidenceFile({ organizationId: ctx.organization.id, evidenceId: input.capaId, file: input.file });
  const id = randomUUID();
  try {
    await prisma.cAPAEvidence.create({ data: { id, organizationId: ctx.organization.id, capaId: input.capaId, kind: input.kind, title, description: clean(input.description, "Descripción") , fileName: input.file.name.slice(0, 255), fileUrl: uploaded.path, fileSize: uploaded.size, mimeType: uploaded.mime, uploadedById: ctx.user.id } });
  } catch (error) {
    await deleteEvidenceFile(uploaded.path, ctx.organization.id).catch(() => undefined);
    await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    throw error;
  }
  await logAuditEvent({ ctx, action: "attach_file", module: "capa", recordId: input.capaId, after: { evidenceId: id, kind: input.kind, fileName: input.file.name, fileSize: uploaded.size } });
  revalidatePath(PATH); revalidatePath("/app/activity");
  return { id };
}

export async function getCAPAEvidenceUrl(id: string) {
  const ctx = await requirePermission("actions:read");
  const evidence = await prisma.cAPAEvidence.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!evidence) throw new Error("Evidencia no encontrada.");
  await logAuditEvent({ ctx, action: "download", module: "capa", recordId: evidence.capaId, extra: { evidenceId: id, fileName: evidence.fileName } });
  return createSignedEvidenceUrl(evidence.fileUrl, ctx.organization.id);
}

export async function exportCAPAIndex(input: { format: "PDF" | "EXCEL" }) {
  const { ctx } = await requireAuthorization("actions:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const scope = await getCollaboratorScope(ctx);
  const rows = await prisma.cAPA.findMany({ where: { organizationId: ctx.organization.id, ...(scope.isScoped ? { OR: [{ ownerId: ctx.user.id }, { requestedById: ctx.user.id }] } : {}) }, include: { clause: { include: { standard: true } }, process: true, owner: true, evidences: { select: { kind: true } } }, orderBy: [{ stage: "asc" }, { dueDate: "asc" }] });
  const data = rows.map((row) => ({ codigo: row.code, titulo: row.title, origen: row.origin, severidad: row.severity, etapa: row.stage, norma: row.standardCode ?? row.clause?.standard.code ?? "", clausula: row.clause?.code ?? "", proceso: row.process?.name ?? "", responsable: row.owner?.name ?? "", vence: row.dueDate?.toISOString().slice(0, 10) ?? "", avance: `${row.progress}%`, evidencias: row.evidences.length, eficacia: row.efficacyStatus }));
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `indice-acpm-capa-${date}.${input.format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = input.format === "PDF" ? "application/pdf" : EXPORT_MIME;
  const now = new Date();
  const report = await queueReportForContext({ ctx, reportType: "capa", title: "Índice ACPM / CAPA", format: input.format, fileName, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  return { id: report.id, fileName, mimeType, status: report.status, rowCount: report.rowCount };
}
