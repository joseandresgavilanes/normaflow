"use server";

import { revalidatePath } from "next/cache";
import { ActionStatus, ActionType, ACPMStage, ManagementReviewStatus, ManagementReviewTopic, Priority, ReportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { randomUUID } from "crypto";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { parseId, parseInput } from "@/lib/validation/common";
import { managementReviewSchema, managementReviewUpdateSchema, reviewDecisionSchema, reviewInputSchema } from "@/lib/validation/workflows";

const PATH = "/app/management-review";

function trimOrNull(value: string | undefined | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}
function dateOrNull(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("La fecha no es válida.");
  return d;
}

async function normalizeStandards(values: string[] | undefined, organizationId: string) {
  const standards = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  if (!standards.length) return standards;
  const enabled = await prisma.organizationStandard.findMany({ where: { organizationId, standard: { code: { in: standards } } }, select: { standard: { select: { code: true } } } });
  const enabledCodes = new Set(enabled.map((item) => item.standard.code));
  if (standards.some((code) => !enabledCodes.has(code))) throw new Error("Todas las normas deben estar habilitadas para la organización.");
  return standards;
}

async function activeMembers(organizationId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return unique;
  const count = await prisma.membership.count({ where: { organizationId, userId: { in: unique }, active: true } });
  if (count !== unique.length) throw new Error("Todos los participantes deben ser miembros activos de la organización.");
  return unique;
}

async function replaceParticipants(reviewId: string, organizationId: string, userIds: string[]) {
  const ids = await activeMembers(organizationId, userIds);
  await prisma.managementReviewParticipant.deleteMany({ where: { reviewId } });
  if (ids.length) await prisma.managementReviewParticipant.createMany({ data: ids.map((userId) => ({ id: randomUUID(), organizationId, reviewId, userId })) });
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
  participantIds?: string[];
  standards?: string[];
};

export async function createManagementReview(input: ManagementReviewInputData) {
  input = parseInput(managementReviewSchema, input) as ManagementReviewInputData;
  const ctx = await requirePermission("mgmt-review:*");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  const standards = await normalizeStandards(input.standards, ctx.organization.id);
  const participantIds = await activeMembers(ctx.organization.id, input.participantIds ?? []);
  if (!input.scheduledDate || !dateOrNull(input.scheduledDate)) throw new Error("La fecha de la reunión es obligatoria.");
  if (!input.chairId) throw new Error("El responsable de la revisión es obligatorio.");
  if (!standards.length) throw new Error("Selecciona al menos una norma incluida.");
  if (!participantIds.length && !(input.attendees ?? []).some(Boolean)) throw new Error("Registra al menos un participante.");
  if (input.chairId) await activeMembers(ctx.organization.id, [input.chairId]);

  const created = await prisma.managementReview.create({
    data: {
      organizationId: ctx.organization.id,
      title,
      scheduledDate: dateOrNull(input.scheduledDate),
      chairId: trimOrNull(input.chairId),
      attendees: input.attendees?.map(a => a.trim()).filter(Boolean) ?? [],
      standards,
    },
  });
  await replaceParticipants(created.id, ctx.organization.id, participantIds);

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
  id = parseId(id);
  input = parseInput(managementReviewUpdateSchema, input) as UpdateManagementReviewData;
  const ctx = await requirePermission("mgmt-review:*");
  const existing = await loadReview(id, ctx.organization.id);
  const allowedTransitions: Record<ManagementReviewStatus, ManagementReviewStatus[]> = {
    PLANNED: [ManagementReviewStatus.IN_PROGRESS, ManagementReviewStatus.CANCELLED],
    IN_PROGRESS: [ManagementReviewStatus.COMPLETED, ManagementReviewStatus.CANCELLED],
    COMPLETED: [],
    CANCELLED: [ManagementReviewStatus.PLANNED],
  };
  if (input.status && input.status !== existing.status && !allowedTransitions[existing.status].includes(input.status)) {
    throw new Error(`Transición ${existing.status} → ${input.status} no permitida.`);
  }
  const standards = input.standards !== undefined ? await normalizeStandards(input.standards, ctx.organization.id) : existing.standards;
  const chairId = input.chairId !== undefined ? trimOrNull(input.chairId) : existing.chairId;
  if (chairId) await activeMembers(ctx.organization.id, [chairId]);
  if (input.status === ManagementReviewStatus.COMPLETED) {
    const [inputCount, decisionCount] = await Promise.all([
      prisma.managementReviewInput.count({ where: { reviewId: id } }),
      prisma.managementReviewDecision.count({ where: { reviewId: id } }),
    ]);
    if (!inputCount) throw new Error("No se puede cerrar la revisión sin entradas documentadas.");
    if (!decisionCount) throw new Error("No se puede cerrar la revisión sin decisiones o acciones registradas.");
    if (!input.summary?.trim() && !existing.summary?.trim()) throw new Error("Documenta las conclusiones antes de cerrar la revisión.");
  }

  const data = {
    title: input.title?.trim() || existing.title,
    scheduledDate: input.scheduledDate !== undefined ? dateOrNull(input.scheduledDate) : existing.scheduledDate,
    heldAt: input.heldAt !== undefined ? dateOrNull(input.heldAt) : existing.heldAt,
    status: input.status ?? existing.status,
    chairId,
    attendees: input.attendees ? input.attendees.map(a => a.trim()).filter(Boolean) : existing.attendees,
    summary: input.summary !== undefined ? trimOrNull(input.summary) : existing.summary,
    standards,
  };
  // When closing the review, stamp heldAt if not provided.
  if (data.status === "COMPLETED" && !data.heldAt) data.heldAt = new Date();

  await prisma.managementReview.update({ where: { id }, data });
  if (input.participantIds !== undefined) await replaceParticipants(id, ctx.organization.id, input.participantIds);
  await logAuditEvent({
    ctx,
    action: data.status === "COMPLETED" && existing.status !== "COMPLETED" ? "close" : "update",
    module: "management_review",
    recordId: id,
    before: { status: existing.status },
    after: { status: data.status },
  });
  if (data.status !== existing.status && data.chairId && data.chairId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: data.chairId,
      title: "Estado de revisión por la dirección actualizado",
      body: `La revisión «${data.title}» pasó a ${data.status.replaceAll("_", " ")}.`,
      type: data.status === ManagementReviewStatus.COMPLETED ? "SUCCESS" : "INFO",
      link: PATH,
    });
  }
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
export type ManagementReviewSourceLinks = {
  auditId?: string;
  indicatorId?: string;
  riskId?: string;
  nonconformityId?: string;
  actionId?: string;
  capaId?: string;
};

