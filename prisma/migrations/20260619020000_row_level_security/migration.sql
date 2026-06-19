-- NormaFlow RLS: tenant isolation for Supabase/PostgREST clients.
-- Prisma connects with the database owner/service role and is additionally
-- protected by the server authorization layer. Do not FORCE ROW LEVEL SECURITY.

CREATE OR REPLACE FUNCTION public.nf_auth_uid()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )
$$;

CREATE OR REPLACE FUNCTION public.nf_current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u."id"
  FROM public."users" AS u
  WHERE u."authUserId" = public.nf_auth_uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role")
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'personnel:read', 'positions:read', 'catalogs:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;

CREATE OR REPLACE FUNCTION public.nf_is_org_member(org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."memberships" AS m
    WHERE m."organizationId" = org_id
      AND m."userId" = public.nf_current_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.nf_has_org_permission(org_id TEXT, requested_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."memberships" AS m
    WHERE m."organizationId" = org_id
      AND m."userId" = public.nf_current_user_id()
      AND (
        requested_permission = ANY(public.nf_role_permissions(m."role"))
        OR (split_part(requested_permission, ':', 1) || ':*') = ANY(public.nf_role_permissions(m."role"))
        OR EXISTS (
          SELECT 1
          FROM public."group_memberships" AS gm
          JOIN public."groups" AS g ON g."id" = gm."groupId"
          JOIN public."group_permissions" AS gp ON gp."groupId" = g."id"
          WHERE gm."userId" = m."userId"
            AND g."organizationId" = org_id
            AND gp."permission" <> '*'
            AND (
              gp."permission" = requested_permission
              OR gp."permission" = split_part(requested_permission, ':', 1) || ':*'
            )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.nf_shares_org_with_user(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."memberships" AS mine
    JOIN public."memberships" AS theirs
      ON theirs."organizationId" = mine."organizationId"
    WHERE mine."userId" = public.nf_current_user_id()
      AND theirs."userId" = target_user_id
  )
$$;

REVOKE ALL ON FUNCTION public.nf_auth_uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_role_permissions("Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_is_org_member(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_has_org_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nf_shares_org_with_user(TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_auth_uid() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_current_user_id() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_is_org_member(TEXT) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_has_org_permission(TEXT, TEXT) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.nf_shares_org_with_user(TEXT) TO authenticated';
    EXECUTE 'REVOKE UPDATE ON TABLE public.users FROM authenticated';
    EXECUTE 'GRANT UPDATE ("name", "avatarUrl") ON TABLE public.users TO authenticated';
  END IF;
END
$$;

-- Remove policy names from the pre-baseline Supabase SQL. Those policies used
-- snake_case column names and, where they existed, were too permissive.
DROP POLICY IF EXISTS "org_select" ON public."organizations";
DROP POLICY IF EXISTS "membership_select" ON public."memberships";
DROP POLICY IF EXISTS "documents_select" ON public."documents";
DROP POLICY IF EXISTS "documents_insert" ON public."documents";
DROP POLICY IF EXISTS "documents_update" ON public."documents";
DROP POLICY IF EXISTS "risks_select" ON public."risks";
DROP POLICY IF EXISTS "risks_insert" ON public."risks";
DROP POLICY IF EXISTS "risks_update" ON public."risks";
DROP POLICY IF EXISTS "audits_select" ON public."audits";
DROP POLICY IF EXISTS "audits_insert" ON public."audits";
DROP POLICY IF EXISTS "audits_update" ON public."audits";
DROP POLICY IF EXISTS "nc_select" ON public."nonconformities";
DROP POLICY IF EXISTS "nc_insert" ON public."nonconformities";
DROP POLICY IF EXISTS "nc_update" ON public."nonconformities";
DROP POLICY IF EXISTS "actions_select" ON public."actions";
DROP POLICY IF EXISTS "actions_insert" ON public."actions";
DROP POLICY IF EXISTS "actions_update" ON public."actions";
DROP POLICY IF EXISTS "indicators_select" ON public."indicators";
DROP POLICY IF EXISTS "notifications_select" ON public."notifications";
DROP POLICY IF EXISTS "audit_logs_select" ON public."audit_logs";

-- Identity and global reference data
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_users_select" ON public."users";
CREATE POLICY "nf_users_select" ON public."users" FOR SELECT TO authenticated USING ("id" = public.nf_current_user_id() OR public.nf_shares_org_with_user("id"));

DROP POLICY IF EXISTS "nf_users_update" ON public."users";
CREATE POLICY "nf_users_update" ON public."users" FOR UPDATE TO authenticated USING ("id" = public.nf_current_user_id()) WITH CHECK ("id" = public.nf_current_user_id());


ALTER TABLE public."standards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_standards_select" ON public."standards";
CREATE POLICY "nf_standards_select" ON public."standards" FOR SELECT TO authenticated USING (public.nf_auth_uid() IS NOT NULL);


ALTER TABLE public."clauses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_clauses_select" ON public."clauses";
CREATE POLICY "nf_clauses_select" ON public."clauses" FOR SELECT TO authenticated USING (public.nf_auth_uid() IS NOT NULL);



-- Organizations and membership
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_organizations_select" ON public."organizations";
CREATE POLICY "nf_organizations_select" ON public."organizations" FOR SELECT TO authenticated USING (public.nf_is_org_member("id"));

DROP POLICY IF EXISTS "nf_organizations_update" ON public."organizations";
CREATE POLICY "nf_organizations_update" ON public."organizations" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("id", 'org:update')) WITH CHECK (public.nf_has_org_permission("id", 'org:update'));


ALTER TABLE public."memberships" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_memberships_select" ON public."memberships";
CREATE POLICY "nf_memberships_select" ON public."memberships" FOR SELECT TO authenticated USING (public.nf_is_org_member("organizationId"));

DROP POLICY IF EXISTS "nf_memberships_insert" ON public."memberships";
CREATE POLICY "nf_memberships_insert" ON public."memberships" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'members:create'));

DROP POLICY IF EXISTS "nf_memberships_update" ON public."memberships";
CREATE POLICY "nf_memberships_update" ON public."memberships" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'members:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'members:update'));

DROP POLICY IF EXISTS "nf_memberships_delete" ON public."memberships";
CREATE POLICY "nf_memberships_delete" ON public."memberships" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'members:delete'));



