"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { assertApplicabilityDecision, rollupApplicability, statusForApplicability } from "@/lib/compliance/applicability";
import { aggregateControlEffectiveness, assertRiskAcceptance, computeComplianceRisk } from "@/lib/compliance/risk";
import { assertCalendarCompletion, calendarState, nextOccurrence } from "@/lib/compliance/calendar";
import {
  assertFindingsForNonCompliance,
  assertReviewTransition,
  assertReviewerPresent,
  statusFromResult,
} from "@/lib/compliance/evaluation";
import {
  assertBreachClosure,
  assertBreachTransition,
  notificationDeadline,
  requiresNotificationDecision,
} from "@/lib/compliance/breach";
import {
  assertApproved,
  assertEffectivenessVerification,
  assertRemediationTransition,
  effectiveStatus,
} from "@/lib/compliance/remediation";
import { assertAcknowledgement } from "@/lib/compliance/governing-body";
import type { BreachStatus, ComplianceReviewStatus, RemediationPlanStatus } from "@prisma/client";

const MODULE = "compliance";
const revalidate = () => {
  revalidatePath("/app/compliance");
  revalidatePath("/app/activity");
};

/** Verify an optional cross-module reference belongs to the caller's org. */
async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "riskId" | "capaId" | "evidenceId" | "documentId" | "supplierId" | "controlId" | "trainingCourseId" | "changeRequestId" | "actionId" | "ncId" | "managementReviewId" | "requirementId" | "breachId",
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
  if (refs.actionId) guard(prisma.action.findFirst(w(refs.actionId)), "de acción");
  if (refs.ncId) guard(prisma.nonconformity.findFirst(w(refs.ncId)), "de no conformidad");
  if (refs.managementReviewId) guard(prisma.managementReview.findFirst(w(refs.managementReviewId)), "de revisión por la dirección");
  if (refs.breachId) guard(prisma.complianceBreach.findFirst(w(refs.breachId)), "de incumplimiento");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

/** Best-effort in-app + email notification; never blocks the business action. */
async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[compliance] notify failed:", e instanceof Error ? e.message : e); }
}

const FREQUENCY = ["CONTINUOUS", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL", "ON_EVENT"] as const;
const CRITICALITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CATEGORY = [
  "ANTIBRIBERY", "ANTI_MONEY_LAUNDERING", "DATA_PROTECTION", "COMPETITION", "LABOR", "OCCUPATIONAL_SAFETY",
  "ENVIRONMENTAL", "TAX", "FINANCIAL_REPORTING", "CONSUMER_PROTECTION", "TRADE_SANCTIONS", "INFORMATION_SECURITY",
  "SECTOR_SPECIFIC", "CORPORATE_GOVERNANCE", "HUMAN_RIGHTS", "OTHER",
] as const;

// ─────────────────────────────────────────────────────
// Jurisdicciones (§4.1, §4.6)
// ─────────────────────────────────────────────────────

const jurisdictionSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  level: z.enum(["SUPRANATIONAL", "NATIONAL", "REGIONAL", "LOCAL", "SECTORAL"]).default("NATIONAL"),
  parentId: z.string().optional(),
  country: z.string().max(80).optional(),
  authority: z.string().max(200).optional(),
  applicable: z.boolean().default(true),
  rationale: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createJurisdiction(input: z.infer<typeof jurisdictionSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = jurisdictionSchema.parse(input);
  if (data.parentId) {
    const parent = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.parentId }), select: { id: true } });
    if (!parent) throw new Error("La jurisdicción superior no pertenece a la organización.");
  }
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.jurisdiction.create({
      data: tenantData(ctx, {
        code: data.code, name: data.name, level: data.level, parentId: data.parentId ?? null,
        country: data.country ?? null, authority: data.authority ?? null, applicable: data.applicable,
        rationale: data.rationale ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code: data.code, name: data.name, level: data.level }, extra: { event: "create_jurisdiction" } });
    return row;
  });
  revalidate();
  return { id: created.id, code: created.code };
}

export async function updateJurisdiction(id: string, input: Partial<z.infer<typeof jurisdictionSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = jurisdictionSchema.partial().parse(input);
  const current = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Jurisdicción no encontrada.");
  if (data.parentId) {
    if (data.parentId === id) throw new Error("Una jurisdicción no puede ser su propia superior.");
    const parent = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.parentId }), select: { id: true } });
    if (!parent) throw new Error("La jurisdicción superior no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.jurisdiction.update({ where: { id }, data: {
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.level !== undefined ? { level: data.level } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
      ...(data.country !== undefined ? { country: data.country || null } : {}),
      ...(data.authority !== undefined ? { authority: data.authority || null } : {}),
      ...(data.applicable !== undefined ? { applicable: data.applicable } : {}),
      ...(data.rationale !== undefined ? { rationale: data.rationale || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { code: current.code, name: current.name, applicable: current.applicable }, after: data, extra: { event: "update_jurisdiction" } });
  });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Fuentes regulatorias vigiladas (§4.6, §8.1)
// ─────────────────────────────────────────────────────

const sourceSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(300),
  sourceType: z.enum(["LAW", "DECREE", "REGULATION", "DIRECTIVE", "RESOLUTION", "ORDINANCE", "CASE_LAW", "STANDARD", "CODE_OF_CONDUCT", "CONTRACT", "LICENSE", "INTERNAL_POLICY", "OTHER"]).default("LAW"),
  issuer: z.string().max(200).optional(),
  reference: z.string().max(200).optional(),
  officialUrl: z.string().url().max(500).optional(),
  jurisdictionId: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  effectiveFrom: z.string().datetime().optional(),
  monitored: z.boolean().default(true),
  monitoringFrequency: z.enum(FREQUENCY).default("QUARTERLY"),
  ownerId: z.string().optional(),
  documentId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createRegulatorySource(input: z.infer<typeof sourceSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = sourceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  if (data.jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true } });
    if (!jurisdiction) throw new Error("La jurisdicción no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("FR", prisma.regulatorySource.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.regulatorySource.create({
      data: tenantData(ctx, {
        code, name: data.name, sourceType: data.sourceType, issuer: data.issuer ?? null, reference: data.reference ?? null,
        officialUrl: data.officialUrl ?? null, jurisdictionId: data.jurisdictionId ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
        monitored: data.monitored, monitoringFrequency: data.monitoringFrequency, ownerId: data.ownerId ?? null,
        documentId: data.documentId ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, name: data.name, monitored: data.monitored }, extra: { event: "create_regulatory_source" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

/** Registra una revisión de vigilancia y programa la siguiente según su frecuencia. */
export async function recordSourceCheck(id: string, input: { note?: string; changeDetected?: boolean }) {
  const ctx = await requirePermission("compliance:update");
  const source = await prisma.regulatorySource.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!source) throw new Error("Fuente regulatoria no encontrada.");
  const now = new Date();
  const next = nextOccurrence(now, source.monitoringFrequency === "CONTINUOUS" || source.monitoringFrequency === "ON_EVENT" ? "MONTHLY" : source.monitoringFrequency === "WEEKLY" ? "MONTHLY" : source.monitoringFrequency);
  await prisma.$transaction(async (tx) => {
    await tx.regulatorySource.update({ where: { id }, data: { lastCheckedAt: now, nextCheckDate: next } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { lastCheckedAt: now, nextCheckDate: next }, extra: { event: "record_source_check", note: input.note, changeDetected: input.changeDetected ?? false } });
  });
  revalidate();
  return { id, nextCheckDate: next };
}

export async function updateRegulatorySource(id: string, input: Partial<z.infer<typeof sourceSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = sourceSchema.partial().parse(input);
  const current = await prisma.regulatorySource.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Fuente regulatoria no encontrada.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  if (data.jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true } });
    if (!jurisdiction) throw new Error("La jurisdicción no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.regulatorySource.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sourceType !== undefined ? { sourceType: data.sourceType } : {}),
      ...(data.issuer !== undefined ? { issuer: data.issuer || null } : {}),
      ...(data.reference !== undefined ? { reference: data.reference || null } : {}),
      ...(data.officialUrl !== undefined ? { officialUrl: data.officialUrl || null } : {}),
      ...(data.jurisdictionId !== undefined ? { jurisdictionId: data.jurisdictionId || null } : {}),
      ...(data.monitored !== undefined ? { monitored: data.monitored } : {}),
      ...(data.monitoringFrequency !== undefined ? { monitoringFrequency: data.monitoringFrequency } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { name: current.name, monitored: current.monitored }, after: data, extra: { event: "update_regulatory_source" } });
  });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Registro de obligaciones (§4.6)
// ─────────────────────────────────────────────────────

const obligationSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  requirementText: z.string().max(8000).optional(),
  obligationType: z.enum(["LEGAL", "REGULATORY", "CONTRACTUAL", "VOLUNTARY_COMMITMENT", "STANDARD", "INTERNAL_POLICY", "LICENSE_CONDITION", "OTHER"]).default("LEGAL"),
  category: z.enum(CATEGORY).default("OTHER"),
  sourceId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  articleReference: z.string().max(200).optional(),
  ownerId: z.string().optional(),
  accountableId: z.string().optional(),
  criticality: z.enum(CRITICALITY).default("MEDIUM"),
  sanctionDescription: z.string().max(2000).optional(),
  maxSanctionAmount: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  evidenceRequired: z.string().max(2000).optional(),
  evaluationFrequency: z.enum(FREQUENCY).default("ANNUAL"),
  nextEvaluationDate: z.string().datetime().optional(),
  effectiveFrom: z.string().datetime().optional(),
  processId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
  requirementId: z.string().optional(),
});

