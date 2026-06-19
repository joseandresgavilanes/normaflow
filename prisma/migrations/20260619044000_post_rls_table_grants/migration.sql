-- Tables created after the RLS baseline need explicit relation privileges.
-- RLS remains the row-level authority after this table-level gate.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public."billing_invoices", public."report_exports" TO authenticated;
  END IF;
END
$$;
