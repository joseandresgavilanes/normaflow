-- Delegación por ausencia: quién recibe los avisos de alguien mientras no está.
--
-- Migración deliberadamente ADITIVA: crea una tabla y nada más. No renombra ni
-- suelta nada, así que revertirla es un DROP TABLE. El `migrate diff` completo
-- proponía además recrear 27 claves foráneas por normalización de nombres —
-- ruido que no aporta y que en producción solo añade riesgo, así que se deja
-- fuera.
--
-- Renombrar tablas rompe las funciones plpgsql que llevan el nombre antiguo
-- embebido y Prisma no lo detecta: otra razón para no tocar lo existente.

CREATE TABLE "approval_delegations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_delegations_organizationId_fromUserId_startsAt_end_idx"
  ON "approval_delegations"("organizationId", "fromUserId", "startsAt", "endsAt");

ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sin esto la tabla nueva quedaría FUERA de la frontera de inquilino que el
-- resto del esquema ya tiene: accesible entre organizaciones desde la API.
-- Es el mismo par que aplica `20260728120000_enable_row_level_security` a toda
-- tabla con `organizationId`.
ALTER TABLE "approval_delegations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS normaflow_tenant_isolation ON public."approval_delegations";
CREATE POLICY normaflow_tenant_isolation ON public."approval_delegations"
  USING (public.normaflow_is_org_member("organizationId"))
  WITH CHECK (public.normaflow_is_org_member("organizationId"));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."approval_delegations" TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."approval_delegations" TO service_role;
  END IF;
END
$$;
