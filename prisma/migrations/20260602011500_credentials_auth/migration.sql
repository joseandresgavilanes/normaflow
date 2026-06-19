-- Credentials auth for self-hosted deployments
-- Keeps Supabase Auth fields for AUTH_PROVIDER=supabase compatibility.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

CREATE TABLE IF NOT EXISTS "member_invites" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR',
  "token" TEXT NOT NULL,
  "invitedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "member_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_invites_token_key"
  ON "member_invites"("token");

CREATE INDEX IF NOT EXISTS "member_invites_organizationId_email_idx"
  ON "member_invites"("organizationId", "email");

CREATE INDEX IF NOT EXISTS "member_invites_expiresAt_idx"
  ON "member_invites"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_invites_organizationId_fkey'
  ) THEN
    ALTER TABLE "member_invites"
      ADD CONSTRAINT "member_invites_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_invites_invitedById_fkey'
  ) THEN
    ALTER TABLE "member_invites"
      ADD CONSTRAINT "member_invites_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
