-- Restore fields that existed in the document/record domain but were not
-- consistently persisted by the live application.

ALTER TABLE public."record_entries" ADD COLUMN "fileName" TEXT;

-- Legacy live code stored the browser filename in fileUrl. Preserve that
-- information while keeping real object paths and external URLs untouched.
UPDATE public."record_entries"
SET "fileName" = "fileUrl", "fileUrl" = NULL
WHERE "fileName" IS NULL
  AND "fileUrl" IS NOT NULL
  AND position('/' IN "fileUrl") = 0;

-- Remove stale/cross-tenant references before adding the missing FK and
-- enforcing the same integrity for every future direct Supabase write.
UPDATE public."records" AS record
SET "processId" = NULL
WHERE record."processId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."processes" AS process
    WHERE process."id" = record."processId"
      AND process."organizationId" = record."organizationId"
  );

UPDATE public."records" AS record SET "recordTypeId" = NULL
WHERE record."recordTypeId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."record_types" target WHERE target."id" = record."recordTypeId" AND target."organizationId" = record."organizationId"
);
UPDATE public."records" AS record SET "retentionTimeId" = NULL
WHERE record."retentionTimeId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."retention_times" target WHERE target."id" = record."retentionTimeId" AND target."organizationId" = record."organizationId"
);
UPDATE public."records" AS record SET "dispositionId" = NULL
WHERE record."dispositionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."dispositions" target WHERE target."id" = record."dispositionId" AND target."organizationId" = record."organizationId"
);
UPDATE public."records" AS record SET "archiveMethodId" = NULL
WHERE record."archiveMethodId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."archive_methods" target WHERE target."id" = record."archiveMethodId" AND target."organizationId" = record."organizationId"
);
UPDATE public."records" AS record SET "custodianId" = NULL
WHERE record."custodianId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."personnel" target WHERE target."id" = record."custodianId" AND target."organizationId" = record."organizationId"
);

UPDATE public."documents" AS document SET "locationId" = NULL
WHERE document."locationId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."locations" target WHERE target."id" = document."locationId" AND target."organizationId" = document."organizationId"
);
UPDATE public."documents" AS document SET "responsibleElaborationId" = NULL
WHERE document."responsibleElaborationId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."personnel" target WHERE target."id" = document."responsibleElaborationId" AND target."organizationId" = document."organizationId"
);
UPDATE public."documents" AS document SET "responsibleApprovalId" = NULL
WHERE document."responsibleApprovalId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."personnel" target WHERE target."id" = document."responsibleApprovalId" AND target."organizationId" = document."organizationId"
);
UPDATE public."documents" AS document SET "custodianId" = NULL
WHERE document."custodianId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."personnel" target WHERE target."id" = document."custodianId" AND target."organizationId" = document."organizationId"
);
UPDATE public."documents" AS document SET "ownerId" = NULL
WHERE document."ownerId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."memberships" target WHERE target."userId" = document."ownerId" AND target."organizationId" = document."organizationId"
);
UPDATE public."documents" AS document SET "clauseId" = NULL
WHERE document."clauseId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."clauses" clause
  JOIN public."organization_standards" enabled ON enabled."standardId" = clause."standardId"
  WHERE clause."id" = document."clauseId" AND enabled."organizationId" = document."organizationId"
);

-- When a clause is selected, its enabled standard is the source of truth.
UPDATE public."documents" AS document
SET "standardCode" = standard."code"
FROM public."clauses" clause
JOIN public."standards" standard ON standard."id" = clause."standardId"
WHERE document."clauseId" = clause."id"
  AND document."standardCode" IS DISTINCT FROM standard."code";
UPDATE public."documents" AS document SET "standardCode" = NULL
WHERE document."standardCode" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public."organization_standards" enabled
  JOIN public."standards" standard ON standard."id" = enabled."standardId"
  WHERE enabled."organizationId" = document."organizationId"
    AND standard."code" = document."standardCode"
);