-- Direct tenant-scoped tables
ALTER TABLE public."organization_standards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_organization_standards_select" ON public."organization_standards";
CREATE POLICY "nf_organization_standards_select" ON public."organization_standards" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:read'));

DROP POLICY IF EXISTS "nf_organization_standards_insert" ON public."organization_standards";
CREATE POLICY "nf_organization_standards_insert" ON public."organization_standards" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'gap:create'));

DROP POLICY IF EXISTS "nf_organization_standards_update" ON public."organization_standards";
CREATE POLICY "nf_organization_standards_update" ON public."organization_standards" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'gap:update'));

DROP POLICY IF EXISTS "nf_organization_standards_delete" ON public."organization_standards";
CREATE POLICY "nf_organization_standards_delete" ON public."organization_standards" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:delete'));

ALTER TABLE public."assessments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_assessments_select" ON public."assessments";
CREATE POLICY "nf_assessments_select" ON public."assessments" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:read'));

DROP POLICY IF EXISTS "nf_assessments_insert" ON public."assessments";
CREATE POLICY "nf_assessments_insert" ON public."assessments" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'gap:create'));

DROP POLICY IF EXISTS "nf_assessments_update" ON public."assessments";
CREATE POLICY "nf_assessments_update" ON public."assessments" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'gap:update'));

DROP POLICY IF EXISTS "nf_assessments_delete" ON public."assessments";
CREATE POLICY "nf_assessments_delete" ON public."assessments" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'gap:delete'));

ALTER TABLE public."documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_documents_select" ON public."documents";
CREATE POLICY "nf_documents_select" ON public."documents" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'documents:read'));

DROP POLICY IF EXISTS "nf_documents_insert" ON public."documents";
CREATE POLICY "nf_documents_insert" ON public."documents" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'documents:create'));

DROP POLICY IF EXISTS "nf_documents_update" ON public."documents";
CREATE POLICY "nf_documents_update" ON public."documents" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'documents:update') OR public.nf_has_org_permission("organizationId", 'documents:create')) WITH CHECK (public.nf_has_org_permission("organizationId", 'documents:update') OR public.nf_has_org_permission("organizationId", 'documents:create'));

DROP POLICY IF EXISTS "nf_documents_delete" ON public."documents";
CREATE POLICY "nf_documents_delete" ON public."documents" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'documents:delete'));

ALTER TABLE public."processes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_processes_select" ON public."processes";
CREATE POLICY "nf_processes_select" ON public."processes" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'processes:read'));

DROP POLICY IF EXISTS "nf_processes_insert" ON public."processes";
CREATE POLICY "nf_processes_insert" ON public."processes" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'processes:create'));

DROP POLICY IF EXISTS "nf_processes_update" ON public."processes";
CREATE POLICY "nf_processes_update" ON public."processes" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'processes:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'processes:update'));

DROP POLICY IF EXISTS "nf_processes_delete" ON public."processes";
CREATE POLICY "nf_processes_delete" ON public."processes" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'processes:delete'));

ALTER TABLE public."risks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_risks_select" ON public."risks";
CREATE POLICY "nf_risks_select" ON public."risks" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'risks:read'));

DROP POLICY IF EXISTS "nf_risks_insert" ON public."risks";
CREATE POLICY "nf_risks_insert" ON public."risks" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'risks:create'));

DROP POLICY IF EXISTS "nf_risks_update" ON public."risks";
CREATE POLICY "nf_risks_update" ON public."risks" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risks:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'risks:update'));

DROP POLICY IF EXISTS "nf_risks_delete" ON public."risks";
CREATE POLICY "nf_risks_delete" ON public."risks" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'risks:delete'));

