"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { assertHazardAssessmentApproval, decideControlMeasure, scoreHazard } from "@/lib/food-safety/hazard";
import { assertLimitDefinition, isWithinCriticalLimits } from "@/lib/food-safety/monitoring";
import { lotsAffectedByRecall, runTraceabilityTest, type TraceLotNode } from "@/lib/food-safety/traceability";
import type {
  DeviationStatus,
  FoodAssessmentStatus,
  FoodEmergencyStatus,
  FoodFlowStatus,
  RecallStatus,
} from "@prisma/client";

const MODULE = "food-safety";
const revalidate = () => {
  revalidatePath("/app/food-safety");
  revalidatePath("/app/activity");
};

async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "locationId" | "documentId" | "evidenceId" | "capaId" | "supplierId",
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
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

/** Best-effort in-app + email notification; never blocks the business action. */
async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[food-safety] notify failed:", e instanceof Error ? e.message : e); }
}

// ─── Products / materials / allergens / intended use ───

const productSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  category: z.string().max(120).optional(),
  shelfLifeDays: z.number().int().min(0).optional(),
  storageConditions: z.string().max(500).optional(),
  allergenCodes: z.array(z.string()).default([]),
  processId: z.string().optional(),
  documentId: z.string().optional(),
});

export async function createFoodProduct(input: z.infer<typeof productSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = productSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId });
  const code = data.code ?? await nextCode("PROD", prisma.foodProduct.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.foodProduct.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_food_product" } });
    return row;
  });
  revalidate();
  return created;
}

const materialSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  supplierId: z.string().optional(),
  specification: z.string().max(4000).optional(),
  allergenCodes: z.array(z.string()).default([]),
  storageConditions: z.string().max(500).optional(),
  documentId: z.string().optional(),
});

export async function createRawMaterial(input: z.infer<typeof materialSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = materialSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, documentId: data.documentId });
  const code = data.code ?? await nextCode("MP", prisma.rawMaterial.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.rawMaterial.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_raw_material" } });
    return row;
  });
  revalidate();
  return created;
}

const allergenSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
});

export async function createAllergen(input: z.infer<typeof allergenSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = allergenSchema.parse(input);
  const code = data.code ?? await nextCode("ALR", prisma.allergen.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.allergen.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_allergen" } });
    return row;
  });
  revalidate();
  return created;
}

