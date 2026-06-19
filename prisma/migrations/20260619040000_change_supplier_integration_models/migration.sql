-- Change control, supplier management and integration registry.
-- Every root row is tenant-scoped; child rows inherit tenant access through
-- their parent and cross-module links are validated at database level.

CREATE TYPE "ChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'VERIFIED', 'CLOSED');
CREATE TYPE "ChangeImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SupplierCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SupplierStatus" AS ENUM ('APPROVED', 'CONDITIONAL', 'UNDER_REVIEW', 'SUSPENDED');
CREATE TYPE "SupplierEvaluationOutcome" AS ENUM ('APPROVED', 'CONDITIONAL', 'REJECTED');
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'NOT_CONNECTED', 'NEEDS_ATTENTION', 'PENDING');
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

CREATE TABLE "change_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "changeType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "impact" "ChangeImpact" NOT NULL DEFAULT 'MEDIUM',
  "affectedAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "ChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "requesterId" TEXT,
  "requesterName" TEXT,
  "nonconformityId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "implementedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "change_processes" (
  "changeRequestId" TEXT NOT NULL,
  "processId" TEXT NOT NULL,
  CONSTRAINT "change_processes_pkey" PRIMARY KEY ("changeRequestId", "processId")
);
CREATE TABLE "change_documents" (
  "changeRequestId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "change_documents_pkey" PRIMARY KEY ("changeRequestId", "documentId")
);
CREATE TABLE "change_risks" (
  "changeRequestId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  CONSTRAINT "change_risks_pkey" PRIMARY KEY ("changeRequestId", "riskId")
);
CREATE TABLE "change_training_courses" (
  "changeRequestId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "change_training_courses_pkey" PRIMARY KEY ("changeRequestId", "courseId")
);
CREATE TABLE "change_approvers" (
  "id" TEXT NOT NULL,
  "changeRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "attestationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "change_approvers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "change_tasks" (
  "id" TEXT NOT NULL,
  "changeRequestId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "change_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "criticality" "SupplierCriticality" NOT NULL DEFAULT 'MEDIUM',
  "ownerId" TEXT,
  "status" "SupplierStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "contactName" TEXT,
  "contactEmail" TEXT,
  "notes" TEXT,
  "nextReviewDue" TIMESTAMP(3),
  "lastEvaluationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "supplier_documents" (
  "supplierId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("supplierId", "documentId")
);
CREATE TABLE "supplier_risks" (
  "supplierId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  CONSTRAINT "supplier_risks_pkey" PRIMARY KEY ("supplierId", "riskId")
);
CREATE TABLE "supplier_nonconformities" (
  "supplierId" TEXT NOT NULL,
  "nonconformityId" TEXT NOT NULL,
  CONSTRAINT "supplier_nonconformities_pkey" PRIMARY KEY ("supplierId", "nonconformityId")
);
CREATE TABLE "supplier_evaluations" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "score" INTEGER,
  "outcome" "SupplierEvaluationOutcome" NOT NULL,
  "notes" TEXT,
  "evaluatedById" TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextReviewDue" TIMESTAMP(3),
  CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_evaluations_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100))
);

CREATE TABLE "integrations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "valueProposition" TEXT,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "externalAccount" TEXT,
  "config" JSONB,
  "detailNote" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "configuredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "integration_sync_runs" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
  "evidenceCreated" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB,
  CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_sync_runs_counts_check" CHECK ("recordsProcessed" >= 0 AND "evidenceCreated" >= 0)
);

