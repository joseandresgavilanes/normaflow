"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
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

/** Best-effort in-app + email notification; never blocks the business action. */
async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[energy] notify failed:", e instanceof Error ? e.message : e); }
}

const formulaKind = z.enum([
  "CONSUMPTION", "INTENSITY", "BASELINE_COMPARISON", "DEVIATION",
  "ABSOLUTE_SAVINGS", "NORMALIZED_SAVINGS", "COST", "EMISSIONS", "CUSTOM",
]);

// ─── Sources / uses ──────────────────────────────────

const sourceSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(200),
  sourceType: z.enum(["ELECTRICITY", "NATURAL_GAS", "DIESEL", "LPG", "FUEL_OIL", "STEAM", "DISTRICT_HEATING", "DISTRICT_COOLING", "SOLAR", "WIND", "BIOMASS", "OTHER"]).default("ELECTRICITY"),
  unit: z.string().trim().min(1).max(40).default("kWh"),
  emissionFactor: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  renewableShare: z.number().min(0).max(100).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  active: z.boolean().optional(),
});

export async function createEnergySource(input: z.infer<typeof sourceSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = sourceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId });
  const code = data.code ?? await nextCode("FUE", prisma.energySource.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energySource.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_source" } });
    return row;
  });
  revalidate();
  return created;
}

const useSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceId: z.string().optional(),
  processId: z.string().optional(),
  locationId: z.string().optional(),
  equipment: z.string().max(200).optional(),
  annualEstimate: z.number().min(0).optional(),
  unit: z.string().trim().min(1).max(40).default("kWh"),
  active: z.boolean().optional(),
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyUse.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_use" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateEnergySource(id: string, input: Partial<z.infer<typeof sourceSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energySource.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Fuente de energía no encontrada.");
  const data = sourceSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId });
  await prisma.$transaction(async (tx) => {
    await tx.energySource.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.sourceType !== undefined ? { sourceType: data.sourceType } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}), ...(data.emissionFactor !== undefined ? { emissionFactor: data.emissionFactor } : {}),
      ...(data.costPerUnit !== undefined ? { costPerUnit: data.costPerUnit } : {}), ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.renewableShare !== undefined ? { renewableShare: data.renewableShare } : {}), ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}), ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_energy_source" } });
  });
  revalidate();
  return { id };
}

export async function updateEnergyUse(id: string, input: Partial<z.infer<typeof useSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyUse.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Uso de energía no encontrado.");
  const data = useSchema.partial().parse(input);
  if (data.sourceId) {
    const source = await prisma.energySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }), select: { id: true } });
    if (!source) throw new Error("Fuente de energía no encontrada.");
  }
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, locationId: data.locationId });
  await prisma.$transaction(async (tx) => {
    await tx.energyUse.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.sourceId !== undefined ? { sourceId: data.sourceId } : {}), ...(data.processId !== undefined ? { processId: data.processId } : {}),
      ...(data.locationId !== undefined ? { locationId: data.locationId } : {}), ...(data.equipment !== undefined ? { equipment: data.equipment } : {}),
      ...(data.annualEstimate !== undefined ? { annualEstimate: data.annualEstimate } : {}), ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_energy_use" } });
  });
  revalidate();
  return { id };
}

// ─── Energy review + SEU ─────────────────────────────

const reviewSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().trim().min(1).max(200),
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyReview.create({
      data: tenantData(ctx, {
        code, title: data.title, scope: data.scope, methodSummary: data.methodSummary, findings: data.findings,
        periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
        documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_review" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateEnergyReview(id: string, input: Partial<z.infer<typeof reviewSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyReview.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Revisión energética no encontrada.");
  if (existing.status === "APPROVED" || existing.status === "SUPERSEDED") throw new Error("Una revisión aprobada o sustituida no se puede editar.");
  const data = reviewSchema.partial().parse(input);
  const periodStart = data.periodStart ? new Date(data.periodStart) : existing.periodStart;
  const periodEnd = data.periodEnd ? new Date(data.periodEnd) : existing.periodEnd;
  if (periodEnd < periodStart) throw new Error("El periodo de la revisión energética es inválido.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  await prisma.$transaction(async (tx) => {
    await tx.energyReview.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}), ...(data.periodStart !== undefined ? { periodStart } : {}),
      ...(data.periodEnd !== undefined ? { periodEnd } : {}), ...(data.scope !== undefined ? { scope: data.scope } : {}),
      ...(data.methodSummary !== undefined ? { methodSummary: data.methodSummary } : {}), ...(data.findings !== undefined ? { findings: data.findings } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId } : {}), ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_energy_review" } });
  });
  revalidate();
  return { id };
}

