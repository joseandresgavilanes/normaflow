-- Management review hardening: standards, participants, source links,
-- Plan de Acción derivation, evidence links and PDF-ready traceability.

ALTER TYPE "ManagementReviewTopic" ADD VALUE IF NOT EXISTS 'KPI_RESULTS';
ALTER TYPE "ManagementReviewTopic" ADD VALUE IF NOT EXISTS 'RISKS_OPPORTUNITIES';
CREATE TYPE "ManagementReviewParticipantRole" AS ENUM ('ATTENDEE', 'PROCESS_OWNER', 'OBSERVER');

ALTER TABLE "management_reviews"
  ADD COLUMN "standards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "management_review_inputs"
  ADD COLUMN "auditId" TEXT,
  ADD COLUMN "indicatorId" TEXT,
  ADD COLUMN "riskId" TEXT,
  ADD COLUMN "nonconformityId" TEXT,
  ADD COLUMN "actionId" TEXT,
  ADD COLUMN "capaId" TEXT;

ALTER TABLE "actions" ADD COLUMN "managementReviewDecisionId" TEXT;

CREATE TABLE "management_review_participants" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ManagementReviewParticipantRole" NOT NULL DEFAULT 'ATTENDEE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "management_review_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "actions_managementReviewDecisionId_key" ON "actions"("managementReviewDecisionId");
CREATE INDEX "management_review_inputs_reviewId_topic_idx" ON "management_review_inputs"("reviewId", "topic");
CREATE INDEX "management_review_inputs_auditId_idx" ON "management_review_inputs"("auditId");
CREATE INDEX "management_review_inputs_indicatorId_idx" ON "management_review_inputs"("indicatorId");
CREATE INDEX "management_review_inputs_riskId_idx" ON "management_review_inputs"("riskId");
CREATE INDEX "management_review_inputs_nonconformityId_idx" ON "management_review_inputs"("nonconformityId");
CREATE INDEX "management_review_inputs_actionId_idx" ON "management_review_inputs"("actionId");
CREATE INDEX "management_review_inputs_capaId_idx" ON "management_review_inputs"("capaId");
CREATE UNIQUE INDEX "management_review_participants_reviewId_userId_key" ON "management_review_participants"("reviewId", "userId");
CREATE INDEX "management_review_participants_organizationId_reviewId_idx" ON "management_review_participants"("organizationId", "reviewId");
CREATE INDEX "management_review_participants_userId_idx" ON "management_review_participants"("userId");

ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "actions" ADD CONSTRAINT "actions_managementReviewDecisionId_fkey" FOREIGN KEY ("managementReviewDecisionId") REFERENCES "management_review_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "management_review_participants" ADD CONSTRAINT "management_review_participants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "management_review_participants" ADD CONSTRAINT "management_review_participants_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "management_review_participants" ADD CONSTRAINT "management_review_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION nf_validate_management_review_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."chairId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."chairId" AND active) THEN
    RAISE EXCEPTION 'Management review responsible is not an active organization member';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW."standards") code WHERE NOT EXISTS (SELECT 1 FROM organization_standards os JOIN standards s ON s.id = os."standardId" WHERE os."organizationId" = NEW."organizationId" AND s.code = code)) THEN
    RAISE EXCEPTION 'Management review standard is not enabled for the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_management_reviews_tenant_refs ON "management_reviews";
CREATE TRIGGER nf_management_reviews_tenant_refs BEFORE INSERT OR UPDATE ON "management_reviews" FOR EACH ROW EXECUTE FUNCTION nf_validate_management_review_tenant();

CREATE OR REPLACE FUNCTION nf_validate_management_review_input_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE review_org TEXT;
BEGIN
  SELECT "organizationId" INTO review_org FROM management_reviews WHERE id = NEW."reviewId";
  IF review_org IS NULL THEN RAISE EXCEPTION 'Management review parent not found'; END IF;
  IF NEW."auditId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audits WHERE id = NEW."auditId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input audit belongs to another organization'; END IF;
  IF NEW."indicatorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM indicators WHERE id = NEW."indicatorId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input indicator belongs to another organization'; END IF;
  IF NEW."riskId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risks WHERE id = NEW."riskId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input risk belongs to another organization'; END IF;
  IF NEW."nonconformityId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM nonconformities WHERE id = NEW."nonconformityId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input nonconformity belongs to another organization'; END IF;
  IF NEW."actionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM actions WHERE id = NEW."actionId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input action belongs to another organization'; END IF;
  IF NEW."capaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM capas WHERE id = NEW."capaId" AND "organizationId" = review_org) THEN RAISE EXCEPTION 'Review input CAPA belongs to another organization'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_management_review_inputs_tenant_refs ON "management_review_inputs";
CREATE TRIGGER nf_management_review_inputs_tenant_refs BEFORE INSERT OR UPDATE ON "management_review_inputs" FOR EACH ROW EXECUTE FUNCTION nf_validate_management_review_input_tenant();

CREATE OR REPLACE FUNCTION nf_validate_management_review_participant_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM management_reviews r JOIN memberships m ON m."organizationId" = r."organizationId" WHERE r.id = NEW."reviewId" AND NEW."organizationId" = r."organizationId" AND m."userId" = NEW."userId" AND m.active) THEN
    RAISE EXCEPTION 'Management review participant is not an active organization member';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_management_review_participants_tenant_refs ON "management_review_participants";
CREATE TRIGGER nf_management_review_participants_tenant_refs BEFORE INSERT OR UPDATE ON "management_review_participants" FOR EACH ROW EXECUTE FUNCTION nf_validate_management_review_participant_tenant();

CREATE OR REPLACE FUNCTION nf_validate_management_review_action_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE review_org TEXT;
BEGIN
  IF NEW."managementReviewDecisionId" IS NOT NULL THEN
    SELECT r."organizationId" INTO review_org FROM management_review_decisions d JOIN management_reviews r ON r.id = d."reviewId" WHERE d.id = NEW."managementReviewDecisionId";
    IF review_org IS NULL OR review_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Management review decision belongs to another organization'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_actions_management_review_tenant_refs ON "actions";
CREATE TRIGGER nf_actions_management_review_tenant_refs BEFORE INSERT OR UPDATE ON "actions" FOR EACH ROW EXECUTE FUNCTION nf_validate_management_review_action_tenant();

ALTER TABLE "management_review_participants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_management_review_participants_select" ON "management_review_participants" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM management_reviews r WHERE r.id = "reviewId" AND public.nf_has_org_permission(r."organizationId", 'mgmt-review:read')));
CREATE POLICY "nf_management_review_participants_insert" ON "management_review_participants" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM management_reviews r WHERE r.id = "reviewId" AND public.nf_has_org_permission(r."organizationId", 'mgmt-review:create')));
CREATE POLICY "nf_management_review_participants_update" ON "management_review_participants" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM management_reviews r WHERE r.id = "reviewId" AND public.nf_has_org_permission(r."organizationId", 'mgmt-review:update'))) WITH CHECK (EXISTS (SELECT 1 FROM management_reviews r WHERE r.id = "reviewId" AND public.nf_has_org_permission(r."organizationId", 'mgmt-review:update')));
CREATE POLICY "nf_management_review_participants_delete" ON "management_review_participants" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM management_reviews r WHERE r.id = "reviewId" AND public.nf_has_org_permission(r."organizationId", 'mgmt-review:delete')));
