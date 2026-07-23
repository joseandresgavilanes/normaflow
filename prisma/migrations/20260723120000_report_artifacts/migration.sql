CREATE TYPE "ReportArtifactStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "report_exports"
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "status" "ReportArtifactStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "error" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "report_exports_organizationId_status_createdAt_idx" ON "report_exports"("organizationId", "status", "createdAt");
