-- ISO/IEC 20000 IT Service Management (ITSM)
-- Namespace itsm_* — distinct from security_incidents

CREATE TYPE "ItsmServiceStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'RETIRED');
CREATE TYPE "ItsmCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ItsmOwnerRole" AS ENUM ('PRIMARY', 'BACKUP', 'DELEGATE');
CREATE TYPE "ItsmPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ItsmImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ItsmUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ItsmAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED');
CREATE TYPE "ItsmRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED', 'CLOSED');
CREATE TYPE "ITSMIncidentStatus" AS ENUM ('NEW', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED', 'CONFIRMED', 'CLOSED');
CREATE TYPE "ITSMProblemStatus" AS ENUM ('IDENTIFIED', 'ANALYSIS', 'KNOWN_ERROR', 'REMEDIATION', 'RESOLVED', 'CLOSED');
CREATE TYPE "ItsmKnownErrorStatus" AS ENUM ('OPEN', 'DOCUMENTED', 'RESOLVED');
CREATE TYPE "ItsmChangeType" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY');
CREATE TYPE "ITSMChangeStatus" AS ENUM ('REQUESTED', 'ASSESSED', 'APPROVED', 'SCHEDULED', 'IMPLEMENTED', 'REVIEWED', 'CLOSED');
CREATE TYPE "ItsmReleaseStatus" AS ENUM ('PLANNED', 'BUILDING', 'READY', 'RELEASED', 'ROLLED_BACK');
CREATE TYPE "ItsmEnvironment" AS ENUM ('DEV', 'TEST', 'STAGING', 'PROD');
CREATE TYPE "ItsmDeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "ItsmCIType" AS ENUM ('APPLICATION', 'SERVER', 'DATABASE', 'NETWORK', 'SERVICE', 'DOCUMENTATION', 'OTHER');
CREATE TYPE "ItsmCIStatus" AS ENUM ('IN_USE', 'MAINTENANCE', 'RETIRED', 'PLANNED');
CREATE TYPE "ItsmCIRelationType" AS ENUM ('DEPENDS_ON', 'RUNS_ON', 'CONNECTS_TO', 'USES', 'OWNED_BY', 'OTHER');
CREATE TYPE "ItsmPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'SUPERSEDED');
CREATE TYPE "ItsmSupplierStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'EXITING', 'INACTIVE');
CREATE TYPE "ItsmReportType" AS ENUM ('SLA', 'INCIDENTS', 'AVAILABILITY', 'CAPACITY', 'CONTINUITY', 'SUPPLIERS', 'PERFORMANCE', 'CUSTOM');
CREATE TYPE "ItsmKnowledgeCategory" AS ENUM ('HOWTO', 'KNOWN_ERROR', 'FAQ', 'RUNBOOK', 'OTHER');
CREATE TYPE "ItsmKnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "itsm_services" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "category" TEXT, "criticality" "ItsmCriticality" NOT NULL DEFAULT 'MEDIUM',
  "status" "ItsmServiceStatus" NOT NULL DEFAULT 'ACTIVE', "processId" TEXT, "documentId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_catalog_entries" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "requestable" BOOLEAN NOT NULL DEFAULT true,
  "estimatedFulfillmentHours" DOUBLE PRECISION, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_catalog_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_owners" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "userId" TEXT, "ownerName" TEXT, "ownershipRole" "ItsmOwnerRole" NOT NULL DEFAULT 'PRIMARY',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_owners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_level_agreements" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "priority" "ItsmPriority" NOT NULL DEFAULT 'MEDIUM',
  "responseTimeMinutes" INTEGER NOT NULL, "resolutionTimeMinutes" INTEGER NOT NULL,
  "availabilityTargetPct" DOUBLE PRECISION, "measurementPeriod" TEXT,
  "status" "ItsmAgreementStatus" NOT NULL DEFAULT 'DRAFT', "effectiveFrom" TIMESTAMP(3), "effectiveTo" TIMESTAMP(3),
  "documentId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_level_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_operational_level_agreements" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "slaId" TEXT, "name" TEXT NOT NULL, "supportingTeam" TEXT, "responseTimeMinutes" INTEGER,
  "resolutionTimeMinutes" INTEGER, "description" TEXT, "status" "ItsmAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "documentId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_operational_level_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_requests" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "serviceId" TEXT, "catalogEntryId" TEXT, "slaId" TEXT, "requesterId" TEXT, "assigneeId" TEXT,
  "priority" "ItsmPriority" NOT NULL DEFAULT 'MEDIUM', "status" "ItsmRequestStatus" NOT NULL DEFAULT 'NEW',
  "dueAt" TIMESTAMP(3), "fulfilledAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_problems" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "serviceId" TEXT, "status" "ITSMProblemStatus" NOT NULL DEFAULT 'IDENTIFIED',
  "rootCause" TEXT, "workaround" TEXT, "assigneeId" TEXT,
  "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_problems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_configuration_items" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "ciType" "ItsmCIType" NOT NULL DEFAULT 'OTHER', "status" "ItsmCIStatus" NOT NULL DEFAULT 'IN_USE',
  "serviceId" TEXT, "assetId" TEXT, "ownerId" TEXT, "locationId" TEXT,
  "criticality" "ItsmCriticality" NOT NULL DEFAULT 'MEDIUM', "version" TEXT, "serialNumber" TEXT, "notes" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_configuration_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_incidents" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "serviceId" TEXT, "slaId" TEXT, "requestId" TEXT, "problemId" TEXT, "configurationItemId" TEXT,
  "reporterId" TEXT, "assigneeId" TEXT, "priority" "ItsmPriority" NOT NULL DEFAULT 'MEDIUM',
  "impact" "ItsmImpact" NOT NULL DEFAULT 'MEDIUM', "urgency" "ItsmUrgency" NOT NULL DEFAULT 'MEDIUM',
  "status" "ITSMIncidentStatus" NOT NULL DEFAULT 'NEW', "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3), "confirmedAt" TIMESTAMP(3), "confirmedById" TEXT, "closedAt" TIMESTAMP(3),
  "resolutionNotes" TEXT, "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_known_errors" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "problemId" TEXT, "configurationItemId" TEXT, "workaround" TEXT, "permanentFix" TEXT,
  "status" "ItsmKnownErrorStatus" NOT NULL DEFAULT 'OPEN', "documentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_known_errors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_changes" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "serviceId" TEXT, "changeType" "ItsmChangeType" NOT NULL DEFAULT 'NORMAL',
  "status" "ITSMChangeStatus" NOT NULL DEFAULT 'REQUESTED', "riskLevel" "ItsmCriticality" NOT NULL DEFAULT 'MEDIUM',
  "impact" "ItsmImpact" NOT NULL DEFAULT 'MEDIUM', "requestedById" TEXT, "assessedById" TEXT, "approvedById" TEXT,
  "implementedById" TEXT, "scheduledStart" TIMESTAMP(3), "scheduledEnd" TIMESTAMP(3), "implementedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3), "relatedIncidentId" TEXT, "relatedProblemId" TEXT,
  "capaId" TEXT, "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_releases" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "version" TEXT NOT NULL, "serviceId" TEXT, "status" "ItsmReleaseStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3), "changeCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_deployments" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "releaseId" TEXT NOT NULL,
  "environment" "ItsmEnvironment" NOT NULL DEFAULT 'PROD', "status" "ItsmDeploymentStatus" NOT NULL DEFAULT 'PENDING',
  "configurationItemId" TEXT, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "notes" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_deployments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_cmdb_relationships" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "sourceCiId" TEXT NOT NULL,
  "targetCiId" TEXT NOT NULL, "relationType" "ItsmCIRelationType" NOT NULL DEFAULT 'DEPENDS_ON', "notes" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_cmdb_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_availability_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "targetPercent" DOUBLE PRECISION NOT NULL, "measurementPeriod" TEXT,
  "agreedDowntimeMinutes" INTEGER, "actualAvailabilityPct" DOUBLE PRECISION,
  "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3), "status" "ItsmPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_availability_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_capacity_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "metric" TEXT NOT NULL, "currentCapacity" DOUBLE PRECISION, "forecastCapacity" DOUBLE PRECISION,
  "thresholdPercent" DOUBLE PRECISION, "unit" TEXT, "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3),
  "status" "ItsmPlanStatus" NOT NULL DEFAULT 'DRAFT', "notes" TEXT, "documentId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_capacity_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_continuity_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "rtoMinutes" INTEGER, "rpoMinutes" INTEGER,
  "status" "ItsmPlanStatus" NOT NULL DEFAULT 'DRAFT', "bcpId" TEXT, "lastTestedAt" TIMESTAMP(3),
  "documentId" TEXT, "evidenceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_continuity_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_suppliers" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "serviceId" TEXT, "supplierId" TEXT, "contractRef" TEXT, "criticality" "ItsmCriticality" NOT NULL DEFAULT 'MEDIUM',
  "status" "ItsmSupplierStatus" NOT NULL DEFAULT 'ACTIVE', "reviewDueAt" TIMESTAMP(3), "notes" TEXT, "documentId" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_service_reports" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "reportType" "ItsmReportType" NOT NULL DEFAULT 'PERFORMANCE', "serviceId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "summary" TEXT, "metrics" JSONB,
  "documentId" TEXT, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_service_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itsm_knowledge_articles" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
  "category" "ItsmKnowledgeCategory" NOT NULL DEFAULT 'HOWTO', "content" TEXT NOT NULL,
  "status" "ItsmKnowledgeStatus" NOT NULL DEFAULT 'DRAFT', "serviceId" TEXT, "knownErrorId" TEXT,
  "problemId" TEXT, "incidentId" TEXT, "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "authorId" TEXT, "publishedAt" TIMESTAMP(3),
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itsm_knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "itsm_services_organizationId_code_key" ON "itsm_services"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_catalog_entries_organizationId_code_key" ON "itsm_service_catalog_entries"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_owners_organizationId_code_key" ON "itsm_service_owners"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_level_agreements_organizationId_code_key" ON "itsm_service_level_agreements"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_operational_level_agreements_organizationId_code_key" ON "itsm_operational_level_agreements"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_requests_organizationId_code_key" ON "itsm_service_requests"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_problems_organizationId_code_key" ON "itsm_problems"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_configuration_items_organizationId_code_key" ON "itsm_configuration_items"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_incidents_organizationId_code_key" ON "itsm_incidents"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_known_errors_organizationId_code_key" ON "itsm_known_errors"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_changes_organizationId_code_key" ON "itsm_changes"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_releases_organizationId_code_key" ON "itsm_releases"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_deployments_organizationId_code_key" ON "itsm_deployments"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_cmdb_relationships_organizationId_code_key" ON "itsm_cmdb_relationships"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_availability_plans_organizationId_code_key" ON "itsm_availability_plans"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_capacity_plans_organizationId_code_key" ON "itsm_capacity_plans"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_continuity_plans_organizationId_code_key" ON "itsm_service_continuity_plans"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_suppliers_organizationId_code_key" ON "itsm_service_suppliers"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_service_reports_organizationId_code_key" ON "itsm_service_reports"("organizationId", "code");
CREATE UNIQUE INDEX "itsm_knowledge_articles_organizationId_code_key" ON "itsm_knowledge_articles"("organizationId", "code");
CREATE INDEX "itsm_services_organizationId_status_idx" ON "itsm_services"("organizationId", "status");
CREATE INDEX "itsm_services_organizationId_criticality_idx" ON "itsm_services"("organizationId", "criticality");
CREATE INDEX "itsm_service_catalog_entries_organizationId_serviceId_idx" ON "itsm_service_catalog_entries"("organizationId", "serviceId");
CREATE INDEX "itsm_service_catalog_entries_organizationId_active_idx" ON "itsm_service_catalog_entries"("organizationId", "active");
CREATE INDEX "itsm_service_owners_organizationId_serviceId_idx" ON "itsm_service_owners"("organizationId", "serviceId");
CREATE INDEX "itsm_service_level_agreements_organizationId_serviceId_idx" ON "itsm_service_level_agreements"("organizationId", "serviceId");
CREATE INDEX "itsm_service_level_agreements_organizationId_status_idx" ON "itsm_service_level_agreements"("organizationId", "status");
CREATE INDEX "itsm_operational_level_agreements_organizationId_serviceId_idx" ON "itsm_operational_level_agreements"("organizationId", "serviceId");
CREATE INDEX "itsm_operational_level_agreements_organizationId_slaId_idx" ON "itsm_operational_level_agreements"("organizationId", "slaId");
CREATE INDEX "itsm_service_requests_organizationId_status_idx" ON "itsm_service_requests"("organizationId", "status");
CREATE INDEX "itsm_service_requests_organizationId_serviceId_idx" ON "itsm_service_requests"("organizationId", "serviceId");
CREATE INDEX "itsm_service_requests_organizationId_priority_idx" ON "itsm_service_requests"("organizationId", "priority");
CREATE INDEX "itsm_problems_organizationId_status_idx" ON "itsm_problems"("organizationId", "status");
CREATE INDEX "itsm_problems_organizationId_serviceId_idx" ON "itsm_problems"("organizationId", "serviceId");
CREATE INDEX "itsm_configuration_items_organizationId_ciType_idx" ON "itsm_configuration_items"("organizationId", "ciType");
CREATE INDEX "itsm_configuration_items_organizationId_status_idx" ON "itsm_configuration_items"("organizationId", "status");
CREATE INDEX "itsm_configuration_items_organizationId_serviceId_idx" ON "itsm_configuration_items"("organizationId", "serviceId");
CREATE INDEX "itsm_incidents_organizationId_status_idx" ON "itsm_incidents"("organizationId", "status");
CREATE INDEX "itsm_incidents_organizationId_serviceId_idx" ON "itsm_incidents"("organizationId", "serviceId");
CREATE INDEX "itsm_incidents_organizationId_priority_idx" ON "itsm_incidents"("organizationId", "priority");
CREATE INDEX "itsm_known_errors_organizationId_status_idx" ON "itsm_known_errors"("organizationId", "status");
CREATE INDEX "itsm_known_errors_organizationId_problemId_idx" ON "itsm_known_errors"("organizationId", "problemId");
CREATE INDEX "itsm_changes_organizationId_status_idx" ON "itsm_changes"("organizationId", "status");
CREATE INDEX "itsm_changes_organizationId_changeType_idx" ON "itsm_changes"("organizationId", "changeType");
CREATE INDEX "itsm_changes_organizationId_serviceId_idx" ON "itsm_changes"("organizationId", "serviceId");
CREATE INDEX "itsm_releases_organizationId_status_idx" ON "itsm_releases"("organizationId", "status");
CREATE INDEX "itsm_releases_organizationId_serviceId_idx" ON "itsm_releases"("organizationId", "serviceId");
CREATE INDEX "itsm_deployments_organizationId_releaseId_idx" ON "itsm_deployments"("organizationId", "releaseId");
CREATE INDEX "itsm_deployments_organizationId_status_idx" ON "itsm_deployments"("organizationId", "status");
CREATE INDEX "itsm_cmdb_relationships_organizationId_sourceCiId_idx" ON "itsm_cmdb_relationships"("organizationId", "sourceCiId");
CREATE INDEX "itsm_cmdb_relationships_organizationId_targetCiId_idx" ON "itsm_cmdb_relationships"("organizationId", "targetCiId");
CREATE INDEX "itsm_availability_plans_organizationId_serviceId_idx" ON "itsm_availability_plans"("organizationId", "serviceId");
CREATE INDEX "itsm_availability_plans_organizationId_status_idx" ON "itsm_availability_plans"("organizationId", "status");
CREATE INDEX "itsm_capacity_plans_organizationId_serviceId_idx" ON "itsm_capacity_plans"("organizationId", "serviceId");
CREATE INDEX "itsm_capacity_plans_organizationId_status_idx" ON "itsm_capacity_plans"("organizationId", "status");
CREATE INDEX "itsm_service_continuity_plans_organizationId_serviceId_idx" ON "itsm_service_continuity_plans"("organizationId", "serviceId");
CREATE INDEX "itsm_service_continuity_plans_organizationId_status_idx" ON "itsm_service_continuity_plans"("organizationId", "status");
CREATE INDEX "itsm_service_suppliers_organizationId_status_idx" ON "itsm_service_suppliers"("organizationId", "status");
CREATE INDEX "itsm_service_suppliers_organizationId_serviceId_idx" ON "itsm_service_suppliers"("organizationId", "serviceId");
CREATE INDEX "itsm_service_reports_organizationId_reportType_idx" ON "itsm_service_reports"("organizationId", "reportType");
CREATE INDEX "itsm_service_reports_organizationId_serviceId_idx" ON "itsm_service_reports"("organizationId", "serviceId");
CREATE INDEX "itsm_knowledge_articles_organizationId_status_idx" ON "itsm_knowledge_articles"("organizationId", "status");
CREATE INDEX "itsm_knowledge_articles_organizationId_category_idx" ON "itsm_knowledge_articles"("organizationId", "category");
CREATE INDEX "itsm_knowledge_articles_organizationId_serviceId_idx" ON "itsm_knowledge_articles"("organizationId", "serviceId");
CREATE UNIQUE INDEX "itsm_cmdb_relationships_sourceCiId_targetCiId_relationType_key" ON "itsm_cmdb_relationships"("sourceCiId", "targetCiId", "relationType");

ALTER TABLE "itsm_services" ADD CONSTRAINT "itsm_services_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_catalog_entries" ADD CONSTRAINT "itsm_service_catalog_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_catalog_entries" ADD CONSTRAINT "itsm_service_catalog_entries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_owners" ADD CONSTRAINT "itsm_service_owners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_owners" ADD CONSTRAINT "itsm_service_owners_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_level_agreements" ADD CONSTRAINT "itsm_service_level_agreements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_level_agreements" ADD CONSTRAINT "itsm_service_level_agreements_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_operational_level_agreements" ADD CONSTRAINT "itsm_operational_level_agreements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_operational_level_agreements" ADD CONSTRAINT "itsm_operational_level_agreements_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_operational_level_agreements" ADD CONSTRAINT "itsm_operational_level_agreements_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "itsm_service_level_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_service_requests" ADD CONSTRAINT "itsm_service_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_requests" ADD CONSTRAINT "itsm_service_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_service_requests" ADD CONSTRAINT "itsm_service_requests_catalogEntryId_fkey" FOREIGN KEY ("catalogEntryId") REFERENCES "itsm_service_catalog_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_service_requests" ADD CONSTRAINT "itsm_service_requests_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "itsm_service_level_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_problems" ADD CONSTRAINT "itsm_problems_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_problems" ADD CONSTRAINT "itsm_problems_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_configuration_items" ADD CONSTRAINT "itsm_configuration_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_configuration_items" ADD CONSTRAINT "itsm_configuration_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "itsm_service_level_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "itsm_service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "itsm_problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_configurationItemId_fkey" FOREIGN KEY ("configurationItemId") REFERENCES "itsm_configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_known_errors" ADD CONSTRAINT "itsm_known_errors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_known_errors" ADD CONSTRAINT "itsm_known_errors_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "itsm_problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_known_errors" ADD CONSTRAINT "itsm_known_errors_configurationItemId_fkey" FOREIGN KEY ("configurationItemId") REFERENCES "itsm_configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_relatedIncidentId_fkey" FOREIGN KEY ("relatedIncidentId") REFERENCES "itsm_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_relatedProblemId_fkey" FOREIGN KEY ("relatedProblemId") REFERENCES "itsm_problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_releases" ADD CONSTRAINT "itsm_releases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_releases" ADD CONSTRAINT "itsm_releases_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_deployments" ADD CONSTRAINT "itsm_deployments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_deployments" ADD CONSTRAINT "itsm_deployments_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "itsm_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_deployments" ADD CONSTRAINT "itsm_deployments_configurationItemId_fkey" FOREIGN KEY ("configurationItemId") REFERENCES "itsm_configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_cmdb_relationships" ADD CONSTRAINT "itsm_cmdb_relationships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_cmdb_relationships" ADD CONSTRAINT "itsm_cmdb_relationships_sourceCiId_fkey" FOREIGN KEY ("sourceCiId") REFERENCES "itsm_configuration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_cmdb_relationships" ADD CONSTRAINT "itsm_cmdb_relationships_targetCiId_fkey" FOREIGN KEY ("targetCiId") REFERENCES "itsm_configuration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_availability_plans" ADD CONSTRAINT "itsm_availability_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_availability_plans" ADD CONSTRAINT "itsm_availability_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_capacity_plans" ADD CONSTRAINT "itsm_capacity_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_capacity_plans" ADD CONSTRAINT "itsm_capacity_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_continuity_plans" ADD CONSTRAINT "itsm_service_continuity_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_continuity_plans" ADD CONSTRAINT "itsm_service_continuity_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_suppliers" ADD CONSTRAINT "itsm_service_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_suppliers" ADD CONSTRAINT "itsm_service_suppliers_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_service_reports" ADD CONSTRAINT "itsm_service_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_service_reports" ADD CONSTRAINT "itsm_service_reports_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_knowledge_articles" ADD CONSTRAINT "itsm_knowledge_articles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itsm_knowledge_articles" ADD CONSTRAINT "itsm_knowledge_articles_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_knowledge_articles" ADD CONSTRAINT "itsm_knowledge_articles_knownErrorId_fkey" FOREIGN KEY ("knownErrorId") REFERENCES "itsm_known_errors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_knowledge_articles" ADD CONSTRAINT "itsm_knowledge_articles_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "itsm_problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itsm_knowledge_articles" ADD CONSTRAINT "itsm_knowledge_articles_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "itsm_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "itsm_service_level_agreements" ADD CONSTRAINT "itsm_sla_times_positive" CHECK ("responseTimeMinutes" > 0 AND "resolutionTimeMinutes" > 0);
ALTER TABLE "itsm_service_level_agreements" ADD CONSTRAINT "itsm_sla_availability_range" CHECK ("availabilityTargetPct" IS NULL OR ("availabilityTargetPct" >= 0 AND "availabilityTargetPct" <= 100));
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_resolved_attributed" CHECK ("status" NOT IN ('RESOLVED','CONFIRMED','CLOSED') OR "resolvedAt" IS NOT NULL);
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_confirmed_attributed" CHECK ("status" NOT IN ('CONFIRMED','CLOSED') OR ("confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL));
ALTER TABLE "itsm_incidents" ADD CONSTRAINT "itsm_incidents_closed_attributed" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_approved_attributed" CHECK ("status" NOT IN ('APPROVED','SCHEDULED','IMPLEMENTED','REVIEWED','CLOSED') OR "approvedById" IS NOT NULL);
ALTER TABLE "itsm_changes" ADD CONSTRAINT "itsm_changes_closed_attributed" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);
ALTER TABLE "itsm_cmdb_relationships" ADD CONSTRAINT "itsm_cmdb_no_self_link" CHECK ("sourceCiId" <> "targetCiId");
ALTER TABLE "itsm_availability_plans" ADD CONSTRAINT "itsm_availability_target_range" CHECK ("targetPercent" >= 0 AND "targetPercent" <= 100);
ALTER TABLE "itsm_service_reports" ADD CONSTRAINT "itsm_service_reports_period_order" CHECK ("periodEnd" >= "periodStart");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."itsm_services", public."itsm_service_catalog_entries", public."itsm_service_owners", public."itsm_service_level_agreements", public."itsm_operational_level_agreements", public."itsm_service_requests", public."itsm_problems", public."itsm_configuration_items", public."itsm_incidents", public."itsm_known_errors", public."itsm_changes", public."itsm_releases", public."itsm_deployments", public."itsm_cmdb_relationships", public."itsm_availability_plans", public."itsm_capacity_plans", public."itsm_service_continuity_plans", public."itsm_service_suppliers", public."itsm_service_reports", public."itsm_knowledge_articles"
      TO authenticated;
  END IF;
END $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['itsm_services','itsm_service_catalog_entries','itsm_service_owners','itsm_service_level_agreements','itsm_operational_level_agreements','itsm_service_requests','itsm_problems','itsm_configuration_items','itsm_incidents','itsm_known_errors','itsm_changes','itsm_releases','itsm_deployments','itsm_cmdb_relationships','itsm_availability_plans','itsm_capacity_plans','itsm_service_continuity_plans','itsm_service_suppliers','itsm_service_reports','itsm_knowledge_articles']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_select', tbl, 'itsm:read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_insert', tbl, 'itsm:create');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_update', tbl, 'itsm:update', 'itsm:update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||tbl||'_delete', tbl, 'itsm:delete');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*', 'food-safety:*', 'itsm:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export', 'food-safety:read', 'food-safety:export', 'itsm:read', 'itsm:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create', 'food-safety:read', 'food-safety:create', 'itsm:read', 'itsm:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read', 'food-safety:read', 'itsm:read']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
