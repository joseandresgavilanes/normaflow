-- ISO/IEC 42001:2023 AI management system (AIMS): AI system inventory, use
-- cases, impact assessment, AI risks, datasets with provenance/quality/bias,
-- model versions & evaluations, human oversight controls, transparency records,
-- AI incidents (strict workflow), AI suppliers, changes, monitoring and the
-- human-review ledger for AI outputs.
--
-- HUMAN RULE: no AI output can become an official record automatically. The
-- ledger (`ai_generated_outputs`) enforces DRAFT → HUMAN_REVIEW → APPROVED |
-- REJECTED with CHECK constraints, so promotion without a human approval is
-- impossible even for a direct SQL writer.
--
-- Multi-tenant with RLS gated on the `aims` permission module.

-- ─── ENUMS ───────────────────────────────────────────
CREATE TYPE "AIHumanReviewStatus" AS ENUM ('DRAFT', 'HUMAN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "AISystemCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AIRiskClassification" AS ENUM ('NOT_CLASSIFIED', 'MINIMAL', 'LIMITED', 'HIGH', 'UNACCEPTABLE');
CREATE TYPE "AIAutonomyLevel" AS ENUM ('HUMAN_IN_THE_LOOP', 'HUMAN_ON_THE_LOOP', 'HUMAN_IN_COMMAND', 'FULLY_AUTOMATED');
CREATE TYPE "AISystemStatus" AS ENUM ('PLANNED', 'IN_DEVELOPMENT', 'IN_VALIDATION', 'APPROVED', 'IN_PRODUCTION', 'SUSPENDED', 'RETIRED');
CREATE TYPE "AIProviderType" AS ENUM ('INTERNAL', 'THIRD_PARTY_API', 'THIRD_PARTY_LICENSED', 'OPEN_SOURCE', 'EMBEDDED_IN_PRODUCT', 'OTHER');
CREATE TYPE "AIImpactSeverity" AS ENUM ('NOT_ASSESSED', 'NONE', 'LOW', 'MODERATE', 'HIGH', 'SEVERE');
CREATE TYPE "AIRiskCategory" AS ENUM ('BIAS_DISCRIMINATION', 'PRIVACY', 'SECURITY', 'SAFETY', 'TRANSPARENCY', 'EXPLAINABILITY', 'ROBUSTNESS', 'DATA_QUALITY', 'HUMAN_OVERSIGHT', 'INTELLECTUAL_PROPERTY', 'LEGAL_COMPLIANCE', 'ENVIRONMENTAL', 'THIRD_PARTY', 'MISUSE', 'OTHER');
CREATE TYPE "AIRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AIRiskAcceptability" AS ENUM ('ACCEPTABLE', 'TOLERABLE', 'NOT_ACCEPTABLE');
CREATE TYPE "AIRiskTreatment" AS ENUM ('MITIGATE', 'AVOID', 'TRANSFER', 'ACCEPT');
CREATE TYPE "AIRiskStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'MITIGATED', 'ACCEPTED', 'CLOSED');
CREATE TYPE "DatasetClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "DataSourceType" AS ENUM ('INTERNAL_SYSTEM', 'PUBLIC_DATASET', 'THIRD_PARTY_PROVIDER', 'WEB_SCRAPING', 'USER_GENERATED', 'SYNTHETIC', 'SENSOR', 'PURCHASED', 'OTHER');
CREATE TYPE "DataLegalBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST', 'ANONYMIZED', 'NOT_APPLICABLE');
CREATE TYPE "DataQualityLevel" AS ENUM ('NOT_ASSESSED', 'POOR', 'ACCEPTABLE', 'GOOD', 'EXCELLENT');
CREATE TYPE "DataLineageOperation" AS ENUM ('INGESTION', 'CLEANING', 'TRANSFORMATION', 'LABELING', 'AUGMENTATION', 'ANONYMIZATION', 'AGGREGATION', 'SPLIT', 'MERGE', 'DERIVATION', 'DELETION');
CREATE TYPE "ModelVersionStage" AS ENUM ('DEVELOPMENT', 'EVALUATION', 'STAGING', 'PRODUCTION', 'DEPRECATED', 'RETIRED');
CREATE TYPE "ModelEvaluationOutcome" AS ENUM ('NOT_EVALUATED', 'PASSED', 'PASSED_WITH_CONDITIONS', 'FAILED');
CREATE TYPE "HumanOversightType" AS ENUM ('HUMAN_IN_THE_LOOP', 'HUMAN_ON_THE_LOOP', 'HUMAN_IN_COMMAND', 'DUAL_CONTROL', 'SAMPLING_REVIEW', 'APPEAL_CHANNEL');
CREATE TYPE "AITransparencyAudience" AS ENUM ('END_USER', 'DATA_SUBJECT', 'CUSTOMER', 'WORKER', 'REGULATOR', 'PUBLIC', 'INTERNAL');
CREATE TYPE "AIIncidentType" AS ENUM ('HARMFUL_OUTPUT', 'BIAS_DISCRIMINATION', 'PRIVACY_BREACH', 'SECURITY_BREACH', 'HALLUCINATION', 'PERFORMANCE_DEGRADATION', 'DATA_DRIFT', 'MISUSE', 'UNAVAILABILITY', 'UNAPPROVED_AUTOMATION', 'OTHER');
CREATE TYPE "AIIncidentStatus" AS ENUM ('REPORTED', 'TRIAGED', 'INVESTIGATING', 'ROOT_CAUSE', 'ACTION_PLAN', 'IMPLEMENTED', 'EFFECTIVENESS_VERIFIED', 'CLOSED');
CREATE TYPE "AISupplierService" AS ENUM ('FOUNDATION_MODEL', 'MODEL_API', 'DATASET', 'ANNOTATION', 'MLOPS_PLATFORM', 'EMBEDDED_FEATURE', 'CONSULTING', 'OTHER');
CREATE TYPE "AISupplierOutcome" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'CONDITIONAL', 'REJECTED');
CREATE TYPE "AIChangeType" AS ENUM ('MODEL_UPDATE', 'RETRAINING', 'DATA_CHANGE', 'PROMPT_CHANGE', 'SCOPE_CHANGE', 'INTEGRATION', 'CONFIGURATION', 'THRESHOLD_CHANGE', 'DECOMMISSION', 'OTHER');
CREATE TYPE "AIMetricKind" AS ENUM ('ACCURACY', 'PRECISION', 'RECALL', 'F1', 'ERROR_RATE', 'LATENCY', 'THROUGHPUT', 'DRIFT', 'FAIRNESS', 'TOXICITY', 'HALLUCINATION_RATE', 'HUMAN_OVERRIDE_RATE', 'REJECTION_RATE', 'COST', 'AVAILABILITY', 'OTHER');
CREATE TYPE "AIOutputTarget" AS ENUM ('DOCUMENT', 'RECORD', 'RISK', 'CAPA', 'ACTION', 'AUDIT_FINDING', 'IMPACT_ASSESSMENT', 'ANALYSIS', 'COMMUNICATION', 'OTHER');