CREATE INDEX "records_processId_idx" ON public."records"("processId");
ALTER TABLE public."records" ADD CONSTRAINT "records_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES public."processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "records_custodianId_idx" ON public."records"("custodianId");
ALTER TABLE public."records" ADD CONSTRAINT "records_custodianId_fkey"
  FOREIGN KEY ("custodianId") REFERENCES public."personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "documents_ownerId_idx" ON public."documents"("ownerId");
CREATE INDEX "documents_responsibleElaborationId_idx" ON public."documents"("responsibleElaborationId");
CREATE INDEX "documents_responsibleApprovalId_idx" ON public."documents"("responsibleApprovalId");
CREATE INDEX "documents_custodianId_idx" ON public."documents"("custodianId");
ALTER TABLE public."documents" ADD CONSTRAINT "documents_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_responsibleElaborationId_fkey"
  FOREIGN KEY ("responsibleElaborationId") REFERENCES public."personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_responsibleApprovalId_fkey"
  FOREIGN KEY ("responsibleApprovalId") REFERENCES public."personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_custodianId_fkey"
  FOREIGN KEY ("custodianId") REFERENCES public."personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS nf_records_process_link ON public."records";
CREATE TRIGGER nf_records_process_link
BEFORE INSERT OR UPDATE OF "processId", "organizationId" ON public."records"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_process_link();

CREATE OR REPLACE FUNCTION public.nf_validate_record_catalog_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."recordTypeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."record_types" target WHERE target."id" = NEW."recordTypeId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Record type must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."retentionTimeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."retention_times" target WHERE target."id" = NEW."retentionTimeId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Retention time must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."dispositionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."dispositions" target WHERE target."id" = NEW."dispositionId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Disposition must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."archiveMethodId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."archive_methods" target WHERE target."id" = NEW."archiveMethodId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Archive method must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."custodianId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."custodianId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Custodian must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_record_catalog_links() FROM PUBLIC;
DROP TRIGGER IF EXISTS nf_records_catalog_links ON public."records";
CREATE TRIGGER nf_records_catalog_links
BEFORE INSERT OR UPDATE OF "organizationId", "recordTypeId", "retentionTimeId", "dispositionId", "archiveMethodId", "custodianId" ON public."records"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_record_catalog_links();

CREATE OR REPLACE FUNCTION public.nf_validate_document_metadata_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."locationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."locations" target WHERE target."id" = NEW."locationId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document location must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."responsibleElaborationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."responsibleElaborationId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document elaboration owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."responsibleApprovalId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."responsibleApprovalId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document approval owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."custodianId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."personnel" target WHERE target."id" = NEW."custodianId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document custodian must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."memberships" target WHERE target."userId" = NEW."ownerId" AND target."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Document owner must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."standardCode" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."organization_standards" enabled
    JOIN public."standards" standard ON standard."id" = enabled."standardId"
    WHERE enabled."organizationId" = NEW."organizationId" AND standard."code" = NEW."standardCode"
  ) THEN
    RAISE EXCEPTION 'Document standard must be enabled for the organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."clauses" clause
    JOIN public."organization_standards" enabled ON enabled."standardId" = clause."standardId"
    WHERE clause."id" = NEW."clauseId" AND enabled."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Document clause must belong to a standard enabled for the organization' USING ERRCODE = '23514';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NEW."standardCode" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."clauses" clause
    JOIN public."standards" standard ON standard."id" = clause."standardId"
    WHERE clause."id" = NEW."clauseId" AND standard."code" = NEW."standardCode"
  ) THEN
    RAISE EXCEPTION 'Document clause and standard must match' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_document_metadata_links() FROM PUBLIC;
DROP TRIGGER IF EXISTS nf_documents_metadata_links ON public."documents";
CREATE TRIGGER nf_documents_metadata_links
BEFORE INSERT OR UPDATE OF "organizationId", "locationId", "responsibleElaborationId", "responsibleApprovalId", "custodianId", "ownerId", "clauseId", "standardCode" ON public."documents"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_document_metadata_links();