const intendedUseSchema = z.object({
  code: z.string().max(40).optional(),
  productId: z.string().min(1),
  consumerGroup: z.string().max(200).optional(),
  preparationMethod: z.string().max(2000).optional(),
  vulnerableConsumers: z.boolean().default(false),
  misusePotential: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createIntendedUse(input: z.infer<typeof intendedUseSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = intendedUseSchema.parse(input);
  const product = await prisma.foodProduct.findFirst({ where: tenantWhere(ctx, { id: data.productId }) });
  if (!product) throw new Error("Producto alimentario no encontrado.");
  const code = data.code ?? await nextCode("USO", prisma.intendedUse.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.intendedUse.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_intended_use" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Process flow / steps ───

const flowSchema = z.object({
  code: z.string().max(40).optional(),
  productId: z.string().min(1),
  title: z.string().min(1).max(200),
  version: z.string().max(20).default("1"),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createProcessFlow(input: z.infer<typeof flowSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = flowSchema.parse(input);
  const product = await prisma.foodProduct.findFirst({ where: tenantWhere(ctx, { id: data.productId }) });
  if (!product) throw new Error("Producto alimentario no encontrado.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("FLU", prisma.processFlow.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.processFlow.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_process_flow" } });
    return row;
  });
  revalidate();
  return created;
}

export async function transitionProcessFlow(id: string, to: FoodFlowStatus) {
  const needsApprove = to === "APPROVED";
  const ctx = await requirePermission(needsApprove ? "food-safety:approve" : "food-safety:update");
  const row = await prisma.processFlow.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Diagrama de flujo no encontrado.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.processFlow.update({
      where: { id },
      data: {
        status: to,
        ...(to === "APPROVED" ? { verifiedOnSite: row.verifiedOnSite || true, verifiedAt: row.verifiedAt ?? now, verifiedById: row.verifiedById ?? ctx.user.id } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_process_flow" },
    });
  });
  revalidate();
  return { id, status: to };
}

const stepSchema = z.object({
  code: z.string().max(40).optional(),
  flowId: z.string().min(1),
  sequence: z.number().int().min(1),
  name: z.string().min(1).max(200),
  stepType: z.enum(["RECEIPT", "STORAGE", "PREP", "PROCESS", "COOKING", "COOLING", "PACKAGING", "DISTRIBUTION", "OTHER"]).default("PROCESS"),
  description: z.string().max(4000).optional(),
  processId: z.string().optional(),
  temperature: z.string().max(120).optional(),
  timeParam: z.string().max(120).optional(),
});

export async function createProcessStep(input: z.infer<typeof stepSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = stepSchema.parse(input);
  const flow = await prisma.processFlow.findFirst({ where: tenantWhere(ctx, { id: data.flowId }) });
  if (!flow) throw new Error("Diagrama de flujo no encontrado.");
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode("PAS", prisma.processStep.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.processStep.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_process_step" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Hazards / assessments ───

const hazardSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  hazardType: z.enum(["BIOLOGICAL", "CHEMICAL", "PHYSICAL", "ALLERGEN"]).default("BIOLOGICAL"),
  description: z.string().max(4000).optional(),
  source: z.string().max(500).optional(),
});

export async function createFoodHazard(input: z.infer<typeof hazardSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = hazardSchema.parse(input);
  const code = data.code ?? await nextCode("PEL", prisma.foodHazard.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.foodHazard.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_food_hazard" } });
    return row;
  });
  revalidate();
  return created;
}

const assessmentSchema = z.object({
  code: z.string().max(40).optional(),
  hazardId: z.string().min(1),
  stepId: z.string().optional(),
  productId: z.string().optional(),
  severity: z.number().int().min(1).max(5),
  likelihood: z.number().int().min(1).max(5),
  controlAtStep: z.boolean().optional(),
  criticalAndMeasurable: z.boolean().optional(),
  essentialOperational: z.boolean().optional(),
  controlDecision: z.enum(["NONE", "PRP", "OPRP", "CCP"]).optional(),
  justification: z.string().max(4000).optional(),
  existingMeasures: z.string().max(4000).optional(),
});

export async function createHazardAssessment(input: z.infer<typeof assessmentSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = assessmentSchema.parse(input);
  const hazard = await prisma.foodHazard.findFirst({ where: tenantWhere(ctx, { id: data.hazardId }) });
  if (!hazard) throw new Error("Peligro alimentario no encontrado.");
  if (data.stepId) {
    const step = await prisma.processStep.findFirst({ where: tenantWhere(ctx, { id: data.stepId }) });
    if (!step) throw new Error("Paso de proceso no encontrado.");
  }
  const { score, significant } = scoreHazard({ severity: data.severity, likelihood: data.likelihood });
  const controlDecision = data.controlDecision ?? decideControlMeasure({
    significant,
    controlAtStep: data.controlAtStep,
    criticalAndMeasurable: data.criticalAndMeasurable,
    essentialOperational: data.essentialOperational,
  });
  const code = data.code ?? await nextCode("EVA", prisma.hazardAssessment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hazardAssessment.create({
      data: tenantData(ctx, {
        code,
        hazardId: data.hazardId,
        stepId: data.stepId ?? null,
        productId: data.productId ?? null,
        severity: data.severity,
        likelihood: data.likelihood,
        score,
        significant,
        controlDecision,
        justification: data.justification,
        existingMeasures: data.existingMeasures,
        assessedById: ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, score, controlDecision }, extra: { event: "create_hazard_assessment" } });
    return row;
  });
  revalidate();
  return created;
}

export async function approveHazardAssessment(id: string) {
  const ctx = await requirePermission("food-safety:approve");
  const row = await prisma.hazardAssessment.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Evaluación de peligro no encontrada.");
  assertHazardAssessmentApproval({ assessedById: row.assessedById ?? ctx.user.id });
  const to: FoodAssessmentStatus = "APPROVED";
  await prisma.$transaction(async (tx) => {
    await tx.hazardAssessment.update({
      where: { id },
      data: { status: to, assessedById: row.assessedById ?? ctx.user.id, assessedAt: new Date() },
    });
    await writeAuditLog(tx, {
      ctx, action: "approve", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "approve_hazard_assessment" },
    });
  });
  revalidate();
  return { id, status: to };
}

// ─── PRP / OPRP / CCP / limits ───

const prpSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(["HYGIENE", "PEST_CONTROL", "WATER", "CLEANING", "MAINTENANCE", "PERSONNEL", "SUPPLIER", "WASTE", "ALLERGEN_CONTROL", "OTHER"]).default("OTHER"),
  description: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  frequency: z.string().max(200).optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createPrerequisiteProgram(input: z.infer<typeof prpSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = prpSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("PRP", prisma.prerequisiteProgram.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.prerequisiteProgram.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_prp" } });
    return row;
  });
  if (data.responsibleId && data.responsibleId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `PRP asignado: ${created.code}`, body: `Es responsable del PRP "${created.name}".`, type: "INFO", link: "/app/food-safety", idempotencyKey: `prp:${created.id}:owner` });
  }
  revalidate();
  return created;
}

const oprpSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  hazardAssessmentId: z.string().optional(),
  stepId: z.string().optional(),
  description: z.string().max(4000).optional(),
  monitoringMethod: z.string().max(2000).optional(),
  monitoringFrequency: z.string().max(200).optional(),
  correctionAction: z.string().max(2000).optional(),
  responsibleId: z.string().optional(),
  documentId: z.string().optional(),
});

export async function createOperationalPrp(input: z.infer<typeof oprpSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = oprpSchema.parse(input);
  if (data.hazardAssessmentId) {
    const ha = await prisma.hazardAssessment.findFirst({ where: tenantWhere(ctx, { id: data.hazardAssessmentId }) });
    if (!ha) throw new Error("Evaluación de peligro no encontrada.");
  }
  if (data.stepId) {
    const step = await prisma.processStep.findFirst({ where: tenantWhere(ctx, { id: data.stepId }) });
    if (!step) throw new Error("Paso de proceso no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("OPRP", prisma.operationalPRP.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.operationalPRP.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_oprp" } });
    return row;
  });
  if (data.responsibleId && data.responsibleId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `OPRP asignado: ${created.code}`, body: `Es responsable del OPRP "${created.name}".`, type: "INFO", link: "/app/food-safety", idempotencyKey: `oprp:${created.id}:owner` });
  }
  revalidate();
  return created;
}

const ccpSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  stepId: z.string().min(1),
  hazardAssessmentId: z.string().optional(),
  justification: z.string().max(4000).optional(),
  hazardControlled: z.string().max(500).optional(),
});

export async function createCriticalControlPoint(input: z.infer<typeof ccpSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = ccpSchema.parse(input);
  const step = await prisma.processStep.findFirst({ where: tenantWhere(ctx, { id: data.stepId }) });
  if (!step) throw new Error("Paso de proceso no encontrado.");
  if (data.hazardAssessmentId) {
    const ha = await prisma.hazardAssessment.findFirst({ where: tenantWhere(ctx, { id: data.hazardAssessmentId }) });
    if (!ha) throw new Error("Evaluación de peligro no encontrada.");
  }
  const code = data.code ?? await nextCode("CCP", prisma.criticalControlPoint.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.criticalControlPoint.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_ccp" } });
    return row;
  });
  revalidate();
  return created;
}

const limitSchema = z.object({
  code: z.string().max(40).optional(),
  ccpId: z.string().min(1),
  parameter: z.string().min(1).max(120),
  operator: z.enum(["LT", "LTE", "GT", "GTE", "EQ", "BETWEEN"]).default("BETWEEN"),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(40).optional(),
  rationale: z.string().max(2000).optional(),
});

export async function createCriticalLimit(input: z.infer<typeof limitSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = limitSchema.parse(input);
  assertLimitDefinition(data);
  const ccp = await prisma.criticalControlPoint.findFirst({ where: tenantWhere(ctx, { id: data.ccpId }) });
  if (!ccp) throw new Error("PCC no encontrado.");
  const code = data.code ?? await nextCode("LIM", prisma.criticalLimit.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.criticalLimit.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_critical_limit" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Monitoring ───

const planSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  ccpId: z.string().optional(),
  oprpId: z.string().optional(),
  method: z.string().max(2000).optional(),
  frequency: z.string().max(200).optional(),
  responsibleId: z.string().optional(),
  parameter: z.string().max(120).optional(),
});

