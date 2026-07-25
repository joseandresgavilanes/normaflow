-- ISO 14001:2015 environmental management: aspects & impacts, significance
-- methodology, compliance obligations & evaluations, objectives & programs,
-- environmental metrics, waste streams and emergency scenarios. Multi-tenant
-- with RLS gated on the `environment` permission module.

-- ─── ENUMS ───────────────────────────────────────────
CREATE TYPE "EnvironmentalCondition" AS ENUM ('NORMAL', 'ABNORMAL', 'EMERGENCY');
CREATE TYPE "EnvironmentalSignificance" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "EnvironmentalComplianceResult" AS ENUM ('COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'NOT_EVALUATED');
CREATE TYPE "EnvironmentalObjectiveStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'DELAYED', 'CANCELLED');
CREATE TYPE "EnvironmentalProgramStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE "WasteClassification" AS ENUM ('NON_HAZARDOUS', 'HAZARDOUS', 'RECYCLABLE', 'INERT', 'SPECIAL');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "environmental_aspects" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "productService" TEXT,
  "condition" "EnvironmentalCondition" NOT NULL DEFAULT 'NORMAL',
  "lifeCycleStage" TEXT,
  "responsibleId" TEXT,
  "processId" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_aspects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_impacts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aspectId" TEXT NOT NULL,
  "methodId" TEXT,
  "impactType" TEXT NOT NULL,
  "description" TEXT,
  "severity" INTEGER NOT NULL DEFAULT 1,
  "frequency" INTEGER NOT NULL DEFAULT 1,
  "scope" INTEGER NOT NULL DEFAULT 1,
  "existingControl" TEXT,
  "controlEffectiveness" INTEGER,
  "score" DOUBLE PRECISION,
  "level" "EnvironmentalSignificance" NOT NULL DEFAULT 'LOW',
  "significant" BOOLEAN NOT NULL DEFAULT false,
  "riskId" TEXT,
  "controlId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_impacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_significance_methods" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "criteria" JSONB,
  "weights" JSONB,
  "formula" TEXT NOT NULL DEFAULT 'WEIGHTED_SUM',
  "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "version" TEXT NOT NULL DEFAULT '1',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_significance_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_compliance_obligations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "jurisdiction" TEXT,
  "obligation" TEXT NOT NULL,
  "applicability" TEXT,
  "responsibleId" TEXT,
  "reviewDate" TIMESTAMP(3),
  "reviewFrequencyMonths" INTEGER,
  "evidenceId" TEXT,
  "documentId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_compliance_obligations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_compliance_evaluations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "result" "EnvironmentalComplianceResult" NOT NULL DEFAULT 'NOT_EVALUATED',
  "evaluatorId" TEXT,
  "evidenceId" TEXT,
  "findings" TEXT,
  "derivedActionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_compliance_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_objectives" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "baseline" TEXT,
  "target" TEXT,
  "indicatorId" TEXT,
  "responsibleId" TEXT,
  "resources" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "EnvironmentalObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_objectives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_programs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "objectiveId" TEXT,
  "name" TEXT NOT NULL,
  "activities" TEXT,
  "responsibleId" TEXT,
  "budget" DOUBLE PRECISION,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "status" "EnvironmentalProgramStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_metrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "processId" TEXT,
  "locationId" TEXT,
  "water" DOUBLE PRECISION,
  "energy" DOUBLE PRECISION,
  "fuel" DOUBLE PRECISION,
  "emissions" DOUBLE PRECISION,
  "discharges" DOUBLE PRECISION,
  "waste" DOUBLE PRECISION,
  "rawMaterials" DOUBLE PRECISION,
  "unitNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waste_streams" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "wasteType" TEXT NOT NULL,
  "classification" "WasteClassification" NOT NULL DEFAULT 'NON_HAZARDOUS',
  "quantity" DOUBLE PRECISION,
  "unit" TEXT,
  "period" TEXT,
  "storage" TEXT,
  "managerName" TEXT,
  "disposition" TEXT,
  "manifest" TEXT,
  "processId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waste_streams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environmental_emergency_scenarios" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "scenario" TEXT NOT NULL,
  "impact" TEXT,
  "controls" TEXT,
  "responsePlan" TEXT,
  "responsibleId" TEXT,
  "lastDrillAt" TIMESTAMP(3),
  "nextDrillAt" TIMESTAMP(3),
  "drillResults" TEXT,
  "documentId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_emergency_scenarios_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────
CREATE UNIQUE INDEX "environmental_aspects_organizationId_code_key" ON "environmental_aspects"("organizationId", "code");
CREATE INDEX "environmental_aspects_organizationId_condition_idx" ON "environmental_aspects"("organizationId", "condition");
CREATE INDEX "environmental_aspects_organizationId_processId_idx" ON "environmental_aspects"("organizationId", "processId");

CREATE INDEX "environmental_impacts_organizationId_significant_idx" ON "environmental_impacts"("organizationId", "significant");
CREATE INDEX "environmental_impacts_aspectId_idx" ON "environmental_impacts"("aspectId");

CREATE UNIQUE INDEX "environmental_significance_methods_org_name_version_key" ON "environmental_significance_methods"("organizationId", "name", "version");
CREATE INDEX "environmental_significance_methods_organizationId_active_idx" ON "environmental_significance_methods"("organizationId", "active");

CREATE UNIQUE INDEX "environmental_compliance_obligations_organizationId_code_key" ON "environmental_compliance_obligations"("organizationId", "code");
CREATE INDEX "environmental_compliance_obligations_org_reviewDate_idx" ON "environmental_compliance_obligations"("organizationId", "reviewDate");

CREATE INDEX "environmental_compliance_evaluations_org_obl_at_idx" ON "environmental_compliance_evaluations"("organizationId", "obligationId", "evaluatedAt");

CREATE UNIQUE INDEX "environmental_objectives_organizationId_code_key" ON "environmental_objectives"("organizationId", "code");
CREATE INDEX "environmental_objectives_organizationId_status_idx" ON "environmental_objectives"("organizationId", "status");

CREATE INDEX "environmental_programs_organizationId_status_idx" ON "environmental_programs"("organizationId", "status");
CREATE INDEX "environmental_programs_objectiveId_idx" ON "environmental_programs"("objectiveId");

CREATE INDEX "environmental_metrics_organizationId_period_idx" ON "environmental_metrics"("organizationId", "period");
CREATE INDEX "environmental_metrics_organizationId_processId_idx" ON "environmental_metrics"("organizationId", "processId");

CREATE UNIQUE INDEX "waste_streams_organizationId_code_key" ON "waste_streams"("organizationId", "code");
CREATE INDEX "waste_streams_organizationId_classification_idx" ON "waste_streams"("organizationId", "classification");

CREATE UNIQUE INDEX "environmental_emergency_scenarios_organizationId_code_key" ON "environmental_emergency_scenarios"("organizationId", "code");
CREATE INDEX "environmental_emergency_scenarios_organizationId_active_idx" ON "environmental_emergency_scenarios"("organizationId", "active");

-- ─── FOREIGN KEYS ────────────────────────────────────
ALTER TABLE "environmental_aspects" ADD CONSTRAINT "environmental_aspects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_impacts" ADD CONSTRAINT "environmental_impacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_impacts" ADD CONSTRAINT "environmental_impacts_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "environmental_aspects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_significance_methods" ADD CONSTRAINT "environmental_significance_methods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_compliance_obligations" ADD CONSTRAINT "environmental_compliance_obligations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_compliance_evaluations" ADD CONSTRAINT "environmental_compliance_evaluations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_compliance_evaluations" ADD CONSTRAINT "environmental_compliance_evaluations_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "environmental_compliance_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_objectives" ADD CONSTRAINT "environmental_objectives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_programs" ADD CONSTRAINT "environmental_programs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_programs" ADD CONSTRAINT "environmental_programs_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "environmental_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "environmental_metrics" ADD CONSTRAINT "environmental_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_streams" ADD CONSTRAINT "waste_streams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environmental_emergency_scenarios" ADD CONSTRAINT "environmental_emergency_scenarios_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."environmental_aspects", public."environmental_impacts",
      public."environmental_significance_methods", public."environmental_compliance_obligations",
      public."environmental_compliance_evaluations", public."environmental_objectives",
      public."environmental_programs", public."environmental_metrics",
      public."waste_streams", public."environmental_emergency_scenarios"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
-- Every environmental table is org-scoped and gated on the `environment` module.
DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('environmental_aspects','create'),
      ('environmental_impacts','create'),
      ('environmental_significance_methods','create'),
      ('environmental_compliance_obligations','create'),
      ('environmental_compliance_evaluations','create'),
      ('environmental_objectives','create'),
      ('environmental_programs','create'),
      ('environmental_metrics','create'),
      ('waste_streams','create'),
      ('environmental_emergency_scenarios','create')
    ) AS s(tbl, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_select', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_insert', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_update', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_delete', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, 'environment:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, 'environment:'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, 'environment:update', 'environment:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, 'environment:delete');
  END LOOP;
END $$;

-- Keep Supabase direct authorization aligned with the server matrix: add
-- environment:* (carries forward every prior module including standards:*).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
