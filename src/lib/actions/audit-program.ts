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
import { auditProgramSchema, plannedProgramAuditsSchema } from "@/lib/validation/workflows";
import { actionResult } from "@/lib/actions/action-result";
import { getServerPreferences } from "@/lib/preferences/server";

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
  /* Un programa anual no se aprueba como un título vacío: su aprobación deja
     constancia de qué se audita, contra qué criterio, quién responde y qué
     auditorías se ejecutarán. Sin esa base no hay nada que seguir. */
  if (toStatus === AuditProgramStatus.APPROVED) {
    const gaps = [
      !existing.objectives?.trim() ? "objetivos" : null,
      !existing.scope?.trim() ? "alcance" : null,
      !existing.standards.length ? "normas incluidas" : null,
      !existing.criteria?.trim() ? "criterios de auditoría" : null,
      !existing.responsibleId ? "responsable del programa" : null,
      (await prisma.audit.count({ where: { programId: id } })) === 0 ? "al menos una auditoría planificada" : null,
    ].filter((item): item is string => Boolean(item));
    if (gaps.length) throw new Error(`Completa ${gaps.join(", ")} antes de aprobar el programa.`);
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

export type PlannedProgramAuditInput = {
  title?: string;
  processId: string;
  standardCode: string;
  /** Día del plan, `YYYY-MM-DD`. */
  date: string;
  /** Instante ISO de inicio y fin de la sesión, si se planificó con hora. */
  startAt?: string;
  endAt?: string;
  auditorId: string;
};

/**
 * Alta de las auditorías de un plan.
 *
 * El plan de auditoría se escribe de una sentada —los procesos, sus días y sus
 * franjas horarias— y no proceso a proceso: llega la lista entera y se
 * comprueba completa antes de escribir nada, para que un error en la línea 4 no
 * deje creadas las tres primeras.
 *
 * La hora viaja como instante ISO ya resuelto por el navegador. El servidor no
 * sabe en qué zona horaria está quien planifica, y construir aquí «las nueve»
 * sobre UTC convertía las 09:00 de Quito en las 04:00 de cualquier lectura
 * posterior.
 */
export async function addProgramAudits(programId: string, inputs: PlannedProgramAuditInput[]) {
  return actionResult(() => addProgramAuditsImpl(programId, inputs));
}

async function addProgramAuditsImpl(programId: string, inputs: PlannedProgramAuditInput[]) {
  programId = parseId(programId);
  const rows = parseInput(plannedProgramAuditsSchema, inputs) as PlannedProgramAuditInput[];
  const ctx = await requirePermission("audit-program:update");
  const program = await loadProgram(programId, ctx.organization.id);

  const [processes, standards, auditors] = await Promise.all([
    prisma.process.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.processId))] }, organizationId: ctx.organization.id }, select: { id: true, name: true, code: true, ownerId: true } }),
    prisma.organizationStandard.findMany({ where: { organizationId: ctx.organization.id, standard: { code: { in: [...new Set(rows.map((row) => row.standardCode.trim()))] } } }, select: { standard: { select: { code: true } } } }),
    prisma.membership.findMany({ where: { organizationId: ctx.organization.id, userId: { in: [...new Set(rows.map((row) => row.auditorId))] }, active: true }, select: { userId: true } }),
  ]);
  const processById = new Map(processes.map((process) => [process.id, process]));
  const enabledStandards = new Set(standards.map((row) => row.standard.code));
  const activeAuditors = new Set(auditors.map((row) => row.userId));

  const planned = rows.map((row, index) => {
    // La línea se nombra en el error: con doce en pantalla, «el proceso no
    // pertenece a la organización» sin más no dice cuál hay que corregir.
    const line = `Línea ${index + 1}`;
    const process = processById.get(row.processId);
    if (!process) throw new Error(`${line}: el proceso no pertenece a la organización.`);
    if (!enabledStandards.has(row.standardCode.trim())) throw new Error(`${line}: la norma no está habilitada para la organización.`);
    if (!activeAuditors.has(row.auditorId)) throw new Error(`${line}: el auditor no pertenece a la organización.`);
    try {
      assertAuditIndependence({ auditorId: row.auditorId, processOwnerId: process.ownerId });
    } catch (cause) {
      throw new Error(`${line} (${process.name}): ${cause instanceof Error ? cause.message : "el auditor no puede auditar su propio proceso."}`);
    }

    // El día se guarda al mediodía UTC, como el resto de fechas sin hora del
    // producto: así ninguna zona horaria lo lee como el día anterior.
    const day = new Date(`${row.date}T12:00:00.000Z`);
    if (Number.isNaN(day.getTime())) throw new Error(`${line}: la fecha no es válida.`);
    const startAt = row.startAt ? new Date(row.startAt) : null;
    const endAt = row.endAt ? new Date(row.endAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) throw new Error(`${line}: la hora de inicio no es válida.`);
    if (endAt && Number.isNaN(endAt.getTime())) throw new Error(`${line}: la hora de fin no es válida.`);
    if (startAt && endAt && endAt <= startAt) throw new Error(`${line}: la hora de fin debe ser posterior a la de inicio.`);
    if (endAt && !startAt) throw new Error(`${line}: indica también la hora de inicio.`);

    const title = row.title?.trim() || `Auditoría de ${process.code ? `${process.code} · ` : ""}${process.name}`;
    return {
      organizationId: ctx.organization.id,
      programId,
      processId: process.id,
      title,
      type: AuditType.INTERNAL,
      standardCode: row.standardCode.trim(),
      auditorId: row.auditorId,
      plannedDate: day,
      scheduledDate: startAt ?? day,
      startDate: startAt,
      endDate: endAt,
      status: AuditStatus.PLANNED,
    };
  });

  const created = await prisma.$transaction(planned.map((data) => prisma.audit.create({ data, select: { id: true, title: true, auditorId: true } })));

  await logAuditEvent({ ctx, action: "create_planned_audit", module: "audit_program", recordId: programId, after: { count: created.length, audits: created.map((audit, index) => ({ id: audit.id, title: audit.title, processId: planned[index].processId, date: rows[index].date, startAt: rows[index].startAt ?? null, endAt: rows[index].endAt ?? null, auditorId: planned[index].auditorId })) } });

  // Un aviso por auditor, no uno por línea: quien se lleva cuatro procesos del
  // plan no necesita cuatro notificaciones idénticas.
  const byAuditor = new Map<string, string[]>();
  for (const audit of created) {
    if (!audit.auditorId) continue;
    byAuditor.set(audit.auditorId, [...(byAuditor.get(audit.auditorId) ?? []), audit.title]);
  }
  await Promise.all([...byAuditor].map(([auditorId, titles]) => notifyUsers([auditorId], {
    organizationId: ctx.organization.id,
    title: titles.length === 1 ? "Auditoría planificada" : `${titles.length} auditorías planificadas`,
    body: `Se te asignó ${titles.length === 1 ? `«${titles[0]}»` : `${titles.length} auditorías`} en el programa ${program.year}.`,
    type: "INFO",
    link: "/app/audits",
  }, { skipUserId: ctx.user.id })));

  revalidatePath(PATH); revalidatePath(AUDITS_PATH);
  return { ids: created.map((audit) => audit.id) };
}