ALTER TABLE public."audits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_audits_select" ON public."audits";
CREATE POLICY "nf_audits_select" ON public."audits" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'audits:read'));

DROP POLICY IF EXISTS "nf_audits_insert" ON public."audits";
CREATE POLICY "nf_audits_insert" ON public."audits" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'audits:create'));

DROP POLICY IF EXISTS "nf_audits_update" ON public."audits";
CREATE POLICY "nf_audits_update" ON public."audits" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'audits:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'audits:update'));

DROP POLICY IF EXISTS "nf_audits_delete" ON public."audits";
CREATE POLICY "nf_audits_delete" ON public."audits" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'audits:delete'));

ALTER TABLE public."nonconformities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_nonconformities_select" ON public."nonconformities";
CREATE POLICY "nf_nonconformities_select" ON public."nonconformities" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'nc:read'));

DROP POLICY IF EXISTS "nf_nonconformities_insert" ON public."nonconformities";
CREATE POLICY "nf_nonconformities_insert" ON public."nonconformities" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'nc:create'));

DROP POLICY IF EXISTS "nf_nonconformities_update" ON public."nonconformities";
CREATE POLICY "nf_nonconformities_update" ON public."nonconformities" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'nc:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'nc:update'));

DROP POLICY IF EXISTS "nf_nonconformities_delete" ON public."nonconformities";
CREATE POLICY "nf_nonconformities_delete" ON public."nonconformities" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'nc:delete'));

ALTER TABLE public."actions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_actions_select" ON public."actions";
CREATE POLICY "nf_actions_select" ON public."actions" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'actions:read'));

DROP POLICY IF EXISTS "nf_actions_insert" ON public."actions";
CREATE POLICY "nf_actions_insert" ON public."actions" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'actions:create'));

DROP POLICY IF EXISTS "nf_actions_update" ON public."actions";
CREATE POLICY "nf_actions_update" ON public."actions" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'actions:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'actions:update'));

DROP POLICY IF EXISTS "nf_actions_delete" ON public."actions";
CREATE POLICY "nf_actions_delete" ON public."actions" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'actions:delete'));

ALTER TABLE public."indicators" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_indicators_select" ON public."indicators";
CREATE POLICY "nf_indicators_select" ON public."indicators" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'indicators:read'));

DROP POLICY IF EXISTS "nf_indicators_insert" ON public."indicators";
CREATE POLICY "nf_indicators_insert" ON public."indicators" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'indicators:create'));

DROP POLICY IF EXISTS "nf_indicators_update" ON public."indicators";
CREATE POLICY "nf_indicators_update" ON public."indicators" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'indicators:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'indicators:update'));

DROP POLICY IF EXISTS "nf_indicators_delete" ON public."indicators";
CREATE POLICY "nf_indicators_delete" ON public."indicators" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'indicators:delete'));

ALTER TABLE public."evidence_files" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_evidence_files_select" ON public."evidence_files";
CREATE POLICY "nf_evidence_files_select" ON public."evidence_files" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'evidence:read'));

DROP POLICY IF EXISTS "nf_evidence_files_insert" ON public."evidence_files";
CREATE POLICY "nf_evidence_files_insert" ON public."evidence_files" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'evidence:create'));

DROP POLICY IF EXISTS "nf_evidence_files_update" ON public."evidence_files";
CREATE POLICY "nf_evidence_files_update" ON public."evidence_files" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'evidence:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'evidence:update'));

DROP POLICY IF EXISTS "nf_evidence_files_delete" ON public."evidence_files";
CREATE POLICY "nf_evidence_files_delete" ON public."evidence_files" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'evidence:delete'));

ALTER TABLE public."groups" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_groups_select" ON public."groups";
CREATE POLICY "nf_groups_select" ON public."groups" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'groups:read'));

DROP POLICY IF EXISTS "nf_groups_insert" ON public."groups";
CREATE POLICY "nf_groups_insert" ON public."groups" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'groups:create'));

DROP POLICY IF EXISTS "nf_groups_update" ON public."groups";
CREATE POLICY "nf_groups_update" ON public."groups" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'groups:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'groups:update'));

DROP POLICY IF EXISTS "nf_groups_delete" ON public."groups";
CREATE POLICY "nf_groups_delete" ON public."groups" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'groups:delete'));

ALTER TABLE public."positions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_positions_select" ON public."positions";
CREATE POLICY "nf_positions_select" ON public."positions" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'positions:read'));

DROP POLICY IF EXISTS "nf_positions_insert" ON public."positions";
CREATE POLICY "nf_positions_insert" ON public."positions" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'positions:create'));

DROP POLICY IF EXISTS "nf_positions_update" ON public."positions";
CREATE POLICY "nf_positions_update" ON public."positions" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'positions:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'positions:update'));

DROP POLICY IF EXISTS "nf_positions_delete" ON public."positions";
CREATE POLICY "nf_positions_delete" ON public."positions" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'positions:delete'));

