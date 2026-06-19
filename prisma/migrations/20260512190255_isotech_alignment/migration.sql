-- ISOTech manual alignment migration
-- Adds entities required to cover the functional reference:
--   §10 Groups + permissions   §11 Positions, Personnel
--   §12 Locations, doc extras  §13 Records + 4 catalogs
--   §14 ACPM 6-stage workflow  §15 Audit programs + checklists
--   §16 Management review

-- ─── New enums ────────────────────────────────────────────
CREATE TYPE "ACPMStage" AS ENUM (
  'REQUEST',
  'REQUEST_APPROVAL',
  'ANALYSIS',
  'SOLUTION_APPROVAL',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED'
);

CREATE TYPE "AuditProgramStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'IN_EXECUTION',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ChecklistItemStatus" AS ENUM (
  'PENDING',
  'COMPLIANT',
  'NONCOMPLIANT',
  'NOT_APPLICABLE'
);

CREATE TYPE "ManagementReviewStatus" AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ManagementReviewTopic" AS ENUM (
  'PREVIOUS_REVIEW_FOLLOWUP',
  'AUDIT_RESULTS',
  'CUSTOMER_FEEDBACK',
  'PROCESS_PERFORMANCE',
  'PRODUCT_CONFORMITY',
  'NONCONFORMITIES_ACTIONS',
  'MONITORING_MEASUREMENT',
  'EXTERNAL_PROVIDERS',
  'ADEQUACY_RESOURCES',
  'EFFECTIVENESS_RISK_ACTIONS',
  'IMPROVEMENT_OPPORTUNITIES',
  'CHANGES_INTERNAL_EXTERNAL',
  'OTHER'
);

-- ─── Document extensions ──────────────────────────────────
ALTER TABLE "documents"
  ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "externalLink" TEXT,
  ADD COLUMN "custodianId" TEXT,
  ADD COLUMN "responsibleElaborationId" TEXT,
  ADD COLUMN "responsibleApprovalId" TEXT,
  ADD COLUMN "locationId" TEXT,
  ADD COLUMN "physicalLocation" TEXT,
  ADD COLUMN "distributionList" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "observations" TEXT;

-- ─── DocumentVersion extensions ───────────────────────────
ALTER TABLE "document_versions"
  ADD COLUMN "changeDescription" TEXT,
  ADD COLUMN "previousVersion" TEXT;

-- ─── Action (ACPM) extensions ─────────────────────────────
ALTER TABLE "actions"
  ADD COLUMN "stage" "ACPMStage" NOT NULL DEFAULT 'REQUEST',
  ADD COLUMN "source" TEXT,
  ADD COLUMN "rootCause" TEXT,
  ADD COLUMN "proposedSolution" TEXT,
  ADD COLUMN "effectivenessCheck" TEXT,
  ADD COLUMN "effectivenessAt" TIMESTAMP(3),
  ADD COLUMN "requestedById" TEXT,
  ADD COLUMN "requestApproverId" TEXT,
  ADD COLUMN "solutionApproverId" TEXT,
  ADD COLUMN "managementReviewId" TEXT;

-- ─── Audit extensions ─────────────────────────────────────
ALTER TABLE "audits"
  ADD COLUMN "programId" TEXT,
  ADD COLUMN "criteria" TEXT;

-- ─── Groups (§ 10) ────────────────────────────────────────
CREATE TABLE "groups" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "groups_org_name_idx" ON "groups"("organizationId", "name");

CREATE TABLE "group_memberships" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "group_memberships_group_user_idx" ON "group_memberships"("groupId", "userId");

CREATE TABLE "group_permissions" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "permission" TEXT NOT NULL
);
CREATE UNIQUE INDEX "group_permissions_group_perm_idx" ON "group_permissions"("groupId", "permission");

-- ─── Positions / Cargo (§ 11) ─────────────────────────────
CREATE TABLE "positions" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "positions_org_name_idx" ON "positions"("organizationId", "name");

-- ─── Personnel (§ 11) ─────────────────────────────────────
CREATE TABLE "personnel" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "identification" TEXT,
  "positionId" TEXT REFERENCES "positions"("id"),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "hiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ─── Locations (§ 12.1.1) ─────────────────────────────────
CREATE TABLE "locations" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "locations_org_name_idx" ON "locations"("organizationId", "name");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id");

-- ─── Records catalogs (§ 13.1) ────────────────────────────
CREATE TABLE "retention_times" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "months" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "retention_times_org_name_idx" ON "retention_times"("organizationId", "name");

CREATE TABLE "dispositions" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "dispositions_org_name_idx" ON "dispositions"("organizationId", "name");

CREATE TABLE "archive_methods" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "archive_methods_org_name_idx" ON "archive_methods"("organizationId", "name");

CREATE TABLE "record_types" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "record_types_org_name_idx" ON "record_types"("organizationId", "name");

-- ─── Records (§ 13.2) ─────────────────────────────────────
CREATE TABLE "records" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "processId" TEXT,
  "recordTypeId" TEXT REFERENCES "record_types"("id"),
  "retentionTimeId" TEXT REFERENCES "retention_times"("id"),
  "dispositionId" TEXT REFERENCES "dispositions"("id"),
  "archiveMethodId" TEXT REFERENCES "archive_methods"("id"),
  "custodianId" TEXT,
  "physicalLocation" TEXT,
  "digitalLocation" TEXT,
  "observations" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "records_org_code_idx" ON "records"("organizationId", "code");

CREATE TABLE "record_entries" (
  "id" TEXT PRIMARY KEY,
  "recordId" TEXT NOT NULL REFERENCES "records"("id") ON DELETE CASCADE,
  "reference" TEXT,
  "description" TEXT,
  "fileUrl" TEXT,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "enteredById" TEXT,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Audit program + checklist (§ 15) ─────────────────────
CREATE TABLE "audit_programs" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "year" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "objectives" TEXT,
  "scope" TEXT,
  "status" "AuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "audit_programs_org_year_title_idx" ON "audit_programs"("organizationId", "year", "title");

ALTER TABLE "audits"
  ADD CONSTRAINT "audits_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "audit_programs"("id");

CREATE TABLE "audit_checklist_items" (
  "id" TEXT PRIMARY KEY,
  "auditId" TEXT NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "clauseCode" TEXT,
  "question" TEXT NOT NULL,
  "expected" TEXT,
  "response" TEXT,
  "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Management review (§ 16) ─────────────────────────────
CREATE TABLE "management_reviews" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3),
  "heldAt" TIMESTAMP(3),
  "status" "ManagementReviewStatus" NOT NULL DEFAULT 'PLANNED',
  "chairId" TEXT,
  "attendees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT,
  "reportUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "management_review_inputs" (
  "id" TEXT PRIMARY KEY,
  "reviewId" TEXT NOT NULL REFERENCES "management_reviews"("id") ON DELETE CASCADE,
  "topic" "ManagementReviewTopic" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "management_review_decisions" (
  "id" TEXT PRIMARY KEY,
  "reviewId" TEXT NOT NULL REFERENCES "management_reviews"("id") ON DELETE CASCADE,
  "topic" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "actions"
  ADD CONSTRAINT "actions_managementReviewId_fkey"
  FOREIGN KEY ("managementReviewId") REFERENCES "management_reviews"("id");
