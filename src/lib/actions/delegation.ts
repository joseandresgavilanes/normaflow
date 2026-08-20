"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * Delegación por ausencia.
 *
 * Se declara sobre uno mismo: `fromUserId` sale del contexto autenticado y no
 * del formulario. Permitir declararla en nombre de otro convertiría un ajuste
 * de cuenta en una forma de desviar los avisos de un tercero.
 */
export async function createDelegation(input: {
  toUserId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}): Promise<void> {
  const ctx = await requirePermission("notifications:read");
  const organizationId = ctx.organization.id;

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Las fechas no son válidas.");
  if (endsAt <= startsAt) throw new Error("La fecha de fin debe ser posterior a la de inicio.");
  if (input.toUserId === ctx.user.id) throw new Error("No puedes delegarte los avisos a ti mismo.");

  const delegate = await prisma.user.findFirst({
    where: { id: input.toUserId, memberships: { some: { organizationId, active: true } } },
    select: { id: true, name: true },
  });
  if (!delegate) throw new Error("El suplente debe pertenecer a esta organización.");

  const overlapping = await prisma.approvalDelegation.findFirst({
    where: {
      organizationId, fromUserId: ctx.user.id, revokedAt: null,
      startsAt: { lte: endsAt }, endsAt: { gte: startsAt },
    },
    select: { id: true },
  });
  if (overlapping) throw new Error("Ya tienes una ausencia declarada que se solapa con esas fechas.");

  const created = await prisma.approvalDelegation.create({
    data: {
      organizationId, fromUserId: ctx.user.id, toUserId: delegate.id,
      startsAt, endsAt, reason: input.reason?.trim() || null,
    },
    select: { id: true },
  });

  /* Queda en la traza: quién delegó en quién y durante cuándo es exactamente
     el tipo de dato que un auditor pregunta al ver una aprobación firmada por
     alguien que no es el responsable habitual. */
  await logAuditEvent({
    ctx, action: "create", module: "delegation", recordId: created.id,
    after: { toUserId: delegate.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
  });
  revalidatePath("/app/settings");
}

/** Cierra la ausencia antes de tiempo. No se borra: la traza se conserva. */
export async function revokeDelegation(id: string): Promise<void> {
  const ctx = await requirePermission("notifications:read");
  const delegation = await prisma.approvalDelegation.findFirst({
    where: { id, organizationId: ctx.organization.id, fromUserId: ctx.user.id },
    select: { id: true, revokedAt: true },
  });
  if (!delegation) throw new Error("No se encontró la delegación.");
  if (delegation.revokedAt) return;

  await prisma.approvalDelegation.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAuditEvent({ ctx, action: "update", module: "delegation", recordId: id, after: { revoked: true } });
  revalidatePath("/app/settings");
}