-- ─── TABLES ──────────────────────────────────────────

CREATE TABLE "ai_systems" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT,
  "provider" TEXT,
  "providerType" "AIProviderType" NOT NULL DEFAULT 'INTERNAL',
  "supplierId" TEXT,
  "purpose" TEXT NOT NULL,
  "users" TEXT,
  "affectedGroups" TEXT,
  "context" TEXT,
  "criticality" "AISystemCriticality" NOT NULL DEFAULT 'MEDIUM',
  "classification" "AIRiskClassification" NOT NULL DEFAULT 'NOT_CLASSIFIED',
  "autonomy" "AIAutonomyLevel" NOT NULL DEFAULT 'HUMAN_IN_THE_LOOP',
  "status" "AISystemStatus" NOT NULL DEFAULT 'PLANNED',
  "processId" TEXT,
  "documentId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "deployedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "retirementReason" TEXT,
  "retirementPlan" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_systems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_use_cases" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "supportedDecisions" TEXT,
  "decisionAutonomy" "AIAutonomyLevel" NOT NULL DEFAULT 'HUMAN_IN_THE_LOOP',
  "affectedPeople" TEXT,
  "affectedCount" INTEGER,
  "impact" TEXT,
  "constraints" TEXT,
  "prohibitedUses" TEXT,
  "processId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_use_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_impact_assessments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "useCaseId" TEXT,
  "code" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1',
  "methodology" TEXT,
  "rightsImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "rightsNote" TEXT,
  "safetyImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "safetyNote" TEXT,
  "privacyImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "privacyNote" TEXT,
  "biasImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "biasNote" TEXT,
  "transparencyImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "transparencyNote" TEXT,
  "explainabilityImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "explainabilityNote" TEXT,
  "oversightImpact" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "oversightNote" TEXT,
  "overallScore" DOUBLE PRECISION,
  "overallSeverity" "AIImpactSeverity" NOT NULL DEFAULT 'NOT_ASSESSED',
  "classification" "AIRiskClassification" NOT NULL DEFAULT 'NOT_CLASSIFIED',
  "safeguards" TEXT,
  "residualImpact" TEXT,
  "assessorId" TEXT,
  "assessedAt" TIMESTAMP(3),
  "reviewStatus" "AIHumanReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "evidenceId" TEXT,
  "documentId" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_impact_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_risks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "AIRiskCategory" NOT NULL DEFAULT 'OTHER',
  "source" TEXT,
  "description" TEXT,
  "affectedParties" TEXT,
  "likelihood" INTEGER NOT NULL DEFAULT 1,
  "impact" INTEGER NOT NULL DEFAULT 1,
  "inherentScore" DOUBLE PRECISION,
  "inherentLevel" "AIRiskLevel" NOT NULL DEFAULT 'LOW',
  "existingControls" TEXT,
  "controlEffectiveness" INTEGER,
  "residualScore" DOUBLE PRECISION,
  "residualLevel" "AIRiskLevel" NOT NULL DEFAULT 'LOW',
  "acceptability" "AIRiskAcceptability" NOT NULL DEFAULT 'ACCEPTABLE',
  "treatment" "AIRiskTreatment" NOT NULL DEFAULT 'MITIGATE',
  "treatmentPlan" TEXT,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "riskId" TEXT,
  "controlId" TEXT,
  "capaId" TEXT,
  "evidenceId" TEXT,
  "status" "AIRiskStatus" NOT NULL DEFAULT 'OPEN',
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "acceptanceRationale" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "datasets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT,
  "ownerId" TEXT,
  "stewardId" TEXT,
  "classification" "DatasetClassification" NOT NULL DEFAULT 'INTERNAL',
  "containsPersonalData" BOOLEAN NOT NULL DEFAULT false,
  "personalDataCategories" TEXT,
  "containsSpecialCategories" BOOLEAN NOT NULL DEFAULT false,
  "legalBasis" "DataLegalBasis" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "anonymization" TEXT,
  "recordCount" INTEGER,
  "featureCount" INTEGER,
  "periodCovered" TEXT,
  "completeness" INTEGER,
  "accuracy" INTEGER,
  "consistency" INTEGER,
  "timeliness" INTEGER,
  "representativeness" INTEGER,
  "qualityScore" DOUBLE PRECISION,
  "qualityLevel" "DataQualityLevel" NOT NULL DEFAULT 'NOT_ASSESSED',
  "biasReviewed" BOOLEAN NOT NULL DEFAULT false,
  "biasFindings" TEXT,
  "underrepresentedGroups" TEXT,
  "retentionMonths" INTEGER,
  "storageLocation" TEXT,
  "documentId" TEXT,
  "evidenceId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_sources" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DataSourceType" NOT NULL DEFAULT 'OTHER',
  "origin" TEXT,
  "provider" TEXT,
  "supplierId" TEXT,
  "license" TEXT,
  "licenseVerified" BOOLEAN NOT NULL DEFAULT false,
  "legalBasis" "DataLegalBasis" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "consentEvidence" TEXT,
  "collectedFrom" TIMESTAMP(3),
  "collectedTo" TIMESTAMP(3),
  "restrictions" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_lineage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 1,
  "operation" "DataLineageOperation" NOT NULL DEFAULT 'INGESTION',
  "description" TEXT,
  "inputRef" TEXT,
  "outputRef" TEXT,
  "tool" TEXT,
  "performedById" TEXT,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversible" BOOLEAN NOT NULL DEFAULT false,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_lineage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_versions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "algorithm" TEXT,
  "framework" TEXT,
  "baseModel" TEXT,
  "provider" TEXT,
  "trainingDatasetId" TEXT,
  "trainingSummary" TEXT,
  "hyperparameters" JSONB,
  "explainabilityMethod" TEXT,
  "explainabilityNote" TEXT,
  "limitations" TEXT,
  "intendedUse" TEXT,
  "stage" "ModelVersionStage" NOT NULL DEFAULT 'DEVELOPMENT',
  "reviewStatus" "AIHumanReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "deployedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "documentId" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_evaluations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "datasetId" TEXT,
  "code" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatorId" TEXT,
  "accuracy" DOUBLE PRECISION,
  "precision" DOUBLE PRECISION,
  "recall" DOUBLE PRECISION,
  "f1Score" DOUBLE PRECISION,
  "aucRoc" DOUBLE PRECISION,
  "errorRate" DOUBLE PRECISION,
  "fairnessMetric" TEXT,
  "fairnessScore" DOUBLE PRECISION,
  "biasDetected" BOOLEAN NOT NULL DEFAULT false,
  "biasGroups" TEXT,
  "disparityRatio" DOUBLE PRECISION,
  "robustness" TEXT,
  "adversarialTested" BOOLEAN NOT NULL DEFAULT false,
  "explainabilityAssessed" BOOLEAN NOT NULL DEFAULT false,
  "explainabilityNote" TEXT,
  "thresholds" JSONB,
  "outcome" "ModelEvaluationOutcome" NOT NULL DEFAULT 'NOT_EVALUATED',
  "findings" TEXT,
  "conditions" TEXT,
  "capaId" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "human_oversight_controls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "HumanOversightType" NOT NULL DEFAULT 'HUMAN_IN_THE_LOOP',
  "description" TEXT,
  "responsibleId" TEXT,
  "competence" TEXT,
  "trainingCourseId" TEXT,
  "canOverride" BOOLEAN NOT NULL DEFAULT true,
  "canStop" BOOLEAN NOT NULL DEFAULT true,
  "escalationPath" TEXT,
  "frequency" TEXT,
  "effectiveness" INTEGER,
  "lastVerifiedAt" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  "controlId" TEXT,
  "evidenceId" TEXT,
  "documentId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "human_oversight_controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_transparency_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "audience" "AITransparencyAudience" NOT NULL DEFAULT 'END_USER',
  "disclosure" TEXT NOT NULL,
  "aiUseDisclosed" BOOLEAN NOT NULL DEFAULT true,
  "limitationsDisclosed" BOOLEAN NOT NULL DEFAULT false,
  "dataUseDisclosed" BOOLEAN NOT NULL DEFAULT false,
  "humanContactOffered" BOOLEAN NOT NULL DEFAULT false,
  "channel" TEXT,
  "language" TEXT,
  "publishedAt" TIMESTAMP(3),
  "version" TEXT NOT NULL DEFAULT '1',
  "responsibleId" TEXT,
  "documentId" TEXT,
  "evidenceId" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_transparency_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_incidents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT,
  "modelVersionId" TEXT,
  "code" TEXT NOT NULL,
  "type" "AIIncidentType" NOT NULL DEFAULT 'OTHER',
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurredAt" TIMESTAMP(3),
  "detectedBy" TEXT,
  "reporterId" TEXT,
  "affectedParties" TEXT,
  "affectedCount" INTEGER,
  "harmDescription" TEXT,
  "investigation" TEXT,
  "rootCause" TEXT,
  "rootCauseMethod" TEXT,
  "containment" TEXT,
  "correctiveActions" TEXT,
  "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
  "notificationDetails" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "status" "AIIncidentStatus" NOT NULL DEFAULT 'REPORTED',
  "responsibleId" TEXT,
  "dueDate" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "lessonsLearned" TEXT,
  "capaId" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_supplier_assessments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "supplierId" TEXT,
  "systemId" TEXT,
  "code" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "serviceType" "AISupplierService" NOT NULL DEFAULT 'OTHER',
  "modelDocumentation" BOOLEAN NOT NULL DEFAULT false,
  "trainingDataDisclosed" BOOLEAN NOT NULL DEFAULT false,
  "evaluationResultsShared" BOOLEAN NOT NULL DEFAULT false,
  "biasTestingEvidence" BOOLEAN NOT NULL DEFAULT false,
  "securityCertification" TEXT,
  "dataProcessingTerms" TEXT,
  "subprocessors" TEXT,
  "dataResidency" TEXT,
  "usesCustomerDataForTraining" BOOLEAN NOT NULL DEFAULT false,
  "incidentNotificationSla" TEXT,
  "exitPlan" TEXT,
  "risks" TEXT,
  "requirements" TEXT,
  "outcome" "AISupplierOutcome" NOT NULL DEFAULT 'UNDER_REVIEW',
  "score" INTEGER,
  "assessedAt" TIMESTAMP(3),
  "assessorId" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "contractExpiry" TIMESTAMP(3),
  "evidenceId" TEXT,
  "documentId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_supplier_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_change_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "changeType" "AIChangeType" NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "justification" TEXT,
  "impactAnalysis" TEXT,
  "affectsImpactAssessment" BOOLEAN NOT NULL DEFAULT false,
  "requiresReassessment" BOOLEAN NOT NULL DEFAULT false,
  "requiresRetraining" BOOLEAN NOT NULL DEFAULT false,
  "requiresRevalidation" BOOLEAN NOT NULL DEFAULT false,
  "rollbackPlan" TEXT,
  "requesterId" TEXT,
  "reviewStatus" "AIHumanReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "implementedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "changeRequestId" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_performance_metrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "period" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "kind" "AIMetricKind" NOT NULL DEFAULT 'OTHER',
  "name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT,
  "baseline" DOUBLE PRECISION,
  "threshold" DOUBLE PRECISION,
  "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
  "breached" BOOLEAN NOT NULL DEFAULT false,
  "driftDetected" BOOLEAN NOT NULL DEFAULT false,
  "sampleSize" INTEGER,
  "humanOverrides" INTEGER,
  "note" TEXT,
  "indicatorId" TEXT,
  "evidenceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- Human-review ledger for every AI output. See the CHECK constraints below:
