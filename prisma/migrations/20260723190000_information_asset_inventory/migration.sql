-- ISO/IEC 27001:2022 information asset inventory (Annex A 5.9-5.13).
-- Assets with owner/custodian, CIA classification, dependencies, associated
-- risks and Annex A controls; multi-tenant with RLS and tenant triggers.

CREATE TYPE "AssetCategory" AS ENUM ('INFORMATION', 'SOFTWARE', 'HARDWARE', 'SERVICES', 'PEOPLE', 'FACILITIES', 'SUPPLIERS');
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'INACTIVE', 'RETIRED');
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "CIARating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "InformationClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "AssetDependencyType" AS ENUM ('DEPENDS_ON', 'SUPPORTS', 'PROCESSES', 'STORES', 'HOSTS', 'BACKS_UP');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "information_assets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "AssetCategory" NOT NULL,
  "ownerId" TEXT,
  "custodianId" TEXT,
  "processId" TEXT,
  "locationId" TEXT,
  "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
  "reviewDate" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "information_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_classifications" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "confidentiality" "CIARating" NOT NULL DEFAULT 'MEDIUM',
  "integrity" "CIARating" NOT NULL DEFAULT 'MEDIUM',
  "availability" "CIARating" NOT NULL DEFAULT 'MEDIUM',
  "classification" "InformationClassification" NOT NULL DEFAULT 'INTERNAL',
  "legalRequirements" TEXT,
  "retention" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_classifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_dependencies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceAssetId" TEXT NOT NULL,
  "dependentAssetId" TEXT NOT NULL,
  "type" "AssetDependencyType" NOT NULL DEFAULT 'DEPENDS_ON',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_dependencies_not_self_check" CHECK ("sourceAssetId" <> "dependentAssetId")
);

CREATE TABLE "asset_risks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "riskId" TEXT,
  "threat" TEXT,
  "vulnerability" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_controls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "organizationControlId" TEXT NOT NULL,
  "status" "OrganizationControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "evidenceId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_controls_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────

CREATE UNIQUE INDEX "information_assets_organizationId_code_key" ON "information_assets"("organizationId", "code");
CREATE INDEX "information_assets_organizationId_category_idx" ON "information_assets"("organizationId", "category");
CREATE INDEX "information_assets_organizationId_status_idx" ON "information_assets"("organizationId", "status");
CREATE INDEX "information_assets_organizationId_criticality_idx" ON "information_assets"("organizationId", "criticality");
CREATE INDEX "information_assets_organizationId_nextReviewDate_idx" ON "information_assets"("organizationId", "nextReviewDate");
CREATE UNIQUE INDEX "asset_classifications_assetId_key" ON "asset_classifications"("assetId");
CREATE INDEX "asset_classifications_organizationId_classification_idx" ON "asset_classifications"("organizationId", "classification");
CREATE UNIQUE INDEX "asset_dependencies_sourceAssetId_dependentAssetId_key" ON "asset_dependencies"("sourceAssetId", "dependentAssetId");
CREATE INDEX "asset_dependencies_organizationId_sourceAssetId_idx" ON "asset_dependencies"("organizationId", "sourceAssetId");
CREATE INDEX "asset_risks_organizationId_assetId_idx" ON "asset_risks"("organizationId", "assetId");
CREATE UNIQUE INDEX "asset_controls_assetId_organizationControlId_key" ON "asset_controls"("assetId", "organizationControlId");
CREATE INDEX "asset_controls_organizationId_assetId_idx" ON "asset_controls"("organizationId", "assetId");

-- ─── GRANTS ──────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "information_assets", "asset_classifications", "asset_dependencies", "asset_risks", "asset_controls"
  TO authenticated;

