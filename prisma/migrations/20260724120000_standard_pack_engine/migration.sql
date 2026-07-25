-- Standard Pack Engine — expand → backfill → contract.
--
-- Data-preserving refactor of the former `standards` / `clauses` tables into the
-- normalized StandardFamily → StandardEdition → StandardRequirement spine, plus
-- the pack/mapping/rule/template/coverage tables. Tables are RENAMED (not dropped)
-- and existing rows — including the deterministic `cl-...` requirement ids — are
-- preserved. Every FK that pointed at `standards`/`clauses` follows the rename
-- automatically and keeps its Prisma-conventional name (column names unchanged).

-- ─── 1. ENUMS ────────────────────────────────────────
CREATE TYPE "StandardFamilyStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'ARCHIVED');
CREATE TYPE "StandardEditionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "ImplementationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'CERTIFIED', 'SUSPENDED');
CREATE TYPE "RequirementRelationType" AS ENUM ('EQUIVALENT', 'PARTIAL', 'RELATED', 'SUPERSEDES');
CREATE TYPE "EvidenceFrequency" AS ENUM ('ON_DEMAND', 'ONCE', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
CREATE TYPE "TemplateType" AS ENUM ('DOCUMENT', 'POLICY', 'PROCEDURE', 'RECORD', 'CHECKLIST', 'GAP', 'OTHER');
CREATE TYPE "CoverageEntityType" AS ENUM ('DOCUMENT', 'RISK', 'EVIDENCE', 'INDICATOR', 'AUDIT', 'CAPA', 'RECORD', 'PROCESS');

-- ─── 2. STANDARD FAMILIES (new) ──────────────────────
CREATE TABLE "standard_families" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "status" "StandardFamilyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "standard_families_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "standard_families_code_key" ON "standard_families"("code");

-- ─── 3. standards → standard_editions (rename + expand) ──
ALTER TABLE "standards" RENAME TO "standard_editions";
ALTER TABLE "standard_editions" RENAME CONSTRAINT "standards_pkey" TO "standard_editions_pkey";
-- Edition uniqueness moves from a global code to (familyId, editionCode); `code`
-- stays equal to the family code so every existing `.standard.code` reader is valid.
DROP INDEX "standards_code_key";

ALTER TABLE "standard_editions"
  ADD COLUMN "familyId" TEXT,
  ADD COLUMN "editionCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "status" "StandardEditionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "catalogVersion" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: one family per existing standard (old code, e.g. ISO_9001), then
-- promote the edition to an edition-level code (ISO_9001:2015). RHS of the UPDATE
-- reads pre-update row values, so 'fam-'||code matches the family just inserted.
INSERT INTO "standard_families" ("id", "code", "name", "category", "description", "status", "createdAt", "updatedAt")
SELECT 'fam-' || e."code", e."code", e."name", NULL, e."description", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "standard_editions" e;

UPDATE "standard_editions" e SET
  "familyId"    = 'fam-' || e."code",
  "editionCode" = e."version",
  "year"        = NULLIF(regexp_replace(e."version", '\D', '', 'g'), '')::INTEGER;

ALTER TABLE "standard_editions" ALTER COLUMN "familyId" SET NOT NULL;
CREATE UNIQUE INDEX "standard_editions_familyId_editionCode_key" ON "standard_editions"("familyId", "editionCode");
CREATE INDEX "standard_editions_familyId_status_idx" ON "standard_editions"("familyId", "status");
CREATE INDEX "standard_editions_code_idx" ON "standard_editions"("code");
ALTER TABLE "standard_editions"
  ADD CONSTRAINT "standard_editions_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "standard_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 4. clauses → standard_requirements (rename + expand) ──
ALTER TABLE "clauses" RENAME TO "standard_requirements";
ALTER TABLE "standard_requirements" RENAME CONSTRAINT "clauses_pkey" TO "standard_requirements_pkey";
ALTER TABLE "standard_requirements" RENAME CONSTRAINT "clauses_standardId_fkey" TO "standard_requirements_standardId_fkey";
ALTER TABLE "standard_requirements" RENAME CONSTRAINT "clauses_parentId_fkey" TO "standard_requirements_parentId_fkey";

ALTER TABLE "standard_requirements"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "mandatory" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Derive level from the dotted clause code depth (4 → 1, 4.1 → 2, 6.1.2 → 3).
UPDATE "standard_requirements"
SET "level" = array_length(string_to_array("code", '.'), 1);

CREATE INDEX "standard_requirements_standardId_active_idx" ON "standard_requirements"("standardId", "active");
CREATE INDEX "standard_requirements_parentId_idx" ON "standard_requirements"("parentId");

-- ─── 5. organization_standards enrichment ────────────
ALTER TABLE "organization_standards"
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "responsibleId" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "implementationStatus" "ImplementationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "certified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "certBody" TEXT,
  ADD COLUMN "certExpiresAt" TIMESTAMP(3),
  ADD COLUMN "nextAuditDate" TIMESTAMP(3),
  ADD COLUMN "sourcePackId" TEXT;

CREATE INDEX "organization_standards_org_implStatus_idx" ON "organization_standards"("organizationId", "implementationStatus");
CREATE INDEX "organization_standards_sourcePackId_idx" ON "organization_standards"("sourcePackId");

-- ─── 6. STANDARD PACKS & CROSS-STANDARD FABRIC (new) ──
CREATE TABLE "standard_packs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "description" TEXT,
  "requiredModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "featureFlags" JSONB,
  "status" "StandardEditionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "standard_packs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "standard_packs_code_key" ON "standard_packs"("code");

CREATE TABLE "standard_pack_editions" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  CONSTRAINT "standard_pack_editions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "standard_pack_editions_packId_editionId_key" ON "standard_pack_editions"("packId", "editionId");
CREATE INDEX "standard_pack_editions_editionId_idx" ON "standard_pack_editions"("editionId");

CREATE TABLE "requirement_mappings" (
  "id" TEXT NOT NULL,
  "sourceRequirementId" TEXT NOT NULL,
  "targetRequirementId" TEXT NOT NULL,
  "relationType" "RequirementRelationType" NOT NULL DEFAULT 'RELATED',
  "equivalencePercent" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "requirement_mappings_src_tgt_key" ON "requirement_mappings"("sourceRequirementId", "targetRequirementId");
CREATE INDEX "requirement_mappings_targetRequirementId_idx" ON "requirement_mappings"("targetRequirementId");

CREATE TABLE "requirement_evidence_rules" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "expectedType" "EvidenceType" NOT NULL DEFAULT 'OTHER',
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "frequency" "EvidenceFrequency" NOT NULL DEFAULT 'ON_DEMAND',
  "retentionMonths" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_evidence_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "requirement_evidence_rules_requirementId_idx" ON "requirement_evidence_rules"("requirementId");

CREATE TABLE "gap_question_templates" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "guidance" TEXT,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "options" JSONB,
  "version" TEXT NOT NULL DEFAULT '1',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gap_question_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gap_question_templates_requirementId_active_idx" ON "gap_question_templates"("requirementId", "active");

CREATE TABLE "audit_checklist_templates" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "expectedEvidence" TEXT,
  "criterion" TEXT,
  "version" TEXT NOT NULL DEFAULT '1',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_checklist_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_checklist_templates_requirementId_active_idx" ON "audit_checklist_templates"("requirementId", "active");

CREATE TABLE "standard_templates" (
  "id" TEXT NOT NULL,
  "editionId" TEXT,
  "requirementId" TEXT,
  "templateType" "TemplateType" NOT NULL DEFAULT 'DOCUMENT',
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "standard_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "standard_templates_editionId_templateType_idx" ON "standard_templates"("editionId", "templateType");
CREATE INDEX "standard_templates_requirementId_idx" ON "standard_templates"("requirementId");

CREATE TABLE "requirement_coverage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "entityType" "CoverageEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "coverageType" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_coverage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "requirement_coverage_unique" ON "requirement_coverage"("organizationId", "requirementId", "entityType", "entityId");
CREATE INDEX "requirement_coverage_org_entity_idx" ON "requirement_coverage"("organizationId", "entityType", "entityId");
CREATE INDEX "requirement_coverage_requirementId_idx" ON "requirement_coverage"("requirementId");

-- ─── 7. FOREIGN KEYS (new relations) ─────────────────
ALTER TABLE "organization_standards"
  ADD CONSTRAINT "organization_standards_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_standards_sourcePackId_fkey" FOREIGN KEY ("sourcePackId") REFERENCES "standard_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "standard_pack_editions"
  ADD CONSTRAINT "standard_pack_editions_packId_fkey" FOREIGN KEY ("packId") REFERENCES "standard_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "standard_pack_editions_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "standard_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "requirement_mappings"
  ADD CONSTRAINT "requirement_mappings_sourceRequirementId_fkey" FOREIGN KEY ("sourceRequirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "requirement_mappings_targetRequirementId_fkey" FOREIGN KEY ("targetRequirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "requirement_evidence_rules"
  ADD CONSTRAINT "requirement_evidence_rules_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gap_question_templates"
  ADD CONSTRAINT "gap_question_templates_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_checklist_templates"
  ADD CONSTRAINT "audit_checklist_templates_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "standard_templates"
  ADD CONSTRAINT "standard_templates_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "standard_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "standard_templates_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "requirement_coverage"
  ADD CONSTRAINT "requirement_coverage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "requirement_coverage_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "requirement_coverage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 8. GRANTS + ROW LEVEL SECURITY ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Global catalog: read-only to tenants (writes go through the Prisma owner / service role).
    GRANT SELECT ON TABLE
      public."standard_families", public."standard_editions", public."standard_requirements",
      public."standard_packs", public."standard_pack_editions", public."requirement_mappings",
      public."requirement_evidence_rules", public."gap_question_templates",
      public."audit_checklist_templates", public."standard_templates"
      TO authenticated;
    -- Tenant-scoped coverage fabric: full DML, gated by RLS below.
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."requirement_coverage" TO authenticated;
  END IF;
END
$$;

-- requirement_coverage is org-scoped: reads need standards:read, writes need standards:activate.
ALTER TABLE "requirement_coverage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_requirement_coverage_select" ON "requirement_coverage";
DROP POLICY IF EXISTS "nf_requirement_coverage_insert" ON "requirement_coverage";
DROP POLICY IF EXISTS "nf_requirement_coverage_update" ON "requirement_coverage";
DROP POLICY IF EXISTS "nf_requirement_coverage_delete" ON "requirement_coverage";
CREATE POLICY "nf_requirement_coverage_select" ON "requirement_coverage"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'standards:read'));
CREATE POLICY "nf_requirement_coverage_insert" ON "requirement_coverage"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'standards:activate'));
CREATE POLICY "nf_requirement_coverage_update" ON "requirement_coverage"
  FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'standards:activate'))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'standards:activate'));