-- promotion to an official record is impossible without a human approval.
CREATE TABLE "ai_generated_outputs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "systemId" TEXT,
  "modelVersionId" TEXT,
  "purpose" TEXT,
  "targetType" "AIOutputTarget" NOT NULL DEFAULT 'OTHER',
  "prompt" TEXT NOT NULL,
  "promptHash" TEXT,
  "model" TEXT NOT NULL,
  "modelVersionLabel" TEXT NOT NULL,
  "parameters" JSONB,
  "output" TEXT NOT NULL,
  "outputHash" TEXT,
  "tokensUsed" INTEGER,
  "requestedById" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "containsPersonalData" BOOLEAN NOT NULL DEFAULT false,
  "redacted" BOOLEAN NOT NULL DEFAULT false,
  "reviewStatus" "AIHumanReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "humanEdits" TEXT,
  "editSummary" TEXT,
  "editedById" TEXT,
  "editedAt" TIMESTAMP(3),
  "promotedEntityType" TEXT,
  "promotedEntityId" TEXT,
  "promotedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_generated_outputs_pkey" PRIMARY KEY ("id")
);

-- ─── INDEXES ─────────────────────────────────────────
CREATE UNIQUE INDEX "ai_systems_organizationId_code_key" ON "ai_systems"("organizationId", "code");
CREATE INDEX "ai_systems_organizationId_status_idx" ON "ai_systems"("organizationId", "status");
CREATE INDEX "ai_systems_organizationId_criticality_idx" ON "ai_systems"("organizationId", "criticality");
CREATE INDEX "ai_systems_organizationId_classification_idx" ON "ai_systems"("organizationId", "classification");