ALTER TABLE public."personnel" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_personnel_select" ON public."personnel";
CREATE POLICY "nf_personnel_select" ON public."personnel" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'personnel:read'));

DROP POLICY IF EXISTS "nf_personnel_insert" ON public."personnel";
CREATE POLICY "nf_personnel_insert" ON public."personnel" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'personnel:create'));

DROP POLICY IF EXISTS "nf_personnel_update" ON public."personnel";
CREATE POLICY "nf_personnel_update" ON public."personnel" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'personnel:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'personnel:update'));

DROP POLICY IF EXISTS "nf_personnel_delete" ON public."personnel";
CREATE POLICY "nf_personnel_delete" ON public."personnel" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'personnel:delete'));

ALTER TABLE public."training_courses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_training_courses_select" ON public."training_courses";
CREATE POLICY "nf_training_courses_select" ON public."training_courses" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:read'));

DROP POLICY IF EXISTS "nf_training_courses_insert" ON public."training_courses";
CREATE POLICY "nf_training_courses_insert" ON public."training_courses" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'training:create'));

DROP POLICY IF EXISTS "nf_training_courses_update" ON public."training_courses";
CREATE POLICY "nf_training_courses_update" ON public."training_courses" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'training:update'));

DROP POLICY IF EXISTS "nf_training_courses_delete" ON public."training_courses";
CREATE POLICY "nf_training_courses_delete" ON public."training_courses" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:delete'));

ALTER TABLE public."training_assignments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_training_assignments_select" ON public."training_assignments";
CREATE POLICY "nf_training_assignments_select" ON public."training_assignments" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:read'));

DROP POLICY IF EXISTS "nf_training_assignments_insert" ON public."training_assignments";
CREATE POLICY "nf_training_assignments_insert" ON public."training_assignments" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'training:create'));

DROP POLICY IF EXISTS "nf_training_assignments_update" ON public."training_assignments";
CREATE POLICY "nf_training_assignments_update" ON public."training_assignments" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'training:update'));

DROP POLICY IF EXISTS "nf_training_assignments_delete" ON public."training_assignments";
CREATE POLICY "nf_training_assignments_delete" ON public."training_assignments" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'training:delete'));

ALTER TABLE public."locations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_locations_select" ON public."locations";
CREATE POLICY "nf_locations_select" ON public."locations" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'locations:read'));

DROP POLICY IF EXISTS "nf_locations_insert" ON public."locations";
CREATE POLICY "nf_locations_insert" ON public."locations" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'locations:create'));

DROP POLICY IF EXISTS "nf_locations_update" ON public."locations";
CREATE POLICY "nf_locations_update" ON public."locations" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'locations:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'locations:update'));

DROP POLICY IF EXISTS "nf_locations_delete" ON public."locations";
CREATE POLICY "nf_locations_delete" ON public."locations" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'locations:delete'));

ALTER TABLE public."retention_times" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_retention_times_select" ON public."retention_times";
CREATE POLICY "nf_retention_times_select" ON public."retention_times" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:read'));

DROP POLICY IF EXISTS "nf_retention_times_insert" ON public."retention_times";
CREATE POLICY "nf_retention_times_insert" ON public."retention_times" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:create'));

DROP POLICY IF EXISTS "nf_retention_times_update" ON public."retention_times";
CREATE POLICY "nf_retention_times_update" ON public."retention_times" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:update'));

DROP POLICY IF EXISTS "nf_retention_times_delete" ON public."retention_times";
CREATE POLICY "nf_retention_times_delete" ON public."retention_times" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:delete'));

ALTER TABLE public."dispositions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_dispositions_select" ON public."dispositions";
CREATE POLICY "nf_dispositions_select" ON public."dispositions" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:read'));

DROP POLICY IF EXISTS "nf_dispositions_insert" ON public."dispositions";
CREATE POLICY "nf_dispositions_insert" ON public."dispositions" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:create'));

DROP POLICY IF EXISTS "nf_dispositions_update" ON public."dispositions";
CREATE POLICY "nf_dispositions_update" ON public."dispositions" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:update'));

DROP POLICY IF EXISTS "nf_dispositions_delete" ON public."dispositions";
CREATE POLICY "nf_dispositions_delete" ON public."dispositions" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:delete'));

ALTER TABLE public."archive_methods" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_archive_methods_select" ON public."archive_methods";
CREATE POLICY "nf_archive_methods_select" ON public."archive_methods" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:read'));

DROP POLICY IF EXISTS "nf_archive_methods_insert" ON public."archive_methods";
CREATE POLICY "nf_archive_methods_insert" ON public."archive_methods" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:create'));

DROP POLICY IF EXISTS "nf_archive_methods_update" ON public."archive_methods";
CREATE POLICY "nf_archive_methods_update" ON public."archive_methods" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:update'));

DROP POLICY IF EXISTS "nf_archive_methods_delete" ON public."archive_methods";
CREATE POLICY "nf_archive_methods_delete" ON public."archive_methods" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:delete'));

