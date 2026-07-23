-- Opportunities and reversible nonconformity archive.

ALTER TYPE "NCStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TYPE "OpportunityStatus" AS ENUM (
  'IDENTIFIED',
  'UNDER_REVIEW',
  'APPROVED',
  'IN_MATERIALIZATION',
  'MATERIALIZED',
  'REJECTED',
  'CLOSED'
);

CREATE TABLE "opportunities" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "standardCode" TEXT,
  "source" TEXT,
  "category" TEXT NOT NULL,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
  "ownerId" TEXT,
  "reviewerId" TEXT,
  "materializationAnalysis" TEXT,
  "materializationPlan" TEXT,
  "materializationEvidence" TEXT,
  "dueDate" TIMESTAMP(3),
  "materializedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "opportunities_organizationId_status_idx" ON "opportunities"("organizationId", "status");
CREATE INDEX "opportunities_organizationId_reviewerId_status_idx" ON "opportunities"("organizationId", "reviewerId", "status");

ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_opportunities_select" ON "opportunities" FOR SELECT TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'opportunities:read'));
CREATE POLICY "nf_opportunities_insert" ON "opportunities" FOR INSERT TO authenticated
  WITH CHECK (public.nf_has_org_permission("organizationId", 'opportunities:create'));
CREATE POLICY "nf_opportunities_update" ON "opportunities" FOR UPDATE TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'opportunities:update'))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'opportunities:update'));
CREATE POLICY "nf_opportunities_delete" ON "opportunities" FOR DELETE TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'opportunities:delete'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "opportunities" TO authenticated;

-- Keep PostgREST/RLS role checks aligned with the server permission matrix.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role")
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