export async function transitionEnergyReview(id: string, to: EnergyReviewStatus) {
  const needsApprove = to === "APPROVED";
  const ctx = await requirePermission(needsApprove ? "energy:approve" : "energy:update");
  const row = await prisma.energyReview.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Revisión energética no encontrada.");
  assertEnergyReviewTransition(row.status, to);
  if (needsApprove) assertEnergyReviewApproval({ approvedById: ctx.user.id });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.energyReview.update({
      where: { id },
      data: {
        status: to,
        ...(to === "UNDER_REVIEW" ? { reviewedById: ctx.user.id, reviewedAt: now } : {}),
        ...(to === "APPROVED" ? { approvedById: ctx.user.id, approvedAt: now } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_energy_review" },
    });
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
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "SUPERSEDED"]).optional(),
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.significantEnergyUse.create({
      data: tenantData(ctx, {
        code, energyUseId: data.energyUseId, reviewId: data.reviewId ?? null,
        criteria: data.criteria ?? undefined, consumptionShare: data.consumptionShare,
        improvementPotential: data.improvementPotential, significant, rationale: data.rationale,
        ownerId: data.ownerId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, significant }, extra: { event: "create_seu" } });
    return row;
  });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.ownerId, title: `Uso significativo de energía asignado: ${created.code}`, body: `Es responsable del SEU "${created.code}".`, type: "INFO", link: "/app/energy", idempotencyKey: `seu:${created.id}:owner` });
  }
  revalidate();
  return created;
}

export async function updateSignificantEnergyUse(id: string, input: Partial<z.infer<typeof seuSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Uso significativo de energía no encontrado.");
  const data = seuSchema.partial().parse(input);
  if (data.energyUseId) {
    const use = await prisma.energyUse.findFirst({ where: tenantWhere(ctx, { id: data.energyUseId }), select: { id: true } });
    if (!use) throw new Error("Uso de energía no encontrado.");
  }
  if (data.reviewId) {
    const review = await prisma.energyReview.findFirst({ where: tenantWhere(ctx, { id: data.reviewId }), select: { id: true } });
    if (!review) throw new Error("Revisión energética no encontrada.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.significantEnergyUse.update({ where: { id }, data: {
      ...(data.energyUseId !== undefined ? { energyUseId: data.energyUseId } : {}), ...(data.reviewId !== undefined ? { reviewId: data.reviewId } : {}),
      ...(data.criteria !== undefined ? { criteria: data.criteria } : {}), ...(data.consumptionShare !== undefined ? { consumptionShare: data.consumptionShare } : {}),
      ...(data.improvementPotential !== undefined ? { improvementPotential: data.improvementPotential } : {}), ...(data.significant !== undefined ? { significant: data.significant } : {}),
      ...(data.rationale !== undefined ? { rationale: data.rationale } : {}), ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_seu" } });
  });
  revalidate();
  return { id };
}

// ─── Baseline + EnPI (versioned formulas) ────────────

const baselineSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().trim().min(1).max(200),
  seuId: z.string().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  consumption: z.number().min(0),
  unit: z.string().trim().min(1).max(40).default("kWh"),
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
  if (new Date(data.periodEnd) < new Date(data.periodStart)) throw new Error("El periodo de la línea base es inválido.");
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
    const row = await tx.energyBaseline.create({
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
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id,
      after: { code, formulaVersion }, extra: { event: "create_energy_baseline" },
    });
    return row;
  });
  revalidate();
  return created;
}

const enpiSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  seuId: z.string().optional(),
  baselineId: z.string().optional(),
  formulaKind: formulaKind.default("INTENSITY"),
  formulaVersion: z.string().max(40).optional(),
  formulaConfig: z.record(z.any()).optional(),
  unit: z.string().trim().min(1).max(40).default("kWh/unit"),
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
    const row = await tx.energyPerformanceIndicator.create({
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
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id,
      after: { code, formulaVersion, formulaKind: data.formulaKind },
      extra: { event: "create_or_version_enpi" },
    });
    return row;
  });
  revalidate();
  return created;
}

// ─── Meters / readings ───────────────────────────────

const meterSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(200),
  sourceId: z.string().optional(),
  seuId: z.string().optional(),
  locationId: z.string().optional(),
  serialNumber: z.string().max(80).optional(),
  unit: z.string().trim().min(1).max(40).default("kWh"),
  calibrationDate: z.string().optional(),
  nextCalibration: z.string().optional(),
  notes: z.string().max(2000).optional(),
  active: z.boolean().optional(),
});

export async function createEnergyMeter(input: z.infer<typeof meterSchema>) {
  const ctx = await requirePermission("energy:create");
  const data = meterSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId });
  if (data.sourceId) {
    const source = await prisma.energySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }), select: { id: true } });
    if (!source) throw new Error("Fuente de energía no encontrada.");
  }
  if (data.seuId) {
    const seu = await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: data.seuId }), select: { id: true } });
    if (!seu) throw new Error("SEU no encontrado.");
  }
  const code = data.code ?? await nextCode("MED", prisma.energyMeter.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyMeter.create({
      data: tenantData(ctx, {
        code, name: data.name, sourceId: data.sourceId ?? null, seuId: data.seuId ?? null,
        locationId: data.locationId ?? null, serialNumber: data.serialNumber, unit: data.unit,
        calibrationDate: data.calibrationDate ? new Date(data.calibrationDate) : null,
        nextCalibration: data.nextCalibration ? new Date(data.nextCalibration) : null,
        notes: data.notes, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_meter" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateEnergyMeter(id: string, input: Partial<z.infer<typeof meterSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyMeter.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Medidor no encontrado.");
  const data = meterSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId });
  if (data.sourceId) {
    const source = await prisma.energySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }), select: { id: true } });
    if (!source) throw new Error("Fuente de energía no encontrada.");
  }
  if (data.seuId) {
    const seu = await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: data.seuId }), select: { id: true } });
    if (!seu) throw new Error("SEU no encontrado.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.energyMeter.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.sourceId !== undefined ? { sourceId: data.sourceId } : {}),
      ...(data.seuId !== undefined ? { seuId: data.seuId } : {}), ...(data.locationId !== undefined ? { locationId: data.locationId } : {}),
      ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}), ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.calibrationDate !== undefined ? { calibrationDate: data.calibrationDate ? new Date(data.calibrationDate) : null } : {}),
      ...(data.nextCalibration !== undefined ? { nextCalibration: data.nextCalibration ? new Date(data.nextCalibration) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}), ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_energy_meter" } });
  });
  revalidate();
  return { id };
}

