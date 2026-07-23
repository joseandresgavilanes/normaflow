CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING', 'PERMANENTLY_FAILED');

ALTER TABLE "notifications" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "notifications_organizationId_idempotencyKey_key" ON "notifications"("organizationId", "idempotencyKey");

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "disabledTypes" "NotificationType"[] NOT NULL DEFAULT ARRAY[]::"NotificationType"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_preferences_organizationId_userId_key" ON "notification_preferences"("organizationId", "userId");
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_delivery_jobs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "notificationId" TEXT,
  "userId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "lastErrorAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_delivery_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_delivery_jobs_notificationId_key" ON "notification_delivery_jobs"("notificationId");
CREATE UNIQUE INDEX "notification_delivery_jobs_organizationId_idempotencyKey_key" ON "notification_delivery_jobs"("organizationId", "idempotencyKey");
CREATE INDEX "notification_delivery_jobs_status_nextAttemptAt_idx" ON "notification_delivery_jobs"("status", "nextAttemptAt");
CREATE INDEX "notification_delivery_jobs_organizationId_createdAt_idx" ON "notification_delivery_jobs"("organizationId", "createdAt");
ALTER TABLE "notification_delivery_jobs" ADD CONSTRAINT "notification_delivery_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_jobs" ADD CONSTRAINT "notification_delivery_jobs_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_jobs" ADD CONSTRAINT "notification_delivery_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
