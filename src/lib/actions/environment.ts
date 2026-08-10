"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { computeSignificance } from "@/lib/environmental/significance";
import { notifyUser } from "@/lib/notify";
import type { LiveAppContext } from "@/lib/app-context";

const MODULE = "environment";
const revalidate = () => {
  revalidatePath("/app/environment");
  revalidatePath("/app/activity");
};

/** Verify an optional cross-module reference belongs to the caller's org. */
async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "riskId" | "controlId" | "documentId" | "evidenceId" | "indicatorId" | "auditId" | "capaId" | "supplierId" | "locationId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.riskId) guard(prisma.risk.findFirst(w(refs.riskId)), "de riesgo");
  if (refs.controlId) guard(prisma.control.findFirst(w(refs.controlId)), "de control");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.indicatorId) guard(prisma.indicator.findFirst(w(refs.indicatorId)), "de indicador");
  if (refs.auditId) guard(prisma.audit.findFirst(w(refs.auditId)), "de auditoría");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  if (refs.locationId) guard(prisma.location.findFirst(w(refs.locationId)), "de sede");
  await Promise.all(checks);
}

async function nextCode(ctx: LiveAppContext, prefix: string, count: Promise<number>) {
  const n = (await count) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────
// Significance methods (versioned — methodology history)
// ─────────────────────────────────────────────────────

const methodSchema = z.object({
  name: z.string().min(1).max(160),
  formula: z.enum(["WEIGHTED_SUM", "PRODUCT", "SUM"]).default("WEIGHTED_SUM"),
  weights: z.record(z.number()).optional(),
  threshold: z.number().min(0).default(0),
  version: z.string().max(40).optional(),
  criteria: z.any().optional(),
  approvedById: z.string().optional(),
});

/**
 * Create a new significance method version. Creating a version with an existing
 * `name` supersedes the prior active version (kept as history) and activates the
 * new one. Version defaults to prior + 1.
 */
export async function createSignificanceMethod(input: z.infer<typeof methodSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = methodSchema.parse(input);

  const priorVersions = await prisma.environmentalSignificanceMethod.findMany({
    where: tenantWhere(ctx, { name: data.name }),
    select: { version: true, active: true },
    orderBy: { createdAt: "desc" },
  });
  const version = data.version
    ?? String(priorVersions.reduce((max, v) => Math.max(max, Number(v.version) || 0), 0) + 1);

  const created = await prisma.$transaction(async (tx) => {
    // Deactivate any active version of the same method (methodology supersede).
    await tx.environmentalSignificanceMethod.updateMany({
      where: { organizationId: ctx.organization.id, name: data.name, active: true },
      data: { active: false },
    });
    const method = await tx.environmentalSignificanceMethod.create({
      data: tenantData(ctx, {
        name: data.name,
        formula: data.formula,
        weights: data.weights ?? undefined,
        threshold: data.threshold,
        version,
        criteria: data.criteria ?? undefined,
        active: true,
        approvedById: data.approvedById ?? null,
        approvedAt: data.approvedById ? new Date() : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: method.id, after: { name: data.name, version }, extra: { event: "create_significance_method" } });
    return method;
  });

  revalidate();
  return { id: created.id, version };
}

/** Return the org's active significance method, or null. */
async function activeMethod(ctx: LiveAppContext, methodId?: string | null) {
  if (methodId) {
    return prisma.environmentalSignificanceMethod.findFirst({ where: tenantWhere(ctx, { id: methodId }) });
  }
  return prisma.environmentalSignificanceMethod.findFirst({
    where: tenantWhere(ctx, { active: true }),
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────────────
// Aspects & impacts (matrix + significance evaluation)
// ─────────────────────────────────────────────────────

const aspectSchema = z.object({
  code: z.string().max(40).optional(),
  activity: z.string().min(1).max(400),
  productService: z.string().max(400).optional(),
  condition: z.enum(["NORMAL", "ABNORMAL", "EMERGENCY"]).default("NORMAL"),
  lifeCycleStage: z.string().max(120).optional(),
  responsibleId: z.string().optional(),
  processId: z.string().optional(),
  description: z.string().max(2000).optional(),
});

export async function createAspect(input: z.infer<typeof aspectSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = aspectSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode(ctx, "ASP", prisma.environmentalAspect.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const aspect = await tx.environmentalAspect.create({
      data: tenantData(ctx, {
        code, activity: data.activity, productService: data.productService ?? null,
        condition: data.condition, lifeCycleStage: data.lifeCycleStage ?? null,
        responsibleId: data.responsibleId ?? null, processId: data.processId ?? null,
        description: data.description ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: aspect.id, after: { code, activity: data.activity }, extra: { event: "create_aspect" } });
    return aspect;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateAspect(id: string, input: Partial<z.infer<typeof aspectSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalAspect.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Aspecto no encontrado.");
  const data = aspectSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });

  await prisma.$transaction(async (tx) => {
    await tx.environmentalAspect.update({ where: { id }, data: {
      ...(data.activity !== undefined ? { activity: data.activity } : {}),
      ...(data.productService !== undefined ? { productService: data.productService } : {}),
      ...(data.condition !== undefined ? { condition: data.condition } : {}),
      ...(data.lifeCycleStage !== undefined ? { lifeCycleStage: data.lifeCycleStage } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.processId !== undefined ? { processId: data.processId } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_aspect" } });
  });
  revalidate();
  return { id };
}

export async function deleteAspect(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.environmentalAspect.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Aspecto no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.environmentalAspect.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, extra: { event: "delete_aspect" } });
  });
  revalidate();
  return { id };
}

const impactSchema = z.object({
  aspectId: z.string().min(1),
  methodId: z.string().optional(),
  impactType: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  severity: z.number().int().min(0).max(10).default(1),
  frequency: z.number().int().min(0).max(10).default(1),
  scope: z.number().int().min(0).max(10).default(1),
  existingControl: z.string().max(600).optional(),
  controlEffectiveness: z.number().int().min(0).max(100).optional(),
  riskId: z.string().optional(),
  controlId: z.string().optional(),
});

/** Create an impact; significance is computed from the active/selected method. */
export async function createImpact(input: z.infer<typeof impactSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = impactSchema.parse(input);
  const aspect = await prisma.environmentalAspect.findFirst({ where: tenantWhere(ctx, { id: data.aspectId }), select: { id: true } });
  if (!aspect) throw new Error("El aspecto no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, controlId: data.controlId });

  const method = await activeMethod(ctx, data.methodId);
  const sig = computeSignificance(method, {
    severity: data.severity, frequency: data.frequency, scope: data.scope,
    controlEffectiveness: data.controlEffectiveness,
  });

  const created = await prisma.$transaction(async (tx) => {
    const impact = await tx.environmentalImpact.create({
      data: tenantData(ctx, {
        aspectId: data.aspectId, methodId: method?.id ?? null, impactType: data.impactType,
        description: data.description ?? null, severity: data.severity, frequency: data.frequency,
        scope: data.scope, existingControl: data.existingControl ?? null,
        controlEffectiveness: data.controlEffectiveness ?? null,
        score: sig.score, level: sig.level, significant: sig.significant,
        riskId: data.riskId ?? null, controlId: data.controlId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: impact.id, after: { impactType: data.impactType, score: sig.score, significant: sig.significant }, extra: { event: "create_impact" } });
    return impact;
  });
  revalidate();
  return { id: created.id, score: sig.score, level: sig.level, significant: sig.significant };
}

export async function updateImpact(id: string, input: Partial<z.infer<typeof impactSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalImpact.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Impacto no encontrado.");
  const data = impactSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, controlId: data.controlId });

  const severity = data.severity ?? existing.severity;
  const frequency = data.frequency ?? existing.frequency;
  const scope = data.scope ?? existing.scope;
  const controlEffectiveness = data.controlEffectiveness ?? existing.controlEffectiveness;
  const method = await activeMethod(ctx, data.methodId ?? existing.methodId);
  const sig = computeSignificance(method, { severity, frequency, scope, controlEffectiveness });

  await prisma.$transaction(async (tx) => {
    await tx.environmentalImpact.update({ where: { id }, data: {
      ...(data.impactType !== undefined ? { impactType: data.impactType } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.existingControl !== undefined ? { existingControl: data.existingControl } : {}),
      ...(data.riskId !== undefined ? { riskId: data.riskId } : {}),
      ...(data.controlId !== undefined ? { controlId: data.controlId } : {}),
      severity, frequency, scope, controlEffectiveness,
      methodId: method?.id ?? existing.methodId,
      score: sig.score, level: sig.level, significant: sig.significant,
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { score: sig.score, significant: sig.significant }, extra: { event: "update_impact" } });
  });
  revalidate();
  return { id, score: sig.score, level: sig.level, significant: sig.significant };
}

export async function deleteImpact(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.environmentalImpact.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Impacto no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.environmentalImpact.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, extra: { event: "delete_impact" } });
  });
  revalidate();
  return { id };
}

/** Recompute significance for every impact against the current active method. */
export async function recomputeSignificance(methodId?: string) {
  const ctx = await requirePermission("environment:update");
  const method = await activeMethod(ctx, methodId);
  const impacts = await prisma.environmentalImpact.findMany({ where: tenantWhere(ctx, {}) });

  const changed = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const im of impacts) {
      const sig = computeSignificance(method, { severity: im.severity, frequency: im.frequency, scope: im.scope, controlEffectiveness: im.controlEffectiveness });
      if (sig.score !== im.score || sig.level !== im.level || sig.significant !== im.significant) {
        await tx.environmentalImpact.update({ where: { id: im.id }, data: { score: sig.score, level: sig.level, significant: sig.significant, methodId: method?.id ?? im.methodId } });
        count += 1;
      }
    }
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: method?.id ?? "ACTIVE", after: { recomputed: impacts.length, changed: count }, extra: { event: "recompute_significance" } });
    return count;
  });
  revalidate();
  return { total: impacts.length, changed };
}

// ─────────────────────────────────────────────────────
// Compliance obligations & evaluations
// ─────────────────────────────────────────────────────

const obligationSchema = z.object({
  code: z.string().max(40).optional(),
  source: z.string().min(1).max(300),
  jurisdiction: z.string().max(160).optional(),
  obligation: z.string().min(1).max(2000),
  applicability: z.string().max(600).optional(),
  responsibleId: z.string().optional(),
  reviewDate: z.string().datetime().optional(),
  reviewFrequencyMonths: z.number().int().min(1).max(120).optional(),
  evidenceId: z.string().optional(),
  documentId: z.string().optional(),
});

export async function createObligation(input: z.infer<typeof obligationSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = obligationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, documentId: data.documentId });
  const code = data.code ?? await nextCode(ctx, "OBL", prisma.environmentalComplianceObligation.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const obligation = await tx.environmentalComplianceObligation.create({
      data: tenantData(ctx, {
        code, source: data.source, jurisdiction: data.jurisdiction ?? null, obligation: data.obligation,
        applicability: data.applicability ?? null, responsibleId: data.responsibleId ?? null,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
        reviewFrequencyMonths: data.reviewFrequencyMonths ?? null,
        evidenceId: data.evidenceId ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: obligation.id, after: { code, source: data.source }, extra: { event: "create_obligation" } });
    return obligation;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateObligation(id: string, input: Partial<z.infer<typeof obligationSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalComplianceObligation.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Obligación no encontrada.");
  const data = obligationSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, documentId: data.documentId });

  await prisma.$transaction(async (tx) => {
    await tx.environmentalComplianceObligation.update({ where: { id }, data: {
      ...(data.source !== undefined ? { source: data.source } : {}),
      ...(data.jurisdiction !== undefined ? { jurisdiction: data.jurisdiction } : {}),
      ...(data.obligation !== undefined ? { obligation: data.obligation } : {}),
      ...(data.applicability !== undefined ? { applicability: data.applicability } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.reviewDate !== undefined ? { reviewDate: data.reviewDate ? new Date(data.reviewDate) : null } : {}),
      ...(data.reviewFrequencyMonths !== undefined ? { reviewFrequencyMonths: data.reviewFrequencyMonths } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_obligation" } });
  });
  revalidate();
  return { id };
}

const evaluationSchema = z.object({
  obligationId: z.string().min(1),
  result: z.enum(["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_EVALUATED"]).default("NOT_EVALUATED"),
  evaluatedAt: z.string().datetime().optional(),
  evaluatorId: z.string().optional(),
  evidenceId: z.string().optional(),
  findings: z.string().max(2000).optional(),
  derivedActionId: z.string().optional(),
  /** When true and the review frequency is set, roll the obligation's next review forward. */
  advanceReview: z.boolean().default(true),
});

/** Record a compliance evaluation; optionally advances the obligation's next review date. */
export async function createComplianceEvaluation(input: z.infer<typeof evaluationSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = evaluationSchema.parse(input);
  const obligation = await prisma.environmentalComplianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }) });
  if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, capaId: data.derivedActionId });

  const evaluatedAt = data.evaluatedAt ? new Date(data.evaluatedAt) : new Date();
  const created = await prisma.$transaction(async (tx) => {
    const ev = await tx.environmentalComplianceEvaluation.create({
      data: tenantData(ctx, {
        obligationId: data.obligationId, result: data.result, evaluatedAt,
        evaluatorId: data.evaluatorId ?? null, evidenceId: data.evidenceId ?? null,
        findings: data.findings ?? null, derivedActionId: data.derivedActionId ?? null, createdById: ctx.user.id,
      }),
    });
    if (data.advanceReview && obligation.reviewFrequencyMonths) {
      const next = new Date(evaluatedAt);
      next.setMonth(next.getMonth() + obligation.reviewFrequencyMonths);
      await tx.environmentalComplianceObligation.update({ where: { id: obligation.id }, data: { reviewDate: next } });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: ev.id, after: { obligationId: data.obligationId, result: data.result }, extra: { event: "create_compliance_evaluation" } });
    return ev;
  });

  if ((data.result === "NON_COMPLIANT" || data.result === "PARTIAL") && obligation.responsibleId) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: obligation.responsibleId,
      title: data.result === "NON_COMPLIANT" ? "Obligación ambiental incumplida" : "Obligación ambiental parcialmente cumplida",
      body: `La obligación «${obligation.source}: ${obligation.obligation}» quedó evaluada como ${data.result === "NON_COMPLIANT" ? "no conforme" : "parcial"}.`,
      type: data.result === "NON_COMPLIANT" ? "ALERT" : "WARNING",
      link: "/app/environment",
    }).catch(() => undefined);
  }

  revalidate();
  return { id: created.id };
}