const readingSchema = z.object({
  code: z.string().max(40).optional(),
  meterId: z.string().min(1),
  readingAt: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  value: z.number().finite().min(0),
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyReading.create({
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
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, value: data.value }, extra: { event: "record_energy_reading" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Variables / static factors ───────────────────────

const relevantVariableSchema = z.object({
  code: z.string().max(40).optional(), name: z.string().trim().min(1).max(200), unit: z.string().trim().min(1).max(40),
  description: z.string().max(2000).optional(), variableType: z.enum(["PRODUCTION", "OCCUPANCY", "DEGREE_DAYS", "OPERATING_HOURS", "THROUGHPUT", "WEATHER", "OTHER"]).optional(), active: z.boolean().optional(),
});
const staticFactorSchema = z.object({
  code: z.string().max(40).optional(), name: z.string().trim().min(1).max(200), value: z.number().finite(), unit: z.string().trim().min(1).max(40),
  description: z.string().max(2000).optional(), effectiveFrom: z.string().optional(), effectiveTo: z.string().optional(), active: z.boolean().optional(),
});

export async function createRelevantVariable(input: {
  code?: string; name: string; unit: string; description?: string;
  variableType?: "PRODUCTION" | "OCCUPANCY" | "DEGREE_DAYS" | "OPERATING_HOURS" | "THROUGHPUT" | "WEATHER" | "OTHER";
}) {
  const ctx = await requirePermission("energy:create");
  const data = relevantVariableSchema.parse(input);
  const code = data.code ?? await nextCode("VAR", prisma.relevantVariable.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.relevantVariable.create({
      data: tenantData(ctx, {
        code, name: data.name.trim(), unit: data.unit.trim(), description: data.description,
        variableType: data.variableType ?? "PRODUCTION", createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_relevant_variable" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateRelevantVariable(id: string, input: Partial<z.infer<typeof relevantVariableSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.relevantVariable.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Variable relevante no encontrada.");
  const data = relevantVariableSchema.partial().parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.relevantVariable.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}), ...(data.variableType !== undefined ? { variableType: data.variableType } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_relevant_variable" } });
  });
  revalidate();
  return { id };
}

export async function createStaticFactor(input: {
  code?: string; name: string; value: number; unit: string; description?: string;
  effectiveFrom?: string; effectiveTo?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const data = staticFactorSchema.parse(input);
  const code = data.code ?? await nextCode("FAC", prisma.staticFactor.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.staticFactor.create({
      data: tenantData(ctx, {
        code, name: data.name.trim(), value: data.value, unit: data.unit.trim(), description: data.description,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_static_factor" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateStaticFactor(id: string, input: Partial<z.infer<typeof staticFactorSchema>>) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.staticFactor.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Factor estático no encontrado.");
  const data = staticFactorSchema.partial().parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.staticFactor.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.value !== undefined ? { value: data.value } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}), ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.effectiveFrom !== undefined ? { effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date() } : {}),
      ...(data.effectiveTo !== undefined ? { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null } : {}), ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_static_factor" } });
  });
  revalidate();
  return { id };
}

// ─── Opportunities / actions / verification ──────────

export async function createEnergyOpportunity(input: {
  code?: string; title: string; description?: string; seuId?: string;
  estimatedSaving?: number; estimatedCost?: number; paybackMonths?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; ownerId?: string; documentId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const data = z.object({
    code: z.string().max(40).optional(), title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), seuId: z.string().optional(),
    estimatedSaving: z.number().min(0).optional(), estimatedCost: z.number().min(0).optional(), paybackMonths: z.number().min(0).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), ownerId: z.string().optional(), documentId: z.string().optional(),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  if (data.seuId && !(await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: data.seuId }), select: { id: true } }))) throw new Error("SEU no encontrado.");
  const code = data.code ?? await nextCode("OPO", prisma.energyOpportunity.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyOpportunity.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description, seuId: data.seuId ?? null,
        estimatedSaving: data.estimatedSaving, estimatedCost: data.estimatedCost,
        paybackMonths: data.paybackMonths, priority: data.priority,
        ownerId: data.ownerId ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_opportunity" } });
    return row;
  });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.ownerId, title: `Oportunidad energética asignada: ${created.code}`, body: `Es responsable de "${created.title}".`, type: "INFO", link: "/app/energy", idempotencyKey: `opportunity:${created.id}:owner` });
  }
  revalidate();
  return created;
}

export async function updateEnergyOpportunity(id: string, input: Partial<Parameters<typeof createEnergyOpportunity>[0]> & { status?: "IDENTIFIED" | "UNDER_ANALYSIS" | "APPROVED" | "IN_IMPLEMENTATION" | "VERIFIED" | "REJECTED" | "CLOSED" }) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyOpportunity.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Oportunidad energética no encontrada.");
  await assertRefInOrg(ctx.organization.id, { documentId: input.documentId });
  if (input.seuId && !(await prisma.significantEnergyUse.findFirst({ where: tenantWhere(ctx, { id: input.seuId }), select: { id: true } }))) throw new Error("SEU no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.energyOpportunity.update({ where: { id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.seuId !== undefined ? { seuId: input.seuId } : {}), ...(input.estimatedSaving !== undefined ? { estimatedSaving: input.estimatedSaving } : {}),
      ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}), ...(input.paybackMonths !== undefined ? { paybackMonths: input.paybackMonths } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}), ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}), ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: input, extra: { event: "update_energy_opportunity" } });
  });
  revalidate();
  return { id };
}

export async function createEnergyActionPlan(input: {
  code?: string; title: string; description?: string; opportunityId?: string;
  ownerId?: string; startDate?: string; dueDate?: string; capaId?: string; documentId?: string; evidenceId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const data = z.object({
    code: z.string().max(40).optional(), title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), opportunityId: z.string().optional(),
    ownerId: z.string().optional(), startDate: z.string().optional(), dueDate: z.string().optional(), capaId: z.string().optional(), documentId: z.string().optional(), evidenceId: z.string().optional(),
  }).parse(input);
  if (data.startDate && data.dueDate && new Date(data.dueDate) < new Date(data.startDate)) throw new Error("La fecha de vencimiento no puede ser anterior al inicio.");
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  if (data.opportunityId && !(await prisma.energyOpportunity.findFirst({ where: tenantWhere(ctx, { id: data.opportunityId }), select: { id: true } }))) throw new Error("Oportunidad energética no encontrada.");
  const code = data.code ?? await nextCode("PAE", prisma.energyActionPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyActionPlan.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description,
        opportunityId: data.opportunityId ?? null, ownerId: data.ownerId ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        capaId: data.capaId ?? null, documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_action_plan" } });
    return row;
  });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.ownerId, title: `Plan de acción energética asignado: ${created.code}`, body: `Es responsable de "${created.title}".`, type: "INFO", link: "/app/energy", idempotencyKey: `action-plan:${created.id}:owner` });
  }
  revalidate();
  return created;
}

