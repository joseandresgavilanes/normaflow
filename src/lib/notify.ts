import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/resend";
import type { NotificationType } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export type NotifyInput = {
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  link?: string | null;
  /** Set false to create the in-app notification without sending an email. */
  email?: boolean;
};

/**
 * Create an in-app notification and, best-effort, send the matching email.
 *
 * The in-app `Notification` row is the source of truth: if Resend is not
 * configured or the email fails, we log and continue — the caller's business
 * action must not fail because an email bounced.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? "INFO",
      link: input.link ?? null,
    },
  });

  if (input.email === false) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      const link = input.link ? `${APP_URL}${input.link}` : undefined;
      await sendNotificationEmail(user.email, user.name, input.title, input.body, link);
    }
  } catch (err) {
    console.error("[notify] email send failed:", err);
  }
}

/**
 * Send an email to a recipient that is NOT a system user (e.g. personnel
 * without a login), so no in-app Notification row applies. Best-effort: a
 * missing address or Resend failure is logged and swallowed.
 */
export async function notifyEmail(input: {
  to: string | null | undefined;
  name: string;
  title: string;
  body: string;
  link?: string | null;
}): Promise<void> {
  if (!input.to) return;
  try {
    const link = input.link ? `${APP_URL}${input.link}` : undefined;
    await sendNotificationEmail(input.to, input.name, input.title, input.body, link);
  } catch (err) {
    console.error("[notify] personnel email send failed:", err);
  }
}

/** Notify several users (deduplicated). Optionally skip one (e.g. the actor). */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  base: Omit<NotifyInput, "userId">,
  options?: { skipUserId?: string },
): Promise<void> {
  const targets = [...new Set(userIds.filter((id): id is string => !!id))].filter(
    id => id !== options?.skipUserId,
  );
  await Promise.all(targets.map(userId => notifyUser({ ...base, userId })));
}
