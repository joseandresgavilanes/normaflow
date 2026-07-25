"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { assessImpact, classifySystem } from "@/lib/aims/classification";
import { computeDataQuality, isDatasetFitForTraining } from "@/lib/aims/data-quality";
import {
  assertHumanReviewTransition,
  assertPromotable,
  assertReviewerPresent,
} from "@/lib/aims/human-review";
import { assertAIIncidentTransition, requiresNotificationDecision } from "@/lib/aims/incident-workflow";
import { assertProductionApproval, assertRetirement, assertSystemTransition } from "@/lib/aims/lifecycle";
import { defaultHigherIsBetter, evaluateMetric } from "@/lib/aims/monitoring";
import { computeAIRisk, assertRiskAcceptance } from "@/lib/aims/risk";
import { nextLineageStep } from "@/lib/aims/lineage";
import type { AIHumanReviewStatus, AIIncidentStatus, AISystemStatus } from "@prisma/client";

const MODULE = "aims";
const revalidate = () => {
  revalidatePath("/app/aims");
  revalidatePath("/app/activity");
};

/** Verify an optional cross-module reference belongs to the caller's org. */
async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "riskId" | "capaId" | "evidenceId" | "documentId" | "supplierId" | "controlId" | "trainingCourseId" | "changeRequestId" | "indicatorId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.riskId) guard(prisma.risk.findFirst(w(refs.riskId)), "de riesgo");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  if (refs.controlId) guard(prisma.organizationControl.findFirst(w(refs.controlId)), "de control");
  if (refs.trainingCourseId) guard(prisma.trainingCourse.findFirst(w(refs.trainingCourseId)), "de curso");
  if (refs.changeRequestId) guard(prisma.changeRequest.findFirst(w(refs.changeRequestId)), "de cambio");
  if (refs.indicatorId) guard(prisma.indicator.findFirst(w(refs.indicatorId)), "de indicador");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

/** Best-effort in-app + email notification; never blocks the business action. */
async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[aims] notify failed:", e instanceof Error ? e.message : e); }
}

const IMPACT_SEVERITY = ["NOT_ASSESSED", "NONE", "LOW", "MODERATE", "HIGH", "SEVERE"] as const;

// ─────────────────────────────────────────────────────
// AI system inventory (§A.6.2) + lifecycle and retirement
// ─────────────────────────────────────────────────────

const systemSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  ownerId: z.string().optional(),
  provider: z.string().max(200).optional(),
  providerType: z.enum(["INTERNAL", "THIRD_PARTY_API", "THIRD_PARTY_LICENSED", "OPEN_SOURCE", "EMBEDDED_IN_PRODUCT", "OTHER"]).default("INTERNAL"),
  supplierId: z.string().optional(),
  purpose: z.string().min(1).max(2000),
  users: z.string().max(1000).optional(),
  affectedGroups: z.string().max(1000).optional(),
  context: z.string().max(4000).optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  autonomy: z.enum(["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "FULLY_AUTOMATED"]).default("HUMAN_IN_THE_LOOP"),
  processId: z.string().optional(),
  documentId: z.string().optional(),
  nextReviewDate: z.string().datetime().optional(),
});

export async function createAISystem(input: z.infer<typeof systemSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = systemSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId, supplierId: data.supplierId });
  const code = data.code ?? await nextCode("IA", prisma.aISystem.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aISystem.create({
    data: tenantData(ctx, {
      code, name: data.name, ownerId: data.ownerId ?? null, provider: data.provider ?? null, providerType: data.providerType,
      supplierId: data.supplierId ?? null, purpose: data.purpose, users: data.users ?? null, affectedGroups: data.affectedGroups ?? null,
      context: data.context ?? null, criticality: data.criticality, autonomy: data.autonomy, status: "PLANNED",
      classification: classifySystem(data.criticality, "NOT_CLASSIFIED"),
      processId: data.processId ?? null, documentId: data.documentId ?? null,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, name: data.name, criticality: data.criticality }, extra: { event: "create_ai_system" } });
  revalidate();
  return { id: created.id, code };
}

export async function updateAISystem(id: string, input: Partial<z.infer<typeof systemSchema>>) {
  const ctx = await requirePermission("aims:update");
  const existing = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, classification: true } });
  if (!existing) throw new Error("Sistema de IA no encontrado.");
  const data = systemSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId, supplierId: data.supplierId });
  await prisma.aISystem.update({ where: { id }, data: {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
    ...(data.provider !== undefined ? { provider: data.provider } : {}),
    ...(data.providerType !== undefined ? { providerType: data.providerType } : {}),
    ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
    ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
    ...(data.users !== undefined ? { users: data.users } : {}),
    ...(data.affectedGroups !== undefined ? { affectedGroups: data.affectedGroups } : {}),
    ...(data.context !== undefined ? { context: data.context } : {}),
    // La criticidad puede elevar la clasificación vigente, nunca rebajarla.
    ...(data.criticality !== undefined ? { criticality: data.criticality, classification: classifySystem(data.criticality, existing.classification) } : {}),
    ...(data.autonomy !== undefined ? { autonomy: data.autonomy } : {}),
    ...(data.processId !== undefined ? { processId: data.processId } : {}),
    ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
    ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_ai_system" } });
  revalidate();
  return { id };
}

/**
 * Approve an AI system for production use. The human approver is recorded and is
 * a precondition for the IN_PRODUCTION status (also enforced by CHECK).
 */
export async function approveAISystem(id: string, note?: string) {
  const ctx = await requirePermission("aims:approve");
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!system) throw new Error("Sistema de IA no encontrado.");
  if (system.status !== "IN_VALIDATION") throw new Error("Solo un sistema en validación puede aprobarse para su uso.");

  const [assessment, oversight] = await Promise.all([
    prisma.aIImpactAssessment.findFirst({ where: { organizationId: ctx.organization.id, systemId: id, reviewStatus: "APPROVED" }, select: { id: true, classification: true } }),
    prisma.humanOversightControl.findFirst({ where: { organizationId: ctx.organization.id, systemId: id, active: true }, select: { id: true } }),
  ]);
  if (!assessment) throw new Error("El sistema requiere una evaluación de impacto aprobada por una persona antes de su aprobación.");
  const classification = classifySystem(system.criticality, assessment.classification);
  if (classification === "UNACCEPTABLE") throw new Error("Un sistema clasificado como riesgo inaceptable no puede aprobarse: debe descartarse o rediseñarse.");
  if (classification === "HIGH" && !oversight) throw new Error("Un sistema de riesgo alto requiere al menos un control de supervisión humana activo.");

  await prisma.aISystem.update({ where: { id }, data: { status: "APPROVED", classification, approvedById: ctx.user.id, approvedAt: new Date() } });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: system.status }, after: { status: "APPROVED", classification }, extra: { event: "approve_ai_system", note } });
  if (system.ownerId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: system.ownerId, title: `Sistema de IA aprobado: ${system.code}`, body: `"${system.name}" fue aprobado (clase ${classification}).`, type: "SUCCESS", link: "/app/aims", idempotencyKey: `ai-system:${id}:approved` });
  }
  revalidate();
  return { id, status: "APPROVED" as AISystemStatus, classification };
}

const systemStatusSchema = z.object({
  to: z.enum(["IN_DEVELOPMENT", "IN_VALIDATION", "IN_PRODUCTION", "SUSPENDED", "RETIRED"]),
  note: z.string().max(2000).optional(),
  retirementReason: z.string().max(2000).optional(),
  retirementPlan: z.string().max(4000).optional(),
});

/** Move a system along its lifecycle; retirement demands reason + disposal plan. */
export async function setAISystemStatus(id: string, input: z.infer<typeof systemStatusSchema>) {
  const ctx = await requirePermission("aims:update");
  const data = systemStatusSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!system) throw new Error("Sistema de IA no encontrado.");
  assertSystemTransition(system.status, data.to as AISystemStatus);

  if (data.to === "IN_PRODUCTION") {
    assertProductionApproval({ approvedById: system.approvedById, approvedAt: system.approvedAt });
    if (system.classification === "UNACCEPTABLE") throw new Error("Un sistema de riesgo inaceptable no puede pasar a producción.");
  }
  if (data.to === "RETIRED") {
    assertRetirement({ reason: data.retirementReason ?? system.retirementReason, plan: data.retirementPlan ?? system.retirementPlan });
  }

  await prisma.aISystem.update({ where: { id }, data: {
    status: data.to,
    ...(data.to === "IN_PRODUCTION" ? { deployedAt: system.deployedAt ?? new Date() } : {}),
    ...(data.to === "RETIRED"
      ? {
          retiredAt: new Date(), active: false,
          ...(data.retirementReason !== undefined ? { retirementReason: data.retirementReason } : {}),
          ...(data.retirementPlan !== undefined ? { retirementPlan: data.retirementPlan } : {}),
        }
      : {}),
  } });
  // El retiro del sistema arrastra sus modelos: ninguno puede quedar en producción.
  if (data.to === "RETIRED") {
    await prisma.modelVersion.updateMany({ where: { organizationId: ctx.organization.id, systemId: id, stage: { notIn: ["RETIRED"] } }, data: { stage: "RETIRED", retiredAt: new Date() } });
  }
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { status: system.status }, after: { status: data.to }, extra: { event: "ai_system_status", note: data.note } });
  revalidate();
  return { id, status: data.to };
}

