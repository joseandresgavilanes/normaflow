ALTER TABLE "audits" ADD COLUMN "plannedDate" TIMESTAMP(3);

CREATE INDEX "audits_organizationId_plannedDate_idx" ON "audits"("organizationId", "plannedDate");
