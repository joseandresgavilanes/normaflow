"use server";

import { revalidatePath } from "next/cache";
import { ACPMStage, ActionStatus, ActionType, Priority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent, writeAuditLog } from "@/lib/audit-log";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { assertCollaboratorCanAccess } from "@/lib/permissions/scope";
import { assertACPMTransition, canCloseACPM, rejectionStage } from "@/lib/acpm-workflow";
import { parseId, parseInput } from "@/lib/validation/common";
import { acpmCreateSchema, acpmTransitionSchema, acpmUpdateSchema } from "@/lib/validation/workflows";

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

async function nextACPMCode(organizationId: string, db: Pick<Prisma.TransactionClient, "action"> = prisma): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ACPM-${year}-`;
  const last = await db.action.findFirst({
    where: { organizationId, title: { startsWith: "" } /* placeholder */ },
    orderBy: { createdAt: "desc" },
    select: { description: true },
  });
  // Codes se guardan en `description` solo si no hay un campo dedicado. Como no
  // hay un campo "code" en Action, derivamos por contador simple sobre createdAt del año.
  const count = await db.action.count({
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
  ownerId?: string;
};

export async function createACPM(input: CreateACPMInput): Promise<{ id: string; code: string }> {
  input = parseInput(acpmCreateSchema, input) as CreateACPMInput;
  const ctx = await requirePermission("actions:*");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (input.ownerId) {
    const ownerMembership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: input.ownerId, organizationId: ctx.organization.id } },
      select: { id: true },
    });
    if (!ownerMembership) throw new Error("La persona responsable no pertenece a la organización.");
  }

  const createdResult = await prisma.$transaction(async (tx) => {
    // Action has no dedicated code column; serialize the derived sequence per tenant/year.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`acpm:${ctx.organization.id}:${new Date().getUTCFullYear()}`}))`;
    const code = await nextACPMCode(ctx.organization.id, tx);
    const created = await tx.action.create({
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
        ownerId: input.ownerId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        progress: 0,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "acpm", recordId: created.id, after: { code, title, type: input.type, priority: input.priority, stage: "REQUEST" } });
    return { created, code };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const { created, code } = createdResult;

  if (created.ownerId && created.ownerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: created.ownerId,
      title: "Se te asignó una acción correctiva (ACPM)",
      body: `Eres responsable de «${created.title}». Revisa el plan de acción y sus fechas objetivo.`,
      type: "WARNING",
      link: PATH,
    });
  }

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
  id = parseId(id);
  input = parseInput(acpmUpdateSchema, input) as UpdateACPMFields;
  const ctx = await requirePermission("actions:update");
  const existing = await prisma.action.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  await assertCollaboratorCanAccess(ctx, "actionIds", id);

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

  if (input.ownerId) {
    const ownerMembership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: input.ownerId, organizationId: ctx.organization.id } },
      select: { id: true },
    });
    if (!ownerMembership) throw new Error("La persona responsable no pertenece a la organización.");
  }

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.action.updateMany({
      where: { id, organizationId: ctx.organization.id, updatedAt: existing.updatedAt },
      data: patch,
    });
    if (result.count !== 1) throw new Error("La ACPM cambió mientras la editabas. Recarga e inténtalo nuevamente.");
    await writeAuditLog(tx, {
      ctx,
      action: "update",
      module: "acpm",
      recordId: id,
      before: { stage: existing.stage, progress: existing.progress },
      after: patch,
    });
    return result;
  });
  void changed;
  if (input.ownerId && input.ownerId !== existing.ownerId && input.ownerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: input.ownerId,
      title: "Se te asignó una acción correctiva (ACPM)",
      body: `Eres responsable de «${existing.title}». Revisa el análisis y avanza su implementación.`,
      type: "WARNING",
      link: PATH,
    });
  }
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function transitionACPM(
  id: string,
  toStage: ACPMStage,
  comment?: string
): Promise<void> {
  id = parseId(id);
  ({ stage: toStage, comment } = parseInput(acpmTransitionSchema, { stage: toStage, comment }));
  if (!Object.values(ACPMStage).includes(toStage)) throw new Error("La etapa ACPM no es válida.");
  const requiresApproval = toStage === ACPMStage.ANALYSIS || toStage === ACPMStage.IMPLEMENTATION || toStage === ACPMStage.CLOSED;
  const ctx = await requirePermission(requiresApproval ? "actions:approve" : "actions:update");
  const existing = await prisma.action.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  await assertCollaboratorCanAccess(ctx, "actionIds", id);
  assertACPMTransition(existing.stage, toStage);

  if (toStage === "SOLUTION_APPROVAL") {
    if (!existing.rootCause?.trim()) throw new Error("Documenta la causa raíz antes de enviar la solución a aprobación.");
    if (!existing.proposedSolution?.trim()) throw new Error("Documenta la solución propuesta antes de enviarla a aprobación.");
  }
  if (toStage === "VERIFICATION" && existing.progress < 100) {
    throw new Error("La implementación debe estar al 100% antes de verificar su eficacia.");
  }
  if (toStage === "CLOSED" && !canCloseACPM({
    stage: existing.stage,
    progress: existing.progress,
    effectivenessEvidence: existing.effectivenessCheck,
    effectivenessVerifiedAt: existing.effectivenessAt,
  })) {
    throw new Error("No se puede cerrar: registra evidencia y fecha de verificación de eficacia después de completar la implementación.");
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

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.action.updateMany({
      where: { id, organizationId: ctx.organization.id, stage: existing.stage, updatedAt: existing.updatedAt },
      data: patch,
    });
    if (result.count !== 1) throw new Error("La ACPM cambió mientras se procesaba la transición. Recarga e inténtalo nuevamente.");
    const after = { stage: toStage, status: patch.status ?? existing.status, progress: patch.progress ?? existing.progress, effectivenessEvidence: patch.effectivenessCheck ?? existing.effectivenessCheck, effectivenessVerifiedAt: patch.effectivenessAt instanceof Date ? patch.effectivenessAt.toISOString() : existing.effectivenessAt?.toISOString() ?? null };
    await writeAuditLog(tx, {
      ctx,
      action: toStage === "CLOSED" ? "close" : toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL" ? "approve" : toStage === "IMPLEMENTATION" && existing.stage === "SOLUTION_APPROVAL" ? "approve" : "transition",
      module: "acpm",
      recordId: id,
      before: { stage: existing.stage, status: existing.status, progress: existing.progress, effectivenessEvidence: existing.effectivenessCheck, effectivenessVerifiedAt: existing.effectivenessAt?.toISOString() ?? null },
      after,
      extra: { message: comment?.trim() || stageTransitionMessage(toStage) },
    });
    return { stage: toStage, status: after.status, progress: after.progress, effectivenessCheck: after.effectivenessEvidence, effectivenessAt: after.effectivenessVerifiedAt ? new Date(after.effectivenessVerifiedAt) : null };
  });

  // Notify owner + requester (excluding whoever performed the transition).
  await notifyUsers(
    [existing.ownerId, existing.requestedById],
    {
      organizationId: ctx.organization.id,
      title: `ACPM actualizada: ${stageTransitionMessage(toStage)}`,
      body: `«${existing.title}» pasó a la etapa «${toStage}».${comment ? ` Nota: ${comment.trim()}` : ""}`,
      type: toStage === "CLOSED" ? "SUCCESS" : "INFO",
      link: "/app/actions",
    },
    { skipUserId: ctx.user.id },
  );

  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function rejectACPM(id: string, comment: string): Promise<void> {
  id = parseId(id);
  comment = parseInput(acpmTransitionSchema.pick({ comment: true }), { comment }).comment ?? "";
  const ctx = await requirePermission("actions:approve");
  const existing = await prisma.action.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  if (!comment.trim()) throw new Error("Indica el motivo del rechazo.");

  await assertCollaboratorCanAccess(ctx, "actionIds", id);
  const back = rejectionStage(existing.stage);
  if (!back) throw new Error("Esta etapa no admite rechazo.");

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

  await notifyUsers(
    [existing.ownerId, existing.requestedById],
    {
      organizationId: ctx.organization.id,
      title: "ACPM rechazada",
      body: `«${existing.title}» fue devuelta a la etapa «${back}». Motivo: ${comment.trim()}`,
      type: "ALERT",
      link: "/app/actions",
    },
    { skipUserId: ctx.user.id },
  );

  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function commentACPM(id: string, message: string): Promise<void> {
  id = parseId(id);
  message = parseInput(acpmTransitionSchema.pick({ comment: true }), { comment: message }).comment ?? "";
  const ctx = await requirePermission("actions:update");
  const existing = await prisma.action.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  await assertCollaboratorCanAccess(ctx, "actionIds", id);
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
  await notifyUsers(
    [existing.ownerId, existing.requestedById],
    {
      organizationId: ctx.organization.id,
      title: "Nuevo comentario en una ACPM",
      body: `Se añadió un comentario en «${existing.title}»: ${message.trim().slice(0, 240)}`,
      type: "INFO",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function deleteACPM(id: string): Promise<void> {
  const ctx = await requirePermission("actions:*");
  const existing = await prisma.action.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("ACPM no encontrada.");
  // ActionComment cascades on delete; the Action's own FKs don't block deletion.
  await prisma.action.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "acpm", recordId: id, before: { title: existing.title, stage: existing.stage } });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}