// ─────────────────────────────────────────────────────
// Use cases (§A.6.1)
// ─────────────────────────────────────────────────────

const useCaseSchema = z.object({
  systemId: z.string().min(1),
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  objective: z.string().min(1).max(2000),
  supportedDecisions: z.string().max(2000).optional(),
  decisionAutonomy: z.enum(["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "FULLY_AUTOMATED"]).default("HUMAN_IN_THE_LOOP"),
  affectedPeople: z.string().max(2000).optional(),
  affectedCount: z.number().int().min(0).optional(),
  impact: z.string().max(2000).optional(),
  constraints: z.string().max(2000).optional(),
  prohibitedUses: z.string().max(2000).optional(),
  processId: z.string().optional(),
});

export async function createAIUseCase(input: z.infer<typeof useCaseSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = useCaseSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode("IAU", prisma.aIUseCase.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIUseCase.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId, title: data.title, objective: data.objective,
      supportedDecisions: data.supportedDecisions ?? null, decisionAutonomy: data.decisionAutonomy,
      affectedPeople: data.affectedPeople ?? null, affectedCount: data.affectedCount ?? null,
      impact: data.impact ?? null, constraints: data.constraints ?? null, prohibitedUses: data.prohibitedUses ?? null,
      processId: data.processId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, title: data.title }, extra: { event: "create_ai_use_case" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// Impact assessment (§6.1.4, §A.5.2) — seven dimensions, human approval
// ─────────────────────────────────────────────────────

const assessmentSchema = z.object({
  systemId: z.string().min(1),
  useCaseId: z.string().optional(),
  code: z.string().max(40).optional(),
  version: z.string().max(20).default("1"),
  methodology: z.string().max(600).optional(),
  rightsImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  rightsNote: z.string().max(2000).optional(),
  safetyImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  safetyNote: z.string().max(2000).optional(),
  privacyImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  privacyNote: z.string().max(2000).optional(),
  biasImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  biasNote: z.string().max(2000).optional(),
  transparencyImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  transparencyNote: z.string().max(2000).optional(),
  explainabilityImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  explainabilityNote: z.string().max(2000).optional(),
  oversightImpact: z.enum(IMPACT_SEVERITY).default("NOT_ASSESSED"),
  oversightNote: z.string().max(2000).optional(),
  safeguards: z.string().max(4000).optional(),
  residualImpact: z.string().max(2000).optional(),
  assessorId: z.string().optional(),
  evidenceId: z.string().optional(),
  documentId: z.string().optional(),
  nextReviewDate: z.string().datetime().optional(),
});

/** Aggregate the seven dimensions into severity + classification. */
function aggregate(data: z.infer<typeof assessmentSchema> | Partial<z.infer<typeof assessmentSchema>>) {
  return assessImpact({
    rights: data.rightsImpact, safety: data.safetyImpact, privacy: data.privacyImpact, bias: data.biasImpact,
    transparency: data.transparencyImpact, explainability: data.explainabilityImpact, oversight: data.oversightImpact,
  });
}

export async function createImpactAssessment(input: z.infer<typeof assessmentSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = assessmentSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true, criticality: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, documentId: data.documentId });

  const result = aggregate(data);
  const code = data.code ?? await nextCode("EIA", prisma.aIImpactAssessment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIImpactAssessment.create({
    data: tenantData(ctx, {
      code, version: data.version, systemId: data.systemId, useCaseId: data.useCaseId ?? null, methodology: data.methodology ?? null,
      rightsImpact: data.rightsImpact, rightsNote: data.rightsNote ?? null,
      safetyImpact: data.safetyImpact, safetyNote: data.safetyNote ?? null,
      privacyImpact: data.privacyImpact, privacyNote: data.privacyNote ?? null,
      biasImpact: data.biasImpact, biasNote: data.biasNote ?? null,
      transparencyImpact: data.transparencyImpact, transparencyNote: data.transparencyNote ?? null,
      explainabilityImpact: data.explainabilityImpact, explainabilityNote: data.explainabilityNote ?? null,
      oversightImpact: data.oversightImpact, oversightNote: data.oversightNote ?? null,
      overallScore: result.overallScore, overallSeverity: result.overallSeverity,
      classification: classifySystem(system.criticality, result.classification),
      safeguards: data.safeguards ?? null, residualImpact: data.residualImpact ?? null,
      assessorId: data.assessorId ?? ctx.user.id, assessedAt: new Date(), reviewStatus: "DRAFT",
      evidenceId: data.evidenceId ?? null, documentId: data.documentId ?? null,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, severity: result.overallSeverity, classification: result.classification }, extra: { event: "create_impact_assessment" } });
  revalidate();
  return { id: created.id, code, ...result };
}

export async function updateImpactAssessment(id: string, input: Partial<z.infer<typeof assessmentSchema>>) {
  const ctx = await requirePermission("aims:update");
  const existing = await prisma.aIImpactAssessment.findFirst({ where: tenantWhere(ctx, { id }), include: { system: { select: { criticality: true } } } });
  if (!existing) throw new Error("Evaluación de impacto no encontrada.");
  // Una evaluación aprobada es un registro cerrado: se versiona, no se reescribe.
  if (existing.reviewStatus === "APPROVED") throw new Error("La evaluación ya fue aprobada; cree una nueva versión para modificarla.");
  const data = assessmentSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, documentId: data.documentId });

  const merged = {
    rightsImpact: data.rightsImpact ?? existing.rightsImpact,
    safetyImpact: data.safetyImpact ?? existing.safetyImpact,
    privacyImpact: data.privacyImpact ?? existing.privacyImpact,
    biasImpact: data.biasImpact ?? existing.biasImpact,
    transparencyImpact: data.transparencyImpact ?? existing.transparencyImpact,
    explainabilityImpact: data.explainabilityImpact ?? existing.explainabilityImpact,
    oversightImpact: data.oversightImpact ?? existing.oversightImpact,
  };
  const result = aggregate(merged);
  await prisma.aIImpactAssessment.update({ where: { id }, data: {
    ...merged,
    ...(data.methodology !== undefined ? { methodology: data.methodology } : {}),
    ...(data.rightsNote !== undefined ? { rightsNote: data.rightsNote } : {}),
    ...(data.safetyNote !== undefined ? { safetyNote: data.safetyNote } : {}),
    ...(data.privacyNote !== undefined ? { privacyNote: data.privacyNote } : {}),
    ...(data.biasNote !== undefined ? { biasNote: data.biasNote } : {}),
    ...(data.transparencyNote !== undefined ? { transparencyNote: data.transparencyNote } : {}),
    ...(data.explainabilityNote !== undefined ? { explainabilityNote: data.explainabilityNote } : {}),
    ...(data.oversightNote !== undefined ? { oversightNote: data.oversightNote } : {}),
    ...(data.safeguards !== undefined ? { safeguards: data.safeguards } : {}),
    ...(data.residualImpact !== undefined ? { residualImpact: data.residualImpact } : {}),
    ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
    ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
    overallScore: result.overallScore, overallSeverity: result.overallSeverity,
    classification: classifySystem(existing.system.criticality, result.classification),
    assessedAt: new Date(),
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { severity: result.overallSeverity, classification: result.classification }, extra: { event: "update_impact_assessment" } });
  revalidate();
  return { id, ...result };
}

// ─────────────────────────────────────────────────────
// AI risks (§6.1.2, §6.1.3)
// ─────────────────────────────────────────────────────

const riskSchema = z.object({
  systemId: z.string().optional(),
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  category: z.enum(["BIAS_DISCRIMINATION", "PRIVACY", "SECURITY", "SAFETY", "TRANSPARENCY", "EXPLAINABILITY", "ROBUSTNESS", "DATA_QUALITY", "HUMAN_OVERSIGHT", "INTELLECTUAL_PROPERTY", "LEGAL_COMPLIANCE", "ENVIRONMENTAL", "THIRD_PARTY", "MISUSE", "OTHER"]).default("OTHER"),
  source: z.string().max(600).optional(),
  description: z.string().max(4000).optional(),
  affectedParties: z.string().max(2000).optional(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  existingControls: z.string().max(2000).optional(),
  controlEffectiveness: z.number().int().min(0).max(100).optional(),
  treatment: z.enum(["MITIGATE", "AVOID", "TRANSFER", "ACCEPT"]).default("MITIGATE"),
  treatmentPlan: z.string().max(4000).optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  riskId: z.string().optional(),
  controlId: z.string().optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createAIRisk(input: z.infer<typeof riskSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = riskSchema.parse(input);
  if (data.systemId) {
    const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
    if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, controlId: data.controlId, capaId: data.capaId, evidenceId: data.evidenceId });

  const r = computeAIRisk({ likelihood: data.likelihood, impact: data.impact, controlEffectiveness: data.controlEffectiveness });
  const code = data.code ?? await nextCode("IAR", prisma.aIRisk.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIRisk.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId ?? null, title: data.title, category: data.category, source: data.source ?? null,
      description: data.description ?? null, affectedParties: data.affectedParties ?? null,
      likelihood: data.likelihood, impact: data.impact, inherentScore: r.inherentScore, inherentLevel: r.inherentLevel,
      existingControls: data.existingControls ?? null, controlEffectiveness: data.controlEffectiveness ?? null,
      residualScore: r.residualScore, residualLevel: r.residualLevel, acceptability: r.acceptability,
      treatment: data.treatment, treatmentPlan: data.treatmentPlan ?? null, ownerId: data.ownerId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null, riskId: data.riskId ?? null, controlId: data.controlId ?? null,
      capaId: data.capaId ?? null, evidenceId: data.evidenceId ?? null, status: "OPEN", createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, residualLevel: r.residualLevel, acceptability: r.acceptability }, extra: { event: "create_ai_risk" } });
  revalidate();
  return { id: created.id, code, ...r };
}

export async function updateAIRisk(id: string, input: Partial<z.infer<typeof riskSchema>>) {
  const ctx = await requirePermission("aims:update");
  const existing = await prisma.aIRisk.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Riesgo de IA no encontrado.");
  const data = riskSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, controlId: data.controlId, capaId: data.capaId, evidenceId: data.evidenceId });

  const r = computeAIRisk({
    likelihood: data.likelihood ?? existing.likelihood,
    impact: data.impact ?? existing.impact,
    controlEffectiveness: data.controlEffectiveness ?? existing.controlEffectiveness,
  });
  await prisma.aIRisk.update({ where: { id }, data: {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.source !== undefined ? { source: data.source } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.affectedParties !== undefined ? { affectedParties: data.affectedParties } : {}),
    ...(data.likelihood !== undefined ? { likelihood: data.likelihood } : {}),
    ...(data.impact !== undefined ? { impact: data.impact } : {}),
    ...(data.existingControls !== undefined ? { existingControls: data.existingControls } : {}),
    ...(data.controlEffectiveness !== undefined ? { controlEffectiveness: data.controlEffectiveness } : {}),
    ...(data.treatment !== undefined ? { treatment: data.treatment } : {}),
    ...(data.treatmentPlan !== undefined ? { treatmentPlan: data.treatmentPlan } : {}),
    ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    ...(data.riskId !== undefined ? { riskId: data.riskId } : {}),
    ...(data.controlId !== undefined ? { controlId: data.controlId } : {}),
    ...(data.capaId !== undefined ? { capaId: data.capaId } : {}),
    ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    inherentScore: r.inherentScore, inherentLevel: r.inherentLevel,
    residualScore: r.residualScore, residualLevel: r.residualLevel, acceptability: r.acceptability,
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { residualLevel: r.residualLevel, acceptability: r.acceptability }, extra: { event: "update_ai_risk" } });
  revalidate();
  return { id, ...r };
}

/** Formal acceptance of a residual AI risk — always attributed to a person. */
export async function acceptAIRisk(id: string, rationale: string) {
  const ctx = await requirePermission("aims:approve");
  const risk = await prisma.aIRisk.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!risk) throw new Error("Riesgo de IA no encontrado.");
  assertRiskAcceptance(risk.acceptability, rationale, ctx.user.id);
  await prisma.aIRisk.update({ where: { id }, data: { status: "ACCEPTED", treatment: "ACCEPT", acceptedById: ctx.user.id, acceptedAt: new Date(), acceptanceRationale: rationale } });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: risk.status }, after: { status: "ACCEPTED" }, extra: { event: "accept_ai_risk", rationale } });
  revalidate();
  return { id, status: "ACCEPTED" };
}

