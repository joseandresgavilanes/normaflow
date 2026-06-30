"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  AuditStatus,
  AuditType,
  ChecklistItemStatus,
  ControlStatus,
  ControlType,
  FindingSeverity,
  FindingStatus,
  FindingType,
  IndicatorStatus,
  NCSeverity,
  NCSource,
  NCStatus,
  RiskStatus,
  RiskTreatment,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import {
  createSignedEvidenceUrl,
  deleteEvidenceFile,
  uploadEvidenceFile,
} from "@/lib/storage";

const PATHS = {
  process: "/app/processes",
  risk: "/app/risks",
  audit: "/app/audits",
  nc: "/app/nonconformities",
  indicator: "/app/indicators",
  evidence: "/app/evidence",
} as const;

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  return normalized;
}

function optional(value?: string | null) {
  return value?.trim() || null;
}

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha no es válida.");
  return date;
}

function intInRange(value: number, min: number, max: number, label: string) {
  const normalized = Math.trunc(value);
  if (!Number.isFinite(value) || normalized < min || normalized > max) {
    throw new Error(`${label} debe estar entre ${min} y ${max}.`);
  }
  return normalized;
}

function refresh(...paths: string[]) {
  for (const path of new Set([...paths, "/app/dashboard", "/app/activity"])) revalidatePath(path);
}

async function assertProcess(organizationId: string, processId?: string | null) {
  if (!processId) return;
  const process = await prisma.process.findFirst({ where: { id: processId, organizationId }, select: { id: true } });
  if (!process) throw new Error("El proceso no pertenece a la organización.");
}

async function assertMember(organizationId: string, userId?: string | null) {
  if (!userId) return;
  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!membership) throw new Error("El responsable no pertenece a la organización.");
}

// ─── Processes ──────────────────────────────────────────────────────

export type ProcessInput = {
  name: string;
  code?: string;
  type?: string;
  description?: string;
  ownerId?: string;
  inputs?: string[];
  outputs?: string[];
};

function processData(input: ProcessInput) {
  return {
    name: required(input.name, "El nombre"),
    code: optional(input.code),
    type: optional(input.type),
    description: optional(input.description),
    ownerId: input.ownerId || null,
    inputs: (input.inputs ?? []).map((item) => item.trim()).filter(Boolean),
    outputs: (input.outputs ?? []).map((item) => item.trim()).filter(Boolean),
  };
}

export async function createProcess(input: ProcessInput) {
  const ctx = await requirePermission("processes:create");
  const data = processData(input);
  await assertMember(ctx.organization.id, data.ownerId);
  if (data.code) {
    const duplicate = await prisma.process.findFirst({ where: { organizationId: ctx.organization.id, code: data.code } });
    if (duplicate) throw new Error(`Ya existe un proceso con el código ${data.code}.`);
  }
  const created = await prisma.process.create({ data: { organizationId: ctx.organization.id, ...data } });
  await logAuditEvent({ ctx, action: "create", module: "process", recordId: created.id, after: data });
  refresh(PATHS.process);
  return { id: created.id };
}

export async function updateProcess(id: string, input: ProcessInput) {
  const ctx = await requirePermission("processes:update");
  const existing = await prisma.process.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Proceso no encontrado.");
  const data = processData(input);
  await assertMember(ctx.organization.id, data.ownerId);
  if (data.code) {
    const duplicate = await prisma.process.findFirst({ where: { organizationId: ctx.organization.id, code: data.code, id: { not: id } } });
    if (duplicate) throw new Error(`Ya existe otro proceso con el código ${data.code}.`);
  }
  await prisma.process.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "process", recordId: id, before: existing, after: data });
  refresh(PATHS.process, PATHS.risk, PATHS.indicator);
}

export async function deleteProcess(id: string) {
  const ctx = await requirePermission("processes:delete");
  const existing = await prisma.process.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Proceso no encontrado.");
  await prisma.process.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "process", recordId: id, before: existing });
  refresh(PATHS.process, PATHS.risk, PATHS.indicator);
}

