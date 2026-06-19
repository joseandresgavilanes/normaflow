"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

export type PersonnelInput = {
  firstName: string;
  lastName: string;
  email?: string;
  identification?: string;
  positionId?: string;
  hiredAt?: string;
};

function normalize(input: PersonnelInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) throw new Error("El nombre es obligatorio.");
  if (!lastName) throw new Error("El apellido es obligatorio.");
  return {
    firstName,
    lastName,
    email: input.email?.trim() || null,
    identification: input.identification?.trim() || null,
    positionId: input.positionId || null,
    hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
  };
}

async function assertPositionBelongsToOrganization(positionId: string | undefined, organizationId: string) {
  if (!positionId) return;
  const position = await prisma.position.findFirst({
    where: { id: positionId, organizationId },
    select: { id: true },
  });
  if (!position) throw new Error("El cargo no pertenece a la organización.");
}

export async function createPersonnel(input: PersonnelInput) {
  const ctx = await requirePermission("personnel:*");
  const data = normalize(input);
  await assertPositionBelongsToOrganization(input.positionId, ctx.organization.id);
  const created = await prisma.personnel.create({
    data: { organizationId: ctx.organization.id, ...data },
  });
  await logAuditEvent({ ctx, action: "create", module: "personnel", recordId: created.id, after: data });
  revalidatePath("/app/info/personnel");
}

export async function updatePersonnel(id: string, input: PersonnelInput & { active?: boolean }) {
  const ctx = await requirePermission("personnel:*");
  const existing = await prisma.personnel.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");
  const data = normalize(input);
  await assertPositionBelongsToOrganization(input.positionId, ctx.organization.id);
  const patch = { ...data, ...(input.active !== undefined ? { active: input.active } : {}) };
  await prisma.personnel.update({ where: { id }, data: patch });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "personnel",
    recordId: id,
    before: { firstName: existing.firstName, lastName: existing.lastName, email: existing.email, positionId: existing.positionId, active: existing.active },
    after: patch,
  });
  revalidatePath("/app/info/personnel");
}

export async function deactivatePersonnel(id: string) {
  const ctx = await requirePermission("personnel:*");
  const existing = await prisma.personnel.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");
  await prisma.personnel.update({ where: { id }, data: { active: false } });
  await logAuditEvent({
    ctx,
    action: "deactivate",
    module: "personnel",
    recordId: id,
    before: { firstName: existing.firstName, lastName: existing.lastName },
  });
  revalidatePath("/app/info/personnel");
}
