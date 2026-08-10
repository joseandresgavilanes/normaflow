-- Quality operations: structured capture for ISO 9001 clauses that
-- previously depended entirely on free-text documents — customer
-- requirements (7.2), customer property (8.5.3), preservation (8.5.4),
-- customer satisfaction (9.1.2) and communication (7.4, shared with ISO
-- 27001's identical Annex SL clause). See docs/standard-packs.md and
-- src/lib/actions/quality-operations.ts.

CREATE TYPE "CustomerRequirementStatus" AS ENUM ('OPEN', 'REVIEWED', 'MET');
CREATE TYPE "CustomerPropertyStatus" AS ENUM ('IN_CUSTODY', 'RETURNED', 'LOST_OR_DAMAGED');
CREATE TYPE "PreservationStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'UNDER_REVIEW');
CREATE TYPE "CustomerFeedbackChannel" AS ENUM ('SURVEY', 'COMPLAINT', 'COMPLIMENT', 'REVIEW', 'INTERVIEW', 'OTHER');
CREATE TYPE "CustomerFeedbackStatus" AS ENUM ('RECEIVED', 'ANALYZED', 'ACTION_TAKEN', 'CLOSED');
CREATE TYPE "CommunicationDirection" AS ENUM ('INTERNAL', 'EXTERNAL');

-- ─── 1. CUSTOMER REQUIREMENTS (7.2) ───────────────────

CREATE TABLE "customer_requirements" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "source" TEXT,
  "processId" TEXT,
  "status" "CustomerRequirementStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_requirements_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "customer_requirements_organizationId_code_key" ON "customer_requirements"("organizationId", "code");
CREATE INDEX "customer_requirements_organizationId_status_idx" ON "customer_requirements"("organizationId", "status");

-- ─── 2. CUSTOMER PROPERTY (8.5.3) ─────────────────────

CREATE TABLE "customer_properties" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "conditionOnReceipt" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" TIMESTAMP(3),
  "status" "CustomerPropertyStatus" NOT NULL DEFAULT 'IN_CUSTODY',
  "incidentNote" TEXT,
  "responsibleId" TEXT,
  "processId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_properties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_properties_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "customer_properties_organizationId_code_key" ON "customer_properties"("organizationId", "code");
CREATE INDEX "customer_properties_organizationId_status_idx" ON "customer_properties"("organizationId", "status");

-- Losing/damaging customer property must be explained (ISO 9001 §8.5.3).
ALTER TABLE "customer_properties" ADD CONSTRAINT "customer_properties_incident_requires_note"
  CHECK ("status" <> 'LOST_OR_DAMAGED' OR "incidentNote" IS NOT NULL);

-- ─── 3. PRESERVATION (8.5.4) ──────────────────────────

CREATE TABLE "preservation_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "itemDescription" TEXT NOT NULL,
  "handlingInstructions" TEXT,
  "storageConditions" TEXT,
  "packagingNote" TEXT,
  "status" "PreservationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "responsibleId" TEXT,
  "processId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "preservation_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "preservation_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "preservation_records_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "preservation_records_organizationId_code_key" ON "preservation_records"("organizationId", "code");
CREATE INDEX "preservation_records_organizationId_status_idx" ON "preservation_records"("organizationId", "status");

-- ─── 4. CUSTOMER SATISFACTION (9.1.2) ─────────────────

CREATE TABLE "customer_feedback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "customerName" TEXT,
  "channel" "CustomerFeedbackChannel" NOT NULL DEFAULT 'SURVEY',
  "score" INTEGER,
  "comment" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CustomerFeedbackStatus" NOT NULL DEFAULT 'RECEIVED',
  "linkedCapaId" TEXT,
  "responsibleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_feedback_linkedCapaId_fkey" FOREIGN KEY ("linkedCapaId") REFERENCES "capas"("id") ON DELETE SET NULL,
  CONSTRAINT "customer_feedback_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100))
);
CREATE UNIQUE INDEX "customer_feedback_organizationId_code_key" ON "customer_feedback"("organizationId", "code");
CREATE INDEX "customer_feedback_organizationId_status_idx" ON "customer_feedback"("organizationId", "status");
CREATE INDEX "customer_feedback_organizationId_receivedAt_idx" ON "customer_feedback"("organizationId", "receivedAt");

