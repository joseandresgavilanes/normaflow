-- ACPM/CAPA live workflow: six auditable stages, tenant scoped evidence and controls.

CREATE TYPE "ACPMOrigin" AS ENUM ('AUDIT', 'COMPLAINT', 'PROCESS', 'SUPPLIER', 'INDICATOR', 'RISK', 'OTHER');
CREATE TYPE "ACPMRootCauseMethod" AS ENUM ('FIVE_WHY', 'ISHIKAWA', 'FREE_TEXT');
CREATE TYPE "ACPMEfficacyStatus" AS ENUM ('PENDING', 'EFFECTIVE', 'NOT_EFFECTIVE');
CREATE TYPE "CAPAStage" AS ENUM ('REGISTERED', 'ROOT_CAUSE', 'ACTION_PLAN', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED');
CREATE TYPE "CAPAEvidenceKind" AS ENUM ('NONCONFORMITY', 'IMPLEMENTATION', 'EFFECTIVENESS');

CREATE TABLE "capas" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "origin" "ACPMOrigin" NOT NULL DEFAULT 'OTHER',
  "standardCode" TEXT,
  "clauseId" TEXT,
  "processId" TEXT,
  "nonconformityId" TEXT,
  "severity" "NCSeverity" NOT NULL DEFAULT 'MINOR',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "stage" "CAPAStage" NOT NULL DEFAULT 'REGISTERED',
  "rootCauseMethod" "ACPMRootCauseMethod",
  "fiveWhys" JSONB,
  "ishikawaAnalysis" TEXT,
  "rootCause" TEXT,
  "rootCauseApproved" BOOLEAN NOT NULL DEFAULT false,
  "rootCauseApprovedById" TEXT,
  "rootCauseApprovedAt" TIMESTAMP(3),
  "correctiveAction" TEXT,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "implementationComments" TEXT,
  "efficacyStatus" "ACPMEfficacyStatus" NOT NULL DEFAULT 'PENDING',
  "verifierId" TEXT,
  "verifierComment" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "lessonsLearned" TEXT,
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "capas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capa_evidences" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "capaId" TEXT NOT NULL,
  "kind" "CAPAEvidenceKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "capa_evidences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capa_comments" (
  "id" TEXT NOT NULL,
  "capaId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "capa_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "capas_organizationId_code_key" ON "capas"("organizationId", "code");
CREATE UNIQUE INDEX "capas_nonconformityId_key" ON "capas"("nonconformityId");
CREATE INDEX "capas_organizationId_stage_idx" ON "capas"("organizationId", "stage");
CREATE INDEX "capas_organizationId_dueDate_idx" ON "capas"("organizationId", "dueDate");
CREATE INDEX "capas_organizationId_processId_idx" ON "capas"("organizationId", "processId");
CREATE INDEX "capas_organizationId_clauseId_idx" ON "capas"("organizationId", "clauseId");
CREATE INDEX "capa_evidences_organizationId_capaId_kind_idx" ON "capa_evidences"("organizationId", "capaId", "kind");
CREATE INDEX "capa_comments_capaId_createdAt_idx" ON "capa_comments"("capaId", "createdAt");

ALTER TABLE "capas" ADD CONSTRAINT "capas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_rootCauseApprovedById_fkey" FOREIGN KEY ("rootCauseApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_evidences" ADD CONSTRAINT "capa_evidences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_evidences" ADD CONSTRAINT "capa_evidences_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_evidences" ADD CONSTRAINT "capa_evidences_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "capa_comments" ADD CONSTRAINT "capa_comments_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_comments" ADD CONSTRAINT "capa_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth: references must stay inside the active tenant.
CREATE OR REPLACE FUNCTION nf_validate_capa_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."processId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA process belongs to another organization';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clauses c JOIN organization_standards os ON os."standardId" = c."standardId"
    WHERE c.id = NEW."clauseId" AND os."organizationId" = NEW."organizationId"
  ) THEN RAISE EXCEPTION 'CAPA clause belongs to another organization'; END IF;
  IF NEW."nonconformityId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM nonconformities WHERE id = NEW."nonconformityId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA nonconformity belongs to another organization';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."requestedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA requester is not a member of the organization';
  END IF;
  IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."ownerId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA owner is not a member of the organization';
  END IF;
  IF NEW."rootCauseApprovedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."rootCauseApprovedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA approver is not a member of the organization';
  END IF;
  IF NEW."verifierId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."verifierId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA verifier is not a member of the organization';
  END IF;
  IF NEW."closedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."closedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'CAPA closer is not a member of the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_capas_tenant_refs ON "capas";
CREATE TRIGGER nf_capas_tenant_refs BEFORE INSERT OR UPDATE ON "capas" FOR EACH ROW EXECUTE FUNCTION nf_validate_capa_tenant();
CREATE OR REPLACE FUNCTION nf_validate_capa_evidence_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM capas WHERE id = NEW."capaId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA evidence belongs to another organization';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships m WHERE m."userId" = NEW."uploadedById" AND m."organizationId" = NEW."organizationId" AND m.active) THEN
    RAISE EXCEPTION 'CAPA evidence uploader is not a member of the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_capa_evidences_tenant ON "capa_evidences";
CREATE TRIGGER nf_capa_evidences_tenant BEFORE INSERT OR UPDATE ON "capa_evidences" FOR EACH ROW EXECUTE FUNCTION nf_validate_capa_evidence_tenant();

ALTER TABLE "capas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_capas_select" ON "capas" FOR SELECT TO authenticated USING (nf_has_org_permission("organizationId", 'actions:read'));
CREATE POLICY "nf_capas_insert" ON "capas" FOR INSERT TO authenticated WITH CHECK (nf_has_org_permission("organizationId", 'actions:create'));
CREATE POLICY "nf_capas_update" ON "capas" FOR UPDATE TO authenticated USING (nf_has_org_permission("organizationId", 'actions:update')) WITH CHECK (nf_has_org_permission("organizationId", 'actions:update'));
CREATE POLICY "nf_capas_delete" ON "capas" FOR DELETE TO authenticated USING (nf_has_org_permission("organizationId", 'actions:delete'));
ALTER TABLE "capa_evidences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_capa_evidences_select" ON "capa_evidences" FOR SELECT TO authenticated USING (nf_has_org_permission("organizationId", 'actions:read'));
CREATE POLICY "nf_capa_evidences_insert" ON "capa_evidences" FOR INSERT TO authenticated WITH CHECK (nf_has_org_permission("organizationId", 'actions:update'));
CREATE POLICY "nf_capa_evidences_delete" ON "capa_evidences" FOR DELETE TO authenticated USING (nf_has_org_permission("organizationId", 'actions:update'));
ALTER TABLE "capa_comments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_capa_comments_select" ON "capa_comments" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM capas c WHERE c.id = "capaId" AND nf_has_org_permission(c."organizationId", 'actions:read')));
CREATE POLICY "nf_capa_comments_insert" ON "capa_comments" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM capas c WHERE c.id = "capaId" AND nf_has_org_permission(c."organizationId", 'actions:update')));
