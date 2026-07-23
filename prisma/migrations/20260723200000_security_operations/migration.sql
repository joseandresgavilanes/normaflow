-- ISO/IEC 27001:2022 security operations: incidents, vulnerabilities,
-- business continuity, and the security profile of suppliers. Multi-tenant
-- with RLS, tenant triggers, and strict incident-workflow enforcement.

CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentCategory" AS ENUM ('MALWARE', 'PHISHING', 'UNAUTHORIZED_ACCESS', 'DATA_LEAK', 'DENIAL_OF_SERVICE', 'PHYSICAL', 'HUMAN_ERROR', 'OTHER');
CREATE TYPE "IncidentStatus" AS ENUM ('DETECTED', 'TRIAGED', 'INVESTIGATING', 'CONTAINED', 'ERADICATED', 'RECOVERED', 'CLOSED');
CREATE TYPE "VulnerabilitySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "VulnerabilityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'REMEDIATED', 'VERIFIED', 'ACCEPTED', 'CLOSED');
CREATE TYPE "RemediationStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'VERIFIED');
CREATE TYPE "VerificationResult" AS ENUM ('PASSED', 'FAILED', 'PARTIAL');
CREATE TYPE "ContinuityPlanStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'RETIRED');
CREATE TYPE "ContinuityTestType" AS ENUM ('TABLETOP', 'WALKTHROUGH', 'SIMULATION', 'FAILOVER', 'FULL');
CREATE TYPE "ContinuityTestStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContinuityTestOutcome" AS ENUM ('PASSED', 'PARTIAL', 'FAILED');
CREATE TYPE "ImprovementActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "security_incidents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "reporterId" TEXT,
  "responsibleId" TEXT,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "category" "IncidentCategory" NOT NULL DEFAULT 'OTHER',
  "description" TEXT NOT NULL,
  "impact" TEXT,
  "status" "IncidentStatus" NOT NULL DEFAULT 'DETECTED',
  "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
  "notificationDetails" TEXT,
  "lessonsLearned" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "security_incident_assets" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "incidentId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_incident_assets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "security_incident_evidences" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "incidentId" TEXT NOT NULL, "evidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_incident_evidences_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "vulnerabilities" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "source" TEXT NOT NULL, "cve" TEXT,
  "severity" "VulnerabilitySeverity" NOT NULL DEFAULT 'MEDIUM', "exposure" TEXT, "description" TEXT,
  "responsibleId" TEXT, "targetDate" TIMESTAMP(3), "status" "VulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "vulnerability_assets" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "vulnerabilityId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
  "exposure" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vulnerability_assets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "remediations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "vulnerabilityId" TEXT NOT NULL, "description" TEXT NOT NULL,
  "responsibleId" TEXT, "targetDate" TIMESTAMP(3), "status" "RemediationStatus" NOT NULL DEFAULT 'PLANNED', "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "remediations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "verifications" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "remediationId" TEXT NOT NULL, "result" "VerificationResult" NOT NULL,
  "notes" TEXT, "verifiedById" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "business_continuity_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "scope" TEXT,
  "ownerId" TEXT, "status" "ContinuityPlanStatus" NOT NULL DEFAULT 'DRAFT', "rtoMinutes" INTEGER, "rpoMinutes" INTEGER,
  "dependencies" TEXT, "reviewDate" TIMESTAMP(3), "nextReviewDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_continuity_plans_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "bcp_processes" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "processId" TEXT NOT NULL,
  "rtoMinutes" INTEGER, "rpoMinutes" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bcp_processes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "disaster_recovery_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "bcpId" TEXT,
  "ownerId" TEXT, "status" "ContinuityPlanStatus" NOT NULL DEFAULT 'DRAFT', "rtoMinutes" INTEGER, "rpoMinutes" INTEGER,
  "systems" TEXT, "dependencies" TEXT, "reviewDate" TIMESTAMP(3), "nextReviewDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "disaster_recovery_plans_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "continuity_scenarios" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "type" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "continuity_scenarios_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "continuity_tests" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "scenarioId" TEXT, "title" TEXT NOT NULL,
  "type" "ContinuityTestType" NOT NULL DEFAULT 'TABLETOP', "status" "ContinuityTestStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedDate" TIMESTAMP(3), "executedDate" TIMESTAMP(3), "responsibleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "continuity_tests_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "test_results" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "testId" TEXT NOT NULL, "outcome" "ContinuityTestOutcome" NOT NULL,
  "rtoAchievedMinutes" INTEGER, "rpoAchievedMinutes" INTEGER, "summary" TEXT, "evidenceId" TEXT, "testedById" TEXT NOT NULL,
  "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "improvement_actions" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "testResultId" TEXT NOT NULL, "description" TEXT NOT NULL,
  "responsibleId" TEXT, "targetDate" TIMESTAMP(3), "status" "ImprovementActionStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "improvement_actions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "supplier_security_profiles" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
  "securityCriticality" "SupplierCriticality" NOT NULL DEFAULT 'MEDIUM', "dataProcessed" TEXT, "accessGranted" TEXT,
  "obligations" TEXT, "controls" TEXT, "riskLevel" TEXT, "reviewDate" TIMESTAMP(3), "nextReviewDate" TIMESTAMP(3),
  "contractExpiry" TIMESTAMP(3), "evidenceId" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_security_profiles_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────
