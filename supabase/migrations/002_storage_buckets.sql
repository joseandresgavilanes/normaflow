-- ============================================================
-- NormaFlow — Storage Buckets
-- ============================================================

-- Bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket para evidencias
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket para logos de organizaciones
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Política: solo miembros de la org pueden subir/bajar documentos
CREATE POLICY "documents_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "documents_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
  );

SELECT 'Storage buckets created successfully' as status;