CREATE UNIQUE INDEX "change_requests_organizationId_code_key" ON "change_requests"("organizationId", "code");
CREATE INDEX "change_requests_organizationId_status_idx" ON "change_requests"("organizationId", "status");
CREATE INDEX "change_requests_nonconformityId_idx" ON "change_requests"("nonconformityId");
CREATE INDEX "change_processes_processId_idx" ON "change_processes"("processId");
CREATE INDEX "change_documents_documentId_idx" ON "change_documents"("documentId");
CREATE INDEX "change_risks_riskId_idx" ON "change_risks"("riskId");
CREATE INDEX "change_training_courses_courseId_idx" ON "change_training_courses"("courseId");
CREATE UNIQUE INDEX "change_approvers_changeRequestId_userId_key" ON "change_approvers"("changeRequestId", "userId");
CREATE INDEX "change_approvers_userId_idx" ON "change_approvers"("userId");
CREATE INDEX "change_tasks_changeRequestId_done_idx" ON "change_tasks"("changeRequestId", "done");
CREATE UNIQUE INDEX "suppliers_organizationId_code_key" ON "suppliers"("organizationId", "code");
CREATE INDEX "suppliers_organizationId_status_idx" ON "suppliers"("organizationId", "status");
CREATE INDEX "suppliers_nextReviewDue_idx" ON "suppliers"("nextReviewDue");
CREATE INDEX "supplier_documents_documentId_idx" ON "supplier_documents"("documentId");
CREATE INDEX "supplier_risks_riskId_idx" ON "supplier_risks"("riskId");
CREATE INDEX "supplier_nonconformities_nonconformityId_idx" ON "supplier_nonconformities"("nonconformityId");
CREATE INDEX "supplier_evaluations_supplierId_evaluatedAt_idx" ON "supplier_evaluations"("supplierId", "evaluatedAt");
CREATE UNIQUE INDEX "integrations_organizationId_key_key" ON "integrations"("organizationId", "key");
CREATE INDEX "integrations_organizationId_status_idx" ON "integrations"("organizationId", "status");
CREATE INDEX "integration_sync_runs_integrationId_startedAt_idx" ON "integration_sync_runs"("integrationId", "startedAt");

ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "change_processes" ADD CONSTRAINT "change_processes_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_processes" ADD CONSTRAINT "change_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_documents" ADD CONSTRAINT "change_documents_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_documents" ADD CONSTRAINT "change_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_risks" ADD CONSTRAINT "change_risks_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_risks" ADD CONSTRAINT "change_risks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_training_courses" ADD CONSTRAINT "change_training_courses_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_training_courses" ADD CONSTRAINT "change_training_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_approvers" ADD CONSTRAINT "change_approvers_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_tasks" ADD CONSTRAINT "change_tasks_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_risks" ADD CONSTRAINT "supplier_risks_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_risks" ADD CONSTRAINT "supplier_risks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_nonconformities" ADD CONSTRAINT "supplier_nonconformities_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_nonconformities" ADD CONSTRAINT "supplier_nonconformities_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reject cross-tenant joins even when a caller writes directly through Supabase.
CREATE OR REPLACE FUNCTION public.nf_validate_governance_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_org TEXT; target_org TEXT;
BEGIN
  IF TG_TABLE_NAME LIKE 'change_%' THEN
    SELECT "organizationId" INTO parent_org FROM public."change_requests" WHERE "id" = NEW."changeRequestId";
  ELSE
    SELECT "organizationId" INTO parent_org FROM public."suppliers" WHERE "id" = NEW."supplierId";
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'change_processes' THEN SELECT "organizationId" INTO target_org FROM public."processes" WHERE "id" = NEW."processId";
    WHEN 'change_documents' THEN SELECT "organizationId" INTO target_org FROM public."documents" WHERE "id" = NEW."documentId";
    WHEN 'change_risks' THEN SELECT "organizationId" INTO target_org FROM public."risks" WHERE "id" = NEW."riskId";
    WHEN 'change_training_courses' THEN SELECT "organizationId" INTO target_org FROM public."training_courses" WHERE "id" = NEW."courseId";
    WHEN 'supplier_documents' THEN SELECT "organizationId" INTO target_org FROM public."documents" WHERE "id" = NEW."documentId";
    WHEN 'supplier_risks' THEN SELECT "organizationId" INTO target_org FROM public."risks" WHERE "id" = NEW."riskId";
    WHEN 'supplier_nonconformities' THEN SELECT "organizationId" INTO target_org FROM public."nonconformities" WHERE "id" = NEW."nonconformityId";
  END CASE;
  IF parent_org IS NULL OR target_org IS NULL OR parent_org <> target_org THEN
    RAISE EXCEPTION 'Linked records must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_governance_link() FROM PUBLIC;

CREATE TRIGGER nf_change_process_tenant BEFORE INSERT OR UPDATE ON public."change_processes" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_change_document_tenant BEFORE INSERT OR UPDATE ON public."change_documents" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_change_risk_tenant BEFORE INSERT OR UPDATE ON public."change_risks" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_change_training_tenant BEFORE INSERT OR UPDATE ON public."change_training_courses" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_supplier_document_tenant BEFORE INSERT OR UPDATE ON public."supplier_documents" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_supplier_risk_tenant BEFORE INSERT OR UPDATE ON public."supplier_risks" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();
CREATE TRIGGER nf_supplier_nc_tenant BEFORE INSERT OR UPDATE ON public."supplier_nonconformities" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_governance_link();

CREATE OR REPLACE FUNCTION public.nf_validate_change_root_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."nonconformityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."nonconformities" n
    WHERE n."id" = NEW."nonconformityId" AND n."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'The linked nonconformity must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_change_root_links() FROM PUBLIC;
CREATE TRIGGER nf_change_root_tenant BEFORE INSERT OR UPDATE OF "organizationId", "nonconformityId" ON public."change_requests" FOR EACH ROW EXECUTE FUNCTION public.nf_validate_change_root_links();

