-- Pack commercial lifecycle (DEVELOPMENT | PILOT | LIVE).
-- Separate from StandardEditionStatus (DRAFT | ACTIVE | SUPERSEDED | WITHDRAWN).
--
-- Only 3 states — a pack never ends the lifecycle "disabled". Retiring a pack
-- from the commercial catalog is a separate act (StandardPack.archivedAt),
-- orthogonal to where it sits in DEVELOPMENT -> PILOT -> LIVE.

CREATE TYPE "PackLifecycleStatus" AS ENUM ('DEVELOPMENT', 'PILOT', 'LIVE');

ALTER TABLE "standard_packs"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "PackLifecycleStatus" NOT NULL DEFAULT 'DEVELOPMENT';

ALTER TABLE "standard_packs"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "standard_packs_lifecycleStatus_idx"
  ON "standard_packs"("lifecycleStatus");

CREATE INDEX IF NOT EXISTS "standard_packs_archivedAt_idx"
  ON "standard_packs"("archivedAt");

-- Seed known core packs as LIVE when already installed (idempotent).
UPDATE "standard_packs"
SET "lifecycleStatus" = 'LIVE'
WHERE "code" IN ('PACK_ISO_9001', 'PACK_ISO_27001');

UPDATE "standard_packs"
SET "lifecycleStatus" = 'PILOT'
WHERE "code" IN (
  'PACK_ISO_14001', 'PACK_ISO_45001', 'PACK_ISO_42001',
  'PACK_ISO_37301', 'PACK_ISO_22301'
);

UPDATE "standard_packs"
SET "lifecycleStatus" = 'DEVELOPMENT'
WHERE "code" IN (
  'PACK_ISO_37001', 'PACK_ISO_50001', 'PACK_ISO_22000',
  'PACK_ISO_20000', 'PACK_ISO_13485'
);
