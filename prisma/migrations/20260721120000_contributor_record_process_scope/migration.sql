-- Un contribuidor solo puede consultar y cargar entradas en registros cuyo
-- proceso está asignado a su usuario (Process.ownerId).

DROP POLICY IF EXISTS "nf_records_select" ON public."records";
CREATE POLICY "nf_records_select" ON public."records"
  FOR SELECT TO authenticated
  USING (
    public.nf_has_org_permission("organizationId", 'records:*')
    OR (
      public.nf_has_org_permission("organizationId", 'records:read')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public."memberships" AS membership
          WHERE membership."organizationId" = "organizationId"
            AND membership."userId" = public.nf_current_user_id()
            AND membership."role" = 'CONTRIBUTOR'::"Role"
        )
        OR EXISTS (
          SELECT 1 FROM public."processes" AS process
          WHERE process."id" = "processId"
            AND process."ownerId" = public.nf_current_user_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "nf_records_insert" ON public."records";
CREATE POLICY "nf_records_insert" ON public."records"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.nf_has_org_permission("organizationId", 'records:*')
    OR (
      public.nf_has_org_permission("organizationId", 'records:create')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public."memberships" AS membership
          WHERE membership."organizationId" = "organizationId"
            AND membership."userId" = public.nf_current_user_id()
            AND membership."role" = 'CONTRIBUTOR'::"Role"
        )
        OR EXISTS (
          SELECT 1 FROM public."processes" AS process
          WHERE process."id" = "processId"
            AND process."ownerId" = public.nf_current_user_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "nf_records_update" ON public."records";
CREATE POLICY "nf_records_update" ON public."records"
  FOR UPDATE TO authenticated
  USING (
    public.nf_has_org_permission("organizationId", 'records:update')
    OR public.nf_has_org_permission("organizationId", 'records:*')
    OR (
      public.nf_has_org_permission("organizationId", 'records:create')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public."memberships" AS membership
          WHERE membership."organizationId" = "organizationId"
            AND membership."userId" = public.nf_current_user_id()
            AND membership."role" = 'CONTRIBUTOR'::"Role"
        )
        OR EXISTS (
          SELECT 1 FROM public."processes" AS process
          WHERE process."id" = "processId"
            AND process."ownerId" = public.nf_current_user_id()
        )
      )
    )
    OR "reviewerId" = public.nf_current_user_id()
  )
  WITH CHECK (
    public.nf_has_org_permission("organizationId", 'records:update')
    OR public.nf_has_org_permission("organizationId", 'records:*')
    OR (
      public.nf_has_org_permission("organizationId", 'records:create')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public."memberships" AS membership
          WHERE membership."organizationId" = "organizationId"
            AND membership."userId" = public.nf_current_user_id()
            AND membership."role" = 'CONTRIBUTOR'::"Role"
        )
        OR EXISTS (
          SELECT 1 FROM public."processes" AS process
          WHERE process."id" = "processId"
            AND process."ownerId" = public.nf_current_user_id()
        )
      )
    )
    OR "reviewerId" = public.nf_current_user_id()
  );

DROP POLICY IF EXISTS "nf_record_entries_select" ON public."record_entries";
CREATE POLICY "nf_record_entries_select" ON public."record_entries"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."records" AS record
      LEFT JOIN public."processes" AS process ON process."id" = record."processId"
      WHERE record."id" = "recordId"
        AND (
          public.nf_has_org_permission(record."organizationId", 'records:*')
          OR (
            public.nf_has_org_permission(record."organizationId", 'records:read')
            AND (
              NOT EXISTS (
                SELECT 1 FROM public."memberships" AS membership
                WHERE membership."organizationId" = record."organizationId"
                  AND membership."userId" = public.nf_current_user_id()
                  AND membership."role" = 'CONTRIBUTOR'::"Role"
              )
              OR process."ownerId" = public.nf_current_user_id()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "nf_record_entries_insert" ON public."record_entries";
CREATE POLICY "nf_record_entries_insert" ON public."record_entries"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."records" AS record
      LEFT JOIN public."processes" AS process ON process."id" = record."processId"
      WHERE record."id" = "recordId"
        AND (
          public.nf_has_org_permission(record."organizationId", 'records:*')
          OR (
            public.nf_has_org_permission(record."organizationId", 'records:create')
            AND (
              NOT EXISTS (
                SELECT 1 FROM public."memberships" AS membership
                WHERE membership."organizationId" = record."organizationId"
                  AND membership."userId" = public.nf_current_user_id()
                  AND membership."role" = 'CONTRIBUTOR'::"Role"
              )
              OR process."ownerId" = public.nf_current_user_id()
            )
          )
        )
    )
  );
