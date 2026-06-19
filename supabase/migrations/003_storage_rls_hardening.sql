-- Tenant-aware Storage RLS. Object paths must start with `org-{organizationId}/`.

CREATE OR REPLACE FUNCTION public.nf_storage_org_id(object_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1) LIKE 'org-%'
      THEN substring(split_part(object_name, '/', 1) FROM 5)
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.nf_storage_org_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nf_storage_org_id(TEXT) TO authenticated;

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_documents_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_documents_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "nf_evidence_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_evidence_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_evidence_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_evidence_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "nf_logos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_logos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_logos_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_logos_storage_delete" ON storage.objects;

CREATE POLICY "nf_documents_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_is_org_member(public.nf_storage_org_id(name))
);

CREATE POLICY "nf_documents_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'documents:create')
);

CREATE POLICY "nf_documents_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'documents:update')
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'documents:update')
);

CREATE POLICY "nf_documents_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'documents:delete')
);

CREATE POLICY "nf_evidence_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'evidence:read')
);

CREATE POLICY "nf_evidence_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'evidence:create')
);

CREATE POLICY "nf_evidence_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'evidence:update')
)
WITH CHECK (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'evidence:update')
);

CREATE POLICY "nf_evidence_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'evidence:delete')
);

CREATE POLICY "nf_logos_storage_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "nf_logos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'org:update')
);

CREATE POLICY "nf_logos_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'org:update')
)
WITH CHECK (
  bucket_id = 'logos'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'org:update')
);

CREATE POLICY "nf_logos_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.nf_has_org_permission(public.nf_storage_org_id(name), 'org:delete')
);
