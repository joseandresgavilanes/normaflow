-- ISO/IEC 27001:2022 Statement of Applicability + formal risk treatment.
-- Versioned, approvable SoA covering the 93 Annex A controls, plus a risk
-- treatment methodology/plan/register with residual assessment and formal
-- acceptance. Mirrors the tenant/RLS/trigger structure of the control catalog.

CREATE TYPE "SoAStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "RiskTreatmentPlanStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "RiskTreatmentItemStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'RESIDUAL_PENDING', 'ACCEPTED', 'CLOSED');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "statements_of_applicability" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SoAStatus" NOT NULL DEFAULT 'DRAFT',
  "scope" TEXT,
  "ownerId" TEXT,
  "approverId" TEXT,
  "approvalComment" TEXT,
  "approvalEvidenceId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "statements_of_applicability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "soa_control_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "soaId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "controlCode" TEXT NOT NULL,
  "controlTitle" TEXT NOT NULL,
  "controlDomain" "SecurityControlDomain" NOT NULL,
  "applicability" "ControlApplicability" NOT NULL DEFAULT 'UNDER_REVIEW',
  "justification" TEXT,
  "implementationStatus" "OrganizationControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "relatedRiskItemId" TEXT,
  "evidenceId" TEXT,
  "responsibleId" TEXT,
  "reviewDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "soa_control_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "soa_control_entries_exclusion_justified_check"
    CHECK ("applicability" <> 'EXCLUDED' OR ("justification" IS NOT NULL AND length(btrim("justification")) > 0))
);

CREATE TABLE "risk_assessment_methodologies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "probabilityScale" JSONB NOT NULL,
  "impactScale" JSONB NOT NULL,
  "riskMatrix" JSONB NOT NULL,
  "acceptanceCriteria" TEXT NOT NULL,
  "acceptanceThreshold" INTEGER,
  "ownerId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_assessment_methodologies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_treatment_plans" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "methodologyId" TEXT,
  "soaId" TEXT,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "RiskTreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "ownerId" TEXT,
  "approverId" TEXT,
  "approvalComment" TEXT,
  "approvalEvidenceId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_treatment_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_treatment_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "riskId" TEXT,
  "asset" TEXT,
  "threat" TEXT,
  "vulnerability" TEXT,
  "impact" INTEGER NOT NULL,
  "probability" INTEGER NOT NULL,
  "inherentRisk" INTEGER NOT NULL,
  "existingControls" TEXT,
  "proposedControls" TEXT,
  "treatment" "RiskTreatment" NOT NULL DEFAULT 'MITIGATE',
  "residualImpact" INTEGER,
  "residualProbability" INTEGER,
  "residualRisk" INTEGER,
  "ownerId" TEXT,
  "targetDate" TIMESTAMP(3),
  "status" "RiskTreatmentItemStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_treatment_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_treatment_items_impact_check" CHECK ("impact" BETWEEN 1 AND 5),
  CONSTRAINT "risk_treatment_items_probability_check" CHECK ("probability" BETWEEN 1 AND 5),
  CONSTRAINT "risk_treatment_items_inherent_check" CHECK ("inherentRisk" BETWEEN 1 AND 25)
);

CREATE TABLE "risk_treatment_controls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "organizationControlId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_treatment_controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "residual_risk_assessments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "residualImpact" INTEGER NOT NULL,
  "residualProbability" INTEGER NOT NULL,
  "residualRisk" INTEGER NOT NULL,
  "rationale" TEXT,
  "assessedById" TEXT NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "residual_risk_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "residual_risk_assessments_impact_check" CHECK ("residualImpact" BETWEEN 1 AND 5),
  CONSTRAINT "residual_risk_assessments_probability_check" CHECK ("residualProbability" BETWEEN 1 AND 5),
  CONSTRAINT "residual_risk_assessments_score_check" CHECK ("residualRisk" BETWEEN 1 AND 25)
);

CREATE TABLE "risk_acceptances" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "residualAssessmentId" TEXT,
  "justification" TEXT NOT NULL,
  "acceptedById" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" TEXT,
  "evidenceId" TEXT,
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_acceptances_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────

