-- Cerrar una oportunidad pasa a ser una verificación firmada: quién comprobó
-- que se cumplió. Aditiva; las ya cerradas quedan sin firma, que es la verdad.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "closedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_closedById_fkey'
  ) THEN
    ALTER TABLE "opportunities"
      ADD CONSTRAINT "opportunities_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "opportunities_closedById_idx" ON "opportunities"("closedById");
