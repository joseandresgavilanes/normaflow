"use server";

import { revalidatePath } from "next/cache";
import { ManagementReviewStatus, ManagementReviewTopic } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";

const PATH = "/app/management-review";

function trimOrNull(value: string | undefined | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}
function dateOrNull(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadReview(id: string, organizationId: string) {
  const review = await prisma.managementReview.findFirst({ where: { id, organizationId } });
  if (!review) throw new Error("Revisión por la dirección no encontrada.");
  return review;
}

export type ManagementReviewInputData = {
  title: string;
  scheduledDate?: string;
  chairId?: string;
  attendees?: string[];
};

export async function createManagementReview(input: ManagementReviewInputData) {
  const ctx = await requirePermission("mgmt-review:*");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const created = await prisma.managementReview.create({
    data: {
      organizationId: ctx.organization.id,
      title,
      scheduledDate: dateOrNull(input.scheduledDate),
      chairId: trimOrNull(input.chairId),
      attendees: input.attendees?.map(a => a.trim()).filter(Boolean) ?? [],
    },
  });

  await logAuditEvent({ ctx, action: "create", module: "management_review", recordId: created.id, after: { title } });
  if (created.chairId && created.chairId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: created.chairId, title: "Eres responsable de una revisión por la dirección", body: `Presides la revisión «${title}»${created.scheduledDate ? ` programada para ${created.scheduledDate.toLocaleDateString("es")}` : ""}.`, type: "INFO", link: PATH });
  }
  revalidatePath(PATH);
  return { id: created.id };
}

export type UpdateManagementReviewData = ManagementReviewInputData & {
  heldAt?: string;
  status?: ManagementReviewStatus;
  summary?: string;
};

export async function updateManagementReview(id: string, input: UpdateManagementReviewData) {
  const ctx = await requirePermission("mgmt-review:*");
  const existing = await loadReview(id, ctx.organization.id);

  const data = {
    title: input.title?.trim() || existing.title,
    scheduledDate: input.scheduledDate !== undefined ? dateOrNull(input.scheduledDate) : existing.scheduledDate,
    heldAt: input.heldAt !== undefined ? dateOrNull(input.heldAt) : existing.heldAt,
    status: input.status ?? existing.status,
    chairId: input.chairId !== undefined ? trimOrNull(input.chairId) : existing.chairId,
    attendees: input.attendees ? input.attendees.map(a => a.trim()).filter(Boolean) : existing.attendees,
    summary: input.summary !== undefined ? trimOrNull(input.summary) : existing.summary,
  };
  // When closing the review, stamp heldAt if not provided.
  if (data.status === "COMPLETED" && !data.heldAt) data.heldAt = new Date();

  await prisma.managementReview.update({ where: { id }, data });
  await logAuditEvent({
    ctx,
    action: data.status === "COMPLETED" && existing.status !== "COMPLETED" ? "close" : "update",
    module: "management_review",
    recordId: id,
    before: { status: existing.status },
    after: { status: data.status },
  });
  if (data.chairId && data.chairId !== existing.chairId && data.chairId !== ctx.user.id) {
    await notifyUser({ organizationId: ctx.organization.id, userId: data.chairId, title: "Eres responsable de una revisión por la dirección", body: `Presides la revisión «${data.title}».`, type: "INFO", link: PATH });
  }
  revalidatePath(PATH);
}

export async function deleteManagementReview(id: string) {
  const ctx = await requirePermission("mgmt-review:*");
  await loadReview(id, ctx.organization.id);
  await prisma.managementReview.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "management_review", recordId: id });
  revalidatePath(PATH);
}

// ─── Inputs (ISO 9.3.2 review inputs by topic) ────────────────────────────
export async function addReviewInput(reviewId: string, input: { topic: ManagementReviewTopic; content: string }) {
  const ctx = await requirePermission("mgmt-review:*");
  await loadReview(reviewId, ctx.organization.id);
  const content = input.content.trim();
  if (!content) throw new Error("El contenido de la entrada es obligatorio.");
  const created = await prisma.managementReviewInput.create({
    data: { reviewId, topic: input.topic, content },
  });
  await logAuditEvent({ ctx, action: "add_input", module: "management_review", recordId: reviewId, after: { topic: input.topic } });
  revalidatePath(PATH);
  return { id: created.id };
}

export async function deleteReviewInput(inputId: string) {
  const ctx = await requirePermission("mgmt-review:*");
  const row = await prisma.managementReviewInput.findUnique({ where: { id: inputId }, include: { review: { select: { organizationId: true, id: true } } } });
  if (!row || row.review.organizationId !== ctx.organization.id) throw new Error("Entrada no encontrada.");
  await prisma.managementReviewInput.delete({ where: { id: inputId } });
  await logAuditEvent({ ctx, action: "delete_input", module: "management_review", recordId: row.review.id });
  revalidatePath(PATH);
}

// ─── Decisions (ISO 9.3.3 review outputs) ─────────────────────────────────
export async function addReviewDecision(
  reviewId: string,
  input: { topic: string; decision: string; ownerId?: string; dueDate?: string },
) {
  const ctx = await requirePermission("mgmt-review:*");
  await loadReview(reviewId, ctx.organization.id);
  const topic = input.topic.trim();
  const decision = input.decision.trim();
  if (!topic) throw new Error("El tema de la decisión es obligatorio.");
  if (!decision) throw new Error("La decisión es obligatoria.");
  if (input.ownerId) {
    const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: input.ownerId }, select: { id: true } });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }
  const created = await prisma.managementReviewDecision.create({
    data: { reviewId, topic, decision, ownerId: trimOrNull(input.ownerId), dueDate: dateOrNull(input.dueDate) },
  });
  await logAuditEvent({ ctx, action: "add_decision", module: "management_review", recordId: reviewId, after: { topic } });
  if (input.ownerId && input.ownerId !== ctx.user.id) {
    const due = dateOrNull(input.dueDate);
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: input.ownerId,
      title: "Acción de la revisión por la dirección",
      body: `Se te asignó: «${decision}» (tema: ${topic})${due ? `, con fecha límite ${due.toLocaleDateString("es")}` : ""}.`,
      type: "WARNING",
      link: PATH,
    });
  }
  revalidatePath(PATH);
  return { id: created.id };
}

export async function deleteReviewDecision(decisionId: string) {
  const ctx = await requirePermission("mgmt-review:*");
  const row = await prisma.managementReviewDecision.findUnique({ where: { id: decisionId }, include: { review: { select: { organizationId: true, id: true } } } });
  if (!row || row.review.organizationId !== ctx.organization.id) throw new Error("Decisión no encontrada.");
  await prisma.managementReviewDecision.delete({ where: { id: decisionId } });
  await logAuditEvent({ ctx, action: "delete_decision", module: "management_review", recordId: row.review.id });
  revalidatePath(PATH);
}