CREATE UNIQUE INDEX "statements_of_applicability_organizationId_version_key" ON "statements_of_applicability"("organizationId", "version");
CREATE INDEX "statements_of_applicability_organizationId_status_idx" ON "statements_of_applicability"("organizationId", "status");
CREATE UNIQUE INDEX "soa_control_entries_soaId_controlId_key" ON "soa_control_entries"("soaId", "controlId");
CREATE INDEX "soa_control_entries_organizationId_soaId_idx" ON "soa_control_entries"("organizationId", "soaId");
CREATE INDEX "soa_control_entries_organizationId_applicability_idx" ON "soa_control_entries"("organizationId", "applicability");
CREATE UNIQUE INDEX "risk_assessment_methodologies_organizationId_version_key" ON "risk_assessment_methodologies"("organizationId", "version");
CREATE UNIQUE INDEX "risk_treatment_plans_organizationId_version_key" ON "risk_treatment_plans"("organizationId", "version");
CREATE INDEX "risk_treatment_plans_organizationId_status_idx" ON "risk_treatment_plans"("organizationId", "status");
CREATE UNIQUE INDEX "risk_treatment_items_planId_reference_key" ON "risk_treatment_items"("planId", "reference");
CREATE INDEX "risk_treatment_items_organizationId_status_idx" ON "risk_treatment_items"("organizationId", "status");
CREATE INDEX "risk_treatment_items_organizationId_planId_idx" ON "risk_treatment_items"("organizationId", "planId");
CREATE UNIQUE INDEX "risk_treatment_controls_itemId_organizationControlId_key" ON "risk_treatment_controls"("itemId", "organizationControlId");
CREATE INDEX "risk_treatment_controls_organizationId_itemId_idx" ON "risk_treatment_controls"("organizationId", "itemId");
CREATE INDEX "residual_risk_assessments_organizationId_itemId_assessedAt_idx" ON "residual_risk_assessments"("organizationId", "itemId", "assessedAt");
CREATE INDEX "risk_acceptances_organizationId_itemId_idx" ON "risk_acceptances"("organizationId", "itemId");

-- ─── GRANTS ──────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "statements_of_applicability", "soa_control_entries",
  "risk_assessment_methodologies", "risk_treatment_plans", "risk_treatment_items",
  "risk_treatment_controls", "residual_risk_assessments", "risk_acceptances"
  TO authenticated;

-- ─── FOREIGN KEYS ────────────────────────────────────

