-- Evidencias del plan anual de auditorías y evidencia del checklist.
--
-- Hasta ahora una evidencia solo podía colgar de una auditoría concreta, nunca
-- del programa que la planifica, y la respuesta del checklist guardaba una URL
-- suelta en vez de apuntar al repositorio. `evidenceUrl` se conserva: lo ya
-- respondido no se pierde y sigue valiendo para pruebas externas.

-- CreateTable
CREATE TABLE "evidence_audit_program_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_audit_program_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_audit_program_links_evidenceId_programId_key" ON "evidence_audit_program_links"("evidenceId", "programId");

-- CreateIndex
CREATE INDEX "evidence_audit_program_links_organizationId_programId_idx" ON "evidence_audit_program_links"("organizationId", "programId");

-- AddForeignKey
ALTER TABLE "evidence_audit_program_links" ADD CONSTRAINT "evidence_audit_program_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_audit_program_links" ADD CONSTRAINT "evidence_audit_program_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_audit_program_links" ADD CONSTRAINT "evidence_audit_program_links_programId_fkey" FOREIGN KEY ("programId") REFERENCES "audit_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "audit_checklist_items" ADD COLUMN     "evidenceId" TEXT;

-- AddForeignKey
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
