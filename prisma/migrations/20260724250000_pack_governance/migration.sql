-- Shared Standard Pack Engine foundations, phase 0 (part 2):
--   1. Organization pack entitlements — the only path that grants an org
--      access to a pack. Never ALL_MODULES-style blanket access.
--   2. Persisted readiness checklist runs + lifecycle transition history —
--      DB evidence backing a promotion to LIVE, not just in-process pure fns.
--   3. DB-level immutability for ACTIVE/SUPERSEDED editions and their
--      requirements — defense in depth on top of the app-level freeze in
--      src/lib/standard-packs/index.ts (installPack).

CREATE TYPE "PackEntitlementSource" AS ENUM ('PLAN', 'MANUAL_GRANT', 'TRIAL', 'PILOT_PROGRAM');

-- ─── 1. ORGANIZATION PACK ENTITLEMENTS ───────────────

CREATE TABLE "organization_pack_entitlements" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "source" "PackEntitlementSource" NOT NULL DEFAULT 'PLAN',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "grantedById" TEXT,
  "plan" TEXT,
  "contractReference" TEXT,
  "scope" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_pack_entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_pack_entitlements_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "organization_pack_entitlements_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "standard_packs"("id") ON DELETE CASCADE,
  CONSTRAINT "organization_pack_entitlements_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "organization_pack_entitlements_organizationId_packId_key"
  ON "organization_pack_entitlements"("organizationId", "packId");
CREATE INDEX "organization_pack_entitlements_organizationId_enabled_idx"
  ON "organization_pack_entitlements"("organizationId", "enabled");
CREATE INDEX "organization_pack_entitlements_packId_idx"
  ON "organization_pack_entitlements"("packId");

-- ─── 2. PACK READINESS ASSESSMENTS / CHECKS ──────────

CREATE TABLE "pack_readiness_assessments" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "requestedStatus" "PackLifecycleStatus" NOT NULL,
  "met" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL,
  "ready" BOOLEAN NOT NULL,
  "actorId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pack_readiness_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pack_readiness_assessments_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "standard_packs"("id") ON DELETE CASCADE,
  CONSTRAINT "pack_readiness_assessments_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "pack_readiness_assessments_packId_createdAt_idx"
  ON "pack_readiness_assessments"("packId", "createdAt");

CREATE TABLE "pack_readiness_checks" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "criterion" TEXT NOT NULL,
  "met" BOOLEAN NOT NULL,
  "note" TEXT,
  CONSTRAINT "pack_readiness_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pack_readiness_checks_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "pack_readiness_assessments"("id") ON DELETE CASCADE
);
CREATE INDEX "pack_readiness_checks_assessmentId_idx"
  ON "pack_readiness_checks"("assessmentId");

-- ─── 3. LIFECYCLE TRANSITION HISTORY (append-only) ───

CREATE TABLE "standard_pack_lifecycle_events" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "fromStatus" "PackLifecycleStatus",
  "toStatus" "PackLifecycleStatus" NOT NULL,
  "reason" TEXT,
  "actorId" TEXT,
  "assessmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "standard_pack_lifecycle_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "standard_pack_lifecycle_events_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "standard_packs"("id") ON DELETE CASCADE,
  CONSTRAINT "standard_pack_lifecycle_events_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "standard_pack_lifecycle_events_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "pack_readiness_assessments"("id") ON DELETE SET NULL
);
CREATE INDEX "standard_pack_lifecycle_events_packId_createdAt_idx"
  ON "standard_pack_lifecycle_events"("packId", "createdAt");

CREATE OR REPLACE FUNCTION public.nf_lifecycle_events_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'standard_pack_lifecycle_events is append-only; UPDATE and DELETE are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS nf_lifecycle_events_append_only ON "standard_pack_lifecycle_events";
CREATE TRIGGER nf_lifecycle_events_append_only
  BEFORE UPDATE OR DELETE ON "standard_pack_lifecycle_events"
  FOR EACH ROW EXECUTE FUNCTION public.nf_lifecycle_events_append_only();

