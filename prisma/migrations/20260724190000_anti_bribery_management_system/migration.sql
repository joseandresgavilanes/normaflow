-- CreateEnum
CREATE TYPE "BriberyCountryRisk" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BriberyAssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BusinessAssociateType" AS ENUM ('SUPPLIER', 'AGENT', 'INTERMEDIARY', 'DISTRIBUTOR', 'JOINT_VENTURE', 'CONSULTANT', 'CUSTOMER', 'PUBLIC_BODY', 'NGO', 'OTHER');

-- CreateEnum
CREATE TYPE "AssociateRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssociateStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('NOT_SCREENED', 'CLEAR', 'POTENTIAL_MATCH', 'CONFIRMED_HIT', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "DueDiligenceLevel" AS ENUM ('SIMPLIFIED', 'STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "DueDiligenceStatus" AS ENUM ('DRAFT', 'SCREENING', 'REVIEW', 'ENHANCED_REVIEW', 'APPROVED', 'REJECTED', 'PERIODIC_REVIEW');

-- CreateEnum
CREATE TYPE "BeneficialControlType" AS ENUM ('OWNERSHIP', 'VOTING_RIGHTS', 'OTHER_MEANS', 'SENIOR_MANAGING_OFFICIAL');

-- CreateEnum
CREATE TYPE "GiftHospitalityType" AS ENUM ('GIFT', 'HOSPITALITY', 'TRAVEL', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "GiftDirection" AS ENUM ('GIVEN', 'RECEIVED');

-- CreateEnum
CREATE TYPE "GiftHospitalityStatus" AS ENUM ('SUBMITTED', 'MANAGER_REVIEW', 'COMPLIANCE_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DonationSponsorshipType" AS ENUM ('DONATION', 'SPONSORSHIP', 'COMMUNITY_INVESTMENT', 'POLITICAL_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "DonationSponsorshipStatus" AS ENUM ('PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AbmsConflictNature" AS ENUM ('PUBLIC_OFFICIAL_RELATIONSHIP', 'BUSINESS_ASSOCIATE', 'FAMILY_IN_COUNTERPARTY', 'FINANCIAL_INTEREST', 'OUTSIDE_EMPLOYMENT', 'GIFT_HOSPITALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilitationPaymentStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'CONFIRMED', 'REMEDIATED', 'CLOSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ControlTestStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "NonFinancialControlArea" AS ENUM ('PROCUREMENT', 'HR_HIRING', 'SALES_TENDERS', 'TRAVEL_EXPENSES', 'TRAINING_AWARENESS', 'THIRD_PARTY_ONBOARDING', 'WHISTLEBLOWING', 'OTHER');

-- CreateEnum
CREATE TYPE "HighRiskTransactionType" AS ENUM ('AGENT_COMMISSION', 'SUCCESS_FEE', 'CASH_PAYMENT', 'CROSS_BORDER_TRANSFER', 'PUBLIC_TENDER', 'CUSTOMS_CLEARANCE', 'LICENSE_PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "HighRiskApprovalStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AntiBriberyCommitmentType" AS ENUM ('EMPLOYEE', 'BUSINESS_ASSOCIATE', 'BOARD', 'SENIOR_MANAGEMENT');

-- CreateEnum
CREATE TYPE "BriberyAllegationType" AS ENUM ('BRIBE_OFFER', 'BRIBE_ACCEPTANCE', 'FACILITATION_PAYMENT', 'KICKBACK', 'INFLUENCE_PEDDLING', 'EMBEZZLEMENT_RELATED', 'OTHER');

-- CreateEnum
CREATE TYPE "AbmsInvestigationStatus" AS ENUM ('OPEN', 'ACTIVE', 'CONCLUDED', 'CLOSED', 'REFERRED');

-- CreateEnum
CREATE TYPE "AbmsInvestigationOutcome" AS ENUM ('SUBSTANTIATED', 'PARTIALLY_SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE', 'REFERRED_EXTERNALLY');

-- CreateTable
CREATE TABLE "bribery_risk_assessments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "processId" TEXT,
    "jurisdictionId" TEXT,
    "obligationId" TEXT,
    "complianceRiskId" TEXT,
    "riskId" TEXT,
    "inherentLikelihood" INTEGER NOT NULL DEFAULT 3,
    "inherentImpact" INTEGER NOT NULL DEFAULT 3,
    "inherentScore" INTEGER NOT NULL DEFAULT 9,
    "inherentLevel" "ComplianceRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualScore" INTEGER,
    "residualLevel" "ComplianceRiskLevel",
    "publicOfficialRisk" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyRisk" BOOLEAN NOT NULL DEFAULT false,
    "countryRisk" "BriberyCountryRisk" NOT NULL DEFAULT 'MODERATE',
    "sectorRisk" "BriberyCountryRisk" NOT NULL DEFAULT 'MODERATE',
    "treatment" "ComplianceTreatment" NOT NULL DEFAULT 'MITIGATE',
    "treatmentPlan" TEXT,
    "ownerId" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewDate" TIMESTAMP(3),
    "status" "BriberyAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "evidenceId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bribery_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_associates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "associateType" "BusinessAssociateType" NOT NULL DEFAULT 'SUPPLIER',
    "country" TEXT,
    "registrationNumber" TEXT,
    "industry" TEXT,
    "supplierId" TEXT,
    "riskTier" "AssociateRiskTier" NOT NULL DEFAULT 'MEDIUM',
    "isPublicOfficial" BOOLEAN NOT NULL DEFAULT false,
    "interactsWithPEPs" BOOLEAN NOT NULL DEFAULT false,
    "sanctionedScreen" "ScreeningResult" NOT NULL DEFAULT 'NOT_SCREENED',
    "adverseMedia" "ScreeningResult" NOT NULL DEFAULT 'NOT_SCREENED',
    "ownershipKnown" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssociateStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "onboardingDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_associates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_diligence_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "associateId" TEXT NOT NULL,
    "level" "DueDiligenceLevel" NOT NULL DEFAULT 'STANDARD',
    "purpose" TEXT,
    "status" "DueDiligenceStatus" NOT NULL DEFAULT 'DRAFT',
    "screeningResult" "ScreeningResult" NOT NULL DEFAULT 'NOT_SCREENED',
    "findings" TEXT,
    "residualRisk" "AssociateRiskTier",
    "conditions" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "obligationId" TEXT,
    "complianceRiskId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_diligence_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficial_owners" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "associateId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationality" TEXT,
    "countryOfResidence" TEXT,
    "ownershipPercent" DOUBLE PRECISION,
    "controlType" "BeneficialControlType" NOT NULL DEFAULT 'OWNERSHIP',
    "isPep" BOOLEAN NOT NULL DEFAULT false,
    "pepRole" TEXT,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "evidenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficial_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_hospitality_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "recordType" "GiftHospitalityType" NOT NULL DEFAULT 'GIFT',
    "direction" "GiftDirection" NOT NULL DEFAULT 'GIVEN',
    "description" TEXT NOT NULL,
    "estimatedValue" DOUBLE PRECISION,
    "currency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counterpartyName" TEXT,
    "associateId" TEXT,
    "involvesPublicOfficial" BOOLEAN NOT NULL DEFAULT false,
    "publicOfficialRole" TEXT,
    "status" "GiftHospitalityStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "managerId" TEXT,
    "managerReviewedAt" TIMESTAMP(3),
    "managerDecisionNote" TEXT,
    "complianceReviewerId" TEXT,
    "complianceReviewedAt" TIMESTAMP(3),
    "complianceDecisionNote" TEXT,
    "rejectionReason" TEXT,
    "policyThreshold" DOUBLE PRECISION,
    "aboveThreshold" BOOLEAN NOT NULL DEFAULT false,
    "conflictDeclarationId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_hospitality_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_sponsorship_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "recordType" "DonationSponsorshipType" NOT NULL DEFAULT 'DONATION',
    "beneficiaryName" TEXT NOT NULL,
    "associateId" TEXT,
    "purpose" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "involvesPublicOfficial" BOOLEAN NOT NULL DEFAULT false,
    "politicalDonation" BOOLEAN NOT NULL DEFAULT false,
    "status" "DonationSponsorshipStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "obligationId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_sponsorship_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abms_conflict_declarations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "declarantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNature" "AbmsConflictNature" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "relatedAssociateId" TEXT,
    "relatedParty" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "currency" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" "ConflictReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "mitigationMeasures" TEXT,
    "recusalRequired" BOOLEAN NOT NULL DEFAULT false,
    "conflictOfInterestDeclarationId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abms_conflict_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilitation_payment_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "occurredAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT,
    "publicOfficialRole" TEXT,
    "coerced" BOOLEAN NOT NULL DEFAULT false,
    "status" "FacilitationPaymentStatus" NOT NULL DEFAULT 'REPORTED',
    "speakUpReportId" TEXT,
    "breachId" TEXT,
    "investigationId" TEXT,
    "capaId" TEXT,
    "reportedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilitation_payment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_control_tests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "controlDescription" TEXT,
    "complianceControlId" TEXT,
    "organizationControlId" TEXT,
    "obligationId" TEXT,
    "period" TEXT NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testedById" TEXT,
    "designAdequate" BOOLEAN,
    "operatingEffective" BOOLEAN,
    "sampleSize" INTEGER,
    "exceptionsFound" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "effectiveness" INTEGER,
    "status" "ControlTestStatus" NOT NULL DEFAULT 'PLANNED',
    "nextTestDate" TIMESTAMP(3),
    "evidenceId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_control_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_financial_control_tests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "controlDescription" TEXT,
    "controlArea" "NonFinancialControlArea" NOT NULL DEFAULT 'OTHER',
    "complianceControlId" TEXT,
    "organizationControlId" TEXT,
    "obligationId" TEXT,
    "period" TEXT NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testedById" TEXT,
    "designAdequate" BOOLEAN,
    "operatingEffective" BOOLEAN,
    "sampleSize" INTEGER,
    "exceptionsFound" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "effectiveness" INTEGER,
    "status" "ControlTestStatus" NOT NULL DEFAULT 'PLANNED',
    "nextTestDate" TIMESTAMP(3),
    "evidenceId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_financial_control_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "high_risk_transaction_approvals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transactionType" "HighRiskTransactionType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "associateId" TEXT,
    "counterpartyName" TEXT,
    "country" TEXT,
    "involvesPublicOfficial" BOOLEAN NOT NULL DEFAULT false,
    "riskRationale" TEXT,
    "status" "HighRiskApprovalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "conditions" TEXT,
    "obligationId" TEXT,
    "complianceRiskId" TEXT,
    "dueDiligenceCaseId" TEXT,
    "documentId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "high_risk_transaction_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anti_bribery_commitments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commitmentType" "AntiBriberyCommitmentType" NOT NULL DEFAULT 'EMPLOYEE',
    "subjectUserId" TEXT,
    "associateId" TEXT,
    "subjectName" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT '1',
    "acknowledged" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "documentId" TEXT,
    "evidenceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anti_bribery_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anti_bribery_investigations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "speakUpReportId" TEXT,
    "breachId" TEXT,
    "allegationType" "BriberyAllegationType" NOT NULL DEFAULT 'OTHER',
    "involvesPublicOfficial" BOOLEAN NOT NULL DEFAULT false,
    "estimatedValue" DOUBLE PRECISION,
    "currency" TEXT,
    "jurisdictionId" TEXT,
    "associateId" TEXT,
    "status" "AbmsInvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "AbmsInvestigationOutcome",
    "sanctionsImposed" TEXT,
    "remediationPlanId" TEXT,
    "capaId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anti_bribery_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bribery_risk_assessments_organizationId_status_idx" ON "bribery_risk_assessments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "bribery_risk_assessments_organizationId_residualLevel_idx" ON "bribery_risk_assessments"("organizationId", "residualLevel");

-- CreateIndex
CREATE INDEX "bribery_risk_assessments_organizationId_nextReviewDate_idx" ON "bribery_risk_assessments"("organizationId", "nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "bribery_risk_assessments_organizationId_code_key" ON "bribery_risk_assessments"("organizationId", "code");

-- CreateIndex
CREATE INDEX "business_associates_organizationId_associateType_idx" ON "business_associates"("organizationId", "associateType");

-- CreateIndex
CREATE INDEX "business_associates_organizationId_riskTier_idx" ON "business_associates"("organizationId", "riskTier");

-- CreateIndex
CREATE INDEX "business_associates_organizationId_status_idx" ON "business_associates"("organizationId", "status");

-- CreateIndex
CREATE INDEX "business_associates_organizationId_supplierId_idx" ON "business_associates"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "business_associates_organizationId_code_key" ON "business_associates"("organizationId", "code");

-- CreateIndex
CREATE INDEX "due_diligence_cases_organizationId_status_idx" ON "due_diligence_cases"("organizationId", "status");

-- CreateIndex
CREATE INDEX "due_diligence_cases_organizationId_associateId_idx" ON "due_diligence_cases"("organizationId", "associateId");

-- CreateIndex
CREATE INDEX "due_diligence_cases_organizationId_nextReviewDate_idx" ON "due_diligence_cases"("organizationId", "nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "due_diligence_cases_organizationId_code_key" ON "due_diligence_cases"("organizationId", "code");

-- CreateIndex
CREATE INDEX "beneficial_owners_organizationId_associateId_idx" ON "beneficial_owners"("organizationId", "associateId");

-- CreateIndex
CREATE INDEX "beneficial_owners_organizationId_isPep_idx" ON "beneficial_owners"("organizationId", "isPep");

-- CreateIndex
CREATE UNIQUE INDEX "beneficial_owners_organizationId_code_key" ON "beneficial_owners"("organizationId", "code");

-- CreateIndex
CREATE INDEX "gift_hospitality_records_organizationId_status_idx" ON "gift_hospitality_records"("organizationId", "status");

-- CreateIndex
CREATE INDEX "gift_hospitality_records_organizationId_recordType_idx" ON "gift_hospitality_records"("organizationId", "recordType");

-- CreateIndex
CREATE INDEX "gift_hospitality_records_organizationId_occurredAt_idx" ON "gift_hospitality_records"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "gift_hospitality_records_organizationId_involvesPublicOffic_idx" ON "gift_hospitality_records"("organizationId", "involvesPublicOfficial");

-- CreateIndex
CREATE UNIQUE INDEX "gift_hospitality_records_organizationId_code_key" ON "gift_hospitality_records"("organizationId", "code");

-- CreateIndex
CREATE INDEX "donation_sponsorship_records_organizationId_recordType_idx" ON "donation_sponsorship_records"("organizationId", "recordType");

-- CreateIndex
CREATE INDEX "donation_sponsorship_records_organizationId_status_idx" ON "donation_sponsorship_records"("organizationId", "status");

-- CreateIndex
CREATE INDEX "donation_sponsorship_records_organizationId_politicalDonati_idx" ON "donation_sponsorship_records"("organizationId", "politicalDonation");

-- CreateIndex
CREATE UNIQUE INDEX "donation_sponsorship_records_organizationId_code_key" ON "donation_sponsorship_records"("organizationId", "code");

-- CreateIndex
CREATE INDEX "abms_conflict_declarations_organizationId_hasConflict_idx" ON "abms_conflict_declarations"("organizationId", "hasConflict");

-- CreateIndex
CREATE INDEX "abms_conflict_declarations_organizationId_reviewStatus_idx" ON "abms_conflict_declarations"("organizationId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "abms_conflict_declarations_organizationId_code_key" ON "abms_conflict_declarations"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "abms_conflict_declarations_organizationId_declarantId_perio_key" ON "abms_conflict_declarations"("organizationId", "declarantId", "period");

-- CreateIndex
CREATE INDEX "facilitation_payment_reports_organizationId_status_idx" ON "facilitation_payment_reports"("organizationId", "status");

-- CreateIndex
CREATE INDEX "facilitation_payment_reports_organizationId_speakUpReportId_idx" ON "facilitation_payment_reports"("organizationId", "speakUpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "facilitation_payment_reports_organizationId_code_key" ON "facilitation_payment_reports"("organizationId", "code");

-- CreateIndex
CREATE INDEX "financial_control_tests_organizationId_status_idx" ON "financial_control_tests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "financial_control_tests_organizationId_period_idx" ON "financial_control_tests"("organizationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "financial_control_tests_organizationId_code_key" ON "financial_control_tests"("organizationId", "code");

-- CreateIndex
CREATE INDEX "non_financial_control_tests_organizationId_status_idx" ON "non_financial_control_tests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "non_financial_control_tests_organizationId_controlArea_idx" ON "non_financial_control_tests"("organizationId", "controlArea");

-- CreateIndex
CREATE UNIQUE INDEX "non_financial_control_tests_organizationId_code_key" ON "non_financial_control_tests"("organizationId", "code");

-- CreateIndex
CREATE INDEX "high_risk_transaction_approvals_organizationId_status_idx" ON "high_risk_transaction_approvals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "high_risk_transaction_approvals_organizationId_transactionT_idx" ON "high_risk_transaction_approvals"("organizationId", "transactionType");

-- CreateIndex
CREATE UNIQUE INDEX "high_risk_transaction_approvals_organizationId_code_key" ON "high_risk_transaction_approvals"("organizationId", "code");

-- CreateIndex
CREATE INDEX "anti_bribery_commitments_organizationId_commitmentType_idx" ON "anti_bribery_commitments"("organizationId", "commitmentType");

-- CreateIndex
CREATE INDEX "anti_bribery_commitments_organizationId_associateId_idx" ON "anti_bribery_commitments"("organizationId", "associateId");

-- CreateIndex
CREATE UNIQUE INDEX "anti_bribery_commitments_organizationId_code_key" ON "anti_bribery_commitments"("organizationId", "code");

-- CreateIndex
CREATE INDEX "anti_bribery_investigations_organizationId_status_idx" ON "anti_bribery_investigations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "anti_bribery_investigations_organizationId_allegationType_idx" ON "anti_bribery_investigations"("organizationId", "allegationType");

-- CreateIndex
CREATE INDEX "anti_bribery_investigations_organizationId_speakUpReportId_idx" ON "anti_bribery_investigations"("organizationId", "speakUpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "anti_bribery_investigations_organizationId_code_key" ON "anti_bribery_investigations"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "anti_bribery_investigations_organizationId_investigationId_key" ON "anti_bribery_investigations"("organizationId", "investigationId");

-- AddForeignKey
ALTER TABLE "bribery_risk_assessments" ADD CONSTRAINT "bribery_risk_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_associates" ADD CONSTRAINT "business_associates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_hospitality_records" ADD CONSTRAINT "gift_hospitality_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_hospitality_records" ADD CONSTRAINT "gift_hospitality_records_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_sponsorship_records" ADD CONSTRAINT "donation_sponsorship_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_sponsorship_records" ADD CONSTRAINT "donation_sponsorship_records_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abms_conflict_declarations" ADD CONSTRAINT "abms_conflict_declarations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilitation_payment_reports" ADD CONSTRAINT "facilitation_payment_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_control_tests" ADD CONSTRAINT "financial_control_tests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_financial_control_tests" ADD CONSTRAINT "non_financial_control_tests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_risk_transaction_approvals" ADD CONSTRAINT "high_risk_transaction_approvals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_risk_transaction_approvals" ADD CONSTRAINT "high_risk_transaction_approvals_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_bribery_commitments" ADD CONSTRAINT "anti_bribery_commitments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_bribery_commitments" ADD CONSTRAINT "anti_bribery_commitments_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "business_associates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_bribery_investigations" ADD CONSTRAINT "anti_bribery_investigations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── ISO 37001 WORKFLOW & INTEGRITY CHECKS ───────────

ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_approval_attributed"
  CHECK ("status" NOT IN ('APPROVED') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_rejection_attributed"
  CHECK ("status" <> 'REJECTED' OR ("rejectedById" IS NOT NULL AND "rejectedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL));

ALTER TABLE "gift_hospitality_records" ADD CONSTRAINT "gift_hospitality_compliance_decision_attributed"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED') OR ("complianceReviewerId" IS NOT NULL AND "complianceReviewedAt" IS NOT NULL));
ALTER TABLE "gift_hospitality_records" ADD CONSTRAINT "gift_hospitality_rejection_has_reason"
  CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);

ALTER TABLE "donation_sponsorship_records" ADD CONSTRAINT "donation_sponsorship_approval_attributed"
  CHECK ("status" NOT IN ('APPROVED', 'DISBURSED') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "donation_sponsorship_records" ADD CONSTRAINT "donation_sponsorship_rejection_has_reason"
  CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);

ALTER TABLE "abms_conflict_declarations" ADD CONSTRAINT "abms_conflicts_decision_requires_reviewer"
  CHECK ("reviewStatus" IN ('PENDING', 'UNDER_REVIEW') OR ("reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "abms_conflict_declarations" ADD CONSTRAINT "abms_conflicts_conflict_requires_detail"
  CHECK (NOT "hasConflict" OR ("description" IS NOT NULL));

ALTER TABLE "bribery_risk_assessments" ADD CONSTRAINT "bribery_risk_assessments_approval_attributed"
  CHECK ("status" <> 'APPROVED' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "bribery_risk_assessments" ADD CONSTRAINT "bribery_risk_assessments_scale_range"
  CHECK ("inherentLikelihood" BETWEEN 1 AND 5 AND "inherentImpact" BETWEEN 1 AND 5
    AND ("residualLikelihood" IS NULL OR "residualLikelihood" BETWEEN 1 AND 5)
    AND ("residualImpact" IS NULL OR "residualImpact" BETWEEN 1 AND 5));

ALTER TABLE "high_risk_transaction_approvals" ADD CONSTRAINT "high_risk_approvals_approval_attributed"
  CHECK ("status" <> 'APPROVED' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "high_risk_transaction_approvals" ADD CONSTRAINT "high_risk_approvals_rejection_has_reason"
  CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);

ALTER TABLE "financial_control_tests" ADD CONSTRAINT "financial_control_tests_effectiveness_range"
  CHECK ("effectiveness" IS NULL OR ("effectiveness" >= 0 AND "effectiveness" <= 100));
ALTER TABLE "non_financial_control_tests" ADD CONSTRAINT "non_financial_control_tests_effectiveness_range"
  CHECK ("effectiveness" IS NULL OR ("effectiveness" >= 0 AND "effectiveness" <= 100));

ALTER TABLE "anti_bribery_investigations" ADD CONSTRAINT "abms_investigations_closure_has_outcome"
  CHECK ("status" NOT IN ('CONCLUDED', 'CLOSED') OR ("outcome" IS NOT NULL AND "closedAt" IS NOT NULL));

ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_ownership_percent_range"
  CHECK ("ownershipPercent" IS NULL OR ("ownershipPercent" >= 0 AND "ownershipPercent" <= 100));

-- Tenant integrity for associate-linked children
CREATE OR REPLACE FUNCTION public.nf_validate_abms_tenant() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE parent_org TEXT;
BEGIN
  IF TG_TABLE_NAME IN ('due_diligence_cases', 'beneficial_owners', 'gift_hospitality_records', 'donation_sponsorship_records', 'high_risk_transaction_approvals', 'anti_bribery_commitments')
     AND NEW."associateId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM public."business_associates" WHERE id = NEW."associateId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'ABMS tenant integrity: associate % no pertenece a la organización %', NEW."associateId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['due_diligence_cases','beneficial_owners','gift_hospitality_records','donation_sponsorship_records','high_risk_transaction_approvals','anti_bribery_commitments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nf_%s_tenant_refs ON %I', t, t);
    EXECUTE format('CREATE TRIGGER nf_%s_tenant_refs BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.nf_validate_abms_tenant()', t, t);
  END LOOP;
END $$;

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."bribery_risk_assessments", public."business_associates", public."due_diligence_cases",
      public."beneficial_owners", public."gift_hospitality_records", public."donation_sponsorship_records",
      public."abms_conflict_declarations", public."facilitation_payment_reports",
      public."financial_control_tests", public."non_financial_control_tests",
      public."high_risk_transaction_approvals", public."anti_bribery_commitments",
      public."anti_bribery_investigations"
      TO authenticated;
  END IF;
END
$$;

-- ─── RLS — same compliance module permissions (ISO 37001 extends CMS) ───
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bribery_risk_assessments','business_associates','due_diligence_cases','beneficial_owners',
    'gift_hospitality_records','donation_sponsorship_records','abms_conflict_declarations',
    'facilitation_payment_reports','financial_control_tests','non_financial_control_tests',
    'high_risk_transaction_approvals','anti_bribery_commitments','anti_bribery_investigations'
  ]
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

DROP POLICY IF EXISTS "nf_abms_conflicts_own_or_officer" ON "abms_conflict_declarations";
CREATE POLICY "nf_abms_conflicts_own_or_officer" ON "abms_conflict_declarations"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ("declarantId" = public.nf_current_user_id() OR public.nf_has_org_permission("organizationId", 'compliance:approve'));