CREATE UNIQUE INDEX "security_incidents_organizationId_code_key" ON "security_incidents"("organizationId", "code");
CREATE INDEX "security_incidents_organizationId_status_idx" ON "security_incidents"("organizationId", "status");
CREATE INDEX "security_incidents_organizationId_severity_idx" ON "security_incidents"("organizationId", "severity");
CREATE UNIQUE INDEX "security_incident_assets_incidentId_assetId_key" ON "security_incident_assets"("incidentId", "assetId");
CREATE INDEX "security_incident_assets_organizationId_incidentId_idx" ON "security_incident_assets"("organizationId", "incidentId");
CREATE UNIQUE INDEX "security_incident_evidences_incidentId_evidenceId_key" ON "security_incident_evidences"("incidentId", "evidenceId");
CREATE INDEX "security_incident_evidences_organizationId_incidentId_idx" ON "security_incident_evidences"("organizationId", "incidentId");
CREATE UNIQUE INDEX "vulnerabilities_organizationId_code_key" ON "vulnerabilities"("organizationId", "code");
CREATE INDEX "vulnerabilities_organizationId_status_idx" ON "vulnerabilities"("organizationId", "status");
CREATE INDEX "vulnerabilities_organizationId_severity_idx" ON "vulnerabilities"("organizationId", "severity");
CREATE UNIQUE INDEX "vulnerability_assets_vulnerabilityId_assetId_key" ON "vulnerability_assets"("vulnerabilityId", "assetId");
CREATE INDEX "vulnerability_assets_organizationId_vulnerabilityId_idx" ON "vulnerability_assets"("organizationId", "vulnerabilityId");
CREATE INDEX "remediations_organizationId_vulnerabilityId_idx" ON "remediations"("organizationId", "vulnerabilityId");
CREATE INDEX "verifications_organizationId_remediationId_idx" ON "verifications"("organizationId", "remediationId");
CREATE UNIQUE INDEX "business_continuity_plans_organizationId_code_key" ON "business_continuity_plans"("organizationId", "code");
CREATE INDEX "business_continuity_plans_organizationId_status_idx" ON "business_continuity_plans"("organizationId", "status");
CREATE UNIQUE INDEX "bcp_processes_planId_processId_key" ON "bcp_processes"("planId", "processId");
CREATE INDEX "bcp_processes_organizationId_planId_idx" ON "bcp_processes"("organizationId", "planId");
CREATE UNIQUE INDEX "disaster_recovery_plans_organizationId_code_key" ON "disaster_recovery_plans"("organizationId", "code");
CREATE INDEX "disaster_recovery_plans_organizationId_status_idx" ON "disaster_recovery_plans"("organizationId", "status");
CREATE INDEX "continuity_scenarios_organizationId_planId_idx" ON "continuity_scenarios"("organizationId", "planId");
CREATE INDEX "continuity_tests_organizationId_planId_idx" ON "continuity_tests"("organizationId", "planId");
CREATE INDEX "continuity_tests_organizationId_status_idx" ON "continuity_tests"("organizationId", "status");
CREATE INDEX "test_results_organizationId_testId_idx" ON "test_results"("organizationId", "testId");
CREATE INDEX "improvement_actions_organizationId_testResultId_idx" ON "improvement_actions"("organizationId", "testResultId");
CREATE UNIQUE INDEX "supplier_security_profiles_supplierId_key" ON "supplier_security_profiles"("supplierId");
CREATE INDEX "supplier_security_profiles_organizationId_securityCriticality_idx" ON "supplier_security_profiles"("organizationId", "securityCriticality");
CREATE INDEX "supplier_security_profiles_organizationId_contractExpiry_idx" ON "supplier_security_profiles"("organizationId", "contractExpiry");