// ─────────────────────────────────────────────────────
// Objectives & programs
// ─────────────────────────────────────────────────────

const objectiveSchema = z.object({
  code: z.string().max(40).optional(),
  objective: z.string().min(1).max(600),
  baseline: z.string().max(600).optional(),
  target: z.string().max(600).optional(),
  indicatorId: z.string().optional(),
  responsibleId: z.string().optional(),
  resources: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "ACHIEVED", "DELAYED", "CANCELLED"]).default("PLANNED"),
  progress: z.number().int().min(0).max(100).default(0),
});

export async function createObjective(input: z.infer<typeof objectiveSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = objectiveSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { indicatorId: data.indicatorId });
  const code = data.code ?? await nextCode(ctx, "OBJ", prisma.environmentalObjective.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const objective = await tx.environmentalObjective.create({
      data: tenantData(ctx, {
        code, objective: data.objective, baseline: data.baseline ?? null, target: data.target ?? null,
        indicatorId: data.indicatorId ?? null, responsibleId: data.responsibleId ?? null,
        resources: data.resources ?? null, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status, progress: data.progress, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: objective.id, after: { code, objective: data.objective }, extra: { event: "create_objective" } });
    return objective;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateObjective(id: string, input: Partial<z.infer<typeof objectiveSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalObjective.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Objetivo no encontrado.");
  const data = objectiveSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { indicatorId: data.indicatorId });

  await prisma.$transaction(async (tx) => {
    await tx.environmentalObjective.update({ where: { id }, data: {
      ...(data.objective !== undefined ? { objective: data.objective } : {}),
      ...(data.baseline !== undefined ? { baseline: data.baseline } : {}),
      ...(data.target !== undefined ? { target: data.target } : {}),
      ...(data.indicatorId !== undefined ? { indicatorId: data.indicatorId } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.resources !== undefined ? { resources: data.resources } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.progress !== undefined ? { progress: data.progress } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_objective" } });
  });
  revalidate();
  return { id };
}

const programSchema = z.object({
  objectiveId: z.string().optional(),
  name: z.string().min(1).max(300),
  activities: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  budget: z.number().min(0).optional(),
  progress: z.number().int().min(0).max(100).default(0),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"]).default("NOT_STARTED"),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
});

export async function createProgram(input: z.infer<typeof programSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = programSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  if (data.objectiveId) {
    const obj = await prisma.environmentalObjective.findFirst({ where: tenantWhere(ctx, { id: data.objectiveId }), select: { id: true } });
    if (!obj) throw new Error("El objetivo no pertenece a la organización.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const program = await tx.environmentalProgram.create({
      data: tenantData(ctx, {
        objectiveId: data.objectiveId ?? null, name: data.name, activities: data.activities ?? null,
        responsibleId: data.responsibleId ?? null, budget: data.budget ?? null, progress: data.progress,
        status: data.status, startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: program.id, after: { name: data.name }, extra: { event: "create_program" } });
    return program;
  });
  revalidate();
  return { id: created.id };
}

export async function updateProgram(id: string, input: Partial<z.infer<typeof programSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalProgram.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Programa ambiental no encontrado.");
  const data = programSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  if (data.objectiveId) {
    const objective = await prisma.environmentalObjective.findFirst({ where: tenantWhere(ctx, { id: data.objectiveId }), select: { id: true } });
    if (!objective) throw new Error("El objetivo no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.environmentalProgram.update({ where: { id }, data: {
      ...(data.objectiveId !== undefined ? { objectiveId: data.objectiveId } : {}), ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.activities !== undefined ? { activities: data.activities } : {}), ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.budget !== undefined ? { budget: data.budget } : {}), ...(data.progress !== undefined ? { progress: data.progress } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}), ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}), ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_environmental_program" } });
  });
  revalidate();
  return { id };
}

export async function deleteProgram(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.environmentalProgram.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, name: true } });
  if (!existing) throw new Error("Programa ambiental no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.environmentalProgram.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { name: existing.name }, extra: { event: "delete_environmental_program" } });
  });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Metrics, waste streams, emergency scenarios
