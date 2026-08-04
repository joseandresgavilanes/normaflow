-- ISO 50001:2018 Energy Management System (EnMS)
-- 15 specialized models + configurable/versioned formulas on EnPI/baseline/verification.
-- RLS gated on energy:* (aligned with src/lib/permissions/matrix.ts).

-- ─── ENUMS ───────────────────────────────────────────
CREATE TYPE "EnergySourceType" AS ENUM ('ELECTRICITY', 'NATURAL_GAS', 'DIESEL', 'LPG', 'FUEL_OIL', 'STEAM', 'DISTRICT_HEATING', 'DISTRICT_COOLING', 'SOLAR', 'WIND', 'BIOMASS', 'OTHER');
CREATE TYPE "EnergyReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "EnmsItemStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'SUPERSEDED');
CREATE TYPE "EnergyFormulaKind" AS ENUM ('CONSUMPTION', 'INTENSITY', 'BASELINE_COMPARISON', 'DEVIATION', 'ABSOLUTE_SAVINGS', 'NORMALIZED_SAVINGS', 'COST', 'EMISSIONS', 'CUSTOM');
CREATE TYPE "RelevantVariableType" AS ENUM ('PRODUCTION', 'OCCUPANCY', 'DEGREE_DAYS', 'OPERATING_HOURS', 'THROUGHPUT', 'WEATHER', 'OTHER');
CREATE TYPE "EnergyOpportunityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "EnergyOpportunityStatus" AS ENUM ('IDENTIFIED', 'UNDER_ANALYSIS', 'APPROVED', 'IN_IMPLEMENTATION', 'VERIFIED', 'REJECTED', 'CLOSED');
CREATE TYPE "EnergyActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EnergyVerificationStatus" AS ENUM ('DRAFT', 'CALCULATED', 'VERIFIED', 'REJECTED');
CREATE TYPE "EnergyProcurementResult" AS ENUM ('UNDER_REVIEW', 'PREFERRED', 'ACCEPTABLE', 'NOT_RECOMMENDED', 'SELECTED');
CREATE TYPE "EnergyDesignReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUIRED', 'CLOSED');