ALTER TABLE "statements_of_applicability" ADD CONSTRAINT "statements_of_applicability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "statements_of_applicability" ADD CONSTRAINT "statements_of_applicability_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "statements_of_applicability" ADD CONSTRAINT "statements_of_applicability_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "statements_of_applicability" ADD CONSTRAINT "statements_of_applicability_approvalEvidenceId_fkey" FOREIGN KEY ("approvalEvidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "statements_of_applicability" ADD CONSTRAINT "statements_of_applicability_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "statements_of_applicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "security_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_relatedRiskItemId_fkey" FOREIGN KEY ("relatedRiskItemId") REFERENCES "risk_treatment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soa_control_entries" ADD CONSTRAINT "soa_control_entries_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risk_assessment_methodologies" ADD CONSTRAINT "risk_assessment_methodologies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessment_methodologies" ADD CONSTRAINT "risk_assessment_methodologies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_assessment_methodologies" ADD CONSTRAINT "risk_assessment_methodologies_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "risk_assessment_methodologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_plans" ADD CONSTRAINT "risk_treatment_plans_approvalEvidenceId_fkey" FOREIGN KEY ("approvalEvidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risk_treatment_items" ADD CONSTRAINT "risk_treatment_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_items" ADD CONSTRAINT "risk_treatment_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "risk_treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_items" ADD CONSTRAINT "risk_treatment_items_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_items" ADD CONSTRAINT "risk_treatment_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risk_treatment_controls" ADD CONSTRAINT "risk_treatment_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_controls" ADD CONSTRAINT "risk_treatment_controls_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "risk_treatment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_treatment_controls" ADD CONSTRAINT "risk_treatment_controls_organizationControlId_fkey" FOREIGN KEY ("organizationControlId") REFERENCES "organization_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "residual_risk_assessments" ADD CONSTRAINT "residual_risk_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "residual_risk_assessments" ADD CONSTRAINT "residual_risk_assessments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "risk_treatment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "residual_risk_assessments" ADD CONSTRAINT "residual_risk_assessments_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "risk_treatment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_residualAssessmentId_fkey" FOREIGN KEY ("residualAssessmentId") REFERENCES "residual_risk_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── DATABASE-LEVEL TENANT CONSISTENCY (direct Supabase writes) ──
-- Also blocks closing a risk item without an approved residual assessment AND
-- a formal acceptance (ISO "no cerrar riesgo residual sin aceptación").
CREATE OR REPLACE FUNCTION public.nf_validate_soa_risk_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'statements_of_applicability' THEN
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'SoA owner is not an active organization member'; END IF;
    IF NEW."approverId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."approverId" AND active) THEN RAISE EXCEPTION 'SoA approver is not an active organization member'; END IF;
    IF NEW."approvalEvidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."approvalEvidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'SoA approval evidence belongs to another organization'; END IF;
    IF NEW."supersededById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM statements_of_applicability WHERE id = NEW."supersededById" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Superseding SoA belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'soa_control_entries' THEN
    SELECT "organizationId" INTO target_org FROM statements_of_applicability WHERE id = NEW."soaId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'SoA entry belongs to another organization'; END IF;
    IF NEW."relatedRiskItemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risk_treatment_items WHERE id = NEW."relatedRiskItemId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'SoA entry risk item belongs to another organization'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'SoA entry evidence belongs to another organization'; END IF;
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'SoA entry responsible is not an active organization member'; END IF;

  ELSIF TG_TABLE_NAME = 'risk_assessment_methodologies' THEN
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'Methodology owner is not an active organization member'; END IF;
    IF NEW."approvedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."approvedById" AND active) THEN RAISE EXCEPTION 'Methodology approver is not an active organization member'; END IF;

  ELSIF TG_TABLE_NAME = 'risk_treatment_plans' THEN
    IF NEW."methodologyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risk_assessment_methodologies WHERE id = NEW."methodologyId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Plan methodology belongs to another organization'; END IF;
    IF NEW."soaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM statements_of_applicability WHERE id = NEW."soaId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Plan SoA belongs to another organization'; END IF;
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'Plan owner is not an active organization member'; END IF;
    IF NEW."approverId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."approverId" AND active) THEN RAISE EXCEPTION 'Plan approver is not an active organization member'; END IF;
    IF NEW."approvalEvidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."approvalEvidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Plan approval evidence belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'risk_treatment_items' THEN
    IF NOT EXISTS (SELECT 1 FROM risk_treatment_plans WHERE id = NEW."planId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk item plan belongs to another organization'; END IF;
    IF NEW."riskId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risks WHERE id = NEW."riskId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk item linked risk belongs to another organization'; END IF;
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'Risk item owner is not an active organization member'; END IF;
    IF NEW."status" = 'CLOSED' AND (TG_OP = 'INSERT' OR OLD."status" <> 'CLOSED') THEN
      IF NOT EXISTS (SELECT 1 FROM residual_risk_assessments WHERE "itemId" = NEW.id AND approved) THEN RAISE EXCEPTION 'Cannot close a risk item without an approved residual risk assessment'; END IF;
      IF NOT EXISTS (SELECT 1 FROM risk_acceptances WHERE "itemId" = NEW.id) THEN RAISE EXCEPTION 'Cannot close a risk item without a formal risk acceptance'; END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'risk_treatment_controls' THEN
    IF NOT EXISTS (SELECT 1 FROM risk_treatment_items WHERE id = NEW."itemId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk treatment control item belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM organization_controls WHERE id = NEW."organizationControlId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk treatment control belongs to another organization'; END IF;

  ELSIF TG_TABLE_NAME = 'residual_risk_assessments' THEN
    IF NOT EXISTS (SELECT 1 FROM risk_treatment_items WHERE id = NEW."itemId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Residual assessment item belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."assessedById" AND active) THEN RAISE EXCEPTION 'Residual assessor is not an active organization member'; END IF;

  ELSIF TG_TABLE_NAME = 'risk_acceptances' THEN
    IF NOT EXISTS (SELECT 1 FROM risk_treatment_items WHERE id = NEW."itemId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Risk acceptance item belongs to another organization'; END IF;
    IF NEW."residualAssessmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM residual_risk_assessments WHERE id = NEW."residualAssessmentId" AND "itemId" = NEW."itemId") THEN RAISE EXCEPTION 'Risk acceptance residual assessment belongs to another item'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."acceptedById" AND active) THEN RAISE EXCEPTION 'Risk acceptor is not an active organization member'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Risk acceptance evidence belongs to another organization'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nf_statements_of_applicability_tenant_refs ON statements_of_applicability;
CREATE TRIGGER nf_statements_of_applicability_tenant_refs BEFORE INSERT OR UPDATE ON statements_of_applicability FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_soa_control_entries_tenant_refs ON soa_control_entries;
CREATE TRIGGER nf_soa_control_entries_tenant_refs BEFORE INSERT OR UPDATE ON soa_control_entries FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_risk_assessment_methodologies_tenant_refs ON risk_assessment_methodologies;
CREATE TRIGGER nf_risk_assessment_methodologies_tenant_refs BEFORE INSERT OR UPDATE ON risk_assessment_methodologies FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_risk_treatment_plans_tenant_refs ON risk_treatment_plans;
CREATE TRIGGER nf_risk_treatment_plans_tenant_refs BEFORE INSERT OR UPDATE ON risk_treatment_plans FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_risk_treatment_items_tenant_refs ON risk_treatment_items;
CREATE TRIGGER nf_risk_treatment_items_tenant_refs BEFORE INSERT OR UPDATE ON risk_treatment_items FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_risk_treatment_controls_tenant_refs ON risk_treatment_controls;
CREATE TRIGGER nf_risk_treatment_controls_tenant_refs BEFORE INSERT OR UPDATE ON risk_treatment_controls FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_residual_risk_assessments_tenant_refs ON residual_risk_assessments;
CREATE TRIGGER nf_residual_risk_assessments_tenant_refs BEFORE INSERT OR UPDATE ON residual_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();
DROP TRIGGER IF EXISTS nf_risk_acceptances_tenant_refs ON risk_acceptances;
CREATE TRIGGER nf_risk_acceptances_tenant_refs BEFORE INSERT OR UPDATE ON risk_acceptances FOR EACH ROW EXECUTE FUNCTION public.nf_validate_soa_risk_tenant();

-- ─── ROW LEVEL SECURITY ──────────────────────────────
-- SoA: approved/superseded versions are immutable to direct API writers
-- (server actions run through Prisma, a trusted role, and manage transitions).

ALTER TABLE "statements_of_applicability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_soa_select" ON "statements_of_applicability" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:read'));
CREATE POLICY "nf_soa_insert" ON "statements_of_applicability" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'soa:create'));
CREATE POLICY "nf_soa_update" ON "statements_of_applicability" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:update') AND "status" IN ('DRAFT', 'UNDER_REVIEW')) WITH CHECK (public.nf_has_org_permission("organizationId", 'soa:update'));
CREATE POLICY "nf_soa_delete" ON "statements_of_applicability" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:delete') AND "status" <> 'APPROVED');

ALTER TABLE "soa_control_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_soa_entries_select" ON "soa_control_entries" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:read'));
CREATE POLICY "nf_soa_entries_insert" ON "soa_control_entries" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'soa:create'));
CREATE POLICY "nf_soa_entries_update" ON "soa_control_entries" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:update') AND EXISTS (SELECT 1 FROM statements_of_applicability s WHERE s.id = "soaId" AND s."status" IN ('DRAFT', 'UNDER_REVIEW'))) WITH CHECK (public.nf_has_org_permission("organizationId", 'soa:update'));
CREATE POLICY "nf_soa_entries_delete" ON "soa_control_entries" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'soa:delete'));