// ─── Risks ──────────────────────────────────────────────────────────

export type RiskInput = {
  title: string;
  description?: string;
  category: string;
  probability: number;
  impact: number;
  status: RiskStatus;
  treatment: RiskTreatment;
  ownerId?: string;
  processId?: string;
  dueDate?: string;
  residualScore?: number | null;
};

function riskData(input: RiskInput) {
  const probability = intInRange(input.probability, 1, 5, "La probabilidad");
  const impact = intInRange(input.impact, 1, 5, "El impacto");
  return {
    title: required(input.title, "El título"),
    description: optional(input.description),
    category: required(input.category, "La categoría"),
    probability,
    impact,
    score: probability * impact,
    status: input.status,
    treatment: input.treatment,
    ownerId: input.ownerId || null,
    processId: input.processId || null,
    dueDate: dateOrNull(input.dueDate),
    residualScore: input.residualScore == null ? null : intInRange(input.residualScore, 0, 25, "El riesgo residual"),
  };
}

export async function createRisk(input: RiskInput) {
  const ctx = await requirePermission("risks:create");
  const data = riskData(input);
  await Promise.all([assertProcess(ctx.organization.id, data.processId), assertMember(ctx.organization.id, data.ownerId)]);
  const created = await prisma.risk.create({ data: { organizationId: ctx.organization.id, ...data } });
  await logAuditEvent({ ctx, action: "create", module: "risk", recordId: created.id, after: data });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.ownerId, title: "Se te asignó un riesgo", body: `Eres responsable del riesgo «${data.title}». Revisa su evaluación y controles.`, type: "WARNING", link: PATHS.risk });
  }
  refresh(PATHS.risk, PATHS.process);
  return { id: created.id };
}

export async function updateRisk(id: string, input: RiskInput) {
  const ctx = await requirePermission("risks:update");
  const existing = await prisma.risk.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Riesgo no encontrado.");
  const data = riskData(input);
  await Promise.all([assertProcess(ctx.organization.id, data.processId), assertMember(ctx.organization.id, data.ownerId)]);
  await prisma.risk.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "risk", recordId: id, before: existing, after: data });
  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.ownerId, title: "Se te asignó un riesgo", body: `Eres responsable del riesgo «${data.title}». Revisa su evaluación y controles.`, type: "WARNING", link: PATHS.risk });
  }
  refresh(PATHS.risk, PATHS.process);
}

export async function deleteRisk(id: string) {
  const ctx = await requirePermission("risks:delete");
  const existing = await prisma.risk.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { _count: { select: { actions: true } } },
  });
  if (!existing) throw new Error("Riesgo no encontrado.");
  if (existing._count.actions) throw new Error("No se puede eliminar un riesgo con acciones vinculadas.");
  await prisma.risk.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "risk", recordId: id, before: { title: existing.title } });
  refresh(PATHS.risk, PATHS.process);
}

export type RiskControlInput = {
  title: string;
  description?: string;
  type: ControlType;
  status: ControlStatus;
  ownerId?: string;
};

async function controlData(input: RiskControlInput, organizationId: string) {
  await assertMember(organizationId, input.ownerId);
  return {
    title: required(input.title, "El título"),
    description: optional(input.description),
    type: input.type,
    status: input.status,
    ownerId: input.ownerId || null,
  };
}

export async function createRiskControl(riskId: string, input: RiskControlInput) {
  const ctx = await requirePermission("risks:update");
  const risk = await prisma.risk.findFirst({ where: { id: riskId, organizationId: ctx.organization.id }, select: { id: true } });
  if (!risk) throw new Error("Riesgo no encontrado.");
  const data = await controlData(input, ctx.organization.id);
  const created = await prisma.control.create({ data: { riskId, ...data } });
  await logAuditEvent({ ctx, action: "create_control", module: "risk", recordId: riskId, after: { controlId: created.id, ...data } });
  refresh(PATHS.risk);
}

