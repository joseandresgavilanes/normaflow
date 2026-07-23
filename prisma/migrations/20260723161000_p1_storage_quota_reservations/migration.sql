ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storageBytes" INTEGER NOT NULL DEFAULT 0;

-- Reconcile the counter from persisted metadata before it is used for atomic
-- reservations. Storage objects are intentionally not listed here: only files
-- with a tenant-owned Prisma row count toward quota.
UPDATE "organizations" o
SET "storageBytes" = COALESCE((
  SELECT SUM(v."fileSize")
  FROM "document_versions" v
  JOIN "documents" d ON d."id" = v."documentId"
  WHERE d."organizationId" = o."id"
), 0)
+ COALESCE((SELECT SUM("fileSize") FROM "evidence_files" WHERE "organizationId" = o."id"), 0)
+ COALESCE((
  SELECT SUM(e."fileSize")
  FROM "record_entries" e
  JOIN "records" r ON r."id" = e."recordId"
  WHERE r."organizationId" = o."id"
), 0)
+ COALESCE((SELECT SUM("fileSize") FROM "capa_evidences" WHERE "organizationId" = o."id"), 0)
+ COALESCE((SELECT SUM("fileSize") FROM "report_exports" WHERE "organizationId" = o."id" AND "status" = 'COMPLETED'), 0);

CREATE INDEX IF NOT EXISTS "organizations_storageBytes_idx" ON "organizations" ("storageBytes");
