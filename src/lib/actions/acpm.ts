"use server";

import { revalidatePath } from "next/cache";
import { ACPMStage, ActionStatus, ActionType, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const PATH = "/app/actions";

function stageTransitionMessage(toStage: ACPMStage): string {
  switch (toStage) {
    case "REQUEST":            return "Devuelto a solicitud";
    case "REQUEST_APPROVAL":   return "Solicitud enviada a aprobación";
    case "ANALYSIS":           return "Solicitud aprobada — comienza análisis";
    case "SOLUTION_APPROVAL":  return "Solución propuesta enviada a aprobación";
    case "IMPLEMENTATION":     return "Solución aprobada — comienza implementación";
    case "VERIFICATION":       return "Acciones implementadas — comienza verificación";
    case "CLOSED":             return "ACPM cerrada — verificación de eficacia validada";
  }
}

async function nextACPMCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ACPM-${year}-`;
  const last = await prisma.action.findFirst({
    where: { organizationId, title: { startsWith: "" } /* placeholder */ },
    orderBy: { createdAt: "desc" },
    select: { description: true },
  });
  // Codes se guardan en `description` solo si no hay un campo dedicado. Como no
  // hay un campo "code" en Action, derivamos por contador simple sobre createdAt del año.
  const count = await prisma.action.count({
    where: {
      organizationId,
      createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) },
    },
  });
  void last;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export type CreateACPMInput = {
  title: string;
  description?: string;
  type: ActionType;
  priority: Priority;
  source?: string;
  dueDate?: string;
};

export async function createACPM(input: CreateACPMInput): Promise<{ id: string; code: string }> {
  const ctx = await requirePermission("actions:*");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const code = await nextACPMCode(ctx.organization.id);
  const created = await prisma.action.create({
    data: {
      organizationId: ctx.organization.id,
      title: `${code} · ${title}`,
      description: input.description?.trim() || null,
      type: input.type,
      priority: input.priority,
      status: ActionStatus.PENDING,
      stage: ACPMStage.REQUEST,
      source: input.source?.trim() || null,
      requestedById: ctx.user.id,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      progress: 0,
    },
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: "acpm",
    recordId: created.id,
    after: { code, title, type: input.type, priority: input.priority, stage: "REQUEST" },
  });

  revalidatePath(PATH);
  revalidatePath("/app/activity");
  return { id: created.id, code };
}

export type UpdateACPMFields = {
  title?: string;
  description?: string;
  priority?: Priority;
  type?: ActionType;
  source?: string;
  rootCause?: string;
  proposedSolution?: string;
  effectivenessCheck?: string;
  effectivenessAt?: string;
  ownerId?: string;
  dueDate?: string;
  progress?: number;
};

export async function updateACPMFields(id: string, input: UpdateACPMFields): Promise<void> {
  const ctx = await requirePermission("actions:update");
  const existing = await prisma.action.findUnique({ where: { id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.type !== undefined) patch.type = input.type;
  if (input.source !== undefined) patch.source = input.source?.trim() || null;
  if (input.rootCause !== undefined) patch.rootCause = input.rootCause?.trim() || null;
  if (input.proposedSolution !== undefined) patch.proposedSolution = input.proposedSolution?.trim() || null;
  if (input.effectivenessCheck !== undefined) patch.effectivenessCheck = input.effectivenessCheck?.trim() || null;
  if (input.effectivenessAt !== undefined) patch.effectivenessAt = input.effectivenessAt ? new Date(input.effectivenessAt) : null;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId || null;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(input.progress)));

  await prisma.action.update({ where: { id }, data: patch });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "acpm",
    recordId: id,
    before: { stage: existing.stage, progress: existing.progress },
    after: patch,
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function transitionACPM(
  id: string,
  toStage: ACPMStage,
  comment?: string
): Promise<void> {
  const ctx = await requirePermission("actions:*");
  const existing = await prisma.action.findUnique({ where: { id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");
  if (existing.stage === toStage) return;

  if (toStage === "SOLUTION_APPROVAL") {
    if (!existing.rootCause?.trim()) throw new Error("Documenta la causa raíz antes de enviar la solución a aprobación.");
    if (!existing.proposedSolution?.trim()) throw new Error("Documenta la solución propuesta antes de enviarla a aprobación.");
  }
  if (toStage === "CLOSED" && !existing.effectivenessCheck?.trim()) {
    throw new Error("Documenta la verificación de eficacia antes de cerrar.");
  }

  const patch: Record<string, unknown> = { stage: toStage };
  if (toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL") {
    patch.requestApproverId = ctx.user.id;
  }
  if (toStage === "IMPLEMENTATION" && existing.stage === "SOLUTION_APPROVAL") {
    patch.solutionApproverId = ctx.user.id;
  }
  if (toStage === "CLOSED") {
    patch.progress = 100;
    patch.status = ActionStatus.COMPLETED;
    patch.completedAt = new Date();
    if (!existing.effectivenessAt) patch.effectivenessAt = new Date();
  }

  await prisma.action.update({ where: { id }, data: patch });

  await logAuditEvent({
    ctx,
    action: toStage === "CLOSED" ? "close" : toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL" ? "approve" : toStage === "IMPLEMENTATION" && existing.stage === "SOLUTION_APPROVAL" ? "approve" : "transition",
    module: "acpm",
    recordId: id,
    before: { stage: existing.stage },
    after: { stage: toStage },
    extra: { message: comment ?? stageTransitionMessage(toStage) },
  });

  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function rejectACPM(id: string, comment: string): Promise<void> {
  const ctx = await requirePermission("actions:*");
  const existing = await prisma.action.findUnique({ where: { id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");
  if (!comment.trim()) throw new Error("Indica el motivo del rechazo.");

  const back: ACPMStage =
    existing.stage === "REQUEST_APPROVAL" ? "REQUEST"
    : existing.stage === "SOLUTION_APPROVAL" ? "ANALYSIS"
    : existing.stage;

  if (back === existing.stage) throw new Error("Esta etapa no admite rechazo.");

  await prisma.action.update({ where: { id }, data: { stage: back } });

  await logAuditEvent({
    ctx,
    action: "reject",
    module: "acpm",
    recordId: id,
    before: { stage: existing.stage },
    after: { stage: back },
    extra: { reason: comment.trim() },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function commentACPM(id: string, message: string): Promise<void> {
  const ctx = await requirePermission("actions:update");
  const existing = await prisma.action.findUnique({ where: { id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");
  if (!message.trim()) throw new Error("Escribe un comentario.");

  await prisma.actionComment.create({
    data: { actionId: id, authorId: ctx.user.id, content: message.trim() },
  });

  await logAuditEvent({
    ctx,
    action: "comment",
    module: "acpm",
    recordId: id,
    extra: { message: message.trim().slice(0, 200) },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}