-- Root and inherited child RLS.
CREATE OR REPLACE FUNCTION public.nf_change_permission(target_id TEXT, permission_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."change_requests" c WHERE c."id" = target_id AND public.nf_has_org_permission(c."organizationId", permission_name));
$$;
CREATE OR REPLACE FUNCTION public.nf_supplier_permission(target_id TEXT, permission_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."suppliers" s WHERE s."id" = target_id AND public.nf_has_org_permission(s."organizationId", permission_name));
$$;
CREATE OR REPLACE FUNCTION public.nf_integration_permission(target_id TEXT, permission_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."integrations" i WHERE i."id" = target_id AND public.nf_has_org_permission(i."organizationId", permission_name));
$$;
REVOKE ALL ON FUNCTION public.nf_change_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_supplier_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_integration_permission(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nf_change_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nf_supplier_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nf_integration_permission(TEXT, TEXT) TO authenticated;

ALTER TABLE public."change_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_change_requests_select" ON public."change_requests" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'changes:read'));
CREATE POLICY "nf_change_requests_insert" ON public."change_requests" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'changes:create'));
CREATE POLICY "nf_change_requests_update" ON public."change_requests" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'changes:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'changes:update'));
CREATE POLICY "nf_change_requests_delete" ON public."change_requests" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'changes:delete'));

ALTER TABLE public."suppliers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_suppliers_select" ON public."suppliers" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'suppliers:read'));
CREATE POLICY "nf_suppliers_insert" ON public."suppliers" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'suppliers:create'));
CREATE POLICY "nf_suppliers_update" ON public."suppliers" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'suppliers:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'suppliers:update'));
CREATE POLICY "nf_suppliers_delete" ON public."suppliers" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'suppliers:delete'));

ALTER TABLE public."integrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_integrations_select" ON public."integrations" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'integrations:read'));
CREATE POLICY "nf_integrations_insert" ON public."integrations" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'integrations:manage'));
CREATE POLICY "nf_integrations_update" ON public."integrations" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'integrations:manage')) WITH CHECK (public.nf_has_org_permission("organizationId", 'integrations:manage'));
CREATE POLICY "nf_integrations_delete" ON public."integrations" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'integrations:manage'));

DO $$
DECLARE table_name TEXT; parent_column TEXT; read_permission TEXT; write_permission TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['change_processes','change_documents','change_risks','change_training_courses','change_approvers','change_tasks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.nf_change_permission("changeRequestId", ''changes:read''))', 'nf_' || table_name || '_select', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.nf_change_permission("changeRequestId", ''changes:update'')) WITH CHECK (public.nf_change_permission("changeRequestId", ''changes:update''))', 'nf_' || table_name || '_write', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['supplier_documents','supplier_risks','supplier_nonconformities','supplier_evaluations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.nf_supplier_permission("supplierId", ''suppliers:read''))', 'nf_' || table_name || '_select', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.nf_supplier_permission("supplierId", ''suppliers:update'')) WITH CHECK (public.nf_supplier_permission("supplierId", ''suppliers:update''))', 'nf_' || table_name || '_write', table_name);
  END LOOP;
  ALTER TABLE public."integration_sync_runs" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "nf_integration_sync_runs_select" ON public."integration_sync_runs" FOR SELECT TO authenticated USING (public.nf_integration_permission("integrationId", 'integrations:read'));
  CREATE POLICY "nf_integration_sync_runs_write" ON public."integration_sync_runs" FOR ALL TO authenticated USING (public.nf_integration_permission("integrationId", 'integrations:manage')) WITH CHECK (public.nf_integration_permission("integrationId", 'integrations:manage'));
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."change_requests", public."change_processes", public."change_documents", public."change_risks", public."change_training_courses", public."change_approvers", public."change_tasks",
      public."suppliers", public."supplier_documents", public."supplier_risks", public."supplier_nonconformities", public."supplier_evaluations",
      public."integrations", public."integration_sync_runs" TO authenticated;
  END IF;
END $$;

-- Extend evidence polymorphic integrity to the new modules.
CREATE OR REPLACE FUNCTION public.nf_validate_evidence_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_is_valid BOOLEAN := FALSE;
BEGIN
  IF NEW."module" IS NULL AND NEW."moduleId" IS NULL THEN RETURN NEW; END IF;
  IF NEW."module" IS NULL OR NEW."moduleId" IS NULL THEN
    RAISE EXCEPTION 'Evidence module and moduleId must be provided together' USING ERRCODE = '23514';
  END IF;
  CASE NEW."module"
    WHEN 'process' THEN SELECT EXISTS (SELECT 1 FROM public."processes" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'risk' THEN SELECT EXISTS (SELECT 1 FROM public."risks" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'audit' THEN SELECT EXISTS (SELECT 1 FROM public."audits" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'nc' THEN SELECT EXISTS (SELECT 1 FROM public."nonconformities" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'indicator' THEN SELECT EXISTS (SELECT 1 FROM public."indicators" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'document' THEN SELECT EXISTS (SELECT 1 FROM public."documents" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'change' THEN SELECT EXISTS (SELECT 1 FROM public."change_requests" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'supplier' THEN SELECT EXISTS (SELECT 1 FROM public."suppliers" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'integration' THEN SELECT EXISTS (SELECT 1 FROM public."integrations" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    ELSE target_is_valid := FALSE;
  END CASE;
  IF NOT target_is_valid THEN RAISE EXCEPTION 'The evidence target must belong to the same organization' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_evidence_link() FROM PUBLIC;