-- ─── GRANTS ──────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "security_incidents", "security_incident_assets", "security_incident_evidences",
  "vulnerabilities", "vulnerability_assets", "remediations", "verifications",
  "business_continuity_plans", "bcp_processes", "disaster_recovery_plans", "continuity_scenarios",
  "continuity_tests", "test_results", "improvement_actions", "supplier_security_profiles"
  TO authenticated;

-- ─── FOREIGN KEYS ────────────────────────────────────
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_incident_assets" ADD CONSTRAINT "security_incident_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incident_assets" ADD CONSTRAINT "security_incident_assets_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "security_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incident_assets" ADD CONSTRAINT "security_incident_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incident_evidences" ADD CONSTRAINT "security_incident_evidences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incident_evidences" ADD CONSTRAINT "security_incident_evidences_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "security_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incident_evidences" ADD CONSTRAINT "security_incident_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_remediationId_fkey" FOREIGN KEY ("remediationId") REFERENCES "remediations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_continuity_plans" ADD CONSTRAINT "business_continuity_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_continuity_plans" ADD CONSTRAINT "business_continuity_plans_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bcp_processes" ADD CONSTRAINT "bcp_processes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bcp_processes" ADD CONSTRAINT "bcp_processes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bcp_processes" ADD CONSTRAINT "bcp_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disaster_recovery_plans" ADD CONSTRAINT "disaster_recovery_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disaster_recovery_plans" ADD CONSTRAINT "disaster_recovery_plans_bcpId_fkey" FOREIGN KEY ("bcpId") REFERENCES "business_continuity_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disaster_recovery_plans" ADD CONSTRAINT "disaster_recovery_plans_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "continuity_scenarios" ADD CONSTRAINT "continuity_scenarios_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "continuity_scenarios" ADD CONSTRAINT "continuity_scenarios_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "continuity_tests" ADD CONSTRAINT "continuity_tests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "continuity_tests" ADD CONSTRAINT "continuity_tests_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "continuity_tests" ADD CONSTRAINT "continuity_tests_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "continuity_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "continuity_tests" ADD CONSTRAINT "continuity_tests_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "continuity_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "test_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_security_profiles" ADD CONSTRAINT "supplier_security_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_security_profiles" ADD CONSTRAINT "supplier_security_profiles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_security_profiles" ADD CONSTRAINT "supplier_security_profiles_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── TENANT CONSISTENCY + INCIDENT WORKFLOW ──────────
CREATE OR REPLACE FUNCTION public.nf_incident_status_ord(s "IncidentStatus") RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'DETECTED' THEN 1 WHEN 'TRIAGED' THEN 2 WHEN 'INVESTIGATING' THEN 3 WHEN 'CONTAINED' THEN 4 WHEN 'ERADICATED' THEN 5 WHEN 'RECOVERED' THEN 6 WHEN 'CLOSED' THEN 7 END
$$;