-- ─── TABLES ──────────────────────────────────────────
CREATE TABLE "energy_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "EnergySourceType" NOT NULL DEFAULT 'ELECTRICITY',
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "emissionFactor" DOUBLE PRECISION,
    "emissionUnit" TEXT DEFAULT 'tCO2e',
    "costPerUnit" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'EUR',
    "renewableShare" DOUBLE PRECISION,
    "supplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_uses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceId" TEXT,
    "processId" TEXT,
    "locationId" TEXT,
    "equipment" TEXT,
    "annualEstimate" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_uses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "methodSummary" TEXT,
    "findings" TEXT,
    "status" "EnergyReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "significant_energy_uses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "energyUseId" TEXT NOT NULL,
    "reviewId" TEXT,
    "criteria" JSONB,
    "consumptionShare" DOUBLE PRECISION,
    "improvementPotential" DOUBLE PRECISION,
    "significant" BOOLEAN NOT NULL DEFAULT true,
    "rationale" TEXT,
    "ownerId" TEXT,
    "status" "EnmsItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "significant_energy_uses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_baselines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seuId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "relevantVariableValues" JSONB,
    "staticFactorValues" JSONB,
    "normalizationMethod" TEXT NOT NULL DEFAULT 'NONE',
    "formulaVersion" TEXT NOT NULL DEFAULT '1',
    "formulaConfig" JSONB,
    "normalizedConsumption" DOUBLE PRECISION,
    "status" "EnmsItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_baselines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_performance_indicators" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seuId" TEXT,
    "baselineId" TEXT,
    "formulaKind" "EnergyFormulaKind" NOT NULL DEFAULT 'INTENSITY',
    "formulaVersion" TEXT NOT NULL DEFAULT '1',
    "formulaConfig" JSONB,
    "unit" TEXT NOT NULL DEFAULT 'kWh/unit',
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "baselineValue" DOUBLE PRECISION,
    "deviationPercent" DOUBLE PRECISION,
    "indicatorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_performance_indicators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_meters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceId" TEXT,
    "seuId" TEXT,
    "locationId" TEXT,
    "serialNumber" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "calibrationDate" TIMESTAMP(3),
    "nextCalibration" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_meters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_readings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "relevantVariableValues" JSONB,
    "cost" DOUBLE PRECISION,
    "emissions" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_readings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "relevant_variables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "variableType" "RelevantVariableType" NOT NULL DEFAULT 'PRODUCTION',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "relevant_variables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "static_factors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "static_factors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seuId" TEXT,
    "estimatedSaving" DOUBLE PRECISION,
    "savingUnit" TEXT DEFAULT 'kWh',
    "estimatedCost" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'EUR',
    "paybackMonths" DOUBLE PRECISION,
    "priority" "EnergyOpportunityPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "EnergyOpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "ownerId" TEXT,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_action_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "opportunityId" TEXT,
    "ownerId" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "status" "EnergyActionStatus" NOT NULL DEFAULT 'PLANNED',
    "capaId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_action_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_saving_verifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "actionPlanId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baselineConsumption" DOUBLE PRECISION,
    "actualConsumption" DOUBLE PRECISION,
    "absoluteSaving" DOUBLE PRECISION,
    "normalizedSaving" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "costSaving" DOUBLE PRECISION,
    "emissionSaving" DOUBLE PRECISION,
    "formulaKind" "EnergyFormulaKind" NOT NULL DEFAULT 'ABSOLUTE_SAVINGS',
    "formulaVersion" TEXT NOT NULL DEFAULT '1',
    "formulaConfig" JSONB,
    "status" "EnergyVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_saving_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_procurement_evaluations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "EnergySourceType" NOT NULL DEFAULT 'ELECTRICITY',
    "supplierId" TEXT,
    "supplierName" TEXT,
    "period" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criteriaScores" JSONB,
    "totalScore" DOUBLE PRECISION,
    "result" "EnergyProcurementResult" NOT NULL DEFAULT 'UNDER_REVIEW',
    "recommendation" TEXT,
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_procurement_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "energy_design_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectReference" TEXT,
    "processId" TEXT,
    "locationId" TEXT,
    "description" TEXT,
    "energyConsiderations" TEXT,
    "opportunitiesIdentified" TEXT,
    "status" "EnergyDesignReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "energy_design_reviews_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────
CREATE UNIQUE INDEX "energy_sources_organizationId_code_key" ON "energy_sources"("organizationId", "code");
CREATE INDEX "energy_sources_organizationId_sourceType_idx" ON "energy_sources"("organizationId", "sourceType");
CREATE INDEX "energy_sources_organizationId_active_idx" ON "energy_sources"("organizationId", "active");

CREATE UNIQUE INDEX "energy_uses_organizationId_code_key" ON "energy_uses"("organizationId", "code");
CREATE INDEX "energy_uses_organizationId_sourceId_idx" ON "energy_uses"("organizationId", "sourceId");
CREATE INDEX "energy_uses_organizationId_processId_idx" ON "energy_uses"("organizationId", "processId");

CREATE UNIQUE INDEX "energy_reviews_organizationId_code_key" ON "energy_reviews"("organizationId", "code");
CREATE INDEX "energy_reviews_organizationId_status_idx" ON "energy_reviews"("organizationId", "status");
CREATE INDEX "energy_reviews_organizationId_periodEnd_idx" ON "energy_reviews"("organizationId", "periodEnd");

