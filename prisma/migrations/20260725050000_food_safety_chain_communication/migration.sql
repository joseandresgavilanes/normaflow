-- Chain communication for ISO 22000 (§7.4) reuses `communication_records`
-- (the same generic table quality-ops already uses) instead of duplicating
-- a model — but that table's RLS previously required `quality-ops:*`
-- specifically, which an ISO 22000-only organization (quality-ops is NOT
-- in PACK_ISO_22000.requiredModules) never holds. Widen SELECT/INSERT to
-- accept `food-safety:read`/`food-safety:create` as an alternative,
-- without touching UPDATE/DELETE (food-safety only creates these rows).

DROP POLICY IF EXISTS "nf_communication_records_select" ON "communication_records";
CREATE POLICY "nf_communication_records_select" ON "communication_records"
  FOR SELECT TO authenticated
  USING (
    public.nf_has_org_permission("organizationId", 'quality-ops:read')
    OR public.nf_has_org_permission("organizationId", 'food-safety:read')
  );

DROP POLICY IF EXISTS "nf_communication_records_insert" ON "communication_records";
CREATE POLICY "nf_communication_records_insert" ON "communication_records"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.nf_has_org_permission("organizationId", 'quality-ops:create')
    OR public.nf_has_org_permission("organizationId", 'food-safety:create')
  );
