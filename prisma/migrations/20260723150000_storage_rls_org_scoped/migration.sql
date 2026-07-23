-- Storage isolation is part of the database security contract.
-- This migration intentionally fails closed when the Supabase Storage extension
-- is not available instead of silently deploying without object policies.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'storage.objects is not available; configure Supabase Storage before applying this migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    RAISE EXCEPTION 'The private documents bucket must exist before applying this migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'evidence') THEN
    RAISE EXCEPTION 'The private evidence bucket must exist before applying this migration';
  END IF;
END
$$;

UPDATE storage.buckets SET public = false WHERE id IN ('documents', 'evidence');

-- The application stores every private object below org-{organizationId}/.
-- The organisation is extracted from the first path segment and is then
-- authorized through the same server/RLS permission contract as public tables.
CREATE OR REPLACE FUNCTION public.nf_storage_organization_id(object_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT NULLIF(substring(object_name FROM '^org-([^/]+)/'), '')
$$;

REVOKE ALL ON FUNCTION public.nf_storage_organization_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nf_storage_organization_id(TEXT) TO authenticated;

-- Re-running the migration must replace, never duplicate, policies.
DROP POLICY IF EXISTS "nf_storage_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_evidence_delete" ON storage.objects;
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

-- Restrictive policies make the tenant boundary hold even if a legacy
-- permissive policy exists in the Supabase project. The policies below grant
-- the operation only when the caller is a member of the path tenant; the
-- operation-specific policies further enforce the role permission.
CREATE POLICY "nf_storage_documents_select_boundary"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_documents_insert_boundary"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_documents_update_boundary"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_documents_delete_boundary"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_evidence_select_boundary"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_evidence_insert_boundary"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_evidence_update_boundary"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
)
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

CREATE POLICY "nf_storage_evidence_delete_boundary"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_is_org_member(public.nf_storage_organization_id(name))
);

-- These restrictive permission gates prevent a legacy permissive policy from
-- bypassing the role-level operation checks.
CREATE POLICY "nf_storage_documents_select_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:read')
);

CREATE POLICY "nf_storage_documents_insert_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:create')
);

CREATE POLICY "nf_storage_documents_update_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update')
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update')
);

CREATE POLICY "nf_storage_documents_delete_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:delete')
);

CREATE POLICY "nf_storage_evidence_select_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:read')
);

CREATE POLICY "nf_storage_evidence_insert_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:create')
);

CREATE POLICY "nf_storage_evidence_update_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update')
)
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update')
);

CREATE POLICY "nf_storage_evidence_delete_permission_boundary"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:delete')
);

CREATE POLICY "nf_storage_documents_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:read')
);

CREATE POLICY "nf_storage_documents_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:create')
);

CREATE POLICY "nf_storage_documents_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update')
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:update')
);

CREATE POLICY "nf_storage_documents_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'documents:delete')
);

CREATE POLICY "nf_storage_evidence_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:read')
);

CREATE POLICY "nf_storage_evidence_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:create')
);

CREATE POLICY "nf_storage_evidence_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update')
)
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:update')
);

CREATE POLICY "nf_storage_evidence_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_organization_id(name), 'evidence:delete')
);

COMMENT ON FUNCTION public.nf_storage_organization_id(TEXT) IS
  'Extracts the NormaFlow tenant from private Storage object paths prefixed with org-{organizationId}/.';
