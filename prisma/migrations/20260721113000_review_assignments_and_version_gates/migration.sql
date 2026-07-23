-- Revisión explícita para registros y control de publicación de versiones documentales.

CREATE TYPE "DocumentVersionStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "RecordReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "document_versions"
  ADD COLUMN "status" "DocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedFromStatus" "DocumentStatus";

-- Las versiones que ya existían representan el histórico publicado antes de este flujo.
UPDATE "document_versions" AS v
SET "status" = 'APPROVED',
    "reviewedFromStatus" = d."status"
FROM "documents" AS d
WHERE d."id" = v."documentId";

ALTER TABLE "approvals"
  ADD COLUMN "versionId" TEXT;

ALTER TABLE "records"
  ADD COLUMN "reviewerId" TEXT,
  ADD COLUMN "reviewStatus" "RecordReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "records_reviewerId_idx" ON "records"("reviewerId");
CREATE INDEX "approvals_versionId_idx" ON "approvals"("versionId");

ALTER TABLE "approvals"
  ADD CONSTRAINT "approvals_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "records"
  ADD CONSTRAINT "records_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El creador puede enviar un registro a revisión y el revisor asignado puede
-- resolver la revisión aunque no tenga permisos administrativos globales.
DROP POLICY IF EXISTS "nf_records_update" ON public."records";
CREATE POLICY "nf_records_update" ON public."records"
  FOR UPDATE TO authenticated
  USING (
    public.nf_has_org_permission("organizationId", 'records:update')
    OR public.nf_has_org_permission("organizationId", 'records:*')
    OR public.nf_has_org_permission("organizationId", 'records:create')
    OR "reviewerId" = public.nf_current_user_id()
  )
  WITH CHECK (
    public.nf_has_org_permission("organizationId", 'records:update')
    OR public.nf_has_org_permission("organizationId", 'records:*')
    OR public.nf_has_org_permission("organizationId", 'records:create')
    OR "reviewerId" = public.nf_current_user_id()
  );

DROP POLICY IF EXISTS "nf_approvals_insert" ON public."approvals";
CREATE POLICY "nf_approvals_insert" ON public."approvals"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."documents" AS p
      WHERE p."id" = "documentId"
        AND (public.nf_has_org_permission(p."organizationId", 'documents:approve')
          OR public.nf_has_org_permission(p."organizationId", 'documents:create'))
    )
  );

DROP POLICY IF EXISTS "nf_approvals_update" ON public."approvals";
CREATE POLICY "nf_approvals_update" ON public."approvals"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."documents" AS p
      WHERE p."id" = "documentId"
        AND (public.nf_has_org_permission(p."organizationId", 'documents:approve')
          OR "approverId" = public.nf_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."documents" AS p
      WHERE p."id" = "documentId"
        AND (public.nf_has_org_permission(p."organizationId", 'documents:approve')
          OR "approverId" = public.nf_current_user_id())
    )
  );
