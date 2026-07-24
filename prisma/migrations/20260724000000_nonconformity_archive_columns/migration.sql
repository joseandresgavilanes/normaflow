-- Reconcile schema drift: the Nonconformity archive fields exist in
-- schema.prisma but were never added to the database, causing
-- "column nonconformities.archiveReason does not exist" (SQLSTATE 42703)
-- at runtime once the new code selected them.
-- Additive, nullable, idempotent — no data loss.
ALTER TABLE "nonconformities" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
ALTER TABLE "nonconformities" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "nonconformities" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
