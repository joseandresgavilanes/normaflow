-- Evidence repository: metadata, lifecycle state and tenant-safe many-to-many links.

CREATE TYPE "EvidenceType" AS ENUM (
  'POLICY', 'PROCEDURE', 'RECORD', 'REPORT', 'CERTIFICATE',
  'LOG', 'PHOTO', 'SCREENSHOT', 'MINUTES', 'OTHER'
);

CREATE TYPE "EvidenceStatus" AS ENUM ('VALID', 'EXPIRED', 'PENDING_REVIEW');

ALTER TABLE "evidence_files"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "evidenceType" "EvidenceType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "processId" TEXT,
  ADD COLUMN "standardCode" TEXT,
  ADD COLUMN "clauseId" TEXT,
  ADD COLUMN "responsibleId" TEXT,
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "evidence_files"
  ADD CONSTRAINT "evidence_files_processId_fkey"
    FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "evidence_files_clauseId_fkey"
    FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "evidence_files_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "evidence_files_responsibleId_fkey"
    FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "evidence_files_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "evidence_files_organizationId_status_idx" ON "evidence_files"("organizationId", "status");
CREATE INDEX "evidence_files_organizationId_expiresAt_idx" ON "evidence_files"("organizationId", "expiresAt");
CREATE INDEX "evidence_files_organizationId_evidenceType_idx" ON "evidence_files"("organizationId", "evidenceType");
CREATE INDEX "evidence_files_organizationId_processId_idx" ON "evidence_files"("organizationId", "processId");
CREATE INDEX "evidence_files_organizationId_clauseId_idx" ON "evidence_files"("organizationId", "clauseId");
CREATE INDEX "evidence_files_organizationId_responsibleId_idx" ON "evidence_files"("organizationId", "responsibleId");

CREATE TABLE "evidence_document_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_document_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_document_links_evidenceId_documentId_key" ON "evidence_document_links"("evidenceId", "documentId");
CREATE INDEX "evidence_document_links_organizationId_documentId_idx" ON "evidence_document_links"("organizationId", "documentId");
ALTER TABLE "evidence_document_links" ADD CONSTRAINT "evidence_document_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_document_links" ADD CONSTRAINT "evidence_document_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_document_links" ADD CONSTRAINT "evidence_document_links_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_risk_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_risk_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_risk_links_evidenceId_riskId_key" ON "evidence_risk_links"("evidenceId", "riskId");
CREATE INDEX "evidence_risk_links_organizationId_riskId_idx" ON "evidence_risk_links"("organizationId", "riskId");
ALTER TABLE "evidence_risk_links" ADD CONSTRAINT "evidence_risk_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_risk_links" ADD CONSTRAINT "evidence_risk_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_risk_links" ADD CONSTRAINT "evidence_risk_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_audit_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_audit_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_audit_links_evidenceId_auditId_key" ON "evidence_audit_links"("evidenceId", "auditId");
CREATE INDEX "evidence_audit_links_organizationId_auditId_idx" ON "evidence_audit_links"("organizationId", "auditId");
ALTER TABLE "evidence_audit_links" ADD CONSTRAINT "evidence_audit_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_audit_links" ADD CONSTRAINT "evidence_audit_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_audit_links" ADD CONSTRAINT "evidence_audit_links_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_finding_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_finding_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_finding_links_evidenceId_findingId_key" ON "evidence_finding_links"("evidenceId", "findingId");
CREATE INDEX "evidence_finding_links_organizationId_findingId_idx" ON "evidence_finding_links"("organizationId", "findingId");
ALTER TABLE "evidence_finding_links" ADD CONSTRAINT "evidence_finding_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_finding_links" ADD CONSTRAINT "evidence_finding_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_finding_links" ADD CONSTRAINT "evidence_finding_links_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_nonconformity_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "nonconformityId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_nonconformity_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_nonconformity_links_evidenceId_nonconformityId_key" ON "evidence_nonconformity_links"("evidenceId", "nonconformityId");
CREATE INDEX "evidence_nonconformity_links_organizationId_nonconformityId_idx" ON "evidence_nonconformity_links"("organizationId", "nonconformityId");
ALTER TABLE "evidence_nonconformity_links" ADD CONSTRAINT "evidence_nonconformity_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_nonconformity_links" ADD CONSTRAINT "evidence_nonconformity_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_nonconformity_links" ADD CONSTRAINT "evidence_nonconformity_links_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_indicator_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_indicator_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_indicator_links_evidenceId_indicatorId_key" ON "evidence_indicator_links"("evidenceId", "indicatorId");
CREATE INDEX "evidence_indicator_links_organizationId_indicatorId_idx" ON "evidence_indicator_links"("organizationId", "indicatorId");
ALTER TABLE "evidence_indicator_links" ADD CONSTRAINT "evidence_indicator_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_indicator_links" ADD CONSTRAINT "evidence_indicator_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_indicator_links" ADD CONSTRAINT "evidence_indicator_links_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evidence_management_review_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "managementReviewId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_management_review_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_management_review_links_evidenceId_managementReviewId_key" ON "evidence_management_review_links"("evidenceId", "managementReviewId");
CREATE INDEX "evidence_management_review_links_organizationId_managementReviewId_idx" ON "evidence_management_review_links"("organizationId", "managementReviewId");
ALTER TABLE "evidence_management_review_links" ADD CONSTRAINT "evidence_management_review_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_management_review_links" ADD CONSTRAINT "evidence_management_review_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_management_review_links" ADD CONSTRAINT "evidence_management_review_links_managementReviewId_fkey" FOREIGN KEY ("managementReviewId") REFERENCES "management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Protect the root and all relationship tables when called through PostgREST.
ALTER TABLE "evidence_document_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_risk_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_audit_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_finding_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_nonconformity_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_indicator_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_management_review_links" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "evidence_document_links", "evidence_risk_links", "evidence_audit_links",
  "evidence_finding_links", "evidence_nonconformity_links", "evidence_indicator_links",
  "evidence_management_review_links" TO authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'evidence_document_links', 'evidence_risk_links', 'evidence_audit_links',
    'evidence_finding_links', 'evidence_nonconformity_links', 'evidence_indicator_links',
    'evidence_management_review_links'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", ''evidence:read''))', 'nf_' || table_name || '_select', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", ''evidence:create''))', 'nf_' || table_name || '_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", ''evidence:update'')) WITH CHECK (public.nf_has_org_permission("organizationId", ''evidence:update''))', 'nf_' || table_name || '_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", ''evidence:delete''))', 'nf_' || table_name || '_delete', table_name);
  END LOOP;