// ─────────────────────────────────────────────────────
// Datasets, provenance, data quality and bias (§A.7)
// ─────────────────────────────────────────────────────

const datasetSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  purpose: z.string().max(2000).optional(),
  ownerId: z.string().optional(),
  stewardId: z.string().optional(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).default("INTERNAL"),
  containsPersonalData: z.boolean().default(false),
  personalDataCategories: z.string().max(1000).optional(),
  containsSpecialCategories: z.boolean().default(false),
  legalBasis: z.enum(["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_TASK", "LEGITIMATE_INTEREST", "ANONYMIZED", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  anonymization: z.string().max(2000).optional(),
  recordCount: z.number().int().min(0).optional(),
  featureCount: z.number().int().min(0).optional(),
  periodCovered: z.string().max(200).optional(),
  retentionMonths: z.number().int().min(0).optional(),
  storageLocation: z.string().max(300).optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createDataset(input: z.infer<typeof datasetSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = datasetSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  // Privacidad: los datos personales exigen una base legal explícita.
  if (data.containsPersonalData && data.legalBasis === "NOT_APPLICABLE") {
    throw new Error("Un dataset con datos personales requiere declarar la base legal de tratamiento.");
  }
  const code = data.code ?? await nextCode("DS", prisma.dataset.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.dataset.create({
    data: tenantData(ctx, {
      code, name: data.name, purpose: data.purpose ?? null, ownerId: data.ownerId ?? null, stewardId: data.stewardId ?? null,
      classification: data.classification, containsPersonalData: data.containsPersonalData,
      personalDataCategories: data.personalDataCategories ?? null, containsSpecialCategories: data.containsSpecialCategories,
      legalBasis: data.legalBasis, anonymization: data.anonymization ?? null, recordCount: data.recordCount ?? null,
      featureCount: data.featureCount ?? null, periodCovered: data.periodCovered ?? null,
      retentionMonths: data.retentionMonths ?? null, storageLocation: data.storageLocation ?? null,
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, name: data.name, containsPersonalData: data.containsPersonalData }, extra: { event: "create_dataset" } });
  revalidate();
  return { id: created.id, code };
}

const qualitySchema = z.object({
  completeness: z.number().int().min(0).max(100).optional(),
  accuracy: z.number().int().min(0).max(100).optional(),
  consistency: z.number().int().min(0).max(100).optional(),
  timeliness: z.number().int().min(0).max(100).optional(),
  representativeness: z.number().int().min(0).max(100).optional(),
});

/** Score the five data-quality dimensions; representativeness drives bias. */
export async function assessDatasetQuality(datasetId: string, input: z.infer<typeof qualitySchema>) {
  const ctx = await requirePermission("aims:update");
  const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: datasetId }) });
  if (!dataset) throw new Error("Dataset no encontrado.");
  const data = qualitySchema.parse(input);
  const merged = {
    completeness: data.completeness ?? dataset.completeness,
    accuracy: data.accuracy ?? dataset.accuracy,
    consistency: data.consistency ?? dataset.consistency,
    timeliness: data.timeliness ?? dataset.timeliness,
    representativeness: data.representativeness ?? dataset.representativeness,
  };
  const result = computeDataQuality(merged);
  await prisma.dataset.update({ where: { id: datasetId }, data: { ...merged, qualityScore: result.qualityScore, qualityLevel: result.qualityLevel } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: datasetId, after: { qualityScore: result.qualityScore, qualityLevel: result.qualityLevel }, extra: { event: "assess_dataset_quality" } });
  revalidate();
  return { id: datasetId, ...result };
}

const biasReviewSchema = z.object({
  biasFindings: z.string().max(4000).optional(),
  underrepresentedGroups: z.string().max(2000).optional(),
  representativeness: z.number().int().min(0).max(100).optional(),
  evidenceId: z.string().optional(),
});

