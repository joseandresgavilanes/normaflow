-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_authUserId_key" ON "users"("authUserId");