ALTER TABLE public."record_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_record_types_select" ON public."record_types";
CREATE POLICY "nf_record_types_select" ON public."record_types" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:read'));

DROP POLICY IF EXISTS "nf_record_types_insert" ON public."record_types";
CREATE POLICY "nf_record_types_insert" ON public."record_types" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:create'));

DROP POLICY IF EXISTS "nf_record_types_update" ON public."record_types";
CREATE POLICY "nf_record_types_update" ON public."record_types" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:update'));

DROP POLICY IF EXISTS "nf_record_types_delete" ON public."record_types";
CREATE POLICY "nf_record_types_delete" ON public."record_types" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'catalogs:delete'));

ALTER TABLE public."records" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_records_select" ON public."records";
CREATE POLICY "nf_records_select" ON public."records" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'records:read'));

DROP POLICY IF EXISTS "nf_records_insert" ON public."records";
CREATE POLICY "nf_records_insert" ON public."records" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'records:create'));

DROP POLICY IF EXISTS "nf_records_update" ON public."records";
CREATE POLICY "nf_records_update" ON public."records" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'records:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'records:update'));

DROP POLICY IF EXISTS "nf_records_delete" ON public."records";
CREATE POLICY "nf_records_delete" ON public."records" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'records:delete'));

ALTER TABLE public."audit_programs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_audit_programs_select" ON public."audit_programs";
CREATE POLICY "nf_audit_programs_select" ON public."audit_programs" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'audit-program:read'));

DROP POLICY IF EXISTS "nf_audit_programs_insert" ON public."audit_programs";
CREATE POLICY "nf_audit_programs_insert" ON public."audit_programs" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'audit-program:create'));

DROP POLICY IF EXISTS "nf_audit_programs_update" ON public."audit_programs";
CREATE POLICY "nf_audit_programs_update" ON public."audit_programs" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'audit-program:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'audit-program:update'));

DROP POLICY IF EXISTS "nf_audit_programs_delete" ON public."audit_programs";
CREATE POLICY "nf_audit_programs_delete" ON public."audit_programs" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'audit-program:delete'));

ALTER TABLE public."management_reviews" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_management_reviews_select" ON public."management_reviews";
CREATE POLICY "nf_management_reviews_select" ON public."management_reviews" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'mgmt-review:read'));

DROP POLICY IF EXISTS "nf_management_reviews_insert" ON public."management_reviews";
CREATE POLICY "nf_management_reviews_insert" ON public."management_reviews" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'mgmt-review:create'));

DROP POLICY IF EXISTS "nf_management_reviews_update" ON public."management_reviews";
CREATE POLICY "nf_management_reviews_update" ON public."management_reviews" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'mgmt-review:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'mgmt-review:update'));

DROP POLICY IF EXISTS "nf_management_reviews_delete" ON public."management_reviews";
CREATE POLICY "nf_management_reviews_delete" ON public."management_reviews" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'mgmt-review:delete'));

ALTER TABLE public."member_invites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_member_invites_select" ON public."member_invites";
CREATE POLICY "nf_member_invites_select" ON public."member_invites" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'members:read'));

DROP POLICY IF EXISTS "nf_member_invites_insert" ON public."member_invites";
CREATE POLICY "nf_member_invites_insert" ON public."member_invites" FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", 'members:create'));

DROP POLICY IF EXISTS "nf_member_invites_update" ON public."member_invites";
CREATE POLICY "nf_member_invites_update" ON public."member_invites" FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", 'members:update')) WITH CHECK (public.nf_has_org_permission("organizationId", 'members:update'));

DROP POLICY IF EXISTS "nf_member_invites_delete" ON public."member_invites";
CREATE POLICY "nf_member_invites_delete" ON public."member_invites" FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", 'members:delete'));


-- User-owned notifications
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_notifications_select" ON public."notifications";
CREATE POLICY "nf_notifications_select" ON public."notifications" FOR SELECT TO authenticated USING ("userId" = public.nf_current_user_id() AND public.nf_has_org_permission("organizationId", 'notifications:read'));

DROP POLICY IF EXISTS "nf_notifications_update" ON public."notifications";
CREATE POLICY "nf_notifications_update" ON public."notifications" FOR UPDATE TO authenticated USING ("userId" = public.nf_current_user_id() AND public.nf_has_org_permission("organizationId", 'notifications:read')) WITH CHECK ("userId" = public.nf_current_user_id() AND public.nf_has_org_permission("organizationId", 'notifications:read'));



-- Billing is readable by billing admins; writes come from the signed Stripe webhook/service role.
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_subscriptions_select" ON public."subscriptions";
CREATE POLICY "nf_subscriptions_select" ON public."subscriptions" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'billing:read'));



-- Audit logs are append-only from the trusted server/service role.
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_audit_logs_select" ON public."audit_logs";
CREATE POLICY "nf_audit_logs_select" ON public."audit_logs" FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", 'activity:read'));