export async function createComplianceObligation(input: z.infer<typeof obligationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = obligationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId, evidenceId: data.evidenceId });
  if (data.sourceId) {
    const source = await prisma.regulatorySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }), select: { id: true } });
    if (!source) throw new Error("La fuente regulatoria no pertenece a la organización.");
  }
  if (data.jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true } });
    if (!jurisdiction) throw new Error("La jurisdicción no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("OBL", prisma.complianceObligation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceObligation.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null, requirementText: data.requirementText ?? null,
        obligationType: data.obligationType, category: data.category, sourceId: data.sourceId ?? null,
        jurisdictionId: data.jurisdictionId ?? null, articleReference: data.articleReference ?? null,
        ownerId: data.ownerId ?? null, accountableId: data.accountableId ?? null, criticality: data.criticality,
        sanctionDescription: data.sanctionDescription ?? null, maxSanctionAmount: data.maxSanctionAmount ?? null,
        currency: data.currency ?? null, evidenceRequired: data.evidenceRequired ?? null,
        evaluationFrequency: data.evaluationFrequency,
        nextEvaluationDate: data.nextEvaluationDate ? new Date(data.nextEvaluationDate) : null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
        processId: data.processId ?? null, documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
        requirementId: data.requirementId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, category: data.category, criticality: data.criticality }, extra: { event: "create_obligation" } });
    return row;
  });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.ownerId, title: `Obligación asignada: ${code}`, body: `Es responsable de "${data.title}".`, type: "INFO", link: "/app/compliance", idempotencyKey: `obligation:${created.id}:owner` });
  }
  revalidate();
  return { id: created.id, code };
}

export async function updateComplianceObligation(id: string, input: Partial<z.infer<typeof obligationSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const existing = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, ownerId: true } });
  if (!existing) throw new Error("Obligación no encontrada.");
  const data = obligationSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId, evidenceId: data.evidenceId });
  await prisma.$transaction(async (tx) => {
    await tx.complianceObligation.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.requirementText !== undefined ? { requirementText: data.requirementText } : {}),
      ...(data.obligationType !== undefined ? { obligationType: data.obligationType } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      ...(data.accountableId !== undefined ? { accountableId: data.accountableId } : {}),
      ...(data.criticality !== undefined ? { criticality: data.criticality } : {}),
      ...(data.sanctionDescription !== undefined ? { sanctionDescription: data.sanctionDescription } : {}),
      ...(data.maxSanctionAmount !== undefined ? { maxSanctionAmount: data.maxSanctionAmount } : {}),
      ...(data.evidenceRequired !== undefined ? { evidenceRequired: data.evidenceRequired } : {}),
      ...(data.evaluationFrequency !== undefined ? { evaluationFrequency: data.evaluationFrequency } : {}),
      ...(data.nextEvaluationDate !== undefined ? { nextEvaluationDate: data.nextEvaluationDate ? new Date(data.nextEvaluationDate) : null } : {}),
      ...(data.processId !== undefined ? { processId: data.processId } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
      ...(data.requirementId !== undefined ? { requirementId: data.requirementId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_obligation" } });
  });
  revalidate();
  return { id };
}

/**
 * Sustituye una obligación por su versión vigente sin borrar la anterior: el
 * histórico regulatorio es lo que demuestra desde cuándo obliga cada texto.
 */
export async function supersedeObligation(id: string, input: { supersededById: string; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const [current, replacement] = await Promise.all([
    prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true, status: true } }),
    prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: input.supersededById }), select: { id: true, code: true } }),
  ]);
  if (!current) throw new Error("Obligación no encontrada.");
  if (!replacement) throw new Error("La obligación sustituta no pertenece a la organización.");
  if (current.id === replacement.id) throw new Error("Una obligación no puede sustituirse a sí misma.");
  if (current.status === "SUPERSEDED") throw new Error("La obligación ya está sustituida.");
  await prisma.$transaction(async (tx) => {
    await tx.complianceObligation.update({ where: { id }, data: { status: "SUPERSEDED", supersededById: replacement.id, effectiveTo: new Date() } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { status: current.status }, after: { status: "SUPERSEDED", supersededBy: replacement.code }, extra: { event: "supersede_obligation", note: input.note } });
  });
  revalidate();
  return { id, supersededBy: replacement.code };
}

// ─────────────────────────────────────────────────────
// Evaluación de aplicabilidad (§4.6)
// ─────────────────────────────────────────────────────

const applicabilitySchema = z.object({
  obligationId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  decision: z.enum(["UNDER_ASSESSMENT", "APPLICABLE", "PARTIALLY_APPLICABLE", "NOT_APPLICABLE"]),
  rationale: z.string().max(4000).optional(),
  criteria: z.string().max(2000).optional(),
  reviewDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
});

/**
 * Decide (o revisa) la aplicabilidad de una obligación en una jurisdicción y
 * recalcula la aplicabilidad agregada de la obligación. Es un upsert porque la
 * pregunta "¿me aplica aquí?" tiene una sola respuesta vigente por jurisdicción.
 */
export async function assessObligationApplicability(input: z.infer<typeof applicabilitySchema>) {
  const ctx = await requirePermission("compliance:update");
  const data = applicabilitySchema.parse(input);
  assertApplicabilityDecision({ decision: data.decision, rationale: data.rationale, assessedById: ctx.user.id });
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });

  const [obligation, jurisdiction] = await Promise.all([
    prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true, code: true, complianceStatus: true } }),
    prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true, code: true } }),
  ]);
  if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  if (!jurisdiction) throw new Error("La jurisdicción no pertenece a la organización.");

  const decided = data.decision !== "UNDER_ASSESSMENT";
  const assessed = {
    decision: data.decision,
    rationale: data.rationale ?? null,
    criteria: data.criteria ?? null,
    assessedById: decided ? ctx.user.id : null,
    assessedAt: decided ? new Date() : null,
    reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
    evidenceId: data.evidenceId ?? null,
  };
  const { row, rollup } = await prisma.$transaction(async (tx) => {
    const upserted = await tx.obligationApplicability.upsert({
      where: { organizationId_obligationId_jurisdictionId: { organizationId: ctx.organization.id, obligationId: data.obligationId, jurisdictionId: data.jurisdictionId } },
      create: tenantData(ctx, { obligationId: data.obligationId, jurisdictionId: data.jurisdictionId, ...assessed }),
      update: assessed,
    });

    const all = await tx.obligationApplicability.findMany({
      where: { organizationId: ctx.organization.id, obligationId: data.obligationId },
      include: { jurisdiction: { select: { code: true } } },
    });
    const computedRollup = rollupApplicability(all.map((entry) => ({ jurisdictionCode: entry.jurisdiction.code, decision: entry.decision })));
    await tx.complianceObligation.update({
      where: { id: data.obligationId },
      data: {
        applicability: computedRollup.decision,
        complianceStatus: statusForApplicability(computedRollup.decision, obligation.complianceStatus),
      },
    });

    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: upserted.id, after: { obligation: obligation.code, jurisdiction: jurisdiction.code, decision: data.decision, rollup: computedRollup.decision }, extra: { event: "assess_applicability" } });
    return { row: upserted, rollup: computedRollup };
  });
  revalidate();
  return { id: row.id, decision: data.decision, rollup };
}

// ─────────────────────────────────────────────────────
// Riesgos de compliance (§6.1)
// ─────────────────────────────────────────────────────

const riskSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  obligationId: z.string().optional(),
  category: z.enum(CATEGORY).default("OTHER"),
  likelihood: z.number().int().min(1).max(5).default(3),
  impact: z.number().int().min(1).max(5).default(3),
  sanctionExposure: z.number().min(0).optional(),
  reputationalImpact: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "SEVERE"]).default("MODERATE"),
  treatment: z.enum(["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"]).default("MITIGATE"),
  ownerId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  riskId: z.string().optional(),
  capaId: z.string().optional(),
});

export async function createComplianceRisk(input: z.infer<typeof riskSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = riskSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, capaId: data.capaId });
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  const valuation = computeComplianceRisk({ likelihood: data.likelihood, impact: data.impact });
  const code = data.code ?? await nextCode("RC", prisma.complianceRisk.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceRisk.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null, obligationId: data.obligationId ?? null,
        category: data.category, likelihood: data.likelihood, impact: data.impact,
        inherentScore: valuation.inherentScore, inherentLevel: valuation.inherentLevel,
        residualScore: valuation.residualScore, residualLevel: valuation.residualLevel,
        acceptability: valuation.acceptability, treatment: data.treatment,
        sanctionExposure: data.sanctionExposure ?? null, reputationalImpact: data.reputationalImpact,
        ownerId: data.ownerId ?? null, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        riskId: data.riskId ?? null, capaId: data.capaId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, residualLevel: valuation.residualLevel, acceptability: valuation.acceptability }, extra: { event: "create_compliance_risk" } });
    return row;
  });
  revalidate();
  return { id: created.id, code, ...valuation };
}

/**
 * Recalcula el riesgo residual desde la eficacia real de sus controles. Se
 * ejecuta al valorar el riesgo y al cambiar un control, para que la matriz no
 * dependa de que alguien se acuerde de actualizarla.
 */
