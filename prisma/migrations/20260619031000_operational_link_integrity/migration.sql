-- Enforce tenant integrity for every cross-module link, including writes that
-- reach Supabase without going through the Next.js server actions.

UPDATE public."documents" AS record
SET "processId" = NULL
WHERE record."processId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."processes" AS process
    WHERE process."id" = record."processId"
      AND process."organizationId" = record."organizationId"
  );

UPDATE public."risks" AS record
SET "processId" = NULL
WHERE record."processId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."processes" AS process
    WHERE process."id" = record."processId"
      AND process."organizationId" = record."organizationId"
  );

UPDATE public."indicators" AS record
SET "processId" = NULL
WHERE record."processId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."processes" AS process
    WHERE process."id" = record."processId"
      AND process."organizationId" = record."organizationId"
  );

CREATE OR REPLACE FUNCTION public.nf_validate_process_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."processId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."processes" AS process
    WHERE process."id" = NEW."processId"
      AND process."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'The linked process must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.nf_validate_process_link() FROM PUBLIC;

DROP TRIGGER IF EXISTS nf_documents_process_link ON public."documents";
CREATE TRIGGER nf_documents_process_link
BEFORE INSERT OR UPDATE OF "processId", "organizationId" ON public."documents"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_process_link();

DROP TRIGGER IF EXISTS nf_risks_process_link ON public."risks";
CREATE TRIGGER nf_risks_process_link
BEFORE INSERT OR UPDATE OF "processId", "organizationId" ON public."risks"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_process_link();

DROP TRIGGER IF EXISTS nf_indicators_process_link ON public."indicators";
CREATE TRIGGER nf_indicators_process_link
BEFORE INSERT OR UPDATE OF "processId", "organizationId" ON public."indicators"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_process_link();

-- Existing rows created by the old session-only UI may contain stale or
-- cross-tenant polymorphic references. Keep the evidence, clear only its link.
UPDATE public."evidence_files" AS evidence
SET "module" = NULL, "moduleId" = NULL
WHERE NOT (
  (evidence."module" IS NULL AND evidence."moduleId" IS NULL)
  OR (evidence."module" = 'process' AND EXISTS (
    SELECT 1 FROM public."processes" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
  OR (evidence."module" = 'risk' AND EXISTS (
    SELECT 1 FROM public."risks" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
  OR (evidence."module" = 'audit' AND EXISTS (
    SELECT 1 FROM public."audits" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
  OR (evidence."module" = 'nc' AND EXISTS (
    SELECT 1 FROM public."nonconformities" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
  OR (evidence."module" = 'indicator' AND EXISTS (
    SELECT 1 FROM public."indicators" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
  OR (evidence."module" = 'document' AND EXISTS (
    SELECT 1 FROM public."documents" AS target
    WHERE target."id" = evidence."moduleId" AND target."organizationId" = evidence."organizationId"
  ))
);

CREATE OR REPLACE FUNCTION public.nf_validate_evidence_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_is_valid BOOLEAN := FALSE;
BEGIN
  IF NEW."module" IS NULL AND NEW."moduleId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."module" IS NULL OR NEW."moduleId" IS NULL THEN
    RAISE EXCEPTION 'Evidence module and moduleId must be provided together'
      USING ERRCODE = '23514';
  END IF;

  CASE NEW."module"
    WHEN 'process' THEN
      SELECT EXISTS (SELECT 1 FROM public."processes" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'risk' THEN
      SELECT EXISTS (SELECT 1 FROM public."risks" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'audit' THEN
      SELECT EXISTS (SELECT 1 FROM public."audits" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'nc' THEN
      SELECT EXISTS (SELECT 1 FROM public."nonconformities" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'indicator' THEN
      SELECT EXISTS (SELECT 1 FROM public."indicators" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    WHEN 'document' THEN
      SELECT EXISTS (SELECT 1 FROM public."documents" WHERE "id" = NEW."moduleId" AND "organizationId" = NEW."organizationId") INTO target_is_valid;
    ELSE
      target_is_valid := FALSE;
  END CASE;

  IF NOT target_is_valid THEN
    RAISE EXCEPTION 'The evidence target must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.nf_validate_evidence_link() FROM PUBLIC;

DROP TRIGGER IF EXISTS nf_evidence_module_link ON public."evidence_files";
CREATE TRIGGER nf_evidence_module_link
BEFORE INSERT OR UPDATE OF "module", "moduleId", "organizationId" ON public."evidence_files"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_evidence_link();
