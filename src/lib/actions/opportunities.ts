"use server";

import { revalidatePath } from "next/cache";
import { OpportunityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser, notifyUsers } from "@/lib/notify";

const PATH = "/app/opportunities";

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

async function assertMember(organizationId: string, userId?: string | null) {
  if (!userId) return;
  const member = await prisma.membership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!member) throw new Error("La persona seleccionada no pertenece a la organización.");
}

export type OpportunityInput = {
  title: string;
  description?: string;
  standardCode?: string;
  source?: string;
  category: string;
  ownerId?: string;
  reviewerId?: string;
  dueDate?: string;
  materializationAnalysis?: string;
  materializationPlan?: string;
  materializationEvidence?: string;
};

function opportunityData(input: OpportunityInput) {
  return {
    title: required(input.title, "El título"),
    description: optional(input.description),
    standardCode: optional(input.standardCode),
    source: optional(input.source),
    category: required(input.category, "La categoría"),
    ownerId: input.ownerId || null,
    reviewerId: input.reviewerId || null,
    dueDate: dateOrNull(input.dueDate),
    materializationAnalysis: optional(input.materializationAnalysis),
    materializationPlan: optional(input.materializationPlan),
    materializationEvidence: optional(input.materializationEvidence),
  };
}

export async function createOpportunity(input: OpportunityInput) {
  const ctx = await requirePermission("opportunities:create");
  const data = opportunityData(input);
  await Promise.all([
    assertMember(ctx.organization.id, data.ownerId),
    assertMember(ctx.organization.id, data.reviewerId),
  ]);

  const created = await prisma.opportunity.create({
    data: { organizationId: ctx.organization.id, ...data },
  });
  await logAuditEvent({
    ctx,
    action: "create",
    module: "opportunity",
    recordId: created.id,
    after: { title: created.title, status: created.status, reviewerId: created.reviewerId },
  });

  if (created.reviewerId && created.reviewerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: created.reviewerId,
      title: "Oportunidad pendiente de revisión",
      body: `La oportunidad «${created.title}» fue asignada para analizar su materialización y aprobar el siguiente paso.`,
      type: "WARNING",
      link: PATH,
    });
  }
  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateOpportunity(id: string, input: OpportunityInput) {
  const ctx = await requirePermission("opportunities:update");
  const existing = await prisma.opportunity.findFirst({
    where: { id, organizationId: ctx.organization.id },
  });
  if (!existing) throw new Error("Oportunidad no encontrada.");
  if (existing.status === OpportunityStatus.MATERIALIZED || existing.status === OpportunityStatus.CLOSED) {
    throw new Error("Una oportunidad materializada o cerrada no puede editarse.");
  }

  const data = opportunityData(input);
  await Promise.all([
    assertMember(ctx.organization.id, data.ownerId),
    assertMember(ctx.organization.id, data.reviewerId),
  ]);
  await prisma.opportunity.update({ where: { id }, data });
  await logAuditEvent({ ctx, action: "update", module: "opportunity", recordId: id, before: existing, after: data });

  if (data.reviewerId && data.reviewerId !== existing.reviewerId && data.reviewerId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: data.reviewerId,
      title: "Oportunidad pendiente de revisión",
      body: `La oportunidad «${data.title}» fue asignada para revisión.`,
      type: "WARNING",
      link: PATH,
    });
  }
  revalidatePath(PATH);
}

const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  IDENTIFIED: [OpportunityStatus.UNDER_REVIEW],
  UNDER_REVIEW: [OpportunityStatus.APPROVED, OpportunityStatus.REJECTED],
  APPROVED: [OpportunityStatus.IN_MATERIALIZATION],
  IN_MATERIALIZATION: [OpportunityStatus.MATERIALIZED],
  MATERIALIZED: [OpportunityStatus.CLOSED],
  REJECTED: [OpportunityStatus.IDENTIFIED],
  CLOSED: [],
};

export async function transitionOpportunity(
  id: string,
  status: OpportunityStatus,
  reason?: string,
) {
  const ctx = await requirePermission("opportunities:update");
  const existing = await prisma.opportunity.findFirst({
    where: { id, organizationId: ctx.organization.id },
  });
  if (!existing) throw new Error("Oportunidad no encontrada.");
  if (!TRANSITIONS[existing.status].includes(status)) {
    throw new Error(`Transición ${existing.status} → ${status} no permitida.`);
  }
  if (status === OpportunityStatus.UNDER_REVIEW && !existing.reviewerId) {
    throw new Error("Asigna un revisor antes de enviar la oportunidad a revisión.");
  }
  if (status === OpportunityStatus.APPROVED && existing.reviewerId !== ctx.user.id && ctx.role !== "ORG_ADMIN" && ctx.role !== "SUPER_ADMIN") {
    throw new Error("Solo el revisor asignado o un administrador puede aprobar esta oportunidad.");
  }
  if (status === OpportunityStatus.IN_MATERIALIZATION && !existing.materializationPlan?.trim()) {
    throw new Error("Documenta el plan de materialización antes de iniciar la oportunidad.");
  }
  if (status === OpportunityStatus.MATERIALIZED && !existing.materializationAnalysis?.trim()) {
    throw new Error("Documenta el análisis de materialización antes de marcarla como materializada.");
  }

  const now = new Date();
  const data = {
    status,
    rejectionReason: status === OpportunityStatus.REJECTED ? optional(reason) : status === OpportunityStatus.IDENTIFIED ? null : existing.rejectionReason,
    materializedAt: status === OpportunityStatus.MATERIALIZED ? existing.materializedAt ?? now : existing.materializedAt,
    closedAt: status === OpportunityStatus.CLOSED ? existing.closedAt ?? now : existing.closedAt,
  };
  await prisma.opportunity.update({ where: { id }, data });
  await logAuditEvent({
    ctx,
    action: status === OpportunityStatus.APPROVED ? "approve" : status === OpportunityStatus.REJECTED ? "reject" : "transition",
    module: "opportunity",
    recordId: id,
    before: { status: existing.status },
    after: { status, reason: data.rejectionReason },
  });

  await notifyUsers(
    [existing.ownerId, existing.reviewerId],
    {
      organizationId: ctx.organization.id,
      title: `Oportunidad actualizada: ${status.replaceAll("_", " ")}`,
      body: `«${existing.title}» pasó de ${existing.status.replaceAll("_", " ")} a ${status.replaceAll("_", " ")}.${reason?.trim() ? ` Motivo: ${reason.trim()}` : ""}`,
      type: status === OpportunityStatus.REJECTED ? "ALERT" : status === OpportunityStatus.CLOSED ? "SUCCESS" : "INFO",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath("/app/dashboard");
}

export async function deleteOpportunity(id: string) {
  const ctx = await requirePermission("opportunities:delete");
  const existing = await prisma.opportunity.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Oportunidad no encontrada.");
  if (existing.status !== OpportunityStatus.IDENTIFIED && existing.status !== OpportunityStatus.REJECTED) {
    throw new Error("Solo se pueden eliminar oportunidades identificadas o rechazadas.");
  }
  await prisma.opportunity.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "opportunity", recordId: id, before: { title: existing.title } });
  revalidatePath(PATH);
}
