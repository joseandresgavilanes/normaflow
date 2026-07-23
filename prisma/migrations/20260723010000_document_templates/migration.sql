CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "standardCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'PROCEDURE',
    "clauseId" TEXT,
    "content" TEXT NOT NULL,
    "fieldSchema" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_templates_code_key" ON "document_templates"("code");
CREATE INDEX "document_templates_standardCode_isActive_idx" ON "document_templates"("standardCode", "isActive");
CREATE INDEX "document_templates_clauseId_idx" ON "document_templates"("clauseId");

ALTER TABLE "documents" ADD COLUMN "content" TEXT;
ALTER TABLE "documents" ADD COLUMN "templateId" TEXT;
ALTER TABLE "document_versions" ADD COLUMN "content" TEXT;
CREATE INDEX "documents_templateId_idx" ON "documents"("templateId");

ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_clauseId_fkey"
  FOREIGN KEY ("clauseId") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE "document_templates" TO authenticated;
CREATE POLICY "document_templates_authenticated_read" ON "document_templates"
  FOR SELECT TO authenticated USING ("isActive" = true);