export async function revalueComplianceRisk(id: string) {
  const ctx = await requirePermission("compliance:update");
  const risk = await prisma.complianceRisk.findFirst({ where: tenantWhere(ctx, { id }), include: { controls: true } });
  if (!risk) throw new Error("Riesgo de compliance no encontrado.");
  const controlEffectiveness = aggregateControlEffectiveness(risk.controls);
  const valuation = computeComplianceRisk({ likelihood: risk.likelihood, impact: risk.impact, controlEffectiveness });
  await prisma.$transaction(async (tx) => {
    await tx.complianceRisk.update({
      where: { id },
      data: {
        controlEffectiveness,
        inherentScore: valuation.inherentScore, inherentLevel: valuation.inherentLevel,
        residualScore: valuation.residualScore, residualLevel: valuation.residualLevel,
        acceptability: valuation.acceptability,
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { residualScore: risk.residualScore }, after: { controlEffectiveness, ...valuation }, extra: { event: "revalue_compliance_risk" } });
  });
  revalidate();
  return { id, controlEffectiveness, ...valuation };
}

export async function updateComplianceRisk(id: string, input: Partial<z.infer<typeof riskSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = riskSchema.partial().parse(input);
  const current = await prisma.complianceRisk.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Riesgo de compliance no encontrado.");
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId, capaId: data.capaId });
  await prisma.$transaction(async (tx) => {
    await tx.complianceRisk.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.likelihood !== undefined ? { likelihood: data.likelihood } : {}),
      ...(data.impact !== undefined ? { impact: data.impact } : {}),
      ...(data.reputationalImpact !== undefined ? { reputationalImpact: data.reputationalImpact } : {}),
      ...(data.treatment !== undefined ? { treatment: data.treatment } : {}),
      ...(data.sanctionExposure !== undefined ? { sanctionExposure: data.sanctionExposure } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.riskId !== undefined ? { riskId: data.riskId || null } : {}),
      ...(data.capaId !== undefined ? { capaId: data.capaId || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, likelihood: current.likelihood, impact: current.impact }, after: data, extra: { event: "update_compliance_risk" } });
  });
  await revalueComplianceRisk(id);
  return { id };
}

/** Aceptar un riesgo es una decisión con nombre y motivo, no un cambio de estado. */
export async function acceptComplianceRisk(id: string, input: { rationale: string }) {
  const ctx = await requirePermission("compliance:approve");
  const risk = await prisma.complianceRisk.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!risk) throw new Error("Riesgo de compliance no encontrado.");
  if (risk.status === "ACCEPTED") throw new Error("El riesgo ya está aceptado.");
  assertRiskAcceptance({ acceptability: risk.acceptability, rationale: input.rationale, acceptedById: ctx.user.id });
  await prisma.$transaction(async (tx) => {
    await tx.complianceRisk.update({
      where: { id },
      data: { status: "ACCEPTED", treatment: "ACCEPT", acceptedById: ctx.user.id, acceptedAt: new Date(), acceptanceRationale: input.rationale },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, before: { status: risk.status }, after: { status: "ACCEPTED" }, extra: { event: "accept_compliance_risk", rationale: input.rationale, residualLevel: risk.residualLevel } });
  });
  revalidate();
  return { id, status: "ACCEPTED" as const };
}

// ─────────────────────────────────────────────────────
// Controles de compliance (§8.1)
// ─────────────────────────────────────────────────────

const controlSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  obligationId: z.string().optional(),
  riskId: z.string().optional(),
  controlType: z.enum(["PREVENTIVE", "DETECTIVE", "CORRECTIVE", "DIRECTIVE"]).default("PREVENTIVE"),
  nature: z.enum(["MANUAL", "AUTOMATED", "HYBRID"]).default("MANUAL"),
  frequency: z.enum(FREQUENCY).default("MONTHLY"),
  ownerId: z.string().optional(),
  organizationControlId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
  nextTestDate: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export async function createComplianceControl(input: z.infer<typeof controlSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = controlSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { controlId: data.organizationControlId, documentId: data.documentId, evidenceId: data.evidenceId });
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.riskId) {
    const risk = await prisma.complianceRisk.findFirst({ where: tenantWhere(ctx, { id: data.riskId }), select: { id: true } });
    if (!risk) throw new Error("El riesgo de compliance no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("CC", prisma.complianceControl.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceControl.create({
      data: tenantData(ctx, {
        code, name: data.name, description: data.description ?? null, obligationId: data.obligationId ?? null,
        riskId: data.riskId ?? null, controlType: data.controlType, nature: data.nature, frequency: data.frequency,
        ownerId: data.ownerId ?? null, organizationControlId: data.organizationControlId ?? null,
        documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
        nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, name: data.name, controlType: data.controlType }, extra: { event: "create_compliance_control" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateComplianceControl(id: string, input: Partial<z.infer<typeof controlSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = controlSchema.partial().parse(input);
  const current = await prisma.complianceControl.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Control de compliance no encontrado.");
  await assertRefInOrg(ctx.organization.id, { controlId: data.organizationControlId, documentId: data.documentId, evidenceId: data.evidenceId });
  if (data.obligationId) {
    const found = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!found) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.riskId) {
    const found = await prisma.complianceRisk.findFirst({ where: tenantWhere(ctx, { id: data.riskId }), select: { id: true } });
    if (!found) throw new Error("El riesgo de compliance no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.complianceControl.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.riskId !== undefined ? { riskId: data.riskId || null } : {}),
      ...(data.controlType !== undefined ? { controlType: data.controlType } : {}),
      ...(data.nature !== undefined ? { nature: data.nature } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.organizationControlId !== undefined ? { organizationControlId: data.organizationControlId || null } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId || null } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId || null } : {}),
      ...(data.nextTestDate !== undefined ? { nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { name: current.name, active: current.active }, after: data, extra: { event: "update_compliance_control" } });
  });
  revalidate();
  return { id };
}

const controlTestSchema = z.object({
  designAdequate: z.boolean(),
  operatingEffective: z.boolean(),
  effectiveness: z.number().int().min(0).max(100),
  note: z.string().max(2000).optional(),
  evidenceId: z.string().optional(),
  nextTestDate: z.string().datetime().optional(),
});

/**
 * Registra la prueba de un control. Un control cuyo diseño es inadecuado no
 * puede declararse eficaz en operación: la eficacia se limita al 0 %.
 */
export async function testComplianceControl(id: string, input: z.infer<typeof controlTestSchema>) {
  const ctx = await requirePermission("compliance:update");
  const data = controlTestSchema.parse(input);
  const control = await prisma.complianceControl.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!control) throw new Error("Control de compliance no encontrado.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  const effectiveness = data.designAdequate && data.operatingEffective ? data.effectiveness : 0;
  await prisma.$transaction(async (tx) => {
    await tx.complianceControl.update({
      where: { id },
      data: {
        designAdequate: data.designAdequate, operatingEffective: data.operatingEffective, effectiveness,
        lastTestedAt: new Date(), nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : nextOccurrence(new Date(), control.frequency === "CONTINUOUS" || control.frequency === "ON_EVENT" || control.frequency === "WEEKLY" ? "MONTHLY" : control.frequency),
        ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { designAdequate: data.designAdequate, operatingEffective: data.operatingEffective, effectiveness }, extra: { event: "test_compliance_control", note: data.note } });
    // El riesgo asociado se revalora solo: un control probado cambia el residual.
    if (control.riskId) {
      const risk = await tx.complianceRisk.findFirst({ where: { id: control.riskId, organizationId: ctx.organization.id }, include: { controls: true } });
      if (risk) {
        const controlEffectiveness = aggregateControlEffectiveness(risk.controls.map((row) => (row.id === id ? { ...row, effectiveness, operatingEffective: data.operatingEffective } : row)));
        const valuation = computeComplianceRisk({ likelihood: risk.likelihood, impact: risk.impact, controlEffectiveness });
        await tx.complianceRisk.update({ where: { id: risk.id }, data: { controlEffectiveness, ...valuation } });
      }
    }
  });
  revalidate();
  return { id, effectiveness };
}

// ─────────────────────────────────────────────────────
// Evaluación de cumplimiento (§9.1)
// ─────────────────────────────────────────────────────

const evaluationSchema = z.object({
  code: z.string().max(40).optional(),
  obligationId: z.string().optional(),
  controlId: z.string().optional(),
  scope: z.enum(["OBLIGATION", "CONTROL", "PROCESS", "PROGRAM", "THIRD_PARTY"]).default("OBLIGATION"),
  method: z.enum(["SELF_ASSESSMENT", "MONITORING", "CONTROL_TESTING", "INTERNAL_AUDIT", "EXTERNAL_AUDIT", "AUTHORITY_INSPECTION", "DUE_DILIGENCE"]).default("SELF_ASSESSMENT"),
  period: z.string().min(1).max(20),
  result: z.enum(["NOT_EVALUATED", "COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"]).default("NOT_EVALUATED"),
  score: z.number().int().min(0).max(100).optional(),
  findings: z.string().max(4000).optional(),
  gapsIdentified: z.string().max(4000).optional(),
  recommendation: z.string().max(4000).optional(),
  evidenceId: z.string().optional(),
  capaId: z.string().optional(),
  breachId: z.string().optional(),
});

export async function createComplianceEvaluation(input: z.infer<typeof evaluationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = evaluationSchema.parse(input);
  if (!data.obligationId && !data.controlId && data.scope === "OBLIGATION") {
    throw new Error("Una evaluación de obligación debe indicar la obligación evaluada.");
  }
  assertFindingsForNonCompliance({ result: data.result, findings: data.findings });
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, capaId: data.capaId, breachId: data.breachId });
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.controlId) {
    const control = await prisma.complianceControl.findFirst({ where: tenantWhere(ctx, { id: data.controlId }), select: { id: true } });
    if (!control) throw new Error("El control no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("EC", prisma.complianceEvaluation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceEvaluation.create({
      data: tenantData(ctx, {
        code, obligationId: data.obligationId ?? null, controlId: data.controlId ?? null, scope: data.scope,
        method: data.method, period: data.period, evaluatedById: ctx.user.id, evaluatedAt: new Date(),
        result: data.result, score: data.score ?? null, findings: data.findings ?? null,
        gapsIdentified: data.gapsIdentified ?? null, recommendation: data.recommendation ?? null,
        reviewStatus: "DRAFT", evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, period: data.period, result: data.result }, extra: { event: "create_compliance_evaluation" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateComplianceEvaluation(id: string, input: Partial<z.infer<typeof evaluationSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = evaluationSchema.partial().parse(input);
  const current = await prisma.complianceEvaluation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Evaluación de cumplimiento no encontrada.");
  if (!["DRAFT", "REJECTED"].includes(current.reviewStatus)) throw new Error("Solo una evaluación en borrador o rechazada puede editarse.");
  assertFindingsForNonCompliance({ result: data.result ?? current.result, findings: data.findings ?? current.findings ?? undefined });
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId, capaId: data.capaId, breachId: data.breachId });
  if (data.obligationId) {
    const found = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!found) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.controlId) {
    const found = await prisma.complianceControl.findFirst({ where: tenantWhere(ctx, { id: data.controlId }), select: { id: true } });
    if (!found) throw new Error("El control no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.complianceEvaluation.update({ where: { id }, data: {
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.controlId !== undefined ? { controlId: data.controlId || null } : {}),
      ...(data.scope !== undefined ? { scope: data.scope } : {}),
      ...(data.method !== undefined ? { method: data.method } : {}),
      ...(data.period !== undefined ? { period: data.period } : {}),
      ...(data.result !== undefined ? { result: data.result } : {}),
      ...(data.score !== undefined ? { score: data.score ?? null } : {}),
      ...(data.findings !== undefined ? { findings: data.findings || null } : {}),
      ...(data.gapsIdentified !== undefined ? { gapsIdentified: data.gapsIdentified || null } : {}),
      ...(data.recommendation !== undefined ? { recommendation: data.recommendation || null } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId || null } : {}),
      ...(data.capaId !== undefined ? { capaId: data.capaId || null } : {}),
      ...(data.breachId !== undefined ? { breachId: data.breachId || null } : {}),
      reviewStatus: "DRAFT", reviewerId: null, reviewedAt: null, decisionNote: null,
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { reviewStatus: current.reviewStatus }, after: { ...data, reviewStatus: "DRAFT" }, extra: { event: "update_compliance_evaluation" } });
  });
  revalidate();
  return { id };
}