/** Record the bias review of a dataset (§A.7.4); required before training. */
export async function reviewDatasetBias(datasetId: string, input: z.infer<typeof biasReviewSchema>) {
  const ctx = await requirePermission("aims:update");
  const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: datasetId }) });
  if (!dataset) throw new Error("Dataset no encontrado.");
  const data = biasReviewSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  const representativeness = data.representativeness ?? dataset.representativeness;
  const quality = computeDataQuality({
    completeness: dataset.completeness, accuracy: dataset.accuracy, consistency: dataset.consistency,
    timeliness: dataset.timeliness, representativeness,
  });
  await prisma.dataset.update({ where: { id: datasetId }, data: {
    biasReviewed: true, biasFindings: data.biasFindings ?? null,
    underrepresentedGroups: data.underrepresentedGroups ?? null,
    ...(data.representativeness !== undefined ? { representativeness: data.representativeness } : {}),
    ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    qualityScore: quality.qualityScore, qualityLevel: quality.qualityLevel,
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: datasetId, after: { biasReviewed: true, representativeness }, extra: { event: "review_dataset_bias" } });
  revalidate();
  return { id: datasetId, fitForTraining: isDatasetFitForTraining({ qualityLevel: quality.qualityLevel, biasReviewed: true }) };
}

const dataSourceSchema = z.object({
  datasetId: z.string().min(1),
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["INTERNAL_SYSTEM", "PUBLIC_DATASET", "THIRD_PARTY_PROVIDER", "WEB_SCRAPING", "USER_GENERATED", "SYNTHETIC", "SENSOR", "PURCHASED", "OTHER"]).default("OTHER"),
  origin: z.string().max(600).optional(),
  provider: z.string().max(200).optional(),
  supplierId: z.string().optional(),
  license: z.string().max(600).optional(),
  licenseVerified: z.boolean().default(false),
  legalBasis: z.enum(["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_TASK", "LEGITIMATE_INTEREST", "ANONYMIZED", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  consentEvidence: z.string().max(2000).optional(),
  collectedFrom: z.string().datetime().optional(),
  collectedTo: z.string().datetime().optional(),
  restrictions: z.string().max(2000).optional(),
  evidenceId: z.string().optional(),
});

/** Declare where a dataset comes from — provenance starts here (§A.7.2). */
export async function createDataSource(input: z.infer<typeof dataSourceSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = dataSourceSchema.parse(input);
  const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: data.datasetId }), select: { id: true } });
  if (!dataset) throw new Error("El dataset no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("FTE", prisma.dataSource.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.dataSource.create({
    data: tenantData(ctx, {
      code, datasetId: data.datasetId, name: data.name, type: data.type, origin: data.origin ?? null,
      provider: data.provider ?? null, supplierId: data.supplierId ?? null, license: data.license ?? null,
      licenseVerified: data.licenseVerified, legalBasis: data.legalBasis, consentEvidence: data.consentEvidence ?? null,
      collectedFrom: data.collectedFrom ? new Date(data.collectedFrom) : null,
      collectedTo: data.collectedTo ? new Date(data.collectedTo) : null,
      restrictions: data.restrictions ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, type: data.type }, extra: { event: "create_data_source" } });
  revalidate();
  return { id: created.id, code };
}

const lineageSchema = z.object({
  datasetId: z.string().min(1),
  step: z.number().int().min(1).optional(),
  operation: z.enum(["INGESTION", "CLEANING", "TRANSFORMATION", "LABELING", "AUGMENTATION", "ANONYMIZATION", "AGGREGATION", "SPLIT", "MERGE", "DERIVATION", "DELETION"]).default("INGESTION"),
  description: z.string().max(2000).optional(),
  inputRef: z.string().max(300).optional(),
  outputRef: z.string().max(300).optional(),
  tool: z.string().max(200).optional(),
  performedAt: z.string().datetime().optional(),
  reversible: z.boolean().default(false),
  evidenceId: z.string().optional(),
});

/** Append a provenance step; the step number is assigned server-side. */
export async function addDataLineageStep(input: z.infer<typeof lineageSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = lineageSchema.parse(input);
  const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: data.datasetId }), select: { id: true } });
  if (!dataset) throw new Error("El dataset no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  const existing = await prisma.dataLineage.findMany({ where: { organizationId: ctx.organization.id, datasetId: data.datasetId }, select: { step: true } });
  const step = data.step ?? nextLineageStep(existing);
  const created = await prisma.dataLineage.create({
    data: tenantData(ctx, {
      datasetId: data.datasetId, step, operation: data.operation, description: data.description ?? null,
      inputRef: data.inputRef ?? null, outputRef: data.outputRef ?? null, tool: data.tool ?? null,
      performedById: ctx.user.id, performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      reversible: data.reversible, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { datasetId: data.datasetId, step, operation: data.operation }, extra: { event: "add_data_lineage" } });
  revalidate();
  return { id: created.id, step };
}

// ─────────────────────────────────────────────────────
// Model versions, evaluation and explainability (§A.6.2.4)
// ─────────────────────────────────────────────────────

const modelSchema = z.object({
  systemId: z.string().min(1),
  code: z.string().max(40).optional(),
  modelName: z.string().min(1).max(200),
  version: z.string().min(1).max(40),
  algorithm: z.string().max(200).optional(),
  framework: z.string().max(200).optional(),
  baseModel: z.string().max(200).optional(),
  provider: z.string().max(200).optional(),
  trainingDatasetId: z.string().optional(),
  trainingSummary: z.string().max(4000).optional(),
  hyperparameters: z.any().optional(),
  explainabilityMethod: z.string().max(200).optional(),
  explainabilityNote: z.string().max(2000).optional(),
  limitations: z.string().max(2000).optional(),
  intendedUse: z.string().max(2000).optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createModelVersion(input: z.infer<typeof modelSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = modelSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  if (data.trainingDatasetId) {
    const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: data.trainingDatasetId }), select: { id: true } });
    if (!dataset) throw new Error("El dataset de entrenamiento no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("MOD", prisma.modelVersion.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.modelVersion.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId, modelName: data.modelName, version: data.version, algorithm: data.algorithm ?? null,
      framework: data.framework ?? null, baseModel: data.baseModel ?? null, provider: data.provider ?? null,
      trainingDatasetId: data.trainingDatasetId ?? null, trainingSummary: data.trainingSummary ?? null,
      hyperparameters: data.hyperparameters ?? undefined, explainabilityMethod: data.explainabilityMethod ?? null,
      explainabilityNote: data.explainabilityNote ?? null, limitations: data.limitations ?? null,
      intendedUse: data.intendedUse ?? null, stage: "DEVELOPMENT", reviewStatus: "DRAFT",
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, modelName: data.modelName, version: data.version }, extra: { event: "create_model_version" } });
  revalidate();
  return { id: created.id, code };
}

const evaluationSchema = z.object({
  modelVersionId: z.string().min(1),
  datasetId: z.string().optional(),
  code: z.string().max(40).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  precision: z.number().min(0).max(1).optional(),
  recall: z.number().min(0).max(1).optional(),
  f1Score: z.number().min(0).max(1).optional(),
  aucRoc: z.number().min(0).max(1).optional(),
  errorRate: z.number().min(0).max(1).optional(),
  fairnessMetric: z.string().max(200).optional(),
  fairnessScore: z.number().min(0).max(1).optional(),
  biasDetected: z.boolean().default(false),
  biasGroups: z.string().max(2000).optional(),
  disparityRatio: z.number().min(0).optional(),
  robustness: z.string().max(2000).optional(),
  adversarialTested: z.boolean().default(false),
  explainabilityAssessed: z.boolean().default(false),
  explainabilityNote: z.string().max(2000).optional(),
  thresholds: z.any().optional(),
  outcome: z.enum(["NOT_EVALUATED", "PASSED", "PASSED_WITH_CONDITIONS", "FAILED"]).default("NOT_EVALUATED"),
  findings: z.string().max(4000).optional(),
  conditions: z.string().max(2000).optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
  evaluatedAt: z.string().datetime().optional(),
});

