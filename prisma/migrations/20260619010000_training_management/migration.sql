-- Training management moved into the canonical Prisma migration history.
-- On databases where prisma/sql/training_management.sql was applied manually,
-- mark this migration as applied instead of running it again (see prisma/MIGRATIONS.md).

-- Persisted training management: course catalog, audiences, document links and assignments.

CREATE TYPE "TrainingAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'RETRAINING_REQUIRED',
  'CANCELLED'
);

CREATE TABLE "training_courses" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "standardTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "defaultValidityMonths" INTEGER NOT NULL DEFAULT 12,
  "defaultDueDays" INTEGER NOT NULL DEFAULT 30,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "autoAssignOnDocApproval" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_course_documents" (
  "courseId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "training_course_documents_pkey" PRIMARY KEY ("courseId", "documentId")
);

CREATE TABLE "training_course_audience" (
  "courseId" TEXT NOT NULL,
  "personnelId" TEXT NOT NULL,
  CONSTRAINT "training_course_audience_pkey" PRIMARY KEY ("courseId", "personnelId")
);

CREATE TABLE "training_assignments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "personnelId" TEXT NOT NULL,
  "processId" TEXT,
  "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "evidenceNote" TEXT,
  "evidenceUrl" TEXT,
  "triggeredByDocumentId" TEXT,
  "triggeredByVersion" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_courses_organizationId_code_key" ON "training_courses"("organizationId", "code");
CREATE INDEX "training_courses_organizationId_active_idx" ON "training_courses"("organizationId", "active");
CREATE INDEX "training_course_documents_documentId_idx" ON "training_course_documents"("documentId");
CREATE INDEX "training_course_audience_personnelId_idx" ON "training_course_audience"("personnelId");
CREATE INDEX "training_assignments_organizationId_status_idx" ON "training_assignments"("organizationId", "status");
CREATE INDEX "training_assignments_personnelId_dueAt_idx" ON "training_assignments"("personnelId", "dueAt");
CREATE INDEX "training_assignments_courseId_idx" ON "training_assignments"("courseId");
CREATE UNIQUE INDEX "training_assignments_trigger_key" ON "training_assignments"("courseId", "personnelId", "triggeredByDocumentId", "triggeredByVersion");

ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_course_documents" ADD CONSTRAINT "training_course_documents_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_course_documents" ADD CONSTRAINT "training_course_documents_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_course_audience" ADD CONSTRAINT "training_course_audience_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_course_audience" ADD CONSTRAINT "training_course_audience_personnelId_fkey"
  FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_personnelId_fkey"
  FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_triggeredByDocumentId_fkey"
  FOREIGN KEY ("triggeredByDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

