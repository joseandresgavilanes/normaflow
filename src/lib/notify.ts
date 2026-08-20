import "server-only";
import { Prisma, type NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueExternalNotificationEmail, enqueueNotificationDelivery } from "@/lib/notification-delivery";
import { activeDelegateFor } from "@/lib/delegation";

export type NotifyInput = {
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  link?: string | null;
  /** Set false to create the in-app notification without an email job. */
  email?: boolean;
  /** Stable key for events that can be emitted more than once. */
  idempotencyKey?: string;
};

/**
 * No email provider call happens in the request path, so business actions stay
 * fast and the in-app inbox remains available even when delivery is unavailable.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const type = input.type ?? "INFO";
  // An event can target several users. Scope a caller-provided key to the
  // recipient so deduplication never suppresses another user's inbox item.
  const idempotencyKey = input.idempotencyKey?.trim() ? `${input.userId}:${input.idempotencyKey.trim()}` : null;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: input.userId, memberships: { some: { organizationId: input.organizationId, active: true } } },
      select: { email: true, name: true },
    });
    if (!user) throw new Error("El destinatario no pertenece a la organización.");
    let notification;
    try {
      notification = await tx.notification.create({
        data: { organizationId: input.organizationId, userId: input.userId, title: input.title, body: input.body, type, link: input.link ?? null, idempotencyKey },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || !idempotencyKey) throw error;
      notification = await tx.notification.findUniqueOrThrow({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey } } });
    }
    if (input.email === false || !user.email) return;
    const preference = await tx.notificationPreference.findUnique({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
      select: { emailEnabled: true, disabledTypes: true },
    });
    await enqueueNotificationDelivery({
      tx,
      organizationId: input.organizationId,
      notificationId: notification.id,
      userId: input.userId,
      recipientEmail: user.email,
      recipientName: user.name,
      title: input.title,
      body: input.body,
      link: input.link,
      idempotencyKey: idempotencyKey ?? `notification:${notification.id}`,
      type,
      emailEnabled: preference?.emailEnabled ?? true,
      disabledTypes: preference?.disabledTypes ?? [],
    });
  });

  /* Fuera de la transacción a propósito: la delegación es un reenvío de
     cortesía, y si falla no debe tumbar el aviso al destinatario original —que
     es el que la acción de negocio acaba de garantizar. */
  await forwardToDelegate(input, type, idempotencyKey);
}

/**
 * Reenvía el aviso a quien cubre al destinatario durante su ausencia.
 *
 * El aviso del suplente es una notificación propia, no una copia: pasa por sus
 * preferencias de correo y por su buzón, y lleva escrito a quién sustituye.
 * Sin eso, el suplente recibiría avisos sin saber por qué le llegan.
 */
async function forwardToDelegate(input: NotifyInput, type: NotificationType, idempotencyKey: string | null): Promise<void> {
  try {
    const delegateId = await activeDelegateFor(input.organizationId, input.userId);
    if (!delegateId) return;
    const holder = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } });
    await notifyUser({
      organizationId: input.organizationId,
      userId: delegateId,
      title: `[Suplencia de ${holder?.name ?? "un compañero"}] ${input.title}`,
      body: input.body,
      type,
      link: input.link,
      email: input.email,
      // Clave propia: si se reutilizara la del titular, la deduplicación por
      // organización descartaría uno de los dos avisos.
      idempotencyKey: idempotencyKey ? `delegate:${idempotencyKey}` : undefined,
    });
  } catch (error) {
    console.error("[notify] no se pudo reenviar al suplente", error);
  }
}

/** Queue an email-only notification for personnel without a NormaFlow login. */
export async function notifyEmail(input: {
  organizationId: string;
  to: string | null | undefined;
  name: string;
  title: string;
  body: string;
  link?: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  if (!input.to) return;
  try {
    await enqueueExternalNotificationEmail({ ...input, to: input.to });
  } catch (error) {
    console.error("[notify] unable to queue external notification", error);
  }
}

export async function notifyPersonnel(input: {
  organizationId: string;
  personnelIds: (string | null | undefined)[];
  title: string;
  body: string;
  link?: string | null;
}): Promise<void> {
  const ids = [...new Set(input.personnelIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const personnel = await prisma.personnel.findMany({
    where: { organizationId: input.organizationId, id: { in: ids }, active: true },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  await Promise.all(personnel.map((person) => notifyEmail({
    organizationId: input.organizationId,
    to: person.email,
    name: `${person.firstName} ${person.lastName}`.trim(),
    title: input.title,
    body: input.body,
    link: input.link,
    idempotencyKey: `personnel:${person.id}:${input.title}:${input.link ?? ""}`,
  })));
}

export async function notifyUsers(
  userIds: (string | null | undefined)[],
  base: Omit<NotifyInput, "userId">,
  options?: { skipUserId?: string },
): Promise<void> {
  const targets = [...new Set(userIds.filter((id): id is string => !!id))].filter(id => id !== options?.skipUserId);
  await Promise.all(targets.map(userId => notifyUser({ ...base, userId })));
}
