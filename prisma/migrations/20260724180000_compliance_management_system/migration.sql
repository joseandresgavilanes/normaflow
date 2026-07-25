-- ISO 37301:2021 compliance management system (CMS): obligation register with
-- regulatory sources and jurisdictions, applicability assessment, compliance
-- risks and controls, compliance evaluation, obligation calendar with alerts,
-- regulatory change watch, conflict-of-interest declarations, the speak-up
-- channel with restricted investigations, breaches, remediation, training and
-- governing-body reporting.
--
-- TWO PERMISSION MODULES, ON PURPOSE:
--   `compliance` → the programme (obligations, risks, controls, evaluations,
--                  calendar, changes, breaches, remediation, training, reports).
--   `speakup`    → the reporting channel. `compliance:read` grants NOTHING here.
--
-- THREE DATABASE-LEVEL GUARANTEES FOR SENSITIVE INFORMATION:
--   1. An ANONYMOUS report cannot physically store the reporter's identity
--      (CHECK), and anonymity only exists where the channel config allows it
--      (trigger `nf_speakup_mode_allowed`).
--   2. Access to a case is need-to-know: a RESTRICTIVE RLS policy demands an
--      explicit, non-revoked `speak_up_case_access` row. Restrictive policies
--      are AND-combined, so holding `speakup:read` — or even the `*` wildcard —
--      is not enough on its own.
--   3. An investigator can never be the person the report is about (CHECK), and
--      a detected conflict of interest forces recusal + reassignment (CHECK).
--
-- Multi-tenant with RLS gated on the `compliance` and `speakup` modules.

-- CreateEnum
CREATE TYPE "JurisdictionLevel" AS ENUM ('SUPRANATIONAL', 'NATIONAL', 'REGIONAL', 'LOCAL', 'SECTORAL');