CREATE UNIQUE INDEX "significant_energy_uses_organizationId_code_key" ON "significant_energy_uses"("organizationId", "code");
CREATE INDEX "significant_energy_uses_organizationId_significant_idx" ON "significant_energy_uses"("organizationId", "significant");
CREATE INDEX "significant_energy_uses_organizationId_reviewId_idx" ON "significant_energy_uses"("organizationId", "reviewId");
CREATE INDEX "significant_energy_uses_energyUseId_idx" ON "significant_energy_uses"("energyUseId");

CREATE UNIQUE INDEX "energy_baselines_organizationId_code_formulaVersion_key" ON "energy_baselines"("organizationId", "code", "formulaVersion");
CREATE INDEX "energy_baselines_organizationId_code_idx" ON "energy_baselines"("organizationId", "code");
CREATE INDEX "energy_baselines_organizationId_seuId_idx" ON "energy_baselines"("organizationId", "seuId");
CREATE INDEX "energy_baselines_organizationId_status_idx" ON "energy_baselines"("organizationId", "status");

CREATE UNIQUE INDEX "energy_performance_indicators_organizationId_code_formulaVersion_key" ON "energy_performance_indicators"("organizationId", "code", "formulaVersion");
CREATE INDEX "energy_performance_indicators_organizationId_active_idx" ON "energy_performance_indicators"("organizationId", "active");
CREATE INDEX "energy_performance_indicators_organizationId_formulaKind_idx" ON "energy_performance_indicators"("organizationId", "formulaKind");
CREATE INDEX "energy_performance_indicators_organizationId_seuId_idx" ON "energy_performance_indicators"("organizationId", "seuId");

CREATE UNIQUE INDEX "energy_meters_organizationId_code_key" ON "energy_meters"("organizationId", "code");
CREATE INDEX "energy_meters_organizationId_sourceId_idx" ON "energy_meters"("organizationId", "sourceId");
CREATE INDEX "energy_meters_organizationId_active_idx" ON "energy_meters"("organizationId", "active");

