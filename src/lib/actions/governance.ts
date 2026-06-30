"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  ApprovalStatus,
  ChangeImpact,
  ChangeRequestStatus,
  IntegrationStatus,
  IntegrationSyncStatus,
  SupplierCriticality,
  SupplierEvaluationOutcome,
  SupplierStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUsers } from "@/lib/notify";

const PATHS = {
  changes: "/app/changes",
  suppliers: "/app/suppliers",
  integrations: "/app/integrations",
} as const;

/** Owner user IDs of the processes linked to a change request (the "process owners"). */
async function changeProcessOwnerIds(changeRequestId: string): Promise<string[]> {
  const links = await prisma.changeProcess.findMany({
    where: { changeRequestId },
    include: { process: { select: { ownerId: true } } },
  });
  return links.map((l) => l.process.ownerId).filter((id): id is string => !!id);
}

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

function uniqueIds(ids?: string[]) {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

function generatedCode(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function refresh(...paths: string[]) {
  for (const path of new Set([...paths, "/app/dashboard", "/app/activity", "/app/evidence"])) {
    revalidatePath(path);
  }
}

async function assertMember(organizationId: string, userId?: string | null) {
  if (!userId) return;
  const exists = await prisma.membership.findFirst({ where: { organizationId, userId }, select: { id: true } });
  if (!exists) throw new Error("La persona seleccionada no pertenece a la organización.");
}

async function assertChangeLinks(organizationId: string, input: ChangeRequestInput) {
  const processIds = uniqueIds(input.processIds);
  const documentIds = uniqueIds(input.documentIds);
  const riskIds = uniqueIds(input.riskIds);
  const trainingCourseIds = uniqueIds(input.trainingCourseIds);
  const approverIds = uniqueIds(input.approverIds);
  const [processes, documents, risks, courses, approvers, nc] = await Promise.all([
    prisma.process.count({ where: { organizationId, id: { in: processIds } } }),
    prisma.document.count({ where: { organizationId, id: { in: documentIds } } }),
    prisma.risk.count({ where: { organizationId, id: { in: riskIds } } }),
    prisma.trainingCourse.count({ where: { organizationId, id: { in: trainingCourseIds } } }),
    prisma.membership.count({ where: { organizationId, userId: { in: approverIds } } }),
    input.nonconformityId
      ? prisma.nonconformity.count({ where: { organizationId, id: input.nonconformityId } })
      : Promise.resolve(1),
  ]);
  if (processes !== processIds.length || documents !== documentIds.length || risks !== riskIds.length || courses !== trainingCourseIds.length || approvers !== approverIds.length || nc !== 1) {
    throw new Error("Uno o más vínculos no pertenecen a la organización.");
  }
  return { processIds, documentIds, riskIds, trainingCourseIds, approverIds };
}

export type ChangeRequestInput = {
  code?: string;
  title: string;
  category: string;
  changeType: string;
  reason: string;
  impact: ChangeImpact;
  affectedAreas?: string[];
  nonconformityId?: string;
  processIds?: string[];
  documentIds?: string[];
  riskIds?: string[];
  trainingCourseIds?: string[];
  approverIds?: string[];
};

function changeData(input: ChangeRequestInput) {
  return {
    code: optional(input.code),
    title: required(input.title, "El título"),
    category: required(input.category, "La categoría"),
    changeType: required(input.changeType, "El tipo de cambio"),
    reason: required(input.reason, "La justificación"),
    impact: input.impact,
    affectedAreas: [...new Set((input.affectedAreas ?? []).map((item) => item.trim()).filter(Boolean))],
    nonconformityId: input.nonconformityId || null,
  };
}

export async function createChangeRequest(input: ChangeRequestInput) {
  const ctx = await requirePermission("changes:create");
  const data = changeData(input);
  const links = await assertChangeLinks(ctx.organization.id, input);
  const code = data.code ?? generatedCode("CHG");
  const duplicate = await prisma.changeRequest.findFirst({ where: { organizationId: ctx.organization.id, code }, select: { id: true } });
  if (duplicate) throw new Error(`Ya existe un cambio con el código ${code}.`);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.changeRequest.create({
      data: {
        organizationId: ctx.organization.id,
        ...data,
        code,
        requesterId: ctx.user.id,
        requesterName: ctx.user.name,
      },
    });
    await Promise.all([
      links.processIds.length ? tx.changeProcess.createMany({ data: links.processIds.map((processId) => ({ changeRequestId: row.id, processId })) }) : null,
      links.documentIds.length ? tx.changeDocument.createMany({ data: links.documentIds.map((documentId) => ({ changeRequestId: row.id, documentId })) }) : null,
      links.riskIds.length ? tx.changeRisk.createMany({ data: links.riskIds.map((riskId) => ({ changeRequestId: row.id, riskId })) }) : null,
      links.trainingCourseIds.length ? tx.changeTrainingCourse.createMany({ data: links.trainingCourseIds.map((courseId) => ({ changeRequestId: row.id, courseId })) }) : null,
      links.approverIds.length ? tx.changeApprover.createMany({ data: links.approverIds.map((userId) => ({ changeRequestId: row.id, userId })) }) : null,
    ]);
    return row;
  });
  await logAuditEvent({ ctx, action: "create", module: "change", recordId: created.id, after: { code, title: data.title, status: created.status } });
  refresh(PATHS.changes);
  return { id: created.id };
}

