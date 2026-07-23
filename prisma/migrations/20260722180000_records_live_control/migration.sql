-- Live record control: type codes, ISO clause linkage and controlled entries.

CREATE TYPE "RecordEntryStatus" AS ENUM ('DRAFT', 'VALID', 'EXPIRED', 'ARCHIVED');

ALTER TABLE "record_types" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "record_types_organizationId_code_key" ON "record_types"("organizationId", "code");

ALTER TABLE "records"
  ADD COLUMN "clauseId" TEXT;

UPDATE "records" AS record
SET "clauseId" = NULL
WHERE "clauseId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "clauses" clause
    JOIN "organization_standards" enabled ON enabled."standardId" = clause."standardId"
    WHERE clause."id" = record."clauseId"
      AND enabled."organizationId" = record."organizationId"
  );

CREATE INDEX "records_organizationId_clauseId_idx" ON "records"("organizationId", "clauseId");
ALTER TABLE "records" ADD CONSTRAINT "records_clauseId_fkey"
  FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "record_entries"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Entrada',
  ADD COLUMN "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "status" "RecordEntryStatus" NOT NULL DEFAULT 'VALID',
  ADD COLUMN "responsibleId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "record_entries"
SET "title" = COALESCE(NULLIF("reference", ''), 'Entrada'),
    "entryDate" = "enteredAt",
    "responsibleId" = "enteredById";

UPDATE "record_entries" entry
SET "enteredById" = NULL
WHERE "enteredById" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" user_row WHERE user_row."id" = entry."enteredById");
UPDATE "record_entries" entry
SET "responsibleId" = NULL
WHERE "responsibleId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "records" record
    JOIN "memberships" membership ON membership."organizationId" = record."organizationId"
    WHERE record."id" = entry."recordId"
      AND membership."userId" = entry."responsibleId"
      AND membership."active" = TRUE
  );

CREATE INDEX "record_entries_recordId_entryDate_idx" ON "record_entries"("recordId", "entryDate");
CREATE INDEX "record_entries_recordId_status_idx" ON "record_entries"("recordId", "status");
CREATE INDEX "record_entries_responsibleId_idx" ON "record_entries"("responsibleId");
ALTER TABLE "record_entries" ADD CONSTRAINT "record_entries_responsibleId_fkey"
  FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "record_entries" ADD CONSTRAINT "record_entries_enteredById_fkey"
  FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Direct PostgREST writes cannot cross tenant boundaries.
CREATE OR REPLACE FUNCTION public.nf_validate_record_clause_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public."clauses" clause
    JOIN public."organization_standards" enabled ON enabled."standardId" = clause."standardId"
    WHERE clause."id" = NEW."clauseId"
      AND enabled."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Record clause must belong to a standard enabled for the organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.nf_validate_record_clause_link() FROM PUBLIC;
DROP TRIGGER IF EXISTS nf_records_clause_link ON public."records";
CREATE TRIGGER nf_records_clause_link
  BEFORE INSERT OR UPDATE OF "organizationId", "clauseId" ON public."records"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_record_clause_link();

-- Ensure an entry responsible belongs to the same tenant as its record.
CREATE OR REPLACE FUNCTION public.nf_validate_record_entry_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."records" record
    JOIN public."memberships" membership ON membership."organizationId" = record."organizationId"
    WHERE record."id" = NEW."recordId"
      AND membership."userId" = NEW."responsibleId"
      AND membership."active" = TRUE
  ) THEN
    RAISE EXCEPTION 'Record entry responsible must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.nf_validate_record_entry_responsible() FROM PUBLIC;
DROP TRIGGER IF EXISTS nf_record_entries_responsible_link ON public."record_entries";
CREATE TRIGGER nf_record_entries_responsible_link
  BEFORE INSERT OR UPDATE OF "recordId", "responsibleId" ON public."record_entries"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_record_entry_responsible();