/** Envía la evaluación a revisión: nadie aprueba su propio trabajo sin pasar por aquí. */
export async function submitEvaluationForReview(id: string, note?: string) {
  const ctx = await requirePermission("compliance:update");
  const evaluation = await prisma.complianceEvaluation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!evaluation) throw new Error("Evaluación no encontrada.");
  assertReviewTransition(evaluation.reviewStatus, "UNDER_REVIEW");
  await prisma.$transaction(async (tx) => {
    await tx.complianceEvaluation.update({ where: { id }, data: { reviewStatus: "UNDER_REVIEW" } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { reviewStatus: evaluation.reviewStatus }, after: { reviewStatus: "UNDER_REVIEW" }, extra: { event: "submit_evaluation_review", note } });
  });
  revalidate();
  return { id, reviewStatus: "UNDER_REVIEW" as ComplianceReviewStatus };
}

/**
 * Decide una evaluación. Solo la aprobación mueve el estado de cumplimiento de
 * la obligación, y solo alguien con `compliance:approve` puede decidir. La
 * decisión queda con nombre y fecha, también exigido por CHECK en base.
 */
export async function decideEvaluation(id: string, input: { decision: "APPROVED" | "REJECTED"; note?: string }) {
  const ctx = await requirePermission("compliance:approve");
  const evaluation = await prisma.complianceEvaluation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!evaluation) throw new Error("Evaluación no encontrada.");
  assertReviewTransition(evaluation.reviewStatus, input.decision);
  const reviewedAt = new Date();
  assertReviewerPresent({ reviewStatus: input.decision, reviewerId: ctx.user.id, reviewedAt });

  await prisma.$transaction(async (tx) => {
    await tx.complianceEvaluation.update({
      where: { id },
      data: { reviewStatus: input.decision, reviewerId: ctx.user.id, reviewedAt, decisionNote: input.note ?? null },
    });

    if (input.decision === "APPROVED" && evaluation.obligationId) {
      const obligation = await tx.complianceObligation.findFirst({ where: { id: evaluation.obligationId, organizationId: ctx.organization.id }, select: { id: true, evaluationFrequency: true, applicability: true, complianceStatus: true } });
      if (obligation && obligation.applicability !== "NOT_APPLICABLE") {
        await tx.complianceObligation.update({
          where: { id: obligation.id },
          data: {
            complianceStatus: statusFromResult(evaluation.result),
            lastEvaluatedAt: evaluation.evaluatedAt,
            nextEvaluationDate: nextOccurrence(evaluation.evaluatedAt, obligation.evaluationFrequency === "CONTINUOUS" || obligation.evaluationFrequency === "ON_EVENT" || obligation.evaluationFrequency === "WEEKLY" ? "MONTHLY" : obligation.evaluationFrequency),
          },
        });
      }
    }

    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, before: { reviewStatus: evaluation.reviewStatus }, after: { reviewStatus: input.decision }, extra: { event: "decide_evaluation", note: input.note, result: evaluation.result } });
  });
  if (evaluation.evaluatedById && evaluation.evaluatedById !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: evaluation.evaluatedById, title: `Evaluación ${input.decision === "APPROVED" ? "aprobada" : "rechazada"}: ${evaluation.code}`, body: input.note ?? `Su evaluación del periodo ${evaluation.period} fue revisada.`, type: input.decision === "APPROVED" ? "SUCCESS" : "WARNING", link: "/app/compliance", idempotencyKey: `evaluation:${id}:${input.decision}` });
  }
  revalidate();
  return { id, reviewStatus: input.decision };
}

// ─────────────────────────────────────────────────────
// Calendario y alertas (§8.1)
// ─────────────────────────────────────────────────────

const calendarSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  obligationId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  dueDate: z.string().datetime(),
  recurrence: z.enum(["ONCE", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL"]).default("ANNUAL"),
  leadTimeDays: z.number().int().min(0).max(365).default(30),
  criticality: z.enum(CRITICALITY).default("MEDIUM"),
  responsibleId: z.string().optional(),
  authority: z.string().max(200).optional(),
});

export async function createCalendarItem(input: z.infer<typeof calendarSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = calendarSchema.parse(input);
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true } });
    if (!jurisdiction) throw new Error("La jurisdicción no pertenece a la organización.");
  }
  const dueDate = new Date(data.dueDate);
  const code = data.code ?? await nextCode("CAL", prisma.complianceCalendar.count({ where: { organizationId: ctx.organization.id } }));
  const state = calendarState({ dueDate, leadTimeDays: data.leadTimeDays, today: new Date() });
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceCalendar.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null, obligationId: data.obligationId ?? null,
        jurisdictionId: data.jurisdictionId ?? null, dueDate, recurrence: data.recurrence,
        leadTimeDays: data.leadTimeDays, criticality: data.criticality, responsibleId: data.responsibleId ?? null,
        authority: data.authority ?? null, status: state.status, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, dueDate, recurrence: data.recurrence }, extra: { event: "create_calendar_item" } });
    return row;
  });
  revalidate();
  return { id: created.id, code, status: state.status };
}

export async function updateCalendarItem(id: string, input: Partial<z.infer<typeof calendarSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = calendarSchema.partial().parse(input);
  const current = await prisma.complianceCalendar.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Vencimiento no encontrado.");
  if (current.completedAt || current.status === "CANCELLED") throw new Error("Un vencimiento cumplido o cancelado no puede editarse.");
  if (data.obligationId) {
    const found = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!found) throw new Error("La obligación no pertenece a la organización.");
  }
  if (data.jurisdictionId) {
    const found = await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: data.jurisdictionId }), select: { id: true } });
    if (!found) throw new Error("La jurisdicción no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.complianceCalendar.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.jurisdictionId !== undefined ? { jurisdictionId: data.jurisdictionId || null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
      ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
      ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays } : {}),
      ...(data.criticality !== undefined ? { criticality: data.criticality } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId || null } : {}),
      ...(data.authority !== undefined ? { authority: data.authority || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, dueDate: current.dueDate }, after: data, extra: { event: "update_calendar_item" } });
  });
  revalidate();
  return { id };
}

export async function cancelCalendarItem(id: string, note?: string) {
  const ctx = await requirePermission("compliance:update");
  const current = await prisma.complianceCalendar.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Vencimiento no encontrado.");
  if (current.completedAt || current.status === "COMPLETED") throw new Error("Un vencimiento cumplido no puede cancelarse.");
  await prisma.$transaction(async (tx) => {
    await tx.complianceCalendar.update({ where: { id }, data: { status: "CANCELLED" } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: id, before: { status: current.status }, after: { status: "CANCELLED" }, extra: { event: "cancel_calendar_item", note } });
  });
  revalidate();
  return { id, status: "CANCELLED" as const };
}

/**
 * Cierra un vencimiento y, si es recurrente, genera ya la siguiente ocurrencia:
 * un calendario que solo se llena a mano es un calendario que se olvida.
 */