export async function updateChangeRequest(id: string, input: ChangeRequestInput) {
  const ctx = await requirePermission("changes:update");
  const existing = await prisma.changeRequest.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Cambio no encontrado.");
  if (existing.status === ChangeRequestStatus.IMPLEMENTED || existing.status === ChangeRequestStatus.VERIFIED || existing.status === ChangeRequestStatus.CLOSED) {
    throw new Error("Un cambio implementado, verificado o cerrado ya no puede editarse.");
  }
  const data = changeData(input);
  const links = await assertChangeLinks(ctx.organization.id, input);
  const code = data.code ?? existing.code;
  const duplicate = await prisma.changeRequest.findFirst({ where: { organizationId: ctx.organization.id, code, id: { not: id } }, select: { id: true } });
  if (duplicate) throw new Error(`Ya existe otro cambio con el código ${code}.`);

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.update({ where: { id }, data: { ...data, code } });
    await Promise.all([
      tx.changeProcess.deleteMany({ where: { changeRequestId: id } }),
      tx.changeDocument.deleteMany({ where: { changeRequestId: id } }),
      tx.changeRisk.deleteMany({ where: { changeRequestId: id } }),
      tx.changeTrainingCourse.deleteMany({ where: { changeRequestId: id } }),
      tx.changeApprover.deleteMany({ where: { changeRequestId: id, status: ApprovalStatus.PENDING } }),
    ]);
    await Promise.all([
      links.processIds.length ? tx.changeProcess.createMany({ data: links.processIds.map((processId) => ({ changeRequestId: id, processId })) }) : null,
      links.documentIds.length ? tx.changeDocument.createMany({ data: links.documentIds.map((documentId) => ({ changeRequestId: id, documentId })) }) : null,
      links.riskIds.length ? tx.changeRisk.createMany({ data: links.riskIds.map((riskId) => ({ changeRequestId: id, riskId })) }) : null,
      links.trainingCourseIds.length ? tx.changeTrainingCourse.createMany({ data: links.trainingCourseIds.map((courseId) => ({ changeRequestId: id, courseId })) }) : null,
      links.approverIds.length ? tx.changeApprover.createMany({ data: links.approverIds.map((userId) => ({ changeRequestId: id, userId })), skipDuplicates: true }) : null,
    ]);
  });
  await logAuditEvent({ ctx, action: "update", module: "change", recordId: id, before: { code: existing.code, title: existing.title }, after: { code, title: data.title } });
  refresh(PATHS.changes);
}

const CHANGE_TRANSITIONS: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  DRAFT: [ChangeRequestStatus.SUBMITTED],
  SUBMITTED: [ChangeRequestStatus.UNDER_REVIEW, ChangeRequestStatus.REJECTED],
  UNDER_REVIEW: [ChangeRequestStatus.APPROVED, ChangeRequestStatus.REJECTED],
  APPROVED: [ChangeRequestStatus.IMPLEMENTED],
  REJECTED: [ChangeRequestStatus.DRAFT],
  IMPLEMENTED: [ChangeRequestStatus.VERIFIED],
  VERIFIED: [ChangeRequestStatus.CLOSED],
  CLOSED: [],
};