export async function updateRiskControl(id: string, input: RiskControlInput) {
  const ctx = await requirePermission("risks:update");
  const existing = await prisma.control.findFirst({ where: { id, risk: { organizationId: ctx.organization.id } } });
  if (!existing) throw new Error("Control no encontrado.");
  const data = await controlData(input, ctx.organization.id);
  await prisma.control.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update_control", module: "risk", recordId: existing.riskId, before: existing, after: data });
  refresh(PATHS.risk);
}

export async function deleteRiskControl(id: string) {
  const ctx = await requirePermission("risks:update");
  const existing = await prisma.control.findFirst({ where: { id, risk: { organizationId: ctx.organization.id } } });
  if (!existing) throw new Error("Control no encontrado.");
  await prisma.control.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete_control", module: "risk", recordId: existing.riskId, before: existing });
  refresh(PATHS.risk);
}

// ─── Audits ─────────────────────────────────────────────────────────

export type AuditInput = {
  title: string;
  type: AuditType;
  status: AuditStatus;
  standardCode?: string;
  auditorId?: string;
  auditorExternal?: string;
  scheduledDate?: string;
  scope?: string;
  objectives?: string;
  criteria?: string;
  progress?: number;
  programId?: string;
};

async function auditData(
  input: AuditInput,
  organizationId: string,
  existing?: { startedAt: Date | null; completedAt: Date | null },
) {
  await assertMember(organizationId, input.auditorId);
  if (input.programId) {
    const program = await prisma.auditProgram.findFirst({ where: { id: input.programId, organizationId }, select: { id: true } });
    if (!program) throw new Error("El programa de auditoría no pertenece a la organización.");
  }
  const now = new Date();
  return {
    title: required(input.title, "El título"),
    type: input.type,
    status: input.status,
    standardCode: optional(input.standardCode),
    auditorId: input.auditorId || null,
    auditorExternal: optional(input.auditorExternal),
    scheduledDate: dateOrNull(input.scheduledDate),
    scope: optional(input.scope),
    objectives: optional(input.objectives),
    criteria: optional(input.criteria),
    progress: intInRange(input.progress ?? 0, 0, 100, "El progreso"),
    programId: input.programId || null,
    startedAt: input.status === AuditStatus.IN_PROGRESS || input.status === AuditStatus.COMPLETED
      ? existing?.startedAt ?? now
      : null,
    completedAt: input.status === AuditStatus.COMPLETED ? existing?.completedAt ?? now : null,
  };
}

export async function createAudit(input: AuditInput) {
  const ctx = await requirePermission("audits:create");
  const data = await auditData(input, ctx.organization.id);
  const created = await prisma.audit.create({ data: { organizationId: ctx.organization.id, ...data } });
  await logAuditEvent({ ctx, action: "create", module: "audit", recordId: created.id, after: data });
  if (data.auditorId && data.auditorId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.auditorId, title: "Se te asignó una auditoría", body: `Eres el auditor de «${data.title}»${data.scheduledDate ? ` (programada para ${new Date(data.scheduledDate).toLocaleDateString("es")})` : ""}.`, type: "INFO", link: PATHS.audit });
  }
  refresh(PATHS.audit);
  return { id: created.id };
}

export async function updateAudit(id: string, input: AuditInput) {
  const ctx = await requirePermission("audits:update");
  const existing = await prisma.audit.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Auditoría no encontrada.");
  const data = await auditData(input, ctx.organization.id, existing);
  await prisma.audit.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "audit", recordId: id, before: existing, after: data });
  if (data.auditorId && data.auditorId !== existing.auditorId && data.auditorId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.auditorId, title: "Se te asignó una auditoría", body: `Eres el auditor de «${data.title}»${data.scheduledDate ? ` (programada para ${new Date(data.scheduledDate).toLocaleDateString("es")})` : ""}.`, type: "INFO", link: PATHS.audit });
  }
  refresh(PATHS.audit);
}