/** Evaluate a model: performance, fairness, robustness and explainability. */
export async function createModelEvaluation(input: z.infer<typeof evaluationSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = evaluationSchema.parse(input);
  const model = await prisma.modelVersion.findFirst({ where: tenantWhere(ctx, { id: data.modelVersionId }), select: { id: true, code: true } });
  if (!model) throw new Error("La versión del modelo no pertenece a la organización.");
  if (data.datasetId) {
    const dataset = await prisma.dataset.findFirst({ where: tenantWhere(ctx, { id: data.datasetId }), select: { id: true } });
    if (!dataset) throw new Error("El dataset de evaluación no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, evidenceId: data.evidenceId });
  // Un resultado condicionado sin condiciones documentadas no es auditable.
  if (data.outcome === "PASSED_WITH_CONDITIONS" && !data.conditions) {
    throw new Error("Una evaluación aprobada con condiciones debe documentar cuáles son.");
  }
  const code = data.code ?? await nextCode("EVM", prisma.modelEvaluation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.modelEvaluation.create({
    data: tenantData(ctx, {
      code, modelVersionId: data.modelVersionId, datasetId: data.datasetId ?? null, evaluatorId: ctx.user.id,
      evaluatedAt: data.evaluatedAt ? new Date(data.evaluatedAt) : new Date(),
      accuracy: data.accuracy ?? null, precision: data.precision ?? null, recall: data.recall ?? null,
      f1Score: data.f1Score ?? null, aucRoc: data.aucRoc ?? null, errorRate: data.errorRate ?? null,
      fairnessMetric: data.fairnessMetric ?? null, fairnessScore: data.fairnessScore ?? null,
      biasDetected: data.biasDetected, biasGroups: data.biasGroups ?? null, disparityRatio: data.disparityRatio ?? null,
      robustness: data.robustness ?? null, adversarialTested: data.adversarialTested,
      explainabilityAssessed: data.explainabilityAssessed, explainabilityNote: data.explainabilityNote ?? null,
      thresholds: data.thresholds ?? undefined, outcome: data.outcome, findings: data.findings ?? null,
      conditions: data.conditions ?? null, capaId: data.capaId ?? null, evidenceId: data.evidenceId ?? null,
      createdById: ctx.user.id,
    }),
  });
  // Evaluar un modelo lo mueve a la etapa de evaluación sin tocar los ya desplegados.
  if (data.outcome !== "NOT_EVALUATED") {
    await prisma.modelVersion.updateMany({ where: { id: data.modelVersionId, organizationId: ctx.organization.id, stage: "DEVELOPMENT" }, data: { stage: "EVALUATION" } });
  }
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, outcome: data.outcome, biasDetected: data.biasDetected }, extra: { event: "create_model_evaluation" } });
  revalidate();
  return { id: created.id, code };
}

/**
 * Promote an approved model to production. Requires human approval, a passed
 * evaluation and a bias-reviewed training dataset.
 */
export async function promoteModelToProduction(id: string, note?: string) {
  const ctx = await requirePermission("aims:approve");
  const model = await prisma.modelVersion.findFirst({
    where: tenantWhere(ctx, { id }),
    include: { trainingDataset: { select: { code: true, biasReviewed: true, qualityLevel: true } }, evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } },
  });
  if (!model) throw new Error("Versión del modelo no encontrada.");
  if (model.reviewStatus !== "APPROVED") throw new Error("El modelo requiere aprobación humana (HUMAN_REVIEW → APPROVED) antes de pasar a producción.");
  const evaluation = model.evaluations[0];
  if (!evaluation || evaluation.outcome === "FAILED" || evaluation.outcome === "NOT_EVALUATED") {
    throw new Error("El modelo requiere una evaluación superada antes de pasar a producción.");
  }
  if (model.trainingDataset && !isDatasetFitForTraining(model.trainingDataset)) {
    throw new Error(`El dataset de entrenamiento ${model.trainingDataset.code} no es apto: requiere revisión de sesgo y calidad suficiente.`);
  }

  await prisma.$transaction([
    // Un solo modelo por sistema en producción: el anterior queda obsoleto.
    prisma.modelVersion.updateMany({ where: { organizationId: ctx.organization.id, systemId: model.systemId, stage: "PRODUCTION", id: { not: id } }, data: { stage: "DEPRECATED" } }),
    prisma.modelVersion.update({ where: { id }, data: { stage: "PRODUCTION", deployedAt: new Date() } }),
  ]);
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { stage: model.stage }, after: { stage: "PRODUCTION" }, extra: { event: "promote_model", note } });
  revalidate();
  return { id, stage: "PRODUCTION" };
}

// ─────────────────────────────────────────────────────
// Human oversight (§A.9.2) and transparency (§A.8)
// ─────────────────────────────────────────────────────

const oversightSchema = z.object({
  systemId: z.string().min(1),
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "DUAL_CONTROL", "SAMPLING_REVIEW", "APPEAL_CHANNEL"]).default("HUMAN_IN_THE_LOOP"),
  description: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  competence: z.string().max(2000).optional(),
  trainingCourseId: z.string().optional(),
  canOverride: z.boolean().default(true),
  canStop: z.boolean().default(true),
  escalationPath: z.string().max(2000).optional(),
  frequency: z.string().max(200).optional(),
  controlId: z.string().optional(),
  documentId: z.string().optional(),
  nextReviewDate: z.string().datetime().optional(),
});

export async function createOversightControl(input: z.infer<typeof oversightSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = oversightSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { trainingCourseId: data.trainingCourseId, controlId: data.controlId, documentId: data.documentId });
  // Un control que no puede anular ni detener el sistema no es supervisión real.
  if (!data.canOverride && !data.canStop) {
    throw new Error("Un control de supervisión humana debe permitir al menos anular la decisión o detener el sistema.");
  }
  const code = data.code ?? await nextCode("SUP", prisma.humanOversightControl.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.humanOversightControl.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId, name: data.name, type: data.type, description: data.description ?? null,
      responsibleId: data.responsibleId ?? null, competence: data.competence ?? null,
      trainingCourseId: data.trainingCourseId ?? null, canOverride: data.canOverride, canStop: data.canStop,
      escalationPath: data.escalationPath ?? null, frequency: data.frequency ?? null, controlId: data.controlId ?? null,
      documentId: data.documentId ?? null, nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, type: data.type }, extra: { event: "create_oversight_control" } });
  revalidate();
  return { id: created.id, code };
}

/** Verify a human oversight control works and how effective it is (0..100). */
export async function verifyOversightControl(id: string, effectiveness: number, evidenceId?: string) {
  const ctx = await requirePermission("aims:update");
  const control = await prisma.humanOversightControl.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true } });
  if (!control) throw new Error("Control de supervisión no encontrado.");
  const value = z.number().int().min(0).max(100).parse(effectiveness);
  await assertRefInOrg(ctx.organization.id, { evidenceId });
  await prisma.humanOversightControl.update({ where: { id }, data: { effectiveness: value, lastVerifiedAt: new Date(), ...(evidenceId ? { evidenceId } : {}) } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { effectiveness: value }, extra: { event: "verify_oversight_control" } });
  revalidate();
  return { id, effectiveness: value };
}

const transparencySchema = z.object({
  systemId: z.string().min(1),
  code: z.string().max(40).optional(),
  audience: z.enum(["END_USER", "DATA_SUBJECT", "CUSTOMER", "WORKER", "REGULATOR", "PUBLIC", "INTERNAL"]).default("END_USER"),
  disclosure: z.string().min(1).max(8000),
  aiUseDisclosed: z.boolean().default(true),
  limitationsDisclosed: z.boolean().default(false),
  dataUseDisclosed: z.boolean().default(false),
  humanContactOffered: z.boolean().default(false),
  channel: z.string().max(300).optional(),
  language: z.string().max(20).optional(),
  version: z.string().max(20).default("1"),
  responsibleId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  nextReviewDate: z.string().datetime().optional(),
});

