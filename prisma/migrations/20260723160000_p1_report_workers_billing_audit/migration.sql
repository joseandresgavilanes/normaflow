-- P1: durable report jobs, billing grace periods and append-only audit trail.

ALTER TABLE "report_exports"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leaseToken" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "report_exports_organizationId_idempotencyKey_key"
  ON "report_exports"("organizationId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "report_exports_status_nextAttemptAt_idx"
  ON "report_exports"("status", "nextAttemptAt");

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPaymentFailedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionStatus') AND enumlabel = 'GRACE_PERIOD') THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'GRACE_PERIOD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionStatus') AND enumlabel = 'SUSPENDED') THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.nf_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; UPDATE and DELETE are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS nf_audit_logs_append_only ON public."audit_logs";
CREATE TRIGGER nf_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public."audit_logs"
  FOR EACH ROW EXECUTE FUNCTION public.nf_audit_log_append_only();

DROP POLICY IF EXISTS "nf_audit_logs_mutation_block" ON public."audit_logs";
CREATE POLICY "nf_audit_logs_mutation_block"
  ON public."audit_logs"
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);
CREATE POLICY "nf_audit_logs_delete_block"
  ON public."audit_logs"
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE public."audit_logs" IS
  'Append-only operational traceability. It is not, by itself, legally certified evidence.';
