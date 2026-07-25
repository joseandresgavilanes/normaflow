"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  associatedEmissions,
  energyCost,
  evaluateEnergyFormula,
  isSignificantEnergyUse,
  normalizeConsumption,
  readFormulaConfig,
} from "@/lib/energy/formulas";
import { assertEnergyReviewApproval, assertEnergyReviewTransition } from "@/lib/energy/review";
import type { EnergyFormulaKind, EnergyReviewStatus } from "@prisma/client";

const MODULE = "energy";
const revalidate = () => {
  revalidatePath("/app/energy");
  revalidatePath("/app/activity");
};

async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "locationId" | "documentId" | "evidenceId" | "indicatorId" | "capaId" | "supplierId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.locationId) guard(prisma.location.findFirst(w(refs.locationId)), "de sede");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.indicatorId) guard(prisma.indicator.findFirst(w(refs.indicatorId)), "de indicador");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

const formulaKind = z.enum([
  "CONSUMPTION", "INTENSITY", "BASELINE_COMPARISON", "DEVIATION",
  "ABSOLUTE_SAVINGS", "NORMALIZED_SAVINGS", "COST", "EMISSIONS", "CUSTOM",
]);

// ─── Sources / uses ──────────────────────────────────

const sourceSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  sourceType: z.enum(["ELECTRICITY", "NATURAL_GAS", "DIESEL", "LPG", "FUEL_OIL", "STEAM", "DISTRICT_HEATING", "DISTRICT_COOLING", "SOLAR", "WIND", "BIOMASS", "OTHER"]).default("ELECTRICITY"),
  unit: z.string().max(40).default("kWh"),
  emissionFactor: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  renewableShare: z.number().min(0).max(100).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createEnergySource(input: z.infer<typeof sourceSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = sourceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId });
  const code = data.code ?? await nextCode("FUE", prisma.energySource.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energySource.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_source" } });
  revalidate();
  return created;
}

const useSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceId: z.string().optional(),
  processId: z.string().optional(),
  locationId: z.string().optional(),
  equipment: z.string().max(200).optional(),
  annualEstimate: z.number().min(0).optional(),
  unit: z.string().max(40).default("kWh"),
});

export async function createEnergyUse(input: z.infer<typeof useSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = useSchema.parse(input);
  if (data.sourceId) {
    const src = await prisma.energySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }) });
    if (!src) throw new Error("Fuente de energía no encontrada.");
  }
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, locationId: data.locationId });
  const code = data.code ?? await nextCode("USO", prisma.energyUse.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyUse.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_use" } });
  revalidate();
  return created;
}

// ─── Energy review + SEU ─────────────────────────────

const reviewSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  scope: z.string().max(2000).optional(),
  methodSummary: z.string().max(4000).optional(),
  findings: z.string().max(8000).optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createEnergyReview(input: z.infer<typeof reviewSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = reviewSchema.parse(input);
  if (new Date(data.periodEnd) < new Date(data.periodStart)) {
    throw new Error("El periodo de la revisión energética es inválido.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("REV", prisma.energyReview.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyReview.create({
    data: tenantData(ctx, {
      code, title: data.title, scope: data.scope, methodSummary: data.methodSummary, findings: data.findings,
      periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_review" } });
  revalidate();
  return created;
}

export async function transitionEnergyReview(id: string, to: EnergyReviewStatus) {
  const needsApprove = to === "APPROVED";
  const ctx = await requirePermission(needsApprove ? "energy:approve" : "energy:update");
  const row = await prisma.energyReview.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Revisión energética no encontrada.");
  assertEnergyReviewTransition(row.status, to);
  if (needsApprove) assertEnergyReviewApproval({ approvedById: ctx.user.id });
  const now = new Date();
  await prisma.energyReview.update({
    where: { id },
    data: {
      status: to,
      ...(to === "UNDER_REVIEW" ? { reviewedById: ctx.user.id, reviewedAt: now } : {}),
      ...(to === "APPROVED" ? { approvedById: ctx.user.id, approvedAt: now } : {}),
    },
  });
  await logAuditEvent({
    ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: to }, extra: { event: "transition_energy_review" },
  });
  revalidate();
  return { id, status: to };
}

const seuSchema = z.object({
  code: z.string().max(40).optional(),
  energyUseId: z.string().min(1),
  reviewId: z.string().optional(),
  criteria: z.any().optional(),
  consumptionShare: z.number().min(0).max(100).optional(),
  improvementPotential: z.number().min(0).max(100).optional(),
  significant: z.boolean().optional(),
  rationale: z.string().max(2000).optional(),
  ownerId: z.string().optional(),
});

export async function createSignificantEnergyUse(input: z.infer<typeof seuSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = seuSchema.parse(input);
  const use = await prisma.energyUse.findFirst({ where: tenantWhere(ctx, { id: data.energyUseId }) });
  if (!use) throw new Error("Uso de energía no encontrado.");
  if (data.reviewId) {
    const review = await prisma.energyReview.findFirst({ where: tenantWhere(ctx, { id: data.reviewId }) });
    if (!review) throw new Error("Revisión energética no encontrada.");
  }
  const significant = data.significant ?? isSignificantEnergyUse({
    consumptionShare: data.consumptionShare, improvementPotential: data.improvementPotential,
  });
  const code = data.code ?? await nextCode("SEU", prisma.significantEnergyUse.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.significantEnergyUse.create({
    data: tenantData(ctx, {
      code, energyUseId: data.energyUseId, reviewId: data.reviewId ?? null,
      criteria: data.criteria ?? undefined, consumptionShare: data.consumptionShare,
      improvementPotential: data.improvementPotential, significant, rationale: data.rationale,
      ownerId: data.ownerId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, significant }, extra: { event: "create_seu" } });
  revalidate();
  return created;
}

// ─── Baseline + EnPI (versioned formulas) ────────────

const baselineSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  seuId: z.string().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  consumption: z.number().min(0),
  unit: z.string().max(40).default("kWh"),
  relevantVariableValues: z.record(z.number()).optional(),
  staticFactorValues: z.record(z.number()).optional(),
  normalizationMethod: z.enum(["NONE", "RATIO", "LINEAR", "CUSTOM"]).default("NONE"),
  formulaVersion: z.string().max(40).optional(),
  formulaConfig: z.record(z.any()).optional(),
  documentId: z.string().optional(),
});

export async function createEnergyBaseline(input: z.infer<typeof baselineSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = baselineSchema.parse(input);
  if (data.seuId) {
    const seu = await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: data.seuId }) });
    if (!seu) throw new Error("Uso significativo de energía no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("BL", prisma.energyBaseline.count({ where: { organizationId: ctx.organization.id } }));
  const prior = await prisma.energyBaseline.findMany({
    where: tenantWhere(ctx, { code }),
    select: { formulaVersion: true },
  });
  const formulaVersion = data.formulaVersion
    ?? String(prior.reduce((max, v) => Math.max(max, Number(v.formulaVersion) || 0), 0) + 1);

  const config = {
    ...(data.formulaConfig ?? {}),
    normalizationMethod: data.normalizationMethod,
  };
  const normalizedConsumption = normalizeConsumption(data.consumption, readFormulaConfig(config), {
    consumption: data.consumption,
    relevantVariables: data.relevantVariableValues,
    staticFactors: data.staticFactorValues,
  });

  const created = await prisma.$transaction(async (tx) => {
    await tx.energyBaseline.updateMany({
      where: { organizationId: ctx.organization.id, code, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });
    return tx.energyBaseline.create({
      data: tenantData(ctx, {
        code, title: data.title, seuId: data.seuId ?? null,
        periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
        consumption: data.consumption, unit: data.unit,
        relevantVariableValues: data.relevantVariableValues ?? undefined,
        staticFactorValues: data.staticFactorValues ?? undefined,
        normalizationMethod: data.normalizationMethod, formulaVersion, formulaConfig: config,
        normalizedConsumption, status: "ACTIVE",
        approvedById: ctx.user.id, approvedAt: new Date(),
        documentId: data.documentId ?? null, createdById: ctx.user.id,
      }),
    });
  });

  await logAuditEvent({
    ctx, action: "create", module: MODULE, recordId: created.id,
    after: { code, formulaVersion }, extra: { event: "create_energy_baseline" },
  });
  revalidate();
  return created;
}

const enpiSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  seuId: z.string().optional(),
  baselineId: z.string().optional(),
  formulaKind: formulaKind.default("INTENSITY"),
  formulaVersion: z.string().max(40).optional(),
  formulaConfig: z.record(z.any()).optional(),
  unit: z.string().max(40).default("kWh/unit"),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  baselineValue: z.number().optional(),
  indicatorId: z.string().optional(),
});

