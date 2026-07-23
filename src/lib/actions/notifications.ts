"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { NotificationType } from "@prisma/client";

const PATH = "/app/notifications";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const ctx = await requirePermission("notifications:read");
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, organizationId: ctx.organization.id, userId: ctx.user.id },
    select: { id: true, read: true },
  });
  if (!notification) throw new Error("Notificación no encontrada.");
  if (!notification.read) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true, readAt: new Date() },
    });
    await logAuditEvent({
      ctx,
      action: "read",
      module: "notification",
      recordId: notification.id,
    });
  }
  revalidatePath(PATH);
  revalidatePath("/app");
}

export async function markAllNotificationsRead(): Promise<number> {
  const ctx = await requirePermission("notifications:read");
  const result = await prisma.notification.updateMany({
    where: { organizationId: ctx.organization.id, userId: ctx.user.id, read: false },
    data: { read: true, readAt: new Date() },
  });
  if (result.count > 0) {
    await logAuditEvent({
      ctx,
      action: "read_all",
      module: "notification",
      after: { count: result.count },
    });
  }
  revalidatePath(PATH);
  revalidatePath("/app");
  return result.count;
}

/** Persist personal email preferences without exposing organization members. */
export async function updateNotificationEmailPreference(input: { emailEnabled: boolean; disabledTypes: NotificationType[] }): Promise<void> {
  const ctx = await requirePermission("notifications:read");
  const disabledTypes = [...new Set(input.disabledTypes)];
  if (!disabledTypes.every((type) => Object.values(NotificationType).includes(type))) throw new Error("Tipo de notificación no válido.");
  await prisma.notificationPreference.upsert({
    where: { organizationId_userId: { organizationId: ctx.organization.id, userId: ctx.user.id } },
    create: { organizationId: ctx.organization.id, userId: ctx.user.id, emailEnabled: input.emailEnabled, disabledTypes },
    update: { emailEnabled: input.emailEnabled, disabledTypes },
  });
  await logAuditEvent({ ctx, action: "update_preferences", module: "notification", after: { emailEnabled: input.emailEnabled, disabledTypes } });
}
