-- La decisión de tratamiento de un riesgo deja de ser una etiqueta suelta.
-- Aditiva y sin valor por defecto: los riesgos existentes quedan sin decisión
-- registrada, que es la verdad —nadie la firmó— y el flujo la pedirá cuando
-- toque aceptar, transferir o evitar.
ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "treatmentJustification" TEXT;
ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "treatmentDecidedById" TEXT;
ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "treatmentDecidedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'risks_treatmentDecidedById_fkey'
  ) THEN
    ALTER TABLE "risks"
      ADD CONSTRAINT "risks_treatmentDecidedById_fkey"
      FOREIGN KEY ("treatmentDecidedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "risks_treatmentDecidedById_idx" ON "risks"("treatmentDecidedById");
