import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Delegación por ausencia.
 *
 * Enruta AVISOS, no permisos. En un sistema de gestión, que un ajuste de
 * cuenta pudiera concederse a sí mismo capacidad de aprobación rompería la
 * segregación de funciones que la propia norma exige: el suplente ve lo que
 * hay pendiente, y actúa con los permisos que ya tiene su rol.
 */

export type DelegateTarget = { userId: string; fromUserId: string };

/**
 * Quién cubre a esta persona ahora mismo, si alguien.
 *
 * Un solo salto a propósito: si A delega en B y B delega en C, un aviso para A
 * llega a B y para ahí. Encadenar convertiría dos ausencias solapadas en un
 * reenvío en cascada difícil de auditar —y, con una delegación circular, en un
 * bucle.
 */
export async function activeDelegateFor(
  organizationId: string,
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  now: Date = new Date(),
): Promise<string | null> {
  const delegation = await client.approvalDelegation.findFirst({
    where: {
      organizationId,
      fromUserId: userId,
      revokedAt: null,
      startsAt: { lte: now },
      endsAt: { gte: now },
      // El suplente tiene que seguir perteneciendo a la organización: si se le
      // dio de baja, el aviso no debe seguir yéndose a su buzón.
      toUser: { memberships: { some: { organizationId, active: true } } },
    },
    orderBy: { startsAt: "desc" },
    select: { toUserId: true },
  });
  if (!delegation) return null;
  // Autodelegación: no se avisa dos veces a la misma persona.
  return delegation.toUserId === userId ? null : delegation.toUserId;
}

/** Delegaciones que declara una persona, para la pantalla de cuenta. */
export async function delegationsFor(organizationId: string, userId: string) {
  return prisma.approvalDelegation.findMany({
    where: { organizationId, fromUserId: userId },
    orderBy: [{ revokedAt: "asc" }, { startsAt: "desc" }],
    take: 20,
    select: {
      id: true, startsAt: true, endsAt: true, reason: true, revokedAt: true,
      toUser: { select: { id: true, name: true, email: true } },
    },
  });
}