export async function createOrVersionEnpi(input: z.infer<typeof enpiSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = enpiSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { indicatorId: data.indicatorId });
  if (data.seuId) {
    const seu = await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: data.seuId }) });
    if (!seu) throw new Error("SEU no encontrado.");
  }
  if (data.baselineId) {
    const bl = await prisma.energyBaseline.findFirst({ where: tenantWhere(ctx, { id: data.baselineId }) });
    if (!bl) throw new Error("Línea base no encontrada.");
  }

  const code = data.code ?? await nextCode("EnPI", prisma.energyPerformanceIndicator.count({ where: { organizationId: ctx.organization.id } }));
  const prior = await prisma.energyPerformanceIndicator.findMany({
    where: tenantWhere(ctx, { code }),
    select: { formulaVersion: true },
  });
  const formulaVersion = data.formulaVersion
    ?? String(prior.reduce((max, v) => Math.max(max, Number(v.formulaVersion) || 0), 0) + 1);

  let deviationPercent: number | null = null;
  let currentValue = data.currentValue ?? null;
  if (typeof data.currentValue === "number" && typeof data.baselineValue === "number") {
    try {
      const result = evaluateEnergyFormula(
        data.formulaKind as EnergyFormulaKind,
        data.formulaConfig,
        { consumption: data.currentValue, baselineConsumption: data.baselineValue, ...(data.formulaConfig as object) },
        formulaVersion,
      );
      if (data.formulaKind === "DEVIATION" || data.formulaKind === "BASELINE_COMPARISON") {
        deviationPercent = result.value;
      } else if (data.baselineValue) {
        deviationPercent = evaluateEnergyFormula("DEVIATION", {}, {
          consumption: data.currentValue, expectedConsumption: data.baselineValue,
        }).value;
      }
      if (data.formulaKind === "INTENSITY" || data.formulaKind === "CUSTOM") {
        currentValue = result.value;
      }
    } catch {
      /* leave raw values when inputs are incomplete */
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.energyPerformanceIndicator.updateMany({
      where: { organizationId: ctx.organization.id, code, active: true },
      data: { active: false, superseded: true },
    });
    return tx.energyPerformanceIndicator.create({
      data: tenantData(ctx, {
        code, name: data.name, description: data.description,
        seuId: data.seuId ?? null, baselineId: data.baselineId ?? null,
        formulaKind: data.formulaKind, formulaVersion,
        formulaConfig: data.formulaConfig ?? undefined,
        unit: data.unit, targetValue: data.targetValue, currentValue,
        baselineValue: data.baselineValue, deviationPercent,
        indicatorId: data.indicatorId ?? null, active: true, superseded: false,
        approvedById: ctx.user.id, approvedAt: new Date(), createdById: ctx.user.id,
      }),
    });
  });

  await logAuditEvent({
    ctx, action: "create", module: MODULE, recordId: created.id,
    after: { code, formulaVersion, formulaKind: data.formulaKind },
    extra: { event: "create_or_version_enpi" },
  });
  revalidate();
  return created;
}

// ─── Meters / readings ───────────────────────────────

const meterSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  sourceId: z.string().optional(),
  seuId: z.string().optional(),
  locationId: z.string().optional(),
  serialNumber: z.string().max(80).optional(),
  unit: z.string().max(40).default("kWh"),
  calibrationDate: z.string().optional(),
  nextCalibration: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createEnergyMeter(input: z.infer<typeof meterSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = meterSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId });
  const code = data.code ?? await nextCode("MED", prisma.energyMeter.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyMeter.create({
    data: tenantData(ctx, {
      code, name: data.name, sourceId: data.sourceId ?? null, seuId: data.seuId ?? null,
      locationId: data.locationId ?? null, serialNumber: data.serialNumber, unit: data.unit,
      calibrationDate: data.calibrationDate ? new Date(data.calibrationDate) : null,
      nextCalibration: data.nextCalibration ? new Date(data.nextCalibration) : null,
      notes: data.notes, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_meter" } });
  revalidate();
  return created;
}

const readingSchema = z.object({
  code: z.string().max(40).optional(),
  meterId: z.string().min(1),
  readingAt: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  value: z.number(),
  unit: z.string().max(40).optional(),
  estimated: z.boolean().default(false),
  relevantVariableValues: z.record(z.number()).optional(),
  notes: z.string().max(2000).optional(),
});

export async function recordEnergyReading(input: z.infer<typeof readingSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = readingSchema.parse(input);
  const meter = await prisma.energyMeter.findFirst({
    where: tenantWhere(ctx, { id: data.meterId }),
    include: { source: true },
  });
  if (!meter) throw new Error("Medidor no encontrado.");

  const cost = meter.source?.costPerUnit != null ? energyCost(data.value, meter.source.costPerUnit) : null;
  const emissions = meter.source?.emissionFactor != null
    ? associatedEmissions(data.value, meter.source.emissionFactor)
    : null;

  const code = data.code ?? await nextCode("LEC", prisma.energyReading.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyReading.create({
    data: tenantData(ctx, {
      code, meterId: data.meterId,
      readingAt: data.readingAt ? new Date(data.readingAt) : new Date(),
      periodStart: data.periodStart ? new Date(data.periodStart) : null,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
      value: data.value, unit: data.unit ?? meter.unit, estimated: data.estimated,
      relevantVariableValues: data.relevantVariableValues ?? undefined,
      cost, emissions, notes: data.notes, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, value: data.value }, extra: { event: "record_energy_reading" } });
  revalidate();
  return created;
}

// ─── Variables / static factors ───────────────────────

export async function createRelevantVariable(input: {
  code?: string; name: string; unit: string; description?: string;
  variableType?: "PRODUCTION" | "OCCUPANCY" | "DEGREE_DAYS" | "OPERATING_HOURS" | "THROUGHPUT" | "WEATHER" | "OTHER";
}) {
  const ctx = await requirePermission("energy:create");
  const code = input.code ?? await nextCode("VAR", prisma.relevantVariable.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.relevantVariable.create({
    data: tenantData(ctx, {
      code, name: input.name, unit: input.unit, description: input.description,
      variableType: input.variableType ?? "PRODUCTION", createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createStaticFactor(input: {
  code?: string; name: string; value: number; unit: string; description?: string;
  effectiveFrom?: string; effectiveTo?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const code = input.code ?? await nextCode("FAC", prisma.staticFactor.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.staticFactor.create({
    data: tenantData(ctx, {
      code, name: input.name, value: input.value, unit: input.unit, description: input.description,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

// ─── Opportunities / actions / verification ──────────

export async function createEnergyOpportunity(input: {
  code?: string; title: string; description?: string; seuId?: string;
  estimatedSaving?: number; estimatedCost?: number; paybackMonths?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; ownerId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const code = input.code ?? await nextCode("OPO", prisma.energyOpportunity.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyOpportunity.create({
    data: tenantData(ctx, {
      code, title: input.title, description: input.description, seuId: input.seuId ?? null,
      estimatedSaving: input.estimatedSaving, estimatedCost: input.estimatedCost,
      paybackMonths: input.paybackMonths, priority: input.priority ?? "MEDIUM",
      ownerId: input.ownerId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_opportunity" } });
  revalidate();
  return created;
}

export async function createEnergyActionPlan(input: {
  code?: string; title: string; description?: string; opportunityId?: string;
  ownerId?: string; startDate?: string; dueDate?: string; capaId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  await assertRefInOrg(ctx.organization.id, { capaId: input.capaId });
  const code = input.code ?? await nextCode("PAE", prisma.energyActionPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyActionPlan.create({
    data: tenantData(ctx, {
      code, title: input.title, description: input.description,
      opportunityId: input.opportunityId ?? null, ownerId: input.ownerId ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      capaId: input.capaId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_action_plan" } });
  revalidate();
  return created;
}

export async function updateEnergyActionProgress(id: string, progressPercent: number, status?: "PLANNED" | "IN_PROGRESS" | "DELAYED" | "COMPLETED" | "CANCELLED") {
  const ctx = await requirePermission("energy:update");
  const row = await prisma.energyActionPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Plan de acción energética no encontrado.");
  const progress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const nextStatus = status ?? (progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : row.status);
  await prisma.energyActionPlan.update({
    where: { id },
    data: {
      progressPercent: progress, status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null,
    },
  });
  revalidate();
  return { id, progressPercent: progress, status: nextStatus };
}

const verificationSchema = z.object({
  code: z.string().max(40).optional(),
  actionPlanId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  baselineConsumption: z.number().min(0),
  actualConsumption: z.number().min(0),
  unit: z.string().max(40).default("kWh"),
  formulaKind: formulaKind.default("ABSOLUTE_SAVINGS"),
  formulaVersion: z.string().max(40).optional(),
  formulaConfig: z.record(z.any()).optional(),
  relevantVariableValues: z.record(z.number()).optional(),
  staticFactorValues: z.record(z.number()).optional(),
  emissionFactor: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  evidenceId: z.string().optional(),
});

export async function createEnergySavingVerification(input: z.infer<typeof verificationSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = verificationSchema.parse(input);
  const plan = await prisma.energyActionPlan.findFirst({ where: tenantWhere(ctx, { id: data.actionPlanId }) });
  if (!plan) throw new Error("Plan de acción no encontrado.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });

  const config = { ...(data.formulaConfig ?? {}), emissionFactor: data.emissionFactor, costPerUnit: data.costPerUnit };
  const absolute = evaluateEnergyFormula("ABSOLUTE_SAVINGS", config, {
    consumption: data.actualConsumption, baselineConsumption: data.baselineConsumption,
  });
  let normalized: number | null = null;
  try {
    normalized = evaluateEnergyFormula("NORMALIZED_SAVINGS", {
      ...config, normalizationMethod: readFormulaConfig(config).normalizationMethod ?? "RATIO",
    }, {
      consumption: data.actualConsumption,
      baselineConsumption: data.baselineConsumption,
      relevantVariables: data.relevantVariableValues,
      staticFactors: data.staticFactorValues,
    }).value;
  } catch {
    normalized = null;
  }
  const costSaving = data.costPerUnit != null ? energyCost(absolute.value, data.costPerUnit) : null;
  const emissionSaving = data.emissionFactor != null ? associatedEmissions(absolute.value, data.emissionFactor) : null;

  const code = data.code ?? await nextCode("VER", prisma.energySavingVerification.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energySavingVerification.create({
    data: tenantData(ctx, {
      code, actionPlanId: data.actionPlanId,
      periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
      baselineConsumption: data.baselineConsumption, actualConsumption: data.actualConsumption,
      absoluteSaving: absolute.value, normalizedSaving: normalized, unit: data.unit,
      costSaving, emissionSaving,
      formulaKind: data.formulaKind, formulaVersion: data.formulaVersion ?? "1",
      formulaConfig: config, status: "CALCULATED", notes: data.notes,
      evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({
    ctx, action: "create", module: MODULE, recordId: created.id,
    after: { code, absoluteSaving: absolute.value, normalizedSaving: normalized },
    extra: { event: "create_energy_saving_verification" },
  });
  revalidate();
  return created;
}

export async function verifyEnergySaving(id: string) {
  const ctx = await requirePermission("energy:approve");
  const row = await prisma.energySavingVerification.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Verificación de ahorro no encontrada.");
  if (row.status === "VERIFIED") throw new Error("La verificación ya está cerrada.");
  await prisma.energySavingVerification.update({
    where: { id },
    data: { status: "VERIFIED", verifiedById: ctx.user.id, verifiedAt: new Date() },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, after: { status: "VERIFIED" }, extra: { event: "verify_energy_saving" } });
  revalidate();
  return { id, status: "VERIFIED" as const };
}

// ─── Procurement / design ────────────────────────────

export async function createEnergyProcurementEvaluation(input: {
  code?: string; title: string; sourceType?: "ELECTRICITY" | "NATURAL_GAS" | "DIESEL" | "OTHER";
  supplierId?: string; supplierName?: string; period?: string;
  criteriaScores?: Record<string, number>; recommendation?: string; documentId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  await assertRefInOrg(ctx.organization.id, { supplierId: input.supplierId, documentId: input.documentId });
  const scores = input.criteriaScores ?? {};
  const values = Object.values(scores);
  const totalScore = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const code = input.code ?? await nextCode("COM", prisma.energyProcurementEvaluation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyProcurementEvaluation.create({
    data: tenantData(ctx, {
      code, title: input.title, sourceType: input.sourceType ?? "ELECTRICITY",
      supplierId: input.supplierId ?? null, supplierName: input.supplierName,
      period: input.period, criteriaScores: scores, totalScore,
      recommendation: input.recommendation, documentId: input.documentId ?? null,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createEnergyDesignReview(input: {
  code?: string; title: string; projectReference?: string; processId?: string; locationId?: string;
  description?: string; energyConsiderations?: string; opportunitiesIdentified?: string;
  documentId?: string; evidenceId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  await assertRefInOrg(ctx.organization.id, {
    processId: input.processId, locationId: input.locationId,
    documentId: input.documentId, evidenceId: input.evidenceId,
  });
  const code = input.code ?? await nextCode("DIS", prisma.energyDesignReview.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.energyDesignReview.create({
    data: tenantData(ctx, {
      code, title: input.title, projectReference: input.projectReference,
      processId: input.processId ?? null, locationId: input.locationId ?? null,
      description: input.description, energyConsiderations: input.energyConsiderations,
      opportunitiesIdentified: input.opportunitiesIdentified,
      documentId: input.documentId ?? null, evidenceId: input.evidenceId ?? null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_energy_design_review" } });
  revalidate();
  return created;
}
