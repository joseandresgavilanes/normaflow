import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { assertPlanModule } from "@/lib/plan-entitlements";

export type DesignDevelopmentPayload = Awaited<ReturnType<typeof getDesignDevelopmentPayload>>;

/** Live payload for /app/design-dev — generic ISO 9001 §8.3 design & development. */
export async function getDesignDevelopmentPayload() {
  const auth = await requireAuthorization("design-dev:read");
  assertPlanModule(auth.ctx, "design-dev");
  const organizationId = auth.ctx.organization.id;

  const [projects, members, processes, evidenceFiles] = await Promise.all([
    prisma.designProject.findMany({
      where: { organizationId },
      include: { stages: { orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.evidenceFile.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return {
    access: {
      canCreate: auth.can("design-dev:create"),
      canUpdate: auth.can("design-dev:update"),
      canDelete: auth.can("design-dev:delete"),
      currentUserId: auth.ctx.user.id,
    },
    projects: projects.map((p) => ({
      id: p.id, code: p.code, name: p.name, description: p.description, status: p.status,
      ownerId: p.ownerId, processId: p.processId,
      plannedStart: p.plannedStart?.toISOString() ?? null, plannedEnd: p.plannedEnd?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      stages: p.stages.map((s) => ({
        id: s.id, code: s.code, stageType: s.stageType, title: s.title, description: s.description,
        result: s.result, status: s.status, responsibleId: s.responsibleId, evidenceId: s.evidenceId,
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    })),
    members,
    processes,
    evidenceFiles,
  };
}