-- Child tables inherit tenant and permission from their parent
ALTER TABLE public."assessment_answers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_assessment_answers_select" ON public."assessment_answers";
CREATE POLICY "nf_assessment_answers_select" ON public."assessment_answers" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."assessments" AS p WHERE p."id" = "assessmentId" AND public.nf_has_org_permission(p."organizationId", 'gap:read')));

DROP POLICY IF EXISTS "nf_assessment_answers_insert" ON public."assessment_answers";
CREATE POLICY "nf_assessment_answers_insert" ON public."assessment_answers" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."assessments" AS p WHERE p."id" = "assessmentId" AND public.nf_has_org_permission(p."organizationId", 'gap:create')));

DROP POLICY IF EXISTS "nf_assessment_answers_update" ON public."assessment_answers";
CREATE POLICY "nf_assessment_answers_update" ON public."assessment_answers" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."assessments" AS p WHERE p."id" = "assessmentId" AND public.nf_has_org_permission(p."organizationId", 'gap:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."assessments" AS p WHERE p."id" = "assessmentId" AND public.nf_has_org_permission(p."organizationId", 'gap:update')));

DROP POLICY IF EXISTS "nf_assessment_answers_delete" ON public."assessment_answers";
CREATE POLICY "nf_assessment_answers_delete" ON public."assessment_answers" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."assessments" AS p WHERE p."id" = "assessmentId" AND public.nf_has_org_permission(p."organizationId", 'gap:delete')));

ALTER TABLE public."document_versions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_document_versions_select" ON public."document_versions";
CREATE POLICY "nf_document_versions_select" ON public."document_versions" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:read')));

DROP POLICY IF EXISTS "nf_document_versions_insert" ON public."document_versions";
CREATE POLICY "nf_document_versions_insert" ON public."document_versions" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:create')));

DROP POLICY IF EXISTS "nf_document_versions_update" ON public."document_versions";
CREATE POLICY "nf_document_versions_update" ON public."document_versions" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:update')) OR EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:create'))) WITH CHECK (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:update')) OR EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:create')));

DROP POLICY IF EXISTS "nf_document_versions_delete" ON public."document_versions";
CREATE POLICY "nf_document_versions_delete" ON public."document_versions" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:delete')));

ALTER TABLE public."approvals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_approvals_select" ON public."approvals";
CREATE POLICY "nf_approvals_select" ON public."approvals" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:read')));

DROP POLICY IF EXISTS "nf_approvals_insert" ON public."approvals";
CREATE POLICY "nf_approvals_insert" ON public."approvals" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:approve')));

DROP POLICY IF EXISTS "nf_approvals_update" ON public."approvals";
CREATE POLICY "nf_approvals_update" ON public."approvals" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:approve'))) WITH CHECK (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:approve')));

DROP POLICY IF EXISTS "nf_approvals_delete" ON public."approvals";
CREATE POLICY "nf_approvals_delete" ON public."approvals" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."documents" AS p WHERE p."id" = "documentId" AND public.nf_has_org_permission(p."organizationId", 'documents:approve')));

ALTER TABLE public."controls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_controls_select" ON public."controls";
CREATE POLICY "nf_controls_select" ON public."controls" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."risks" AS p WHERE p."id" = "riskId" AND public.nf_has_org_permission(p."organizationId", 'risks:read')));

DROP POLICY IF EXISTS "nf_controls_insert" ON public."controls";
CREATE POLICY "nf_controls_insert" ON public."controls" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."risks" AS p WHERE p."id" = "riskId" AND public.nf_has_org_permission(p."organizationId", 'risks:create')));

DROP POLICY IF EXISTS "nf_controls_update" ON public."controls";
CREATE POLICY "nf_controls_update" ON public."controls" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."risks" AS p WHERE p."id" = "riskId" AND public.nf_has_org_permission(p."organizationId", 'risks:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."risks" AS p WHERE p."id" = "riskId" AND public.nf_has_org_permission(p."organizationId", 'risks:update')));

DROP POLICY IF EXISTS "nf_controls_delete" ON public."controls";
CREATE POLICY "nf_controls_delete" ON public."controls" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."risks" AS p WHERE p."id" = "riskId" AND public.nf_has_org_permission(p."organizationId", 'risks:delete')));

ALTER TABLE public."audit_findings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_audit_findings_select" ON public."audit_findings";
CREATE POLICY "nf_audit_findings_select" ON public."audit_findings" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:read')));

DROP POLICY IF EXISTS "nf_audit_findings_insert" ON public."audit_findings";
CREATE POLICY "nf_audit_findings_insert" ON public."audit_findings" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:create')));

DROP POLICY IF EXISTS "nf_audit_findings_update" ON public."audit_findings";
CREATE POLICY "nf_audit_findings_update" ON public."audit_findings" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:update')));

DROP POLICY IF EXISTS "nf_audit_findings_delete" ON public."audit_findings";
CREATE POLICY "nf_audit_findings_delete" ON public."audit_findings" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:delete')));

