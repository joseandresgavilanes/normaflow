-- Stripe billing hardening: idempotent webhook inbox and USD defaults.
ALTER TABLE "billing_invoices" ALTER COLUMN "currency" SET DEFAULT 'usd';

CREATE TABLE "stripe_webhook_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");
CREATE INDEX "stripe_webhook_events_type_createdAt_idx" ON "stripe_webhook_events"("type", "createdAt");
CREATE INDEX "stripe_webhook_events_processedAt_idx" ON "stripe_webhook_events"("processedAt");

ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_stripe_webhook_events_no_client_select" ON "stripe_webhook_events"
  FOR SELECT TO authenticated USING (false);