export async function createTransparencyRecord(input: z.infer<typeof transparencySchema>) {
  const ctx = await requirePermission("aims:create");
  const data = transparencySchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true, autonomy: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  // El aviso a personas afectadas carece de sentido si oculta que hay IA.
  if (!data.aiUseDisclosed && (data.audience === "END_USER" || data.audience === "DATA_SUBJECT")) {
    throw new Error("La información dirigida a usuarios o personas afectadas debe declarar el uso de IA.");
  }
  const code = data.code ?? await nextCode("TRA", prisma.aITransparencyRecord.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aITransparencyRecord.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId, audience: data.audience, disclosure: data.disclosure,
      aiUseDisclosed: data.aiUseDisclosed, limitationsDisclosed: data.limitationsDisclosed,
      dataUseDisclosed: data.dataUseDisclosed, humanContactOffered: data.humanContactOffered,
      channel: data.channel ?? null, language: data.language ?? null, version: data.version,
      responsibleId: data.responsibleId ?? null, documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, audience: data.audience }, extra: { event: "create_transparency_record" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// AI incidents (§A.10.4) — strict linear investigation
// ─────────────────────────────────────────────────────

const incidentSchema = z.object({
  systemId: z.string().optional(),
  modelVersionId: z.string().optional(),
  code: z.string().max(40).optional(),
  type: z.enum(["HARMFUL_OUTPUT", "BIAS_DISCRIMINATION", "PRIVACY_BREACH", "SECURITY_BREACH", "HALLUCINATION", "PERFORMANCE_DEGRADATION", "DATA_DRIFT", "MISUSE", "UNAVAILABILITY", "UNAPPROVED_AUTOMATION", "OTHER"]).default("OTHER"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  detectedAt: z.string().datetime().optional(),
  occurredAt: z.string().datetime().optional(),
  detectedBy: z.string().max(200).optional(),
  affectedParties: z.string().max(2000).optional(),
  affectedCount: z.number().int().min(0).optional(),
  harmDescription: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export async function reportAIIncident(input: z.infer<typeof incidentSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = incidentSchema.parse(input);
  if (data.systemId) {
    const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
    if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  }
  if (data.modelVersionId) {
    const model = await prisma.modelVersion.findFirst({ where: tenantWhere(ctx, { id: data.modelVersionId }), select: { id: true } });
    if (!model) throw new Error("La versión del modelo no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("IAI", prisma.aIIncident.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIIncident.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId ?? null, modelVersionId: data.modelVersionId ?? null, type: data.type,
      severity: data.severity, title: data.title, description: data.description ?? null,
      detectedAt: data.detectedAt ? new Date(data.detectedAt) : new Date(),
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : null, detectedBy: data.detectedBy ?? null,
      reporterId: ctx.user.id, affectedParties: data.affectedParties ?? null, affectedCount: data.affectedCount ?? null,
      harmDescription: data.harmDescription ?? null, status: "REPORTED",
      notificationRequired: requiresNotificationDecision(data.type, data.affectedCount),
      responsibleId: data.responsibleId ?? null, dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, type: data.type, severity: data.severity }, extra: { event: "report_ai_incident" } });
  if (data.responsibleId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `Incidente de IA: ${code}`, body: `${data.title} (${data.type}, severidad ${data.severity}).`, type: data.severity === "CRITICAL" || data.severity === "HIGH" ? "ALERT" : "WARNING", link: "/app/aims", idempotencyKey: `ai-incident:${created.id}:reported` });
  }
  revalidate();
  return { id: created.id, code };
}

const incidentTransitionSchema = z.object({
  to: z.enum(["TRIAGED", "INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"]),
  investigation: z.string().max(8000).optional(),
  rootCause: z.string().max(4000).optional(),
  rootCauseMethod: z.string().max(120).optional(),
  containment: z.string().max(4000).optional(),
  correctiveActions: z.string().max(4000).optional(),
  notificationRequired: z.boolean().optional(),
  notificationDetails: z.string().max(4000).optional(),
  notified: z.boolean().optional(),
  lessonsLearned: z.string().max(4000).optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
  note: z.string().max(2000).optional(),
});

/** Advance an AI incident exactly one step; jumps and rollbacks are rejected. */
export async function transitionAIIncident(id: string, input: z.infer<typeof incidentTransitionSchema>) {
  const ctx = await requirePermission("aims:update");
  const data = incidentTransitionSchema.parse(input);
  const incident = await prisma.aIIncident.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!incident) throw new Error("Incidente de IA no encontrado.");
  assertAIIncidentTransition(incident.status, data.to as AIIncidentStatus);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, evidenceId: data.evidenceId });

  const rootCause = data.rootCause ?? incident.rootCause;
  if (data.to === "ROOT_CAUSE" && !rootCause) throw new Error("Para cerrar la fase de causa raíz debe documentarse la causa identificada.");
  // Daño a personas o brecha: la obligación de notificar se decide, no se omite.
  const notificationRequired = data.notificationRequired ?? incident.notificationRequired;
  if (data.to === "CLOSED" && notificationRequired && !(data.notified ?? incident.notifiedAt)) {
    throw new Error("El incidente exige notificación: registre la comunicación antes de cerrarlo.");
  }

  await prisma.aIIncident.update({ where: { id }, data: {
    status: data.to,
    ...(data.investigation !== undefined ? { investigation: data.investigation } : {}),
    ...(data.rootCause !== undefined ? { rootCause: data.rootCause } : {}),
    ...(data.rootCauseMethod !== undefined ? { rootCauseMethod: data.rootCauseMethod } : {}),
    ...(data.containment !== undefined ? { containment: data.containment } : {}),
    ...(data.correctiveActions !== undefined ? { correctiveActions: data.correctiveActions } : {}),
    ...(data.notificationRequired !== undefined ? { notificationRequired: data.notificationRequired } : {}),
    ...(data.notificationDetails !== undefined ? { notificationDetails: data.notificationDetails } : {}),
    ...(data.notified ? { notifiedAt: incident.notifiedAt ?? new Date() } : {}),
    ...(data.lessonsLearned !== undefined ? { lessonsLearned: data.lessonsLearned } : {}),
    ...(data.capaId !== undefined ? { capaId: data.capaId } : {}),
    ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    ...(data.to === "CLOSED" ? { closedAt: new Date() } : {}),
  } });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { status: incident.status }, after: { status: data.to }, extra: { event: "transition_ai_incident", note: data.note } });
  if (incident.responsibleId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: incident.responsibleId, title: `Incidente de IA ${incident.code}: ${data.to}`, body: `"${incident.title}" avanzó a ${data.to}.`, type: data.to === "CLOSED" ? "SUCCESS" : "INFO", link: "/app/aims", idempotencyKey: `ai-incident:${id}:${data.to}` });
  }
  revalidate();
  return { id, status: data.to };
}

// ─────────────────────────────────────────────────────
// AI suppliers (§A.10.2)
// ─────────────────────────────────────────────────────

const supplierSchema = z.object({
  supplierId: z.string().optional(),
  systemId: z.string().optional(),
  code: z.string().max(40).optional(),
  supplierName: z.string().min(1).max(200),
  serviceType: z.enum(["FOUNDATION_MODEL", "MODEL_API", "DATASET", "ANNOTATION", "MLOPS_PLATFORM", "EMBEDDED_FEATURE", "CONSULTING", "OTHER"]).default("OTHER"),
  modelDocumentation: z.boolean().default(false),
  trainingDataDisclosed: z.boolean().default(false),
  evaluationResultsShared: z.boolean().default(false),
  biasTestingEvidence: z.boolean().default(false),
  securityCertification: z.string().max(300).optional(),
  dataProcessingTerms: z.string().max(2000).optional(),
  subprocessors: z.string().max(2000).optional(),
  dataResidency: z.string().max(300).optional(),
  usesCustomerDataForTraining: z.boolean().default(false),
  incidentNotificationSla: z.string().max(300).optional(),
  exitPlan: z.string().max(2000).optional(),
  risks: z.string().max(2000).optional(),
  requirements: z.string().max(2000).optional(),
  outcome: z.enum(["UNDER_REVIEW", "APPROVED", "CONDITIONAL", "REJECTED"]).default("UNDER_REVIEW"),
  score: z.number().int().min(0).max(100).optional(),
  assessedAt: z.string().datetime().optional(),
  nextReviewDate: z.string().datetime().optional(),
  contractExpiry: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
  documentId: z.string().optional(),
});

