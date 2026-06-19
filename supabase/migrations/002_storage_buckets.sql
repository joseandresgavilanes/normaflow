-- Storage buckets only. Policies are installed by 003_storage_rls_hardening.sql.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('evidence', 'evidence', false),
  ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