-- CreateEnum
CREATE TYPE "RegulatorySourceType" AS ENUM ('LAW', 'DECREE', 'REGULATION', 'DIRECTIVE', 'RESOLUTION', 'ORDINANCE', 'CASE_LAW', 'STANDARD', 'CODE_OF_CONDUCT', 'CONTRACT', 'LICENSE', 'INTERNAL_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "RegulatorySourceStatus" AS ENUM ('DRAFT', 'IN_FORCE', 'AMENDED', 'SUSPENDED', 'REPEALED');

-- CreateEnum
CREATE TYPE "MonitoringFrequency" AS ENUM ('CONTINUOUS', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'BIENNIAL', 'ON_EVENT');

-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('LEGAL', 'REGULATORY', 'CONTRACTUAL', 'VOLUNTARY_COMMITMENT', 'STANDARD', 'INTERNAL_POLICY', 'LICENSE_CONDITION', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceCategory" AS ENUM ('ANTIBRIBERY', 'ANTI_MONEY_LAUNDERING', 'DATA_PROTECTION', 'COMPETITION', 'LABOR', 'OCCUPATIONAL_SAFETY', 'ENVIRONMENTAL', 'TAX', 'FINANCIAL_REPORTING', 'CONSUMER_PROTECTION', 'TRADE_SANCTIONS', 'INFORMATION_SECURITY', 'SECTOR_SPECIFIC', 'CORPORATE_GOVERNANCE', 'HUMAN_RIGHTS', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApplicabilityDecision" AS ENUM ('UNDER_ASSESSMENT', 'APPLICABLE', 'PARTIALLY_APPLICABLE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('NOT_EVALUATED', 'COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ObligationLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'REPEALED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComplianceRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplianceAcceptability" AS ENUM ('ACCEPTABLE', 'TOLERABLE', 'NOT_ACCEPTABLE');

-- CreateEnum
CREATE TYPE "ComplianceTreatment" AS ENUM ('AVOID', 'MITIGATE', 'TRANSFER', 'ACCEPT');

-- CreateEnum
CREATE TYPE "ComplianceRiskStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'MONITORED', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplianceImpactLevel" AS ENUM ('NEGLIGIBLE', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE');

-- CreateEnum
CREATE TYPE "ComplianceControlType" AS ENUM ('PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DIRECTIVE');

-- CreateEnum
CREATE TYPE "ControlNature" AS ENUM ('MANUAL', 'AUTOMATED', 'HYBRID');

-- CreateEnum
CREATE TYPE "EvaluationScope" AS ENUM ('OBLIGATION', 'CONTROL', 'PROCESS', 'PROGRAM', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "EvaluationMethod" AS ENUM ('SELF_ASSESSMENT', 'MONITORING', 'CONTROL_TESTING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT', 'AUTHORITY_INSPECTION', 'DUE_DILIGENCE');

-- CreateEnum
CREATE TYPE "ComplianceResult" AS ENUM ('NOT_EVALUATED', 'COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ComplianceReviewStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalendarRecurrence" AS ENUM ('ONCE', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'BIENNIAL');

-- CreateEnum
CREATE TYPE "CalendarItemStatus" AS ENUM ('SCHEDULED', 'DUE_SOON', 'OVERDUE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('FINANCIAL_INTEREST', 'FAMILY_RELATIONSHIP', 'GIFT_HOSPITALITY', 'OUTSIDE_ACTIVITY', 'SUPPLIER_RELATIONSHIP', 'CUSTOMER_RELATIONSHIP', 'PUBLIC_OFFICIAL', 'POLITICAL_ACTIVITY', 'FORMER_EMPLOYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ConflictReviewStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'MITIGATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegulatoryChangeType" AS ENUM ('NEW_REQUIREMENT', 'AMENDMENT', 'REPEAL', 'INTERPRETATION', 'GUIDANCE', 'CASE_LAW', 'ENFORCEMENT_TREND');

-- CreateEnum
CREATE TYPE "ChangeImpactStatus" AS ENUM ('PENDING_ASSESSMENT', 'UNDER_ASSESSMENT', 'ASSESSED', 'NO_IMPACT', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "ReportIdentificationMode" AS ENUM ('IDENTIFIED', 'CONFIDENTIAL', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "SpeakUpIntakeChannel" AS ENUM ('WEB_FORM', 'EMAIL', 'PHONE', 'IN_PERSON', 'POSTAL_MAIL', 'LINE_MANAGER', 'EXTERNAL_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "SpeakUpCategory" AS ENUM ('BRIBERY_CORRUPTION', 'FRAUD', 'THEFT', 'HARASSMENT', 'DISCRIMINATION', 'RETALIATION', 'OCCUPATIONAL_SAFETY', 'ENVIRONMENTAL', 'DATA_PRIVACY', 'INFORMATION_SECURITY', 'CONFLICT_OF_INTEREST', 'ACCOUNTING_IRREGULARITY', 'COMPETITION', 'HUMAN_RIGHTS', 'POLICY_VIOLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SpeakUpSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReporterRelationship" AS ENUM ('EMPLOYEE', 'FORMER_EMPLOYEE', 'CONTRACTOR', 'SUPPLIER', 'CUSTOMER', 'SHAREHOLDER', 'EXTERNAL_THIRD_PARTY', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "SpeakUpStatus" AS ENUM ('RECEIVED', 'ACKNOWLEDGED', 'UNDER_TRIAGE', 'ADMISSIBLE', 'INADMISSIBLE', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SpeakUpOutcome" AS ENUM ('SUBSTANTIATED', 'PARTIALLY_SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE', 'WITHDRAWN', 'OUT_OF_SCOPE', 'REFERRED_EXTERNALLY');

-- CreateEnum
CREATE TYPE "SpeakUpCaseRole" AS ENUM ('TRIAGE', 'INVESTIGATOR', 'REVIEWER', 'LEGAL_COUNSEL', 'DECISION_MAKER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'SUSPENDED', 'CONCLUDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'STRICTLY_CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "BreachDetectionSource" AS ENUM ('SELF_DETECTED', 'COMPLIANCE_EVALUATION', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT', 'SPEAK_UP_REPORT', 'INVESTIGATION', 'AUTHORITY_INSPECTION', 'CUSTOMER_COMPLAINT', 'THIRD_PARTY', 'MEDIA');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'SEVERE');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('OPEN', 'UNDER_ANALYSIS', 'UNDER_REMEDIATION', 'REMEDIATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RemediationPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComplianceTopic" AS ENUM ('CODE_OF_CONDUCT', 'ANTIBRIBERY', 'ANTI_MONEY_LAUNDERING', 'DATA_PROTECTION', 'COMPETITION', 'CONFLICT_OF_INTEREST', 'SPEAK_UP_CHANNEL', 'TRADE_SANCTIONS', 'INFORMATION_SECURITY', 'HUMAN_RIGHTS', 'SECTOR_REGULATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TrainingDelivery" AS ENUM ('ONLINE', 'CLASSROOM', 'BLENDED', 'ON_THE_JOB', 'SELF_STUDY');

-- CreateEnum
CREATE TYPE "GoverningBody" AS ENUM ('BOARD', 'AUDIT_COMMITTEE', 'ETHICS_COMMITTEE', 'COMPLIANCE_COMMITTEE', 'CEO', 'EXECUTIVE_MANAGEMENT');

-- CreateEnum
CREATE TYPE "GoverningReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PRESENTED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "JurisdictionLevel" NOT NULL DEFAULT 'NATIONAL',
    "parentId" TEXT,
    "country" TEXT,
    "authority" TEXT,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "rationale" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "RegulatorySourceType" NOT NULL DEFAULT 'LAW',
    "issuer" TEXT,
    "reference" TEXT,
    "officialUrl" TEXT,
    "jurisdictionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "monitoringFrequency" "MonitoringFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "ownerId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckDate" TIMESTAMP(3),
    "status" "RegulatorySourceStatus" NOT NULL DEFAULT 'IN_FORCE',
    "documentId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulatory_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_obligations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirementText" TEXT,
    "obligationType" "ObligationType" NOT NULL DEFAULT 'LEGAL',
    "category" "ComplianceCategory" NOT NULL DEFAULT 'OTHER',
    "sourceId" TEXT,
    "jurisdictionId" TEXT,
    "articleReference" TEXT,
    "ownerId" TEXT,
    "accountableId" TEXT,
    "criticality" "ComplianceCriticality" NOT NULL DEFAULT 'MEDIUM',
    "applicability" "ApplicabilityDecision" NOT NULL DEFAULT 'UNDER_ASSESSMENT',
    "complianceStatus" "ObligationStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "sanctionDescription" TEXT,
    "maxSanctionAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "evidenceRequired" TEXT,
    "evaluationFrequency" "MonitoringFrequency" NOT NULL DEFAULT 'ANNUAL',
    "lastEvaluatedAt" TIMESTAMP(3),
    "nextEvaluationDate" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" "ObligationLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "supersededById" TEXT,
    "processId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "requirementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_applicability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "decision" "ApplicabilityDecision" NOT NULL DEFAULT 'UNDER_ASSESSMENT',
    "rationale" TEXT,
    "criteria" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_applicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_risks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "obligationId" TEXT,
    "category" "ComplianceCategory" NOT NULL DEFAULT 'OTHER',
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "inherentScore" INTEGER NOT NULL DEFAULT 9,
    "inherentLevel" "ComplianceRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "controlEffectiveness" INTEGER,
    "residualScore" INTEGER NOT NULL DEFAULT 9,
    "residualLevel" "ComplianceRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "acceptability" "ComplianceAcceptability" NOT NULL DEFAULT 'TOLERABLE',
    "treatment" "ComplianceTreatment" NOT NULL DEFAULT 'MITIGATE',
    "sanctionExposure" DOUBLE PRECISION,
    "reputationalImpact" "ComplianceImpactLevel" NOT NULL DEFAULT 'MODERATE',
    "ownerId" TEXT,
    "status" "ComplianceRiskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptanceRationale" TEXT,
    "riskId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_controls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "obligationId" TEXT,
    "riskId" TEXT,
    "controlType" "ComplianceControlType" NOT NULL DEFAULT 'PREVENTIVE',
    "nature" "ControlNature" NOT NULL DEFAULT 'MANUAL',
    "frequency" "MonitoringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "ownerId" TEXT,
    "designAdequate" BOOLEAN,
    "operatingEffective" BOOLEAN,
    "effectiveness" INTEGER,
    "lastTestedAt" TIMESTAMP(3),
    "nextTestDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "organizationControlId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_evaluations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "obligationId" TEXT,
    "controlId" TEXT,
    "scope" "EvaluationScope" NOT NULL DEFAULT 'OBLIGATION',
    "method" "EvaluationMethod" NOT NULL DEFAULT 'SELF_ASSESSMENT',
    "period" TEXT NOT NULL,
    "evaluatedById" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "ComplianceResult" NOT NULL DEFAULT 'NOT_EVALUATED',
    "score" INTEGER,
    "findings" TEXT,
    "gapsIdentified" TEXT,
    "recommendation" TEXT,
    "reviewStatus" "ComplianceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "evidenceId" TEXT,
    "capaId" TEXT,
    "breachId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_calendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "obligationId" TEXT,
    "jurisdictionId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "recurrence" "CalendarRecurrence" NOT NULL DEFAULT 'ANNUAL',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 30,
    "criticality" "ComplianceCriticality" NOT NULL DEFAULT 'MEDIUM',
    "responsibleId" TEXT,
    "authority" TEXT,
    "submissionReference" TEXT,
    "status" "CalendarItemStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "alertSentAt" TIMESTAMP(3),
    "evidenceId" TEXT,
    "parentItemId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_of_interest_declarations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "declarantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictType" "ConflictType",
    "description" TEXT,
    "relatedParty" TEXT,
    "supplierId" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "currency" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" "ConflictReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "mitigationMeasures" TEXT,
    "recusalRequired" BOOLEAN NOT NULL DEFAULT false,
    "confidential" BOOLEAN NOT NULL DEFAULT true,
    "nextDeclarationDate" TIMESTAMP(3),
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflict_of_interest_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_changes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceId" TEXT,
    "jurisdictionId" TEXT,
    "obligationId" TEXT,
    "changeType" "RegulatoryChangeType" NOT NULL DEFAULT 'AMENDMENT',
    "summary" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "transitionUntil" TIMESTAMP(3),
    "impactStatus" "ChangeImpactStatus" NOT NULL DEFAULT 'PENDING_ASSESSMENT',
    "impactLevel" "ComplianceImpactLevel" NOT NULL DEFAULT 'MODERATE',
    "impactAnalysis" TEXT,
    "affectedAreas" TEXT,
    "actionsRequired" TEXT,
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "changeRequestId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulatory_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speak_up_channel_config" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "allowConfidential" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgementDays" INTEGER NOT NULL DEFAULT 7,
    "feedbackDays" INTEGER NOT NULL DEFAULT 90,
    "retentionMonths" INTEGER NOT NULL DEFAULT 60,
    "defaultHandlerId" TEXT,
    "alternateHandlerId" TEXT,
    "externalChannelUrl" TEXT,
    "policyDocumentId" TEXT,
    "retaliationStatement" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speak_up_channel_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speak_up_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "identificationMode" "ReportIdentificationMode" NOT NULL DEFAULT 'IDENTIFIED',
    "intakeChannel" "SpeakUpIntakeChannel" NOT NULL DEFAULT 'WEB_FORM',
    "category" "SpeakUpCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "SpeakUpSeverity" NOT NULL DEFAULT 'MEDIUM',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "allegedFacts" TEXT,
    "occurredAt" TIMESTAMP(3),
    "location" TEXT,
    "subjectDescription" TEXT,
    "subjectUserId" TEXT,
    "witnesses" TEXT,
    "reporterUserId" TEXT,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "reporterPhone" TEXT,
    "reporterRelationship" "ReporterRelationship",
    "followUpCodeHash" TEXT,
    "retaliationRisk" BOOLEAN NOT NULL DEFAULT false,
    "protectionMeasures" TEXT,
    "status" "SpeakUpStatus" NOT NULL DEFAULT 'RECEIVED',
    "acknowledgementDueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "feedbackDueAt" TIMESTAMP(3),
    "feedbackProvidedAt" TIMESTAMP(3),
    "admissibilityById" TEXT,
    "admissibilityAt" TIMESTAMP(3),
    "admissibilityRationale" TEXT,
    "outcome" "SpeakUpOutcome",
    "closureSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "breachId" TEXT,
    "capaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speak_up_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speak_up_case_access" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseRole" "SpeakUpCaseRole" NOT NULL DEFAULT 'TRIAGE',
    "reason" TEXT,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speak_up_case_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speak_up_evidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "investigationId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sha256" TEXT,
    "collectedById" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "custodyNotes" TEXT,
    "sealed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speak_up_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reportId" TEXT,
    "breachId" TEXT,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "plan" TEXT,
    "leadInvestigatorId" TEXT,
    "teamDescription" TEXT,
    "subjectUserId" TEXT,
    "independenceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "conflictChecked" BOOLEAN NOT NULL DEFAULT false,
    "conflictDetected" BOOLEAN NOT NULL DEFAULT false,
    "conflictDescription" TEXT,
    "recusedAt" TIMESTAMP(3),
    "recusedById" TEXT,
    "reassignedToId" TEXT,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'PLANNED',
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'RESTRICTED',
    "startedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "concludedAt" TIMESTAMP(3),
    "findings" TEXT,
    "conclusion" TEXT,
    "recommendations" TEXT,
    "sanctionsRecommended" TEXT,
    "reportDocumentId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_breaches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "obligationId" TEXT,
    "jurisdictionId" TEXT,
    "detectionSource" "BreachDetectionSource" NOT NULL DEFAULT 'SELF_DETECTED',
    "severity" "BreachSeverity" NOT NULL DEFAULT 'MODERATE',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedById" TEXT,
    "occurredAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "affectedParties" TEXT,
    "recurrence" BOOLEAN NOT NULL DEFAULT false,
    "financialExposure" DOUBLE PRECISION,
    "currency" TEXT,
    "sanctionImposed" BOOLEAN NOT NULL DEFAULT false,
    "sanctionAmount" DOUBLE PRECISION,
    "sanctionDescription" TEXT,
    "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "notificationDeadline" TIMESTAMP(3),
    "authorityNotifiedAt" TIMESTAMP(3),
    "authorityReference" TEXT,
    "status" "BreachStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "lessonsLearned" TEXT,
    "capaId" TEXT,
    "ncId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_breaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "breachId" TEXT,
    "obligationId" TEXT,
    "objective" TEXT,
    "actionsDescription" TEXT,
    "ownerId" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "status" "RemediationPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "effectivenessVerified" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessVerifiedById" TEXT,
    "effectivenessVerifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "verificationEvidenceId" TEXT,
    "cost" DOUBLE PRECISION,
    "currency" TEXT,
    "actionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remediation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_trainings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" "ComplianceTopic" NOT NULL DEFAULT 'CODE_OF_CONDUCT',
    "obligationId" TEXT,
    "audience" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "deliveryMode" "TrainingDelivery" NOT NULL DEFAULT 'ONLINE',
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "targetCount" INTEGER,
    "completedCount" INTEGER,
    "passRate" INTEGER,
    "effectivenessEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessNote" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "trainingCourseId" TEXT,
    "materialsDocumentId" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governing_body_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "presentedTo" "GoverningBody" NOT NULL DEFAULT 'BOARD',
    "preparedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executiveSummary" TEXT,
    "obligationsSummary" TEXT,
    "risksSummary" TEXT,
    "evaluationsSummary" TEXT,
    "breachesSummary" TEXT,
    "speakUpSummary" TEXT,
    "investigationsSummary" TEXT,
    "trainingSummary" TEXT,
    "remediationSummary" TEXT,
    "resourcesRequested" TEXT,
    "decisionsRequested" TEXT,
    "decisionsTaken" TEXT,
    "reviewStatus" "GoverningReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "managementReviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governing_body_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jurisdictions_organizationId_level_idx" ON "jurisdictions"("organizationId", "level");

-- CreateIndex
CREATE INDEX "jurisdictions_organizationId_applicable_idx" ON "jurisdictions"("organizationId", "applicable");

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_organizationId_code_key" ON "jurisdictions"("organizationId", "code");

-- CreateIndex
CREATE INDEX "regulatory_sources_organizationId_sourceType_idx" ON "regulatory_sources"("organizationId", "sourceType");

-- CreateIndex
CREATE INDEX "regulatory_sources_organizationId_monitored_nextCheckDate_idx" ON "regulatory_sources"("organizationId", "monitored", "nextCheckDate");

-- CreateIndex
CREATE INDEX "regulatory_sources_organizationId_jurisdictionId_idx" ON "regulatory_sources"("organizationId", "jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_sources_organizationId_code_key" ON "regulatory_sources"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_category_idx" ON "compliance_obligations"("organizationId", "category");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_complianceStatus_idx" ON "compliance_obligations"("organizationId", "complianceStatus");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_criticality_idx" ON "compliance_obligations"("organizationId", "criticality");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_ownerId_idx" ON "compliance_obligations"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_nextEvaluationDate_idx" ON "compliance_obligations"("organizationId", "nextEvaluationDate");

-- CreateIndex
CREATE INDEX "compliance_obligations_organizationId_jurisdictionId_idx" ON "compliance_obligations"("organizationId", "jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_obligations_organizationId_code_key" ON "compliance_obligations"("organizationId", "code");

-- CreateIndex
CREATE INDEX "obligation_applicability_organizationId_decision_idx" ON "obligation_applicability"("organizationId", "decision");

-- CreateIndex
CREATE INDEX "obligation_applicability_organizationId_reviewDate_idx" ON "obligation_applicability"("organizationId", "reviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_applicability_organizationId_obligationId_jurisd_key" ON "obligation_applicability"("organizationId", "obligationId", "jurisdictionId");

-- CreateIndex
CREATE INDEX "compliance_risks_organizationId_residualLevel_idx" ON "compliance_risks"("organizationId", "residualLevel");

-- CreateIndex
CREATE INDEX "compliance_risks_organizationId_status_idx" ON "compliance_risks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "compliance_risks_organizationId_obligationId_idx" ON "compliance_risks"("organizationId", "obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_risks_organizationId_code_key" ON "compliance_risks"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_controls_organizationId_active_idx" ON "compliance_controls"("organizationId", "active");

-- CreateIndex
CREATE INDEX "compliance_controls_organizationId_nextTestDate_idx" ON "compliance_controls"("organizationId", "nextTestDate");

-- CreateIndex
CREATE INDEX "compliance_controls_organizationId_obligationId_idx" ON "compliance_controls"("organizationId", "obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_controls_organizationId_code_key" ON "compliance_controls"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organizationId_result_idx" ON "compliance_evaluations"("organizationId", "result");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organizationId_period_idx" ON "compliance_evaluations"("organizationId", "period");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organizationId_obligationId_idx" ON "compliance_evaluations"("organizationId", "obligationId");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organizationId_reviewStatus_idx" ON "compliance_evaluations"("organizationId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_evaluations_organizationId_code_key" ON "compliance_evaluations"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_calendar_organizationId_dueDate_idx" ON "compliance_calendar"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "compliance_calendar_organizationId_status_idx" ON "compliance_calendar"("organizationId", "status");

-- CreateIndex
CREATE INDEX "compliance_calendar_organizationId_responsibleId_idx" ON "compliance_calendar"("organizationId", "responsibleId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_calendar_organizationId_code_key" ON "compliance_calendar"("organizationId", "code");

-- CreateIndex
CREATE INDEX "conflict_of_interest_declarations_organizationId_hasConflic_idx" ON "conflict_of_interest_declarations"("organizationId", "hasConflict");

-- CreateIndex
CREATE INDEX "conflict_of_interest_declarations_organizationId_reviewStat_idx" ON "conflict_of_interest_declarations"("organizationId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "conflict_of_interest_declarations_organizationId_code_key" ON "conflict_of_interest_declarations"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "conflict_of_interest_declarations_organizationId_declarantI_key" ON "conflict_of_interest_declarations"("organizationId", "declarantId", "period");

-- CreateIndex
CREATE INDEX "regulatory_changes_organizationId_impactStatus_idx" ON "regulatory_changes"("organizationId", "impactStatus");

-- CreateIndex
CREATE INDEX "regulatory_changes_organizationId_effectiveFrom_idx" ON "regulatory_changes"("organizationId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "regulatory_changes_organizationId_sourceId_idx" ON "regulatory_changes"("organizationId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_changes_organizationId_code_key" ON "regulatory_changes"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "speak_up_channel_config_organizationId_key" ON "speak_up_channel_config"("organizationId");

-- CreateIndex
CREATE INDEX "speak_up_reports_organizationId_status_idx" ON "speak_up_reports"("organizationId", "status");

-- CreateIndex
CREATE INDEX "speak_up_reports_organizationId_category_idx" ON "speak_up_reports"("organizationId", "category");

-- CreateIndex
CREATE INDEX "speak_up_reports_organizationId_receivedAt_idx" ON "speak_up_reports"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "speak_up_reports_organizationId_retentionUntil_idx" ON "speak_up_reports"("organizationId", "retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "speak_up_reports_organizationId_code_key" ON "speak_up_reports"("organizationId", "code");

-- CreateIndex
CREATE INDEX "speak_up_case_access_organizationId_userId_idx" ON "speak_up_case_access"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "speak_up_case_access_reportId_revokedAt_idx" ON "speak_up_case_access"("reportId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "speak_up_case_access_reportId_userId_caseRole_key" ON "speak_up_case_access"("reportId", "userId", "caseRole");

-- CreateIndex
CREATE INDEX "speak_up_evidence_organizationId_reportId_idx" ON "speak_up_evidence"("organizationId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "speak_up_evidence_organizationId_code_key" ON "speak_up_evidence"("organizationId", "code");

-- CreateIndex
CREATE INDEX "investigations_organizationId_status_idx" ON "investigations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "investigations_organizationId_reportId_idx" ON "investigations"("organizationId", "reportId");

-- CreateIndex
CREATE INDEX "investigations_organizationId_leadInvestigatorId_idx" ON "investigations"("organizationId", "leadInvestigatorId");

-- CreateIndex
CREATE UNIQUE INDEX "investigations_organizationId_code_key" ON "investigations"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_breaches_organizationId_status_idx" ON "compliance_breaches"("organizationId", "status");

-- CreateIndex
CREATE INDEX "compliance_breaches_organizationId_severity_idx" ON "compliance_breaches"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "compliance_breaches_organizationId_detectedAt_idx" ON "compliance_breaches"("organizationId", "detectedAt");

-- CreateIndex
CREATE INDEX "compliance_breaches_organizationId_obligationId_idx" ON "compliance_breaches"("organizationId", "obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_breaches_organizationId_code_key" ON "compliance_breaches"("organizationId", "code");

-- CreateIndex
CREATE INDEX "remediation_plans_organizationId_status_idx" ON "remediation_plans"("organizationId", "status");

-- CreateIndex
CREATE INDEX "remediation_plans_organizationId_dueDate_idx" ON "remediation_plans"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "remediation_plans_organizationId_breachId_idx" ON "remediation_plans"("organizationId", "breachId");

-- CreateIndex
CREATE UNIQUE INDEX "remediation_plans_organizationId_code_key" ON "remediation_plans"("organizationId", "code");

-- CreateIndex
CREATE INDEX "compliance_trainings_organizationId_topic_idx" ON "compliance_trainings"("organizationId", "topic");

-- CreateIndex
CREATE INDEX "compliance_trainings_organizationId_scheduledFor_idx" ON "compliance_trainings"("organizationId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_trainings_organizationId_code_key" ON "compliance_trainings"("organizationId", "code");

-- CreateIndex
CREATE INDEX "governing_body_reports_organizationId_period_idx" ON "governing_body_reports"("organizationId", "period");

-- CreateIndex
CREATE INDEX "governing_body_reports_organizationId_reviewStatus_idx" ON "governing_body_reports"("organizationId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "governing_body_reports_organizationId_code_key" ON "governing_body_reports"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_sources" ADD CONSTRAINT "regulatory_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_sources" ADD CONSTRAINT "regulatory_sources_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "regulatory_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_applicability" ADD CONSTRAINT "obligation_applicability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_applicability" ADD CONSTRAINT "obligation_applicability_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_applicability" ADD CONSTRAINT "obligation_applicability_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "compliance_risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "compliance_controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "compliance_breaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_calendar" ADD CONSTRAINT "compliance_calendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_calendar" ADD CONSTRAINT "compliance_calendar_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_calendar" ADD CONSTRAINT "compliance_calendar_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_of_interest_declarations" ADD CONSTRAINT "conflict_of_interest_declarations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "regulatory_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_channel_config" ADD CONSTRAINT "speak_up_channel_config_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_case_access" ADD CONSTRAINT "speak_up_case_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_case_access" ADD CONSTRAINT "speak_up_case_access_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "speak_up_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_evidence" ADD CONSTRAINT "speak_up_evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_evidence" ADD CONSTRAINT "speak_up_evidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "speak_up_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speak_up_evidence" ADD CONSTRAINT "speak_up_evidence_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "investigations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "speak_up_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "compliance_breaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_breaches" ADD CONSTRAINT "compliance_breaches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_breaches" ADD CONSTRAINT "compliance_breaches_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_breaches" ADD CONSTRAINT "compliance_breaches_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "compliance_breaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_trainings" ADD CONSTRAINT "compliance_trainings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_trainings" ADD CONSTRAINT "compliance_trainings_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "compliance_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governing_body_reports" ADD CONSTRAINT "governing_body_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── SENSITIVE INFORMATION — DATABASE-LEVEL GUARANTEES ─
-- 1. Anonymity is real: an anonymous report cannot hold ANY reporter identifier.
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_anonymous_has_no_identity"
  CHECK ("identificationMode" <> 'ANONYMOUS' OR ("reporterUserId" IS NULL AND "reporterName" IS NULL AND "reporterEmail" IS NULL AND "reporterPhone" IS NULL));
-- 2. An admissibility decision names its author, its date and its reason.
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_admissibility_requires_decision"
  CHECK ("status" NOT IN ('ADMISSIBLE', 'INADMISSIBLE') OR ("admissibilityById" IS NOT NULL AND "admissibilityAt" IS NOT NULL AND "admissibilityRationale" IS NOT NULL));
-- 3. A closed case has an outcome, a closing summary and an accountable closer.
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_closure_requires_outcome"
  CHECK ("status" <> 'CLOSED' OR ("outcome" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closureSummary" IS NOT NULL));
-- 4. Retention: nothing is destroyed before the retention period expires, and a
--    purged case keeps no identity at all.
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_purge_after_retention"
  CHECK ("purgedAt" IS NULL OR ("status" = 'CLOSED' AND "retentionUntil" IS NOT NULL AND "purgedAt" >= "retentionUntil"));
ALTER TABLE "speak_up_reports" ADD CONSTRAINT "speak_up_reports_purged_has_no_identity"
  CHECK ("purgedAt" IS NULL OR ("reporterUserId" IS NULL AND "reporterName" IS NULL AND "reporterEmail" IS NULL AND "reporterPhone" IS NULL));
-- 5. Revoking access always states why (recusal included): the trail explains itself.
ALTER TABLE "speak_up_case_access" ADD CONSTRAINT "speak_up_case_access_revocation_has_reason"
  CHECK ("revokedAt" IS NULL OR "revokedReason" IS NOT NULL);

-- 6. Independence of the investigation is structural, not a good intention.
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_lead_is_not_the_subject"
  CHECK ("leadInvestigatorId" IS NULL OR "subjectUserId" IS NULL OR "leadInvestigatorId" <> "subjectUserId");
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_conflict_requires_recusal"
  CHECK (NOT "conflictDetected" OR ("recusedAt" IS NOT NULL AND "reassignedToId" IS NOT NULL));
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_reassignment_is_not_the_subject"
  CHECK ("reassignedToId" IS NULL OR "subjectUserId" IS NULL OR "reassignedToId" <> "subjectUserId");
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_conclusion_requires_findings"
  CHECK ("status" NOT IN ('CONCLUDED', 'CLOSED') OR ("concludedAt" IS NOT NULL AND "conclusion" IS NOT NULL));

-- 7. No applicability decision without a documented reason and an assessor.
ALTER TABLE "obligation_applicability" ADD CONSTRAINT "obligation_applicability_decision_requires_rationale"
  CHECK ("decision" = 'UNDER_ASSESSMENT' OR ("rationale" IS NOT NULL AND "assessedById" IS NOT NULL AND "assessedAt" IS NOT NULL));
-- 8. A decided evaluation or declaration names its reviewer and date.
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('DRAFT', 'UNDER_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_score_range"
  CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100));
ALTER TABLE "conflict_of_interest_declarations" ADD CONSTRAINT "conflict_declarations_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('PENDING', 'UNDER_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
-- A declared conflict must say what it is; "yes, but I won't tell you" is not a declaration.
ALTER TABLE "conflict_of_interest_declarations" ADD CONSTRAINT "conflict_declarations_conflict_requires_detail"
  CHECK (NOT "hasConflict" OR ("conflictType" IS NOT NULL AND "description" IS NOT NULL));

-- 9. Accepting a non-acceptable compliance risk is attributed and justified.
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_acceptance_requires_rationale"
  CHECK ("status" <> 'ACCEPTED' OR ("acceptedById" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "acceptanceRationale" IS NOT NULL));
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_scale_range"
  CHECK ("likelihood" BETWEEN 1 AND 5 AND "impact" BETWEEN 1 AND 5 AND ("controlEffectiveness" IS NULL OR "controlEffectiveness" BETWEEN 0 AND 100));

-- 10. A breach is only closed once it has been remediated and someone signs it.
ALTER TABLE "compliance_breaches" ADD CONSTRAINT "compliance_breaches_closure_requires_signature"
  CHECK ("status" <> 'CLOSED' OR ("closedAt" IS NOT NULL AND "closedById" IS NOT NULL));
-- 11. Remediation: progress is a percentage, completion precedes verification and
--     the verifier is never the owner of the plan (no self-certification).
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_progress_range"
  CHECK ("progressPercent" BETWEEN 0 AND 100);
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_verification_requires_completion"
  CHECK (NOT "effectivenessVerified" OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "effectivenessVerifiedById" IS NOT NULL AND "effectivenessVerifiedAt" IS NOT NULL));
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_verifier_is_not_the_owner"
  CHECK ("effectivenessVerifiedById" IS NULL OR "ownerId" IS NULL OR "effectivenessVerifiedById" <> "ownerId");
-- 12. A report acknowledged by the governing body records who acknowledged it.
ALTER TABLE "governing_body_reports" ADD CONSTRAINT "governing_body_reports_acknowledgement_is_attributed"
  CHECK ("reviewStatus" <> 'ACKNOWLEDGED' OR ("acknowledgedAt" IS NOT NULL AND "acknowledgedById" IS NOT NULL));

-- ─── CHANNEL CONFIGURATION IS BINDING ────────────────
-- An anonymous (or confidential) report may only exist where the organization
-- enabled that mode. Enforced by trigger because the rule spans two tables.
CREATE OR REPLACE FUNCTION public.nf_speakup_mode_allowed() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE allow_anonymous BOOLEAN; allow_confidential BOOLEAN;
BEGIN
  IF NEW."identificationMode" = 'IDENTIFIED' THEN RETURN NEW; END IF;
  SELECT "allowAnonymous", "allowConfidential" INTO allow_anonymous, allow_confidential
    FROM public."speak_up_channel_config" WHERE "organizationId" = NEW."organizationId";
  -- Sin configuración no hay modo especial: el canal se abre explícitamente.
  IF NEW."identificationMode" = 'ANONYMOUS' AND COALESCE(allow_anonymous, false) = false THEN
    RAISE EXCEPTION 'speak_up_channel_config: anonymous reporting is not enabled for this organization';
  END IF;
  IF NEW."identificationMode" = 'CONFIDENTIAL' AND COALESCE(allow_confidential, false) = false THEN
    RAISE EXCEPTION 'speak_up_channel_config: confidential reporting is not enabled for this organization';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nf_speak_up_reports_mode_allowed ON "speak_up_reports";
CREATE TRIGGER nf_speak_up_reports_mode_allowed
  BEFORE INSERT OR UPDATE OF "identificationMode" ON "speak_up_reports"
  FOR EACH ROW EXECUTE FUNCTION public.nf_speakup_mode_allowed();

-- ─── CROSS-TABLE TENANT INTEGRITY ────────────────────
-- Same pattern as the security-operations and continuity modules: a child row
-- can never point at a parent from another organization.
CREATE OR REPLACE FUNCTION public.nf_validate_compliance_tenant() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE target_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'obligation_applicability' THEN
    SELECT "organizationId" INTO target_org FROM compliance_obligations WHERE id = NEW."obligationId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Obligation belongs to another organization'; END IF;
    SELECT "organizationId" INTO target_org FROM jurisdictions WHERE id = NEW."jurisdictionId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Jurisdiction belongs to another organization'; END IF;
  ELSIF TG_TABLE_NAME = 'speak_up_case_access' THEN
    SELECT "organizationId" INTO target_org FROM speak_up_reports WHERE id = NEW."reportId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Speak-up report belongs to another organization'; END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."userId" AND active) THEN
      RAISE EXCEPTION 'Case access can only be granted to an active member of the organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'speak_up_evidence' THEN
    SELECT "organizationId" INTO target_org FROM speak_up_reports WHERE id = NEW."reportId";
    IF target_org IS NULL OR target_org <> NEW."organizationId" THEN RAISE EXCEPTION 'Speak-up report belongs to another organization'; END IF;
    IF NEW."investigationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM investigations WHERE id = NEW."investigationId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Investigation belongs to another organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'investigations' THEN
    IF NEW."reportId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM speak_up_reports WHERE id = NEW."reportId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Speak-up report belongs to another organization';
    END IF;
    IF NEW."breachId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compliance_breaches WHERE id = NEW."breachId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Breach belongs to another organization';
    END IF;
    IF NEW."leadInvestigatorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."leadInvestigatorId" AND active) THEN
      RAISE EXCEPTION 'Lead investigator is not an active organization member';
    END IF;
  ELSIF TG_TABLE_NAME = 'remediation_plans' THEN
    IF NEW."breachId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compliance_breaches WHERE id = NEW."breachId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Breach belongs to another organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'compliance_evaluations' THEN
    IF NEW."obligationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compliance_obligations WHERE id = NEW."obligationId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Obligation belongs to another organization';
    END IF;
    IF NEW."controlId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compliance_controls WHERE id = NEW."controlId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'Control belongs to another organization';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['obligation_applicability','speak_up_case_access','speak_up_evidence','investigations','remediation_plans','compliance_evaluations']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nf_%s_tenant_refs ON %I', t, t);
    EXECUTE format('CREATE TRIGGER nf_%s_tenant_refs BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.nf_validate_compliance_tenant()', t, t);
  END LOOP;
END $$;

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."jurisdictions", public."regulatory_sources", public."compliance_obligations",
      public."obligation_applicability", public."compliance_risks", public."compliance_controls",
      public."compliance_evaluations", public."compliance_calendar",
      public."conflict_of_interest_declarations", public."regulatory_changes",
      public."speak_up_channel_config", public."speak_up_reports", public."speak_up_case_access",
      public."speak_up_evidence", public."investigations", public."compliance_breaches",
      public."remediation_plans", public."compliance_trainings", public."governing_body_reports"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY — COMPLIANCE PROGRAMME ───────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['jurisdictions','regulatory_sources','compliance_obligations','obligation_applicability','compliance_risks','compliance_controls','compliance_evaluations','compliance_calendar','conflict_of_interest_declarations','regulatory_changes','compliance_breaches','remediation_plans','compliance_trainings','governing_body_reports']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'compliance:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'compliance:create');
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'compliance:update', 'compliance:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'compliance:delete');
  END LOOP;
END $$;

-- A conflict-of-interest declaration is personal data: on top of the module
-- permission, a RESTRICTIVE policy keeps every declarant limited to their own
-- declaration unless they can approve declarations (the compliance function).
-- Restrictive policies are AND-combined, so this narrows and never widens.
DROP POLICY IF EXISTS "nf_conflict_declarations_own_or_officer" ON "conflict_of_interest_declarations";
CREATE POLICY "nf_conflict_declarations_own_or_officer" ON "conflict_of_interest_declarations"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ("declarantId" = public.nf_current_user_id() OR public.nf_has_org_permission("organizationId", 'compliance:approve'));

-- ─── ROW LEVEL SECURITY — SPEAK-UP CHANNEL ───────────
-- Need-to-know, expressed the only way a database can express it: RESTRICTIVE
-- policies are AND-combined with the permissive ones, so `speakup:read` — and
-- even the `*` wildcard — is not sufficient without an explicit access grant.
CREATE OR REPLACE FUNCTION public.nf_speakup_case_accessible(report_id TEXT) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."speak_up_case_access" a
    WHERE a."reportId" = report_id
      AND a."userId" = public.nf_current_user_id()
      AND a."revokedAt" IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.nf_speakup_case_accessible(TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_speakup_case_accessible(TEXT) TO authenticated';
  END IF;
END
$$;

-- Channel configuration: readable with `speakup:read`, writable only by whoever
-- may approve in the channel (deciding whether anonymity exists is a governance
-- decision, not a settings tweak).
ALTER TABLE "speak_up_channel_config" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_speak_up_channel_config_select" ON "speak_up_channel_config";
DROP POLICY IF EXISTS "nf_speak_up_channel_config_write" ON "speak_up_channel_config";
CREATE POLICY "nf_speak_up_channel_config_select" ON "speak_up_channel_config"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'speakup:read'));
CREATE POLICY "nf_speak_up_channel_config_write" ON "speak_up_channel_config"
  FOR ALL TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'speakup:approve'))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'speakup:approve'));

-- Reports: anyone with `speakup:create` may file one (that is the point of a
-- channel); reading is restricted to the case access list, plus the identified
-- reporter, who may follow their own case.
-- The restrictive policies below cover SELECT and UPDATE only, never INSERT:
-- filing a report must not require already having access to it (an anonymous
-- reporter has no access row and no user id), and the first intake grant on a
-- case would otherwise be impossible.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['speak_up_reports','speak_up_case_access','speak_up_evidence','investigations']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_visible', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_writable', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'speakup:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'speakup:update', 'speakup:update');
  END LOOP;
END $$;

-- Anyone with `speakup:create` may file a report — that is the whole point of a
-- channel. Handling a case (evidence, access list, investigation) needs
-- `speakup:update`. No DELETE policy anywhere: a case is never deleted, only
-- purged by retention, which is an UPDATE that the CHECK constraints police.
CREATE POLICY "nf_speak_up_reports_insert" ON "speak_up_reports"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'speakup:create'));
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['speak_up_case_access','speak_up_evidence','investigations']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'speakup:update');
  END LOOP;
END $$;

-- Need-to-know. The identified reporter may follow their own case; everyone else
-- needs a live grant in the access list.
CREATE POLICY "nf_speak_up_reports_visible" ON "speak_up_reports"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.nf_speakup_case_accessible("id") OR "reporterUserId" = public.nf_current_user_id());
CREATE POLICY "nf_speak_up_reports_writable" ON "speak_up_reports"
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.nf_speakup_case_accessible("id"));
CREATE POLICY "nf_speak_up_case_access_visible" ON "speak_up_case_access"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.nf_speakup_case_accessible("reportId"));
CREATE POLICY "nf_speak_up_case_access_writable" ON "speak_up_case_access"
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.nf_speakup_case_accessible("reportId"));
CREATE POLICY "nf_speak_up_evidence_visible" ON "speak_up_evidence"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.nf_speakup_case_accessible("reportId"));
CREATE POLICY "nf_speak_up_evidence_writable" ON "speak_up_evidence"
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.nf_speakup_case_accessible("reportId"));
-- A breach investigation belongs to the compliance programme, so the programme
-- permissions also reach `investigations` (permissive policies are OR-combined).
-- The need-to-know restriction below still applies whenever the investigation
-- comes from a channel case, which is what has to stay compartmentalized.
DROP POLICY IF EXISTS "nf_investigations_compliance_select" ON "investigations";
DROP POLICY IF EXISTS "nf_investigations_compliance_insert" ON "investigations";
DROP POLICY IF EXISTS "nf_investigations_compliance_update" ON "investigations";
CREATE POLICY "nf_investigations_compliance_select" ON "investigations"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'compliance:read'));
CREATE POLICY "nf_investigations_compliance_insert" ON "investigations"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'compliance:create'));
CREATE POLICY "nf_investigations_compliance_update" ON "investigations"
  FOR UPDATE TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'compliance:update'))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'compliance:update'));

-- An investigation may also exist without a report (a breach investigation);
-- in that case there is no channel confidentiality to protect.
CREATE POLICY "nf_investigations_visible" ON "investigations"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ("reportId" IS NULL OR public.nf_speakup_case_accessible("reportId"));
CREATE POLICY "nf_investigations_writable" ON "investigations"
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ("reportId" IS NULL OR public.nf_speakup_case_accessible("reportId"));

-- Keep Supabase direct authorization aligned with the server matrix: add
-- compliance:* and the speak-up capabilities (carries forward every prior
-- module). Note who does NOT get `speakup:read`: administrators and managers can
-- file a report and configure nothing else. A channel that the powerful can read
-- is not a channel.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