ALTER TABLE "risk_assessment_methodologies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_methodology_select" ON "risk_assessment_methodologies" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_risk_methodology_insert" ON "risk_assessment_methodologies" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:create'));
CREATE POLICY "nf_risk_methodology_update" ON "risk_assessment_methodologies" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_methodology_delete" ON "risk_assessment_methodologies" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:delete'));

ALTER TABLE "risk_treatment_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_plan_select" ON "risk_treatment_plans" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_risk_plan_insert" ON "risk_treatment_plans" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:create'));
CREATE POLICY "nf_risk_plan_update" ON "risk_treatment_plans" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:update') AND "status" IN ('DRAFT', 'UNDER_REVIEW')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_plan_delete" ON "risk_treatment_plans" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:delete') AND "status" <> 'APPROVED');

ALTER TABLE "risk_treatment_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_item_select" ON "risk_treatment_items" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_risk_item_insert" ON "risk_treatment_items" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_item_update" ON "risk_treatment_items" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_item_delete" ON "risk_treatment_items" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:delete'));

ALTER TABLE "risk_treatment_controls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_item_control_select" ON "risk_treatment_controls" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_risk_item_control_insert" ON "risk_treatment_controls" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_item_control_update" ON "risk_treatment_controls" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_risk_item_control_delete" ON "risk_treatment_controls" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));

ALTER TABLE "residual_risk_assessments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_residual_select" ON "residual_risk_assessments" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_residual_insert" ON "residual_risk_assessments" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:update'));
CREATE POLICY "nf_residual_update" ON "residual_risk_assessments" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:approve')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:approve'));
CREATE POLICY "nf_residual_delete" ON "residual_risk_assessments" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:delete'));

ALTER TABLE "risk_acceptances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_risk_acceptance_select" ON "risk_acceptances" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:read'));
CREATE POLICY "nf_risk_acceptance_insert" ON "risk_acceptances" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:approve'));
CREATE POLICY "nf_risk_acceptance_update" ON "risk_acceptances" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:approve')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risk-treatment:approve'));
CREATE POLICY "nf_risk_acceptance_delete" ON "risk_acceptances" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risk-treatment:delete'));

-- Keep Supabase direct authorization aligned with the server matrix: add the
-- soa:* and risk-treatment:* modules to every role.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
