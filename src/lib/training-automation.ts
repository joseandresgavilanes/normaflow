import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyEmail } from "@/lib/notify";

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
  const recipients: { email: string | null; name: string; courseTitle: string; dueAt: Date }[] = [];
  const rows = links.flatMap(({ course }) => {
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + course.defaultDueDays);
    return course.audienceLinks
      .filter(({ personnel }) => personnel.active && personnel.organizationId === input.organizationId)
      .map(({ personnelId, personnel }) => {
        recipients.push({ email: personnel.email, name: `${personnel.firstName} ${personnel.lastName}`.trim(), courseTitle: course.title, dueAt });
        return {
          organizationId: input.organizationId,
          courseId: course.id,
          personnelId,
          dueAt,
          triggeredByDocumentId: input.documentId,
          triggeredByVersion: input.version,
          createdById: input.createdById,
        };
      });
  });

  if (!rows.length) return { count: 0, courseIds: links.map((link) => link.courseId) };
  const result = await prisma.trainingAssignment.createMany({ data: rows, skipDuplicates: true });

  // Best-effort email to personnel (no system login) when new assignments were created.
  if (result.count > 0) {
    await Promise.all(
      recipients
        .filter((r) => r.email)
        .map((r) =>
          notifyEmail({
            to: r.email,
            name: r.name,
            title: `Formación asignada: ${r.courseTitle}`,
            body: `Tras la aprobación de un documento se te asignó la formación «${r.courseTitle}». Fecha límite: ${r.dueAt.toLocaleDateString("es")}.`,
            link: "/app/training",
          }),
        ),
    );
  }

  return { count: result.count, courseIds: links.map((link) => link.courseId) };
}
