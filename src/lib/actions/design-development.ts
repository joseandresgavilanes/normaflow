"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { idSchema, optionalDateInputSchema, optionalText, shortText } from "@/lib/validation/common";

const MODULE = "design-dev";
const PATH = "/app/design-dev";
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

async function assertEvidenceInOrg(organizationId: string, evidenceId?: string | null) {
  if (!evidenceId) return;
  const evidence = await prisma.evidenceFile.findFirst({ where: { id: evidenceId, organizationId }, select: { id: true } });
  if (!evidence) throw new Error("La evidencia indicada no pertenece a la organización.");
}

// ─── PROJECTS ──────────────────────────────────────────

const projectSchema = z.object({
  name: shortText(300),
  description: optionalText(4000),
  ownerId: idSchema.nullable().optional(),
  processId: idSchema.nullable().optional(),
  plannedStart: optionalDateInputSchema,
  plannedEnd: optionalDateInputSchema,
});

export async function createDesignProject(input: z.infer<typeof projectSchema>) {
  const ctx = await requirePermission("design-dev:create");
  const data = projectSchema.parse(input);
  await Promise.all([assertProcessInOrg(ctx.organization.id, data.processId), assertMemberInOrg(ctx.organization.id, data.ownerId)]);
  const code = await nextCode(ctx.organization.id, "PDD", await prisma.designProject.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.designProject.create({
      data: tenantData(ctx, {
        code, name: data.name, description: data.description ?? null,
        ownerId: data.ownerId ?? null, processId: data.processId ?? null,
        plannedStart: data.plannedStart ? new Date(data.plannedStart) : null,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, name: data.name }, extra: { event: "create_design_project" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

export async function updateDesignProject(id: string, input: z.infer<typeof projectSchema>) {
  const ctx = await requirePermission("design-dev:update");
  const recordId = idSchema.parse(id);
  const data = projectSchema.partial().parse(input);
  await Promise.all([assertProcessInOrg(ctx.organization.id, data.processId), assertMemberInOrg(ctx.organization.id, data.ownerId)]);
  const existing = await prisma.designProject.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Proyecto de diseño no encontrado.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.designProject.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.processId !== undefined ? { processId: data.processId } : {}),
        ...(data.plannedStart !== undefined ? { plannedStart: data.plannedStart ? new Date(data.plannedStart) : null } : {}),
        ...(data.plannedEnd !== undefined ? { plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : null } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: updated.id, after: { name: updated.name }, extra: { event: "update_design_project" } });
  });
  revalidate();
  return { id: existing.id };
}

const PROJECT_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function transitionDesignProject(id: string, status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED") {
  const ctx = await requirePermission("design-dev:update");
  const recordId = idSchema.parse(id);
  const existing = await prisma.designProject.findFirst({ where: tenantWhere(ctx, { id: recordId }), include: { stages: true } });
  if (!existing) throw new Error("Proyecto de diseño no encontrado.");
  if (!PROJECT_TRANSITIONS[existing.status]?.includes(status)) {
    throw new Error(`Transición ${existing.status} → ${status} no permitida.`);
  }
  if (status === "COMPLETED") {
    const openStages = existing.stages.filter((s) => s.status !== "COMPLETED");
    if (openStages.length > 0) {
      throw new Error(`No se puede completar el proyecto: ${openStages.length} etapa(s) siguen abiertas.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.designProject.update({
      where: { id: existing.id },
      data: { status, completedAt: status === "COMPLETED" ? new Date() : existing.completedAt },
    });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "transition_design_project" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteDesignProject(id: string) {
  const ctx = await requirePermission("design-dev:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.designProject.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true, status: true } });
  if (!existing) throw new Error("Proyecto de diseño no encontrado.");
  if (existing.status === "IN_PROGRESS") throw new Error("No se puede eliminar un proyecto en curso; ponlo en pausa o cancélalo primero.");
  await prisma.$transaction(async (tx) => {
    await tx.designProject.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_design_project" } });
  });
  revalidate();
  return { id: existing.id };
}

// ─── STAGES ────────────────────────────────────────────

const stageSchema = z.object({
  projectId: idSchema,
  stageType: z.enum(["PLANNING", "INPUT", "OUTPUT", "REVIEW", "VERIFICATION", "VALIDATION", "CHANGE_CONTROL", "TRANSFER"]),
  title: shortText(300),
  description: optionalText(4000),
  responsibleId: idSchema.nullable().optional(),
});

export async function createDesignStage(input: z.infer<typeof stageSchema>) {
  const ctx = await requirePermission("design-dev:create");
  const data = stageSchema.parse(input);
  const project = await prisma.designProject.findFirst({ where: tenantWhere(ctx, { id: data.projectId }), select: { id: true } });
  if (!project) throw new Error("Proyecto de diseño no encontrado.");
  await assertMemberInOrg(ctx.organization.id, data.responsibleId);
  const code = await nextCode(ctx.organization.id, "STG", await prisma.designStage.count({ where: { organizationId: ctx.organization.id } }));

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.designStage.create({
      data: tenantData(ctx, {
        code, projectId: data.projectId, stageType: data.stageType, title: data.title,
        description: data.description ?? null, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: created.id, after: { code, stageType: created.stageType }, extra: { event: "create_design_stage" } });
    return created;
  });
  revalidate();
  return { id: result.id, code };
}

const completeStageSchema = z.object({ result: shortText(4000), evidenceId: idSchema.nullable().optional() });

export async function completeDesignStage(id: string, input: z.infer<typeof completeStageSchema>) {
  const ctx = await requirePermission("design-dev:update");
  const recordId = idSchema.parse(id);
  const data = completeStageSchema.parse(input);
  await assertEvidenceInOrg(ctx.organization.id, data.evidenceId);
  const existing = await prisma.designStage.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Etapa de diseño no encontrada.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.designStage.update({
      where: { id: existing.id },
      data: { status: "COMPLETED", result: data.result, evidenceId: data.evidenceId ?? existing.evidenceId, completedAt: new Date() },
    });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "complete_design_stage" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function startDesignStage(id: string) {
  const ctx = await requirePermission("design-dev:update");
  const recordId = idSchema.parse(id);
  const existing = await prisma.designStage.findFirst({ where: tenantWhere(ctx, { id: recordId }) });
  if (!existing) throw new Error("Etapa de diseño no encontrada.");
  if (existing.status !== "PENDING") throw new Error("Solo una etapa pendiente puede iniciarse.");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.designStage.update({ where: { id: existing.id }, data: { status: "IN_PROGRESS" } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: updated.id, before: { status: existing.status }, after: { status: updated.status }, extra: { event: "start_design_stage" } });
  });
  revalidate();
  return { id: existing.id };
}

export async function deleteDesignStage(id: string) {
  const ctx = await requirePermission("design-dev:delete");
  const recordId = idSchema.parse(id);
  const existing = await prisma.designStage.findFirst({ where: tenantWhere(ctx, { id: recordId }), select: { id: true, code: true, status: true } });
  if (!existing) throw new Error("Etapa de diseño no encontrada.");
  if (existing.status === "COMPLETED") throw new Error("No se puede eliminar una etapa completada; forma parte del historial del proyecto.");
  await prisma.$transaction(async (tx) => {
    await tx.designStage.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_design_stage" } });
  });
  revalidate();
  return { id: existing.id };
}
