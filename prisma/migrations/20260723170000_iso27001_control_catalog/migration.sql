-- ISO/IEC 27001:2022 Annex A operational catalog.
-- Only identifiers and product-owned metadata are stored by the seed.

CREATE TYPE "ControlCatalogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "SecurityControlDomain" AS ENUM ('ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL');
CREATE TYPE "ControlApplicability" AS ENUM ('INCLUDED', 'EXCLUDED', 'UNDER_REVIEW');
CREATE TYPE "OrganizationControlStatus" AS ENUM ('NOT_ASSESSED', 'NOT_IMPLEMENTED', 'PLANNED', 'PARTIALLY_IMPLEMENTED', 'IMPLEMENTED', 'EFFECTIVE', 'NOT_EFFECTIVE');
CREATE TYPE "ControlEvidenceStatus" AS ENUM ('PENDING_VALIDATION', 'VALID', 'INVALID', 'EXPIRED');
CREATE TYPE "ControlReviewResult" AS ENUM ('NOT_ASSESSED', 'CONFORMING', 'PARTIALLY_CONFORMING', 'NONCONFORMING');
CREATE TYPE "ControlEffectiveness" AS ENUM ('NOT_TESTED', 'EFFECTIVE', 'INEFFECTIVE');

CREATE TABLE "control_catalog_versions" (
  "id" TEXT NOT NULL,
  "standardId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "catalogDate" TIMESTAMP(3) NOT NULL,
  "status" "ControlCatalogStatus" NOT NULL DEFAULT 'DRAFT',
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_catalog_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "security_controls" (
  "id" TEXT NOT NULL,
  "catalogVersionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "domain" "SecurityControlDomain" NOT NULL,
  "title" TEXT NOT NULL,
  "descriptionInternal" TEXT,
  "objective" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_controls_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "organization_controls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "applicability" "ControlApplicability" NOT NULL DEFAULT 'UNDER_REVIEW',
  "status" "OrganizationControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "responsibleId" TEXT,
  "reviewDate" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "implementationLevel" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_controls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_controls_implementationLevel_check" CHECK ("implementationLevel" BETWEEN 0 AND 100)
);
CREATE TABLE "control_evidences" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "organizationControlId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "status" "ControlEvidenceStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "validatorId" TEXT,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_evidences_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "control_reviews" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "organizationControlId" TEXT NOT NULL,
  "result" "ControlReviewResult" NOT NULL,
  "effectiveness" "ControlEffectiveness" NOT NULL,
  "comments" TEXT,
  "reviewerId" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_reviews_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "risk_control_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "organizationControlId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expectedEffectiveness" TEXT,
  "observedEffectiveness" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_control_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "control_catalog_versions_standardId_version_key" ON "control_catalog_versions"("standardId", "version");
CREATE INDEX "control_catalog_versions_standardId_active_idx" ON "control_catalog_versions"("standardId", "active");
CREATE UNIQUE INDEX "security_controls_catalogVersionId_code_key" ON "security_controls"("catalogVersionId", "code");
CREATE INDEX "security_controls_domain_active_idx" ON "security_controls"("domain", "active");
CREATE UNIQUE INDEX "organization_controls_organizationId_controlId_key" ON "organization_controls"("organizationId", "controlId");
CREATE INDEX "organization_controls_organizationId_status_idx" ON "organization_controls"("organizationId", "status");
CREATE INDEX "organization_controls_organizationId_applicability_idx" ON "organization_controls"("organizationId", "applicability");
CREATE INDEX "organization_controls_organizationId_nextReviewDate_idx" ON "organization_controls"("organizationId", "nextReviewDate");
CREATE UNIQUE INDEX "control_evidences_organizationControlId_evidenceId_period_key" ON "control_evidences"("organizationControlId", "evidenceId", "period");
CREATE INDEX "control_evidences_organizationId_status_idx" ON "control_evidences"("organizationId", "status");
CREATE INDEX "control_evidences_organizationId_evidenceId_idx" ON "control_evidences"("organizationId", "evidenceId");
CREATE INDEX "control_reviews_organizationId_organizationControlId_reviewedAt_idx" ON "control_reviews"("organizationId", "organizationControlId", "reviewedAt");
CREATE UNIQUE INDEX "risk_control_links_riskId_organizationControlId_key" ON "risk_control_links"("riskId", "organizationControlId");
CREATE INDEX "risk_control_links_organizationId_organizationControlId_idx" ON "risk_control_links"("organizationId", "organizationControlId");

GRANT SELECT ON TABLE "control_catalog_versions", "security_controls" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organization_controls", "control_evidences", "control_reviews", "risk_control_links" TO authenticated;

ALTER TABLE "control_catalog_versions" ADD CONSTRAINT "control_catalog_versions_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "security_controls" ADD CONSTRAINT "security_controls_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "control_catalog_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_controls" ADD CONSTRAINT "organization_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_controls" ADD CONSTRAINT "organization_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "security_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_controls" ADD CONSTRAINT "organization_controls_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_evidences" ADD CONSTRAINT "control_evidences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_evidences" ADD CONSTRAINT "control_evidences_organizationControlId_fkey" FOREIGN KEY ("organizationControlId") REFERENCES "organization_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_evidences" ADD CONSTRAINT "control_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_evidences" ADD CONSTRAINT "control_evidences_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_reviews" ADD CONSTRAINT "control_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_reviews" ADD CONSTRAINT "control_reviews_organizationControlId_fkey" FOREIGN KEY ("organizationControlId") REFERENCES "organization_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_reviews" ADD CONSTRAINT "control_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_organizationControlId_fkey" FOREIGN KEY ("organizationControlId") REFERENCES "organization_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database-level tenant consistency for direct Supabase writes.
CREATE OR REPLACE FUNCTION public.nf_validate_security_control_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'control_evidences' THEN
    SELECT "organizationId" INTO target_org FROM organization_controls WHERE id = NEW."organizationControlId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Control evidence control belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Control evidence file belongs to another organization'; END IF;
    IF NEW."validatorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."validatorId" AND active) THEN RAISE EXCEPTION 'Control evidence validator is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'control_reviews' THEN
    SELECT "organizationId" INTO target_org FROM organization_controls WHERE id = NEW."organizationControlId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Control review belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."reviewerId" AND active) THEN RAISE EXCEPTION 'Control reviewer is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'risk_control_links' THEN
    SELECT "organizationId" INTO target_org FROM organization_controls WHERE id = NEW."organizationControlId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Risk control belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM risks WHERE id = NEW."riskId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk belongs to another organization'; END IF;
  ELSE
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Responsible user is not an active organization member'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_organization_controls_tenant_refs ON organization_controls;
CREATE TRIGGER nf_organization_controls_tenant_refs BEFORE INSERT OR UPDATE ON organization_controls FOR EACH ROW EXECUTE FUNCTION public.nf_validate_security_control_tenant();
DROP TRIGGER IF EXISTS nf_control_evidences_tenant_refs ON control_evidences;
CREATE TRIGGER nf_control_evidences_tenant_refs BEFORE INSERT OR UPDATE ON control_evidences FOR EACH ROW EXECUTE FUNCTION public.nf_validate_security_control_tenant();
DROP TRIGGER IF EXISTS nf_control_reviews_tenant_refs ON control_reviews;
CREATE TRIGGER nf_control_reviews_tenant_refs BEFORE INSERT OR UPDATE ON control_reviews FOR EACH ROW EXECUTE FUNCTION public.nf_validate_security_control_tenant();
DROP TRIGGER IF EXISTS nf_risk_control_links_tenant_refs ON risk_control_links;
CREATE TRIGGER nf_risk_control_links_tenant_refs BEFORE INSERT OR UPDATE ON risk_control_links FOR EACH ROW EXECUTE FUNCTION public.nf_validate_security_control_tenant();

ALTER TABLE "control_catalog_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_control_catalog_versions_select" ON "control_catalog_versions" FOR SELECT TO authenticated USING ("active" AND "status" = 'PUBLISHED');
ALTER TABLE "security_controls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_security_controls_select" ON "security_controls" FOR SELECT TO authenticated USING ("active" AND EXISTS (SELECT 1 FROM control_catalog_versions v WHERE v.id = "catalogVersionId" AND v."active" AND v."status" = 'PUBLISHED'));

ALTER TABLE "organization_controls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_organization_controls_select" ON "organization_controls" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:read'));
CREATE POLICY "nf_organization_controls_insert" ON "organization_controls" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:create'));
CREATE POLICY "nf_organization_controls_update" ON "organization_controls" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:update'));
CREATE POLICY "nf_organization_controls_delete" ON "organization_controls" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:delete'));

ALTER TABLE "control_evidences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_control_evidences_select" ON "control_evidences" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:read'));
CREATE POLICY "nf_control_evidences_insert" ON "control_evidences" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:update'));
CREATE POLICY "nf_control_evidences_update" ON "control_evidences" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:approve')) WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:approve'));
CREATE POLICY "nf_control_evidences_delete" ON "control_evidences" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:update'));

ALTER TABLE "control_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_control_reviews_select" ON "control_reviews" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:read'));
CREATE POLICY "nf_control_reviews_insert" ON "control_reviews" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:approve'));
CREATE POLICY "nf_control_reviews_update" ON "control_reviews" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:approve')) WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:approve'));
CREATE POLICY "nf_control_reviews_delete" ON "control_reviews" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:delete'));

ALTER TABLE "risk_control_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_control_links_select" ON "risk_control_links" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:read'));
CREATE POLICY "nf_risk_control_links_insert" ON "risk_control_links" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:update'));
CREATE POLICY "nf_risk_control_links_update" ON "risk_control_links" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'security-controls:update'));
CREATE POLICY "nf_risk_control_links_delete" ON "risk_control_links" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'security-controls:update'));

-- Keep Supabase direct authorization aligned with the server matrix for this module.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
