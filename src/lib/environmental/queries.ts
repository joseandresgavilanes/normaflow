import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { complianceState } from "@/lib/environmental/compliance";

export type EnvironmentPayload = Awaited<ReturnType<typeof getEnvironmentPayload>>;

/** Live payload for the /app/environment module (ISO 14001). */
export async function getEnvironmentPayload() {
  const auth = await requireAuthorization("environment:read");
  const ctx = auth.ctx;
  const organizationId = ctx.organization.id;
  const now = new Date();

  const [aspects, methods, obligations, objectives, metrics, waste, emergencies, biodiversity, members] = await Promise.all([
    prisma.environmentalAspect.findMany({ where: { organizationId }, include: { impacts: { orderBy: { score: "desc" } } }, orderBy: { code: "asc" } }),
    prisma.environmentalSignificanceMethod.findMany({ where: { organizationId }, orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
    prisma.environmentalComplianceObligation.findMany({ where: { organizationId }, include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } }, orderBy: { reviewDate: "asc" } }),
    prisma.environmentalObjective.findMany({ where: { organizationId }, include: { programs: true }, orderBy: { code: "asc" } }),
    prisma.environmentalMetric.findMany({ where: { organizationId }, orderBy: { period: "asc" } }),
    prisma.wasteStream.findMany({ where: { organizationId }, orderBy: [{ classification: "desc" }, { code: "asc" }] }),
    prisma.environmentalEmergencyScenario.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.environmentalBiodiversityRecord.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
  ]);

  const impactCount = aspects.reduce((n, a) => n + a.impacts.length, 0);
  const significantCount = aspects.reduce((n, a) => n + a.impacts.filter((i) => i.significant).length, 0);

  const obligationRows = obligations.map((o) => {
    const latest = o.evaluations[0] ?? null;
    const state = complianceState(o.reviewDate, latest?.evaluatedAt ?? null, latest?.result ?? null, now);
    return {
      id: o.id, code: o.code, source: o.source, obligation: o.obligation, jurisdiction: o.jurisdiction,
      applicability: o.applicability, responsibleId: o.responsibleId, reviewDate: o.reviewDate, reviewFrequencyMonths: o.reviewFrequencyMonths, evidenceId: o.evidenceId, documentId: o.documentId,
      lastResult: latest?.result ?? null, lastEvaluatedAt: latest?.evaluatedAt ?? null,
      overdue: state.overdue, nonCompliant: state.nonCompliant, neverEvaluated: state.neverEvaluated,
    };
  });

  // Environmental indicator trends (per-period totals across processes/locations).
  const byPeriod = new Map<string, { period: string; water: number; energy: number; fuel: number; emissions: number; discharges: number; waste: number; rawMaterials: number }>();
  for (const m of metrics) {
    const row = byPeriod.get(m.period) ?? { period: m.period, water: 0, energy: 0, fuel: 0, emissions: 0, discharges: 0, waste: 0, rawMaterials: 0 };
    row.water += m.water ?? 0; row.energy += m.energy ?? 0; row.fuel += m.fuel ?? 0;
    row.emissions += m.emissions ?? 0; row.discharges += m.discharges ?? 0; row.waste += m.waste ?? 0; row.rawMaterials += m.rawMaterials ?? 0;
    byPeriod.set(m.period, row);
  }

  return {
    canManage: auth.can("environment:create"),
    canUpdate: auth.can("environment:update"),
    canDelete: auth.can("environment:delete"),
    members,
    aspects: aspects.map((a) => ({
      id: a.id, code: a.code, activity: a.activity, productService: a.productService, condition: a.condition,
      lifeCycleStage: a.lifeCycleStage, responsibleId: a.responsibleId, processId: a.processId, description: a.description,
      impacts: a.impacts.map((i) => ({ id: i.id, aspectId: i.aspectId, impactType: i.impactType, description: i.description, severity: i.severity, frequency: i.frequency, scope: i.scope, existingControl: i.existingControl, controlEffectiveness: i.controlEffectiveness, score: i.score, level: i.level, significant: i.significant, riskId: i.riskId, controlId: i.controlId })),
    })),
    methods: methods.map((m) => ({ id: m.id, name: m.name, version: m.version, formula: m.formula, threshold: m.threshold, active: m.active, approvedAt: m.approvedAt })),
    obligations: obligationRows,
    objectives: objectives.map((o) => ({ id: o.id, code: o.code, objective: o.objective, baseline: o.baseline, target: o.target, indicatorId: o.indicatorId, responsibleId: o.responsibleId, resources: o.resources, status: o.status, progress: o.progress, dueDate: o.dueDate, programs: o.programs.map((p) => ({ id: p.id, objectiveId: p.objectiveId, name: p.name, activities: p.activities, responsibleId: p.responsibleId, budget: p.budget, progress: p.progress, status: p.status, startDate: p.startDate, dueDate: p.dueDate, evidenceId: p.evidenceId })) })),
    trends: [...byPeriod.values()],
    waste: waste.map((w) => ({ id: w.id, code: w.code, wasteType: w.wasteType, classification: w.classification, quantity: w.quantity, unit: w.unit, period: w.period, storage: w.storage, disposition: w.disposition, managerName: w.managerName, manifest: w.manifest, processId: w.processId })),
    emergencies: emergencies.map((e) => ({ id: e.id, code: e.code, scenario: e.scenario, impact: e.impact, controls: e.controls, responsePlan: e.responsePlan, lastDrillAt: e.lastDrillAt, nextDrillAt: e.nextDrillAt, drillResults: e.drillResults, responsibleId: e.responsibleId, documentId: e.documentId })),
    biodiversity: biodiversity.map((b) => ({
      id: b.id, code: b.code, site: b.site, ecosystemType: b.ecosystemType, protectedArea: b.protectedArea,
      protectedAreaName: b.protectedAreaName, speciesOrHabitat: b.speciesOrHabitat, status: b.status,
      monitoringFrequency: b.monitoringFrequency, responsibleId: b.responsibleId, processId: b.processId, evidenceId: b.evidenceId,
      impactDescription: b.impactDescription, mitigationMeasures: b.mitigationMeasures,
      lastMonitoredAt: b.lastMonitoredAt, nextMonitoringAt: b.nextMonitoringAt,
    })),
    summary: {
      aspects: aspects.length, impacts: impactCount, significant: significantCount,
      obligations: obligations.length, overdue: obligationRows.filter((o) => o.overdue).length,
      nonCompliant: obligationRows.filter((o) => o.nonCompliant).length,
      objectives: objectives.length, waste: waste.length, emergencies: emergencies.length,
      biodiversity: biodiversity.length, metrics: metrics.length, measuredPeriods: byPeriod.size,
    },
  };
}