export async function transitionChangeRequest(id: string, status: ChangeRequestStatus, reason?: string) {
  const ctx = await requirePermission("changes:update");
  const existing = await prisma.changeRequest.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { approvers: true, tasks: true },
  });
  if (!existing) throw new Error("Cambio no encontrado.");
  if (!CHANGE_TRANSITIONS[existing.status].includes(status)) throw new Error(`Transición ${existing.status} → ${status} no permitida.`);
  if (status === ChangeRequestStatus.APPROVED && existing.approvers.some((item) => item.status !== ApprovalStatus.APPROVED)) {
    throw new Error("Todos los aprobadores deben aprobar antes de avanzar.");
  }
  if (status === ChangeRequestStatus.IMPLEMENTED && existing.tasks.some((task) => !task.done)) {
    throw new Error("Completa todas las tareas antes de marcar el cambio como implementado.");
  }
  const now = new Date();
  await prisma.changeRequest.update({
    where: { id },
    data: {
      status,
      submittedAt: status === ChangeRequestStatus.SUBMITTED ? now : undefined,
      approvedAt: status === ChangeRequestStatus.APPROVED ? now : undefined,
      implementedAt: status === ChangeRequestStatus.IMPLEMENTED ? now : undefined,
      verifiedAt: status === ChangeRequestStatus.VERIFIED ? now : undefined,
      closedAt: status === ChangeRequestStatus.CLOSED ? now : undefined,
    },
  });
  await logAuditEvent({ ctx, action: "status_change", module: "change", recordId: id, before: { status: existing.status }, after: { status }, extra: { reason: optional(reason) } });

  const label = `${existing.code} — «${existing.title}»`;
  if (status === ChangeRequestStatus.SUBMITTED || status === ChangeRequestStatus.UNDER_REVIEW) {
    const pendingApprovers = existing.approvers.filter((a) => a.status === ApprovalStatus.PENDING).map((a) => a.userId);
    await notifyUsers(pendingApprovers, {
      organizationId: ctx.organization.id,
      title: "Solicitud de cambio pendiente de tu aprobación",
      body: `El cambio ${label} requiere tu revisión y aprobación.`,
      type: "WARNING",
      link: PATHS.changes,
    }, { skipUserId: ctx.user.id });
  } else if (status === ChangeRequestStatus.REJECTED) {
    const owners = await changeProcessOwnerIds(id);
    await notifyUsers([existing.requesterId, ...owners], {
      organizationId: ctx.organization.id,
      title: "Solicitud de cambio rechazada",
      body: `El cambio ${label} fue rechazado.${reason?.trim() ? ` Motivo: ${reason.trim()}` : ""}`,
      type: "ALERT",
      link: PATHS.changes,
    }, { skipUserId: ctx.user.id });
  } else if (status === ChangeRequestStatus.APPROVED) {
    const owners = await changeProcessOwnerIds(id);
    await notifyUsers([existing.requesterId, ...owners], {
      organizationId: ctx.organization.id,
      title: "Solicitud de cambio aprobada",
      body: `El cambio ${label} fue aprobado y puede pasar a implementación.`,
      type: "SUCCESS",
      link: PATHS.changes,
    }, { skipUserId: ctx.user.id });
  }

  refresh(PATHS.changes);
}

export async function decideChangeApproval(changeRequestId: string, status: "APPROVED" | "REJECTED", comment?: string, attestationReason?: string) {
  const ctx = await requirePermission("changes:update");
  const approval = await prisma.changeApprover.findFirst({
    where: { changeRequestId, userId: ctx.user.id, changeRequest: { organizationId: ctx.organization.id } },
    include: { changeRequest: { select: { code: true, title: true, requesterId: true } } },
  });
  if (!approval) throw new Error("No eres aprobador de este cambio.");
  if (approval.status !== ApprovalStatus.PENDING) throw new Error("Esta decisión ya fue registrada.");
  await prisma.changeApprover.update({ where: { id: approval.id }, data: { status, comment: optional(comment), attestationReason: optional(attestationReason), decidedAt: new Date() } });
  await logAuditEvent({ ctx, action: status === ApprovalStatus.APPROVED ? "approve" : "reject", module: "change", recordId: changeRequestId, after: { approverId: ctx.user.id, status }, extra: { reason: optional(attestationReason) } });

  const label = `${approval.changeRequest.code} — «${approval.changeRequest.title}»`;
  const motivo = (attestationReason ?? comment)?.trim();
  if (status === "REJECTED") {
    const owners = await changeProcessOwnerIds(changeRequestId);
    await notifyUsers([approval.changeRequest.requesterId, ...owners], {
      organizationId: ctx.organization.id,
      title: "Tu solicitud de cambio fue rechazada",
      body: `${ctx.user.name} rechazó el cambio ${label}.${motivo ? ` Motivo: ${motivo}` : ""}`,
      type: "ALERT",
      link: PATHS.changes,
    }, { skipUserId: ctx.user.id });
  } else {
    await notifyUsers([approval.changeRequest.requesterId], {
      organizationId: ctx.organization.id,
      title: "Avance en tu solicitud de cambio",
      body: `${ctx.user.name} aprobó el cambio ${label}.`,
      type: "SUCCESS",
      link: PATHS.changes,
    }, { skipUserId: ctx.user.id });
  }

  refresh(PATHS.changes);
}

