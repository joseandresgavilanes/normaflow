import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { computeSafetyIndicators } from "@/lib/safety/indicators";
import { INCIDENT_FLOW } from "@/lib/safety/incident-workflow";
import { decryptHealthField } from "@/lib/crypto/field-encryption";

export type SafetyPayload = Awaited<ReturnType<typeof getSafetyPayload>>;
export type HealthSurveillancePayload = Awaited<ReturnType<typeof getHealthSurveillancePayload>>;

/**
 * Live payload for the /app/safety module (ISO 45001). `hoursWorked` scopes
 * the rate indices. Deliberately does NOT include per-worker health
 * surveillance rows — that data is health/medical information about named
 * individuals and requires `safety-sensitive:read`, not the generic
 * `safety:read` every CONTRIBUTOR has. Call `getHealthSurveillancePayload`
 * separately, gated on its own permission. Only the count (never the
 * fitness/content of any specific worker) surfaces here, and only when the
 * caller actually holds the sensitive permission.
 */
export async function getSafetyPayload(hoursWorked = 0) {
  const auth = await requireAuthorization("safety:read");
  const organizationId = auth.ctx.organization.id;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), 0, 1);
  const canSeeSensitive = auth.can("safety-sensitive:read");

  const [hazards, assessments, consultations, incidents, inspections, ppeItems, ppeAssignments, permits, drills, surveillanceCount, contractors, members,
    accidents, accidentsLostTime, nearMisses, lostDaysAgg, inspectionsInYear, overdue] = await Promise.all([
    prisma.occupationalHazard.findMany({ where: { organizationId }, include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } }, orderBy: { code: "asc" } }),
    prisma.occupationalRiskAssessment.findMany({ where: { organizationId }, include: { hazard: { select: { code: true, activity: true, hazard: true } } }, orderBy: { assessedAt: "desc" }, take: 200 }),
    prisma.workerConsultation.findMany({ where: { organizationId }, orderBy: { heldAt: "desc" }, take: 100 }),
    prisma.occupationalIncident.findMany({ where: { organizationId }, orderBy: { occurredAt: "desc" }, take: 200 }),
    prisma.safetyInspection.findMany({ where: { organizationId }, orderBy: { inspectedAt: "desc" }, take: 100 }),
    prisma.pPEItem.findMany({ where: { organizationId }, include: { _count: { select: { assignments: true } } }, orderBy: { code: "asc" } }),
    prisma.pPEAssignment.findMany({ where: { organizationId }, include: { ppeItem: { select: { code: true, name: true } } }, orderBy: { deliveredAt: "desc" }, take: 200 }),
    prisma.permitToWork.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emergencyDrill.findMany({ where: { organizationId }, orderBy: { drillDate: "desc" }, take: 50 }),
    canSeeSensitive ? prisma.occupationalHealthSurveillance.count({ where: { organizationId } }) : Promise.resolve(null),
    prisma.contractorSafetyAssessment.findMany({ where: { organizationId }, orderBy: { code: "asc" }, take: 100 }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    prisma.occupationalIncident.count({ where: { organizationId, occurredAt: { gte: periodStart }, type: "ACCIDENT" } }),
    prisma.occupationalIncident.count({ where: { organizationId, occurredAt: { gte: periodStart }, type: "ACCIDENT", lostDays: { gt: 0 } } }),
    prisma.occupationalIncident.count({ where: { organizationId, occurredAt: { gte: periodStart }, type: "NEAR_MISS" } }),
    prisma.occupationalIncident.aggregate({ where: { organizationId, occurredAt: { gte: periodStart } }, _sum: { lostDays: true } }),
    prisma.safetyInspection.count({ where: { organizationId, inspectedAt: { gte: periodStart } } }),
    prisma.occupationalIncident.count({ where: { organizationId, dueDate: { lt: now }, status: { notIn: ["EFFECTIVENESS_VERIFIED", "CLOSED"] } } }),
  ]);

  const indicators = computeSafetyIndicators({
    accidentsWithLostTime: accidentsLostTime, totalAccidents: accidents, lostDays: lostDaysAgg._sum.lostDays ?? 0,
    nearMisses, inspections: inspectionsInYear, overdueActions: overdue, hoursWorked,
  });

  const byStatus = Object.fromEntries(INCIDENT_FLOW.map((s) => [s, 0])) as Record<string, number>;
  for (const i of incidents) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

  return {
    canManage: auth.can("safety:create"),
    canUpdate: auth.can("safety:update"),
    canSeeSensitive,
    canSensitiveCreate: auth.can("safety-sensitive:create"),
    canSensitiveUpdate: auth.can("safety-sensitive:update"),
    canSensitiveDelete: auth.can("safety-sensitive:delete"),
    members,
    indicators,
    hazards: hazards.map((h) => { const a = h.assessments[0]; return { ...h, assessment: a ?? null, inherentLevel: a?.inherentLevel ?? null, residualLevel: a?.residualLevel ?? null, acceptability: a?.acceptability ?? null }; }),
    assessments: assessments.map((a) => ({ ...a })),
    consultations: consultations.map((c) => ({ ...c })),
    incidents: incidents.map((i) => ({ ...i })),
    incidentFlow: INCIDENT_FLOW,
    incidentsByStatus: byStatus,
    inspections: inspections.map((i) => ({ ...i })),
    ppeItems: ppeItems.map((p) => ({ ...p, assignments: p._count.assignments })),
    ppeAssignments: ppeAssignments.map((a) => ({ ...a })),
    permits: permits.map((p) => ({ ...p })),
    drills: drills.map((d) => ({ ...d })),
    contractors: contractors.map((c) => ({ ...c })),
    summary: {
      hazards: hazards.length,
      criticalRisks: hazards.filter((h) => { const a = h.assessments[0]; return a && (a.residualLevel === "HIGH" || a.residualLevel === "CRITICAL" || a.acceptability === "NOT_ACCEPTABLE"); }).length,
      openIncidents: incidents.filter((i) => i.status !== "CLOSED").length,
      nearMisses,
      permits: permits.filter((p) => p.status === "ACTIVE").length,
      overdueActions: overdue,
      surveillance: surveillanceCount,
    },
  };
}

/**
 * Sensitive: health/medical surveillance data about named workers.
 * Requires `safety-sensitive:read` — never folded into `getSafetyPayload`.
 * Decrypts `exposure`/`protocol`/`restrictions` on read.
 */
export async function getHealthSurveillancePayload() {
  const auth = await requireAuthorization("safety-sensitive:read");
  const organizationId = auth.ctx.organization.id;

  const rows = await prisma.occupationalHealthSurveillance.findMany({
    where: { organizationId },
    orderBy: { nextReviewDate: "asc" },
    take: 200,
  });

  return {
    canManage: auth.can("safety-sensitive:create"),
    canUpdate: auth.can("safety-sensitive:update"),
    canDelete: auth.can("safety-sensitive:delete"),
    records: rows.map((s) => ({
      id: s.id, code: s.code, workerName: s.workerName, personnelId: s.personnelId, positionId: s.positionId,
      exposure: decryptHealthField(s.exposure), protocol: decryptHealthField(s.protocol),
      fitness: s.fitness, restrictions: decryptHealthField(s.restrictions),
      examinedAt: s.examinedAt, nextReviewDate: s.nextReviewDate,
    })),
  };
}