async function validateSourceLinks(organizationId: string, links: ManagementReviewSourceLinks) {
  const checks = await Promise.all([
    links.auditId ? prisma.audit.findFirst({ where: { id: links.auditId, organizationId }, select: { id: true } }) : null,
    links.indicatorId ? prisma.indicator.findFirst({ where: { id: links.indicatorId, organizationId }, select: { id: true } }) : null,
    links.riskId ? prisma.risk.findFirst({ where: { id: links.riskId, organizationId }, select: { id: true } }) : null,
    links.nonconformityId ? prisma.nonconformity.findFirst({ where: { id: links.nonconformityId, organizationId }, select: { id: true } }) : null,
    links.actionId ? prisma.action.findFirst({ where: { id: links.actionId, organizationId }, select: { id: true } }) : null,
    links.capaId ? prisma.cAPA.findFirst({ where: { id: links.capaId, organizationId }, select: { id: true } }) : null,
  ]);
  const labels = ["la auditoría", "el KPI", "el riesgo", "la no conformidad", "la acción", "la CAPA"];
  checks.forEach((row, index) => { if ([links.auditId, links.indicatorId, links.riskId, links.nonconformityId, links.actionId, links.capaId][index] && !row) throw new Error(`El vínculo con ${labels[index]} no pertenece a la organización.`); });
}

