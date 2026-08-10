-- ISO 13485: reinforced privacy/retention for vigilance records.
--
-- 1) Post-market surveillance findings carry the same "no unnecessary
--    personal data" guard as Complaint/AdverseEvent (assertNoUnnecessaryPersonalData
--    is already applied to PMS.findings in the app layer) but its RLS was left
--    on the generic medical-devices:* bucket instead of md-sensitive:* — meaning
--    any CONTRIBUTOR/VIEWER with plain medical-devices:read could read it, unlike
--    the other three vigilance tables. Reclassify it to match.
-- 2) Configurable retention for complaint/adverse-event records: a per-org
--    MdRetentionPolicy row + retentionUntil/purgedAt on both tables.

CREATE TABLE "md_retention_policies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "retentionYears" INTEGER NOT NULL DEFAULT 15,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_retention_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "md_retention_policies_organizationId_key" ON "md_retention_policies"("organizationId");
ALTER TABLE "md_retention_policies" ADD CONSTRAINT "md_retention_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_retention_policies" ADD CONSTRAINT "md_retention_policies_years_positive" CHECK ("retentionYears" > 0);

ALTER TABLE "md_complaints" ADD COLUMN "retentionUntil" TIMESTAMP(3);
ALTER TABLE "md_complaints" ADD COLUMN "purgedAt" TIMESTAMP(3);
ALTER TABLE "md_adverse_events" ADD COLUMN "retentionUntil" TIMESTAMP(3);
ALTER TABLE "md_adverse_events" ADD COLUMN "purgedAt" TIMESTAMP(3);

ALTER TABLE "md_retention_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_md_retention_policies_select" ON "md_retention_policies"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'medical-devices:read'));
CREATE POLICY "nf_md_retention_policies_insert" ON "md_retention_policies"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'medical-devices:approve'));
CREATE POLICY "nf_md_retention_policies_update" ON "md_retention_policies"
  FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'medical-devices:approve')) WITH CHECK (public.nf_has_org_permission("organizationId", 'medical-devices:approve'));
CREATE POLICY "nf_md_retention_policies_delete" ON "md_retention_policies"
  FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'medical-devices:approve'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."md_retention_policies" TO authenticated;
  END IF;
END $$;

-- Reclassify md_post_market_surveillances: medical-devices:* -> md-sensitive:*
DROP POLICY IF EXISTS "nf_md_post_market_surveillances_select" ON "md_post_market_surveillances";
DROP POLICY IF EXISTS "nf_md_post_market_surveillances_insert" ON "md_post_market_surveillances";
DROP POLICY IF EXISTS "nf_md_post_market_surveillances_update" ON "md_post_market_surveillances";
DROP POLICY IF EXISTS "nf_md_post_market_surveillances_delete" ON "md_post_market_surveillances";

CREATE POLICY "nf_md_post_market_surveillances_select" ON "md_post_market_surveillances"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'md-sensitive:read'));
CREATE POLICY "nf_md_post_market_surveillances_insert" ON "md_post_market_surveillances"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'md-sensitive:create'));
CREATE POLICY "nf_md_post_market_surveillances_update" ON "md_post_market_surveillances"
  FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'md-sensitive:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'md-sensitive:update'));
CREATE POLICY "nf_md_post_market_surveillances_delete" ON "md_post_market_surveillances"
  FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'md-sensitive:delete'));

-- Purge guard: only a closed, retention-expired, not-already-purged record may be purged.
ALTER TABLE "md_complaints" ADD CONSTRAINT "md_complaint_purge_after_retention" CHECK ("purgedAt" IS NULL OR ("closedAt" IS NOT NULL AND "retentionUntil" IS NOT NULL AND "purgedAt" >= "retentionUntil"));
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_ae_purge_after_retention" CHECK ("purgedAt" IS NULL OR ("closedAt" IS NOT NULL AND "retentionUntil" IS NOT NULL AND "purgedAt" >= "retentionUntil"));
