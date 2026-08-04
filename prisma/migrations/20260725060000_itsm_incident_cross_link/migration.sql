-- Cross-domain incident linking (ISO/IEC 20000 integration requirement):
-- relate an ITSMIncident to a SecurityIncident / AIIncident / OccupationalIncident
-- without merging their workflows — each keeps its own status enum and table.
-- targetId is validated against the target domain's table at the application
-- layer (see linkItsmIncidentCrossDomain), not via a real cross-table FK.

CREATE TYPE "IncidentLinkDomain" AS ENUM ('SECURITY', 'AI', 'OCCUPATIONAL');

CREATE TABLE "incident_cross_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itsmIncidentId" TEXT NOT NULL,
  "targetDomain" "IncidentLinkDomain" NOT NULL,
  "targetId" TEXT NOT NULL,
  "relationType" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_cross_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incident_cross_links_itsmIncidentId_targetDomain_targetId_key"
  ON "incident_cross_links"("itsmIncidentId", "targetDomain", "targetId");
CREATE INDEX "incident_cross_links_organizationId_targetDomain_targetId_idx"
  ON "incident_cross_links"("organizationId", "targetDomain", "targetId");

ALTER TABLE "incident_cross_links" ADD CONSTRAINT "incident_cross_links_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_cross_links" ADD CONSTRAINT "incident_cross_links_itsmIncidentId_fkey"
  FOREIGN KEY ("itsmIncidentId") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."incident_cross_links" TO authenticated;
  END IF;
END $$;

ALTER TABLE "incident_cross_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nf_incident_cross_links_select" ON "incident_cross_links"
  FOR SELECT TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'itsm:read'));

CREATE POLICY "nf_incident_cross_links_insert" ON "incident_cross_links"
  FOR INSERT TO authenticated
  WITH CHECK (public.nf_has_org_permission("organizationId", 'itsm:create'));

CREATE POLICY "nf_incident_cross_links_update" ON "incident_cross_links"
  FOR UPDATE TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'itsm:update'))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'itsm:update'));

CREATE POLICY "nf_incident_cross_links_delete" ON "incident_cross_links"
  FOR DELETE TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'itsm:delete'));
