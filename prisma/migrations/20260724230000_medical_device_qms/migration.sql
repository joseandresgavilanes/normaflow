-- ISO 13485 Medical Device QMS (configurable)
-- NOT a substitute for national regulatory requirements.
-- Sensitive vigilance tables gated on md-sensitive:*

CREATE TYPE "MdDeviceStatus" AS ENUM ('DEVELOPMENT', 'DESIGN_TRANSFER', 'PRODUCTION', 'ACTIVE', 'OBSOLETE', 'WITHDRAWN');
CREATE TYPE "MdRecordStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "MdDesignItemStatus" AS ENUM ('OPEN', 'ADDRESSED', 'VERIFIED', 'CLOSED');
CREATE TYPE "MdReviewOutcome" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_WITH_ACTIONS', 'REJECTED');
CREATE TYPE "MdTestResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'CONDITIONAL');
CREATE TYPE "MdTransferStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MdCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "MdSupplierStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'EXITING');
CREATE TYPE "MdQualificationStatus" AS ENUM ('PENDING', 'QUALIFIED', 'CONDITIONAL', 'DISQUALIFIED', 'EXPIRED');
CREATE TYPE "MdBatchStatus" AS ENUM ('IN_PRODUCTION', 'QUARANTINE', 'RELEASED', 'REJECTED', 'RECALLED');
CREATE TYPE "MdComplaintSource" AS ENUM ('CUSTOMER', 'DISTRIBUTOR', 'HEALTHCARE_PROFESSIONAL', 'AUTHORITY', 'INTERNAL', 'OTHER');
CREATE TYPE "MdComplaintStatus" AS ENUM ('RECEIVED', 'TRIAGED', 'INVESTIGATING', 'CAPA_LINKED', 'CLOSED');
CREATE TYPE "MdEventSeverity" AS ENUM ('MINOR', 'MODERATE', 'SERIOUS', 'DEATH');
CREATE TYPE "MdAdverseEventStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'REPORTED_TO_AUTHORITY', 'CLOSED');
CREATE TYPE "MdPmsStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');
CREATE TYPE "MdFsaType" AS ENUM ('FSCA', 'FSN', 'ADVISORY', 'OTHER');
CREATE TYPE "MdFsaStatus" AS ENUM ('DRAFT', 'INITIATED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
CREATE TYPE "MdRecallStatus" AS ENUM ('DRAFT', 'INITIATED', 'NOTIFYING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
CREATE TYPE "MdSubmissionStatus" AS ENUM ('DRAFT', 'PREPARED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "md_device_families" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_device_families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_medical_devices" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "modelNumber" TEXT, "udiDi" TEXT, "familyId" TEXT, "classification" TEXT, "intendedUse" TEXT,
  "status" "MdDeviceStatus" NOT NULL DEFAULT 'DEVELOPMENT', "processId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_medical_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_device_master_records" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1', "title" TEXT NOT NULL, "summary" TEXT,
  "status" "MdRecordStatus" NOT NULL DEFAULT 'DRAFT', "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "documentId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_device_master_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_history_files" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "status" "MdRecordStatus" NOT NULL DEFAULT 'DRAFT', "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_history_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_inputs" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "requirement" TEXT NOT NULL, "source" TEXT, "status" "MdDesignItemStatus" NOT NULL DEFAULT 'OPEN', "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_inputs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_outputs" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "description" TEXT NOT NULL, "linkedInputCodes" TEXT[] DEFAULT ARRAY[]::TEXT[], "documentId" TEXT,
  "status" "MdDesignItemStatus" NOT NULL DEFAULT 'OPEN', "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_outputs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_reviews" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "outcome" "MdReviewOutcome" NOT NULL DEFAULT 'PENDING',
  "findings" TEXT, "reviewedById" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_verifications" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "method" TEXT, "acceptanceCriteria" TEXT, "result" "MdTestResult" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3), "verifiedById" TEXT, "evidenceId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_validations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "method" TEXT, "userNeedsRef" TEXT, "result" "MdTestResult" NOT NULL DEFAULT 'PENDING',
  "validatedAt" TIMESTAMP(3), "validatedById" TEXT, "evidenceId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_validations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_design_transfers" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "dhfId" TEXT NOT NULL,
  "transferredAt" TIMESTAMP(3), "receivingSite" TEXT, "checklistSummary" TEXT,
  "status" "MdTransferStatus" NOT NULL DEFAULT 'PLANNED', "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_design_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_device_risk_files" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "version" TEXT NOT NULL DEFAULT '1', "methodology" TEXT, "residualRiskSummary" TEXT,
  "linkedRiskIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "MdRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "documentId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_device_risk_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_critical_suppliers" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "supplierId" TEXT, "serviceType" TEXT, "criticality" "MdCriticality" NOT NULL DEFAULT 'HIGH',
  "status" "MdSupplierStatus" NOT NULL DEFAULT 'ACTIVE', "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_critical_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_supplier_qualifications" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "criticalSupplierId" TEXT NOT NULL,
  "scope" TEXT, "status" "MdQualificationStatus" NOT NULL DEFAULT 'PENDING', "qualifiedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3), "evidenceId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_supplier_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_process_validations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "deviceId" TEXT, "processId" TEXT, "protocolRef" TEXT, "result" "MdTestResult" NOT NULL DEFAULT 'PENDING',
  "validatedAt" TIMESTAMP(3), "validatedById" TEXT, "evidenceId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_process_validations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_sterilization_validations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT,
  "method" TEXT NOT NULL, "sterilityAssuranceLevel" TEXT, "result" "MdTestResult" NOT NULL DEFAULT 'PENDING',
  "validatedAt" TIMESTAMP(3), "validatedById" TEXT, "evidenceId" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_sterilization_validations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_production_batches" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL, "quantity" DOUBLE PRECISION, "unit" TEXT, "manufacturedAt" TIMESTAMP(3), "expiryAt" TIMESTAMP(3),
  "status" "MdBatchStatus" NOT NULL DEFAULT 'IN_PRODUCTION', "processValidationId" TEXT, "notes" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_production_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_device_traceabilities" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "batchId" TEXT NOT NULL,
  "componentLot" TEXT, "supplierLot" TEXT, "distributionRef" TEXT, "customerAccountRef" TEXT,
  "previousIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "notes" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_device_traceabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_complaints" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT, "batchId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "source" "MdComplaintSource" NOT NULL DEFAULT 'OTHER',
  "category" TEXT, "description" TEXT NOT NULL, "anonymizedSubjectRef" TEXT,
  "status" "MdComplaintStatus" NOT NULL DEFAULT 'RECEIVED', "investigationSummary" TEXT, "capaId" TEXT,
  "documentId" TEXT, "evidenceId" TEXT, "closedAt" TIMESTAMP(3), "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_complaints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_adverse_events" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT, "batchId" TEXT,
  "complaintId" TEXT, "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "severity" "MdEventSeverity" NOT NULL DEFAULT 'MODERATE', "reportable" BOOLEAN NOT NULL DEFAULT false,
  "reportedToAuthority" BOOLEAN NOT NULL DEFAULT false, "description" TEXT NOT NULL, "anonymizedSubjectRef" TEXT,
  "status" "MdAdverseEventStatus" NOT NULL DEFAULT 'REPORTED', "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT,
  "closedAt" TIMESTAMP(3), "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_adverse_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_post_market_surveillances" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "findings" TEXT,
  "status" "MdPmsStatus" NOT NULL DEFAULT 'PLANNED', "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_post_market_surveillances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_field_safety_actions" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT,
  "title" TEXT NOT NULL, "actionType" "MdFsaType" NOT NULL DEFAULT 'FSCA', "reason" TEXT,
  "status" "MdFsaStatus" NOT NULL DEFAULT 'DRAFT', "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3), "lotNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[], "capaId" TEXT, "documentId" TEXT,
  "evidenceId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_field_safety_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_product_recalls" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT,
  "title" TEXT NOT NULL, "reason" TEXT NOT NULL, "lotNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "MdRecallStatus" NOT NULL DEFAULT 'DRAFT', "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3), "authorityNotified" BOOLEAN NOT NULL DEFAULT false,
  "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_product_recalls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_regulatory_requirements" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "jurisdiction" TEXT NOT NULL,
  "framework" TEXT NOT NULL, "clauseRef" TEXT, "title" TEXT NOT NULL, "description" TEXT,
  "mandatory" BOOLEAN NOT NULL DEFAULT true, "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_regulatory_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "md_regulatory_submissions" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "deviceId" TEXT,
  "jurisdiction" TEXT NOT NULL, "submissionType" TEXT NOT NULL, "status" "MdSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3), "referenceNumber" TEXT, "summary" TEXT, "documentId" TEXT, "evidenceId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "md_regulatory_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "md_device_families_organizationId_code_key" ON "md_device_families"("organizationId", "code");
CREATE UNIQUE INDEX "md_medical_devices_organizationId_code_key" ON "md_medical_devices"("organizationId", "code");
CREATE UNIQUE INDEX "md_device_master_records_organizationId_code_version_key" ON "md_device_master_records"("organizationId", "code", "version");
CREATE UNIQUE INDEX "md_design_history_files_organizationId_code_key" ON "md_design_history_files"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_inputs_organizationId_code_key" ON "md_design_inputs"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_outputs_organizationId_code_key" ON "md_design_outputs"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_reviews_organizationId_code_key" ON "md_design_reviews"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_verifications_organizationId_code_key" ON "md_design_verifications"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_validations_organizationId_code_key" ON "md_design_validations"("organizationId", "code");
CREATE UNIQUE INDEX "md_design_transfers_organizationId_code_key" ON "md_design_transfers"("organizationId", "code");
CREATE UNIQUE INDEX "md_device_risk_files_organizationId_code_version_key" ON "md_device_risk_files"("organizationId", "code", "version");
CREATE UNIQUE INDEX "md_critical_suppliers_organizationId_code_key" ON "md_critical_suppliers"("organizationId", "code");
CREATE UNIQUE INDEX "md_supplier_qualifications_organizationId_code_key" ON "md_supplier_qualifications"("organizationId", "code");
CREATE UNIQUE INDEX "md_process_validations_organizationId_code_key" ON "md_process_validations"("organizationId", "code");
CREATE UNIQUE INDEX "md_sterilization_validations_organizationId_code_key" ON "md_sterilization_validations"("organizationId", "code");
CREATE UNIQUE INDEX "md_production_batches_organizationId_code_key" ON "md_production_batches"("organizationId", "code");
CREATE UNIQUE INDEX "md_device_traceabilities_organizationId_code_key" ON "md_device_traceabilities"("organizationId", "code");
CREATE UNIQUE INDEX "md_complaints_organizationId_code_key" ON "md_complaints"("organizationId", "code");
CREATE UNIQUE INDEX "md_adverse_events_organizationId_code_key" ON "md_adverse_events"("organizationId", "code");
CREATE UNIQUE INDEX "md_post_market_surveillances_organizationId_code_key" ON "md_post_market_surveillances"("organizationId", "code");
CREATE UNIQUE INDEX "md_field_safety_actions_organizationId_code_key" ON "md_field_safety_actions"("organizationId", "code");
CREATE UNIQUE INDEX "md_product_recalls_organizationId_code_key" ON "md_product_recalls"("organizationId", "code");
CREATE UNIQUE INDEX "md_regulatory_requirements_organizationId_code_key" ON "md_regulatory_requirements"("organizationId", "code");
CREATE UNIQUE INDEX "md_regulatory_submissions_organizationId_code_key" ON "md_regulatory_submissions"("organizationId", "code");
CREATE UNIQUE INDEX "md_production_batches_organizationId_lotNumber_key" ON "md_production_batches"("organizationId", "lotNumber");

ALTER TABLE "md_device_families" ADD CONSTRAINT "md_device_families_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_medical_devices" ADD CONSTRAINT "md_medical_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_medical_devices" ADD CONSTRAINT "md_medical_devices_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "md_device_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_device_master_records" ADD CONSTRAINT "md_device_master_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_device_master_records" ADD CONSTRAINT "md_device_master_records_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_history_files" ADD CONSTRAINT "md_design_history_files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_history_files" ADD CONSTRAINT "md_design_history_files_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_inputs" ADD CONSTRAINT "md_design_inputs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_inputs" ADD CONSTRAINT "md_design_inputs_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_outputs" ADD CONSTRAINT "md_design_outputs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_outputs" ADD CONSTRAINT "md_design_outputs_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_reviews" ADD CONSTRAINT "md_design_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_reviews" ADD CONSTRAINT "md_design_reviews_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_verifications" ADD CONSTRAINT "md_design_verifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_verifications" ADD CONSTRAINT "md_design_verifications_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_validations" ADD CONSTRAINT "md_design_validations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_validations" ADD CONSTRAINT "md_design_validations_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_transfers" ADD CONSTRAINT "md_design_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_design_transfers" ADD CONSTRAINT "md_design_transfers_dhfId_fkey" FOREIGN KEY ("dhfId") REFERENCES "md_design_history_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_device_risk_files" ADD CONSTRAINT "md_device_risk_files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_device_risk_files" ADD CONSTRAINT "md_device_risk_files_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_critical_suppliers" ADD CONSTRAINT "md_critical_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_supplier_qualifications" ADD CONSTRAINT "md_supplier_qualifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_supplier_qualifications" ADD CONSTRAINT "md_supplier_qualifications_criticalSupplierId_fkey" FOREIGN KEY ("criticalSupplierId") REFERENCES "md_critical_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_process_validations" ADD CONSTRAINT "md_process_validations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_process_validations" ADD CONSTRAINT "md_process_validations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_sterilization_validations" ADD CONSTRAINT "md_sterilization_validations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_sterilization_validations" ADD CONSTRAINT "md_sterilization_validations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_production_batches" ADD CONSTRAINT "md_production_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_production_batches" ADD CONSTRAINT "md_production_batches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_production_batches" ADD CONSTRAINT "md_production_batches_processValidationId_fkey" FOREIGN KEY ("processValidationId") REFERENCES "md_process_validations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_device_traceabilities" ADD CONSTRAINT "md_device_traceabilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_device_traceabilities" ADD CONSTRAINT "md_device_traceabilities_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "md_production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_complaints" ADD CONSTRAINT "md_complaints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_complaints" ADD CONSTRAINT "md_complaints_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_complaints" ADD CONSTRAINT "md_complaints_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "md_production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_adverse_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_adverse_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_adverse_events_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "md_production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_adverse_events_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "md_complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_post_market_surveillances" ADD CONSTRAINT "md_post_market_surveillances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_post_market_surveillances" ADD CONSTRAINT "md_post_market_surveillances_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_field_safety_actions" ADD CONSTRAINT "md_field_safety_actions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_field_safety_actions" ADD CONSTRAINT "md_field_safety_actions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_product_recalls" ADD CONSTRAINT "md_product_recalls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_product_recalls" ADD CONSTRAINT "md_product_recalls_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "md_regulatory_requirements" ADD CONSTRAINT "md_regulatory_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_regulatory_submissions" ADD CONSTRAINT "md_regulatory_submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "md_regulatory_submissions" ADD CONSTRAINT "md_regulatory_submissions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "md_medical_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "md_device_master_records" ADD CONSTRAINT "md_dmr_approved_attributed" CHECK ("status" <> 'APPROVED' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "md_design_reviews" ADD CONSTRAINT "md_review_approved_attributed" CHECK ("outcome" NOT IN ('APPROVED','APPROVED_WITH_ACTIONS') OR "reviewedById" IS NOT NULL);
ALTER TABLE "md_design_verifications" ADD CONSTRAINT "md_verification_pass_attributed" CHECK ("result" = 'PENDING' OR ("verifiedAt" IS NOT NULL AND "verifiedById" IS NOT NULL));
ALTER TABLE "md_design_validations" ADD CONSTRAINT "md_validation_pass_attributed" CHECK ("result" = 'PENDING' OR ("validatedAt" IS NOT NULL AND "validatedById" IS NOT NULL));
ALTER TABLE "md_post_market_surveillances" ADD CONSTRAINT "md_pms_period_order" CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "md_product_recalls" ADD CONSTRAINT "md_recall_closed_attributed" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);
ALTER TABLE "md_complaints" ADD CONSTRAINT "md_complaint_subject_opaque" CHECK ("anonymizedSubjectRef" IS NULL OR ("anonymizedSubjectRef" !~* '@' AND "anonymizedSubjectRef" !~ '[0-9]{8,}'));
ALTER TABLE "md_adverse_events" ADD CONSTRAINT "md_ae_subject_opaque" CHECK ("anonymizedSubjectRef" IS NULL OR ("anonymizedSubjectRef" !~* '@' AND "anonymizedSubjectRef" !~ '[0-9]{8,}'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."md_device_families", public."md_medical_devices", public."md_device_master_records", public."md_design_history_files", public."md_design_inputs", public."md_design_outputs", public."md_design_reviews", public."md_design_verifications", public."md_design_validations", public."md_design_transfers", public."md_device_risk_files", public."md_critical_suppliers", public."md_supplier_qualifications", public."md_process_validations", public."md_sterilization_validations", public."md_production_batches", public."md_device_traceabilities", public."md_complaints", public."md_adverse_events", public."md_post_market_surveillances", public."md_field_safety_actions", public."md_product_recalls", public."md_regulatory_requirements", public."md_regulatory_submissions"
      TO authenticated;
  END IF;
END $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['md_device_families','md_medical_devices','md_device_master_records','md_design_history_files','md_design_inputs','md_design_outputs','md_design_reviews','md_design_verifications','md_design_validations','md_design_transfers','md_device_risk_files','md_critical_suppliers','md_supplier_qualifications','md_process_validations','md_sterilization_validations','md_production_batches','md_device_traceabilities','md_post_market_surveillances','md_regulatory_requirements','md_regulatory_submissions']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'medical-devices:read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'medical-devices:create');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'medical-devices:update', 'medical-devices:update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'medical-devices:delete');
  END LOOP;
END $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['md_complaints','md_adverse_events','md_field_safety_actions','md_product_recalls']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'md-sensitive:read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'md-sensitive:create');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'md-sensitive:update', 'md-sensitive:update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'md-sensitive:delete');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export', 'food-safety:read', 'food-safety:export', 'itsm:read', 'itsm:export', 'medical-devices:read', 'medical-devices:export', 'md-sensitive:read', 'md-sensitive:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create', 'food-safety:read', 'food-safety:create', 'itsm:read', 'itsm:create', 'medical-devices:read', 'medical-devices:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read', 'food-safety:read', 'itsm:read', 'medical-devices:read']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
