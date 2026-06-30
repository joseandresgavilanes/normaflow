-- Document supersede (reemplazo): el documento obsoleto apunta a su reemplazo.
ALTER TABLE "documents" ADD COLUMN "supersededById" TEXT;
CREATE UNIQUE INDEX "documents_supersededById_key" ON "documents"("supersededById");
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