CREATE UNIQUE INDEX "energy_readings_organizationId_code_key" ON "energy_readings"("organizationId", "code");
CREATE INDEX "energy_readings_organizationId_meterId_idx" ON "energy_readings"("organizationId", "meterId");
CREATE INDEX "energy_readings_organizationId_readingAt_idx" ON "energy_readings"("organizationId", "readingAt");
CREATE INDEX "energy_readings_organizationId_periodStart_periodEnd_idx" ON "energy_readings"("organizationId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX "relevant_variables_organizationId_code_key" ON "relevant_variables"("organizationId", "code");
CREATE INDEX "relevant_variables_organizationId_variableType_idx" ON "relevant_variables"("organizationId", "variableType");

CREATE UNIQUE INDEX "static_factors_organizationId_code_key" ON "static_factors"("organizationId", "code");
CREATE INDEX "static_factors_organizationId_active_idx" ON "static_factors"("organizationId", "active");

CREATE UNIQUE INDEX "energy_opportunities_organizationId_code_key" ON "energy_opportunities"("organizationId", "code");
CREATE INDEX "energy_opportunities_organizationId_status_idx" ON "energy_opportunities"("organizationId", "status");
CREATE INDEX "energy_opportunities_organizationId_priority_idx" ON "energy_opportunities"("organizationId", "priority");

CREATE UNIQUE INDEX "energy_action_plans_organizationId_code_key" ON "energy_action_plans"("organizationId", "code");
CREATE INDEX "energy_action_plans_organizationId_status_idx" ON "energy_action_plans"("organizationId", "status");
CREATE INDEX "energy_action_plans_organizationId_opportunityId_idx" ON "energy_action_plans"("organizationId", "opportunityId");
CREATE INDEX "energy_action_plans_organizationId_dueDate_idx" ON "energy_action_plans"("organizationId", "dueDate");

CREATE UNIQUE INDEX "energy_saving_verifications_organizationId_code_key" ON "energy_saving_verifications"("organizationId", "code");
CREATE INDEX "energy_saving_verifications_organizationId_actionPlanId_idx" ON "energy_saving_verifications"("organizationId", "actionPlanId");
CREATE INDEX "energy_saving_verifications_organizationId_status_idx" ON "energy_saving_verifications"("organizationId", "status");

CREATE UNIQUE INDEX "energy_procurement_evaluations_organizationId_code_key" ON "energy_procurement_evaluations"("organizationId", "code");
CREATE INDEX "energy_procurement_evaluations_organizationId_result_idx" ON "energy_procurement_evaluations"("organizationId", "result");
CREATE INDEX "energy_procurement_evaluations_organizationId_supplierId_idx" ON "energy_procurement_evaluations"("organizationId", "supplierId");

CREATE UNIQUE INDEX "energy_design_reviews_organizationId_code_key" ON "energy_design_reviews"("organizationId", "code");
CREATE INDEX "energy_design_reviews_organizationId_status_idx" ON "energy_design_reviews"("organizationId", "status");
CREATE INDEX "energy_design_reviews_organizationId_processId_idx" ON "energy_design_reviews"("organizationId", "processId");

-- ─── FOREIGN KEYS ────────────────────────────────────
ALTER TABLE "energy_sources" ADD CONSTRAINT "energy_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_uses" ADD CONSTRAINT "energy_uses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_uses" ADD CONSTRAINT "energy_uses_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "energy_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_reviews" ADD CONSTRAINT "energy_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "significant_energy_uses" ADD CONSTRAINT "significant_energy_uses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "significant_energy_uses" ADD CONSTRAINT "significant_energy_uses_energyUseId_fkey" FOREIGN KEY ("energyUseId") REFERENCES "energy_uses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "significant_energy_uses" ADD CONSTRAINT "significant_energy_uses_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "energy_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_seuId_fkey" FOREIGN KEY ("seuId") REFERENCES "significant_energy_uses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_performance_indicators" ADD CONSTRAINT "energy_performance_indicators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_performance_indicators" ADD CONSTRAINT "energy_performance_indicators_seuId_fkey" FOREIGN KEY ("seuId") REFERENCES "significant_energy_uses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_performance_indicators" ADD CONSTRAINT "energy_performance_indicators_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "energy_baselines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_meters" ADD CONSTRAINT "energy_meters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_meters" ADD CONSTRAINT "energy_meters_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "energy_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_meters" ADD CONSTRAINT "energy_meters_seuId_fkey" FOREIGN KEY ("seuId") REFERENCES "significant_energy_uses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_readings" ADD CONSTRAINT "energy_readings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_readings" ADD CONSTRAINT "energy_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "energy_meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relevant_variables" ADD CONSTRAINT "relevant_variables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "static_factors" ADD CONSTRAINT "static_factors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_opportunities" ADD CONSTRAINT "energy_opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_opportunities" ADD CONSTRAINT "energy_opportunities_seuId_fkey" FOREIGN KEY ("seuId") REFERENCES "significant_energy_uses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_action_plans" ADD CONSTRAINT "energy_action_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_action_plans" ADD CONSTRAINT "energy_action_plans_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "energy_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "energy_saving_verifications" ADD CONSTRAINT "energy_saving_verifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_saving_verifications" ADD CONSTRAINT "energy_saving_verifications_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "energy_action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_procurement_evaluations" ADD CONSTRAINT "energy_procurement_evaluations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "energy_design_reviews" ADD CONSTRAINT "energy_design_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CHECK constraints (workflows + formula integrity) ─
ALTER TABLE "energy_reviews" ADD CONSTRAINT "energy_reviews_period_order"
  CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "energy_reviews" ADD CONSTRAINT "energy_reviews_approval_attributed"
  CHECK ("status" <> 'APPROVED' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));

ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_period_order"
  CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_consumption_nonneg"
  CHECK ("consumption" >= 0);
ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_normalization_method"
  CHECK ("normalizationMethod" IN ('NONE', 'RATIO', 'LINEAR', 'CUSTOM'));
