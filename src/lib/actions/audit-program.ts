"use server";

import { revalidatePath } from "next/cache";
import { AuditProgramStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const PATH = "/app/audit-program";
const AUDITS_PATH = "/app/audits";

function trimOrNull(value: string | undefined | null): string | null {
  const t = value?.trim();
  return t ? t : null;
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
};

export async function createAuditProgram(input: AuditProgramInput) {
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

  const created = await prisma.auditProgram.create({
    data: {
      organizationId: ctx.organization.id,
      year,
      title,
      objectives: trimOrNull(input.objectives),
      scope: trimOrNull(input.scope),
    },
  });
  await logAuditEvent({ ctx, action: "create", module: "audit_program", recordId: created.id, after: { year, title } });
  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateAuditProgram(id: string, input: AuditProgramInput) {
  const ctx = await requirePermission("audit-program:*");
  const existing = await loadProgram(id, ctx.organization.id);
  const title = input.title?.trim() || existing.title;
  const year = Number.isFinite(input.year) ? Math.trunc(input.year) : existing.year;
  await prisma.auditProgram.update({
    where: { id },
    data: { title, year, objectives: trimOrNull(input.objectives), scope: trimOrNull(input.scope) },
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
  revalidatePath(PATH);
  revalidatePath(AUDITS_PATH);
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
