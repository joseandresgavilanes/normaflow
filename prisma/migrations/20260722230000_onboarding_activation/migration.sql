-- Persisted onboarding state and activation events for trial conversion.
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "OnboardingGoal" AS ENUM ('CERTIFY', 'MAINTAIN_CERTIFICATION', 'AUDIT_PREPARATION', 'ORGANIZE_DOCUMENTS_EVIDENCE');

ALTER TABLE "organizations"
  ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingGoal" "OnboardingGoal",
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "activationAt" TIMESTAMP(3);

CREATE TABLE "onboarding_metric_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "event" TEXT NOT NULL,
  "step" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_metric_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_metric_events_organizationId_event_createdAt_idx"
  ON "onboarding_metric_events"("organizationId", "event", "createdAt");
CREATE INDEX "onboarding_metric_events_userId_createdAt_idx"
  ON "onboarding_metric_events"("userId", "createdAt");

ALTER TABLE "onboarding_metric_events"
  ADD CONSTRAINT "onboarding_metric_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_metric_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_metric_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_onboarding_metric_events_select" ON "onboarding_metric_events"
  FOR SELECT TO authenticated
  USING (nf_has_org_permission("organizationId", 'dashboard:read'));
CREATE POLICY "nf_onboarding_metric_events_insert" ON "onboarding_metric_events"
  FOR INSERT TO authenticated
  WITH CHECK (nf_has_org_permission("organizationId", 'dashboard:read'));