export async function addChangeTask(changeRequestId: string, title: string) {
  const ctx = await requirePermission("changes:update");
  const change = await prisma.changeRequest.findFirst({ where: { id: changeRequestId, organizationId: ctx.organization.id }, select: { id: true, status: true } });
  if (!change) throw new Error("Cambio no encontrado.");
  if (change.status === ChangeRequestStatus.CLOSED) throw new Error("El cambio está cerrado.");
  const task = await prisma.changeTask.create({ data: { changeRequestId, title: required(title, "La tarea") } });
  await logAuditEvent({ ctx, action: "add_task", module: "change", recordId: changeRequestId, after: { taskId: task.id, title: task.title } });
  refresh(PATHS.changes);
}

export async function toggleChangeTask(taskId: string, done: boolean) {
  const ctx = await requirePermission("changes:update");
  const task = await prisma.changeTask.findFirst({ where: { id: taskId, changeRequest: { organizationId: ctx.organization.id } } });
  if (!task) throw new Error("Tarea no encontrada.");
  await prisma.changeTask.update({ where: { id: taskId }, data: { done, completedAt: done ? new Date() : null } });
  await logAuditEvent({ ctx, action: done ? "complete_task" : "reopen_task", module: "change", recordId: task.changeRequestId, after: { taskId, done } });
  refresh(PATHS.changes);
}

export async function deleteChangeRequest(id: string) {
  const ctx = await requirePermission("changes:delete");
  const existing = await prisma.changeRequest.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Cambio no encontrado.");
  if (existing.status !== ChangeRequestStatus.DRAFT && existing.status !== ChangeRequestStatus.REJECTED) throw new Error("Sólo se pueden eliminar cambios en borrador o rechazados.");
  await prisma.changeRequest.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "change", recordId: id, before: { code: existing.code, title: existing.title } });
  refresh(PATHS.changes);
}

export type SupplierInput = {
  code?: string;
  name: string;
  category: string;
  criticality: SupplierCriticality;
  ownerId?: string;
  status: SupplierStatus;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  nextReviewDue?: string;
  documentIds?: string[];
  riskIds?: string[];
  nonconformityIds?: string[];
};

async function supplierData(organizationId: string, input: SupplierInput) {
  await assertMember(organizationId, input.ownerId);
  const documentIds = uniqueIds(input.documentIds);
  const riskIds = uniqueIds(input.riskIds);
  const nonconformityIds = uniqueIds(input.nonconformityIds);
  const [documents, risks, ncs] = await Promise.all([
    prisma.document.count({ where: { organizationId, id: { in: documentIds } } }),
    prisma.risk.count({ where: { organizationId, id: { in: riskIds } } }),
    prisma.nonconformity.count({ where: { organizationId, id: { in: nonconformityIds } } }),
  ]);
  if (documents !== documentIds.length || risks !== riskIds.length || ncs !== nonconformityIds.length) throw new Error("Uno o más vínculos no pertenecen a la organización.");
  return {
    data: {
      code: optional(input.code),
      name: required(input.name, "El nombre"),
      category: required(input.category, "La categoría"),
      criticality: input.criticality,
      ownerId: input.ownerId || null,
      status: input.status,
      contactName: optional(input.contactName),
      contactEmail: optional(input.contactEmail),
      notes: optional(input.notes),
      nextReviewDue: dateOrNull(input.nextReviewDue),
    },
    documentIds,
    riskIds,
    nonconformityIds,
  };
}

