-- Sistema Integrado de Gestión (SIG) — ISO 9001 + ISO 14001 + ISO 45001.
--
-- Objetivo: evitar la duplicación de documentos, auditorías, riesgos, objetivos,
-- acciones y evidencias entre normas. La no-duplicación se apoya en:
--   · `requirement_coverage` (Standard Pack Engine): un elemento satisface
--     requisitos de varias normas sin crear copias.
--   · columnas `standards[]` / `disciplines[]` sobre los modelos ya existentes
--     (auditoría, hallazgo, CAPA, riesgo, cambio, evaluación de proveedor), que
--     siguen el precedente de `management_reviews.standards` y
--     `audit_programs.standards`.
-- Solo se crean tablas para conceptos que no existían: alcance/política
-- integrados, partes interesadas, objetivos y responsable por requisito.

-- ─── ENUMS ───────────────────────────────────────────
CREATE TYPE "Discipline" AS ENUM ('QUALITY', 'ENVIRONMENT', 'SAFETY', 'SECURITY');
CREATE TYPE "IntegratedObjectiveStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'NOT_ACHIEVED', 'CANCELLED');

-- ─── MULTI-NORMA SOBRE MODELOS EXISTENTES (sin duplicar filas) ──
ALTER TABLE "audits"
  ADD COLUMN "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "integrated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "audit_findings"
  ADD COLUMN "standards" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "capas"
  ADD COLUMN "standards" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "risks"
  ADD COLUMN "disciplines" "Discipline"[] DEFAULT ARRAY[]::"Discipline"[],
  ADD COLUMN "standards" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "change_requests"
  ADD COLUMN "disciplines" "Discipline"[] DEFAULT ARRAY[]::"Discipline"[],
  ADD COLUMN "standards" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "supplier_evaluations"
  ADD COLUMN "qualityScore" INTEGER,
  ADD COLUMN "environmentScore" INTEGER,
  ADD COLUMN "safetyScore" INTEGER,
  ADD COLUMN "disciplines" "Discipline"[] DEFAULT ARRAY[]::"Discipline"[];

-- Retro-compatibilidad: la norma principal existente pasa a formar parte del
-- array multi-norma, de modo que los filtros integrados no pierdan histórico.
UPDATE "audits" SET "standards" = ARRAY["standardCode"] WHERE "standardCode" IS NOT NULL AND cardinality("standards") = 0;
UPDATE "capas"  SET "standards" = ARRAY["standardCode"] WHERE "standardCode" IS NOT NULL AND cardinality("standards") = 0;

-- ─── TABLAS NUEVAS ───────────────────────────────────
CREATE TABLE "integrated_systems" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Sistema Integrado de Gestión',
  "scope" TEXT,
  "scopeExclusions" TEXT,
  "policy" TEXT,
  "policyVersion" TEXT NOT NULL DEFAULT '1.0',
  "policyApprovedAt" TIMESTAMP(3),
  "policyApprovedById" TEXT,
  "boundaries" TEXT,
  "contextNotes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrated_systems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integrated_system_standards" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integratedSystemId" TEXT NOT NULL,
  "standardCode" TEXT NOT NULL,
  "discipline" "Discipline" NOT NULL,
  "scopeNote" TEXT,
  "exclusions" TEXT,
  "responsibleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrated_system_standards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interested_parties" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT,
  "needs" TEXT,
  "requirements" TEXT,
  "influence" INTEGER NOT NULL DEFAULT 3,
  "dependency" INTEGER NOT NULL DEFAULT 3,
  "isRelevant" BOOLEAN NOT NULL DEFAULT true,
  "communication" TEXT,
  "disciplines" "Discipline"[] DEFAULT ARRAY[]::"Discipline"[],
  "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "responsibleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interested_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integrated_objectives" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "disciplines" "Discipline"[] DEFAULT ARRAY[]::"Discipline"[],
  "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "target" TEXT,
  "baseline" TEXT,
  "unit" TEXT,
  "targetValue" DOUBLE PRECISION,
  "currentValue" DOUBLE PRECISION,
  "dueDate" TIMESTAMP(3),
  "status" "IntegratedObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
  "ownerId" TEXT,
  "processId" TEXT,
  "indicatorId" TEXT,
  "resources" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrated_objectives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "requirement_assignments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "responsibleId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_assignments_pkey" PRIMARY KEY ("id")
);

-- ─── ÍNDICES ─────────────────────────────────────────
CREATE UNIQUE INDEX "integrated_systems_organizationId_key" ON "integrated_systems"("organizationId");
CREATE INDEX "integrated_system_standards_organizationId_idx" ON "integrated_system_standards"("organizationId");
CREATE UNIQUE INDEX "integrated_system_standards_integratedSystemId_standardCode_key" ON "integrated_system_standards"("integratedSystemId", "standardCode");
CREATE INDEX "interested_parties_organizationId_isRelevant_idx" ON "interested_parties"("organizationId", "isRelevant");
CREATE UNIQUE INDEX "interested_parties_organizationId_code_key" ON "interested_parties"("organizationId", "code");
CREATE INDEX "integrated_objectives_organizationId_status_idx" ON "integrated_objectives"("organizationId", "status");
CREATE UNIQUE INDEX "integrated_objectives_organizationId_code_key" ON "integrated_objectives"("organizationId", "code");
CREATE INDEX "requirement_assignments_organizationId_idx" ON "requirement_assignments"("organizationId");
CREATE UNIQUE INDEX "requirement_assignments_organizationId_requirementId_key" ON "requirement_assignments"("organizationId", "requirementId");