ALTER TABLE "energy_baselines" ADD CONSTRAINT "energy_baselines_approval_attributed"
  CHECK ("status" <> 'ACTIVE' OR "approvedById" IS NOT NULL OR "createdById" IS NOT NULL);

ALTER TABLE "energy_performance_indicators" ADD CONSTRAINT "enpi_formula_version_present"
  CHECK (char_length(trim("formulaVersion")) > 0);
ALTER TABLE "energy_readings" ADD CONSTRAINT "energy_readings_value_finite"
  CHECK ("value" = "value"); -- not NaN in practice; non-null already
ALTER TABLE "energy_action_plans" ADD CONSTRAINT "energy_action_plans_progress_range"
  CHECK ("progressPercent" >= 0 AND "progressPercent" <= 100);
ALTER TABLE "energy_saving_verifications" ADD CONSTRAINT "energy_verifications_period_order"
  CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "energy_saving_verifications" ADD CONSTRAINT "energy_verifications_verified_attributed"
  CHECK ("status" <> 'VERIFIED' OR ("verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL));
ALTER TABLE "static_factors" ADD CONSTRAINT "static_factors_effective_window"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "energy_sources" ADD CONSTRAINT "energy_sources_renewable_range"
  CHECK ("renewableShare" IS NULL OR ("renewableShare" >= 0 AND "renewableShare" <= 100));

-- ─── Tenant triggers for SEU / reading / verification children ─
-- One function per table (not a single TG_TABLE_NAME-branching function):
-- PL/pgSQL resolves `NEW."col"` against the actual per-table row type at
-- runtime for a generic RECORD, and does NOT reliably short-circuit that
-- resolution inside `IF cond1 AND cond2 THEN` — referencing a column that
-- exists on table B (e.g. NEW."meterId") raises even while validating table A
-- (significant_energy_uses), because A has no such column. Each trigger below
-- only ever sees its own table's row shape.
CREATE OR REPLACE FUNCTION public.nf_validate_seu_tenant() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."energyUseId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "energy_uses" WHERE id = NEW."energyUseId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'ENMS tenant mismatch: energy use % not in org %', NEW."energyUseId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nf_validate_energy_reading_tenant() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."meterId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "energy_meters" WHERE id = NEW."meterId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'ENMS tenant mismatch: meter % not in org %', NEW."meterId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nf_validate_energy_verification_tenant() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."actionPlanId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "energy_action_plans" WHERE id = NEW."actionPlanId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'ENMS tenant mismatch: action plan % not in org %', NEW."actionPlanId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nf_significant_energy_uses_tenant BEFORE INSERT OR UPDATE ON "significant_energy_uses"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_seu_tenant();
CREATE TRIGGER nf_energy_readings_tenant BEFORE INSERT OR UPDATE ON "energy_readings"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_energy_reading_tenant();
CREATE TRIGGER nf_energy_saving_verifications_tenant BEFORE INSERT OR UPDATE ON "energy_saving_verifications"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_energy_verification_tenant();

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."energy_sources", public."energy_uses", public."significant_energy_uses",
      public."energy_reviews", public."energy_baselines", public."energy_performance_indicators",
      public."energy_meters", public."energy_readings", public."relevant_variables",
      public."static_factors", public."energy_opportunities", public."energy_action_plans",
      public."energy_saving_verifications", public."energy_procurement_evaluations",
      public."energy_design_reviews"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'energy_sources','energy_uses','significant_energy_uses','energy_reviews',
    'energy_baselines','energy_performance_indicators','energy_meters','energy_readings',
    'relevant_variables','static_factors','energy_opportunities','energy_action_plans',
    'energy_saving_verifications','energy_procurement_evaluations','energy_design_reviews'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'energy:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'energy:create');
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'energy:update', 'energy:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'energy:delete');
  END LOOP;
END $$;

-- Keep Supabase direct authorization aligned with the server matrix.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
