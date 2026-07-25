-- Paquete de Continuidad del Negocio (ISO 22301).
--
-- Amplía el módulo de continuidad existente en lugar de duplicarlo:
--   · `business_continuity_plans` gana versión, aprobación y ACTIVACIÓN.
--   · `continuity_scenarios` y `continuity_tests` ganan caracterización y diseño
--     del simulacro (el "ejercicio" y su "resultado" ya existían como
--     ContinuityTest / TestResult, con ImprovementAction para las mejoras).
-- Se añaden los modelos que faltaban: BIA, actividades críticas, priorización de
-- productos/servicios, dependencias, recursos, estrategias, procedimientos de
-- recuperación, equipos de crisis, contactos y árbol de comunicación.
--
-- Reutiliza por id (validado por organización en las Server Actions) los módulos
-- de procesos, riesgos, activos, proveedores, incidentes, documentos y evidencias.

-- CreateEnum
CREATE TYPE "BiaStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CriticalityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('PEOPLE', 'FACILITY', 'TECHNOLOGY', 'SUPPLIER', 'DATA', 'EQUIPMENT', 'UTILITY', 'PROCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PEOPLE', 'FACILITY', 'TECHNOLOGY', 'EQUIPMENT', 'DATA', 'SUPPLIER', 'FINANCIAL', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('PREVENT', 'MITIGATE', 'REDUNDANCY', 'RELOCATION', 'OUTSOURCING', 'MANUAL_WORKAROUND', 'INSURANCE', 'ACCEPT');

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('PROPOSED', 'APPROVED', 'IMPLEMENTED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('INTERNAL', 'EXTERNAL', 'SUPPLIER', 'AUTHORITY', 'CUSTOMER');

-- AlterTable
ALTER TABLE "business_continuity_plans" ADD COLUMN     "activated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedById" TEXT,
ADD COLUMN     "activationReason" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "invocationCriteria" TEXT,
ADD COLUMN     "minimumServiceLevel" TEXT,
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0';

-- AlterTable
ALTER TABLE "continuity_scenarios" ADD COLUMN     "affectedResources" TEXT,
ADD COLUMN     "assumptions" TEXT,
ADD COLUMN     "likelihood" INTEGER,
ADD COLUMN     "riskId" TEXT,
ADD COLUMN     "severity" INTEGER;

-- AlterTable
ALTER TABLE "continuity_tests" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "participants" TEXT,
ADD COLUMN     "scopeDescription" TEXT,
ADD COLUMN     "targetRpoMinutes" INTEGER,
ADD COLUMN     "targetRtoMinutes" INTEGER;

-- CreateTable
CREATE TABLE "continuity_plan_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changeSummary" TEXT,
    "content" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "continuity_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_activations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scenarioId" TEXT,
    "incidentId" TEXT,
    "activatedById" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "lessonsLearned" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_impact_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "methodology" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" "BiaStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "performedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "critical_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "biaId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processId" TEXT,
    "ownerId" TEXT,
    "mtpdMinutes" INTEGER,
    "rtoMinutes" INTEGER,
    "rpoMinutes" INTEGER,
    "minimumServiceLevel" TEXT,
    "financialImpact" INTEGER NOT NULL DEFAULT 0,
    "operationalImpact" INTEGER NOT NULL DEFAULT 0,
    "legalImpact" INTEGER NOT NULL DEFAULT 0,
    "reputationalImpact" INTEGER NOT NULL DEFAULT 0,
    "peopleImpact" INTEGER NOT NULL DEFAULT 0,
    "impactScore" INTEGER NOT NULL DEFAULT 0,
    "criticality" "CriticalityLevel" NOT NULL DEFAULT 'LOW',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "peakPeriods" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "critical_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_service_priorities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "biaId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "criticality" "CriticalityLevel" NOT NULL DEFAULT 'LOW',
    "mtpdMinutes" INTEGER,
    "rtoMinutes" INTEGER,
    "minimumServiceLevel" TEXT,
    "revenueShare" DOUBLE PRECISION,
    "customersAffected" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_service_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_dependencies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processId" TEXT,
    "assetId" TEXT,
    "supplierId" TEXT,
    "personnelId" TEXT,
    "locationId" TEXT,
    "criticality" "CriticalityLevel" NOT NULL DEFAULT 'MEDIUM',
    "maxOutageMinutes" INTEGER,
    "alternative" TEXT,
    "singlePointOfFailure" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "normalQuantity" INTEGER,
    "minimumQuantity" INTEGER,
    "unit" TEXT,
    "availableAt" TEXT,
    "alternativeResource" TEXT,
    "leadTimeMinutes" INTEGER,
    "supplierId" TEXT,
    "assetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuity_strategies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "activityId" TEXT,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "type" "StrategyType" NOT NULL DEFAULT 'MITIGATE',
    "description" TEXT,
    "achievesRtoMinutes" INTEGER,
    "achievesRpoMinutes" INTEGER,
    "cost" DOUBLE PRECISION,
    "status" "StrategyStatus" NOT NULL DEFAULT 'PROPOSED',
    "ownerId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "resourcesNeeded" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_procedures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT,
    "activityId" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "steps" TEXT,
    "documentId" TEXT,
    "responsibleId" TEXT,
    "estimatedMinutes" INTEGER,
    "prerequisites" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "lastTestedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crisis_teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "planId" TEXT,
    "leaderId" TEXT,
    "deputyId" TEXT,
    "activationRule" TEXT,
    "meetingPoint" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crisis_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crisis_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "type" "ContactType" NOT NULL DEFAULT 'INTERNAL',
    "userId" TEXT,
    "personnelId" TEXT,
    "supplierId" TEXT,
    "primaryPhone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "escalationOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeputy" BOOLEAN NOT NULL DEFAULT false,
    "availability" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crisis_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_trees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "contactId" TEXT,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "audience" TEXT,
    "channel" TEXT,
    "messageTemplate" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxDelayMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_trees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "continuity_plan_versions_organizationId_planId_idx" ON "continuity_plan_versions"("organizationId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "continuity_plan_versions_planId_version_key" ON "continuity_plan_versions"("planId", "version");

-- CreateIndex
CREATE INDEX "plan_activations_organizationId_planId_idx" ON "plan_activations"("organizationId", "planId");

-- CreateIndex
CREATE INDEX "plan_activations_organizationId_activatedAt_idx" ON "plan_activations"("organizationId", "activatedAt");

-- CreateIndex
CREATE INDEX "business_impact_analyses_organizationId_status_idx" ON "business_impact_analyses"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_impact_analyses_organizationId_code_key" ON "business_impact_analyses"("organizationId", "code");

-- CreateIndex
CREATE INDEX "critical_activities_organizationId_criticality_idx" ON "critical_activities"("organizationId", "criticality");

-- CreateIndex
CREATE INDEX "critical_activities_organizationId_biaId_idx" ON "critical_activities"("organizationId", "biaId");

-- CreateIndex
CREATE UNIQUE INDEX "critical_activities_organizationId_code_key" ON "critical_activities"("organizationId", "code");

-- CreateIndex
CREATE INDEX "product_service_priorities_organizationId_priority_idx" ON "product_service_priorities"("organizationId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "product_service_priorities_organizationId_code_key" ON "product_service_priorities"("organizationId", "code");

-- CreateIndex
CREATE INDEX "business_dependencies_organizationId_activityId_idx" ON "business_dependencies"("organizationId", "activityId");

-- CreateIndex
CREATE INDEX "business_dependencies_organizationId_type_idx" ON "business_dependencies"("organizationId", "type");

-- CreateIndex
CREATE INDEX "resource_requirements_organizationId_activityId_idx" ON "resource_requirements"("organizationId", "activityId");

-- CreateIndex
CREATE INDEX "resource_requirements_organizationId_type_idx" ON "resource_requirements"("organizationId", "type");

-- CreateIndex
CREATE INDEX "continuity_strategies_organizationId_status_idx" ON "continuity_strategies"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "continuity_strategies_organizationId_code_key" ON "continuity_strategies"("organizationId", "code");

-- CreateIndex
CREATE INDEX "recovery_procedures_organizationId_planId_idx" ON "recovery_procedures"("organizationId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_procedures_organizationId_code_key" ON "recovery_procedures"("organizationId", "code");

-- CreateIndex
CREATE INDEX "crisis_teams_organizationId_idx" ON "crisis_teams"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "crisis_teams_organizationId_code_key" ON "crisis_teams"("organizationId", "code");

-- CreateIndex
CREATE INDEX "crisis_contacts_organizationId_teamId_idx" ON "crisis_contacts"("organizationId", "teamId");

-- CreateIndex
CREATE INDEX "communication_trees_organizationId_teamId_idx" ON "communication_trees"("organizationId", "teamId");

-- CreateIndex
CREATE INDEX "communication_trees_parentId_idx" ON "communication_trees"("parentId");

-- CreateIndex
CREATE INDEX "business_continuity_plans_organizationId_activated_idx" ON "business_continuity_plans"("organizationId", "activated");

-- AddForeignKey
ALTER TABLE "business_continuity_plans" ADD CONSTRAINT "business_continuity_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_continuity_plans" ADD CONSTRAINT "business_continuity_plans_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_plan_versions" ADD CONSTRAINT "continuity_plan_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_plan_versions" ADD CONSTRAINT "continuity_plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_plan_versions" ADD CONSTRAINT "continuity_plan_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_plan_versions" ADD CONSTRAINT "continuity_plan_versions_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_activations" ADD CONSTRAINT "plan_activations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_activations" ADD CONSTRAINT "plan_activations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_activations" ADD CONSTRAINT "plan_activations_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "continuity_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_activations" ADD CONSTRAINT "plan_activations_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_activations" ADD CONSTRAINT "plan_activations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_impact_analyses" ADD CONSTRAINT "business_impact_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_impact_analyses" ADD CONSTRAINT "business_impact_analyses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_impact_analyses" ADD CONSTRAINT "business_impact_analyses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_impact_analyses" ADD CONSTRAINT "business_impact_analyses_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_activities" ADD CONSTRAINT "critical_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_activities" ADD CONSTRAINT "critical_activities_biaId_fkey" FOREIGN KEY ("biaId") REFERENCES "business_impact_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_activities" ADD CONSTRAINT "critical_activities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_service_priorities" ADD CONSTRAINT "product_service_priorities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_service_priorities" ADD CONSTRAINT "product_service_priorities_biaId_fkey" FOREIGN KEY ("biaId") REFERENCES "business_impact_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_dependencies" ADD CONSTRAINT "business_dependencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_dependencies" ADD CONSTRAINT "business_dependencies_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "critical_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requirements" ADD CONSTRAINT "resource_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requirements" ADD CONSTRAINT "resource_requirements_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "critical_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_strategies" ADD CONSTRAINT "continuity_strategies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_strategies" ADD CONSTRAINT "continuity_strategies_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "critical_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_strategies" ADD CONSTRAINT "continuity_strategies_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_strategies" ADD CONSTRAINT "continuity_strategies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_strategies" ADD CONSTRAINT "continuity_strategies_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_procedures" ADD CONSTRAINT "recovery_procedures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_procedures" ADD CONSTRAINT "recovery_procedures_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_procedures" ADD CONSTRAINT "recovery_procedures_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "critical_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_procedures" ADD CONSTRAINT "recovery_procedures_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_teams" ADD CONSTRAINT "crisis_teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_teams" ADD CONSTRAINT "crisis_teams_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_continuity_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_teams" ADD CONSTRAINT "crisis_teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_teams" ADD CONSTRAINT "crisis_teams_deputyId_fkey" FOREIGN KEY ("deputyId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_contacts" ADD CONSTRAINT "crisis_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_contacts" ADD CONSTRAINT "crisis_contacts_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "crisis_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_contacts" ADD CONSTRAINT "crisis_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_trees" ADD CONSTRAINT "communication_trees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_trees" ADD CONSTRAINT "communication_trees_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "crisis_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_trees" ADD CONSTRAINT "communication_trees_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crisis_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_trees" ADD CONSTRAINT "communication_trees_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "communication_trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "control_reviews_organizationId_organizationControlId_reviewedAt" RENAME TO "control_reviews_organizationId_organizationControlId_review_idx";

-- RenameIndex
ALTER INDEX "environmental_compliance_evaluations_org_obl_at_idx" RENAME TO "environmental_compliance_evaluations_organizationId_obligat_idx";

-- RenameIndex
ALTER INDEX "environmental_compliance_obligations_org_reviewDate_idx" RENAME TO "environmental_compliance_obligations_organizationId_reviewD_idx";

-- RenameIndex
ALTER INDEX "environmental_significance_methods_org_name_version_key" RENAME TO "environmental_significance_methods_organizationId_name_vers_key";

-- RenameIndex
ALTER INDEX "evidence_management_review_links_evidenceId_managementReviewId_" RENAME TO "evidence_management_review_links_evidenceId_managementRevie_key";

-- RenameIndex
ALTER INDEX "evidence_management_review_links_organizationId_managementRevie" RENAME TO "evidence_management_review_links_organizationId_managementR_idx";

-- RenameIndex
ALTER INDEX "occ_health_surveillance_org_fitness_idx" RENAME TO "occupational_health_surveillance_organizationId_fitness_idx";

-- RenameIndex
ALTER INDEX "occ_health_surveillance_org_nextReview_idx" RENAME TO "occupational_health_surveillance_organizationId_nextReviewD_idx";

-- RenameIndex
ALTER INDEX "occupational_risk_assessments_org_acceptability_idx" RENAME TO "occupational_risk_assessments_organizationId_acceptability_idx";

-- RenameIndex
ALTER INDEX "occupational_risk_assessments_org_inherentLevel_idx" RENAME TO "occupational_risk_assessments_organizationId_inherentLevel_idx";

-- RenameIndex
ALTER INDEX "supplier_security_profiles_organizationId_securityCriticality_i" RENAME TO "supplier_security_profiles_organizationId_securityCriticali_idx";


-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."business_impact_analyses", public."critical_activities",
      public."product_service_priorities", public."business_dependencies",
      public."resource_requirements", public."continuity_strategies",
      public."recovery_procedures", public."crisis_teams", public."crisis_contacts",
      public."communication_trees", public."continuity_plan_versions",
      public."plan_activations"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
-- Reutiliza el módulo de permisos `continuity:*` ya existente en la matriz.
DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('business_impact_analyses','create'),
      ('critical_activities','create'),
      ('product_service_priorities','create'),
      ('business_dependencies','update'),
      ('resource_requirements','update'),
      ('continuity_strategies','create'),
      ('recovery_procedures','create'),
      ('crisis_teams','create'),
      ('crisis_contacts','update'),
      ('communication_trees','update'),
      ('continuity_plan_versions','update'),
      ('plan_activations','update')
    ) AS s(tbl, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_select', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_insert', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_update', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_delete', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, 'continuity:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, 'continuity:'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, 'continuity:update', 'continuity:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, 'continuity:delete');
  END LOOP;
END $$;