CREATE UNIQUE INDEX "ai_use_cases_organizationId_code_key" ON "ai_use_cases"("organizationId", "code");
CREATE INDEX "ai_use_cases_organizationId_systemId_idx" ON "ai_use_cases"("organizationId", "systemId");

CREATE UNIQUE INDEX "ai_impact_assessments_organizationId_code_version_key" ON "ai_impact_assessments"("organizationId", "code", "version");
CREATE INDEX "ai_impact_assessments_organizationId_systemId_idx" ON "ai_impact_assessments"("organizationId", "systemId");
CREATE INDEX "ai_impact_assessments_organizationId_reviewStatus_idx" ON "ai_impact_assessments"("organizationId", "reviewStatus");

CREATE UNIQUE INDEX "ai_risks_organizationId_code_key" ON "ai_risks"("organizationId", "code");
CREATE INDEX "ai_risks_organizationId_residualLevel_idx" ON "ai_risks"("organizationId", "residualLevel");
CREATE INDEX "ai_risks_organizationId_category_idx" ON "ai_risks"("organizationId", "category");
CREATE INDEX "ai_risks_organizationId_systemId_idx" ON "ai_risks"("organizationId", "systemId");

CREATE UNIQUE INDEX "datasets_organizationId_code_key" ON "datasets"("organizationId", "code");
CREATE INDEX "datasets_organizationId_classification_idx" ON "datasets"("organizationId", "classification");
CREATE INDEX "datasets_organizationId_containsPersonalData_idx" ON "datasets"("organizationId", "containsPersonalData");

