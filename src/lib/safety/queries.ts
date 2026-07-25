import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { computeSafetyIndicators } from "@/lib/safety/indicators";
import { INCIDENT_FLOW } from "@/lib/safety/incident-workflow";

export type SafetyPayload = Awaited<ReturnType<typeof getSafetyPayload>>;

/** Live payload for the /app/safety module (ISO 45001). `hoursWorked` scopes the rate indices. */
export async function getSafetyPayload(hoursWorked = 0) {
  const auth = await requireAuthorization("safety:read");
  const organizationId = auth.ctx.organization.id;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), 0, 1);

  const [hazards, incidents, inspections, ppeItems, permits, drills, surveillance, contractors, members,
    accidents, accidentsLostTime, nearMisses, lostDaysAgg, inspectionsInYear, overdue] = await Promise.all([
    prisma.occupationalHazard.findMany({ where: { organizationId }, include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } }, orderBy: { code: "asc" } }),
    prisma.occupationalIncident.findMany({ where: { organizationId }, orderBy: { occurredAt: "desc" }, take: 200 }),
    prisma.safetyInspection.findMany({ where: { organizationId }, orderBy: { inspectedAt: "desc" }, take: 100 }),
    prisma.pPEItem.findMany({ where: { organizationId }, include: { _count: { select: { assignments: true } } }, orderBy: { code: "asc" } }),
    prisma.permitToWork.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emergencyDrill.findMany({ where: { organizationId }, orderBy: { drillDate: "desc" }, take: 50 }),
    prisma.occupationalHealthSurveillance.findMany({ where: { organizationId }, orderBy: { nextReviewDate: "asc" }, take: 100 }),
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
    members,
    indicators,
    hazards: hazards.map((h) => { const a = h.assessments[0]; return { id: h.id, code: h.code, activity: h.activity, task: h.task, hazard: h.hazard, category: h.category, exposedWorkers: h.exposedWorkers, inherentLevel: a?.inherentLevel ?? null, residualLevel: a?.residualLevel ?? null, acceptability: a?.acceptability ?? null }; }),
    incidents: incidents.map((i) => ({ id: i.id, code: i.code, type: i.type, severity: i.severity, title: i.title, occurredAt: i.occurredAt, status: i.status, lostDays: i.lostDays, responsibleId: i.responsibleId })),
    incidentFlow: INCIDENT_FLOW,
    incidentsByStatus: byStatus,
    inspections: inspections.map((i) => ({ id: i.id, code: i.code, type: i.type, area: i.area, inspectedAt: i.inspectedAt, findings: i.findings })),
    ppeItems: ppeItems.map((p) => ({ id: p.id, code: p.code, name: p.name, ppeType: p.ppeType, technicalStandard: p.technicalStandard, lifespanMonths: p.lifespanMonths, assignments: p._count.assignments })),
    permits: permits.map((p) => ({ id: p.id, code: p.code, workType: p.workType, area: p.area, status: p.status, validTo: p.validTo })),
    drills: drills.map((d) => ({ id: d.id, code: d.code, scenario: d.scenario, outcome: d.outcome, responseTimeMinutes: d.responseTimeMinutes, drillDate: d.drillDate })),
    surveillance: surveillance.map((s) => ({ id: s.id, code: s.code, workerName: s.workerName, fitness: s.fitness, nextReviewDate: s.nextReviewDate })),
    contractors: contractors.map((c) => ({ id: c.id, code: c.code, contractorName: c.contractorName, outcome: c.outcome, incidents: c.incidents, nextReviewDate: c.nextReviewDate })),
    summary: {
      hazards: hazards.length,
      criticalRisks: hazards.filter((h) => { const a = h.assessments[0]; return a && (a.residualLevel === "HIGH" || a.residualLevel === "CRITICAL" || a.acceptability === "NOT_ACCEPTABLE"); }).length,
      openIncidents: incidents.filter((i) => i.status !== "CLOSED").length,
      nearMisses,
      permits: permits.filter((p) => p.status === "ACTIVE").length,
      overdueActions: overdue,
    },
  };
}
