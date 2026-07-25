-- ISO 22000 / HACCP Food Safety Management System
-- RLS gated on food-safety:*

CREATE TYPE "FoodHazardType" AS ENUM ('BIOLOGICAL', 'CHEMICAL', 'PHYSICAL', 'ALLERGEN');
CREATE TYPE "HazardControlDecision" AS ENUM ('NONE', 'PRP', 'OPRP', 'CCP');
CREATE TYPE "FoodAssessmentStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "FoodFlowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "FoodStepType" AS ENUM ('RECEIPT', 'STORAGE', 'PREP', 'PROCESS', 'COOKING', 'COOLING', 'PACKAGING', 'DISTRIBUTION', 'OTHER');
CREATE TYPE "PrpCategory" AS ENUM ('HYGIENE', 'PEST_CONTROL', 'WATER', 'CLEANING', 'MAINTENANCE', 'PERSONNEL', 'SUPPLIER', 'WASTE', 'ALLERGEN_CONTROL', 'OTHER');
CREATE TYPE "LimitOperator" AS ENUM ('LT', 'LTE', 'GT', 'GTE', 'EQ', 'BETWEEN');
CREATE TYPE "DeviationStatus" AS ENUM ('OPEN', 'UNDER_CORRECTION', 'CORRECTED', 'VERIFIED', 'CLOSED');
CREATE TYPE "FoodDeviationSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');
CREATE TYPE "ValidationTargetType" AS ENUM ('CCP', 'OPRP', 'PRP', 'PROCESS', 'OTHER');
CREATE TYPE "ValidationResult" AS ENUM ('PENDING', 'VALID', 'INVALID', 'CONDITIONAL');
CREATE TYPE "VerificationActivityType" AS ENUM ('INTERNAL_AUDIT', 'RECORD_REVIEW', 'CALIBRATION_CHECK', 'SAMPLING', 'SUPPLIER_AUDIT', 'OTHER');
CREATE TYPE "FoodVerificationResult" AS ENUM ('PENDING', 'CONFORMING', 'NONCONFORMING', 'PARTIAL');
CREATE TYPE "TraceabilityLotType" AS ENUM ('RAW_MATERIAL', 'INTERMEDIATE', 'FINISHED', 'DISTRIBUTED');
CREATE TYPE "TraceabilityLotStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'RELEASED', 'RECALLED', 'EXPIRED', 'CONSUMED');
CREATE TYPE "RecallType" AS ENUM ('WITHDRAWAL', 'RECALL', 'STOCK_RECOVERY');
CREATE TYPE "RecallStatus" AS ENUM ('DRAFT', 'INITIATED', 'NOTIFYING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
CREATE TYPE "FoodSafetyEmergencyType" AS ENUM ('CONTAMINATION', 'ALLERGEN_INCIDENT', 'RECALL_EVENT', 'SUPPLY_DISRUPTION', 'FACILITY', 'OTHER');
CREATE TYPE "FoodEmergencyStatus" AS ENUM ('REPORTED', 'ACTIVE', 'CONTAINED', 'CLOSED');

CREATE TABLE "allergens" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" TEXT, "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_products" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "category" TEXT, "shelfLifeDays" INTEGER, "storageConditions" TEXT,
  "allergenCodes" TEXT[] DEFAULT ARRAY[]::TEXT[], "processId" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "documentId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_materials" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "supplierId" TEXT, "specification" TEXT, "allergenCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "storageConditions" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "documentId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "intended_uses" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "consumerGroup" TEXT, "preparationMethod" TEXT, "vulnerableConsumers" BOOLEAN NOT NULL DEFAULT false,
  "misusePotential" TEXT, "notes" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "intended_uses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_flows" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "version" TEXT NOT NULL DEFAULT '1', "status" "FoodFlowStatus" NOT NULL DEFAULT 'DRAFT',
  "verifiedOnSite" BOOLEAN NOT NULL DEFAULT false, "verifiedAt" TIMESTAMP(3), "verifiedById" TEXT,
  "notes" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "process_flows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_steps" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "flowId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL, "name" TEXT NOT NULL, "stepType" "FoodStepType" NOT NULL DEFAULT 'PROCESS',
  "description" TEXT, "processId" TEXT, "temperature" TEXT, "timeParam" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "process_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_hazards" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "hazardType" "FoodHazardType" NOT NULL DEFAULT 'BIOLOGICAL', "description" TEXT, "source" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_hazards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hazard_assessments" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "hazardId" TEXT NOT NULL,
  "stepId" TEXT, "productId" TEXT, "severity" INTEGER NOT NULL DEFAULT 3, "likelihood" INTEGER NOT NULL DEFAULT 3,
  "score" INTEGER NOT NULL DEFAULT 9, "significant" BOOLEAN NOT NULL DEFAULT false,
  "controlDecision" "HazardControlDecision" NOT NULL DEFAULT 'NONE', "justification" TEXT, "existingMeasures" TEXT,
  "status" "FoodAssessmentStatus" NOT NULL DEFAULT 'DRAFT', "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessedById" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hazard_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prerequisite_programs" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" "PrpCategory" NOT NULL DEFAULT 'OTHER', "description" TEXT, "responsibleId" TEXT,
  "frequency" TEXT, "documentId" TEXT, "evidenceId" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prerequisite_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_prps" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "hazardAssessmentId" TEXT, "stepId" TEXT, "description" TEXT, "monitoringMethod" TEXT,
  "monitoringFrequency" TEXT, "correctionAction" TEXT, "responsibleId" TEXT, "documentId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operational_prps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "critical_control_points" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "stepId" TEXT NOT NULL, "hazardAssessmentId" TEXT, "justification" TEXT, "hazardControlled" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "critical_control_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "critical_limits" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "ccpId" TEXT NOT NULL,
  "parameter" TEXT NOT NULL, "operator" "LimitOperator" NOT NULL DEFAULT 'BETWEEN',
  "minValue" DOUBLE PRECISION, "maxValue" DOUBLE PRECISION, "targetValue" DOUBLE PRECISION,
  "unit" TEXT, "rationale" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "critical_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitoring_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "ccpId" TEXT, "oprpId" TEXT, "method" TEXT, "frequency" TEXT, "responsibleId" TEXT, "parameter" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitoring_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitoring_records" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "valueNumeric" DOUBLE PRECISION,
  "valueText" TEXT, "unit" TEXT, "withinLimits" BOOLEAN NOT NULL DEFAULT true, "recordedById" TEXT,
  "notes" TEXT, "evidenceId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitoring_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_deviations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "ccpId" TEXT, "monitoringRecordId" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "status" "DeviationStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "FoodDeviationSeverity" NOT NULL DEFAULT 'MODERATE', "productHold" BOOLEAN NOT NULL DEFAULT false,
  "lotCodes" TEXT[] DEFAULT ARRAY[]::TEXT[], "capaId" TEXT, "closedAt" TIMESTAMP(3), "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_deviations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_safety_corrections" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviationId" TEXT NOT NULL,
  "actionTaken" TEXT NOT NULL, "completedAt" TIMESTAMP(3), "verifiedById" TEXT, "verifiedAt" TIMESTAMP(3),
  "effective" BOOLEAN, "capaId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_safety_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validation_records" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "targetType" "ValidationTargetType" NOT NULL DEFAULT 'CCP', "targetCode" TEXT, "method" TEXT,
  "result" "ValidationResult" NOT NULL DEFAULT 'PENDING', "findings" TEXT, "validatedAt" TIMESTAMP(3),
  "validatedById" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "validation_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_activities" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "activityType" "VerificationActivityType" NOT NULL DEFAULT 'INTERNAL_AUDIT', "scheduledFor" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "result" "FoodVerificationResult" NOT NULL DEFAULT 'PENDING', "findings" TEXT,
  "responsibleId" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "traceability_lots" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "lotType" "TraceabilityLotType" NOT NULL DEFAULT 'FINISHED', "productId" TEXT, "rawMaterialId" TEXT,
  "supplierId" TEXT, "customerName" TEXT, "quantity" DOUBLE PRECISION, "unit" TEXT,
  "producedAt" TIMESTAMP(3), "receivedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "previousLotIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "processStepCode" TEXT, "locationId" TEXT,
  "distributionRef" TEXT, "status" "TraceabilityLotStatus" NOT NULL DEFAULT 'ACTIVE', "notes" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "traceability_lots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "withdrawal_recalls" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "recallType" "RecallType" NOT NULL DEFAULT 'WITHDRAWAL',
  "lotCodes" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "RecallStatus" NOT NULL DEFAULT 'DRAFT',
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notifiedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "customersNotified" TEXT, "authorityNotified" BOOLEAN NOT NULL DEFAULT false,
  "quantityAffected" DOUBLE PRECISION, "unit" TEXT, "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "withdrawal_recalls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_safety_emergencies" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "emergencyType" "FoodSafetyEmergencyType" NOT NULL DEFAULT 'OTHER', "description" TEXT,
  "status" "FoodEmergencyStatus" NOT NULL DEFAULT 'REPORTED', "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3), "recallId" TEXT, "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_safety_emergencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allergens_organizationId_code_key" ON "allergens"("organizationId", "code");
CREATE INDEX "allergens_organizationId_active_idx" ON "allergens"("organizationId", "active");
CREATE UNIQUE INDEX "food_products_organizationId_code_key" ON "food_products"("organizationId", "code");
CREATE INDEX "food_products_organizationId_active_idx" ON "food_products"("organizationId", "active");
CREATE UNIQUE INDEX "raw_materials_organizationId_code_key" ON "raw_materials"("organizationId", "code");
CREATE INDEX "raw_materials_organizationId_supplierId_idx" ON "raw_materials"("organizationId", "supplierId");
CREATE UNIQUE INDEX "intended_uses_organizationId_code_key" ON "intended_uses"("organizationId", "code");
CREATE INDEX "intended_uses_organizationId_productId_idx" ON "intended_uses"("organizationId", "productId");
CREATE UNIQUE INDEX "process_flows_organizationId_code_version_key" ON "process_flows"("organizationId", "code", "version");
CREATE INDEX "process_flows_organizationId_productId_idx" ON "process_flows"("organizationId", "productId");
CREATE INDEX "process_flows_organizationId_status_idx" ON "process_flows"("organizationId", "status");
CREATE UNIQUE INDEX "process_steps_organizationId_code_key" ON "process_steps"("organizationId", "code");
CREATE INDEX "process_steps_organizationId_flowId_idx" ON "process_steps"("organizationId", "flowId");
CREATE UNIQUE INDEX "food_hazards_organizationId_code_key" ON "food_hazards"("organizationId", "code");
CREATE INDEX "food_hazards_organizationId_hazardType_idx" ON "food_hazards"("organizationId", "hazardType");
CREATE UNIQUE INDEX "hazard_assessments_organizationId_code_key" ON "hazard_assessments"("organizationId", "code");
CREATE INDEX "hazard_assessments_organizationId_significant_idx" ON "hazard_assessments"("organizationId", "significant");
CREATE INDEX "hazard_assessments_organizationId_controlDecision_idx" ON "hazard_assessments"("organizationId", "controlDecision");
CREATE UNIQUE INDEX "prerequisite_programs_organizationId_code_key" ON "prerequisite_programs"("organizationId", "code");
CREATE INDEX "prerequisite_programs_organizationId_category_idx" ON "prerequisite_programs"("organizationId", "category");
CREATE UNIQUE INDEX "operational_prps_organizationId_code_key" ON "operational_prps"("organizationId", "code");
CREATE INDEX "operational_prps_organizationId_stepId_idx" ON "operational_prps"("organizationId", "stepId");
CREATE UNIQUE INDEX "critical_control_points_organizationId_code_key" ON "critical_control_points"("organizationId", "code");
CREATE INDEX "critical_control_points_organizationId_stepId_idx" ON "critical_control_points"("organizationId", "stepId");
CREATE UNIQUE INDEX "critical_limits_organizationId_code_key" ON "critical_limits"("organizationId", "code");
CREATE INDEX "critical_limits_organizationId_ccpId_idx" ON "critical_limits"("organizationId", "ccpId");
CREATE UNIQUE INDEX "monitoring_plans_organizationId_code_key" ON "monitoring_plans"("organizationId", "code");
CREATE INDEX "monitoring_plans_organizationId_ccpId_idx" ON "monitoring_plans"("organizationId", "ccpId");
CREATE INDEX "monitoring_plans_organizationId_oprpId_idx" ON "monitoring_plans"("organizationId", "oprpId");
CREATE UNIQUE INDEX "monitoring_records_organizationId_code_key" ON "monitoring_records"("organizationId", "code");
CREATE INDEX "monitoring_records_organizationId_planId_idx" ON "monitoring_records"("organizationId", "planId");
CREATE INDEX "monitoring_records_organizationId_withinLimits_idx" ON "monitoring_records"("organizationId", "withinLimits");
CREATE UNIQUE INDEX "food_deviations_organizationId_code_key" ON "food_deviations"("organizationId", "code");
CREATE INDEX "food_deviations_organizationId_status_idx" ON "food_deviations"("organizationId", "status");
CREATE INDEX "food_deviations_organizationId_ccpId_idx" ON "food_deviations"("organizationId", "ccpId");
CREATE UNIQUE INDEX "food_safety_corrections_organizationId_code_key" ON "food_safety_corrections"("organizationId", "code");
CREATE INDEX "food_safety_corrections_organizationId_deviationId_idx" ON "food_safety_corrections"("organizationId", "deviationId");
CREATE UNIQUE INDEX "validation_records_organizationId_code_key" ON "validation_records"("organizationId", "code");
CREATE INDEX "validation_records_organizationId_targetType_idx" ON "validation_records"("organizationId", "targetType");
CREATE INDEX "validation_records_organizationId_result_idx" ON "validation_records"("organizationId", "result");
CREATE UNIQUE INDEX "verification_activities_organizationId_code_key" ON "verification_activities"("organizationId", "code");
CREATE INDEX "verification_activities_organizationId_activityType_idx" ON "verification_activities"("organizationId", "activityType");
CREATE INDEX "verification_activities_organizationId_result_idx" ON "verification_activities"("organizationId", "result");
CREATE UNIQUE INDEX "traceability_lots_organizationId_code_key" ON "traceability_lots"("organizationId", "code");
CREATE INDEX "traceability_lots_organizationId_lotType_idx" ON "traceability_lots"("organizationId", "lotType");
CREATE INDEX "traceability_lots_organizationId_productId_idx" ON "traceability_lots"("organizationId", "productId");
CREATE INDEX "traceability_lots_organizationId_rawMaterialId_idx" ON "traceability_lots"("organizationId", "rawMaterialId");
CREATE INDEX "traceability_lots_organizationId_supplierId_idx" ON "traceability_lots"("organizationId", "supplierId");
CREATE INDEX "traceability_lots_organizationId_status_idx" ON "traceability_lots"("organizationId", "status");
CREATE UNIQUE INDEX "withdrawal_recalls_organizationId_code_key" ON "withdrawal_recalls"("organizationId", "code");
CREATE INDEX "withdrawal_recalls_organizationId_status_idx" ON "withdrawal_recalls"("organizationId", "status");
CREATE INDEX "withdrawal_recalls_organizationId_recallType_idx" ON "withdrawal_recalls"("organizationId", "recallType");
CREATE UNIQUE INDEX "food_safety_emergencies_organizationId_code_key" ON "food_safety_emergencies"("organizationId", "code");
CREATE INDEX "food_safety_emergencies_organizationId_status_idx" ON "food_safety_emergencies"("organizationId", "status");
CREATE INDEX "food_safety_emergencies_organizationId_emergencyType_idx" ON "food_safety_emergencies"("organizationId", "emergencyType");
CREATE UNIQUE INDEX "process_steps_flowId_sequence_key" ON "process_steps"("flowId", "sequence");

ALTER TABLE "food_products" ADD CONSTRAINT "food_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "allergens" ADD CONSTRAINT "allergens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intended_uses" ADD CONSTRAINT "intended_uses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intended_uses" ADD CONSTRAINT "intended_uses_productId_fkey" FOREIGN KEY ("productId") REFERENCES "food_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_flows" ADD CONSTRAINT "process_flows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_flows" ADD CONSTRAINT "process_flows_productId_fkey" FOREIGN KEY ("productId") REFERENCES "food_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "process_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_hazards" ADD CONSTRAINT "food_hazards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "food_hazards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "process_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prerequisite_programs" ADD CONSTRAINT "prerequisite_programs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_prps" ADD CONSTRAINT "operational_prps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_prps" ADD CONSTRAINT "operational_prps_hazardAssessmentId_fkey" FOREIGN KEY ("hazardAssessmentId") REFERENCES "hazard_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_prps" ADD CONSTRAINT "operational_prps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "process_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "critical_control_points" ADD CONSTRAINT "critical_control_points_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "critical_control_points" ADD CONSTRAINT "critical_control_points_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "process_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "critical_control_points" ADD CONSTRAINT "critical_control_points_hazardAssessmentId_fkey" FOREIGN KEY ("hazardAssessmentId") REFERENCES "hazard_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "critical_limits" ADD CONSTRAINT "critical_limits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "critical_limits" ADD CONSTRAINT "critical_limits_ccpId_fkey" FOREIGN KEY ("ccpId") REFERENCES "critical_control_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monitoring_plans" ADD CONSTRAINT "monitoring_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monitoring_plans" ADD CONSTRAINT "monitoring_plans_ccpId_fkey" FOREIGN KEY ("ccpId") REFERENCES "critical_control_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "monitoring_plans" ADD CONSTRAINT "monitoring_plans_oprpId_fkey" FOREIGN KEY ("oprpId") REFERENCES "operational_prps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_planId_fkey" FOREIGN KEY ("planId") REFERENCES "monitoring_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_deviations" ADD CONSTRAINT "food_deviations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_deviations" ADD CONSTRAINT "food_deviations_ccpId_fkey" FOREIGN KEY ("ccpId") REFERENCES "critical_control_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_deviations" ADD CONSTRAINT "food_deviations_monitoringRecordId_fkey" FOREIGN KEY ("monitoringRecordId") REFERENCES "monitoring_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_safety_corrections" ADD CONSTRAINT "food_safety_corrections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_safety_corrections" ADD CONSTRAINT "food_safety_corrections_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "food_deviations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_records" ADD CONSTRAINT "validation_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_activities" ADD CONSTRAINT "verification_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traceability_lots" ADD CONSTRAINT "traceability_lots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traceability_lots" ADD CONSTRAINT "traceability_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "food_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "traceability_lots" ADD CONSTRAINT "traceability_lots_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "withdrawal_recalls" ADD CONSTRAINT "withdrawal_recalls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_safety_emergencies" ADD CONSTRAINT "food_safety_emergencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_severity_range" CHECK ("severity" BETWEEN 1 AND 5);
ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_likelihood_range" CHECK ("likelihood" BETWEEN 1 AND 5);
ALTER TABLE "hazard_assessments" ADD CONSTRAINT "hazard_assessments_score_consistent" CHECK ("score" = "severity" * "likelihood");
ALTER TABLE "critical_limits" ADD CONSTRAINT "critical_limits_between_order" CHECK ("operator" <> 'BETWEEN' OR ("minValue" IS NOT NULL AND "maxValue" IS NOT NULL AND "minValue" <= "maxValue"));
ALTER TABLE "monitoring_plans" ADD CONSTRAINT "monitoring_plans_target_present" CHECK ("ccpId" IS NOT NULL OR "oprpId" IS NOT NULL);
ALTER TABLE "withdrawal_recalls" ADD CONSTRAINT "withdrawal_recalls_closed_attributed" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."allergens", public."food_products", public."raw_materials", public."intended_uses", public."process_flows", public."process_steps", public."food_hazards", public."hazard_assessments", public."prerequisite_programs", public."operational_prps", public."critical_control_points", public."critical_limits", public."monitoring_plans", public."monitoring_records", public."food_deviations", public."food_safety_corrections", public."validation_records", public."verification_activities", public."traceability_lots", public."withdrawal_recalls", public."food_safety_emergencies"
      TO authenticated;
  END IF;
END $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['allergens','food_products','raw_materials','intended_uses','process_flows','process_steps','food_hazards','hazard_assessments','prerequisite_programs','operational_prps','critical_control_points','critical_limits','monitoring_plans','monitoring_records','food_deviations','food_safety_corrections','validation_records','verification_activities','traceability_lots','withdrawal_recalls','food_safety_emergencies']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'food-safety:read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'food-safety:create');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'food-safety:update', 'food-safety:update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'food-safety:delete');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*', 'food-safety:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export', 'food-safety:read', 'food-safety:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create', 'food-safety:read', 'food-safety:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read', 'food-safety:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
