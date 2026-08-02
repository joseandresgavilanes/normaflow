import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { assertPlanModule } from "@/lib/plan-entitlements";

export type OrganizationalContextPayload = Awaited<ReturnType<typeof getOrganizationalContextPayload>>;

/**
 * Standalone clause 4.2/6.2 payload — interested parties and objectives for
 * ANY organization (a single ISO 9001 or ISO 27001, not only the Integrated
 * System). Reuses the same `InterestedParty`/`IntegratedObjective` models and
 * `integrated:*` actions as `/app/integrated`; this is a lighter query
 * without the multi-standard crosswalk.
 */
export async function getOrganizationalContextPayload() {
  const auth = await requireAuthorization("integrated:read");
  assertPlanModule(auth.ctx, "context");
  const organizationId = auth.ctx.organization.id;

  const [parties, objectives, members, processes, indicators] = await Promise.all([
    prisma.interestedParty.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.integratedObjective.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.indicator.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    access: {
      canCreate: auth.can("integrated:create"),
      canUpdate: auth.can("integrated:update"),
      canDelete: auth.can("integrated:delete"),
      currentUserId: auth.ctx.user.id,
    },
    interestedParties: parties.map((p) => ({
      id: p.id, code: p.code, name: p.name, type: p.type, needs: p.needs, requirements: p.requirements,
      influence: p.influence, dependency: p.dependency, isRelevant: p.isRelevant, communication: p.communication,
      disciplines: p.disciplines, standards: p.standards, responsibleId: p.responsibleId,
    })),
    objectives: objectives.map((o) => ({
      id: o.id, code: o.code, title: o.title, description: o.description,
      disciplines: o.disciplines, standards: o.standards, target: o.target,
      baseline: o.baseline, unit: o.unit, targetValue: o.targetValue, currentValue: o.currentValue,
      status: o.status, dueDate: o.dueDate?.toISOString() ?? null, ownerId: o.ownerId,
      processId: o.processId, indicatorId: o.indicatorId, resources: o.resources,
    })),
    members,
    processes,
    indicators,
  };
}