export async function createSupplierAssessment(input: z.infer<typeof supplierSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = supplierSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, evidenceId: data.evidenceId, documentId: data.documentId });
  if (data.systemId) {
    const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
    if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("PIA", prisma.aISupplierAssessment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aISupplierAssessment.create({
    data: tenantData(ctx, {
      code, supplierId: data.supplierId ?? null, systemId: data.systemId ?? null, supplierName: data.supplierName,
      serviceType: data.serviceType, modelDocumentation: data.modelDocumentation, trainingDataDisclosed: data.trainingDataDisclosed,
      evaluationResultsShared: data.evaluationResultsShared, biasTestingEvidence: data.biasTestingEvidence,
      securityCertification: data.securityCertification ?? null, dataProcessingTerms: data.dataProcessingTerms ?? null,
      subprocessors: data.subprocessors ?? null, dataResidency: data.dataResidency ?? null,
      usesCustomerDataForTraining: data.usesCustomerDataForTraining, incidentNotificationSla: data.incidentNotificationSla ?? null,
      exitPlan: data.exitPlan ?? null, risks: data.risks ?? null, requirements: data.requirements ?? null,
      outcome: data.outcome, score: data.score ?? null, assessorId: ctx.user.id,
      assessedAt: data.assessedAt ? new Date(data.assessedAt) : new Date(),
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      contractExpiry: data.contractExpiry ? new Date(data.contractExpiry) : null,
      evidenceId: data.evidenceId ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, supplierName: data.supplierName, outcome: data.outcome }, extra: { event: "create_ai_supplier_assessment" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// Change management (§A.6.2.6)
// ─────────────────────────────────────────────────────

const changeSchema = z.object({
  systemId: z.string().min(1),
  modelVersionId: z.string().optional(),
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  changeType: z.enum(["MODEL_UPDATE", "RETRAINING", "DATA_CHANGE", "PROMPT_CHANGE", "SCOPE_CHANGE", "INTEGRATION", "CONFIGURATION", "THRESHOLD_CHANGE", "DECOMMISSION", "OTHER"]).default("OTHER"),
  description: z.string().max(4000).optional(),
  justification: z.string().max(4000).optional(),
  impactAnalysis: z.string().max(4000).optional(),
  affectsImpactAssessment: z.boolean().default(false),
  requiresReassessment: z.boolean().default(false),
  requiresRetraining: z.boolean().default(false),
  requiresRevalidation: z.boolean().default(false),
  rollbackPlan: z.string().max(4000).optional(),
  changeRequestId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createAIChangeRequest(input: z.infer<typeof changeSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = changeSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  if (data.modelVersionId) {
    const model = await prisma.modelVersion.findFirst({ where: tenantWhere(ctx, { id: data.modelVersionId }), select: { id: true } });
    if (!model) throw new Error("La versión del modelo no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { changeRequestId: data.changeRequestId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("CIA", prisma.aIChangeRequest.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIChangeRequest.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId, modelVersionId: data.modelVersionId ?? null, title: data.title,
      changeType: data.changeType, description: data.description ?? null, justification: data.justification ?? null,
      impactAnalysis: data.impactAnalysis ?? null, affectsImpactAssessment: data.affectsImpactAssessment,
      // Un cambio que toca la evaluación de impacto obliga a reevaluar.
      requiresReassessment: data.requiresReassessment || data.affectsImpactAssessment,
      requiresRetraining: data.requiresRetraining, requiresRevalidation: data.requiresRevalidation,
      rollbackPlan: data.rollbackPlan ?? null, requesterId: ctx.user.id, reviewStatus: "DRAFT",
      changeRequestId: data.changeRequestId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, changeType: data.changeType }, extra: { event: "create_ai_change_request" } });
  revalidate();
  return { id: created.id, code };
}

/** Mark an approved change as implemented; only APPROVED changes can be applied. */
export async function implementAIChangeRequest(id: string, note?: string) {
  const ctx = await requirePermission("aims:update");
  const change = await prisma.aIChangeRequest.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!change) throw new Error("Solicitud de cambio no encontrada.");
  if (change.reviewStatus !== "APPROVED") throw new Error("Un cambio solo puede implementarse tras la aprobación humana.");
  if (change.requiresReassessment) {
    const assessment = await prisma.aIImpactAssessment.findFirst({
      where: { organizationId: ctx.organization.id, systemId: change.systemId, reviewStatus: "APPROVED", assessedAt: { gte: change.reviewedAt ?? change.createdAt } },
      select: { id: true },
    });
    if (!assessment) throw new Error("El cambio exige reevaluar el impacto: registre y apruebe una evaluación posterior a la decisión.");
  }
  await prisma.aIChangeRequest.update({ where: { id }, data: { implementedAt: new Date() } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { implementedAt: new Date().toISOString() }, extra: { event: "implement_ai_change", note } });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Continuous monitoring (§A.6.2.6)
// ─────────────────────────────────────────────────────

const metricSchema = z.object({
  systemId: z.string().min(1),
  modelVersionId: z.string().optional(),
  period: z.string().min(4).max(20),
  periodStart: z.string().datetime().optional(),
  kind: z.enum(["ACCURACY", "PRECISION", "RECALL", "F1", "ERROR_RATE", "LATENCY", "THROUGHPUT", "DRIFT", "FAIRNESS", "TOXICITY", "HALLUCINATION_RATE", "HUMAN_OVERRIDE_RATE", "REJECTION_RATE", "COST", "AVAILABILITY", "OTHER"]).default("OTHER"),
  name: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().max(40).optional(),
  baseline: z.number().optional(),
  threshold: z.number().optional(),
  higherIsBetter: z.boolean().optional(),
  sampleSize: z.number().int().min(0).optional(),
  humanOverrides: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
  indicatorId: z.string().optional(),
  evidenceId: z.string().optional(),
});

/**
 * Record a monitoring measurement. Threshold breaches and drift are derived
 * server-side and an alert is raised for the system owner.
 */
export async function recordPerformanceMetric(input: z.infer<typeof metricSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = metricSchema.parse(input);
  const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true, code: true, name: true, ownerId: true } });
  if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  if (data.modelVersionId) {
    const model = await prisma.modelVersion.findFirst({ where: tenantWhere(ctx, { id: data.modelVersionId }), select: { id: true } });
    if (!model) throw new Error("La versión del modelo no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { indicatorId: data.indicatorId, evidenceId: data.evidenceId });

  const higherIsBetter = data.higherIsBetter ?? defaultHigherIsBetter(data.kind);
  const evaluation = evaluateMetric({ value: data.value, threshold: data.threshold, baseline: data.baseline, higherIsBetter });
  const record = await prisma.aIPerformanceMetric.upsert({
    where: { organizationId_systemId_period_name: { organizationId: ctx.organization.id, systemId: data.systemId, period: data.period, name: data.name } },
    create: tenantData(ctx, {
      systemId: data.systemId, modelVersionId: data.modelVersionId ?? null, period: data.period,
      periodStart: data.periodStart ? new Date(data.periodStart) : null, kind: data.kind, name: data.name,
      value: data.value, unit: data.unit ?? null, baseline: data.baseline ?? null, threshold: data.threshold ?? null,
      higherIsBetter, breached: evaluation.breached, driftDetected: evaluation.driftDetected,
      sampleSize: data.sampleSize ?? null, humanOverrides: data.humanOverrides ?? null, note: data.note ?? null,
      indicatorId: data.indicatorId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
    update: {
      modelVersionId: data.modelVersionId ?? null, kind: data.kind, value: data.value, unit: data.unit ?? null,
      baseline: data.baseline ?? null, threshold: data.threshold ?? null, higherIsBetter,
      breached: evaluation.breached, driftDetected: evaluation.driftDetected,
      sampleSize: data.sampleSize ?? null, humanOverrides: data.humanOverrides ?? null, note: data.note ?? null,
    },
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: record.id, after: { systemId: data.systemId, period: data.period, name: data.name, value: data.value, breached: evaluation.breached, driftDetected: evaluation.driftDetected }, extra: { event: "record_performance_metric" } });
  if ((evaluation.breached || evaluation.driftDetected) && system.ownerId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: system.ownerId, title: `Monitoreo de IA: ${system.code}`, body: `${data.name} = ${data.value}${data.unit ? ` ${data.unit}` : ""} en ${data.period}${evaluation.breached ? " incumple el umbral" : ""}${evaluation.driftDetected ? " y muestra deriva frente a la línea base" : ""}.`, type: "WARNING", link: "/app/aims", idempotencyKey: `ai-metric:${record.id}:${data.value}` });
  }
  revalidate();
  return { id: record.id, ...evaluation };
}

// ─────────────────────────────────────────────────────
// REGLA HUMANA — salidas de IA y decisiones humanas
// ─────────────────────────────────────────────────────

const outputSchema = z.object({
  code: z.string().max(40).optional(),
  systemId: z.string().optional(),
  modelVersionId: z.string().optional(),
  purpose: z.string().max(1000).optional(),
  targetType: z.enum(["DOCUMENT", "RECORD", "RISK", "CAPA", "ACTION", "AUDIT_FINDING", "IMPACT_ASSESSMENT", "ANALYSIS", "COMMUNICATION", "OTHER"]).default("OTHER"),
  prompt: z.string().min(1).max(20000),
  model: z.string().min(1).max(200),
  modelVersionLabel: z.string().min(1).max(80),
  parameters: z.any().optional(),
  output: z.string().min(1).max(100000),
  tokensUsed: z.number().int().min(0).optional(),
  containsPersonalData: z.boolean().default(false),
  redacted: z.boolean().default(false),
});

/**
 * Store an AI output. It always lands in DRAFT: a generated text is never an
 * official record until a person approves it (§A.9.2).
 */
export async function recordAIOutput(input: z.infer<typeof outputSchema>) {
  const ctx = await requirePermission("aims:create");
  const data = outputSchema.parse(input);
  if (data.systemId) {
    const system = await prisma.aISystem.findFirst({ where: tenantWhere(ctx, { id: data.systemId }), select: { id: true } });
    if (!system) throw new Error("El sistema de IA no pertenece a la organización.");
  }
  if (data.modelVersionId) {
    const model = await prisma.modelVersion.findFirst({ where: tenantWhere(ctx, { id: data.modelVersionId }), select: { id: true } });
    if (!model) throw new Error("La versión del modelo no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("IAO", prisma.aIGeneratedOutput.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.aIGeneratedOutput.create({
    data: tenantData(ctx, {
      code, systemId: data.systemId ?? null, modelVersionId: data.modelVersionId ?? null, purpose: data.purpose ?? null,
      targetType: data.targetType, prompt: data.prompt, model: data.model, modelVersionLabel: data.modelVersionLabel,
      parameters: data.parameters ?? undefined, output: data.output, tokensUsed: data.tokensUsed ?? null,
      requestedById: ctx.user.id, generatedAt: new Date(), containsPersonalData: data.containsPersonalData,
      redacted: data.redacted, reviewStatus: "DRAFT", createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, model: data.model, modelVersionLabel: data.modelVersionLabel, reviewStatus: "DRAFT" }, extra: { event: "record_ai_output" } });
  revalidate();
  return { id: created.id, code, reviewStatus: "DRAFT" as AIHumanReviewStatus };
}

/** Human edits over the raw output, kept alongside the original (never over it). */
export async function editAIOutput(id: string, humanEdits: string, editSummary?: string) {
  const ctx = await requirePermission("aims:update");
  const output = await prisma.aIGeneratedOutput.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!output) throw new Error("Salida de IA no encontrada.");
  if (output.reviewStatus === "APPROVED") throw new Error("La salida ya fue aprobada; registre una nueva salida para modificarla.");
  const text = z.string().min(1).max(100000).parse(humanEdits);
  await prisma.aIGeneratedOutput.update({ where: { id }, data: {
    edited: true, humanEdits: text, editSummary: editSummary ?? null, editedById: ctx.user.id, editedAt: new Date(),
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { edited: true, editSummary }, extra: { event: "edit_ai_output" } });
  revalidate();
  return { id, edited: true };
}

const REVIEWABLE = ["output", "impactAssessment", "modelVersion", "changeRequest"] as const;
type ReviewableKind = (typeof REVIEWABLE)[number];

const LABELS: Record<ReviewableKind, string> = {
  output: "Salida de IA",
  impactAssessment: "Evaluación de impacto",
  modelVersion: "Versión del modelo",
  changeRequest: "Solicitud de cambio",
};

/** Common shape of every human-reviewable artifact, whatever its table. */
type Reviewable = { id: string; code: string; reviewStatus: AIHumanReviewStatus; ownerId: string | null };

async function loadReviewable(organizationId: string, kind: ReviewableKind, id: string): Promise<Reviewable> {
  const where = { id, organizationId };
  const select = { id: true, code: true, reviewStatus: true } as const;
  const found = await (async (): Promise<Reviewable | null> => {
    switch (kind) {
      case "output": {
        const row = await prisma.aIGeneratedOutput.findFirst({ where, select: { ...select, requestedById: true } });
        return row && { ...row, ownerId: row.requestedById };
      }
      case "impactAssessment": {
        const row = await prisma.aIImpactAssessment.findFirst({ where, select: { ...select, assessorId: true } });
        return row && { ...row, ownerId: row.assessorId };
      }
      case "modelVersion": {
        const row = await prisma.modelVersion.findFirst({ where, select: { ...select, createdById: true } });
        return row && { ...row, ownerId: row.createdById };
      }
      case "changeRequest": {
        const row = await prisma.aIChangeRequest.findFirst({ where, select: { ...select, requesterId: true } });
        return row && { ...row, ownerId: row.requesterId };
      }
    }
  })();
  if (!found) throw new Error(`${LABELS[kind]} no encontrada.`);
  return found;
}

async function writeReviewable(kind: ReviewableKind, id: string, data: Record<string, unknown>) {
  if (kind === "output") return prisma.aIGeneratedOutput.update({ where: { id }, data });
  if (kind === "impactAssessment") return prisma.aIImpactAssessment.update({ where: { id }, data });
  if (kind === "modelVersion") return prisma.modelVersion.update({ where: { id }, data });
  return prisma.aIChangeRequest.update({ where: { id }, data });
}

/**
 * Send an artifact to human review (DRAFT → HUMAN_REVIEW). Whoever submits it
 * may not be the one who decides: approval requires `aims:approve`.
 */
export async function submitForHumanReview(kind: ReviewableKind, id: string) {
  const ctx = await requirePermission("aims:update");
  const row = await loadReviewable(ctx.organization.id, kind, id);
  assertHumanReviewTransition(row.reviewStatus, "HUMAN_REVIEW");
  await writeReviewable(kind, id, { reviewStatus: "HUMAN_REVIEW", submittedAt: new Date() });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { reviewStatus: row.reviewStatus }, after: { reviewStatus: "HUMAN_REVIEW" }, extra: { event: "submit_human_review", kind } });
  revalidate();
  return { id, reviewStatus: "HUMAN_REVIEW" as AIHumanReviewStatus };
}

const decisionSchema = z.object({
  to: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(4000).optional(),
});

/**
 * The human decision itself. Records who decided and when; nothing reaches
 * APPROVED without going through HUMAN_REVIEW first (CHECK-enforced too).
 */
export async function decideHumanReview(kind: ReviewableKind, id: string, input: z.infer<typeof decisionSchema>) {
  const ctx = await requirePermission("aims:approve");
  const data = decisionSchema.parse(input);
  const row = await loadReviewable(ctx.organization.id, kind, id);
  assertHumanReviewTransition(row.reviewStatus, data.to);
  assertReviewerPresent(data.to, ctx.user.id);
  if (data.to === "REJECTED" && !data.note) throw new Error("Un rechazo debe motivarse para que la persona responsable pueda corregirlo.");

  await writeReviewable(kind, id, { reviewStatus: data.to, reviewerId: ctx.user.id, reviewedAt: new Date(), decisionNote: data.note ?? null });
  await logAuditEvent({ ctx, action: data.to === "APPROVED" ? "approve" : "reject", module: MODULE, recordId: id, before: { reviewStatus: row.reviewStatus }, after: { reviewStatus: data.to, reviewerId: ctx.user.id }, extra: { event: "decide_human_review", kind, note: data.note } });
  if (row.ownerId && row.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: row.ownerId, title: `${LABELS[kind]} ${row.code}: ${data.to === "APPROVED" ? "aprobada" : "rechazada"}`, body: data.note ?? `Decisión humana registrada por ${ctx.user.name ?? "el revisor"}.`, type: data.to === "APPROVED" ? "SUCCESS" : "WARNING", link: "/app/aims", idempotencyKey: `aims:${kind}:${id}:${data.to}` });
  }
  revalidate();
  return { id, reviewStatus: data.to };
}

/** Return a rejected artifact to DRAFT so it can be corrected and resubmitted. */
export async function reopenForCorrection(kind: ReviewableKind, id: string) {
  const ctx = await requirePermission("aims:update");
  const row = await loadReviewable(ctx.organization.id, kind, id);
  assertHumanReviewTransition(row.reviewStatus, "DRAFT");
  await writeReviewable(kind, id, { reviewStatus: "DRAFT", submittedAt: null, reviewerId: null, reviewedAt: null });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { reviewStatus: row.reviewStatus }, after: { reviewStatus: "DRAFT" }, extra: { event: "reopen_human_review", kind } });
  revalidate();
  return { id, reviewStatus: "DRAFT" as AIHumanReviewStatus };
}

const promotionSchema = z.object({
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(120),
});

/**
 * The only gate that turns an AI output into an official record. Requires
 * APPROVED status and is idempotent per output: a single promotion, traceable
 * back to the prompt, the model, the reviewer and the human edits.
 */
export async function promoteAIOutput(id: string, input: z.infer<typeof promotionSchema>) {
  const ctx = await requirePermission("aims:approve");
  const data = promotionSchema.parse(input);
  const output = await prisma.aIGeneratedOutput.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true, reviewStatus: true, promotedAt: true } });
  if (!output) throw new Error("Salida de IA no encontrada.");
  if (output.promotedAt) throw new Error("La salida ya se promovió a un registro oficial.");
  assertPromotable(output.reviewStatus);
  await prisma.aIGeneratedOutput.update({ where: { id }, data: { promotedEntityType: data.entityType, promotedEntityId: data.entityId, promotedAt: new Date() } });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, after: { promotedEntityType: data.entityType, promotedEntityId: data.entityId }, extra: { event: "promote_ai_output" } });
  revalidate();
  return { id, promotedEntityType: data.entityType, promotedEntityId: data.entityId };
}
