-- ISO 45001:2018 occupational health & safety: hazards & risk assessment,
-- worker consultation, inspections, PPE, permits to work, incidents (strict
-- workflow), health surveillance, emergency drills and contractor safety.
-- Multi-tenant with RLS gated on the `safety` permission module.

-- ─── ENUMS ───────────────────────────────────────────
CREATE TYPE "OccupationalHazardCategory" AS ENUM ('PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'PSYCHOSOCIAL', 'MECHANICAL', 'ELECTRICAL', 'FIRE_EXPLOSION', 'LOCATIVE', 'OTHER');
CREATE TYPE "OccupationalRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "OccupationalRiskAcceptability" AS ENUM ('ACCEPTABLE', 'TOLERABLE', 'NOT_ACCEPTABLE');
CREATE TYPE "ConsultationMethod" AS ENUM ('MEETING', 'SURVEY', 'COMMITTEE', 'SUGGESTION', 'TRAINING', 'OTHER');
CREATE TYPE "SafetyInspectionType" AS ENUM ('PLANNED', 'UNPLANNED', 'BEHAVIORAL', 'CONDITION', 'LEGAL', 'OTHER');
CREATE TYPE "PermitType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'WORK_AT_HEIGHT', 'ELECTRICAL', 'EXCAVATION', 'LOCKOUT_TAGOUT', 'LIFTING', 'OTHER');
CREATE TYPE "PermitToWorkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'EXPIRED');
CREATE TYPE "OccupationalIncidentType" AS ENUM ('ACCIDENT', 'INCIDENT', 'NEAR_MISS', 'OCCUPATIONAL_ILLNESS');
CREATE TYPE "OccupationalIncidentStatus" AS ENUM ('REPORTED', 'CLASSIFIED', 'INVESTIGATING', 'ROOT_CAUSE', 'ACTION_PLAN', 'IMPLEMENTED', 'EFFECTIVENESS_VERIFIED', 'CLOSED');
CREATE TYPE "HealthFitness" AS ENUM ('FIT', 'FIT_WITH_RESTRICTIONS', 'TEMPORARILY_UNFIT', 'UNFIT', 'PENDING');
CREATE TYPE "ContractorSafetyOutcome" AS ENUM ('APPROVED', 'CONDITIONAL', 'REJECTED', 'UNDER_REVIEW');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "occupational_hazards" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "processId" TEXT,
  "activity" TEXT NOT NULL,
  "task" TEXT,
  "hazard" TEXT NOT NULL,
  "category" "OccupationalHazardCategory" NOT NULL DEFAULT 'OTHER',
  "exposedWorkers" INTEGER,
  "existingControls" TEXT,
  "responsibleId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "occupational_hazards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "occupational_risk_assessments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hazardId" TEXT NOT NULL,
  "probability" INTEGER NOT NULL DEFAULT 1,
  "consequence" INTEGER NOT NULL DEFAULT 1,
  "exposure" INTEGER NOT NULL DEFAULT 1,
  "inherentMagnitude" DOUBLE PRECISION,
  "inherentLevel" "OccupationalRiskLevel" NOT NULL DEFAULT 'LOW',
  "controls" TEXT,
  "residualMagnitude" DOUBLE PRECISION,
  "residualLevel" "OccupationalRiskLevel" NOT NULL DEFAULT 'LOW',
  "acceptability" "OccupationalRiskAcceptability" NOT NULL DEFAULT 'ACCEPTABLE',
  "assessorId" TEXT,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "riskId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "occupational_risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_consultations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "method" "ConsultationMethod" NOT NULL DEFAULT 'MEETING',
  "participants" INTEGER,
  "participantsNote" TEXT,
  "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conclusions" TEXT,
  "decisions" TEXT,
  "documentId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_consultations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "safety_inspections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "locationId" TEXT,
  "area" TEXT,
  "type" "SafetyInspectionType" NOT NULL DEFAULT 'PLANNED',
  "inspectorId" TEXT,
  "checklist" JSONB,
  "findings" TEXT,
  "actions" TEXT,
  "evidenceId" TEXT,
  "capaId" TEXT,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "safety_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ppe_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ppeType" TEXT NOT NULL,
  "technicalStandard" TEXT,
  "lifespanMonths" INTEGER,
  "maintenance" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ppe_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ppe_assignments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ppeItemId" TEXT NOT NULL,
  "personnelId" TEXT,
  "workerName" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "trainingProvided" BOOLEAN NOT NULL DEFAULT false,
  "trainingCourseId" TEXT,
  "replacementDate" TIMESTAMP(3),
  "evidenceId" TEXT,
  "signatureNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ppe_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permits_to_work" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "workType" "PermitType" NOT NULL DEFAULT 'OTHER',
  "locationId" TEXT,
  "area" TEXT,
  "hazards" TEXT,
  "controls" TEXT,
  "authorizerId" TEXT,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "status" "PermitToWorkStatus" NOT NULL DEFAULT 'DRAFT',
  "closedAt" TIMESTAMP(3),
  "closureNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permits_to_work_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "occupational_incidents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "OccupationalIncidentType" NOT NULL DEFAULT 'INCIDENT',
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "injury" TEXT,
  "illness" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locationId" TEXT,
  "area" TEXT,
  "personnelId" TEXT,
  "workerName" TEXT,
  "lostDays" INTEGER NOT NULL DEFAULT 0,
  "investigation" TEXT,
  "rootCause" TEXT,
  "rootCauseMethod" TEXT,
  "causes" TEXT,
  "actions" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "OccupationalIncidentStatus" NOT NULL DEFAULT 'REPORTED',
  "reporterId" TEXT,
  "responsibleId" TEXT,
  "capaId" TEXT,
  "evidenceId" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "occupational_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "occupational_health_surveillance" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "personnelId" TEXT,
  "workerName" TEXT,
  "positionId" TEXT,
  "exposure" TEXT,
  "protocol" TEXT,
  "fitness" "HealthFitness" NOT NULL DEFAULT 'PENDING',
  "restrictions" TEXT,
  "examinedAt" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "occupational_health_surveillance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emergency_drills" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "scenario" TEXT NOT NULL,
  "participants" INTEGER,
  "participantsNote" TEXT,
  "responseTimeMinutes" INTEGER,
  "outcome" "ContinuityTestOutcome",
  "failures" TEXT,
  "actions" TEXT,
  "drillDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "emergency_drills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contractor_safety_assessments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "supplierId" TEXT,
  "contractorName" TEXT,
  "risks" TEXT,
  "requirements" TEXT,
  "documentation" TEXT,
  "outcome" "ContractorSafetyOutcome" NOT NULL DEFAULT 'UNDER_REVIEW',
  "score" INTEGER,
  "incidents" INTEGER NOT NULL DEFAULT 0,
  "assessedAt" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contractor_safety_assessments_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────
CREATE UNIQUE INDEX "occupational_hazards_organizationId_code_key" ON "occupational_hazards"("organizationId", "code");
CREATE INDEX "occupational_hazards_organizationId_category_idx" ON "occupational_hazards"("organizationId", "category");
CREATE INDEX "occupational_hazards_organizationId_processId_idx" ON "occupational_hazards"("organizationId", "processId");

CREATE INDEX "occupational_risk_assessments_org_inherentLevel_idx" ON "occupational_risk_assessments"("organizationId", "inherentLevel");
CREATE INDEX "occupational_risk_assessments_org_acceptability_idx" ON "occupational_risk_assessments"("organizationId", "acceptability");
CREATE INDEX "occupational_risk_assessments_hazardId_idx" ON "occupational_risk_assessments"("hazardId");

CREATE UNIQUE INDEX "worker_consultations_organizationId_code_key" ON "worker_consultations"("organizationId", "code");
CREATE INDEX "worker_consultations_organizationId_heldAt_idx" ON "worker_consultations"("organizationId", "heldAt");

CREATE UNIQUE INDEX "safety_inspections_organizationId_code_key" ON "safety_inspections"("organizationId", "code");
CREATE INDEX "safety_inspections_organizationId_type_idx" ON "safety_inspections"("organizationId", "type");
CREATE INDEX "safety_inspections_organizationId_inspectedAt_idx" ON "safety_inspections"("organizationId", "inspectedAt");

CREATE UNIQUE INDEX "ppe_items_organizationId_code_key" ON "ppe_items"("organizationId", "code");
CREATE INDEX "ppe_items_organizationId_active_idx" ON "ppe_items"("organizationId", "active");

CREATE INDEX "ppe_assignments_organizationId_personnelId_idx" ON "ppe_assignments"("organizationId", "personnelId");
CREATE INDEX "ppe_assignments_organizationId_replacementDate_idx" ON "ppe_assignments"("organizationId", "replacementDate");
CREATE INDEX "ppe_assignments_ppeItemId_idx" ON "ppe_assignments"("ppeItemId");

CREATE UNIQUE INDEX "permits_to_work_organizationId_code_key" ON "permits_to_work"("organizationId", "code");
CREATE INDEX "permits_to_work_organizationId_status_idx" ON "permits_to_work"("organizationId", "status");
CREATE INDEX "permits_to_work_organizationId_validTo_idx" ON "permits_to_work"("organizationId", "validTo");

CREATE UNIQUE INDEX "occupational_incidents_organizationId_code_key" ON "occupational_incidents"("organizationId", "code");
CREATE INDEX "occupational_incidents_organizationId_status_idx" ON "occupational_incidents"("organizationId", "status");
CREATE INDEX "occupational_incidents_organizationId_type_idx" ON "occupational_incidents"("organizationId", "type");
CREATE INDEX "occupational_incidents_organizationId_occurredAt_idx" ON "occupational_incidents"("organizationId", "occurredAt");

CREATE UNIQUE INDEX "occupational_health_surveillance_organizationId_code_key" ON "occupational_health_surveillance"("organizationId", "code");
CREATE INDEX "occ_health_surveillance_org_nextReview_idx" ON "occupational_health_surveillance"("organizationId", "nextReviewDate");
CREATE INDEX "occ_health_surveillance_org_fitness_idx" ON "occupational_health_surveillance"("organizationId", "fitness");

CREATE UNIQUE INDEX "emergency_drills_organizationId_code_key" ON "emergency_drills"("organizationId", "code");
CREATE INDEX "emergency_drills_organizationId_drillDate_idx" ON "emergency_drills"("organizationId", "drillDate");

CREATE UNIQUE INDEX "contractor_safety_assessments_organizationId_code_key" ON "contractor_safety_assessments"("organizationId", "code");
CREATE INDEX "contractor_safety_assessments_organizationId_outcome_idx" ON "contractor_safety_assessments"("organizationId", "outcome");

-- ─── FOREIGN KEYS ────────────────────────────────────
ALTER TABLE "occupational_hazards" ADD CONSTRAINT "occupational_hazards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "occupational_risk_assessments" ADD CONSTRAINT "occupational_risk_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "occupational_risk_assessments" ADD CONSTRAINT "occupational_risk_assessments_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "occupational_hazards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_consultations" ADD CONSTRAINT "worker_consultations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ppe_items" ADD CONSTRAINT "ppe_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ppe_assignments" ADD CONSTRAINT "ppe_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ppe_assignments" ADD CONSTRAINT "ppe_assignments_ppeItemId_fkey" FOREIGN KEY ("ppeItemId") REFERENCES "ppe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "occupational_incidents" ADD CONSTRAINT "occupational_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "occupational_health_surveillance" ADD CONSTRAINT "occupational_health_surveillance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emergency_drills" ADD CONSTRAINT "emergency_drills_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_safety_assessments" ADD CONSTRAINT "contractor_safety_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."occupational_hazards", public."occupational_risk_assessments", public."worker_consultations",
      public."safety_inspections", public."ppe_items", public."ppe_assignments", public."permits_to_work",
      public."occupational_incidents", public."occupational_health_surveillance", public."emergency_drills",
      public."contractor_safety_assessments"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('occupational_hazards','create'),
      ('occupational_risk_assessments','create'),
      ('worker_consultations','create'),
      ('safety_inspections','create'),
      ('ppe_items','create'),
      ('ppe_assignments','create'),
      ('permits_to_work','create'),
      ('occupational_incidents','create'),
      ('occupational_health_surveillance','create'),
      ('emergency_drills','create'),
      ('contractor_safety_assessments','create')
    ) AS s(tbl, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_select', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_insert', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_update', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_delete', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, 'safety:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, 'safety:'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, 'safety:update', 'safety:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, 'safety:delete');
  END LOOP;
END $$;

-- Keep Supabase direct authorization aligned with the server matrix: add
-- safety:* (carries forward every prior module including environment:*).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