export async function addReviewInput(reviewId: string, input: { topic: ManagementReviewTopic; content: string } & ManagementReviewSourceLinks) {
  reviewId = parseId(reviewId);
  input = parseInput(reviewInputSchema, input) as typeof input;
  const ctx = await requirePermission("mgmt-review:*");
  await loadReview(reviewId, ctx.organization.id);
  const content = input.content.trim();
  if (!content) throw new Error("El contenido de la entrada es obligatorio.");
  if (!Object.values(ManagementReviewTopic).includes(input.topic)) throw new Error("La categoría de entrada no es válida.");
  await validateSourceLinks(ctx.organization.id, input);
  const created = await prisma.managementReviewInput.create({
    data: { reviewId, topic: input.topic, content, auditId: input.auditId || null, indicatorId: input.indicatorId || null, riskId: input.riskId || null, nonconformityId: input.nonconformityId || null, actionId: input.actionId || null, capaId: input.capaId || null },
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
  reviewId = parseId(reviewId);
  const parsedDecision = parseInput(reviewDecisionSchema, input);
  input = { ...parsedDecision, ownerId: parsedDecision.ownerId ?? undefined, dueDate: parsedDecision.dueDate ?? undefined };
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

export async function createReviewAction(decisionId: string, input: { title: string; description?: string; ownerId?: string; dueDate?: string; priority?: Priority }) {
  const ctx = await requirePermission("actions:create");
  const decision = await prisma.managementReviewDecision.findFirst({ where: { id: decisionId, review: { organizationId: ctx.organization.id } }, include: { review: { select: { id: true, title: true } }, action: { select: { id: true } } } });
  if (!decision) throw new Error("Decisión no encontrada.");
  if (decision.action) throw new Error("Esta decisión ya tiene una acción vinculada.");
  const title = input.title.trim();
  if (!title) throw new Error("El título de la acción es obligatorio.");
  if (input.ownerId) await activeMembers(ctx.organization.id, [input.ownerId]);
  const action = await prisma.action.create({ data: { organizationId: ctx.organization.id, title, description: trimOrNull(input.description), type: ActionType.CORRECTIVE, priority: input.priority ?? Priority.MEDIUM, status: ActionStatus.PENDING, stage: ACPMStage.REQUEST, source: `MANAGEMENT_REVIEW:${decision.review.title}`, requestedById: ctx.user.id, ownerId: input.ownerId || null, dueDate: dateOrNull(input.dueDate), managementReviewId: decision.review.id, managementReviewDecisionId: decisionId } });
  await logAuditEvent({ ctx, action: "create_action", module: "management_review", recordId: decision.review.id, after: { actionId: action.id, decisionId, title } });
  if (action.ownerId && action.ownerId !== ctx.user.id) await notifyUser({ organizationId: ctx.organization.id, userId: action.ownerId, title: "Acción derivada de revisión por la dirección", body: `Se te asignó «${title}».`, type: "WARNING", link: "/app/actions" });
  revalidatePath(PATH); revalidatePath("/app/actions");
  return { id: action.id };
}

export async function linkReviewEvidence(reviewId: string, evidenceId: string) {
  const ctx = await requirePermission("mgmt-review:*");
  const [review, evidence] = await Promise.all([
    prisma.managementReview.findFirst({ where: { id: reviewId, organizationId: ctx.organization.id }, select: { id: true } }),
    prisma.evidenceFile.findFirst({ where: { id: evidenceId, organizationId: ctx.organization.id, deletedAt: null }, select: { id: true, title: true } }),
  ]);
  if (!review) throw new Error("Revisión no encontrada.");
  if (!evidence) throw new Error("La evidencia no pertenece a la organización.");
  await prisma.evidenceManagementReviewLink.upsert({ where: { evidenceId_managementReviewId: { evidenceId, managementReviewId: reviewId } }, create: { id: randomUUID(), organizationId: ctx.organization.id, evidenceId, managementReviewId: reviewId, createdById: ctx.user.id }, update: {} });
  await logAuditEvent({ ctx, action: "attach_evidence", module: "management_review", recordId: reviewId, after: { evidenceId, evidenceTitle: evidence.title } });
  revalidatePath(PATH); revalidatePath("/app/evidence");
}

export async function exportManagementReview(reviewId: string) {
  const ctx = await requirePermission("mgmt-review:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const review = await prisma.managementReview.findFirst({ where: { id: reviewId, organizationId: ctx.organization.id }, include: { participants: { include: { user: { select: { name: true } } } }, inputs: { orderBy: { createdAt: "asc" }, include: { audit: { select: { title: true } }, indicator: { select: { name: true } }, risk: { select: { title: true } }, nonconformity: { select: { title: true } }, action: { select: { title: true } }, capa: { select: { code: true, title: true } } } }, decisions: { orderBy: { createdAt: "asc" }, include: { action: { select: { title: true, status: true } } } }, evidenceLinks: { include: { evidence: { select: { title: true, evidenceType: true } } } } } });
  if (!review) throw new Error("Revisión no encontrada.");
  const inputRows = review.inputs.map((item) => ({ categoria: item.topic, entrada: item.content, fuente: item.audit?.title ?? item.indicator?.name ?? item.risk?.title ?? item.nonconformity?.title ?? item.action?.title ?? item.capa?.code ?? "Manual" }));
  const decisionRows = review.decisions.map((item) => ({ decision: item.decision, tema: item.topic, responsable: item.ownerId ?? "—", fecha: item.dueDate?.toISOString().slice(0, 10) ?? "—", accion: item.action?.title ?? "No creada" }));
  const rows = [
    { seccion: "Reunión", detalle: review.title, resultado: review.status },
    { seccion: "Fecha", detalle: review.heldAt?.toISOString().slice(0, 10) ?? review.scheduledDate?.toISOString().slice(0, 10) ?? "—", resultado: review.standards.join(", ") || "Sin norma" },
    { seccion: "Participantes", detalle: review.participants.map((item) => item.user.name).join(", ") || review.attendees.join(", ") || "—", resultado: "" },
    { seccion: "Entradas", detalle: inputRows.map((item) => `${item.categoria}: ${item.entrada} [${item.fuente}]`).join("; ") || "Sin entradas", resultado: String(inputRows.length) },
    { seccion: "Decisiones", detalle: decisionRows.map((item) => `${item.tema}: ${item.decision} (${item.accion})`).join("; ") || "Sin decisiones", resultado: String(decisionRows.length) },
    { seccion: "Conclusiones", detalle: review.summary ?? "—", resultado: "" },
    { seccion: "Evidencias", detalle: review.evidenceLinks.map((item) => `${item.evidence.title} (${item.evidence.evidenceType})`).join(", ") || "Sin evidencias", resultado: String(review.evidenceLinks.length) },
  ];
  const safeTitle = review.title.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 70);
  const fileName = `acta-revision-direccion-${safeTitle || review.id}.pdf`;
  const dateFrom = review.scheduledDate ?? review.createdAt;
  const dateTo = review.heldAt ?? new Date();
  const report = await queueReportForContext({ ctx, reportType: "management-review", title: `Acta · ${review.title}`, format: "PDF", fileName, dateFrom, dateTo, filters: { from: dateFrom.toISOString().slice(0, 10), to: dateTo.toISOString().slice(0, 10), recordId: review.id } });
  return { id: report.id, fileName, mimeType: "application/pdf", status: report.status, rowCount: report.rowCount };
}
