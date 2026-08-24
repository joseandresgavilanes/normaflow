-- El alcance deja de deducirse del nombre del rol.
--
-- Hasta ahora «ver solo lo asignado» era `role = CONTRIBUTOR` incrustado en ocho
-- comprobaciones de servidor. Eso hacía inexpresable lo que las organizaciones
-- piden de verdad: un jefe de proceso que opera acotado a los suyos sin ser
-- contribuidor, o un auditor con alcance a una sola sede.
--
-- El defecto es `false` y el backfill marca a los contribuidores existentes, de
-- forma que nadie gana acceso al desplegar: cada persona conserva exactamente el
-- alcance que ya tenía.

ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "scoped" BOOLEAN NOT NULL DEFAULT false;

UPDATE "memberships" SET "scoped" = true WHERE "role" = 'CONTRIBUTOR';

CREATE INDEX IF NOT EXISTS "memberships_organizationId_scoped_idx" ON "memberships"("organizationId", "scoped");
