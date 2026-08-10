"use server";

import { revalidatePath } from "next/cache";
import { AuditProgramStatus, AuditStatus, AuditType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUsers } from "@/lib/notify";
import { assertAuditIndependence } from "@/lib/audit-workflow";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { parseId, parseInput } from "@/lib/validation/common";
import { auditProgramSchema, plannedProgramAuditSchema } from "@/lib/validation/workflows";

const PATH = "/app/audit-program";
const AUDITS_PATH = "/app/audits";

function trimOrNull(value: string | undefined | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

async function normalizeStandards(values: string[] | undefined, organizationId: string) {
  const standards = [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
  if (!standards.length) return standards;
  const enabled = await prisma.organizationStandard.findMany({ where: { organizationId, standard: { code: { in: standards } } }, select: { standard: { select: { code: true } } } });
  const enabledCodes = new Set(enabled.map((item) => item.standard.code));
  if (standards.some((code) => !enabledCodes.has(code))) throw new Error("Todas las normas deben estar habilitadas para la organización.");
  return standards;
}

// Allowed status transitions for the annual audit program lifecycle.
const TRANSITIONS: Record<AuditProgramStatus, AuditProgramStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_EXECUTION", "CANCELLED"],
  IN_EXECUTION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["DRAFT"],
};

async function loadProgram(id: string, organizationId: string) {
  const program = await prisma.auditProgram.findFirst({ where: { id, organizationId } });
  if (!program) throw new Error("Programa de auditoría no encontrado.");
  return program;
}

export type AuditProgramInput = {
  year: number;
  title: string;
  objectives?: string;
  scope?: string;
  standards?: string[];
  criteria?: string;
  responsibleId?: string;
};

export async function createAuditProgram(input: AuditProgramInput) {
  input = parseInput(auditProgramSchema, input) as AuditProgramInput;
  const ctx = await requirePermission("audit-program:*");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  const year = Math.trunc(input.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new Error("Indica un año válido.");

  const duplicate = await prisma.auditProgram.findFirst({
    where: { organizationId: ctx.organization.id, year, title },
    select: { id: true },
  });
  if (duplicate) throw new Error("Ya existe un programa con ese año y título.");
  if (input.responsibleId) {
    const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: input.responsibleId, active: true }, select: { id: true } });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }
  const standards = await normalizeStandards(input.standards, ctx.organization.id);

  const created = await prisma.auditProgram.create({
    data: {
      organizationId: ctx.organization.id,
      year,
      title,
      objectives: trimOrNull(input.objectives),
      scope: trimOrNull(input.scope),
      standards,
      criteria: trimOrNull(input.criteria),
      responsibleId: input.responsibleId || null,
    },
  });
  await logAuditEvent({ ctx, action: "create", module: "audit_program", recordId: created.id, after: { year, title } });
  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateAuditProgram(id: string, input: AuditProgramInput) {
  id = parseId(id);
  input = parseInput(auditProgramSchema, input) as AuditProgramInput;
  const ctx = await requirePermission("audit-program:*");
  const existing = await loadProgram(id, ctx.organization.id);
  const title = input.title?.trim() || existing.title;
  const year = Number.isFinite(input.year) ? Math.trunc(input.year) : existing.year;
  if (input.responsibleId) {
    const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: input.responsibleId, active: true }, select: { id: true } });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }
  const standards = await normalizeStandards(input.standards, ctx.organization.id);
  await prisma.auditProgram.update({
    where: { id },
    data: { title, year, objectives: trimOrNull(input.objectives), scope: trimOrNull(input.scope), standards, criteria: trimOrNull(input.criteria), responsibleId: input.responsibleId || null },
  });
  await logAuditEvent({ ctx, action: "update", module: "audit_program", recordId: id, after: { year, title } });
  revalidatePath(PATH);
}