export async function transitionAudit(id: string, toStatus: AuditStatus) {
  const ctx = await requirePermission("audits:update");
  const existing = await prisma.audit.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Auditoría no encontrada.");
  if (existing.status === toStatus) return;
  const now = new Date();
  const data = {
    status: toStatus,
    startedAt: toStatus === AuditStatus.IN_PROGRESS || toStatus === AuditStatus.COMPLETED ? existing.startedAt ?? now : existing.startedAt,
    completedAt: toStatus === AuditStatus.COMPLETED ? existing.completedAt ?? now : null,
    progress: toStatus === AuditStatus.COMPLETED ? 100 : existing.progress,
  };
  await prisma.audit.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: toStatus === AuditStatus.COMPLETED ? "close" : "transition", module: "audit", recordId: id, before: { status: existing.status }, after: { status: toStatus } });
  refresh(PATHS.audit);
}

export async function deleteAudit(id: string) {
  const ctx = await requirePermission("audits:delete");
  const existing = await prisma.audit.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { _count: { select: { nonconformities: true } } },
  });
  if (!existing) throw new Error("Auditoría no encontrada.");
  if (existing._count.nonconformities) throw new Error("No se puede eliminar una auditoría con NC vinculadas.");
  await prisma.audit.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "audit", recordId: id, before: { title: existing.title } });
  refresh(PATHS.audit);
}

export async function addAuditChecklistItem(auditId: string, input: { clauseCode?: string; question: string; expected?: string }) {
  const ctx = await requirePermission("audits:update");
  const audit = await prisma.audit.findFirst({ where: { id: auditId, organizationId: ctx.organization.id }, select: { id: true } });
  if (!audit) throw new Error("Auditoría no encontrada.");
  const order = await prisma.auditChecklistItem.count({ where: { auditId } });
  const item = await prisma.auditChecklistItem.create({
    data: { auditId, clauseCode: optional(input.clauseCode), question: required(input.question, "La pregunta"), expected: optional(input.expected), order },
  });
  await logAuditEvent({ ctx, action: "add_checklist_item", module: "audit", recordId: auditId, after: { itemId: item.id } });
  refresh(PATHS.audit);
}

export async function updateAuditChecklistItem(id: string, input: { response?: string; status: ChecklistItemStatus; notes?: string; evidenceUrl?: string }) {
  const ctx = await requirePermission("audits:update");
  const existing = await prisma.auditChecklistItem.findFirst({ where: { id, audit: { organizationId: ctx.organization.id } } });
  if (!existing) throw new Error("Ítem no encontrado.");
  const data = { response: optional(input.response), status: input.status, notes: optional(input.notes), evidenceUrl: optional(input.evidenceUrl) };
  await prisma.auditChecklistItem.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update_checklist_item", module: "audit", recordId: existing.auditId, before: existing, after: data });
  refresh(PATHS.audit);
}

export async function createAuditFinding(auditId: string, input: { title: string; description?: string; type: FindingType; severity: FindingSeverity; clauseCode?: string; evidenceUrl?: string }) {
  const ctx = await requirePermission("audits:update");
  const audit = await prisma.audit.findFirst({ where: { id: auditId, organizationId: ctx.organization.id }, select: { id: true } });
  if (!audit) throw new Error("Auditoría no encontrada.");
  const created = await prisma.auditFinding.create({
    data: {
      auditId,
      title: required(input.title, "El título"),
      description: optional(input.description),
      type: input.type,
      severity: input.severity,
      status: FindingStatus.OPEN,
      clauseCode: optional(input.clauseCode),
      evidenceUrl: optional(input.evidenceUrl),
    },
  });
  await logAuditEvent({ ctx, action: "create_finding", module: "audit", recordId: auditId, after: { findingId: created.id, title: created.title } });
  refresh(PATHS.audit);
}

// ─── Nonconformities ────────────────────────────────────────────────

export type NonconformityInput = {
  title: string;
  description?: string;
  source: NCSource;
  severity: NCSeverity;
  status: NCStatus;
  ownerId?: string;
  rootCause?: string;
  dueDate?: string;
  auditId?: string;
  findingId?: string;
  effectivenessValidated?: boolean;
};