export async function createSupplier(input: SupplierInput) {
  const ctx = await requirePermission("suppliers:create");
  const parsed = await supplierData(ctx.organization.id, input);
  const code = parsed.data.code ?? generatedCode("PRV");
  if (await prisma.supplier.findFirst({ where: { organizationId: ctx.organization.id, code }, select: { id: true } })) throw new Error(`Ya existe un proveedor con el código ${code}.`);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.supplier.create({ data: { organizationId: ctx.organization.id, ...parsed.data, code } });
    await Promise.all([
      parsed.documentIds.length ? tx.supplierDocument.createMany({ data: parsed.documentIds.map((documentId) => ({ supplierId: row.id, documentId })) }) : null,
      parsed.riskIds.length ? tx.supplierRisk.createMany({ data: parsed.riskIds.map((riskId) => ({ supplierId: row.id, riskId })) }) : null,
      parsed.nonconformityIds.length ? tx.supplierNonconformity.createMany({ data: parsed.nonconformityIds.map((nonconformityId) => ({ supplierId: row.id, nonconformityId })) }) : null,
    ]);
    return row;
  });
  await logAuditEvent({ ctx, action: "create", module: "supplier", recordId: created.id, after: { code, name: created.name, status: created.status } });
  refresh(PATHS.suppliers);
  return { id: created.id };
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const ctx = await requirePermission("suppliers:update");
  const existing = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Proveedor no encontrado.");
  const parsed = await supplierData(ctx.organization.id, input);
  const code = parsed.data.code ?? existing.code;
  if (await prisma.supplier.findFirst({ where: { organizationId: ctx.organization.id, code, id: { not: id } }, select: { id: true } })) throw new Error(`Ya existe otro proveedor con el código ${code}.`);
  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({ where: { id }, data: { ...parsed.data, code } });
    await Promise.all([
      tx.supplierDocument.deleteMany({ where: { supplierId: id } }),
      tx.supplierRisk.deleteMany({ where: { supplierId: id } }),
      tx.supplierNonconformity.deleteMany({ where: { supplierId: id } }),
    ]);
    await Promise.all([
      parsed.documentIds.length ? tx.supplierDocument.createMany({ data: parsed.documentIds.map((documentId) => ({ supplierId: id, documentId })) }) : null,
      parsed.riskIds.length ? tx.supplierRisk.createMany({ data: parsed.riskIds.map((riskId) => ({ supplierId: id, riskId })) }) : null,
      parsed.nonconformityIds.length ? tx.supplierNonconformity.createMany({ data: parsed.nonconformityIds.map((nonconformityId) => ({ supplierId: id, nonconformityId })) }) : null,
    ]);
  });
  await logAuditEvent({ ctx, action: "update", module: "supplier", recordId: id, before: { code: existing.code, name: existing.name }, after: { code, name: parsed.data.name, status: parsed.data.status } });
  refresh(PATHS.suppliers);
}

export type SupplierEvaluationInput = {
  score?: number | null;
  outcome: SupplierEvaluationOutcome;
  notes?: string;
  evaluatedAt?: string;
  nextReviewDue?: string;
};

export async function registerSupplierEvaluation(supplierId: string, input: SupplierEvaluationInput) {
  const ctx = await requirePermission("suppliers:update");
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, organizationId: ctx.organization.id } });
  if (!supplier) throw new Error("Proveedor no encontrado.");
  const score = input.score == null ? null : Math.trunc(input.score);
  if (score != null && (!Number.isFinite(input.score) || score < 0 || score > 100)) throw new Error("La puntuación debe estar entre 0 y 100.");
  const evaluatedAt = dateOrNull(input.evaluatedAt) ?? new Date();
  const nextReviewDue = dateOrNull(input.nextReviewDue);
  const status = input.outcome === SupplierEvaluationOutcome.APPROVED
    ? SupplierStatus.APPROVED
    : input.outcome === SupplierEvaluationOutcome.CONDITIONAL
      ? SupplierStatus.CONDITIONAL
      : SupplierStatus.SUSPENDED;
  const evaluation = await prisma.$transaction(async (tx) => {
    const row = await tx.supplierEvaluation.create({ data: { supplierId, score, outcome: input.outcome, notes: optional(input.notes), evaluatedById: ctx.user.id, evaluatedAt, nextReviewDue } });
    await tx.supplier.update({ where: { id: supplierId }, data: { status, lastEvaluationAt: evaluatedAt, nextReviewDue } });
    return row;
  });
  await logAuditEvent({ ctx, action: "evaluate", module: "supplier", recordId: supplierId, after: { evaluationId: evaluation.id, score, outcome: input.outcome, status } });
  refresh(PATHS.suppliers);
}

export async function deleteSupplier(id: string) {
  const ctx = await requirePermission("suppliers:delete");
  const existing = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Proveedor no encontrado.");
  await prisma.supplier.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "supplier", recordId: id, before: { code: existing.code, name: existing.name } });
  refresh(PATHS.suppliers);
}

