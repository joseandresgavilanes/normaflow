-- ISO 14001 §6.1.2/A.6.1.2 biodiversity — configurable: site, ecosystem type
-- and monitoring cadence are org-defined fields, not a fixed checklist.

CREATE TYPE "BiodiversityImpactStatus" AS ENUM ('IDENTIFIED', 'MONITORING', 'MITIGATED', 'CLOSED');

CREATE TABLE "environmental_biodiversity_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "site" TEXT NOT NULL,
  "ecosystemType" TEXT,
  "protectedArea" BOOLEAN NOT NULL DEFAULT false,
  "protectedAreaName" TEXT,
  "speciesOrHabitat" TEXT,
  "impactDescription" TEXT,
  "mitigationMeasures" TEXT,
  "monitoringFrequency" TEXT,
  "status" "BiodiversityImpactStatus" NOT NULL DEFAULT 'IDENTIFIED',
  "responsibleId" TEXT,
  "processId" TEXT,
  "evidenceId" TEXT,
  "lastMonitoredAt" TIMESTAMP(3),
  "nextMonitoringAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_biodiversity_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "environmental_biodiversity_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "environmental_biodiversity_records_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL,
  CONSTRAINT "environmental_biodiversity_records_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "environmental_biodiversity_records_organizationId_code_key" ON "environmental_biodiversity_records"("organizationId", "code");
CREATE INDEX "environmental_biodiversity_records_organizationId_status_idx" ON "environmental_biodiversity_records"("organizationId", "status");

-- A protected-area impact must name the protected area (no anonymous claims).
ALTER TABLE "environmental_biodiversity_records" ADD CONSTRAINT "biodiversity_protected_area_named"
  CHECK (NOT "protectedArea" OR "protectedAreaName" IS NOT NULL);

CREATE OR REPLACE FUNCTION public.nf_validate_biodiversity_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."processId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "processes" WHERE "id" = NEW."processId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Biodiversity record tenant mismatch: process % not in org %', NEW."processId", NEW."organizationId";
    END IF;
  END IF;
  IF NEW."evidenceId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "evidence_files" WHERE "id" = NEW."evidenceId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Biodiversity record tenant mismatch: evidence % not in org %', NEW."evidenceId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nf_biodiversity_tenant BEFORE INSERT OR UPDATE ON "environmental_biodiversity_records"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_biodiversity_tenant();

-- ─── GRANTS + RLS ─────────────────────────────────────
-- Same "environment" permission module as every other environmental table.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."environmental_biodiversity_records" TO authenticated;
  END IF;
END
$$;

ALTER TABLE "environmental_biodiversity_records" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_environmental_biodiversity_records_select" ON "environmental_biodiversity_records";
CREATE POLICY "nf_environmental_biodiversity_records_select" ON "environmental_biodiversity_records"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'environment:read'));
DROP POLICY IF EXISTS "nf_environmental_biodiversity_records_insert" ON "environmental_biodiversity_records";
CREATE POLICY "nf_environmental_biodiversity_records_insert" ON "environmental_biodiversity_records"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'environment:create'));
DROP POLICY IF EXISTS "nf_environmental_biodiversity_records_update" ON "environmental_biodiversity_records";
CREATE POLICY "nf_environmental_biodiversity_records_update" ON "environmental_biodiversity_records"
  FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'environment:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'environment:update'));
DROP POLICY IF EXISTS "nf_environmental_biodiversity_records_delete" ON "environmental_biodiversity_records";
CREATE POLICY "nf_environmental_biodiversity_records_delete" ON "environmental_biodiversity_records"
  FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'environment:delete'));
