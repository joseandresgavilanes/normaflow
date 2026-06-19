import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Creates one assignment per active configured recipient when a linked
 * controlled document is approved. The unique trigger index makes retries safe.
 */
export async function assignTrainingForApprovedDocument(input: {
  organizationId: string;
  documentId: string;
  version: string;
  createdById: string;
}): Promise<{ count: number; courseIds: string[] }> {
  const links = await prisma.trainingCourseDocument.findMany({
    where: {
      documentId: input.documentId,
      course: {
        organizationId: input.organizationId,
        active: true,
        autoAssignOnDocApproval: true,
      },
    },
    include: {
      course: {
        include: {
          audienceLinks: {
            include: { personnel: true },
          },
        },
      },
    },
  });

  const now = new Date();
  const rows = links.flatMap(({ course }) => {
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + course.defaultDueDays);
    return course.audienceLinks
      .filter(({ personnel }) => personnel.active && personnel.organizationId === input.organizationId)
      .map(({ personnelId }) => ({
        organizationId: input.organizationId,
        courseId: course.id,
        personnelId,
        dueAt,
        triggeredByDocumentId: input.documentId,
        triggeredByVersion: input.version,
        createdById: input.createdById,
      }));
  });

  if (!rows.length) return { count: 0, courseIds: links.map((link) => link.courseId) };
  const result = await prisma.trainingAssignment.createMany({ data: rows, skipDuplicates: true });
  return { count: result.count, courseIds: links.map((link) => link.courseId) };
}