/**
 * Evidencias del plan anual.
 *
 * El programa se aprueba, se revisa y se audita como cualquier otro elemento
 * del sistema: el acta de aprobación, la competencia del equipo auditor o la
 * convocatoria son evidencia del plan, no de una auditoría suelta.
 */
export async function linkProgramEvidence(programId: string, evidenceId: string) {
  const ctx = await requirePermission("audit-program:*");
  const [program, evidence] = await Promise.all([
    loadProgram(parseId(programId), ctx.organization.id),
    prisma.evidenceFile.findFirst({ where: { id: parseId(evidenceId), organizationId: ctx.organization.id, deletedAt: null }, select: { id: true, title: true } }),
  ]);
  if (!evidence) throw new Error("La evidencia no pertenece a la organización.");
  await prisma.evidenceAuditProgramLink.upsert({
    where: { evidenceId_programId: { evidenceId: evidence.id, programId: program.id } },
    create: { organizationId: ctx.organization.id, evidenceId: evidence.id, programId: program.id, createdById: ctx.user.id },
    update: {},
  });
  await logAuditEvent({ ctx, action: "attach_evidence", module: "audit_program", recordId: program.id, after: { evidenceId: evidence.id, evidenceTitle: evidence.title } });
  revalidatePath(PATH);
  revalidatePath("/app/evidence");
}

export async function unlinkProgramEvidence(programId: string, evidenceId: string) {
  const ctx = await requirePermission("audit-program:*");
  const program = await loadProgram(parseId(programId), ctx.organization.id);
  await prisma.evidenceAuditProgramLink.deleteMany({ where: { programId: program.id, evidenceId: parseId(evidenceId), organizationId: ctx.organization.id } });
  await logAuditEvent({ ctx, action: "detach_evidence", module: "audit_program", recordId: program.id, before: { evidenceId } });
  revalidatePath(PATH);
  revalidatePath("/app/evidence");
}

export async function exportAuditProgram(programId: string, format: "PDF" | "EXCEL") {
  const ctx = await requirePermission("audit-program:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const program = await prisma.auditProgram.findFirst({ where: { id: programId, organizationId: ctx.organization.id }, include: { responsible: true, audits: { include: { process: true, participants: { include: { user: true } } }, orderBy: [{ plannedDate: "asc" }, { title: "asc" }] } } });
  if (!program) throw new Error("Programa de auditoría no encontrado.");
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `programa-auditorias-${program.year}-${date}.${format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // La zona de quien exporta acompaña al informe: el plan lleva horas y el
  // trabajador que lo imprime ya no tiene forma de averiguarla.
  const { timeZone } = await getServerPreferences();
  const report = await queueReportForContext({ ctx, reportType: "audit-program", title: `Programa anual de auditorías ${program.year}`, format, fileName, dateFrom: new Date(`${program.year}-01-01T00:00:00.000Z`), dateTo: new Date(`${program.year}-12-31T23:59:59.999Z`), filters: { from: `${program.year}-01-01`, to: `${program.year}-12-31`, recordId: programId, timeZone } });
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