-- ─── 4. RLS + GRANTS ──────────────────────────────────
-- Same pattern as the rest of the catalog (see docs/standard-packs.md#security):
-- reads go to `authenticated` gated by RLS; writes go through the Prisma
-- owner / service role only (platform-gated server actions), never through
-- the `authenticated` role — so there is no INSERT/UPDATE/DELETE grant below.

GRANT SELECT ON TABLE "organization_pack_entitlements" TO authenticated;
GRANT SELECT ON TABLE "pack_readiness_assessments" TO authenticated;
GRANT SELECT ON TABLE "pack_readiness_checks" TO authenticated;
GRANT SELECT ON TABLE "standard_pack_lifecycle_events" TO authenticated;

ALTER TABLE "organization_pack_entitlements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_pack_entitlements_select" ON "organization_pack_entitlements";
CREATE POLICY "nf_pack_entitlements_select" ON "organization_pack_entitlements"
  FOR SELECT TO authenticated
  USING (public.nf_has_org_permission("organizationId", 'billing:view'));

-- Platform-wide catalog metadata (no organizationId): readable by any
-- authenticated user with standards:read, same as the rest of the catalog.
ALTER TABLE "pack_readiness_assessments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_pack_readiness_assessments_select" ON "pack_readiness_assessments";
CREATE POLICY "nf_pack_readiness_assessments_select" ON "pack_readiness_assessments"
  FOR SELECT TO authenticated USING (true);

ALTER TABLE "pack_readiness_checks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_pack_readiness_checks_select" ON "pack_readiness_checks";
CREATE POLICY "nf_pack_readiness_checks_select" ON "pack_readiness_checks"
  FOR SELECT TO authenticated USING (true);

ALTER TABLE "standard_pack_lifecycle_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nf_lifecycle_events_select" ON "standard_pack_lifecycle_events";
CREATE POLICY "nf_lifecycle_events_select" ON "standard_pack_lifecycle_events"
  FOR SELECT TO authenticated USING (true);

-- ─── 5. IMMUTABLE EDITIONS (defense in depth) ────────
-- Mirrors the app-level freeze in installPack(): an ACTIVE edition never has
-- its requirement text mutated (only new, never-before-seen requirement
-- codes may still be inserted — freezeRequirements only skips existing
-- rows). A SUPERSEDED/WITHDRAWN edition is fully historical: no further
-- writes to it or its requirements, from any code path, ever.

CREATE OR REPLACE FUNCTION public.nf_protect_locked_edition_requirements()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  edition_status "StandardEditionStatus";
BEGIN
  SELECT "status" INTO edition_status FROM "standard_editions" WHERE "id" = OLD."standardId";
  IF edition_status IN ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'standard_requirements % is immutable: its edition (%) is %', OLD."id", OLD."standardId", edition_status;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS nf_standard_requirements_lock ON "standard_requirements";
CREATE TRIGGER nf_standard_requirements_lock
  BEFORE UPDATE OR DELETE ON "standard_requirements"
  FOR EACH ROW EXECUTE FUNCTION public.nf_protect_locked_edition_requirements();

CREATE OR REPLACE FUNCTION public.nf_protect_locked_editions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('SUPERSEDED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'standard_edition % (%/%) is % and read-only', OLD."id", OLD."familyId", OLD."editionCode", OLD."status";
  END IF;
  IF OLD."status" = 'ACTIVE' THEN
    IF NEW."status" NOT IN ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN') THEN
      RAISE EXCEPTION 'standard_edition % cannot move from ACTIVE to %', OLD."id", NEW."status";
    END IF;
    IF NEW."catalogVersion" IS DISTINCT FROM OLD."catalogVersion" THEN
      RAISE EXCEPTION 'standard_edition % ACTIVE catalogVersion is immutable; bump editionCode for a new edition instead', OLD."id";
    END IF;
    IF NEW."editionCode" IS DISTINCT FROM OLD."editionCode" OR NEW."familyId" IS DISTINCT FROM OLD."familyId" THEN
      RAISE EXCEPTION 'standard_edition % identity (familyId/editionCode) is immutable once ACTIVE', OLD."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nf_standard_editions_lock ON "standard_editions";
CREATE TRIGGER nf_standard_editions_lock
  BEFORE UPDATE ON "standard_editions"
  FOR EACH ROW EXECUTE FUNCTION public.nf_protect_locked_editions();