export async function completeCalendarItem(id: string, input: { submissionReference?: string; evidenceId?: string; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const item = await prisma.complianceCalendar.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!item) throw new Error("Vencimiento no encontrado.");
  if (item.completedAt) throw new Error("El vencimiento ya está cumplido.");
  assertCalendarCompletion({ completedById: ctx.user.id });
  await assertRefInOrg(ctx.organization.id, { evidenceId: input.evidenceId });

  const completedAt = new Date();
  const nextCodeValue = await nextCode("CAL", prisma.complianceCalendar.count({ where: { organizationId: ctx.organization.id } }));
  const nextItem = await prisma.$transaction(async (tx) => {
    await tx.complianceCalendar.update({
      where: { id },
      data: {
        status: "COMPLETED", completedAt, completedById: ctx.user.id,
        submissionReference: input.submissionReference ?? null,
        ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
      },
    });

    let created: { id: string; code: string; dueDate: Date } | null = null;
    const nextDue = nextOccurrence(item.dueDate, item.recurrence);
    if (nextDue) {
      const row = await tx.complianceCalendar.create({
        data: tenantData(ctx, {
          code: nextCodeValue, title: item.title, description: item.description, obligationId: item.obligationId,
          jurisdictionId: item.jurisdictionId, dueDate: nextDue, recurrence: item.recurrence,
          leadTimeDays: item.leadTimeDays, criticality: item.criticality, responsibleId: item.responsibleId,
          authority: item.authority, status: "SCHEDULED", parentItemId: item.id, createdById: ctx.user.id,
        }),
      });
      created = { id: row.id, code: row.code, dueDate: nextDue };
    }

    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { status: item.status }, after: { status: "COMPLETED", completedAt, nextOccurrence: created?.code ?? null }, extra: { event: "complete_calendar_item", note: input.note, submissionReference: input.submissionReference } });
    return created;
  });
  revalidate();
  return { id, completedAt, next: nextItem };
}

/**
 * Recalcula el estado del calendario y avisa de lo que vence o venció. Idempotente
 * por diseño: `alertSentAt` evita repetir el mismo aviso en cada ejecución.
 */
export async function refreshCalendarAlerts() {
  const ctx = await requirePermission("compliance:update");
  const today = new Date();
  const items = await prisma.complianceCalendar.findMany({
    where: { organizationId: ctx.organization.id, completedAt: null, status: { notIn: ["CANCELLED", "COMPLETED"] } },
  });

  const toNotify: { id: string; code: string; title: string; responsibleId: string; status: string; overdueDays: number; daysRemaining: number }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const state = calendarState({ dueDate: item.dueDate, leadTimeDays: item.leadTimeDays, completedAt: item.completedAt, today });
      if (state.status !== item.status) {
        await tx.complianceCalendar.update({ where: { id: item.id }, data: { status: state.status } });
      }
      if (!state.alertDue || item.alertSentAt || !item.responsibleId) continue;
      await tx.complianceCalendar.update({ where: { id: item.id }, data: { alertSentAt: today } });
      toNotify.push({ id: item.id, code: item.code, title: item.title, responsibleId: item.responsibleId, status: state.status, overdueDays: state.overdueDays, daysRemaining: state.daysRemaining });
    }
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: ctx.organization.id, after: { reviewed: items.length, notified: toNotify.length }, extra: { event: "refresh_calendar_alerts" } });
  });

  for (const item of toNotify) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: item.responsibleId,
      title: item.status === "OVERDUE" ? `Vencimiento fuera de plazo: ${item.code}` : `Vencimiento próximo: ${item.code}`,
      body: item.status === "OVERDUE"
        ? `"${item.title}" venció hace ${item.overdueDays} día(s).`
        : `"${item.title}" vence en ${item.daysRemaining} día(s).`,
      type: item.status === "OVERDUE" ? "ALERT" : "WARNING",
      link: "/app/compliance", idempotencyKey: `calendar:${item.id}:${item.status}`,
    });
  }
  const notified = toNotify.length;
  revalidate();
  return { reviewed: items.length, notified };
}

// ─────────────────────────────────────────────────────
// Conflictos de interés (§7.2, §8.2)
// ─────────────────────────────────────────────────────

const declarationSchema = z.object({
  code: z.string().max(40).optional(),
  declarantId: z.string().optional(),
  period: z.string().min(1).max(20),
  hasConflict: z.boolean().default(false),
  conflictType: z.enum(["FINANCIAL_INTEREST", "FAMILY_RELATIONSHIP", "GIFT_HOSPITALITY", "OUTSIDE_ACTIVITY", "SUPPLIER_RELATIONSHIP", "CUSTOMER_RELATIONSHIP", "PUBLIC_OFFICIAL", "POLITICAL_ACTIVITY", "FORMER_EMPLOYMENT", "OTHER"]).optional(),
  description: z.string().max(4000).optional(),
  relatedParty: z.string().max(300).optional(),
  supplierId: z.string().optional(),
  estimatedValue: z.number().min(0).optional(),
  recusalRequired: z.boolean().default(false),
  nextDeclarationDate: z.string().datetime().optional(),
});

/**
 * Declara (o actualiza) un conflicto de interés del propio usuario. Declarar por
 * otra persona exige `compliance:approve`: una declaración es un acto personal.
 */
export async function declareConflictOfInterest(input: z.infer<typeof declarationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = declarationSchema.parse(input);
  const declarantId = data.declarantId ?? ctx.user.id;
  if (declarantId !== ctx.user.id) {
    await requirePermission("compliance:approve");
  }
  if (data.hasConflict && (!data.conflictType || !data.description)) {
    throw new Error("Declarar un conflicto exige indicar su tipo y describirlo.");
  }
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId });

  const existing = await prisma.conflictOfInterestDeclaration.findUnique({
    where: { organizationId_declarantId_period: { organizationId: ctx.organization.id, declarantId, period: data.period } },
    select: { id: true, reviewStatus: true },
  });
  if (existing && existing.reviewStatus !== "PENDING" && existing.reviewStatus !== "UNDER_REVIEW") {
    throw new Error("La declaración del periodo ya fue revisada. Registre el cambio en el periodo siguiente.");
  }

  const payload = {
    hasConflict: data.hasConflict,
    conflictType: data.conflictType ?? null,
    description: data.description ?? null,
    relatedParty: data.relatedParty ?? null,
    supplierId: data.supplierId ?? null,
    estimatedValue: data.estimatedValue ?? null,
    recusalRequired: data.recusalRequired || data.hasConflict,
    declaredAt: new Date(),
    reviewStatus: "PENDING" as const,
    nextDeclarationDate: data.nextDeclarationDate ? new Date(data.nextDeclarationDate) : null,
  };

  const code = existing ? undefined : data.code ?? await nextCode("CI", prisma.conflictOfInterestDeclaration.count({ where: { organizationId: ctx.organization.id } }));
  const row = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.conflictOfInterestDeclaration.update({ where: { id: existing.id }, data: payload })
      : await tx.conflictOfInterestDeclaration.create({ data: tenantData(ctx, { code: code!, declarantId, period: data.period, ...payload }) });
    // El contenido de la declaración no entra en el registro de auditoría: basta
    // saber que existe, de quién y de qué periodo.
    await writeAuditLog(tx, { ctx, action: existing ? "update" : "create", module: MODULE, recordId: saved.id, after: { code: saved.code, period: data.period, hasConflict: data.hasConflict }, extra: { event: "declare_conflict_of_interest" } });
    return saved;
  });
  revalidate();
  return { id: row.id, code: row.code };
}

export async function reviewConflictDeclaration(id: string, input: { decision: "ACCEPTED" | "MITIGATED" | "REJECTED"; mitigationMeasures?: string; recusalRequired?: boolean }) {
  const ctx = await requirePermission("compliance:approve");
  const declaration = await prisma.conflictOfInterestDeclaration.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!declaration) throw new Error("Declaración no encontrada.");
  if (declaration.declarantId === ctx.user.id) {
    throw new Error("Nadie puede revisar su propia declaración de conflicto de interés.");
  }
  if (input.decision === "MITIGATED" && !input.mitigationMeasures) {
    throw new Error("Declarar un conflicto como mitigado exige registrar las medidas de mitigación.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.conflictOfInterestDeclaration.update({
      where: { id },
      data: {
        reviewStatus: input.decision, reviewerId: ctx.user.id, reviewedAt: new Date(),
        mitigationMeasures: input.mitigationMeasures ?? declaration.mitigationMeasures,
        ...(input.recusalRequired !== undefined ? { recusalRequired: input.recusalRequired } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, before: { reviewStatus: declaration.reviewStatus }, after: { reviewStatus: input.decision }, extra: { event: "review_conflict_declaration" } });
  });
  revalidate();
  return { id, reviewStatus: input.decision };
}

// ─────────────────────────────────────────────────────
// Cambios regulatorios (§8.1)
// ─────────────────────────────────────────────────────

const changeSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  sourceId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  obligationId: z.string().optional(),
  changeType: z.enum(["NEW_REQUIREMENT", "AMENDMENT", "REPEAL", "INTERPRETATION", "GUIDANCE", "CASE_LAW", "ENFORCEMENT_TREND"]).default("AMENDMENT"),
  summary: z.string().max(4000).optional(),
  publishedAt: z.string().datetime().optional(),
  effectiveFrom: z.string().datetime().optional(),
  transitionUntil: z.string().datetime().optional(),
  documentId: z.string().optional(),
});