export async function createMonitoringPlan(input: z.infer<typeof planSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = planSchema.parse(input);
  if (!data.ccpId && !data.oprpId) throw new Error("El plan de monitoreo debe vincularse a un PCC o a un PPRO.");
  if (data.ccpId) {
    const ccp = await prisma.criticalControlPoint.findFirst({ where: tenantWhere(ctx, { id: data.ccpId }) });
    if (!ccp) throw new Error("PCC no encontrado.");
  }
  if (data.oprpId) {
    const oprp = await prisma.operationalPRP.findFirst({ where: tenantWhere(ctx, { id: data.oprpId }) });
    if (!oprp) throw new Error("PPRO no encontrado.");
  }
  const code = data.code ?? await nextCode("MON", prisma.monitoringPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.monitoringPlan.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_monitoring_plan" } });
    return row;
  });
  if (data.responsibleId && data.responsibleId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `Plan de monitoreo asignado: ${created.code}`, body: `Es responsable del plan "${created.title}".`, type: "INFO", link: "/app/food-safety", idempotencyKey: `monitoring-plan:${created.id}:owner` });
  }
  revalidate();
  return created;
}

const recordSchema = z.object({
  code: z.string().max(40).optional(),
  planId: z.string().min(1),
  recordedAt: z.string().optional(),
  valueNumeric: z.number().optional(),
  valueText: z.string().max(500).optional(),
  unit: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  evidenceId: z.string().optional(),
  autoOpenDeviation: z.boolean().default(true),
});

export async function createMonitoringRecord(input: z.infer<typeof recordSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = recordSchema.parse(input);
  const plan = await prisma.monitoringPlan.findFirst({
    where: tenantWhere(ctx, { id: data.planId }),
    include: { ccp: { include: { limits: true } } },
  });
  if (!plan) throw new Error("Plan de monitoreo no encontrado.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });

  let withinLimits = true;
  if (typeof data.valueNumeric === "number" && plan.ccp?.limits.length) {
    withinLimits = plan.ccp.limits.every((lim) => isWithinCriticalLimits(data.valueNumeric!, lim));
  }

  const code = data.code ?? await nextCode("REG", prisma.monitoringRecord.count({ where: { organizationId: ctx.organization.id } }));
  const devCode = !withinLimits && data.autoOpenDeviation && plan.ccpId
    ? await nextCode("DES", prisma.deviation.count({ where: { organizationId: ctx.organization.id } }))
    : null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.monitoringRecord.create({
      data: tenantData(ctx, {
        code,
        planId: data.planId,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
        valueNumeric: data.valueNumeric,
        valueText: data.valueText,
        unit: data.unit,
        withinLimits,
        notes: data.notes,
        evidenceId: data.evidenceId ?? null,
        recordedById: ctx.user.id,
      }),
    });

    if (devCode && plan.ccpId) {
      await tx.deviation.create({
        data: tenantData(ctx, {
          code: devCode,
          title: `Desviación de límite crítico — ${plan.ccp?.code ?? plan.code}`,
          description: `Monitoreo ${code} fuera de límites (valor: ${data.valueNumeric}).`,
          ccpId: plan.ccpId,
          monitoringRecordId: row.id,
          severity: "MAJOR",
          productHold: true,
          createdById: ctx.user.id,
        }),
      });
    }

    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id,
      after: { code, withinLimits, deviationOpened: devCode }, extra: { event: "create_monitoring_record" },
    });
    return row;
  });
  revalidate();
  return created;
}

// ─── Deviations / corrections ───

const deviationSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  ccpId: z.string().optional(),
  monitoringRecordId: z.string().optional(),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]).default("MODERATE"),
  productHold: z.boolean().default(false),
  lotCodes: z.array(z.string()).default([]),
  capaId: z.string().optional(),
});

export async function createDeviation(input: z.infer<typeof deviationSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = deviationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId });
  const code = data.code ?? await nextCode("DES", prisma.deviation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deviation.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_deviation" } });
    return row;
  });
  revalidate();
  return created;
}

export async function transitionDeviation(id: string, to: DeviationStatus) {
  const ctx = await requirePermission("food-safety:update");
  const row = await prisma.deviation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Desviación no encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.deviation.update({
      where: { id },
      data: { status: to, ...(to === "CLOSED" || to === "VERIFIED" ? { closedAt: new Date() } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_deviation" },
    });
  });
  revalidate();
  return { id, status: to };
}