CREATE UNIQUE INDEX "data_sources_organizationId_code_key" ON "data_sources"("organizationId", "code");
CREATE INDEX "data_sources_organizationId_datasetId_idx" ON "data_sources"("organizationId", "datasetId");
CREATE INDEX "data_sources_organizationId_type_idx" ON "data_sources"("organizationId", "type");

CREATE UNIQUE INDEX "data_lineage_organizationId_datasetId_step_key" ON "data_lineage"("organizationId", "datasetId", "step");
CREATE INDEX "data_lineage_organizationId_datasetId_idx" ON "data_lineage"("organizationId", "datasetId");

CREATE UNIQUE INDEX "model_versions_organizationId_code_key" ON "model_versions"("organizationId", "code");
CREATE UNIQUE INDEX "model_versions_organizationId_systemId_modelName_version_key" ON "model_versions"("organizationId", "systemId", "modelName", "version");
CREATE INDEX "model_versions_organizationId_stage_idx" ON "model_versions"("organizationId", "stage");
CREATE INDEX "model_versions_organizationId_reviewStatus_idx" ON "model_versions"("organizationId", "reviewStatus");

CREATE UNIQUE INDEX "model_evaluations_organizationId_code_key" ON "model_evaluations"("organizationId", "code");
CREATE INDEX "model_evaluations_organizationId_modelVersionId_idx" ON "model_evaluations"("organizationId", "modelVersionId");
CREATE INDEX "model_evaluations_organizationId_outcome_idx" ON "model_evaluations"("organizationId", "outcome");

