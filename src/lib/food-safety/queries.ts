import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { scoreHazard } from "@/lib/food-safety/hazard";
import { runTraceabilityTest, type TraceLotNode } from "@/lib/food-safety/traceability";

export type FoodSafetyPayload = Awaited<ReturnType<typeof getFoodSafetyPayload>>;

export async function getFoodSafetyPayload() {
  const auth = await requireAuthorization("food-safety:read");
  const organizationId = auth.ctx.organization.id;

  const [
    products, materials, intendedUses, flows, steps, hazards, assessments,
    prps, oprps, ccps, limits, plans, records, deviations, corrections,
    validations, verifications, lots, recalls, allergens, emergencies, communications, members,
  ] = await Promise.all([
    prisma.foodProduct.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.rawMaterial.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.intendedUse.findMany({
      where: { organizationId },
      include: { product: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.processFlow.findMany({
      where: { organizationId },
      include: { product: { select: { code: true, name: true } }, _count: { select: { steps: true } } },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    prisma.processStep.findMany({
      where: { organizationId },
      include: { flow: { select: { code: true, title: true, version: true } } },
      orderBy: [{ flowId: "asc" }, { sequence: "asc" }],
    }),
    prisma.foodHazard.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.hazardAssessment.findMany({
      where: { organizationId },
      include: {
        hazard: { select: { code: true, name: true, hazardType: true } },
        step: { select: { code: true, name: true, sequence: true } },
      },
      orderBy: { assessedAt: "desc" },
    }),
    prisma.prerequisiteProgram.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.operationalPRP.findMany({
      where: { organizationId },
      include: {
        step: { select: { code: true, name: true } },
        hazardAssessment: { select: { code: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.criticalControlPoint.findMany({
      where: { organizationId },
      include: {
        step: { select: { code: true, name: true } },
        hazardAssessment: { select: { code: true } },
        _count: { select: { limits: true, monitoringPlans: true, deviations: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.criticalLimit.findMany({
      where: { organizationId },
      include: { ccp: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.monitoringPlan.findMany({
      where: { organizationId },
      include: {
        ccp: { select: { code: true, name: true } },
        oprp: { select: { code: true, name: true } },
        _count: { select: { records: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.monitoringRecord.findMany({
      where: { organizationId },
      include: { plan: { select: { code: true, title: true, ccpId: true } } },
      orderBy: { recordedAt: "desc" },
      take: 200,
    }),
    prisma.deviation.findMany({
      where: { organizationId },
      include: {
        ccp: { select: { code: true, name: true } },
        _count: { select: { corrections: true } },
      },
      orderBy: { detectedAt: "desc" },
    }),
    prisma.foodSafetyCorrection.findMany({
      where: { organizationId },
      include: { deviation: { select: { code: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.validationRecord.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.verificationActivity.findMany({ where: { organizationId }, orderBy: { scheduledFor: "desc" } }),
    prisma.traceabilityLot.findMany({
      where: { organizationId },
      include: {
        product: { select: { code: true, name: true } },
        rawMaterial: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.withdrawalRecall.findMany({ where: { organizationId }, orderBy: { initiatedAt: "desc" } }),
    prisma.allergen.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.foodSafetyEmergency.findMany({ where: { organizationId }, orderBy: { activatedAt: "desc" } }),
    prisma.communicationRecord.findMany({
      where: { organizationId, standards: { has: "ISO_22000" } },
      orderBy: { communicatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { organizationId } } },
      select: { id: true, name: true },
    }),
  ]);

  const lotNodes: TraceLotNode[] = lots.map((lot) => ({
    id: lot.id,
    code: lot.code,
    lotType: lot.lotType,
    productCode: lot.product?.code ?? null,
    rawMaterialCode: lot.rawMaterial?.code ?? null,
    supplierId: lot.supplierId,
    customerName: lot.customerName,
    previousLotIds: lot.previousLotIds,
    quantity: lot.quantity,
    unit: lot.unit,
    status: lot.status,
  }));

  let lastTraceTest: ReturnType<typeof runTraceabilityTest> | null = null;
  const finished = lots.find((l) => l.lotType === "FINISHED" || l.lotType === "DISTRIBUTED");
  if (finished) {
    try {
      lastTraceTest = runTraceabilityTest({ rootIdOrCode: finished.id, lots: lotNodes });
    } catch {
      lastTraceTest = null;
    }
  }

  const significantHazards = assessments.filter((a) => a.significant).length;
  const openDeviations = deviations.filter((d) => d.status !== "CLOSED" && d.status !== "VERIFIED").length;
  const outOfLimit = records.filter((r) => !r.withinLimits).length;

  return {
    can: {
      create: auth.can("food-safety:create"),
      update: auth.can("food-safety:update"),
      approve: auth.can("food-safety:approve") || auth.can("food-safety:update"),
      export: auth.can("food-safety:export"),
    },
    members,
    products,
    materials,
    intendedUses,
    flows,
    steps,
    hazards,
    assessments: assessments.map((row) => ({
      ...row,
      recomputed: scoreHazard({ severity: row.severity, likelihood: row.likelihood }),
    })),
    prps,
    oprps,
    ccps,
    limits,
    plans,
    records,
    deviations,
    corrections,
    validations,
    verifications,
    lots,
    recalls,
    allergens,
    emergencies,
    communications,
    lastTraceTest,
    summary: {
      products: products.filter((p) => p.active).length,
      materials: materials.filter((m) => m.active).length,
      flows: flows.filter((f) => f.status === "APPROVED").length,
      hazards: hazards.filter((h) => h.active).length,
      significantHazards,
      prps: prps.filter((p) => p.active).length,
      oprps: oprps.filter((p) => p.active).length,
      ccps: ccps.filter((c) => c.active).length,
      openDeviations,
      outOfLimit,
      lots: lots.length,
      openRecalls: recalls.filter((r) => r.status !== "CLOSED" && r.status !== "COMPLETED").length,
      allergens: allergens.filter((a) => a.active).length,
      openEmergencies: emergencies.filter((e) => e.status !== "CLOSED").length,
      pendingValidations: validations.filter((v) => v.result === "PENDING").length,
      pendingVerifications: verifications.filter((v) => v.result === "PENDING").length,
    },
  };
}
