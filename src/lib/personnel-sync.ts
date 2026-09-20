import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitFullName } from "@/lib/personnel-name";

/**
 * Ficha de Personal para quien entra en la organización.
 *
 * `Personnel` y `User` son tablas distintas y sin relación: la primera es el
 * catálogo de personas de la organización —de donde salen los responsables de
 * elaboración, aprobación y custodia de un documento— y la segunda son las
 * cuentas con acceso. Invitar a alguien creaba solo la cuenta, así que quien
 * aprobaba un documento en el flujo no aparecía en la carátula que dice quién
 * lo aprueba: dos listas distintas para la misma persona.
 *
 * El puente es el correo, que es lo único que ambas tablas comparten.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Crea la ficha de Personal del miembro si aún no la tiene.
 *
 * Empareja por correo sin distinguir mayúsculas y **no toca** la ficha que ya
 * exista, ni siquiera para reactivarla: dar de baja a alguien en Personal es
 * una decisión de la organización, y volver a invitarlo a la aplicación no
 * tiene por qué deshacerla. Devuelve el id de la ficha, o `null` si no hizo
 * falta crear nada.
 */
export async function ensurePersonnelForMember(
  db: Db,
  member: { organizationId: string; email: string; name: string },
): Promise<string | null> {
  const email = member.email.trim().toLowerCase();
  if (!email) return null;

  const existing = await db.personnel.findFirst({
    where: { organizationId: member.organizationId, email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return null;

  const { firstName, lastName } = splitFullName(member.name);
  const created = await db.personnel.create({
    data: { organizationId: member.organizationId, firstName, lastName, email },
    select: { id: true },
  });
  return created.id;
}

/**
 * Versión tolerante para los flujos donde el alta del miembro es lo importante.
 *
 * Que falle el catálogo de Personal no puede tumbar una invitación ya enviada
 * ni el registro de una organización: se anota y se sigue.
 */
export async function ensurePersonnelForMemberSafe(
  member: { organizationId: string; email: string; name: string },
): Promise<void> {
  try {
    await ensurePersonnelForMember(prisma, member);
  } catch (error) {
    console.error("[personnel-sync] no se pudo crear la ficha de Personal", error);
  }
}