async function ncData(input: NonconformityInput, organizationId: string, existingClosedAt?: Date | null) {
  await assertMember(organizationId, input.ownerId);
  let auditId = input.auditId || null;
  if (input.auditId) {
    const audit = await prisma.audit.findFirst({ where: { id: input.auditId, organizationId }, select: { id: true } });
    if (!audit) throw new Error("La auditoría no pertenece a la organización.");
  }
  if (input.findingId) {
    const finding = await prisma.auditFinding.findFirst({ where: { id: input.findingId, audit: { organizationId } }, select: { id: true, auditId: true } });
    if (!finding) throw new Error("El hallazgo no pertenece a la organización.");
    if (input.auditId && finding.auditId !== input.auditId) throw new Error("El hallazgo no pertenece a la auditoría seleccionada.");
    auditId = finding.auditId;
  }
  return {
    title: required(input.title, "El título"),
    description: optional(input.description),
    source: input.source,
    severity: input.severity,
    status: input.status,
    ownerId: input.ownerId || null,
    rootCause: optional(input.rootCause),
    dueDate: dateOrNull(input.dueDate),
    auditId,
    findingId: input.findingId || null,
    effectivenessValidated: Boolean(input.effectivenessValidated),
    closedAt: input.status === NCStatus.CLOSED ? existingClosedAt ?? new Date() : null,
  };
}

export async function createNonconformity(input: NonconformityInput) {
  const ctx = await requirePermission("nc:create");
  const data = await ncData(input, ctx.organization.id);
  const created = await prisma.nonconformity.create({ data: { organizationId: ctx.organization.id, ...data } });
  await logAuditEvent({ ctx, action: "create", module: "nonconformity", recordId: created.id, after: data });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: data.ownerId,
      title: "Se te asignó una no conformidad",
      body: `Eres responsable de la NC «${data.title}». Revisa el análisis de causa y las acciones requeridas.`,
      type: "WARNING",
      link: PATHS.nc,
    });
  }
  refresh(PATHS.nc, PATHS.audit);
  return { id: created.id };
}

export async function updateNonconformity(id: string, input: NonconformityInput) {
  const ctx = await requirePermission("nc:update");
  const existing = await prisma.nonconformity.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("No conformidad no encontrada.");
  const data = await ncData(input, ctx.organization.id, existing.closedAt);
  await prisma.nonconformity.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "nonconformity", recordId: id, before: existing, after: data });
  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: data.ownerId,
      title: "Se te asignó una no conformidad",
      body: `Eres responsable de la NC «${data.title}». Revisa el análisis de causa y las acciones requeridas.`,
      type: "WARNING",
      link: PATHS.nc,
    });
  }
  refresh(PATHS.nc, PATHS.audit);
}

export async function deleteNonconformity(id: string) {
  const ctx = await requirePermission("nc:delete");
  const existing = await prisma.nonconformity.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { _count: { select: { actions: true } } } });
  if (!existing) throw new Error("No conformidad no encontrada.");
  if (existing._count.actions) throw new Error("No se puede eliminar una NC con acciones vinculadas.");
  await prisma.nonconformity.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "nonconformity", recordId: id, before: { title: existing.title } });
  refresh(PATHS.nc, PATHS.audit);
}

export async function addNonconformityComment(nonconformityId: string, content: string) {
  const ctx = await requirePermission("nc:update");
  const nc = await prisma.nonconformity.findFirst({ where: { id: nonconformityId, organizationId: ctx.organization.id }, select: { id: true } });
  if (!nc) throw new Error("No conformidad no encontrada.");
  const text = content.trim();
  if (!text) throw new Error("Escribe un comentario.");
  const created = await prisma.nonconformityComment.create({ data: { nonconformityId, authorId: ctx.user.id, content: text } });
  await logAuditEvent({ ctx, action: "comment", module: "nonconformity", recordId: nonconformityId, extra: { message: text.slice(0, 200) } });
  refresh(PATHS.nc);
  return { id: created.id };
}

