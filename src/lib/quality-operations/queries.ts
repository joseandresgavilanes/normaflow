import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { assertPlanModule } from "@/lib/plan-entitlements";

export type QualityOperationsPayload = Awaited<ReturnType<typeof getQualityOperationsPayload>>;

/** Live payload for /app/quality-ops — clauses 7.2, 7.4, 8.5.3, 8.5.4, 9.1.2. */
export async function getQualityOperationsPayload() {
  const auth = await requireAuthorization("quality-ops:read");
  assertPlanModule(auth.ctx, "quality-ops");
  const organizationId = auth.ctx.organization.id;

  const [requirements, properties, preservation, feedback, communications, members, processes, capas] = await Promise.all([
    prisma.customerRequirement.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.customerProperty.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.preservationRecord.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.customerFeedback.findMany({ where: { organizationId }, orderBy: { receivedAt: "desc" } }),
    prisma.communicationRecord.findMany({ where: { organizationId }, orderBy: { communicatedAt: "desc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.cAPA.findMany({ where: { organizationId }, select: { id: true, code: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return {
    access: {
      canCreate: auth.can("quality-ops:create"),
      canUpdate: auth.can("quality-ops:update"),
      canDelete: auth.can("quality-ops:delete"),
      currentUserId: auth.ctx.user.id,
    },
    requirements: requirements.map((r) => ({
      id: r.id, code: r.code, title: r.title, description: r.description, source: r.source,
      processId: r.processId, status: r.status, reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
    properties: properties.map((p) => ({
      id: p.id, code: p.code, description: p.description, customerName: p.customerName,
      conditionOnReceipt: p.conditionOnReceipt, receivedAt: p.receivedAt.toISOString(),
      returnedAt: p.returnedAt?.toISOString() ?? null, status: p.status, incidentNote: p.incidentNote,
      responsibleId: p.responsibleId, processId: p.processId,
    })),
    preservation: preservation.map((r) => ({
      id: r.id, code: r.code, itemDescription: r.itemDescription, handlingInstructions: r.handlingInstructions,
      storageConditions: r.storageConditions, packagingNote: r.packagingNote, status: r.status,
      responsibleId: r.responsibleId, processId: r.processId, reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
    feedback: feedback.map((f) => ({
      id: f.id, code: f.code, customerName: f.customerName, channel: f.channel, score: f.score,
      comment: f.comment, receivedAt: f.receivedAt.toISOString(), status: f.status,
      linkedCapaId: f.linkedCapaId, responsibleId: f.responsibleId,
    })),
    communications: communications.map((c) => ({
      id: c.id, code: c.code, subject: c.subject, content: c.content, direction: c.direction,
      audience: c.audience, channel: c.channel, standards: c.standards,
      communicatedById: c.communicatedById, communicatedAt: c.communicatedAt.toISOString(),
    })),
    members,
    processes,
    capas,
    summary: {
      openRequirements: requirements.filter((r) => r.status === "OPEN").length,
      propertyInCustody: properties.filter((p) => p.status === "IN_CUSTODY").length,
      preservationNonCompliant: preservation.filter((r) => r.status === "NON_COMPLIANT").length,
      avgSatisfaction: feedback.filter((f) => f.score != null).length
        ? Math.round(feedback.reduce((s, f) => s + (f.score ?? 0), 0) / feedback.filter((f) => f.score != null).length)
        : null,
    },
  };
}