ALTER TABLE public."audit_checklist_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_audit_checklist_items_select" ON public."audit_checklist_items";
CREATE POLICY "nf_audit_checklist_items_select" ON public."audit_checklist_items" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:read')));

DROP POLICY IF EXISTS "nf_audit_checklist_items_insert" ON public."audit_checklist_items";
CREATE POLICY "nf_audit_checklist_items_insert" ON public."audit_checklist_items" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:create')));

DROP POLICY IF EXISTS "nf_audit_checklist_items_update" ON public."audit_checklist_items";
CREATE POLICY "nf_audit_checklist_items_update" ON public."audit_checklist_items" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:update')));

DROP POLICY IF EXISTS "nf_audit_checklist_items_delete" ON public."audit_checklist_items";
CREATE POLICY "nf_audit_checklist_items_delete" ON public."audit_checklist_items" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."audits" AS p WHERE p."id" = "auditId" AND public.nf_has_org_permission(p."organizationId", 'audits:delete')));

ALTER TABLE public."action_comments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_action_comments_select" ON public."action_comments";
CREATE POLICY "nf_action_comments_select" ON public."action_comments" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."actions" AS p WHERE p."id" = "actionId" AND public.nf_has_org_permission(p."organizationId", 'actions:read')));

DROP POLICY IF EXISTS "nf_action_comments_insert" ON public."action_comments";
CREATE POLICY "nf_action_comments_insert" ON public."action_comments" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."actions" AS p WHERE p."id" = "actionId" AND public.nf_has_org_permission(p."organizationId", 'actions:update')));

DROP POLICY IF EXISTS "nf_action_comments_update" ON public."action_comments";
CREATE POLICY "nf_action_comments_update" ON public."action_comments" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."actions" AS p WHERE p."id" = "actionId" AND public.nf_has_org_permission(p."organizationId", 'actions:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."actions" AS p WHERE p."id" = "actionId" AND public.nf_has_org_permission(p."organizationId", 'actions:update')));

DROP POLICY IF EXISTS "nf_action_comments_delete" ON public."action_comments";
CREATE POLICY "nf_action_comments_delete" ON public."action_comments" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."actions" AS p WHERE p."id" = "actionId" AND public.nf_has_org_permission(p."organizationId", 'actions:delete')));

ALTER TABLE public."indicator_values" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_indicator_values_select" ON public."indicator_values";
CREATE POLICY "nf_indicator_values_select" ON public."indicator_values" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."indicators" AS p WHERE p."id" = "indicatorId" AND public.nf_has_org_permission(p."organizationId", 'indicators:read')));

DROP POLICY IF EXISTS "nf_indicator_values_insert" ON public."indicator_values";
CREATE POLICY "nf_indicator_values_insert" ON public."indicator_values" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."indicators" AS p WHERE p."id" = "indicatorId" AND public.nf_has_org_permission(p."organizationId", 'indicators:create')));

DROP POLICY IF EXISTS "nf_indicator_values_update" ON public."indicator_values";
CREATE POLICY "nf_indicator_values_update" ON public."indicator_values" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."indicators" AS p WHERE p."id" = "indicatorId" AND public.nf_has_org_permission(p."organizationId", 'indicators:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."indicators" AS p WHERE p."id" = "indicatorId" AND public.nf_has_org_permission(p."organizationId", 'indicators:update')));

DROP POLICY IF EXISTS "nf_indicator_values_delete" ON public."indicator_values";
CREATE POLICY "nf_indicator_values_delete" ON public."indicator_values" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."indicators" AS p WHERE p."id" = "indicatorId" AND public.nf_has_org_permission(p."organizationId", 'indicators:delete')));

ALTER TABLE public."group_memberships" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_group_memberships_select" ON public."group_memberships";
CREATE POLICY "nf_group_memberships_select" ON public."group_memberships" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:read')));

DROP POLICY IF EXISTS "nf_group_memberships_insert" ON public."group_memberships";
CREATE POLICY "nf_group_memberships_insert" ON public."group_memberships" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:create')));

DROP POLICY IF EXISTS "nf_group_memberships_update" ON public."group_memberships";
CREATE POLICY "nf_group_memberships_update" ON public."group_memberships" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:update')));

DROP POLICY IF EXISTS "nf_group_memberships_delete" ON public."group_memberships";
CREATE POLICY "nf_group_memberships_delete" ON public."group_memberships" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:delete')));

ALTER TABLE public."group_permissions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_group_permissions_select" ON public."group_permissions";
CREATE POLICY "nf_group_permissions_select" ON public."group_permissions" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:read')));

DROP POLICY IF EXISTS "nf_group_permissions_insert" ON public."group_permissions";
CREATE POLICY "nf_group_permissions_insert" ON public."group_permissions" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:create')));

DROP POLICY IF EXISTS "nf_group_permissions_update" ON public."group_permissions";
CREATE POLICY "nf_group_permissions_update" ON public."group_permissions" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:update')));