-- Filtros integrados frecuentes (auditoría/hallazgo/riesgo por norma).
CREATE INDEX "audits_organizationId_integrated_idx" ON "audits"("organizationId", "integrated");

-- ─── CLAVES FORÁNEAS ─────────────────────────────────
ALTER TABLE "integrated_systems"
  ADD CONSTRAINT "integrated_systems_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "integrated_systems_policyApprovedById_fkey" FOREIGN KEY ("policyApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integrated_system_standards"
  ADD CONSTRAINT "integrated_system_standards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "integrated_system_standards_integratedSystemId_fkey" FOREIGN KEY ("integratedSystemId") REFERENCES "integrated_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "integrated_system_standards_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "interested_parties"
  ADD CONSTRAINT "interested_parties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "interested_parties_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integrated_objectives"
  ADD CONSTRAINT "integrated_objectives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "integrated_objectives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "requirement_assignments"
  ADD CONSTRAINT "requirement_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "requirement_assignments_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "standard_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "requirement_assignments_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── GRANTS ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public."integrated_systems", public."integrated_system_standards",
      public."interested_parties", public."integrated_objectives",
      public."requirement_assignments"
      TO authenticated;
  END IF;
END
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────
DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('integrated_systems','create'),
      ('integrated_system_standards','create'),
      ('interested_parties','create'),
      ('integrated_objectives','create'),
      ('requirement_assignments','create')
    ) AS s(tbl, insert_action)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_select', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_insert', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_update', spec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'nf_'||spec.tbl||'_delete', spec.tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_select', spec.tbl, 'integrated:read');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_insert', spec.tbl, 'integrated:'||spec.insert_action);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.nf_has_org_permission("organizationId", %L)) WITH CHECK (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_update', spec.tbl, 'integrated:update', 'integrated:update');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.nf_has_org_permission("organizationId", %L))', 'nf_'||spec.tbl||'_delete', spec.tbl, 'integrated:delete');
  END LOOP;
END $$;

-- Keep Supabase direct authorization aligned with the server matrix: add
-- integrated:* (carries forward every prior module including environment/safety).
CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role") RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE app_role
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'org:*', 'members:*', 'groups:*', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:*', 'reporting:*', 'activity:*', 'positions:*', 'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:*', 'environment:*', 'safety:*', 'integrated:*']::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY['dashboard:view', 'notifications:view', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*', 'activity:view', 'positions:view', 'personnel:view', 'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*']::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*', 'integrations:read', 'integrations:manage', 'reporting:*', 'activity:read', 'positions:read', 'personnel:read', 'locations:read', 'catalogs:read', 'mgmt-review:*', 'groups:read', 'security-controls:*', 'soa:*', 'risk-treatment:*', 'assets:*', 'incidents:*', 'vulnerabilities:*', 'continuity:*', 'standards:read', 'standards:activate', 'environment:*', 'safety:*', 'integrated:*']::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'audits:*', 'audit-program:read', 'audit-program:export', 'audits:export', 'nc:create', 'nc:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'records:export', 'risks:read', 'training:read', 'changes:read', 'suppliers:read', 'suppliers:export', 'opportunities:read', 'documents:approve', 'documents:export', 'actions:read', 'actions:create', 'actions:export', 'evidence:export', 'reporting:export', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'mgmt-review:export', 'security-controls:read', 'security-controls:export', 'security-controls:approve', 'soa:read', 'soa:export', 'soa:approve', 'risk-treatment:read', 'risk-treatment:export', 'assets:read', 'assets:export', 'incidents:read', 'incidents:export', 'vulnerabilities:read', 'vulnerabilities:export', 'continuity:read', 'continuity:export', 'standards:read', 'environment:read', 'environment:export', 'safety:read', 'safety:export', 'integrated:read', 'integrated:export']::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'documents:create', 'processes:read', 'risks:read', 'risks:create', 'audits:read', 'audits:create', 'indicators:read', 'indicators:create', 'evidence:read', 'evidence:create', 'records:read', 'records:create', 'actions:read', 'actions:create', 'actions:update', 'nc:read', 'training:read', 'changes:read', 'suppliers:read', 'opportunities:read', 'personnel:read', 'positions:read', 'catalogs:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'assets:create', 'incidents:read', 'incidents:create', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'environment:create', 'safety:read', 'safety:create', 'integrated:read']::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY['dashboard:read', 'notifications:read', 'documents:read', 'processes:read', 'evidence:read', 'records:read', 'risks:read', 'audits:read', 'indicators:read', 'training:read', 'changes:read', 'suppliers:read', 'reporting:read', 'activity:read', 'personnel:read', 'positions:read', 'catalogs:read', 'mgmt-review:read', 'security-controls:read', 'soa:read', 'risk-treatment:read', 'assets:read', 'incidents:read', 'vulnerabilities:read', 'continuity:read', 'standards:read', 'environment:read', 'safety:read', 'integrated:read']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;
