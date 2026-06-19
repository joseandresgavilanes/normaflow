-- PostgREST changes into the `authenticated` database role. Table grants are
-- insufficient without USAGE on the containing schema, so requests otherwise
-- fail before RLS can evaluate tenant and permission policies.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
  END IF;
END
$$;