CREATE UNIQUE INDEX "human_oversight_controls_organizationId_code_key" ON "human_oversight_controls"("organizationId", "code");
CREATE INDEX "human_oversight_controls_organizationId_systemId_idx" ON "human_oversight_controls"("organizationId", "systemId");
CREATE INDEX "human_oversight_controls_organizationId_type_idx" ON "human_oversight_controls"("organizationId", "type");

CREATE UNIQUE INDEX "ai_transparency_records_organizationId_code_key" ON "ai_transparency_records"("organizationId", "code");
CREATE INDEX "ai_transparency_records_organizationId_systemId_idx" ON "ai_transparency_records"("organizationId", "systemId");
CREATE INDEX "ai_transparency_records_organizationId_audience_idx" ON "ai_transparency_records"("organizationId", "audience");

CREATE UNIQUE INDEX "ai_incidents_organizationId_code_key" ON "ai_incidents"("organizationId", "code");
CREATE INDEX "ai_incidents_organizationId_status_idx" ON "ai_incidents"("organizationId", "status");
CREATE INDEX "ai_incidents_organizationId_type_idx" ON "ai_incidents"("organizationId", "type");
CREATE INDEX "ai_incidents_organizationId_detectedAt_idx" ON "ai_incidents"("organizationId", "detectedAt");