export type IntegrationInput = {
  key: string;
  name: string;
  provider: string;
  category: string;
  description?: string;
  valueProposition?: string;
  status: IntegrationStatus;
  externalAccount?: string;
  detailNote?: string;
};

function integrationData(input: IntegrationInput) {
  const key = required(input.key, "La clave").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return {
    key,
    name: required(input.name, "El nombre"),
    provider: required(input.provider, "El proveedor"),
    category: required(input.category, "La categoría"),
    description: optional(input.description),
    valueProposition: optional(input.valueProposition),
    status: input.status,
    externalAccount: optional(input.externalAccount),
    detailNote: optional(input.detailNote),
  };
}

export async function createIntegration(input: IntegrationInput) {
  const ctx = await requirePermission("integrations:manage");
  const data = integrationData(input);
  if (await prisma.integration.findFirst({ where: { organizationId: ctx.organization.id, key: data.key }, select: { id: true } })) throw new Error(`Ya existe una integración con la clave ${data.key}.`);
  const created = await prisma.integration.create({ data: { organizationId: ctx.organization.id, ...data, configuredById: ctx.user.id, connectedAt: data.status === IntegrationStatus.CONNECTED ? new Date() : null } });
  await logAuditEvent({ ctx, action: "create", module: "integration", recordId: created.id, after: { key: data.key, provider: data.provider, status: data.status } });
  refresh(PATHS.integrations);
  return { id: created.id };
}

export async function updateIntegration(id: string, input: IntegrationInput) {
  const ctx = await requirePermission("integrations:manage");
  const existing = await prisma.integration.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Integración no encontrada.");
  const data = integrationData(input);
  if (await prisma.integration.findFirst({ where: { organizationId: ctx.organization.id, key: data.key, id: { not: id } }, select: { id: true } })) throw new Error(`Ya existe otra integración con la clave ${data.key}.`);
  await prisma.integration.update({ where: { id }, data: { ...data, configuredById: ctx.user.id, connectedAt: data.status === IntegrationStatus.CONNECTED ? existing.connectedAt ?? new Date() : null } });
  await logAuditEvent({ ctx, action: "update", module: "integration", recordId: id, before: { key: existing.key, status: existing.status }, after: { key: data.key, status: data.status } });
  refresh(PATHS.integrations);
}

export type IntegrationSyncInput = {
  status: Exclude<IntegrationSyncStatus, "RUNNING">;
  startedAt?: string;
  completedAt?: string;
  recordsProcessed?: number;
  evidenceCreated?: number;
  errorMessage?: string;
};

export async function recordIntegrationSync(integrationId: string, input: IntegrationSyncInput) {
  const ctx = await requirePermission("integrations:manage");
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, organizationId: ctx.organization.id } });
  if (!integration) throw new Error("Integración no encontrada.");
  if ((input.status as IntegrationSyncStatus) === IntegrationSyncStatus.RUNNING) throw new Error("Un resultado de sincronización debe ser final.");
  const recordsProcessed = Math.trunc(input.recordsProcessed ?? 0);
  const evidenceCreated = Math.trunc(input.evidenceCreated ?? 0);
  if (!Number.isFinite(recordsProcessed) || !Number.isFinite(evidenceCreated) || recordsProcessed < 0 || evidenceCreated < 0) throw new Error("Los contadores de sincronización deben ser números no negativos.");
  const completedAt = dateOrNull(input.completedAt) ?? new Date();
  const sync = await prisma.$transaction(async (tx) => {
    const row = await tx.integrationSyncRun.create({ data: { integrationId, status: input.status, startedAt: dateOrNull(input.startedAt) ?? completedAt, completedAt, recordsProcessed, evidenceCreated, errorMessage: optional(input.errorMessage) } });
    await tx.integration.update({ where: { id: integrationId }, data: { lastSyncAt: completedAt, status: input.status === IntegrationSyncStatus.FAILED ? IntegrationStatus.NEEDS_ATTENTION : integration.status } });
    return row;
  });
  await logAuditEvent({ ctx, action: "sync_result", module: "integration", recordId: integrationId, after: { syncRunId: sync.id, status: input.status, recordsProcessed, evidenceCreated } });
  refresh(PATHS.integrations);
}

export async function deleteIntegration(id: string) {
  const ctx = await requirePermission("integrations:manage");
  const existing = await prisma.integration.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Integración no encontrada.");
  await prisma.integration.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "integration", recordId: id, before: { key: existing.key, provider: existing.provider } });
  refresh(PATHS.integrations);
}
