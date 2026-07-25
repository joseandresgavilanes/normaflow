import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { consumptionByPeriod, evaluateEnergyFormula, isSignificantEnergyUse } from "@/lib/energy/formulas";

export type EnergyPayload = Awaited<ReturnType<typeof getEnergyPayload>>;

export async function getEnergyPayload() {
  const auth = await requireAuthorization("energy:read");
  const organizationId = auth.ctx.organization.id;

  const [
    sources, uses, seus, reviews, baselines, enpis, meters, readings,
    variables, factors, opportunities, plans, verifications, procurement, designs, members,
  ] = await Promise.all([
    prisma.energySource.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.energyUse.findMany({
      where: { organizationId },
      include: { source: { select: { code: true, name: true, unit: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.significantEnergyUse.findMany({
      where: { organizationId },
      include: { energyUse: { select: { code: true, name: true, unit: true } }, review: { select: { code: true, title: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.energyReview.findMany({ where: { organizationId }, orderBy: { periodEnd: "desc" } }),
    prisma.energyBaseline.findMany({
      where: { organizationId },
      include: { seu: { select: { code: true } } },
      orderBy: [{ code: "asc" }, { formulaVersion: "desc" }],
    }),
    prisma.energyPerformanceIndicator.findMany({
      where: { organizationId },
      include: { seu: { select: { code: true } }, baseline: { select: { code: true, formulaVersion: true } } },
      orderBy: [{ code: "asc" }, { formulaVersion: "desc" }],
    }),
    prisma.energyMeter.findMany({
      where: { organizationId },
      include: { source: { select: { code: true, name: true } }, _count: { select: { readings: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.energyReading.findMany({
      where: { organizationId },
      include: { meter: { select: { code: true, name: true, unit: true } } },
      orderBy: { readingAt: "desc" },
      take: 200,
    }),
    prisma.relevantVariable.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.staticFactor.findMany({ where: { organizationId, active: true }, orderBy: { code: "asc" } }),
    prisma.energyOpportunity.findMany({
      where: { organizationId },
      include: { seu: { select: { code: true } }, _count: { select: { actionPlans: true } } },
      orderBy: { identifiedAt: "desc" },
    }),
    prisma.energyActionPlan.findMany({
      where: { organizationId },
      include: { opportunity: { select: { code: true, title: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.energySavingVerification.findMany({
      where: { organizationId },
      include: { actionPlan: { select: { code: true, title: true } } },
      orderBy: { periodEnd: "desc" },
    }),
    prisma.energyProcurementEvaluation.findMany({ where: { organizationId }, orderBy: { evaluatedAt: "desc" } }),
    prisma.energyDesignReview.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
  ]);

  const periodConsumption = consumptionByPeriod(readings.map((r) => r.value));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const periodCost = readings.reduce((sum, r) => {
    if (typeof r.cost === "number") return sum + r.cost;
    const meter = meters.find((m) => m.id === r.meterId);
    const src = meter?.sourceId ? sourceById.get(meter.sourceId) : undefined;
    return sum + (src?.costPerUnit ? r.value * src.costPerUnit : 0);
  }, 0);
  const periodEmissions = readings.reduce((sum, r) => {
    if (typeof r.emissions === "number") return sum + r.emissions;
    const meter = meters.find((m) => m.id === r.meterId);
    const src = meter?.sourceId ? sourceById.get(meter.sourceId) : undefined;
    return sum + (src?.emissionFactor ? r.value * src.emissionFactor : 0);
  }, 0);

  const enpiRows = enpis.map((row) => {
    let computed = null as ReturnType<typeof evaluateEnergyFormula> | null;
    try {
      if (typeof row.currentValue === "number") {
        const cfg = row.formulaConfig && typeof row.formulaConfig === "object"
          ? (row.formulaConfig as Record<string, unknown>)
          : {};
        computed = evaluateEnergyFormula(
          row.formulaKind,
          row.formulaConfig,
          {
            consumption: row.currentValue,
            baselineConsumption: row.baselineValue ?? undefined,
            activity: typeof cfg.activity === "number" ? cfg.activity : undefined,
            denominator: typeof cfg.denominator === "number" ? cfg.denominator : undefined,
          },
          row.formulaVersion,
        );
      }
    } catch {
      computed = null;
    }
    return { ...row, computed };
  });

  return {
    can: {
      create: auth.can("energy:create"),
      update: auth.can("energy:update"),
      approve: auth.can("energy:approve") || auth.can("energy:update"),
      export: auth.can("energy:export"),
    },
    members,
    sources,
    uses,
    seus: seus.map((row) => ({
      ...row,
      autoSignificant: isSignificantEnergyUse({
        consumptionShare: row.consumptionShare,
        improvementPotential: row.improvementPotential,
      }),
    })),
    reviews,
    baselines,
    enpis: enpiRows,
    meters,
    readings,
    variables,
    factors,
    opportunities,
    plans,
    verifications,
    procurement,
    designs,
    summary: {
      sources: sources.filter((s) => s.active).length,
      uses: uses.filter((u) => u.active).length,
      significantUses: seus.filter((s) => s.significant).length,
      reviewsOpen: reviews.filter((r) => r.status !== "APPROVED" && r.status !== "SUPERSEDED").length,
      baselines: baselines.filter((b) => b.status === "ACTIVE").length,
      enpisActive: enpis.filter((e) => e.active && !e.superseded).length,
      meters: meters.filter((m) => m.active).length,
      periodConsumption,
      periodCost: Math.round(periodCost * 100) / 100,
      periodEmissions: Math.round(periodEmissions * 100) / 100,
      opportunitiesOpen: opportunities.filter((o) => !["CLOSED", "REJECTED", "VERIFIED"].includes(o.status)).length,
      actionsOpen: plans.filter((p) => p.status === "PLANNED" || p.status === "IN_PROGRESS" || p.status === "DELAYED").length,
      savingsVerified: verifications.filter((v) => v.status === "VERIFIED").length,
      absoluteSavings: verifications
        .filter((v) => typeof v.absoluteSaving === "number")
        .reduce((s, v) => s + (v.absoluteSaving ?? 0), 0),
    },
  };
}
