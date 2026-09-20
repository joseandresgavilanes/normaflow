-- Formato versionado del registro + historial de adjuntos de las entradas.
-- Nada se borra: las columnas de archivo de `record_entries` se conservan
-- apuntando al adjunto vigente, y el historial nace con lo que ya había.

-- CreateEnum
CREATE TYPE "RecordFormatVersionStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "records" ADD COLUMN     "currentFormatVersion" TEXT;

-- CreateTable
CREATE TABLE "record_format_versions" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RecordFormatVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "changeDescription" TEXT,
    "previousVersion" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_format_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_entry_attachments" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "record_entry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_format_versions_recordId_createdAt_idx" ON "record_format_versions"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "record_format_versions_recordId_status_idx" ON "record_format_versions"("recordId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "record_format_versions_recordId_version_key" ON "record_format_versions"("recordId", "version");

-- CreateIndex
CREATE INDEX "record_entry_attachments_entryId_uploadedAt_idx" ON "record_entry_attachments"("entryId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "record_entry_attachments_entryId_version_key" ON "record_entry_attachments"("entryId", "version");

-- AddForeignKey
ALTER TABLE "record_format_versions" ADD CONSTRAINT "record_format_versions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_format_versions" ADD CONSTRAINT "record_format_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_entry_attachments" ADD CONSTRAINT "record_entry_attachments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "record_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_entry_attachments" ADD CONSTRAINT "record_entry_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Relleno: cada entrada que ya tenía archivo estrena su historial con esa
-- misma fila como versión 1, vigente (`supersededAt` nulo). Sin esto, el
-- historial de la evidencia existente nacería vacío y parecería que nunca
-- hubo adjunto.
INSERT INTO "record_entry_attachments" ("id", "entryId", "version", "fileName", "fileUrl", "fileSize", "mimeType", "uploadedById", "uploadedAt", "supersededAt")
SELECT
  'att1_' || e."id",   -- determinista: una fila por entrada, sin depender de pgcrypto
  e."id",
  1,
  COALESCE(e."fileName", 'adjunto'),
  e."fileUrl",
  e."fileSize",
  e."mimeType",
  e."enteredById",
  e."enteredAt",
  NULL
FROM "record_entries" e
WHERE e."fileUrl" IS NOT NULL AND e."fileUrl" <> '';