-- ─── FOREIGN KEYS ────────────────────────────────────

ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_classifications" ADD CONSTRAINT "asset_classifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_classifications" ADD CONSTRAINT "asset_classifications_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_dependencies" ADD CONSTRAINT "asset_dependencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_dependencies" ADD CONSTRAINT "asset_dependencies_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_dependencies" ADD CONSTRAINT "asset_dependencies_dependentAssetId_fkey" FOREIGN KEY ("dependentAssetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_risks" ADD CONSTRAINT "asset_risks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_risks" ADD CONSTRAINT "asset_risks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_risks" ADD CONSTRAINT "asset_risks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_controls" ADD CONSTRAINT "asset_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_controls" ADD CONSTRAINT "asset_controls_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_controls" ADD CONSTRAINT "asset_controls_organizationControlId_fkey" FOREIGN KEY ("organizationControlId") REFERENCES "organization_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_controls" ADD CONSTRAINT "asset_controls_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── DATABASE-LEVEL TENANT CONSISTENCY (direct Supabase writes) ──
CREATE OR REPLACE FUNCTION public.nf_validate_asset_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'information_assets' THEN
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'Asset owner is not an active organization member'; END IF;
    IF NEW."custodianId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."custodianId" AND active) THEN RAISE EXCEPTION 'Asset custodian is not an active organization member'; END IF;
    IF NEW."processId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Asset process belongs to another organization'; END IF;
    IF NEW."locationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW."locationId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Asset location belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'asset_classifications' THEN
    SELECT "organizationId" INTO target_org FROM information_assets WHERE id = NEW."assetId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Asset classification belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'asset_dependencies' THEN
    SELECT "organizationId" INTO target_org FROM information_assets WHERE id = NEW."sourceAssetId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Asset dependency source belongs to another organization'; END IF;
    SELECT "organizationId" INTO target_org FROM information_assets WHERE id = NEW."dependentAssetId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Asset dependency target belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'asset_risks' THEN
    SELECT "organizationId" INTO target_org FROM information_assets WHERE id = NEW."assetId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Asset risk asset belongs to another organization'; END IF;
    IF NEW."riskId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risks WHERE id = NEW."riskId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Asset risk linked risk belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'asset_controls' THEN
    SELECT "organizationId" INTO target_org FROM information_assets WHERE id = NEW."assetId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Asset control asset belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM organization_controls WHERE id = NEW."organizationControlId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Asset control belongs to another organization'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Asset control evidence belongs to another organization'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nf_information_assets_tenant_refs ON information_assets;
CREATE TRIGGER nf_information_assets_tenant_refs BEFORE INSERT OR UPDATE ON information_assets FOR EACH ROW EXECUTE FUNCTION public.nf_validate_asset_tenant();
DROP TRIGGER IF EXISTS nf_asset_classifications_tenant_refs ON asset_classifications;
CREATE TRIGGER nf_asset_classifications_tenant_refs BEFORE INSERT OR UPDATE ON asset_classifications FOR EACH ROW EXECUTE FUNCTION public.nf_validate_asset_tenant();
DROP TRIGGER IF EXISTS nf_asset_dependencies_tenant_refs ON asset_dependencies;
CREATE TRIGGER nf_asset_dependencies_tenant_refs BEFORE INSERT OR UPDATE ON asset_dependencies FOR EACH ROW EXECUTE FUNCTION public.nf_validate_asset_tenant();
DROP TRIGGER IF EXISTS nf_asset_risks_tenant_refs ON asset_risks;
CREATE TRIGGER nf_asset_risks_tenant_refs BEFORE INSERT OR UPDATE ON asset_risks FOR EACH ROW EXECUTE FUNCTION public.nf_validate_asset_tenant();
DROP TRIGGER IF EXISTS nf_asset_controls_tenant_refs ON asset_controls;
CREATE TRIGGER nf_asset_controls_tenant_refs BEFORE INSERT OR UPDATE ON asset_controls FOR EACH ROW EXECUTE FUNCTION public.nf_validate_asset_tenant();

-- ─── ROW LEVEL SECURITY ──────────────────────────────

ALTER TABLE "information_assets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_information_assets_select" ON "information_assets" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:read'));
CREATE POLICY "nf_information_assets_insert" ON "information_assets" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:create'));
CREATE POLICY "nf_information_assets_update" ON "information_assets" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_information_assets_delete" ON "information_assets" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:delete'));

ALTER TABLE "asset_classifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_asset_classifications_select" ON "asset_classifications" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:read'));
CREATE POLICY "nf_asset_classifications_insert" ON "asset_classifications" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_classifications_update" ON "asset_classifications" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_classifications_delete" ON "asset_classifications" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:delete'));

ALTER TABLE "asset_dependencies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_asset_dependencies_select" ON "asset_dependencies" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:read'));
CREATE POLICY "nf_asset_dependencies_insert" ON "asset_dependencies" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_dependencies_update" ON "asset_dependencies" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_dependencies_delete" ON "asset_dependencies" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update'));

ALTER TABLE "asset_risks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_asset_risks_select" ON "asset_risks" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:read'));
CREATE POLICY "nf_asset_risks_insert" ON "asset_risks" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_risks_update" ON "asset_risks" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_risks_delete" ON "asset_risks" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update'));

ALTER TABLE "asset_controls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_asset_controls_select" ON "asset_controls" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:read'));
CREATE POLICY "nf_asset_controls_insert" ON "asset_controls" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_controls_update" ON "asset_controls" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'assets:update'));
CREATE POLICY "nf_asset_controls_delete" ON "asset_controls" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'assets:update'));

-- Keep Supabase direct authorization aligned with the server matrix: add the
-- assets:* module to every role (carries forward security-controls/soa/risk-treatment).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
