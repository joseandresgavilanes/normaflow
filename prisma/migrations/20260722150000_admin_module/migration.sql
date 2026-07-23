-- NormaFlow Admin module: tenant profile, membership state, group links and
-- organization-owned configuration catalogs.

ALTER TABLE public."organizations"
  ADD COLUMN IF NOT EXISTS "size" TEXT,
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE public."memberships"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

ALTER TABLE public."member_invites"
  ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS public."group_processes" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "processId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_processes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."group_modules" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."organization_catalog_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_processes_groupId_processId_key"
  ON public."group_processes"("groupId", "processId");
CREATE INDEX IF NOT EXISTS "group_processes_processId_idx"
  ON public."group_processes"("processId");
CREATE UNIQUE INDEX IF NOT EXISTS "group_modules_groupId_module_key"
  ON public."group_modules"("groupId", "module");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_catalog_items_organizationId_kind_name_key"
  ON public."organization_catalog_items"("organizationId", "kind", "name");
CREATE INDEX IF NOT EXISTS "organization_catalog_items_organizationId_kind_active_idx"
  ON public."organization_catalog_items"("organizationId", "kind", "active");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_processes_groupId_fkey') THEN
    ALTER TABLE public."group_processes"
      ADD CONSTRAINT "group_processes_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_processes_processId_fkey') THEN
    ALTER TABLE public."group_processes"
      ADD CONSTRAINT "group_processes_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES public."processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_modules_groupId_fkey') THEN
    ALTER TABLE public."group_modules"
      ADD CONSTRAINT "group_modules_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_catalog_items_organizationId_fkey') THEN
    ALTER TABLE public."organization_catalog_items"
      ADD CONSTRAINT "organization_catalog_items_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE public."group_processes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."group_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_catalog_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nf_group_processes_manage" ON public."group_processes";
CREATE POLICY "nf_group_processes_manage" ON public."group_processes"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."groups" g
    WHERE g."id" = "group_processes"."groupId"
      AND public.nf_is_org_member(g."organizationId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."groups" g
    WHERE g."id" = "group_processes"."groupId"
      AND public.nf_has_org_permission(g."organizationId", 'groups:view')
  ));

DROP POLICY IF EXISTS "nf_group_modules_manage" ON public."group_modules";
CREATE POLICY "nf_group_modules_manage" ON public."group_modules"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."groups" g
    WHERE g."id" = "group_modules"."groupId"
      AND public.nf_is_org_member(g."organizationId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."groups" g
    WHERE g."id" = "group_modules"."groupId"
      AND public.nf_has_org_permission(g."organizationId", 'groups:view')
  ));

DROP POLICY IF EXISTS "nf_organization_catalog_items_manage" ON public."organization_catalog_items";
CREATE POLICY "nf_organization_catalog_items_manage" ON public."organization_catalog_items"
  FOR ALL TO authenticated
  USING (public.nf_is_org_member("organizationId"))
  WITH CHECK (public.nf_has_org_permission("organizationId", 'catalogs:view'));