export async function transitionAuditProgram(id: string, toStatus: AuditProgramStatus) {
  const ctx = await requirePermission("audit-program:*");
  const existing = await loadProgram(id, ctx.organization.id);
  if (existing.status === toStatus) return;
  if (!TRANSITIONS[existing.status].includes(toStatus)) {
    throw new Error(`No se puede pasar de ${existing.status} a ${toStatus}.`);
  }
  if (toStatus === AuditProgramStatus.COMPLETED) {
    const pending = await prisma.audit.count({ where: { programId: id, status: { not: AuditStatus.COMPLETED } } });
    if (pending > 0) throw new Error("No se puede completar el programa mientras tenga auditorías pendientes.");
  }

  const data: { status: AuditProgramStatus; approvedById?: string | null; approvedAt?: Date | null } = { status: toStatus };
  if (toStatus === "APPROVED") {
    data.approvedById = ctx.user.id;
    data.approvedAt = new Date();
  }
  if (toStatus === "DRAFT") {
    data.approvedById = null;
    data.approvedAt = null;
  }

  await prisma.auditProgram.update({ where: { id }, data });
  await logAuditEvent({
    ctx,
    action: toStatus === "APPROVED" ? "approve" : "transition",
    module: "audit_program",
    recordId: id,
    before: { status: existing.status },
    after: { status: toStatus },
  });
  const linkedAudits = await prisma.audit.findMany({
    where: { programId: id, auditorId: { not: null } },
    select: { auditorId: true },
  });
  await notifyUsers(
    linkedAudits.map((audit) => audit.auditorId),
    {
      organizationId: ctx.organization.id,
      title: `Programa de auditoría ${toStatus === "APPROVED" ? "aprobado" : "actualizado"}`,
      body: `El programa «${existing.title}» pasó a ${toStatus.replaceAll("_", " ")}. Revisa las auditorías vinculadas.`,
      type: toStatus === "APPROVED" ? "SUCCESS" : "INFO",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath(AUDITS_PATH);
}

export type PlannedProgramAuditInput = { title: string; processId: string; standardCode: string; date: string; auditorId: string };

export async function addProgramAudit(programId: string, input: PlannedProgramAuditInput) {
  programId = parseId(programId);
  input = parseInput(plannedProgramAuditSchema, input) as PlannedProgramAuditInput;
  const ctx = await requirePermission("audit-program:update");
  const program = await loadProgram(programId, ctx.organization.id);
  if (!input.title.trim() || !input.processId || !input.standardCode.trim() || !input.date || !input.auditorId) throw new Error("Título, proceso, norma, fecha y auditor son obligatorios.");
  const [process, standard, auditor] = await Promise.all([
    prisma.process.findFirst({ where: { id: input.processId, organizationId: ctx.organization.id }, select: { id: true, ownerId: true } }),
    prisma.organizationStandard.findFirst({ where: { organizationId: ctx.organization.id, standard: { code: input.standardCode.trim() } }, select: { id: true } }),
    prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: input.auditorId, active: true }, select: { id: true } }),
  ]);
  if (!process) throw new Error("El proceso no pertenece a la organización.");
  if (!standard) throw new Error("La norma no está habilitada para la organización.");
  if (!auditor) throw new Error("El auditor no pertenece a la organización.");
  assertAuditIndependence({ auditorId: input.auditorId, processOwnerId: process.ownerId });
  const date = new Date(`${input.date}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha no es válida.");
  const audit = await prisma.audit.create({ data: { organizationId: ctx.organization.id, programId, processId: process.id, title: input.title.trim(), type: AuditType.INTERNAL, standardCode: input.standardCode.trim(), auditorId: input.auditorId, plannedDate: date, scheduledDate: date, status: AuditStatus.PLANNED } });
  await logAuditEvent({ ctx, action: "create_planned_audit", module: "audit_program", recordId: programId, after: { auditId: audit.id, title: audit.title, processId: process.id, standardCode: input.standardCode, date: input.date, auditorId: input.auditorId } });
  await notifyUsers([input.auditorId], { organizationId: ctx.organization.id, title: "Auditoría planificada", body: `Se te asignó «${audit.title}» en el programa ${program.year}.`, type: "INFO", link: "/app/audits" }, { skipUserId: ctx.user.id });
  revalidatePath(PATH); revalidatePath(AUDITS_PATH);
  return { id: audit.id };
}

export async function exportAuditProgram(programId: string, format: "PDF" | "EXCEL") {
  const ctx = await requirePermission("audit-program:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const program = await prisma.auditProgram.findFirst({ where: { id: programId, organizationId: ctx.organization.id }, include: { responsible: true, audits: { include: { process: true, participants: { include: { user: true } } }, orderBy: [{ plannedDate: "asc" }, { title: "asc" }] } } });
  if (!program) throw new Error("Programa de auditoría no encontrado.");
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `programa-auditorias-${program.year}-${date}.${format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const report = await queueReportForContext({ ctx, reportType: "audit-program", title: `Programa anual de auditorías ${program.year}`, format, fileName, dateFrom: new Date(`${program.year}-01-01T00:00:00.000Z`), dateTo: new Date(`${program.year}-12-31T23:59:59.999Z`), filters: { from: `${program.year}-01-01`, to: `${program.year}-12-31`, recordId: programId } });
  return { id: report.id, fileName, mimeType, status: report.status, rowCount: report.rowCount };
}

export async function deleteAuditProgram(id: string) {
  const ctx = await requirePermission("audit-program:*");
  await loadProgram(id, ctx.organization.id);
  // Detach linked audits (set programId = null) so they are preserved.
  await prisma.audit.updateMany({ where: { programId: id }, data: { programId: null } });
  await prisma.auditProgram.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "audit_program", recordId: id });
  revalidatePath(PATH);
  revalidatePath(AUDITS_PATH);
}
