-- Document control hardening: searchable tenant indexes and collision-free versions.

CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_documentId_version_key"
  ON "document_versions"("documentId", "version");

CREATE INDEX IF NOT EXISTS "documents_organizationId_status_idx"
  ON "documents"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "documents_organizationId_standardCode_idx"
  ON "documents"("organizationId", "standardCode");

CREATE INDEX IF NOT EXISTS "documents_organizationId_clauseId_idx"
  ON "documents"("organizationId", "clauseId");

CREATE INDEX IF NOT EXISTS "documents_organizationId_processId_idx"
  ON "documents"("organizationId", "processId");

CREATE INDEX IF NOT EXISTS "documents_organizationId_ownerId_idx"
  ON "documents"("organizationId", "ownerId");