CREATE UNIQUE INDEX "ai_supplier_assessments_organizationId_code_key" ON "ai_supplier_assessments"("organizationId", "code");
CREATE INDEX "ai_supplier_assessments_organizationId_outcome_idx" ON "ai_supplier_assessments"("organizationId", "outcome");
CREATE INDEX "ai_supplier_assessments_organizationId_supplierId_idx" ON "ai_supplier_assessments"("organizationId", "supplierId");

CREATE UNIQUE INDEX "ai_change_requests_organizationId_code_key" ON "ai_change_requests"("organizationId", "code");
CREATE INDEX "ai_change_requests_organizationId_systemId_idx" ON "ai_change_requests"("organizationId", "systemId");
CREATE INDEX "ai_change_requests_organizationId_reviewStatus_idx" ON "ai_change_requests"("organizationId", "reviewStatus");

CREATE UNIQUE INDEX "ai_performance_metrics_organizationId_systemId_period_name_key" ON "ai_performance_metrics"("organizationId", "systemId", "period", "name");
CREATE INDEX "ai_performance_metrics_organizationId_systemId_period_idx" ON "ai_performance_metrics"("organizationId", "systemId", "period");
CREATE INDEX "ai_performance_metrics_organizationId_breached_idx" ON "ai_performance_metrics"("organizationId", "breached");

CREATE UNIQUE INDEX "ai_generated_outputs_organizationId_code_key" ON "ai_generated_outputs"("organizationId", "code");
CREATE INDEX "ai_generated_outputs_organizationId_reviewStatus_idx" ON "ai_generated_outputs"("organizationId", "reviewStatus");
CREATE INDEX "ai_generated_outputs_organizationId_requestedById_idx" ON "ai_generated_outputs"("organizationId", "requestedById");
CREATE INDEX "ai_generated_outputs_organizationId_generatedAt_idx" ON "ai_generated_outputs"("organizationId", "generatedAt");