export async function updateEnergyActionPlan(id: string, input: Partial<Parameters<typeof createEnergyActionPlan>[0]> & { progressPercent?: number; status?: "PLANNED" | "IN_PROGRESS" | "DELAYED" | "COMPLETED" | "CANCELLED" }) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyActionPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Plan de acción energética no encontrado.");
  await assertRefInOrg(ctx.organization.id, { capaId: input.capaId, documentId: input.documentId, evidenceId: input.evidenceId });
  if (input.opportunityId && !(await prisma.energyOpportunity.findFirst({ where: tenantWhere(ctx, { id: input.opportunityId }), select: { id: true } }))) throw new Error("Oportunidad energética no encontrada.");
  const progress = input.progressPercent !== undefined ? Math.max(0, Math.min(100, Math.round(input.progressPercent))) : existing.progressPercent;
  const status = input.status ?? (progress >= 100 ? "COMPLETED" : progress > 0 && existing.status === "PLANNED" ? "IN_PROGRESS" : existing.status);
  await prisma.$transaction(async (tx) => {
    await tx.energyActionPlan.update({ where: { id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}), ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}), ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      progressPercent: progress, status, ...(input.capaId !== undefined ? { capaId: input.capaId } : {}), ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
      ...(input.evidenceId !== undefined ? { evidenceId: input.evidenceId } : {}), completedAt: status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { ...input, progressPercent: progress, status }, extra: { event: "update_energy_action_plan" } });
  });
  revalidate();
  return { id, progressPercent: progress, status };
}