END $$;

-- RLS checks the caller permission; these triggers additionally prevent a
-- direct Supabase write from joining records across organizations.
CREATE OR REPLACE FUNCTION public.nf_validate_evidence_link_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_ok BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."evidence_files" e
    WHERE e."id" = NEW."evidenceId" AND e."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Evidence and relationship organization must match';
  END IF;

  IF TG_TABLE_NAME = 'evidence_document_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."documents" t WHERE t."id" = NEW."documentId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_risk_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."risks" t WHERE t."id" = NEW."riskId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_audit_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."audits" t WHERE t."id" = NEW."auditId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_finding_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."audit_findings" t JOIN public."audits" a ON a."id" = t."auditId" WHERE t."id" = NEW."findingId" AND a."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_nonconformity_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."nonconformities" t WHERE t."id" = NEW."nonconformityId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_indicator_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."indicators" t WHERE t."id" = NEW."indicatorId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  ELSIF TG_TABLE_NAME = 'evidence_management_review_links' THEN
    SELECT EXISTS (SELECT 1 FROM public."management_reviews" t WHERE t."id" = NEW."managementReviewId" AND t."organizationId" = NEW."organizationId") INTO target_ok;
  END IF;

  IF NOT target_ok THEN
    RAISE EXCEPTION 'Evidence relationship target belongs to another organization';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.nf_validate_evidence_link_tenant() FROM PUBLIC;

CREATE TRIGGER nf_evidence_document_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_document_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_risk_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_risk_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_audit_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_audit_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_finding_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_finding_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_nonconformity_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_nonconformity_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_indicator_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_indicator_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
CREATE TRIGGER nf_evidence_management_review_link_tenant
  BEFORE INSERT OR UPDATE ON public."evidence_management_review_links"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link_tenant();