export async function registerRegulatoryChange(input: z.infer<typeof changeSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = changeSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  if (data.sourceId) {
    const source = await prisma.regulatorySource.findFirst({ where: tenantWhere(ctx, { id: data.sourceId }), select: { id: true, ownerId: true } });
    if (!source) throw new Error("La fuente regulatoria no pertenece a la organización.");
  }
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("CR", prisma.regulatoryChange.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.regulatoryChange.create({
      data: tenantData(ctx, {
        code, title: data.title, sourceId: data.sourceId ?? null, jurisdictionId: data.jurisdictionId ?? null,
        obligationId: data.obligationId ?? null, changeType: data.changeType, summary: data.summary ?? null,
        detectedAt: new Date(), detectedById: ctx.user.id,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
        transitionUntil: data.transitionUntil ? new Date(data.transitionUntil) : null,
        impactStatus: "PENDING_ASSESSMENT", documentId: data.documentId ?? null,
      }),
    });
    if (data.sourceId) {
      await tx.regulatorySource.update({ where: { id: data.sourceId }, data: { lastCheckedAt: new Date() } });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, changeType: data.changeType }, extra: { event: "register_regulatory_change" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateRegulatoryChange(id: string, input: Partial<z.infer<typeof changeSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = changeSchema.partial().parse(input);
  const current = await prisma.regulatoryChange.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Cambio regulatorio no encontrado.");
  if (["IMPLEMENTED"].includes(current.impactStatus)) throw new Error("Un cambio implementado conserva su ficha histórica y no puede editarse.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  for (const [value, message] of [[data.sourceId, "La fuente"], [data.jurisdictionId, "La jurisdicción"], [data.obligationId, "La obligación"]] as const) {
    if (!value) continue;
    const found = data.sourceId === value
      ? await prisma.regulatorySource.findFirst({ where: tenantWhere(ctx, { id: value }), select: { id: true } })
      : data.jurisdictionId === value
        ? await prisma.jurisdiction.findFirst({ where: tenantWhere(ctx, { id: value }), select: { id: true } })
        : await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: value }), select: { id: true } });
    if (!found) throw new Error(`${message} no pertenece a la organización.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.regulatoryChange.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.sourceId !== undefined ? { sourceId: data.sourceId || null } : {}),
      ...(data.jurisdictionId !== undefined ? { jurisdictionId: data.jurisdictionId || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.changeType !== undefined ? { changeType: data.changeType } : {}),
      ...(data.summary !== undefined ? { summary: data.summary || null } : {}),
      ...(data.publishedAt !== undefined ? { publishedAt: data.publishedAt ? new Date(data.publishedAt) : null } : {}),
      ...(data.effectiveFrom !== undefined ? { effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null } : {}),
      ...(data.transitionUntil !== undefined ? { transitionUntil: data.transitionUntil ? new Date(data.transitionUntil) : null } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, impactStatus: current.impactStatus }, after: data, extra: { event: "update_regulatory_change" } });
  });
  revalidate();
  return { id };
}

const changeAssessmentSchema = z.object({
  impactStatus: z.enum(["UNDER_ASSESSMENT", "ASSESSED", "NO_IMPACT", "IMPLEMENTED"]),
  impactLevel: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "SEVERE"]).optional(),
  impactAnalysis: z.string().max(4000).optional(),
  affectedAreas: z.string().max(2000).optional(),
  actionsRequired: z.string().max(4000).optional(),
  responsibleId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  changeRequestId: z.string().optional(),
});

/**
 * Evalúa el impacto de un cambio regulatorio. Concluir que hay impacto exige
 * decir qué hay que hacer y quién lo hace; si no, el cambio queda registrado
 * como sabido y desatendido, que es la peor combinación.
 */
export async function assessRegulatoryChange(id: string, input: z.infer<typeof changeAssessmentSchema>) {
  const ctx = await requirePermission("compliance:update");
  const data = changeAssessmentSchema.parse(input);
  const change = await prisma.regulatoryChange.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!change) throw new Error("Cambio regulatorio no encontrado.");
  await assertRefInOrg(ctx.organization.id, { changeRequestId: data.changeRequestId });
  if (data.impactStatus === "ASSESSED") {
    if (!data.impactAnalysis) throw new Error("Concluir la evaluación de impacto exige registrar el análisis.");
    if (!data.actionsRequired || !data.responsibleId) {
      throw new Error("Un cambio con impacto exige acciones requeridas y una persona responsable.");
    }
  }
  if (data.impactStatus === "NO_IMPACT" && !data.impactAnalysis) {
    throw new Error("Concluir que un cambio no tiene impacto exige justificarlo.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.regulatoryChange.update({
      where: { id },
      data: {
        impactStatus: data.impactStatus,
        ...(data.impactLevel !== undefined ? { impactLevel: data.impactLevel } : {}),
        ...(data.impactAnalysis !== undefined ? { impactAnalysis: data.impactAnalysis } : {}),
        ...(data.affectedAreas !== undefined ? { affectedAreas: data.affectedAreas } : {}),
        ...(data.actionsRequired !== undefined ? { actionsRequired: data.actionsRequired } : {}),
        ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.changeRequestId !== undefined ? { changeRequestId: data.changeRequestId } : {}),
        ...(data.impactStatus === "IMPLEMENTED" ? { implementedAt: new Date() } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { impactStatus: change.impactStatus }, after: { impactStatus: data.impactStatus, impactLevel: data.impactLevel }, extra: { event: "assess_regulatory_change" } });
  });
  if (data.responsibleId && data.responsibleId !== ctx.user.id && data.impactStatus === "ASSESSED") {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `Cambio regulatorio con impacto: ${change.code}`, body: `"${change.title}" exige acciones antes de ${data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : "la fecha de entrada en vigor"}.`, type: "WARNING", link: "/app/compliance", idempotencyKey: `regchange:${id}:assigned` });
  }
  revalidate();
  return { id, impactStatus: data.impactStatus };
}

// ─────────────────────────────────────────────────────
// Incumplimientos (§10.1)
// ─────────────────────────────────────────────────────

const breachSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  obligationId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  detectionSource: z.enum(["SELF_DETECTED", "COMPLIANCE_EVALUATION", "INTERNAL_AUDIT", "EXTERNAL_AUDIT", "SPEAK_UP_REPORT", "INVESTIGATION", "AUTHORITY_INSPECTION", "CUSTOMER_COMPLAINT", "THIRD_PARTY", "MEDIA"]).default("SELF_DETECTED"),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "SEVERE"]).default("MODERATE"),
  occurredAt: z.string().datetime().optional(),
  rootCause: z.string().max(4000).optional(),
  affectedParties: z.string().max(2000).optional(),
  financialExposure: z.number().min(0).optional(),
  recurrence: z.boolean().default(false),
  capaId: z.string().optional(),
  ncId: z.string().optional(),
  evidenceId: z.string().optional(),
});

/**
 * Registra un incumplimiento. La decisión de notificar a la autoridad se toma
 * aquí, con su plazo, porque es lo único del expediente que caduca solo.
 */
export async function registerComplianceBreach(input: z.infer<typeof breachSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = breachSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, ncId: data.ncId, evidenceId: data.evidenceId });
  let category: (typeof CATEGORY)[number] = "OTHER";
  if (data.obligationId) {
    const obligation = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true, category: true } });
    if (!obligation) throw new Error("La obligación no pertenece a la organización.");
    category = obligation.category;
  }
  const detectedAt = new Date();
  const notificationRequired = requiresNotificationDecision(category, data.severity);
  const code = data.code ?? await nextCode("INC", prisma.complianceBreach.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceBreach.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null, obligationId: data.obligationId ?? null,
        jurisdictionId: data.jurisdictionId ?? null, detectionSource: data.detectionSource, severity: data.severity,
        detectedAt, detectedById: ctx.user.id, occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
        rootCause: data.rootCause ?? null, affectedParties: data.affectedParties ?? null,
        recurrence: data.recurrence, financialExposure: data.financialExposure ?? null,
        notificationRequired, notificationDeadline: notificationRequired ? notificationDeadline(detectedAt, category) : null,
        status: "OPEN", capaId: data.capaId ?? null, ncId: data.ncId ?? null, evidenceId: data.evidenceId ?? null,
      }),
    });
    // La obligación incumplida deja de estar conforme en el momento de detectarlo.
    if (data.obligationId) {
      await tx.complianceObligation.update({ where: { id: data.obligationId }, data: { complianceStatus: "NON_COMPLIANT" } });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, severity: data.severity, notificationRequired }, extra: { event: "register_compliance_breach" } });
    return row;
  });
  revalidate();
  return { id: created.id, code, notificationRequired, notificationDeadline: created.notificationDeadline };
}

export async function updateComplianceBreach(id: string, input: Partial<z.infer<typeof breachSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = breachSchema.partial().parse(input);
  const current = await prisma.complianceBreach.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Incumplimiento no encontrado.");
  if (["REMEDIATED", "CLOSED"].includes(current.status)) throw new Error("Un incumplimiento remediado o cerrado conserva su evidencia y no puede editarse.");
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, ncId: data.ncId, evidenceId: data.evidenceId });
  if (data.obligationId) {
    const found = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!found) throw new Error("La obligación no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.complianceBreach.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.jurisdictionId !== undefined ? { jurisdictionId: data.jurisdictionId || null } : {}),
      ...(data.detectionSource !== undefined ? { detectionSource: data.detectionSource } : {}),
      ...(data.severity !== undefined ? { severity: data.severity } : {}),
      ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt ? new Date(data.occurredAt) : null } : {}),
      ...(data.rootCause !== undefined ? { rootCause: data.rootCause || null } : {}),
      ...(data.affectedParties !== undefined ? { affectedParties: data.affectedParties || null } : {}),
      ...(data.financialExposure !== undefined ? { financialExposure: data.financialExposure ?? null } : {}),
      ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
      ...(data.capaId !== undefined ? { capaId: data.capaId || null } : {}),
      ...(data.ncId !== undefined ? { ncId: data.ncId || null } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, severity: current.severity }, after: data, extra: { event: "update_compliance_breach" } });
  });
  revalidate();
  return { id };
}

export async function setBreachStatus(id: string, input: { to: BreachStatus; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const breach = await prisma.complianceBreach.findFirst({ where: tenantWhere(ctx, { id }), include: { remediationPlans: true } });
  if (!breach) throw new Error("Incumplimiento no encontrado.");
  assertBreachTransition(breach.status, input.to);

  if (input.to === "CLOSED") {
    assertBreachClosure({
      closedById: ctx.user.id,
      rootCause: breach.rootCause,
      remediationVerified: breach.remediationPlans.some((plan) => plan.effectivenessVerified),
      notificationRequired: breach.notificationRequired,
      authorityNotifiedAt: breach.authorityNotifiedAt,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.complianceBreach.update({
      where: { id },
      data: { status: input.to, ...(input.to === "CLOSED" ? { closedAt: new Date(), closedById: ctx.user.id } : {}) },
    });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: id, before: { status: breach.status }, after: { status: input.to }, extra: { event: "breach_status", note: input.note } });
  });
  revalidate();
  return { id, status: input.to };
}

export async function recordAuthorityNotification(id: string, input: { notifiedAt?: string; authorityReference?: string; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const breach = await prisma.complianceBreach.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!breach) throw new Error("Incumplimiento no encontrado.");
  const notifiedAt = input.notifiedAt ? new Date(input.notifiedAt) : new Date();
  const late = Boolean(breach.notificationDeadline && notifiedAt > breach.notificationDeadline);
  await prisma.$transaction(async (tx) => {
    await tx.complianceBreach.update({
      where: { id },
      data: { authorityNotifiedAt: notifiedAt, authorityReference: input.authorityReference ?? null, notificationRequired: true },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { authorityNotifiedAt: notifiedAt, late }, extra: { event: "notify_authority", note: input.note, deadline: breach.notificationDeadline } });
  });
  revalidate();
  return { id, notifiedAt, late };
}

// ─────────────────────────────────────────────────────
// Remediación (§10.1)
// ─────────────────────────────────────────────────────

const planSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  breachId: z.string().optional(),
  obligationId: z.string().optional(),
  objective: z.string().max(2000).optional(),
  actionsDescription: z.string().max(4000).optional(),
  ownerId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  cost: z.number().min(0).optional(),
  actionId: z.string().optional(),
});

export async function createRemediationPlan(input: z.infer<typeof planSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = planSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { actionId: data.actionId });
  if (data.breachId) {
    const breach = await prisma.complianceBreach.findFirst({ where: tenantWhere(ctx, { id: data.breachId }), select: { id: true } });
    if (!breach) throw new Error("El incumplimiento no pertenece a la organización.");
  }
  const code = data.code ?? await nextCode("REM", prisma.remediationPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.remediationPlan.create({
      data: tenantData(ctx, {
        code, title: data.title, breachId: data.breachId ?? null, obligationId: data.obligationId ?? null,
        objective: data.objective ?? null, actionsDescription: data.actionsDescription ?? null,
        ownerId: data.ownerId ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: "DRAFT", cost: data.cost ?? null, actionId: data.actionId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, dueDate: data.dueDate }, extra: { event: "create_remediation_plan" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateRemediationPlan(id: string, input: Partial<z.infer<typeof planSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = planSchema.partial().parse(input);
  const current = await prisma.remediationPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Plan de remediación no encontrado.");
  if (current.status !== "DRAFT") throw new Error("Solo un plan en borrador puede editarse.");
  await assertRefInOrg(ctx.organization.id, { actionId: data.actionId });
  if (data.breachId) {
    const found = await prisma.complianceBreach.findFirst({ where: tenantWhere(ctx, { id: data.breachId }), select: { id: true } });
    if (!found) throw new Error("El incumplimiento no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.remediationPlan.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.breachId !== undefined ? { breachId: data.breachId || null } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.objective !== undefined ? { objective: data.objective || null } : {}),
      ...(data.actionsDescription !== undefined ? { actionsDescription: data.actionsDescription || null } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.cost !== undefined ? { cost: data.cost ?? null } : {}),
      ...(data.actionId !== undefined ? { actionId: data.actionId || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, status: current.status }, after: data, extra: { event: "update_remediation_plan" } });
  });
  revalidate();
  return { id };
}

export async function approveRemediationPlan(id: string, note?: string) {
  const ctx = await requirePermission("compliance:approve");
  const plan = await prisma.remediationPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!plan) throw new Error("Plan de remediación no encontrado.");
  assertRemediationTransition(plan.status, "APPROVED");
  if (!plan.dueDate) throw new Error("Un plan sin fecha objetivo no puede aprobarse.");
  if (!plan.ownerId) throw new Error("Un plan sin responsable no puede aprobarse.");
  await prisma.$transaction(async (tx) => {
    await tx.remediationPlan.update({ where: { id }, data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date() } });
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, before: { status: plan.status }, after: { status: "APPROVED" }, extra: { event: "approve_remediation_plan", note } });
  });
  if (plan.ownerId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: plan.ownerId, title: `Plan de remediación aprobado: ${plan.code}`, body: `"${plan.title}" está aprobado y puede ejecutarse.`, type: "SUCCESS", link: "/app/compliance", idempotencyKey: `remediation:${id}:approved` });
  }
  revalidate();
  return { id, status: "APPROVED" as RemediationPlanStatus };
}

export async function updateRemediationProgress(id: string, input: { progressPercent: number; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const progressPercent = z.number().int().min(0).max(100).parse(input.progressPercent);
  const plan = await prisma.remediationPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!plan) throw new Error("Plan de remediación no encontrado.");
  assertApproved({ approvedById: plan.approvedById, approvedAt: plan.approvedAt });
  if (plan.status === "COMPLETED" || plan.status === "CANCELLED") throw new Error("Un plan cerrado no admite avances.");

  const today = new Date();
  const completedAt = progressPercent === 100 ? plan.completedAt ?? today : null;
  const status: RemediationPlanStatus = progressPercent === 100
    ? "COMPLETED"
    : effectiveStatus({ status: plan.status === "APPROVED" ? "IN_PROGRESS" : plan.status, dueDate: plan.dueDate, completedAt: null }, today);

  await prisma.$transaction(async (tx) => {
    await tx.remediationPlan.update({ where: { id }, data: { progressPercent, status, completedAt } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { progressPercent: plan.progressPercent, status: plan.status }, after: { progressPercent, status }, extra: { event: "update_remediation_progress", note: input.note } });
  });
  revalidate();
  return { id, progressPercent, status };
}

/** Verifica la eficacia del plan; nunca puede hacerlo su responsable. */
export async function verifyRemediationEffectiveness(id: string, input: { note: string; evidenceId?: string }) {
  const ctx = await requirePermission("compliance:approve");
  const plan = await prisma.remediationPlan.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!plan) throw new Error("Plan de remediación no encontrado.");
  assertEffectivenessVerification({
    status: plan.status, completedAt: plan.completedAt, verifierId: ctx.user.id, ownerId: plan.ownerId, note: input.note,
  });
  await assertRefInOrg(ctx.organization.id, { evidenceId: input.evidenceId });
  await prisma.$transaction(async (tx) => {
    await tx.remediationPlan.update({
      where: { id },
      data: {
        effectivenessVerified: true, effectivenessVerifiedById: ctx.user.id, effectivenessVerifiedAt: new Date(),
        verificationNote: input.note, verificationEvidenceId: input.evidenceId ?? null,
      },
    });
    if (plan.breachId) {
      await tx.complianceBreach.updateMany({ where: { id: plan.breachId, organizationId: ctx.organization.id, status: "UNDER_REMEDIATION" }, data: { status: "REMEDIATED" } });
    }
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, after: { effectivenessVerified: true }, extra: { event: "verify_remediation_effectiveness", note: input.note } });
  });
  revalidate();
  return { id, effectivenessVerified: true };
}

// ─────────────────────────────────────────────────────
// Formación (§7.2, §7.3)
// ─────────────────────────────────────────────────────

const trainingSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  topic: z.enum(["CODE_OF_CONDUCT", "ANTIBRIBERY", "ANTI_MONEY_LAUNDERING", "DATA_PROTECTION", "COMPETITION", "CONFLICT_OF_INTEREST", "SPEAK_UP_CHANNEL", "TRADE_SANCTIONS", "INFORMATION_SECURITY", "HUMAN_RIGHTS", "SECTOR_REGULATION", "OTHER"]).default("CODE_OF_CONDUCT"),
  obligationId: z.string().optional(),
  audience: z.string().max(1000).optional(),
  mandatory: z.boolean().default(true),
  deliveryMode: z.enum(["ONLINE", "CLASSROOM", "BLENDED", "ON_THE_JOB", "SELF_STUDY"]).default("ONLINE"),
  scheduledFor: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  targetCount: z.number().int().min(0).optional(),
  trainingCourseId: z.string().optional(),
  materialsDocumentId: z.string().optional(),
  nextDueDate: z.string().datetime().optional(),
});

export async function createComplianceTraining(input: z.infer<typeof trainingSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = trainingSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { trainingCourseId: data.trainingCourseId, documentId: data.materialsDocumentId });
  const code = data.code ?? await nextCode("FC", prisma.complianceTraining.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceTraining.create({
      data: tenantData(ctx, {
        code, title: data.title, topic: data.topic, obligationId: data.obligationId ?? null,
        audience: data.audience ?? null, mandatory: data.mandatory, deliveryMode: data.deliveryMode,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        durationMinutes: data.durationMinutes ?? null, targetCount: data.targetCount ?? null,
        trainingCourseId: data.trainingCourseId ?? null, materialsDocumentId: data.materialsDocumentId ?? null,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, title: data.title, topic: data.topic }, extra: { event: "create_compliance_training" } });
    return row;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateComplianceTraining(id: string, input: Partial<z.infer<typeof trainingSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = trainingSchema.partial().parse(input);
  const current = await prisma.complianceTraining.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Formación no encontrada.");
  await assertRefInOrg(ctx.organization.id, { trainingCourseId: data.trainingCourseId, documentId: data.materialsDocumentId });
  if (data.obligationId) {
    const found = await prisma.complianceObligation.findFirst({ where: tenantWhere(ctx, { id: data.obligationId }), select: { id: true } });
    if (!found) throw new Error("La obligación no pertenece a la organización.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.complianceTraining.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.topic !== undefined ? { topic: data.topic } : {}),
      ...(data.obligationId !== undefined ? { obligationId: data.obligationId || null } : {}),
      ...(data.audience !== undefined ? { audience: data.audience || null } : {}),
      ...(data.mandatory !== undefined ? { mandatory: data.mandatory } : {}),
      ...(data.deliveryMode !== undefined ? { deliveryMode: data.deliveryMode } : {}),
      ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes ?? null } : {}),
      ...(data.targetCount !== undefined ? { targetCount: data.targetCount ?? null } : {}),
      ...(data.trainingCourseId !== undefined ? { trainingCourseId: data.trainingCourseId || null } : {}),
      ...(data.materialsDocumentId !== undefined ? { materialsDocumentId: data.materialsDocumentId || null } : {}),
      ...(data.nextDueDate !== undefined ? { nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, targetCount: current.targetCount }, after: data, extra: { event: "update_compliance_training" } });
  });
  revalidate();
  return { id };
}

export async function recordTrainingCompletion(id: string, input: { completedCount: number; passRate?: number; effectivenessNote?: string; evidenceId?: string }) {
  const ctx = await requirePermission("compliance:update");
  const training = await prisma.complianceTraining.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!training) throw new Error("Formación no encontrada.");
  const completedCount = z.number().int().min(0).parse(input.completedCount);
  if (training.targetCount && completedCount > training.targetCount) {
    throw new Error("Las personas formadas no pueden superar la audiencia prevista.");
  }
  await assertRefInOrg(ctx.organization.id, { evidenceId: input.evidenceId });
  await prisma.$transaction(async (tx) => {
    await tx.complianceTraining.update({
      where: { id },
      data: {
        completedCount, completedAt: new Date(),
        ...(input.passRate !== undefined ? { passRate: z.number().int().min(0).max(100).parse(input.passRate) } : {}),
        ...(input.effectivenessNote !== undefined ? { effectivenessNote: input.effectivenessNote, effectivenessEvaluated: true } : {}),
        ...(input.evidenceId !== undefined ? { evidenceId: input.evidenceId } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: { completedCount, passRate: input.passRate }, extra: { event: "record_training_completion" } });
  });
  revalidate();
  return { id, completedCount };
}

// ─────────────────────────────────────────────────────
// Informes al órgano de gobierno (§5.1.2, §9.3)
// ─────────────────────────────────────────────────────

const governingReportSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  period: z.string().min(1).max(20),
  presentedTo: z.enum(["BOARD", "AUDIT_COMMITTEE", "ETHICS_COMMITTEE", "COMPLIANCE_COMMITTEE", "CEO", "EXECUTIVE_MANAGEMENT"]).default("BOARD"),
  executiveSummary: z.string().max(8000).optional(),
  resourcesRequested: z.string().max(4000).optional(),
  decisionsRequested: z.string().max(4000).optional(),
  documentId: z.string().optional(),
  managementReviewId: z.string().optional(),
});

/**
 * Prepara el informe al órgano de gobierno. Las secciones se rellenan con el
 * agregado del periodo, y la del canal de denuncias solo con volúmenes,
 * categorías y resultados: el informe no transporta identidades.
 */
export async function prepareGoverningBodyReport(input: z.infer<typeof governingReportSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = governingReportSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, managementReviewId: data.managementReviewId });
  const { getCompliancePayload } = await import("@/lib/compliance/queries");
  const payload = await getCompliancePayload();
  const digest = payload.digest;

  const code = data.code ?? await nextCode("OG", prisma.governingBodyReport.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.governingBodyReport.create({
      data: tenantData(ctx, {
        code, title: data.title, period: data.period, presentedTo: data.presentedTo, preparedById: ctx.user.id,
        reportedAt: new Date(), executiveSummary: data.executiveSummary ?? null,
        obligationsSummary: `Obligaciones: ${digest.obligations.total}; incumplidas: ${digest.obligations.nonCompliant}; sin evaluar: ${digest.obligations.notEvaluated}.`,
        risksSummary: `Riesgos: ${digest.risks.total}; alto/crítico: ${digest.risks.highOrCritical}; no aceptables: ${digest.risks.notAcceptable}.`,
        evaluationsSummary: `Evaluaciones: ${digest.evaluations.total}; aprobadas: ${digest.evaluations.approved}; en revisión: ${digest.evaluations.pendingReview}.`,
        breachesSummary: `Incumplimientos: ${digest.breaches.total}; abiertos: ${digest.breaches.open}; graves: ${digest.breaches.severe}; sanciones: ${digest.breaches.sanctions}.`,
        speakUpSummary: `Canal: ${digest.speakUp.total} caso(s); abiertos: ${digest.speakUp.open}; anónimos: ${digest.speakUp.anonymous}; fundados o parcialmente fundados: ${digest.speakUp.substantiated}. Categorías: ${digest.speakUp.byCategory.map((row) => `${row.category} (${row.count})`).join(", ") || "sin casos"}.`,
        investigationsSummary: `Investigaciones: ${digest.investigations.total}; activas: ${digest.investigations.active}; reasignadas por conflicto: ${digest.investigations.withConflict}.`,
        trainingSummary: `Formaciones obligatorias: ${digest.training.mandatory}; cobertura: ${digest.training.coverageRate ?? "n/d"}%.`,
        remediationSummary: `Remediaciones completadas: ${digest.remediation.completed}; fuera de plazo: ${digest.remediation.overdue}; sin verificar eficacia: ${digest.remediation.completedNotVerified}.`,
        resourcesRequested: data.resourcesRequested ?? null,
        decisionsRequested: data.decisionsRequested ?? (digest.escalations.length > 0 ? digest.escalations.join("; ") : null),
        reviewStatus: "DRAFT", documentId: data.documentId ?? null, managementReviewId: data.managementReviewId ?? null,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, period: data.period, presentedTo: data.presentedTo, escalations: digest.escalations.length }, extra: { event: "prepare_governing_body_report" } });
    return row;
  });
  revalidate();
  return { id: created.id, code, escalations: digest.escalations };
}

export async function updateGoverningBodyReport(id: string, input: Partial<z.infer<typeof governingReportSchema>>) {
  const ctx = await requirePermission("compliance:update");
  const data = governingReportSchema.partial().parse(input);
  const current = await prisma.governingBodyReport.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!current) throw new Error("Informe no encontrado.");
  if (current.reviewStatus !== "DRAFT") throw new Error("Solo un informe en borrador puede editarse.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, managementReviewId: data.managementReviewId });
  await prisma.$transaction(async (tx) => {
    await tx.governingBodyReport.update({ where: { id }, data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.period !== undefined ? { period: data.period } : {}),
      ...(data.presentedTo !== undefined ? { presentedTo: data.presentedTo } : {}),
      ...(data.executiveSummary !== undefined ? { executiveSummary: data.executiveSummary || null } : {}),
      ...(data.resourcesRequested !== undefined ? { resourcesRequested: data.resourcesRequested || null } : {}),
      ...(data.decisionsRequested !== undefined ? { decisionsRequested: data.decisionsRequested || null } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId || null } : {}),
      ...(data.managementReviewId !== undefined ? { managementReviewId: data.managementReviewId || null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { title: current.title, period: current.period }, after: data, extra: { event: "update_governing_body_report" } });
  });
  revalidate();
  return { id };
}

export async function submitGoverningBodyReport(id: string) {
  const ctx = await requirePermission("compliance:update");
  const report = await prisma.governingBodyReport.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!report) throw new Error("Informe no encontrado.");
  if (report.reviewStatus !== "DRAFT") throw new Error("Solo un informe en borrador puede enviarse.");
  await prisma.$transaction(async (tx) => {
    await tx.governingBodyReport.update({ where: { id }, data: { reviewStatus: "SUBMITTED", submittedAt: new Date() } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { reviewStatus: report.reviewStatus }, after: { reviewStatus: "SUBMITTED" }, extra: { event: "submit_governing_body_report" } });
  });
  revalidate();
  return { id, reviewStatus: "SUBMITTED" as const };
}

/** Registra el acuse del órgano de gobierno y las decisiones que tomó. */
export async function acknowledgeGoverningBodyReport(id: string, input: { decisionsTaken?: string; evidenceId?: string }) {
  const ctx = await requirePermission("compliance:approve");
  const report = await prisma.governingBodyReport.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!report) throw new Error("Informe no encontrado.");
  if (report.reviewStatus === "DRAFT") throw new Error("Un informe en borrador no puede acusarse: envíelo primero.");
  assertAcknowledgement({ acknowledgedById: ctx.user.id });
  await assertRefInOrg(ctx.organization.id, { evidenceId: input.evidenceId });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.governingBodyReport.update({
      where: { id },
      data: {
        reviewStatus: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedById: ctx.user.id,
        presentedAt: report.presentedAt ?? now,
        decisionsTaken: input.decisionsTaken ?? report.decisionsTaken,
        ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: MODULE, recordId: id, before: { reviewStatus: report.reviewStatus }, after: { reviewStatus: "ACKNOWLEDGED" }, extra: { event: "acknowledge_governing_body_report", decisionsTaken: input.decisionsTaken } });
  });
  revalidate();
  return { id, reviewStatus: "ACKNOWLEDGED" as const };
}
