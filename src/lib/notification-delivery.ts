import "server-only";
import { NotificationDeliveryStatus, type NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/resend";
import { DELIVERY_MAX_ATTEMPTS, deliveryFailureTransition, deliverySuccessTransition, externalDeliveryIdempotencyKey } from "@/lib/notification-delivery-policy";

type EmailResponse = { data?: { id?: string } | null; error?: unknown };
type DeliverySender = (to: string, name: string, title: string, body: string, link: string | undefined, idempotencyKey: string) => Promise<EmailResponse>;

export async function enqueueExternalNotificationEmail(input: {
  organizationId: string;
  to: string;
  name: string;
  title: string;
  body: string;
  link?: string | null;
  idempotencyKey?: string;
}) {
  const idempotencyKey = externalDeliveryIdempotencyKey(input);
  return prisma.notificationDeliveryJob.upsert({
    where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey } },
    create: { organizationId: input.organizationId, recipientEmail: input.to, recipientName: input.name, title: input.title, body: input.body, link: input.link ?? null, idempotencyKey, maxAttempts: DELIVERY_MAX_ATTEMPTS },
    update: {},
  });
}

async function claimDueJob(now: Date) {
  const candidate = await prisma.notificationDeliveryJob.findFirst({
    where: { status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRYING] }, nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;
  const claim = await prisma.notificationDeliveryJob.updateMany({
    where: { id: candidate.id, status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRYING] }, nextAttemptAt: { lte: now } },
    data: { status: NotificationDeliveryStatus.PROCESSING, processingStartedAt: now, attempts: { increment: 1 } },
  });
  if (claim.count !== 1) return null;
  return prisma.notificationDeliveryJob.findUniqueOrThrow({ where: { id: candidate.id } });
}

async function markDeliveryFailure(job: { id: string; attempts: number; maxAttempts: number; organizationId: string }, error: unknown, now: Date) {
  const transition = deliveryFailureTransition({ attempts: job.attempts, maxAttempts: job.maxAttempts, error, now });
  // Persist FAILED before its retry state so the reason is always retained,
  // even if this worker is interrupted while scheduling the next attempt.
  await prisma.notificationDeliveryJob.update({ where: { id: job.id }, data: { status: NotificationDeliveryStatus.FAILED, lastError: transition.error, lastErrorAt: now } });
  await prisma.notificationDeliveryJob.update({ where: { id: job.id }, data: { status: transition.status, nextAttemptAt: transition.nextAttemptAt, processingStartedAt: null } });
  console.error(JSON.stringify({ event: "notification_delivery_failed", jobId: job.id, organizationId: job.organizationId, attempts: job.attempts, permanent: transition.status === NotificationDeliveryStatus.PERMANENTLY_FAILED, error: transition.error }));
  return transition.status;
}

export async function processNotificationDeliveryJobs(options: { limit?: number; now?: Date; sender?: DeliverySender } = {}) {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const sender = options.sender ?? (async (to, name, title, body, link, key) => sendNotificationEmail(to, name, title, body, link, key) as Promise<EmailResponse>);
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  await prisma.notificationDeliveryJob.updateMany({
    where: { status: NotificationDeliveryStatus.PROCESSING, processingStartedAt: { lt: staleBefore } },
    data: { status: NotificationDeliveryStatus.RETRYING, nextAttemptAt: now, processingStartedAt: null, lastError: "Worker lease expired", lastErrorAt: now },
  });

  let sent = 0; let retried = 0; let permanentlyFailed = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await claimDueJob(now);
    if (!job) break;
    try {
      const result = await sender(job.recipientEmail, job.recipientName, job.title, job.body, job.link ?? undefined, job.idempotencyKey);
      if (result.error) throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
      const transition = deliverySuccessTransition(result.data?.id, now);
      await prisma.notificationDeliveryJob.update({ where: { id: job.id }, data: { ...transition, processingStartedAt: null, lastError: null } });
      console.info(JSON.stringify({ event: "notification_delivery_sent", jobId: job.id, organizationId: job.organizationId, providerMessageId: result.data?.id ?? null, attempts: job.attempts }));
      sent += 1;
    } catch (error) {
      const status = await markDeliveryFailure(job, error, now);
      if (status === NotificationDeliveryStatus.PERMANENTLY_FAILED) permanentlyFailed += 1;
      else retried += 1;
    }
  }
  return { sent, retried, permanentlyFailed };
}

export async function enqueueNotificationDelivery(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  notificationId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  title: string;
  body: string;
  link?: string | null;
  idempotencyKey: string;
  type: NotificationType;
  emailEnabled: boolean;
  disabledTypes: NotificationType[];
}) {
  if (!input.emailEnabled || input.disabledTypes.includes(input.type)) return null;
  return input.tx.notificationDeliveryJob.upsert({
    where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } },
    create: { organizationId: input.organizationId, notificationId: input.notificationId, userId: input.userId, recipientEmail: input.recipientEmail, recipientName: input.recipientName, title: input.title, body: input.body, link: input.link ?? null, idempotencyKey: input.idempotencyKey, maxAttempts: DELIVERY_MAX_ATTEMPTS },
    update: {},
  });
}