// ─────────────────────────────────────────────────────

const metricSchema = z.object({
  period: z.string().min(1).max(20),
  processId: z.string().optional(),
  locationId: z.string().optional(),
  water: z.number().optional(),
  energy: z.number().optional(),
  fuel: z.number().optional(),
  emissions: z.number().optional(),
  discharges: z.number().optional(),
  waste: z.number().optional(),
  rawMaterials: z.number().optional(),
  unitNote: z.string().max(300).optional(),
});

export async function upsertMetric(input: z.infer<typeof metricSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = metricSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, locationId: data.locationId });

  const created = await prisma.$transaction(async (tx) => {
    const metric = await tx.environmentalMetric.create({
      data: tenantData(ctx, {
        period: data.period, processId: data.processId ?? null, locationId: data.locationId ?? null,
        periodStart: /^\d{4}-\d{2}$/.test(data.period) ? new Date(`${data.period}-01T00:00:00.000Z`) : null,
        water: data.water ?? null, energy: data.energy ?? null, fuel: data.fuel ?? null,
        emissions: data.emissions ?? null, discharges: data.discharges ?? null, waste: data.waste ?? null,
        rawMaterials: data.rawMaterials ?? null, unitNote: data.unitNote ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: metric.id, after: { period: data.period }, extra: { event: "record_metric" } });
    return metric;
  });
  revalidate();
  return { id: created.id };
}

const wasteSchema = z.object({
  code: z.string().max(40).optional(),
  wasteType: z.string().min(1).max(200),
  classification: z.enum(["NON_HAZARDOUS", "HAZARDOUS", "RECYCLABLE", "INERT", "SPECIAL"]).default("NON_HAZARDOUS"),
  quantity: z.number().min(0).optional(),
  unit: z.string().max(40).optional(),
  period: z.string().max(20).optional(),
  storage: z.string().max(300).optional(),
  managerName: z.string().max(200).optional(),
  disposition: z.string().max(200).optional(),
  manifest: z.string().max(200).optional(),
  processId: z.string().optional(),
});

export async function createWasteStream(input: z.infer<typeof wasteSchema>) {
  const ctx = await requirePermission("environment:create");
  const data = wasteSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode(ctx, "RES", prisma.wasteStream.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const stream = await tx.wasteStream.create({
      data: tenantData(ctx, {
        code, wasteType: data.wasteType, classification: data.classification, quantity: data.quantity ?? null,
        unit: data.unit ?? null, period: data.period ?? null, storage: data.storage ?? null,
        managerName: data.managerName ?? null, disposition: data.disposition ?? null, manifest: data.manifest ?? null,
        processId: data.processId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: stream.id, after: { code, classification: data.classification }, extra: { event: "create_waste_stream" } });
    return stream;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateWasteStream(id: string, input: Partial<z.infer<typeof wasteSchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.wasteStream.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Flujo de residuos no encontrado.");
  const data = wasteSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  await prisma.$transaction(async (tx) => {
    await tx.wasteStream.update({ where: { id }, data: {
      ...(data.wasteType !== undefined ? { wasteType: data.wasteType } : {}), ...(data.classification !== undefined ? { classification: data.classification } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}), ...(data.unit !== undefined ? { unit: data.unit } : {}), ...(data.period !== undefined ? { period: data.period } : {}),
      ...(data.storage !== undefined ? { storage: data.storage } : {}), ...(data.managerName !== undefined ? { managerName: data.managerName } : {}),
      ...(data.disposition !== undefined ? { disposition: data.disposition } : {}), ...(data.manifest !== undefined ? { manifest: data.manifest } : {}), ...(data.processId !== undefined ? { processId: data.processId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_waste_stream" } });
  });
  revalidate();
  return { id };
}

export async function deleteWasteStream(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.wasteStream.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true } });
  if (!existing) throw new Error("Flujo de residuos no encontrado.");
  await prisma.$transaction(async (tx) => { await tx.wasteStream.delete({ where: { id } }); await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { code: existing.code }, extra: { event: "delete_waste_stream" } }); });
  revalidate();
  return { id };
}

const emergencySchema = z.object({
  code: z.string().max(40).optional(),
  scenario: z.string().min(1).max(400),
  impact: z.string().max(2000).optional(),
  controls: z.string().max(2000).optional(),
  responsePlan: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  lastDrillAt: z.string().datetime().optional(),
  nextDrillAt: z.string().datetime().optional(),
  drillResults: z.string().max(2000).optional(),
  documentId: z.string().optional(),
});

export async function createEmergencyScenario(input: z.infer<typeof emergencySchema>) {
  const ctx = await requirePermission("environment:create");
  const data = emergencySchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode(ctx, "EMG", prisma.environmentalEmergencyScenario.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const scenario = await tx.environmentalEmergencyScenario.create({
      data: tenantData(ctx, {
        code, scenario: data.scenario, impact: data.impact ?? null, controls: data.controls ?? null,
        responsePlan: data.responsePlan ?? null, responsibleId: data.responsibleId ?? null,
        lastDrillAt: data.lastDrillAt ? new Date(data.lastDrillAt) : null,
        nextDrillAt: data.nextDrillAt ? new Date(data.nextDrillAt) : null,
        drillResults: data.drillResults ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: scenario.id, after: { code, scenario: data.scenario }, extra: { event: "create_emergency_scenario" } });
    return scenario;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateEmergencyScenario(id: string, input: Partial<z.infer<typeof emergencySchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalEmergencyScenario.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Escenario de emergencia no encontrado.");
  const data = emergencySchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  await prisma.$transaction(async (tx) => {
    await tx.environmentalEmergencyScenario.update({ where: { id }, data: {
      ...(data.scenario !== undefined ? { scenario: data.scenario } : {}), ...(data.impact !== undefined ? { impact: data.impact } : {}), ...(data.controls !== undefined ? { controls: data.controls } : {}),
      ...(data.responsePlan !== undefined ? { responsePlan: data.responsePlan } : {}), ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.lastDrillAt !== undefined ? { lastDrillAt: data.lastDrillAt ? new Date(data.lastDrillAt) : null } : {}), ...(data.nextDrillAt !== undefined ? { nextDrillAt: data.nextDrillAt ? new Date(data.nextDrillAt) : null } : {}),
      ...(data.drillResults !== undefined ? { drillResults: data.drillResults } : {}), ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_emergency_scenario" } });
  });
  revalidate();
  return { id };
}

export async function deleteEmergencyScenario(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.environmentalEmergencyScenario.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true } });
  if (!existing) throw new Error("Escenario de emergencia no encontrado.");
  await prisma.$transaction(async (tx) => { await tx.environmentalEmergencyScenario.delete({ where: { id } }); await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { code: existing.code }, extra: { event: "delete_emergency_scenario" } }); });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Biodiversity (configurable — org-defined site/ecosystem/cadence)
// ─────────────────────────────────────────────────────

const biodiversitySchema = z.object({
  code: z.string().max(40).optional(),
  site: z.string().min(1).max(300),
  ecosystemType: z.string().max(200).optional(),
  protectedArea: z.boolean().default(false),
  protectedAreaName: z.string().max(300).optional(),
  speciesOrHabitat: z.string().max(600).optional(),
  impactDescription: z.string().max(2000).optional(),
  mitigationMeasures: z.string().max(2000).optional(),
  monitoringFrequency: z.string().max(120).optional(),
  status: z.enum(["IDENTIFIED", "MONITORING", "MITIGATED", "CLOSED"]).default("IDENTIFIED"),
  responsibleId: z.string().optional(),
  processId: z.string().optional(),
  evidenceId: z.string().optional(),
  lastMonitoredAt: z.string().datetime().optional(),
  nextMonitoringAt: z.string().datetime().optional(),
});

export async function createBiodiversityRecord(input: z.infer<typeof biodiversitySchema>) {
  const ctx = await requirePermission("environment:create");
  const data = biodiversitySchema.parse(input);
  if (data.protectedArea && !data.protectedAreaName?.trim()) {
    throw new Error("Indica el nombre del área protegida.");
  }
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode(ctx, "BIO", prisma.environmentalBiodiversityRecord.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.environmentalBiodiversityRecord.create({
      data: tenantData(ctx, {
        code, site: data.site, ecosystemType: data.ecosystemType ?? null,
        protectedArea: data.protectedArea, protectedAreaName: data.protectedAreaName ?? null,
        speciesOrHabitat: data.speciesOrHabitat ?? null, impactDescription: data.impactDescription ?? null,
        mitigationMeasures: data.mitigationMeasures ?? null, monitoringFrequency: data.monitoringFrequency ?? null,
        status: data.status, responsibleId: data.responsibleId ?? null, processId: data.processId ?? null,
        evidenceId: data.evidenceId ?? null,
        lastMonitoredAt: data.lastMonitoredAt ? new Date(data.lastMonitoredAt) : null,
        nextMonitoringAt: data.nextMonitoringAt ? new Date(data.nextMonitoringAt) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: record.id, after: { code, site: data.site, protectedArea: data.protectedArea }, extra: { event: "create_biodiversity_record" } });
    return record;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateBiodiversityRecord(id: string, input: Partial<z.infer<typeof biodiversitySchema>>) {
  const ctx = await requirePermission("environment:update");
  const existing = await prisma.environmentalBiodiversityRecord.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Registro de biodiversidad no encontrado.");
  const data = biodiversitySchema.partial().parse(input);
  const protectedArea = data.protectedArea ?? existing.protectedArea;
  const protectedAreaName = data.protectedAreaName !== undefined ? data.protectedAreaName : existing.protectedAreaName;
  if (protectedArea && !protectedAreaName?.trim()) {
    throw new Error("Indica el nombre del área protegida.");
  }
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, evidenceId: data.evidenceId });

  await prisma.$transaction(async (tx) => {
    await tx.environmentalBiodiversityRecord.update({ where: { id }, data: {
      ...(data.site !== undefined ? { site: data.site } : {}),
      ...(data.ecosystemType !== undefined ? { ecosystemType: data.ecosystemType } : {}),
      ...(data.protectedArea !== undefined ? { protectedArea: data.protectedArea } : {}),
      ...(data.protectedAreaName !== undefined ? { protectedAreaName: data.protectedAreaName } : {}),
      ...(data.speciesOrHabitat !== undefined ? { speciesOrHabitat: data.speciesOrHabitat } : {}),
      ...(data.impactDescription !== undefined ? { impactDescription: data.impactDescription } : {}),
      ...(data.mitigationMeasures !== undefined ? { mitigationMeasures: data.mitigationMeasures } : {}),
      ...(data.monitoringFrequency !== undefined ? { monitoringFrequency: data.monitoringFrequency } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.processId !== undefined ? { processId: data.processId } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
      ...(data.lastMonitoredAt !== undefined ? { lastMonitoredAt: data.lastMonitoredAt ? new Date(data.lastMonitoredAt) : null } : {}),
      ...(data.nextMonitoringAt !== undefined ? { nextMonitoringAt: data.nextMonitoringAt ? new Date(data.nextMonitoringAt) : null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { status: existing.status }, after: { status: data.status ?? existing.status }, extra: { event: "update_biodiversity_record" } });
  });
  revalidate();
  return { id };
}

export async function deleteBiodiversityRecord(id: string) {
  const ctx = await requirePermission("environment:delete");
  const existing = await prisma.environmentalBiodiversityRecord.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true } });
  if (!existing) throw new Error("Registro de biodiversidad no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.environmentalBiodiversityRecord.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { code: existing.code }, extra: { event: "delete_biodiversity_record" } });
  });
  revalidate();
  return { id };
}
