-- Generic, configurable design & development for ISO 9001 §8.3 — any
-- organization, not only ISO 13485 (which keeps its own hard-scoped DHF
-- models: DesignHistoryFile/DesignInput/… tied to MedicalDevice). A project's
-- stages are free-form rows (DesignStage), not fixed schema columns.

CREATE TYPE "DesignProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DesignStageType" AS ENUM ('PLANNING', 'INPUT', 'OUTPUT', 'REVIEW', 'VERIFICATION', 'VALIDATION', 'CHANGE_CONTROL', 'TRANSFER');
CREATE TYPE "DesignStageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "design_projects" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "DesignProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "ownerId" TEXT,
  "processId" TEXT,
  "plannedStart" TIMESTAMP(3),
  "plannedEnd" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "design_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "design_projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "design_projects_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "design_projects_organizationId_code_key" ON "design_projects"("organizationId", "code");
CREATE INDEX "design_projects_organizationId_status_idx" ON "design_projects"("organizationId", "status");

-- A project cannot be marked COMPLETED while any of its stages are still
-- open (checked by an app-level assertion at transition time) — enforced
-- here for the terminal invariant: completedAt is only ever set alongside
-- status = COMPLETED.
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_completed_has_date"
  CHECK ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL);

CREATE TABLE "design_stages" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "stageType" "DesignStageType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "result" TEXT,
  "status" "DesignStageStatus" NOT NULL DEFAULT 'PENDING',
  "responsibleId" TEXT,
  "evidenceId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "design_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "design_stages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "design_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "design_projects"("id") ON DELETE CASCADE,
  CONSTRAINT "design_stages_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "design_stages_organizationId_code_key" ON "design_stages"("organizationId", "code");
CREATE INDEX "design_stages_organizationId_projectId_idx" ON "design_stages"("organizationId", "projectId");
CREATE INDEX "design_stages_organizationId_status_idx" ON "design_stages"("organizationId", "status");

-- A review/verification/validation stage marked COMPLETED must record its
-- result — no silent "done" without evidence of the outcome (ISO 9001 §8.3.4/8.3.5).
ALTER TABLE "design_stages" ADD CONSTRAINT "design_stages_completed_requires_result"
  CHECK ("status" <> 'COMPLETED' OR "result" IS NOT NULL);

-- ─── TENANT INTEGRITY ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.nf_validate_design_project_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
BEGIN
  IF NEW."processId" IS NOT NULL THEN
    SELECT "organizationId" INTO parent_org FROM "processes" WHERE "id" = NEW."processId";
    IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Design project tenant mismatch: process % not in org %', NEW."processId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nf_design_projects_tenant BEFORE INSERT OR UPDATE ON "design_projects"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_design_project_tenant();

CREATE OR REPLACE FUNCTION public.nf_validate_design_stage_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_org TEXT;
DECLARE evidence_org TEXT;
BEGIN
  SELECT "organizationId" INTO parent_org FROM "design_projects" WHERE "id" = NEW."projectId";
  IF parent_org IS NULL OR parent_org <> NEW."organizationId" THEN
    RAISE EXCEPTION 'Design stage tenant mismatch: project % not in org %', NEW."projectId", NEW."organizationId";
  END IF;
  IF NEW."evidenceId" IS NOT NULL THEN
    SELECT "organizationId" INTO evidence_org FROM "evidence_files" WHERE "id" = NEW."evidenceId";
    IF evidence_org IS NULL OR evidence_org <> NEW."organizationId" THEN
      RAISE EXCEPTION 'Design stage tenant mismatch: evidence % not in org %', NEW."evidenceId", NEW."organizationId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nf_design_stages_tenant BEFORE INSERT OR UPDATE ON "design_stages"
  FOR EACH ROW EXECUTE FUNCTION public.nf_validate_design_stage_tenant();

-- ─── RLS ───────────────────────────────────────────────
-- Gated by the "design-dev" permission module (src/lib/permissions/matrix.ts).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "design_projects", "design_stages" TO authenticated;
  END IF;
END
$$;

ALTER TABLE "design_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "design_stages" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['design_projects', 'design_stages']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_select" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_select" ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", ''design-dev:read''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_insert" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", ''design-dev:create''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_update" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_update" ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", ''design-dev:update'')) WITH CHECK (public.nf_has_org_permission("organizationId", ''design-dev:update''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "nf_%s_delete" ON %I', t, t);
    EXECUTE format('CREATE POLICY "nf_%s_delete" ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", ''design-dev:delete''))', t, t);
  END LOOP;
END
$$;
