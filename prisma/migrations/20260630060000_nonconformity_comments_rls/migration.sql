-- RLS for nonconformity_comments (created after the RLS baseline).
-- Mirrors action_comments: tenant + permission scoped via the parent nonconformity.
-- Prisma connects as owner and is unaffected; this gates PostgREST/Supabase clients.

ALTER TABLE public."nonconformity_comments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nf_nonconformity_comments_select" ON public."nonconformity_comments";
CREATE POLICY "nf_nonconformity_comments_select" ON public."nonconformity_comments" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public."nonconformities" AS p WHERE p."id" = "nonconformityId" AND public.nf_has_org_permission(p."organizationId", 'nc:read')));

DROP POLICY IF EXISTS "nf_nonconformity_comments_insert" ON public."nonconformity_comments";
CREATE POLICY "nf_nonconformity_comments_insert" ON public."nonconformity_comments" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public."nonconformities" AS p WHERE p."id" = "nonconformityId" AND public.nf_has_org_permission(p."organizationId", 'nc:update')));

DROP POLICY IF EXISTS "nf_nonconformity_comments_update" ON public."nonconformity_comments";
CREATE POLICY "nf_nonconformity_comments_update" ON public."nonconformity_comments" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public."nonconformities" AS p WHERE p."id" = "nonconformityId" AND public.nf_has_org_permission(p."organizationId", 'nc:update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public."nonconformities" AS p WHERE p."id" = "nonconformityId" AND public.nf_has_org_permission(p."organizationId", 'nc:update')));

DROP POLICY IF EXISTS "nf_nonconformity_comments_delete" ON public."nonconformity_comments";
CREATE POLICY "nf_nonconformity_comments_delete" ON public."nonconformity_comments" FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public."nonconformities" AS p WHERE p."id" = "nonconformityId" AND public.nf_has_org_permission(p."organizationId", 'nc:update')));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."nonconformity_comments" TO authenticated;
  END IF;
END
$$;