-- ─── FOREIGN KEYS ────────────────────────────────────
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_use_cases" ADD CONSTRAINT "ai_use_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_use_cases" ADD CONSTRAINT "ai_use_cases_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_impact_assessments" ADD CONSTRAINT "ai_impact_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_impact_assessments" ADD CONSTRAINT "ai_impact_assessments_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_risks" ADD CONSTRAINT "ai_risks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_risks" ADD CONSTRAINT "ai_risks_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_lineage" ADD CONSTRAINT "data_lineage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_lineage" ADD CONSTRAINT "data_lineage_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_trainingDatasetId_fkey" FOREIGN KEY ("trainingDatasetId") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "model_evaluations" ADD CONSTRAINT "model_evaluations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_evaluations" ADD CONSTRAINT "model_evaluations_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_evaluations" ADD CONSTRAINT "model_evaluations_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "human_oversight_controls" ADD CONSTRAINT "human_oversight_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "human_oversight_controls" ADD CONSTRAINT "human_oversight_controls_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_transparency_records" ADD CONSTRAINT "ai_transparency_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_transparency_records" ADD CONSTRAINT "ai_transparency_records_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_incidents" ADD CONSTRAINT "ai_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_incidents" ADD CONSTRAINT "ai_incidents_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_supplier_assessments" ADD CONSTRAINT "ai_supplier_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_change_requests" ADD CONSTRAINT "ai_change_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_change_requests" ADD CONSTRAINT "ai_change_requests_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_change_requests" ADD CONSTRAINT "ai_change_requests_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_performance_metrics" ADD CONSTRAINT "ai_performance_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_performance_metrics" ADD CONSTRAINT "ai_performance_metrics_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_performance_metrics" ADD CONSTRAINT "ai_performance_metrics_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_generated_outputs" ADD CONSTRAINT "ai_generated_outputs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_generated_outputs" ADD CONSTRAINT "ai_generated_outputs_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ai_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_generated_outputs" ADD CONSTRAINT "ai_generated_outputs_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── HUMAN RULE — DATABASE-LEVEL GUARANTEES ──────────
-- 1. An AI output may only be promoted to an official record while APPROVED.
-- 2. A decided artifact (APPROVED / REJECTED) must name the human reviewer and
--    the decision date; the state cannot exist without an accountable person.
ALTER TABLE "ai_generated_outputs" ADD CONSTRAINT "ai_generated_outputs_promotion_requires_approval"
  CHECK (("promotedAt" IS NULL AND "promotedEntityId" IS NULL) OR "reviewStatus" = 'APPROVED');
ALTER TABLE "ai_generated_outputs" ADD CONSTRAINT "ai_generated_outputs_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('DRAFT', 'HUMAN_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "ai_impact_assessments" ADD CONSTRAINT "ai_impact_assessments_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('DRAFT', 'HUMAN_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('DRAFT', 'HUMAN_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
-- A model only reaches production once a human approved that version.
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_production_requires_approval"
  CHECK ("stage" <> 'PRODUCTION' OR "reviewStatus" = 'APPROVED');
ALTER TABLE "ai_change_requests" ADD CONSTRAINT "ai_change_requests_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('DRAFT', 'HUMAN_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "ai_change_requests" ADD CONSTRAINT "ai_change_requests_implementation_requires_approval"
  CHECK ("implementedAt" IS NULL OR "reviewStatus" = 'APPROVED');
-- An AI system only runs in production with a recorded human approval.
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_production_requires_approval"
  CHECK ("status" <> 'IN_PRODUCTION' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."ai_systems", public."ai_use_cases", public."ai_impact_assessments",
      public."ai_risks", public."datasets", public."data_sources", public."data_lineage",
      public."model_versions", public."model_evaluations", public."human_oversight_controls",
      public."ai_transparency_records", public."ai_incidents", public."ai_supplier_assessments",
      public."ai_change_requests", public."ai_performance_metrics", public."ai_generated_outputs"
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
      ('ai_systems','create'),
      ('ai_use_cases','create'),
      ('ai_impact_assessments','create'),
      ('ai_risks','create'),
      ('datasets','create'),
      ('data_sources','create'),
      ('data_lineage','create'),
      ('model_versions','create'),
      ('model_evaluations','create'),
      ('human_oversight_controls','create'),
      ('ai_transparency_records','create'),
      ('ai_incidents','create'),
      ('ai_supplier_assessments','create'),
      ('ai_change_requests','create'),
      ('ai_performance_metrics','create'),
      ('ai_generated_outputs','create')
    ) AS s(tbl, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_select', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_insert', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_update', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_delete', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, 'aims:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, 'aims:'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, 'aims:update', 'aims:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, 'aims:delete');
  END LOOP;
END $$;

-- The human decision (approve / reject) is a distinct capability, `aims:approve`,
-- required by the review server actions. It is intentionally NOT expressed as an
-- extra RLS policy: permissive policies are OR-combined, so a second UPDATE
-- policy would widen access instead of narrowing it. The database guarantees the
-- shape of a decided row (CHECK constraints above); the actions guarantee who
-- may take the decision.

-- Keep Supabase direct authorization aligned with the server matrix: add
-- aims:* (carries forward every prior module).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