CREATE POLICY "nf_requirement_coverage_delete" ON "requirement_coverage"
  FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'standards:activate'));

-- Keep Supabase direct authorization aligned with the server matrix: add
-- standards:* (read/activate/admin) and packs:* (carries forward all prior modules).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;

-- ─── 9. RECREATE TRIGGER FUNCTIONS THAT REFERENCED THE OLD TABLE NAMES ──
-- These tenant-validation trigger functions embed the table names in their
-- bodies; the rename above would otherwise leave them pointing at the dropped
-- `clauses`/`standards` relations. Column names are unchanged, and edition.code
-- still equals the family code, so only the table references change.

CREATE OR REPLACE FUNCTION public.nf_validate_audit_checklist_tenant()
 RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE audit_org TEXT;
BEGIN
  SELECT "organizationId" INTO audit_org FROM audits WHERE id = NEW."auditId";
  IF audit_org IS NULL THEN RAISE EXCEPTION 'Audit checklist parent not found'; END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM standard_requirements c JOIN organization_standards os ON os."standardId" = c."standardId" WHERE c.id = NEW."clauseId" AND os."organizationId" = audit_org) THEN
    RAISE EXCEPTION 'Checklist clause belongs to another organization';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.nf_validate_audit_tenant()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW."processId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit process belongs to another organization';
  END IF;
  IF NEW."programId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_programs WHERE id = NEW."programId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit program belongs to another organization';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM standard_requirements c JOIN organization_standards os ON os."standardId" = c."standardId" WHERE c.id = NEW."clauseId" AND os."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit clause belongs to another organization';
  END IF;
  IF NEW."auditorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."auditorId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'Audit auditor is not a member of the organization';
  END IF;
  IF NEW."closedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."closedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'Audit closer is not a member of the organization';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.nf_validate_capa_tenant()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW."processId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA process belongs to another organization';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM standard_requirements c JOIN organization_standards os ON os."standardId" = c."standardId"
    WHERE c.id = NEW."clauseId" AND os."organizationId" = NEW."organizationId"
  ) THEN RAISE EXCEPTION 'CAPA clause belongs to another organization'; END IF;
  IF NEW."nonconformityId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM nonconformities WHERE id = NEW."nonconformityId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA nonconformity belongs to another organization';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."requestedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA requester is not a member of the organization';
  END IF;
  IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."ownerId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA owner is not a member of the organization';
  END IF;
  IF NEW."rootCauseApprovedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."rootCauseApprovedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA approver is not a member of the organization';
  END IF;
  IF NEW."verifierId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."verifierId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA verifier is not a member of the organization';
  END IF;
  IF NEW."closedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."closedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA closer is not a member of the organization';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.nf_validate_document_metadata_links()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW."locationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."locations" target WHERE target."id" = NEW."locationId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document location must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."responsibleElaborationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."responsibleElaborationId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document elaboration owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."responsibleApprovalId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."responsibleApprovalId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document approval owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."custodianId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."custodianId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document custodian must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."memberships" target WHERE target."userId" = NEW."ownerId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."standardCode" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."organization_standards" enabled
    JOIN public."standard_editions" standard ON standard."id" = enabled."standardId"
    WHERE enabled."organizationId" = NEW."organizationId" AND standard."code" = NEW."standardCode"
  ) THEN
    RAISE EXCEPTION 'Document standard must be enabled for the organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."standard_requirements" clause
    JOIN public."organization_standards" enabled ON enabled."standardId" = clause."standardId"
    WHERE clause."id" = NEW."clauseId" AND enabled."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Document clause must belong to a standard enabled for the organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NEW."standardCode" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."standard_requirements" clause
    JOIN public."standard_editions" standard ON standard."id" = clause."standardId"
    WHERE clause."id" = NEW."clauseId" AND standard."code" = NEW."standardCode"
  ) THEN
    RAISE EXCEPTION 'Document clause and standard must match' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.nf_validate_management_review_tenant()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW."chairId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."chairId" AND active) THEN
    RAISE EXCEPTION 'Management review responsible is not an active organization member';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW."standards") code WHERE NOT EXISTS (SELECT 1 FROM organization_standards os JOIN standard_editions s ON s.id = os."standardId" WHERE os."organizationId" = NEW."organizationId" AND s.code = code)) THEN
    RAISE EXCEPTION 'Management review standard is not enabled for the organization';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.nf_validate_record_clause_link()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public."standard_requirements" clause
    JOIN public."organization_standards" enabled ON enabled."standardId" = clause."standardId"
    WHERE clause."id" = NEW."clauseId"
      AND enabled."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Record clause must belong to a standard enabled for the organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