-- ─── 5. COMMUNICATION (7.4 — shared with ISO 27001) ───

CREATE TABLE "communication_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "content" TEXT,
  "direction" "CommunicationDirection" NOT NULL DEFAULT 'INTERNAL',
  "audience" TEXT,
  "channel" TEXT,
  "standards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "communicatedById" TEXT,
  "communicatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communication_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "communication_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "communication_records_communicatedById_fkey" FOREIGN KEY ("communicatedById") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "communication_records_organizationId_code_key" ON "communication_records"("organizationId", "code");
CREATE INDEX "communication_records_organizationId_direction_idx" ON "communication_records"("organizationId", "direction");

-- ─── 6. TENANT-INTEGRITY TRIGGERS (child refs same org) ─

CREATE OR REPLACE FUNCTION public.nf_validate_quality_ops_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF TG_TABLE_NAME IN ('customer_requirements', 'customer_properties', 'preservation_records') AND NEW."processId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "processes" WHERE "id" = NEW."processId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Quality operations tenant mismatch: process % not in org %', NEW."processId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nf_customer_requirements_tenant BEFORE INSERT OR UPDATE ON "customer_requirements"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_quality_ops_tenant();
CREATE TRIGGER nf_customer_properties_tenant BEFORE INSERT OR UPDATE ON "customer_properties"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_quality_ops_tenant();
CREATE TRIGGER nf_preservation_records_tenant BEFORE INSERT OR UPDATE ON "preservation_records"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_quality_ops_tenant();

CREATE OR REPLACE FUNCTION public.nf_validate_customer_feedback_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."linkedCapaId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "capas" WHERE "id" = NEW."linkedCapaId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Customer feedback tenant mismatch: CAPA % not in org %', NEW."linkedCapaId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nf_customer_feedback_tenant BEFORE INSERT OR UPDATE ON "customer_feedback"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_customer_feedback_tenant();

-- ─── 7. RLS ────────────────────────────────────────────
-- Gated by the "quality-ops" permission module (src/lib/permissions/matrix.ts).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      "customer_requirements", "customer_properties", "preservation_records",
      "customer_feedback", "communication_records"
      TO authenticated;
  END IF;
END
$$;

ALTER TABLE "customer_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preservation_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_records" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_requirements', 'customer_properties', 'preservation_records', 'customer_feedback', 'communication_records']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_select" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_select" ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", ''quality-ops:read''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_insert" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", ''quality-ops:create''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_update" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_update" ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", ''quality-ops:update'')) WITH CHECK (public.nf_has_org_permission("organizationId", ''quality-ops:update''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_delete" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_delete" ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", ''quality-ops:delete''))', t, t);
  END LOOP;
END
$$;

-- ─── 8. ROLE PERMISSIONS (Supabase direct-authorization mirror) ─
-- Keep in sync with src/lib/permissions/matrix.ts. Base copied verbatim from
-- 20260724230000_medical_device_qms (the latest prior redefinition) plus
-- quality-ops:*/design-dev:* appended per role.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export', 'food-safety:read', 'food-safety:export', 'itsm:read', 'itsm:export', 'medical-devices:read', 'medical-devices:export', 'md-sensitive:read', 'md-sensitive:export', 'quality-ops:read', 'quality-ops:export', 'design-dev:read', 'design-dev:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create', 'food-safety:read', 'food-safety:create', 'itsm:read', 'itsm:create', 'medical-devices:read', 'medical-devices:create', 'quality-ops:read', 'quality-ops:create', 'design-dev:read', 'design-dev:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read', 'food-safety:read', 'itsm:read', 'medical-devices:read', 'quality-ops:read', 'design-dev:read']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
