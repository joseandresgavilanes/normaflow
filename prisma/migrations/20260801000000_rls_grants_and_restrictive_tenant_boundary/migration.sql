-- Close two cross-cutting Supabase/PostgREST gaps introduced when later
-- module tables were added after the original relation grants:
--   1. requests must reach RLS (table privileges), including service-role
--      test/operations clients;
--   2. the generic organization boundary must be RESTRICTIVE so it can never
--      grant an operation by itself or override module/role policies.

CREATE OR REPLACE FUNCTION public.normaflow_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )
$$;

REVOKE ALL ON FUNCTION public.normaflow_current_user_id() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.normaflow_current_user_id() TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.normaflow_current_user_id() TO authenticated;
  END IF;
END
$$;

-- An identified reporter must be able to receive the id returned by an INSERT
-- even when their role intentionally lacks the case-handler `speakup:read`
-- permission. The existing restrictive need-to-know policy still requires the
-- caller to be this reporter (or hold a live case-access grant).
DROP POLICY IF EXISTS "nf_speak_up_reports_reporter_select" ON public."speak_up_reports";
CREATE POLICY "nf_speak_up_reports_reporter_select"
ON public."speak_up_reports" FOR SELECT TO authenticated
USING ("reporterUserId" = public.nf_current_user_id());

-- A foreign key proves that a referenced environmental row exists, but not
-- that it belongs to the same tenant. Enforce the three cross-record links at
-- the database boundary so direct PostgREST writes cannot create mixed-tenant
-- impact, evaluation or programme records.
CREATE OR REPLACE FUNCTION public.nf_validate_environment_tenant_refs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'environmental_impacts' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."environmental_aspects"
      WHERE id = NEW."aspectId" AND "organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'environmental aspect belongs to another organization' USING ERRCODE = '23514';
    END IF;
    IF NEW."methodId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public."environmental_significance_methods"
      WHERE id = NEW."methodId" AND "organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'environmental significance method belongs to another organization' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'environmental_compliance_evaluations' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."environmental_compliance_obligations"
      WHERE id = NEW."obligationId" AND "organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'environmental obligation belongs to another organization' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'environmental_programs' AND NEW."objectiveId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."environmental_objectives"
      WHERE id = NEW."objectiveId" AND "organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'environmental objective belongs to another organization' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS nf_environmental_impacts_tenant_refs ON public."environmental_impacts";
CREATE TRIGGER nf_environmental_impacts_tenant_refs
BEFORE INSERT OR UPDATE ON public."environmental_impacts"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_environment_tenant_refs();

DROP TRIGGER IF EXISTS nf_environmental_compliance_evaluations_tenant_refs ON public."environmental_compliance_evaluations";
CREATE TRIGGER nf_environmental_compliance_evaluations_tenant_refs
BEFORE INSERT OR UPDATE ON public."environmental_compliance_evaluations"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_environment_tenant_refs();

DROP TRIGGER IF EXISTS nf_environmental_programs_tenant_refs ON public."environmental_programs";
CREATE TRIGGER nf_environmental_programs_tenant_refs
BEFORE INSERT OR UPDATE ON public."environmental_programs"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_environment_tenant_refs();

-- PostgreSQL ANDs every applicable RESTRICTIVE policy. Separate restrictive
-- policies for the documents and evidence buckets therefore denied both
-- buckets (a row cannot have both bucket ids). Consolidate each command into
-- one boundary while retaining the operation-specific permission.
DROP POLICY IF EXISTS "nf_storage_documents_select_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_insert_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_update_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_delete_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_select_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_insert_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_update_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_delete_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_select_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_insert_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_update_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_delete_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_select_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_insert_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_update_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_delete_permission_boundary" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_tenant_permission_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_tenant_permission_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_tenant_permission_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_tenant_permission_delete" ON storage.objects;

CREATE POLICY "nf_storage_tenant_permission_select"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.nf_is_org_member(public.nf_storage_organization_id(name))
  AND (
    (bucket_id = 'documents' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:read'))
    OR (bucket_id = 'evidence' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:read'))
  )
);

CREATE POLICY "nf_storage_tenant_permission_insert"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.nf_is_org_member(public.nf_storage_organization_id(name))
  AND (
    (bucket_id = 'documents' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:create'))
    OR (bucket_id = 'evidence' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:create'))
  )
);

CREATE POLICY "nf_storage_tenant_permission_update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  public.nf_is_org_member(public.nf_storage_organization_id(name))
  AND (
    (bucket_id = 'documents' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update'))
    OR (bucket_id = 'evidence' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update'))
  )
)
WITH CHECK (
  public.nf_is_org_member(public.nf_storage_organization_id(name))
  AND (
    (bucket_id = 'documents' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update'))
    OR (bucket_id = 'evidence' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update'))
  )
);

CREATE POLICY "nf_storage_tenant_permission_delete"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  public.nf_is_org_member(public.nf_storage_organization_id(name))
  AND (
    (bucket_id = 'documents' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:delete'))
    OR (bucket_id = 'evidence' AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:delete'))
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO service_role;
  END IF;
END
$$;

DO $$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT DISTINCT c.table_schema, c.table_name
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organizationId'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('_prisma_migrations', 'prisma_migrations')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS normaflow_tenant_isolation ON %I.%I',
      table_row.table_schema,
      table_row.table_name
    );
    EXECUTE format(
      'CREATE POLICY normaflow_tenant_isolation ON %I.%I AS RESTRICTIVE
       USING (public.normaflow_is_org_member(%I))
       WITH CHECK (public.normaflow_is_org_member(%I))',
      table_row.table_schema,
      table_row.table_name,
      'organizationId',
      'organizationId'
    );
  END LOOP;
END
$$;
