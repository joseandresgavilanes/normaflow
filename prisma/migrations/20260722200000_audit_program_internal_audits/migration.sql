-- Annual audit programme and internal audit hardening.

ALTER TYPE "FindingType" ADD VALUE IF NOT EXISTS 'CONFORMITY';
CREATE TYPE "AuditParticipantRole" AS ENUM ('AUDITEE', 'PROCESS_OWNER', 'OBSERVER');

ALTER TABLE "audit_programs"
  ADD COLUMN "standards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "criteria" TEXT,
  ADD COLUMN "responsibleId" TEXT;
ALTER TABLE "audits"
  ADD COLUMN "processId" TEXT,
  ADD COLUMN "clauseId" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "reportSummary" TEXT,
  ADD COLUMN "reportConclusion" TEXT,
  ADD COLUMN "reportIssuedAt" TIMESTAMP(3),
  ADD COLUMN "closedById" TEXT;
ALTER TABLE "audit_checklist_items" ADD COLUMN "clauseId" TEXT;
ALTER TABLE "capas" ADD COLUMN "findingId" TEXT;

CREATE TABLE "audit_participants" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AuditParticipantRole" NOT NULL DEFAULT 'AUDITEE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "capas_findingId_key" ON "capas"("findingId");
CREATE INDEX "audits_organizationId_processId_idx" ON "audits"("organizationId", "processId");
CREATE INDEX "audits_organizationId_status_idx" ON "audits"("organizationId", "status");
CREATE INDEX "audits_organizationId_clauseId_idx" ON "audits"("organizationId", "clauseId");
CREATE INDEX "audit_checklist_items_clauseId_idx" ON "audit_checklist_items"("clauseId");
CREATE UNIQUE INDEX "audit_participants_auditId_userId_key" ON "audit_participants"("auditId", "userId");
CREATE INDEX "audit_participants_userId_idx" ON "audit_participants"("userId");
CREATE INDEX "audit_participants_organizationId_auditId_idx" ON "audit_participants"("organizationId", "auditId");

ALTER TABLE "audit_programs" ADD CONSTRAINT "audit_programs_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audits" ADD CONSTRAINT "audits_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audits" ADD CONSTRAINT "audits_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audits" ADD CONSTRAINT "audits_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capas" ADD CONSTRAINT "capas_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "audit_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_participants" ADD CONSTRAINT "audit_participants_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_participants" ADD CONSTRAINT "audit_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_participants" ADD CONSTRAINT "audit_participants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant integrity for cross-linked audit data.
CREATE OR REPLACE FUNCTION nf_validate_audit_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."processId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM processes WHERE id = NEW."processId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit process belongs to another organization';
  END IF;
  IF NEW."programId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_programs WHERE id = NEW."programId" AND "organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit program belongs to another organization';
  END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clauses c JOIN organization_standards os ON os."standardId" = c."standardId" WHERE c.id = NEW."clauseId" AND os."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'Audit clause belongs to another organization';
  END IF;
  IF NEW."auditorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."auditorId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'Audit auditor is not a member of the organization';
  END IF;
  IF NEW."closedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."closedById" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'Audit closer is not a member of the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_audits_tenant_refs ON "audits";
CREATE TRIGGER nf_audits_tenant_refs BEFORE INSERT OR UPDATE ON "audits" FOR EACH ROW EXECUTE FUNCTION nf_validate_audit_tenant();

CREATE OR REPLACE FUNCTION nf_validate_audit_program_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."responsibleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE "userId" = NEW."responsibleId" AND "organizationId" = NEW."organizationId" AND active) THEN
    RAISE EXCEPTION 'Audit programme responsible is not a member of the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_audit_programs_tenant_refs ON "audit_programs";
CREATE TRIGGER nf_audit_programs_tenant_refs BEFORE INSERT OR UPDATE ON "audit_programs" FOR EACH ROW EXECUTE FUNCTION nf_validate_audit_program_tenant();

CREATE OR REPLACE FUNCTION nf_validate_audit_checklist_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE audit_org TEXT;
BEGIN
  SELECT "organizationId" INTO audit_org FROM audits WHERE id = NEW."auditId";
  IF audit_org IS NULL THEN RAISE EXCEPTION 'Audit checklist parent not found'; END IF;
  IF NEW."clauseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clauses c JOIN organization_standards os ON os."standardId" = c."standardId" WHERE c.id = NEW."clauseId" AND os."organizationId" = audit_org) THEN
    RAISE EXCEPTION 'Checklist clause belongs to another organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_audit_checklist_tenant_refs ON "audit_checklist_items";
CREATE TRIGGER nf_audit_checklist_tenant_refs BEFORE INSERT OR UPDATE ON "audit_checklist_items" FOR EACH ROW EXECUTE FUNCTION nf_validate_audit_checklist_tenant();

CREATE OR REPLACE FUNCTION nf_validate_audit_participant_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM audits a JOIN memberships m ON m."organizationId" = a."organizationId" WHERE a.id = NEW."auditId" AND NEW."organizationId" = a."organizationId" AND m."userId" = NEW."userId" AND m.active) THEN
    RAISE EXCEPTION 'Audit participant is not a member of the organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_audit_participants_tenant_refs ON "audit_participants";
CREATE TRIGGER nf_audit_participants_tenant_refs BEFORE INSERT OR UPDATE ON "audit_participants" FOR EACH ROW EXECUTE FUNCTION nf_validate_audit_participant_tenant();

CREATE OR REPLACE FUNCTION nf_validate_capa_finding_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."findingId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_findings f JOIN audits a ON a.id = f."auditId" WHERE f.id = NEW."findingId" AND a."organizationId" = NEW."organizationId") THEN
    RAISE EXCEPTION 'CAPA finding belongs to another organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nf_capas_finding_tenant_refs ON "capas";
CREATE TRIGGER nf_capas_finding_tenant_refs BEFORE INSERT OR UPDATE ON "capas" FOR EACH ROW EXECUTE FUNCTION nf_validate_capa_finding_tenant();

ALTER TABLE "audit_participants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_audit_participants_select" ON "audit_participants" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = "auditId" AND public.nf_has_org_permission(a."organizationId", 'audits:read')));
CREATE POLICY "nf_audit_participants_insert" ON "audit_participants" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM audits a WHERE a.id = "auditId" AND public.nf_has_org_permission(a."organizationId", 'audits:update')));
CREATE POLICY "nf_audit_participants_update" ON "audit_participants" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = "auditId" AND public.nf_has_org_permission(a."organizationId", 'audits:update'))) WITH CHECK (EXISTS (SELECT 1 FROM audits a WHERE a.id = "auditId" AND public.nf_has_org_permission(a."organizationId", 'audits:update')));
CREATE POLICY "nf_audit_participants_delete" ON "audit_participants" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = "auditId" AND public.nf_has_org_permission(a."organizationId", 'audits:update')));