export async function deleteNonconformityComment(commentId: string) {
  const ctx = await requirePermission("nc:update");
  const comment = await prisma.nonconformityComment.findUnique({
    where: { id: commentId },
    include: { nonconformity: { select: { organizationId: true, id: true } } },
  });
  if (!comment || comment.nonconformity.organizationId !== ctx.organization.id) throw new Error("Comentario no encontrado.");
  await prisma.nonconformityComment.delete({ where: { id: commentId } });
  await logAuditEvent({ ctx, action: "delete_comment", module: "nonconformity", recordId: comment.nonconformity.id });
  refresh(PATHS.nc);
}

// ─── Indicators ─────────────────────────────────────────────────────

export type IndicatorInput = {
  name: string;
  description?: string;
  unit: string;
  target: number;
  frequency?: string;
  ownerId?: string;
  status: IndicatorStatus;
  clauseCode?: string;
  processId?: string;
};

async function indicatorData(input: IndicatorInput, organizationId: string) {
  if (!Number.isFinite(input.target)) throw new Error("La meta no es válida.");
  await Promise.all([assertProcess(organizationId, input.processId), assertMember(organizationId, input.ownerId)]);
  return {
    name: required(input.name, "El nombre"),
    description: optional(input.description),
    unit: required(input.unit, "La unidad"),
    target: input.target,
    frequency: optional(input.frequency) ?? "monthly",
    ownerId: input.ownerId || null,
    status: input.status,
    clauseCode: optional(input.clauseCode),
    processId: input.processId || null,
  };
}

export async function createIndicator(input: IndicatorInput) {
  const ctx = await requirePermission("indicators:create");
  const data = await indicatorData(input, ctx.organization.id);
  const created = await prisma.indicator.create({ data: { organizationId: ctx.organization.id, ...data } });
  await logAuditEvent({ ctx, action: "create", module: "indicator", recordId: created.id, after: data });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.ownerId, title: "Se te asignó un indicador", body: `Eres responsable del indicador «${data.name}». Mantén sus mediciones al día.`, type: "INFO", link: PATHS.indicator });
  }
  refresh(PATHS.indicator, PATHS.process);
  return { id: created.id };
}

export async function updateIndicator(id: string, input: IndicatorInput) {
  const ctx = await requirePermission("indicators:update");
  const existing = await prisma.indicator.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Indicador no encontrado.");
  const data = await indicatorData(input, ctx.organization.id);
  await prisma.indicator.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "indicator", recordId: id, before: existing, after: data });
  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.ownerId, title: "Se te asignó un indicador", body: `Eres responsable del indicador «${data.name}». Mantén sus mediciones al día.`, type: "INFO", link: PATHS.indicator });
  }
  refresh(PATHS.indicator, PATHS.process);
}

export async function addIndicatorValue(indicatorId: string, input: { value: number; period: string; note?: string }) {
  const ctx = await requirePermission("indicators:update");
  const indicator = await prisma.indicator.findFirst({ where: { id: indicatorId, organizationId: ctx.organization.id } });
  if (!indicator) throw new Error("Indicador no encontrado.");
  if (!Number.isFinite(input.value)) throw new Error("El valor no es válido.");
  const created = await prisma.indicatorValue.create({ data: { indicatorId, value: input.value, period: required(input.period, "El periodo"), note: optional(input.note) } });
  const status = input.value >= indicator.target ? IndicatorStatus.ON_TRACK : input.value >= indicator.target * 0.8 ? IndicatorStatus.AT_RISK : IndicatorStatus.OFF_TRACK;
  await prisma.indicator.update({ where: { id: indicatorId }, data: { status } });
  await logAuditEvent({ ctx, action: "add_value", module: "indicator", recordId: indicatorId, after: { valueId: created.id, value: input.value, period: input.period, status } });
  // Alert the indicator owner when a measurement falls below target.
  if (status === IndicatorStatus.OFF_TRACK && indicator.ownerId && indicator.ownerId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: indicator.ownerId, title: "Indicador por debajo de la meta", body: `«${indicator.name}» registró ${input.value} ${indicator.unit ?? ""} (meta ${indicator.target}) en ${input.period}. Requiere acción.`, type: "ALERT", link: PATHS.indicator });
  }
  refresh(PATHS.indicator);
}

