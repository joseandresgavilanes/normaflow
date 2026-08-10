-- ISO 45001 occupational health surveillance is health/medical data about
-- named workers. It was gated on the generic "safety:*" permission (same
-- bucket as hazards, PPE, inspections) — meaning CONTRIBUTOR could read it.
-- Reinforce it exactly like ISO 13485's md-sensitive precedent: a dedicated
-- permission, not granted to CONTRIBUTOR/VIEWER, RLS-enforced per row.

DROP POLICY IF EXISTS "nf_occupational_health_surveillance_select" ON "occupational_health_surveillance";
DROP POLICY IF EXISTS "nf_occupational_health_surveillance_insert" ON "occupational_health_surveillance";
DROP POLICY IF EXISTS "nf_occupational_health_surveillance_update" ON "occupational_health_surveillance";
DROP POLICY IF EXISTS "nf_occupational_health_surveillance_delete" ON "occupational_health_surveillance";

CREATE POLICY "nf_occupational_health_surveillance_select" ON "occupational_health_surveillance"
  FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'safety-sensitive:read'));
CREATE POLICY "nf_occupational_health_surveillance_insert" ON "occupational_health_surveillance"
  FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'safety-sensitive:create'));
CREATE POLICY "nf_occupational_health_surveillance_update" ON "occupational_health_surveillance"
  FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'safety-sensitive:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'safety-sensitive:update'));
CREATE POLICY "nf_occupational_health_surveillance_delete" ON "occupational_health_surveillance"
  FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'safety-sensitive:delete'));

-- ─── WORKFLOW INTEGRITY (defense in depth) ───────────
-- Both incident investigation and permit-to-work transitions were only
-- enforced in the Next.js server action (assertIncidentTransition /
-- PERMIT_TRANSITIONS) — a direct Supabase write could skip straight to
-- CLOSED. Enforce the same invariant at the DB layer, matching how SoA
-- immutability and pack lifecycle transitions are already DB-enforced
-- elsewhere in this codebase.

CREATE OR REPLACE FUNCTION public.nf_enforce_incident_workflow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  flow TEXT[] := ARRAY['REPORTED','CLASSIFIED','INVESTIGATING','ROOT_CAUSE','ACTION_PLAN','IMPLEMENTED','EFFECTIVENESS_VERIFIED','CLOSED'];
  old_idx INT;
  new_idx INT;
BEGIN
  IF OLD."status" IS DISTINCT FROM NEW."status" THEN
    old_idx := array_position(flow, OLD."status"::TEXT);
    new_idx := array_position(flow, NEW."status"::TEXT);
    IF old_idx IS NULL OR new_idx IS NULL OR new_idx <> old_idx + 1 THEN
      RAISE EXCEPTION 'Incident workflow: % -> % is not a one-step forward transition (no jumps, no going back)', OLD."status", NEW."status";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nf_occupational_incidents_workflow ON "occupational_incidents";
CREATE TRIGGER nf_occupational_incidents_workflow BEFORE UPDATE ON "occupational_incidents"
  FOR EACH ROW EXECUTE FUNCTION public.nf_enforce_incident_workflow();

CREATE OR REPLACE FUNCTION public.nf_enforce_permit_workflow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IS DISTINCT FROM NEW."status" THEN
    IF NOT (
      (OLD."status" = 'DRAFT' AND NEW."status" = 'ACTIVE') OR
      (OLD."status" = 'ACTIVE' AND NEW."status" IN ('SUSPENDED', 'CLOSED', 'EXPIRED')) OR
      (OLD."status" = 'SUSPENDED' AND NEW."status" IN ('ACTIVE', 'CLOSED'))
    ) THEN
      RAISE EXCEPTION 'Permit-to-work workflow: % -> % is not an allowed transition', OLD."status", NEW."status";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nf_permit_to_work_workflow ON "permits_to_work";
CREATE TRIGGER nf_permit_to_work_workflow BEFORE UPDATE ON "permits_to_work"
  FOR EACH ROW EXECUTE FUNCTION public.nf_enforce_permit_workflow();

-- ─── ROLE PERMISSIONS (Supabase direct-authorization mirror) ─
-- Keep in sync with src/lib/permissions/matrix.ts. Base copied verbatim from
-- 20260725010000_quality_operations (the latest prior redefinition) plus
-- safety-sensitive:* appended — NOT granted to CONTRIBUTOR or VIEWER.
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*', 'safety-sensitive:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*', 'safety-sensitive:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:read', 'speakup:create', 'speakup:update', 'speakup:approve', 'speakup:export', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*', 'safety-sensitive:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export', 'aims:read', 'aims:export', 'compliance:read', 'compliance:export', 'speakup:create', 'energy:read', 'energy:export', 'food-safety:read', 'food-safety:export', 'itsm:read', 'itsm:export', 'medical-devices:read', 'medical-devices:export', 'md-sensitive:read', 'md-sensitive:export', 'quality-ops:read', 'quality-ops:export', 'design-dev:read', 'design-dev:export', 'safety-sensitive:read', 'safety-sensitive:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read', 'aims:read', 'aims:create', 'compliance:read', 'speakup:create', 'energy:read', 'energy:create', 'food-safety:read', 'food-safety:create', 'itsm:read', 'itsm:create', 'medical-devices:read', 'medical-devices:create', 'quality-ops:read', 'quality-ops:create', 'design-dev:read', 'design-dev:create']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read', 'aims:read', 'compliance:read', 'speakup:create', 'energy:read', 'food-safety:read', 'itsm:read', 'medical-devices:read', 'quality-ops:read', 'design-dev:read']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*', 'aims:*', 'compliance:*', 'speakup:create', 'energy:*', 'food-safety:*', 'itsm:*', 'medical-devices:*', 'md-sensitive:*', 'quality-ops:*', 'design-dev:*', 'safety-sensitive:*']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
