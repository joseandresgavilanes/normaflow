"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { idSchema, optionalDateInputSchema, optionalText, shortText } from "@/lib/validation/common";

const MODULE = "quality-ops";
const PATH = "/app/quality-ops";
const revalidate = () => {
  revalidatePath(PATH);
  revalidatePath("/app/activity");
};

async function nextCode(organizationId: string, prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function assertProcessInOrg(organizationId: string, processId?: string | null) {
  if (!processId) return;
  const process = await prisma.process.findFirst({ where: { id: processId, organizationId }, select: { id: true } });
  if (!process) throw new Error("El proceso indicado no pertenece a la organización.");
}

async function assertMemberInOrg(organizationId: string, userId?: string | null) {
  if (!userId) return;
  const member = await prisma.membership.findFirst({ where: { userId, organizationId }, select: { id: true } });
  if (!member) throw new Error("La persona indicada no pertenece a la organización.");
}

// ─── 1. CUSTOMER REQUIREMENTS (7.2) ───────────────────

const requirementSchema = z.object({
  title: shortText(300),
  description: optionalText(4000),
  source: optionalText(200),
  processId: idSchema.nullable().optional(),
  status: z.enum(["OPEN", "REVIEWED", "MET"]).optional(),
});

export async function createCustomerRequirement(input: z.infer<typeof requirementSchema>) {
  const ctx = await requirePermission("quality-ops:create");
  const data = requirementSchema.parse(input);
  await assertProcessInOrg(ctx.organization.id, data.processId);
  const code = await nextCode(ctx.organization.id, "REQ-CLI", await prisma.customerRequirement.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.customerRequirement.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null, source: data.source ?? null,
        processId: data.processId ?? null, status: data.status ?? "OPEN", createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, title: data.title }, extra: { event: "create_customer_requirement" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

export async function updateCustomerRequirement(id: string, input: z.infer<typeof requirementSchema>) {
  const ctx = await requirePermission("quality-ops:update");
  const recordId = idSchema.parse(id);
  const data = requirementSchema.partial().parse(input);
  await assertProcessInOrg(ctx.organization.id, data.processId);
  const existing = await prisma.customerRequirement.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Requisito de cliente no encontrado.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.customerRequirement.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.processId !== undefined ? { processId: data.processId } : {}),
        ...(data.status !== undefined ? {
          status: data.status,
          ...(data.status !== "OPEN" ? { reviewedById: ctx.user.id, reviewedAt: new Date() } : {}),
        } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "update_customer_requirement" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteCustomerRequirement(id: string) {
  const ctx = await requirePermission("quality-ops:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.customerRequirement.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Requisito de cliente no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.customerRequirement.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_customer_requirement" } });
  });
  revalidate();
  return { id: existing.id };
}

// ─── 2. CUSTOMER PROPERTY (8.5.3) ─────────────────────

const propertySchema = z.object({
  description: shortText(2000),
  customerName: shortText(200),
  conditionOnReceipt: optionalText(2000),
  responsibleId: idSchema.nullable().optional(),
  processId: idSchema.nullable().optional(),
});