const correctionSchema = z.object({
  code: z.string().max(40).optional(),
  deviationId: z.string().min(1),
  actionTaken: z.string().min(1).max(4000),
  completedAt: z.string().optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createFoodSafetyCorrection(input: z.infer<typeof correctionSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = correctionSchema.parse(input);
  const deviation = await prisma.deviation.findFirst({ where: tenantWhere(ctx, { id: data.deviationId }) });
  if (!deviation) throw new Error("Desviación no encontrada.");
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("COR", prisma.foodSafetyCorrection.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.foodSafetyCorrection.create({
      data: tenantData(ctx, {
        code,
        deviationId: data.deviationId,
        actionTaken: data.actionTaken,
        completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
        capaId: data.capaId ?? null,
        evidenceId: data.evidenceId ?? null,
        createdById: ctx.user.id,
      }),
    });
    if (deviation.status === "OPEN") {
      await tx.deviation.update({ where: { id: deviation.id }, data: { status: "UNDER_CORRECTION" } });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_food_safety_correction" } });
    return row;
  });
  revalidate();
  return created;
}

export async function verifyFoodSafetyCorrection(id: string, effective: boolean) {
  const ctx = await requirePermission("food-safety:approve");
  const row = await prisma.foodSafetyCorrection.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Corrección no encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.foodSafetyCorrection.update({
      where: { id },
      data: { effective, verifiedById: ctx.user.id, verifiedAt: new Date() },
    });
    if (effective) {
      await tx.deviation.update({
        where: { id: row.deviationId },
        data: { status: "VERIFIED", closedAt: new Date() },
      });
    }
    await writeAuditLog(tx, {
      ctx, action: "approve", module: MODULE, recordId: id,
      after: { effective }, extra: { event: "verify_food_safety_correction" },
    });
  });
  revalidate();
  return { id, effective };
}

// ─── Validation / verification ───

const validationSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  targetType: z.enum(["CCP", "OPRP", "PRP", "PROCESS", "OTHER"]).default("CCP"),
  targetCode: z.string().max(40).optional(),
  method: z.string().max(4000).optional(),
  result: z.enum(["PENDING", "VALID", "INVALID", "CONDITIONAL"]).default("PENDING"),
  findings: z.string().max(8000).optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createValidationRecord(input: z.infer<typeof validationSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = validationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("VAL", prisma.validationRecord.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.validationRecord.create({
      data: tenantData(ctx, {
        ...data,
        code,
        validatedAt: data.result !== "PENDING" ? new Date() : null,
        validatedById: data.result !== "PENDING" ? ctx.user.id : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_validation_record" } });
    return row;
  });
  revalidate();
  return created;
}

const verificationSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  activityType: z.enum(["INTERNAL_AUDIT", "RECORD_REVIEW", "CALIBRATION_CHECK", "SAMPLING", "SUPPLIER_AUDIT", "OTHER"]).default("INTERNAL_AUDIT"),
  scheduledFor: z.string().optional(),
  result: z.enum(["PENDING", "CONFORMING", "NONCONFORMING", "PARTIAL"]).default("PENDING"),
  findings: z.string().max(8000).optional(),
  responsibleId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createVerificationActivity(input: z.infer<typeof verificationSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = verificationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("VER", prisma.verificationActivity.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.verificationActivity.create({
      data: tenantData(ctx, {
        code,
        title: data.title,
        activityType: data.activityType,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        completedAt: data.result !== "PENDING" ? new Date() : null,
        result: data.result,
        findings: data.findings,
        responsibleId: data.responsibleId ?? null,
        documentId: data.documentId ?? null,
        evidenceId: data.evidenceId ?? null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_verification_activity" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Traceability / recall / emergency ───

const lotSchema = z.object({
  code: z.string().max(40).optional(),
  lotType: z.enum(["RAW_MATERIAL", "INTERMEDIATE", "FINISHED", "DISTRIBUTED"]).default("FINISHED"),
  productId: z.string().optional(),
  rawMaterialId: z.string().optional(),
  supplierId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  quantity: z.number().optional(),
  unit: z.string().max(40).optional(),
  producedAt: z.string().optional(),
  receivedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  previousLotIds: z.array(z.string()).default([]),
  processStepCode: z.string().max(40).optional(),
  locationId: z.string().optional(),
  distributionRef: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createTraceabilityLot(input: z.infer<typeof lotSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = lotSchema.parse(input);
  if (data.productId) {
    const p = await prisma.foodProduct.findFirst({ where: tenantWhere(ctx, { id: data.productId }) });
    if (!p) throw new Error("Producto no encontrado.");
  }
  if (data.rawMaterialId) {
    const m = await prisma.rawMaterial.findFirst({ where: tenantWhere(ctx, { id: data.rawMaterialId }) });
    if (!m) throw new Error("Materia prima no encontrada.");
  }
  if (data.previousLotIds.length) {
    const prev = await prisma.traceabilityLot.findMany({
      where: { organizationId: ctx.organization.id, id: { in: data.previousLotIds } },
      select: { id: true },
    });
    if (prev.length !== data.previousLotIds.length) {
      throw new Error("Uno o más lotes previos no pertenecen a la organización.");
    }
  }
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, locationId: data.locationId });
  const code = data.code ?? await nextCode("LOT", prisma.traceabilityLot.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.traceabilityLot.create({
      data: tenantData(ctx, {
        code,
        lotType: data.lotType,
        productId: data.productId ?? null,
        rawMaterialId: data.rawMaterialId ?? null,
        supplierId: data.supplierId ?? null,
        customerName: data.customerName,
        quantity: data.quantity,
        unit: data.unit,
        producedAt: data.producedAt ? new Date(data.producedAt) : null,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        previousLotIds: data.previousLotIds,
        processStepCode: data.processStepCode,
        locationId: data.locationId ?? null,
        distributionRef: data.distributionRef,
        notes: data.notes,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_traceability_lot" } });
    return row;
  });
  revalidate();
  return created;
}

export async function runFoodTraceabilityTest(rootIdOrCode: string) {
  const ctx = await requirePermission("food-safety:read");
  const lots = await prisma.traceabilityLot.findMany({
    where: { organizationId: ctx.organization.id },
    include: { product: { select: { code: true } }, rawMaterial: { select: { code: true } } },
  });
  const nodes: TraceLotNode[] = lots.map((lot) => ({
    id: lot.id,
    code: lot.code,
    lotType: lot.lotType,
    productCode: lot.product?.code,
    rawMaterialCode: lot.rawMaterial?.code,
    supplierId: lot.supplierId,
    customerName: lot.customerName,
    previousLotIds: lot.previousLotIds,
    quantity: lot.quantity,
    unit: lot.unit,
    status: lot.status,
  }));
  const result = runTraceabilityTest({ rootIdOrCode, lots: nodes });
  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      ctx, action: "read", module: MODULE, recordId: rootIdOrCode,
      after: { ok: result.ok, summary: result.summary }, extra: { event: "run_traceability_test" },
    });
  });
  return result;
}

const recallSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(4000),
  recallType: z.enum(["WITHDRAWAL", "RECALL", "STOCK_RECOVERY"]).default("WITHDRAWAL"),
  lotCodes: z.array(z.string()).min(1),
  customersNotified: z.string().max(4000).optional(),
  authorityNotified: z.boolean().default(false),
  quantityAffected: z.number().optional(),
  unit: z.string().max(40).optional(),
  capaId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createWithdrawalRecall(input: z.infer<typeof recallSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = recallSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  const lots = await prisma.traceabilityLot.findMany({ where: { organizationId: ctx.organization.id } });
  const nodes: TraceLotNode[] = lots.map((lot) => ({
    id: lot.id, code: lot.code, lotType: lot.lotType, previousLotIds: lot.previousLotIds,
    supplierId: lot.supplierId, customerName: lot.customerName, quantity: lot.quantity, unit: lot.unit, status: lot.status,
  }));
  const affected = lotsAffectedByRecall(data.lotCodes, nodes);
  const code = data.code ?? await nextCode("RET", prisma.withdrawalRecall.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.withdrawalRecall.create({
      data: tenantData(ctx, {
        ...data,
        code,
        lotCodes: [...new Set([...data.lotCodes, ...affected.map((l) => l.code)])],
        createdById: ctx.user.id,
      }),
    });
    if (affected.length) {
      await tx.traceabilityLot.updateMany({
        where: { organizationId: ctx.organization.id, id: { in: affected.map((l) => l.id) } },
        data: { status: "RECALLED" },
      });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, lots: row.lotCodes.length }, extra: { event: "create_withdrawal_recall" } });
    return row;
  });
  revalidate();
  return created;
}

export async function transitionWithdrawalRecall(id: string, to: RecallStatus) {
  const ctx = await requirePermission("food-safety:update");
  const row = await prisma.withdrawalRecall.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Retiro/recall no encontrado.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.withdrawalRecall.update({
      where: { id },
      data: {
        status: to,
        ...(to === "NOTIFYING" || to === "IN_PROGRESS" ? { notifiedAt: row.notifiedAt ?? now } : {}),
        ...(to === "CLOSED" || to === "COMPLETED" ? { closedAt: now } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_withdrawal_recall" },
    });
  });
  revalidate();
  return { id, status: to };
}

const emergencySchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  emergencyType: z.enum(["CONTAMINATION", "ALLERGEN_INCIDENT", "RECALL_EVENT", "SUPPLY_DISRUPTION", "FACILITY", "OTHER"]).default("OTHER"),
  description: z.string().max(8000).optional(),
  recallId: z.string().optional(),
  capaId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createFoodSafetyEmergency(input: z.infer<typeof emergencySchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = emergencySchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("EME", prisma.foodSafetyEmergency.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.foodSafetyEmergency.create({
      data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_food_safety_emergency" } });
    return row;
  });
  revalidate();
  return created;
}

export async function transitionFoodSafetyEmergency(id: string, to: FoodEmergencyStatus) {
  const ctx = await requirePermission("food-safety:update");
  const row = await prisma.foodSafetyEmergency.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Emergencia de inocuidad no encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.foodSafetyEmergency.update({
      where: { id },
      data: { status: to, ...(to === "CLOSED" ? { closedAt: new Date() } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_food_safety_emergency" },
    });
  });
  revalidate();
  return { id, status: to };
}

// ─── Comunicación de cadena (§7.4) ───────────────────
// Reutiliza el modelo genérico `CommunicationRecord` (ya usado por
// quality-ops) en vez de duplicarlo — solo con permiso propio de
// food-safety, porque quality-ops no es un módulo requerido de este pack.

const chainCommunicationSchema = z.object({
  subject: z.string().min(1).max(300),
  content: z.string().max(8000).optional(),
  party: z.enum(["SUPPLIER", "CUSTOMER", "AUTHORITY", "OTHER"]).default("SUPPLIER"),
  partyName: z.string().max(200).optional(),
  channel: z.string().max(120).optional(),
  relatedCode: z.string().max(120).optional(),
});

const CHAIN_PARTY_LABEL: Record<string, string> = {
  SUPPLIER: "proveedor", CUSTOMER: "cliente", AUTHORITY: "autoridad", OTHER: "otro",
};

export async function recordChainCommunication(input: z.infer<typeof chainCommunicationSchema>) {
  const ctx = await requirePermission("food-safety:create");
  const data = chainCommunicationSchema.parse(input);
  const code = await nextCode("COM", prisma.communicationRecord.count({ where: { organizationId: ctx.organization.id } }));
  const audience = [CHAIN_PARTY_LABEL[data.party], data.partyName].filter(Boolean).join(": ");
  const content = data.relatedCode ? `[${data.relatedCode}] ${data.content ?? ""}`.trim() : data.content ?? null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.communicationRecord.create({
      data: tenantData(ctx, {
        code, subject: data.subject, content, direction: "EXTERNAL",
        audience: audience || null, channel: data.channel ?? null, standards: ["ISO_22000"],
        communicatedById: ctx.user.id, communicatedAt: new Date(), createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, party: data.party }, extra: { event: "record_chain_communication" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

// Configuration records are editable while operational evidence remains append-only.
// Archive is represented by `active = false` so products, hazards, PRP/OPRP, PCC
// and monitoring plans retain their audit history and relationships.
export type FoodSafetyRecordKind = "product" | "material" | "allergen" | "intendedUse" | "flow" | "step" | "hazard" | "assessment" | "prp" | "oprp" | "ccp" | "limit" | "plan" | "emergency";

export async function updateFoodSafetyRecord(id: string, kind: FoodSafetyRecordKind, input: Record<string, unknown>) {
  const ctx = await requirePermission("food-safety:update");
  const activeSchema = z.object({ active: z.boolean().optional() });
  let before: Record<string, unknown> = {};
  let after: Record<string, unknown> = {};
  await prisma.$transaction(async (tx) => {
    if (kind === "product") {
      const data = productSchema.extend({ active: z.boolean().optional() }).partial().parse(input);
      const row = await tx.foodProduct.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Producto alimentario no encontrado.");
      await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId });
      await tx.foodProduct.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "material") {
      const data = materialSchema.extend({ active: z.boolean().optional() }).partial().parse(input);
      const row = await tx.rawMaterial.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Materia prima no encontrada.");
      await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, documentId: data.documentId });
      await tx.rawMaterial.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "allergen") {
      const data = allergenSchema.extend({ active: z.boolean().optional() }).partial().parse(input);
      const row = await tx.allergen.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Alérgeno no encontrado.");
      await tx.allergen.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "intendedUse") {
      const data = intendedUseSchema.partial().parse(input);
      const row = await tx.intendedUse.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Uso previsto no encontrado.");
      if (data.productId && !(await tx.foodProduct.findFirst({ where: tenantWhere(ctx, { id: data.productId }), select: { id: true } }))) throw new Error("Producto alimentario no encontrado.");
      await tx.intendedUse.update({ where: { id }, data: { ...data } }); after = data;
    } else if (kind === "flow") {
      const data = flowSchema.extend({ status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED"]).optional(), verifiedOnSite: z.boolean().optional() }).partial().parse(input);
      const row = await tx.processFlow.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Diagrama de flujo no encontrado.");
      if (data.productId && !(await tx.foodProduct.findFirst({ where: tenantWhere(ctx, { id: data.productId }), select: { id: true } }))) throw new Error("Producto alimentario no encontrado.");
      await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
      if (row.status === "APPROVED" && data.status !== "APPROVED") throw new Error("Un flujo aprobado debe sustituirse con una nueva versión.");
      await tx.processFlow.update({ where: { id }, data: { ...data } }); before = { status: row.status }; after = data;
    } else if (kind === "step") {
      const data = stepSchema.partial().parse(input);
      const row = await tx.processStep.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Etapa de proceso no encontrada.");
      if (data.flowId && !(await tx.processFlow.findFirst({ where: tenantWhere(ctx, { id: data.flowId }), select: { id: true } }))) throw new Error("Diagrama de flujo no encontrado.");
      await assertRefInOrg(ctx.organization.id, { processId: data.processId });
      await tx.processStep.update({ where: { id }, data: { ...data } }); after = data;
    } else if (kind === "hazard") {
      const data = hazardSchema.extend({ active: z.boolean().optional() }).partial().parse(input);
      const row = await tx.foodHazard.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Peligro alimentario no encontrado.");
      await tx.foodHazard.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "assessment") {
      const data = assessmentSchema.partial().parse(input);
      const row = await tx.hazardAssessment.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Evaluación de peligro no encontrada.");
      if (row.status === "APPROVED") throw new Error("Una evaluación aprobada debe conservarse y sustituirse con una nueva evaluación.");
      if (data.hazardId && !(await tx.foodHazard.findFirst({ where: tenantWhere(ctx, { id: data.hazardId }), select: { id: true } }))) throw new Error("Peligro alimentario no encontrado.");
      const score = data.severity !== undefined || data.likelihood !== undefined ? scoreHazard({ severity: data.severity ?? row.severity, likelihood: data.likelihood ?? row.likelihood }) : { score: row.score, significant: row.significant };
      await tx.hazardAssessment.update({ where: { id }, data: { ...data, score: score.score, significant: score.significant } }); before = { status: row.status }; after = { ...data, score: score.score, significant: score.significant };
    } else if (kind === "prp") {
      const data = prpSchema.extend(activeSchema.shape).partial().parse(input);
      const row = await tx.prerequisiteProgram.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("PRP no encontrado.");
      await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
      await tx.prerequisiteProgram.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "oprp") {
      const data = oprpSchema.extend(activeSchema.shape).partial().parse(input);
      const row = await tx.operationalPRP.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("OPRP no encontrado.");
      await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
      await tx.operationalPRP.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "ccp") {
      const data = ccpSchema.extend(activeSchema.shape).partial().parse(input);
      const row = await tx.criticalControlPoint.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("PCC no encontrado.");
      await tx.criticalControlPoint.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "limit") {
      const data = limitSchema.partial().parse(input);
      const row = await tx.criticalLimit.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Límite crítico no encontrado.");
      assertLimitDefinition({ ...row, ...data });
      await tx.criticalLimit.update({ where: { id }, data: { ...data } }); after = data;
    } else if (kind === "plan") {
      const data = planSchema.extend(activeSchema.shape).partial().parse(input);
      const row = await tx.monitoringPlan.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Plan de monitoreo no encontrado.");
      await tx.monitoringPlan.update({ where: { id }, data: { ...data } }); before = { active: row.active }; after = data;
    } else if (kind === "emergency") {
      const data = emergencySchema.partial().parse(input);
      const row = await tx.foodSafetyEmergency.findFirst({ where: tenantWhere(ctx, { id }) }); if (!row) throw new Error("Emergencia de inocuidad no encontrada.");
      await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
      await tx.foodSafetyEmergency.update({ where: { id }, data: { ...data } }); before = { status: row.status }; after = data;
    }
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before, after, extra: { event: "update_food_safety_record", kind } });
  });
  revalidate();
  return { id, kind };
}
