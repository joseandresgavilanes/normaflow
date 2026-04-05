-- ============================================================
-- NormaFlow — Row Level Security Policies
-- Ejecutar en Supabase SQL Editor después de las migraciones Prisma
-- ============================================================

-- Habilitar RLS en todas las tablas de datos de organización
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nonconformities ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Función auxiliar: obtener org IDs del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM memberships
  WHERE user_id = auth.uid()::text
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- Organizations: solo ver las tuyas
-- ============================================================
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = ANY(get_user_org_ids()));

-- ============================================================
-- Memberships: ver las de tu org
-- ============================================================
CREATE POLICY "membership_select" ON memberships
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Documentos: solo ver los de tu org
-- ============================================================
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Riesgos: solo ver los de tu org
-- ============================================================
CREATE POLICY "risks_select" ON risks
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "risks_insert" ON risks
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "risks_update" ON risks
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Auditorías
-- ============================================================
CREATE POLICY "audits_select" ON audits
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "audits_insert" ON audits
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "audits_update" ON audits
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- No conformidades
-- ============================================================
CREATE POLICY "nc_select" ON nonconformities
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "nc_insert" ON nonconformities
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "nc_update" ON nonconformities
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Acciones
-- ============================================================
CREATE POLICY "actions_select" ON actions
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "actions_insert" ON actions
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "actions_update" ON actions
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Indicadores
-- ============================================================
CREATE POLICY "indicators_select" ON indicators
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

-- ============================================================
-- Notificaciones: solo las tuyas
-- ============================================================
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (
    organization_id = ANY(get_user_org_ids())
    AND user_id = auth.uid()::text
  );

-- ============================================================
-- Audit logs: solo los de tu org
-- ============================================================
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

SELECT 'RLS policies created successfully' as status;