export async function updateEnergyActionProgress(id: string, progressPercent: number, status?: "PLANNED" | "IN_PROGRESS" | "DELAYED" | "COMPLETED" | "CANCELLED") {
  const ctx = await requirePermission("energy:update");
  const row = await prisma.energyActionPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Plan de acción energética no encontrado.");
  const progress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const nextStatus = status ?? (progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : row.status);
  await prisma.$transaction(async (tx) => {
    await tx.energyActionPlan.update({
      where: { id },
      data: {
        progressPercent: progress, status: nextStatus,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { progressPercent: row.progressPercent, status: row.status }, after: { progressPercent: progress, status: nextStatus }, extra: { event: "update_energy_action_progress" } });
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
  if (new Date(data.periodEnd) < new Date(data.periodStart)) throw new Error("El periodo de verificación es inválido.");
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energySavingVerification.create({
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
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id,
      after: { code, absoluteSaving: absolute.value, normalizedSaving: normalized },
      extra: { event: "create_energy_saving_verification" },
    });
    return row;
  });
  revalidate();
  return created;
}

export async function verifyEnergySaving(id: string) {
  const ctx = await requirePermission("energy:approve");
  const row = await prisma.energySavingVerification.findFirst({ where: tenantWhere(ctx, { id }), include: { actionPlan: { select: { code: true, ownerId: true } } } });
  if (!row) throw new Error("Verificación de ahorro no encontrada.");
  if (row.status === "VERIFIED") throw new Error("La verificación ya está cerrada.");
  await prisma.$transaction(async (tx) => {
    await tx.energySavingVerification.update({
      where: { id },
      data: { status: "VERIFIED", verifiedById: ctx.user.id, verifiedAt: new Date() },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, after: { status: "VERIFIED" }, extra: { event: "verify_energy_saving" } });
  });
  if (row.actionPlan.ownerId && row.actionPlan.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: row.actionPlan.ownerId, title: `Ahorro energético verificado: ${row.code}`, body: `El ahorro del plan "${row.actionPlan.code}" quedó verificado.`, type: "SUCCESS", link: "/app/energy", idempotencyKey: `verification:${id}:verified` });
  }
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
  const data = z.object({
    code: z.string().max(40).optional(), title: z.string().trim().min(1).max(200), sourceType: z.enum(["ELECTRICITY", "NATURAL_GAS", "DIESEL", "OTHER"]).default("ELECTRICITY"),
    supplierId: z.string().optional(), supplierName: z.string().max(200).optional(), period: z.string().max(100).optional(), criteriaScores: z.record(z.number()).optional(), recommendation: z.string().max(4000).optional(), documentId: z.string().optional(),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, documentId: data.documentId });
  const scores = data.criteriaScores ?? {};
  const values = Object.values(scores);
  const totalScore = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const code = data.code ?? await nextCode("COM", prisma.energyProcurementEvaluation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyProcurementEvaluation.create({
      data: tenantData(ctx, {
        code, title: data.title, sourceType: data.sourceType,
        supplierId: data.supplierId ?? null, supplierName: data.supplierName,
        period: data.period, criteriaScores: scores, totalScore,
        recommendation: data.recommendation, documentId: data.documentId ?? null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, totalScore }, extra: { event: "create_energy_procurement_evaluation" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateEnergyProcurementEvaluation(id: string, input: Partial<Parameters<typeof createEnergyProcurementEvaluation>[0]> & { result?: "UNDER_REVIEW" | "PREFERRED" | "ACCEPTABLE" | "NOT_RECOMMENDED" | "SELECTED" }) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyProcurementEvaluation.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Evaluación de compra energética no encontrada.");
  await assertRefInOrg(ctx.organization.id, { supplierId: input.supplierId, documentId: input.documentId });
  const scores = input.criteriaScores;
  const totalScore = scores ? (Object.values(scores).length ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length : null) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.energyProcurementEvaluation.update({ where: { id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}), ...(input.supplierName !== undefined ? { supplierName: input.supplierName } : {}),
      ...(input.period !== undefined ? { period: input.period } : {}), ...(scores !== undefined ? { criteriaScores: scores, totalScore } : {}),
      ...(input.recommendation !== undefined ? { recommendation: input.recommendation } : {}), ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
      ...(input.result !== undefined ? { result: input.result } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: input, extra: { event: "update_energy_procurement" } });
  });
  revalidate();
  return { id };
}

export async function createEnergyDesignReview(input: {
  code?: string; title: string; projectReference?: string; processId?: string; locationId?: string;
  description?: string; energyConsiderations?: string; opportunitiesIdentified?: string;
  documentId?: string; evidenceId?: string;
}) {
  const ctx = await requirePermission("energy:create");
  const data = z.object({
    code: z.string().max(40).optional(), title: z.string().trim().min(1).max(200), projectReference: z.string().max(200).optional(), processId: z.string().optional(), locationId: z.string().optional(),
    description: z.string().max(4000).optional(), energyConsiderations: z.string().max(4000).optional(), opportunitiesIdentified: z.string().max(4000).optional(), documentId: z.string().optional(), evidenceId: z.string().optional(),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, {
    processId: data.processId, locationId: data.locationId,
    documentId: data.documentId, evidenceId: data.evidenceId,
  });
  const code = data.code ?? await nextCode("DIS", prisma.energyDesignReview.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.energyDesignReview.create({
      data: tenantData(ctx, {
        code, title: data.title, projectReference: data.projectReference,
        processId: data.processId ?? null, locationId: data.locationId ?? null,
        description: data.description, energyConsiderations: data.energyConsiderations,
        opportunitiesIdentified: data.opportunitiesIdentified,
        documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_energy_design_review" } });
    return row;
  });
  revalidate();
  return created;
}

export async function updateEnergyDesignReview(id: string, input: Partial<Parameters<typeof createEnergyDesignReview>[0]> & { status?: "DRAFT" | "IN_REVIEW" | "APPROVED" | "CHANGES_REQUIRED" | "CLOSED" }) {
  const ctx = await requirePermission("energy:update");
  const existing = await prisma.energyDesignReview.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Revisión de diseño energético no encontrada.");
  await assertRefInOrg(ctx.organization.id, { processId: input.processId, locationId: input.locationId, documentId: input.documentId, evidenceId: input.evidenceId });
  await prisma.$transaction(async (tx) => {
    await tx.energyDesignReview.update({ where: { id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.projectReference !== undefined ? { projectReference: input.projectReference } : {}),
      ...(input.processId !== undefined ? { processId: input.processId } : {}), ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}), ...(input.energyConsiderations !== undefined ? { energyConsiderations: input.energyConsiderations } : {}),
      ...(input.opportunitiesIdentified !== undefined ? { opportunitiesIdentified: input.opportunitiesIdentified } : {}), ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.documentId !== undefined ? { documentId: input.documentId } : {}), ...(input.evidenceId !== undefined ? { evidenceId: input.evidenceId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: input, extra: { event: "update_energy_design_review" } });
  });
  revalidate();
  return { id };
}