export async function deleteIndicator(id: string) {
  const ctx = await requirePermission("indicators:delete");
  const existing = await prisma.indicator.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Indicador no encontrado.");
  await prisma.indicator.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "indicator", recordId: id, before: existing });
  refresh(PATHS.indicator, PATHS.process);
}

// ─── Evidence ───────────────────────────────────────────────────────

const EVIDENCE_MODULES = new Set(["process", "risk", "audit", "nc", "indicator", "document", "change", "supplier", "integration"]);

async function assertEvidenceTarget(organizationId: string, module?: string | null, moduleId?: string | null) {
  if (!module && !moduleId) return;
  if (!module || !moduleId || !EVIDENCE_MODULES.has(module)) throw new Error("El vínculo de evidencia no es válido.");
  const where = { id: moduleId, organizationId };
  const found =
    module === "process" ? await prisma.process.findFirst({ where, select: { id: true } }) :
    module === "risk" ? await prisma.risk.findFirst({ where, select: { id: true } }) :
    module === "audit" ? await prisma.audit.findFirst({ where, select: { id: true } }) :
    module === "nc" ? await prisma.nonconformity.findFirst({ where, select: { id: true } }) :
    module === "indicator" ? await prisma.indicator.findFirst({ where, select: { id: true } }) :
    module === "document" ? await prisma.document.findFirst({ where, select: { id: true } }) :
    module === "change" ? await prisma.changeRequest.findFirst({ where, select: { id: true } }) :
    module === "supplier" ? await prisma.supplier.findFirst({ where, select: { id: true } }) :
    await prisma.integration.findFirst({ where, select: { id: true } });
  if (!found) throw new Error("El registro vinculado no pertenece a la organización.");
}

export async function createEvidence(input: { title: string; module?: string; moduleId?: string; file: File }) {
  const ctx = await requirePermission("evidence:create");
  const title = required(input.title, "El título");
  await assertEvidenceTarget(ctx.organization.id, input.module, input.moduleId);
  const id = randomUUID();
  const uploaded = await uploadEvidenceFile({ organizationId: ctx.organization.id, evidenceId: id, file: input.file });
  try {
    await prisma.evidenceFile.create({
      data: {
        id,
        organizationId: ctx.organization.id,
        title,
        module: input.module || null,
        moduleId: input.moduleId || null,
        fileUrl: uploaded.path,
        fileSize: uploaded.size,
        mimeType: uploaded.mime,
        uploadedById: ctx.user.id,
      },
    });
  } catch (error) {
    await deleteEvidenceFile(uploaded.path).catch(() => undefined);
    throw error;
  }
  await logAuditEvent({ ctx, action: "upload", module: "evidence", recordId: id, after: { title, module: input.module, moduleId: input.moduleId, fileSize: uploaded.size } });
  refresh(PATHS.evidence);
  return { id };
}

export async function getEvidenceUrl(id: string) {
  const ctx = await requirePermission("evidence:read");
  const evidence = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!evidence) throw new Error("Evidencia no encontrada.");
  return createSignedEvidenceUrl(evidence.fileUrl, 300);
}

export async function removeEvidence(id: string) {
  const ctx = await requirePermission("evidence:delete");
  const evidence = await prisma.evidenceFile.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!evidence) throw new Error("Evidencia no encontrada.");
  await deleteEvidenceFile(evidence.fileUrl);
  await prisma.evidenceFile.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "evidence", recordId: id, before: { title: evidence.title, module: evidence.module, moduleId: evidence.moduleId } });
  refresh(PATHS.evidence);
}