export async function createCustomerProperty(input: z.infer<typeof propertySchema>) {
  const ctx = await requirePermission("quality-ops:create");
  const data = propertySchema.parse(input);
  await Promise.all([assertProcessInOrg(ctx.organization.id, data.processId), assertMemberInOrg(ctx.organization.id, data.responsibleId)]);
  const code = await nextCode(ctx.organization.id, "PROP-CLI", await prisma.customerProperty.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.customerProperty.create({
      data: tenantData(ctx, {
        code, description: data.description, customerName: data.customerName,
        conditionOnReceipt: data.conditionOnReceipt ?? null, responsibleId: data.responsibleId ?? null,
        processId: data.processId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, customerName: data.customerName }, extra: { event: "create_customer_property" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

const propertyStatusSchema = z.object({
  status: z.enum(["IN_CUSTODY", "RETURNED", "LOST_OR_DAMAGED"]),
  incidentNote: optionalText(2000),
});

export async function transitionCustomerProperty(id: string, input: z.infer<typeof propertyStatusSchema>) {
  const ctx = await requirePermission("quality-ops:update");
  const recordId = idSchema.parse(id);
  const data = propertyStatusSchema.parse(input);
  const existing = await prisma.customerProperty.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Propiedad del cliente no encontrada.");
  if (data.status === "LOST_OR_DAMAGED" && !data.incidentNote?.trim()) {
    throw new Error("Documenta el incidente antes de marcar la propiedad como perdida o dañada.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.customerProperty.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        incidentNote: data.incidentNote ?? existing.incidentNote,
        returnedAt: data.status === "RETURNED" ? (existing.returnedAt ?? new Date()) : existing.returnedAt,
      },
    });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "transition_customer_property" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteCustomerProperty(id: string) {
  const ctx = await requirePermission("quality-ops:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.customerProperty.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true, status: true } });
  if (!existing) throw new Error("Propiedad del cliente no encontrada.");
  if (existing.status === "IN_CUSTODY") throw new Error("No se puede eliminar una propiedad del cliente aún bajo custodia; regístrala como devuelta primero.");
  await prisma.$transaction(async (tx) => {
    await tx.customerProperty.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_customer_property" } });
  });
  revalidate();
  return { id: existing.id };
}

// ─── 3. PRESERVATION (8.5.4) ──────────────────────────

const preservationSchema = z.object({
  itemDescription: shortText(2000),
  handlingInstructions: optionalText(2000),
  storageConditions: optionalText(2000),
  packagingNote: optionalText(2000),
  status: z.enum(["COMPLIANT", "NON_COMPLIANT", "UNDER_REVIEW"]).optional(),
  responsibleId: idSchema.nullable().optional(),
  processId: idSchema.nullable().optional(),
});

export async function createPreservationRecord(input: z.infer<typeof preservationSchema>) {
  const ctx = await requirePermission("quality-ops:create");
  const data = preservationSchema.parse(input);
  await Promise.all([assertProcessInOrg(ctx.organization.id, data.processId), assertMemberInOrg(ctx.organization.id, data.responsibleId)]);
  const code = await nextCode(ctx.organization.id, "PRES", await prisma.preservationRecord.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.preservationRecord.create({
      data: tenantData(ctx, {
        code, itemDescription: data.itemDescription, handlingInstructions: data.handlingInstructions ?? null,
        storageConditions: data.storageConditions ?? null, packagingNote: data.packagingNote ?? null,
        status: data.status ?? "UNDER_REVIEW", responsibleId: data.responsibleId ?? null,
        processId: data.processId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_preservation_record" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

export async function updatePreservationRecord(id: string, input: z.infer<typeof preservationSchema>) {
  const ctx = await requirePermission("quality-ops:update");
  const recordId = idSchema.parse(id);
  const data = preservationSchema.partial().parse(input);
  await Promise.all([assertProcessInOrg(ctx.organization.id, data.processId), assertMemberInOrg(ctx.organization.id, data.responsibleId)]);
  const existing = await prisma.preservationRecord.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Registro de preservación no encontrado.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.preservationRecord.update({
      where: { id: existing.id },
      data: {
        ...(data.itemDescription !== undefined ? { itemDescription: data.itemDescription } : {}),
        ...(data.handlingInstructions !== undefined ? { handlingInstructions: data.handlingInstructions } : {}),
        ...(data.storageConditions !== undefined ? { storageConditions: data.storageConditions } : {}),
        ...(data.packagingNote !== undefined ? { packagingNote: data.packagingNote } : {}),
        ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
        ...(data.processId !== undefined ? { processId: data.processId } : {}),
        ...(data.status !== undefined ? { status: data.status, reviewedById: ctx.user.id, reviewedAt: new Date() } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "update_preservation_record" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deletePreservationRecord(id: string) {
  const ctx = await requirePermission("quality-ops:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.preservationRecord.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Registro de preservación no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.preservationRecord.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_preservation_record" } });
  });
  revalidate();
  return { id: existing.id };
}

// ─── 4. CUSTOMER SATISFACTION (9.1.2) ─────────────────

const feedbackSchema = z.object({
  customerName: optionalText(200),
  channel: z.enum(["SURVEY", "COMPLAINT", "COMPLIMENT", "REVIEW", "INTERVIEW", "OTHER"]).optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  comment: optionalText(4000),
  receivedAt: optionalDateInputSchema,
  linkedCapaId: idSchema.nullable().optional(),
  responsibleId: idSchema.nullable().optional(),
});

async function assertCapaInOrg(organizationId: string, capaId?: string | null) {
  if (!capaId) return;
  const capa = await prisma.cAPA.findFirst({ where: { id: capaId, organizationId }, select: { id: true } });
  if (!capa) throw new Error("La CAPA vinculada no pertenece a la organización.");
}

export async function createCustomerFeedback(input: z.infer<typeof feedbackSchema>) {
  const ctx = await requirePermission("quality-ops:create");
  const data = feedbackSchema.parse(input);
  await Promise.all([assertCapaInOrg(ctx.organization.id, data.linkedCapaId), assertMemberInOrg(ctx.organization.id, data.responsibleId)]);
  const code = await nextCode(ctx.organization.id, "SAT", await prisma.customerFeedback.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.customerFeedback.create({
      data: tenantData(ctx, {
        code, customerName: data.customerName ?? null, channel: data.channel ?? "SURVEY",
        score: data.score ?? null, comment: data.comment ?? null,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
        linkedCapaId: data.linkedCapaId ?? null, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, channel: created.channel, score: created.score }, extra: { event: "create_customer_feedback" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

const feedbackStatusSchema = z.object({ status: z.enum(["RECEIVED", "ANALYZED", "ACTION_TAKEN", "CLOSED"]) });

export async function transitionCustomerFeedback(id: string, input: z.infer<typeof feedbackStatusSchema>) {
  const ctx = await requirePermission("quality-ops:update");
  const recordId = idSchema.parse(id);
  const data = feedbackStatusSchema.parse(input);
  const existing = await prisma.customerFeedback.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Retroalimentación de cliente no encontrada.");
  if (data.status === "ACTION_TAKEN" && !existing.linkedCapaId) {
    throw new Error("Vincula una CAPA antes de marcar que se tomó acción.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.customerFeedback.update({ where: { id: existing.id }, data: { status: data.status } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "transition_customer_feedback" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteCustomerFeedback(id: string) {
  const ctx = await requirePermission("quality-ops:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.customerFeedback.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Retroalimentación de cliente no encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.customerFeedback.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_customer_feedback" } });
  });
  revalidate();
  return { id: existing.id };
}

// ─── 5. COMMUNICATION (7.4) ───────────────────────────

const communicationSchema = z.object({
  subject: shortText(300),
  content: optionalText(8000),
  direction: z.enum(["INTERNAL", "EXTERNAL"]).optional(),
  audience: optionalText(200),
  channel: optionalText(120),
  standards: z.array(z.string().max(40)).optional(),
  communicatedById: idSchema.nullable().optional(),
  communicatedAt: optionalDateInputSchema,
});

export async function createCommunicationRecord(input: z.infer<typeof communicationSchema>) {
  const ctx = await requirePermission("quality-ops:create");
  const data = communicationSchema.parse(input);
  await assertMemberInOrg(ctx.organization.id, data.communicatedById);
  const code = await nextCode(ctx.organization.id, "COM", await prisma.communicationRecord.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationRecord.create({
      data: tenantData(ctx, {
        code, subject: data.subject, content: data.content ?? null, direction: data.direction ?? "INTERNAL",
        audience: data.audience ?? null, channel: data.channel ?? null, standards: data.standards ?? [],
        communicatedById: data.communicatedById ?? ctx.user.id,
        communicatedAt: data.communicatedAt ? new Date(data.communicatedAt) : new Date(),
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, direction: created.direction }, extra: { event: "create_communication_record" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

export async function updateCommunicationRecord(id: string, input: z.infer<typeof communicationSchema>) {
  const ctx = await requirePermission("quality-ops:update");
  const recordId = idSchema.parse(id);
  const data = communicationSchema.partial().parse(input);
  await assertMemberInOrg(ctx.organization.id, data.communicatedById);
  const existing = await prisma.communicationRecord.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Comunicación no encontrada.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.communicationRecord.update({
      where: { id: existing.id },
      data: {
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.direction !== undefined ? { direction: data.direction } : {}),
        ...(data.audience !== undefined ? { audience: data.audience } : {}),
        ...(data.channel !== undefined ? { channel: data.channel } : {}),
        ...(data.standards !== undefined ? { standards: data.standards } : {}),
        ...(data.communicatedById !== undefined ? { communicatedById: data.communicatedById } : {}),
        ...(data.communicatedAt !== undefined ? { communicatedAt: data.communicatedAt ? new Date(data.communicatedAt) : new Date() } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: updated.id, after: { subject: updated.subject }, extra: { event: "update_communication_record" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteCommunicationRecord(id: string) {
  const ctx = await requirePermission("quality-ops:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.communicationRecord.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Comunicación no encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.communicationRecord.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_communication_record" } });
  });
  revalidate();
  return { id: existing.id };
}
