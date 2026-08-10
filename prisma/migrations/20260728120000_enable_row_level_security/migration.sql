-- Defense-in-depth RLS for Supabase/PostgreSQL.
--
-- The application currently accesses PostgreSQL through Prisma using the
-- database owner role. That role bypasses RLS, while requests made through
-- Supabase/PostgREST as anon/authenticated are subject to these policies.
-- FORCE ROW LEVEL SECURITY is intentionally not enabled: doing so would
-- require setting the JWT context on every Prisma request first.

CREATE OR REPLACE FUNCTION public.normaflow_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
$$;

CREATE OR REPLACE FUNCTION public.normaflow_is_org_member(p_org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.users AS u ON u.id = m."userId"
    WHERE m."organizationId" = p_org_id
      AND m.active = true
      AND (
        u."authUserId" = public.normaflow_current_user_id()
        OR u.id = public.normaflow_current_user_id()
      )
  );
$$;

COMMENT ON FUNCTION public.normaflow_is_org_member(text) IS
  'Returns whether the Supabase JWT subject belongs to the requested active Normaflow organization.';

REVOKE ALL ON FUNCTION public.normaflow_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normaflow_is_org_member(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.normaflow_current_user_id() TO anon;
    GRANT EXECUTE ON FUNCTION public.normaflow_is_org_member(text) TO anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.normaflow_current_user_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.normaflow_is_org_member(text) TO authenticated;
  END IF;
END
$$;

-- Protect every application table from direct API access by default. Tables
-- without a policy intentionally deny anon/authenticated access.
DO $$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'prisma_migrations')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      table_row.table_schema,
      table_row.table_name
    );
  END LOOP;
END
$$;

-- Every tenant-owned table gets the same organization membership boundary.
-- Dynamic discovery keeps this migration aligned with the current Prisma
-- schema, including the ISO modules added over time.
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
      'CREATE POLICY normaflow_tenant_isolation ON %I.%I
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