DROP POLICY IF EXISTS "nf_group_permissions_delete" ON public."group_permissions";
CREATE POLICY "nf_group_permissions_delete" ON public."group_permissions" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."groups" AS p WHERE p."id" = "groupId" AND public.nf_has_org_permission(p."organizationId", 'groups:delete')));

ALTER TABLE public."record_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_record_entries_select" ON public."record_entries";
CREATE POLICY "nf_record_entries_select" ON public."record_entries" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."records" AS p WHERE p."id" = "recordId" AND public.nf_has_org_permission(p."organizationId", 'records:read')));

DROP POLICY IF EXISTS "nf_record_entries_insert" ON public."record_entries";
CREATE POLICY "nf_record_entries_insert" ON public."record_entries" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."records" AS p WHERE p."id" = "recordId" AND public.nf_has_org_permission(p."organizationId", 'records:create')));

DROP POLICY IF EXISTS "nf_record_entries_update" ON public."record_entries";
CREATE POLICY "nf_record_entries_update" ON public."record_entries" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."records" AS p WHERE p."id" = "recordId" AND public.nf_has_org_permission(p."organizationId", 'records:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."records" AS p WHERE p."id" = "recordId" AND public.nf_has_org_permission(p."organizationId", 'records:update')));

DROP POLICY IF EXISTS "nf_record_entries_delete" ON public."record_entries";
CREATE POLICY "nf_record_entries_delete" ON public."record_entries" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."records" AS p WHERE p."id" = "recordId" AND public.nf_has_org_permission(p."organizationId", 'records:delete')));

ALTER TABLE public."training_course_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_training_course_documents_select" ON public."training_course_documents";
CREATE POLICY "nf_training_course_documents_select" ON public."training_course_documents" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:read')));

DROP POLICY IF EXISTS "nf_training_course_documents_insert" ON public."training_course_documents";
CREATE POLICY "nf_training_course_documents_insert" ON public."training_course_documents" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:create')));

DROP POLICY IF EXISTS "nf_training_course_documents_update" ON public."training_course_documents";
CREATE POLICY "nf_training_course_documents_update" ON public."training_course_documents" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:update')));

DROP POLICY IF EXISTS "nf_training_course_documents_delete" ON public."training_course_documents";
CREATE POLICY "nf_training_course_documents_delete" ON public."training_course_documents" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:delete')));

ALTER TABLE public."training_course_audience" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_training_course_audience_select" ON public."training_course_audience";
CREATE POLICY "nf_training_course_audience_select" ON public."training_course_audience" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:read')));

DROP POLICY IF EXISTS "nf_training_course_audience_insert" ON public."training_course_audience";
CREATE POLICY "nf_training_course_audience_insert" ON public."training_course_audience" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:create')));

DROP POLICY IF EXISTS "nf_training_course_audience_update" ON public."training_course_audience";
CREATE POLICY "nf_training_course_audience_update" ON public."training_course_audience" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:update')));

DROP POLICY IF EXISTS "nf_training_course_audience_delete" ON public."training_course_audience";
CREATE POLICY "nf_training_course_audience_delete" ON public."training_course_audience" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."training_courses" AS p WHERE p."id" = "courseId" AND public.nf_has_org_permission(p."organizationId", 'training:delete')));

ALTER TABLE public."management_review_inputs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_management_review_inputs_select" ON public."management_review_inputs";
CREATE POLICY "nf_management_review_inputs_select" ON public."management_review_inputs" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:read')));

DROP POLICY IF EXISTS "nf_management_review_inputs_insert" ON public."management_review_inputs";
CREATE POLICY "nf_management_review_inputs_insert" ON public."management_review_inputs" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:create')));

DROP POLICY IF EXISTS "nf_management_review_inputs_update" ON public."management_review_inputs";
CREATE POLICY "nf_management_review_inputs_update" ON public."management_review_inputs" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:update')));

DROP POLICY IF EXISTS "nf_management_review_inputs_delete" ON public."management_review_inputs";
CREATE POLICY "nf_management_review_inputs_delete" ON public."management_review_inputs" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:delete')));

ALTER TABLE public."management_review_decisions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_management_review_decisions_select" ON public."management_review_decisions";
CREATE POLICY "nf_management_review_decisions_select" ON public."management_review_decisions" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:read')));

DROP POLICY IF EXISTS "nf_management_review_decisions_insert" ON public."management_review_decisions";
CREATE POLICY "nf_management_review_decisions_insert" ON public."management_review_decisions" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:create')));

DROP POLICY IF EXISTS "nf_management_review_decisions_update" ON public."management_review_decisions";
CREATE POLICY "nf_management_review_decisions_update" ON public."management_review_decisions" FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:update'))) WITH CHECK (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:update')));

DROP POLICY IF EXISTS "nf_management_review_decisions_delete" ON public."management_review_decisions";
CREATE POLICY "nf_management_review_decisions_delete" ON public."management_review_decisions" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public."management_reviews" AS p WHERE p."id" = "reviewId" AND public.nf_has_org_permission(p."organizationId", 'mgmt-review:delete')));