CREATE OR REPLACE FUNCTION public.nf_validate_secops_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'security_incidents' THEN
    IF NEW."reporterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."reporterId" AND active) THEN RAISE EXCEPTION 'Incident reporter is not an active organization member'; END IF;
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Incident responsible is not an active organization member'; END IF;
    IF TG_OP = 'UPDATE' AND NEW."status" <> OLD."status" THEN
      IF public.nf_incident_status_ord(NEW."status") <> public.nf_incident_status_ord(OLD."status") + 1 THEN
        RAISE EXCEPTION 'Invalid incident workflow transition % -> % (no skipping or reversing states)', OLD."status", NEW."status";
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'security_incident_assets' THEN
    SELECT "organizationId" INTO target_org FROM security_incidents WHERE id = NEW."incidentId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Incident asset belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_assets WHERE id = NEW."assetId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Affected asset belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'security_incident_evidences' THEN
    SELECT "organizationId" INTO target_org FROM security_incidents WHERE id = NEW."incidentId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Incident evidence belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Incident evidence file belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'vulnerabilities' THEN
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Vulnerability responsible is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'vulnerability_assets' THEN
    SELECT "organizationId" INTO target_org FROM vulnerabilities WHERE id = NEW."vulnerabilityId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Vulnerability asset belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_assets WHERE id = NEW."assetId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Vulnerable asset belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'remediations' THEN
    SELECT "organizationId" INTO target_org FROM vulnerabilities WHERE id = NEW."vulnerabilityId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Remediation vulnerability belongs to another organization'; END IF;
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Remediation responsible is not an active organization member'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Remediation evidence belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'verifications' THEN
    SELECT "organizationId" INTO target_org FROM remediations WHERE id = NEW."remediationId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Verification remediation belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."verifiedById" AND active) THEN RAISE EXCEPTION 'Verifier is not an active organization member'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Verification evidence belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'business_continuity_plans' THEN
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'BCP owner is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'bcp_processes' THEN
    SELECT "organizationId" INTO target_org FROM business_continuity_plans WHERE id = NEW."planId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'BCP process plan belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'BCP process belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'disaster_recovery_plans' THEN
    IF NEW."bcpId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM business_continuity_plans WHERE id = NEW."bcpId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'DRP linked BCP belongs to another organization'; END IF;
    IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."ownerId" AND active) THEN RAISE EXCEPTION 'DRP owner is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'continuity_scenarios' THEN
    SELECT "organizationId" INTO target_org FROM business_continuity_plans WHERE id = NEW."planId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Scenario plan belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'continuity_tests' THEN
    SELECT "organizationId" INTO target_org FROM business_continuity_plans WHERE id = NEW."planId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Test plan belongs to another organization'; END IF;
    IF NEW."scenarioId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM continuity_scenarios WHERE id = NEW."scenarioId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Test scenario belongs to another organization'; END IF;
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Test responsible is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'test_results' THEN
    SELECT "organizationId" INTO target_org FROM continuity_tests WHERE id = NEW."testId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Test result test belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."testedById" AND active) THEN RAISE EXCEPTION 'Tester is not an active organization member'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Test result evidence belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'improvement_actions' THEN
    SELECT "organizationId" INTO target_org FROM test_results WHERE id = NEW."testResultId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Improvement action result belongs to another organization'; END IF;
    IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."responsibleId" AND active) THEN RAISE EXCEPTION 'Improvement action responsible is not an active organization member'; END IF;
  ELSIF TG_TABLE_NAME = 'supplier_security_profiles' THEN
    IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = NEW."supplierId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Supplier belongs to another organization'; END IF;
    IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_files WHERE id = NEW."evidenceId" AND "organizationId" = NEW."organizationId" AND "deletedAt" IS NULL) THEN RAISE EXCEPTION 'Supplier security evidence belongs to another organization'; END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['security_incidents','security_incident_assets','security_incident_evidences','vulnerabilities','vulnerability_assets','remediations','verifications','business_continuity_plans','bcp_processes','disaster_recovery_plans','continuity_scenarios','continuity_tests','test_results','improvement_actions','supplier_security_profiles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nf_%s_tenant_refs ON %I', t, t);
    EXECUTE format('CREATE TRIGGER nf_%s_tenant_refs BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.nf_validate_secops_tenant()', t, t);
  END LOOP;
END $$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
DO $$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('security_incidents','incidents','create'),
    ('security_incident_assets','incidents','update'),
    ('security_incident_evidences','incidents','update'),
    ('vulnerabilities','vulnerabilities','create'),
    ('vulnerability_assets','vulnerabilities','update'),
    ('remediations','vulnerabilities','update'),
    ('verifications','vulnerabilities','update'),
    ('business_continuity_plans','continuity','create'),
    ('bcp_processes','continuity','update'),
    ('disaster_recovery_plans','continuity','create'),
    ('continuity_scenarios','continuity','update'),
    ('continuity_tests','continuity','update'),
    ('test_results','continuity','update'),
    ('improvement_actions','continuity','update'),
    ('supplier_security_profiles','suppliers','update')
  ) AS s(tbl, module, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, spec.module||':read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, spec.module||':'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, spec.module||':update', spec.module||':update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, spec.module||':delete');
  END LOOP;
END $$;

-- Keep Supabase direct authorization aligned with the server matrix: add
-- incidents:*, vulnerabilities:*, continuity:* (carries forward all prior modules).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
