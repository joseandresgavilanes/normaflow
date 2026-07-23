-- Central report service: persisted artifacts and reproducible filters.
ALTER TABLE "report_exports"
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "filters" JSONB,
  ADD COLUMN "content" BYTEA;

CREATE INDEX "report_exports_organizationId_reportType_createdAt_idx"
  ON "report_exports"("organizationId", "reportType", "createdAt");
