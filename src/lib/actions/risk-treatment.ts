"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import {
  acceptanceSchema,
  closeItemSchema,
  itemControlLinkSchema,
  itemCreateSchema,
  itemUpdateSchema,
  methodologySchema,
  planApprovalSchema,
  planCreateSchema,
  residualApproveSchema,
  residualAssessmentSchema,
  riskExportSchema,
} from "@/lib/validation/risk-treatment";

const PATH = "/app/risk-treatment";
const PLAN_EDITABLE = ["DRAFT", "UNDER_REVIEW"] as const;

const DEFAULT_SCALE = [
  { level: 1, label: "Muy bajo" },
  { level: 2, label: "Bajo" },
  { level: 3, label: "Medio" },
  { level: 4, label: "Alto" },
  { level: 5, label: "Muy alto" },
];
const DEFAULT_MATRIX = { type: "5x5", multiply: true, low: [1, 6], medium: [7, 12], high: [13, 25] };

export type RiskTreatmentPayload = Awaited<ReturnType<typeof getRiskTreatmentPayload>>;

function dateValue(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }
function toParsedDate(value: string | null | undefined) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
}
async function ensureMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const member = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!member) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}
function nextReference(existing: string[]) {
  const max = existing.reduce((acc, ref) => {
    const match = /(\d+)$/.exec(ref);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `R-${String(max + 1).padStart(3, "0")}`;
}

export async function getRiskTreatmentPayload() {
  const authorization = await requireAuthorization("risk-treatment:read");
  const organizationId = authorization.ctx.organization.id;

  const [plan, methodology, members, evidenceOptions, orgControlOptions, riskOptions, plans] = await Promise.all([
    prisma.riskTreatmentPlan.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        methodology: { select: { id: true, title: true, version: true } },
        items: {
          orderBy: { reference: "asc" },
          include: {
            owner: { select: { id: true, name: true } },
            risk: { select: { id: true, title: true } },
            controls: { include: { organizationControl: { select: { id: true, control: { select: { code: true, title: true } } } } } },
            residualAssessments: { orderBy: { assessedAt: "desc" }, take: 5, include: { assessedBy: { select: { id: true, name: true } } } },
            acceptances: { orderBy: { acceptedAt: "desc" }, take: 3, include: { acceptedBy: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.riskAssessmentMethodology.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, include: { owner: { select: { id: true, name: true } } } }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.organizationControl.findMany({ where: { organizationId }, select: { id: true, control: { select: { code: true, title: true } } }, orderBy: { control: { sortOrder: "asc" } }, take: 200 }),
    prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { score: "desc" }, take: 500 }),
    prisma.riskTreatmentPlan.findMany({ where: { organizationId }, orderBy: { version: "desc" }, select: { id: true, version: true, title: true, status: true, approvedAt: true } }),
  ]);

  const items = plan?.items ?? [];
  const summary = {
    total: items.length,
    open: items.filter((i) => i.status === "OPEN").length,
    inTreatment: items.filter((i) => i.status === "IN_TREATMENT").length,
    residualPending: items.filter((i) => i.status === "RESIDUAL_PENDING").length,
    accepted: items.filter((i) => i.status === "ACCEPTED").length,
    closed: items.filter((i) => i.status === "CLOSED").length,
    highInherent: items.filter((i) => i.inherentRisk >= 13).length,
    highResidual: items.filter((i) => (i.residualRisk ?? i.inherentRisk) >= 13).length,
  };

  return {
    canUpdate: authorization.can("risk-treatment:update"),
    canApprove: authorization.can("risk-treatment:approve"),
    canExport: authorization.can("risk-treatment:export"),
    methodology: methodology
      ? { id: methodology.id, version: methodology.version, title: methodology.title, description: methodology.description, acceptanceCriteria: methodology.acceptanceCriteria, acceptanceThreshold: methodology.acceptanceThreshold, owner: methodology.owner, approvedAt: methodology.approvedAt?.toISOString() ?? null }
      : null,
    plan: plan
      ? {
          id: plan.id,
          version: plan.version,
          title: plan.title,
          status: plan.status,
          owner: plan.owner,
          approver: plan.approver,
          methodology: plan.methodology,
          approvalComment: plan.approvalComment,
          approvedAt: plan.approvedAt?.toISOString() ?? null,
          nextReviewDate: dateValue(plan.nextReviewDate),
          editable: PLAN_EDITABLE.includes(plan.status as (typeof PLAN_EDITABLE)[number]),
        }
      : null,
    summary,
    items: items.map((i) => ({
      id: i.id,
      reference: i.reference,
      title: i.title,
      description: i.description,
      asset: i.asset,
      threat: i.threat,
      vulnerability: i.vulnerability,
      impact: i.impact,
      probability: i.probability,
      inherentRisk: i.inherentRisk,
      existingControls: i.existingControls,
      proposedControls: i.proposedControls,
      treatment: i.treatment,
      residualImpact: i.residualImpact,
      residualProbability: i.residualProbability,
      residualRisk: i.residualRisk,
      owner: i.owner,
      risk: i.risk,
      targetDate: dateValue(i.targetDate),
      status: i.status,
      controls: i.controls.map((c) => ({ id: c.id, role: c.role, organizationControlId: c.organizationControlId, code: c.organizationControl.control.code, title: c.organizationControl.control.title })),
      residualAssessments: i.residualAssessments.map((r) => ({ id: r.id, residualImpact: r.residualImpact, residualProbability: r.residualProbability, residualRisk: r.residualRisk, rationale: r.rationale, approved: r.approved, assessedBy: r.assessedBy, assessedAt: r.assessedAt.toISOString() })),
      acceptances: i.acceptances.map((a) => ({ id: a.id, justification: a.justification, comment: a.comment, acceptedBy: a.acceptedBy, acceptedAt: a.acceptedAt.toISOString(), validUntil: dateValue(a.validUntil) })),
      canClose: i.residualAssessments.some((r) => r.approved) && i.acceptances.length > 0,
    })),
    plans,
    members: members.map((m) => m.user),
    evidenceOptions,
    orgControlOptions: orgControlOptions.map((c) => ({ id: c.id, code: c.control.code, title: c.control.title })),
    riskOptions,
  };
}

export async function upsertMethodology(input: unknown) {
  const data = parseInput(methodologySchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.riskAssessmentMethodology.findFirst({ where: { organizationId }, orderBy: { version: "desc" } });
    const payload = {
      title: data.title,
      description: data.description ?? null,
      acceptanceCriteria: data.acceptanceCriteria,
      acceptanceThreshold: data.acceptanceThreshold ?? null,
      probabilityScale: (data.probabilityScale ?? DEFAULT_SCALE) as Prisma.InputJsonValue,
      impactScale: (data.impactScale ?? DEFAULT_SCALE) as Prisma.InputJsonValue,
      riskMatrix: DEFAULT_MATRIX as Prisma.InputJsonValue,
      ownerId: data.ownerId ?? null,
    };
    const saved = existing
      ? await tx.riskAssessmentMethodology.update({ where: { id: existing.id }, data: payload })
      : await tx.riskAssessmentMethodology.create({ data: { organizationId, version: 1, ...payload } });
    await writeAuditLog(tx, { ctx, action: existing ? "update" : "create", module: "risk_methodology", recordId: saved.id });
    return saved;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function createRiskTreatmentPlan(input: unknown) {
  const data = parseInput(planCreateSchema, input);
  const ctx = await requirePermission("risk-treatment:create");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const open = await tx.riskTreatmentPlan.findFirst({ where: { organizationId, status: { in: [...PLAN_EDITABLE] } } });
    if (open) throw new Error("Ya existe un plan en borrador o revisión; edítalo en lugar de crear otro.");
    if (data.methodologyId) {
      const m = await tx.riskAssessmentMethodology.findFirst({ where: { id: data.methodologyId, organizationId } });
      if (!m) throw new Error("La metodología no pertenece a la organización.");
    }
    if (data.soaId) {
      const s = await tx.statementOfApplicability.findFirst({ where: { id: data.soaId, organizationId } });
      if (!s) throw new Error("La SoA no pertenece a la organización.");
    }
    const latest = await tx.riskTreatmentPlan.aggregate({ where: { organizationId }, _max: { version: true } });
    const plan = await tx.riskTreatmentPlan.create({ data: { organizationId, version: (latest._max.version ?? 0) + 1, title: data.title, methodologyId: data.methodologyId ?? null, soaId: data.soaId ?? null, ownerId: ctx.user.id } });
    await writeAuditLog(tx, { ctx, action: "create", module: "risk_treatment_plan", recordId: plan.id, after: { version: plan.version } });
    return plan;
  });
  revalidatePath(PATH);
  return { id: result.id, version: result.version };
}

export async function approveRiskTreatmentPlan(input: unknown) {
  const data = parseInput(planApprovalSchema, input);
  const ctx = await requirePermission("risk-treatment:approve");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.riskTreatmentPlan.findFirst({ where: { id: data.id, organizationId } });
    if (!plan) throw new Error("Plan de tratamiento no encontrado.");
    if (!PLAN_EDITABLE.includes(plan.status as (typeof PLAN_EDITABLE)[number])) throw new Error("El plan ya está aprobado o reemplazado.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia de aprobación no pertenece a la organización.");
    }
    const approved = await tx.riskTreatmentPlan.update({ where: { id: plan.id }, data: { status: "APPROVED", approverId: ctx.user.id, approvedAt: new Date(), approvalComment: data.comment ?? null, approvalEvidenceId: data.evidenceId ?? null, nextReviewDate: toParsedDate(data.nextReviewDate) } });
    const superseded = await tx.riskTreatmentPlan.updateMany({ where: { organizationId, status: "APPROVED", id: { not: plan.id } }, data: { status: "SUPERSEDED" } });
    await writeAuditLog(tx, { ctx, action: "approve", module: "risk_treatment_plan", recordId: plan.id, after: { version: plan.version, approverId: ctx.user.id, superseded: superseded.count } });
    return approved;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function createRiskTreatmentItem(input: unknown) {
  const data = parseInput(itemCreateSchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.riskTreatmentPlan.findFirst({ where: { id: data.planId, organizationId } });
    if (!plan) throw new Error("Plan de tratamiento no encontrado.");
    if (data.riskId) {
      const r = await tx.risk.findFirst({ where: { id: data.riskId, organizationId } });
      if (!r) throw new Error("El riesgo vinculado no pertenece a la organización.");
    }
    const refs = await tx.riskTreatmentItem.findMany({ where: { planId: plan.id }, select: { reference: true } });
    const reference = nextReference(refs.map((r) => r.reference));
    const item = await tx.riskTreatmentItem.create({
      data: {
        organizationId,
        planId: plan.id,
        reference,
        title: data.title,
        description: data.description ?? null,
        riskId: data.riskId ?? null,
        asset: data.asset ?? null,
        threat: data.threat ?? null,
        vulnerability: data.vulnerability ?? null,
        impact: data.impact,
        probability: data.probability,
        inherentRisk: data.impact * data.probability,
        existingControls: data.existingControls ?? null,
        proposedControls: data.proposedControls ?? null,
        treatment: data.treatment,
        ownerId: data.ownerId ?? null,
        targetDate: toParsedDate(data.targetDate),
        status: "OPEN",
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "risk_treatment_item", recordId: item.id, after: { reference, inherentRisk: item.inherentRisk } });
    return item;
  });
  revalidatePath(PATH);
  return { id: result.id, reference: result.reference };
}

export async function updateRiskTreatmentItem(input: unknown) {
  const data = parseInput(itemUpdateSchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.riskTreatmentItem.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Riesgo no encontrado.");
    if (before.status === "CLOSED") throw new Error("Un riesgo cerrado no puede modificarse.");
    if (data.riskId) {
      const r = await tx.risk.findFirst({ where: { id: data.riskId, organizationId } });
      if (!r) throw new Error("El riesgo vinculado no pertenece a la organización.");
    }
    const updated = await tx.riskTreatmentItem.updateMany({
      where: { id: data.id, organizationId },
      data: {
        title: data.title,
        description: data.description ?? null,
        riskId: data.riskId ?? null,
        asset: data.asset ?? null,
        threat: data.threat ?? null,
        vulnerability: data.vulnerability ?? null,
        impact: data.impact,
        probability: data.probability,
        inherentRisk: data.impact * data.probability,
        existingControls: data.existingControls ?? null,
        proposedControls: data.proposedControls ?? null,
        treatment: data.treatment,
        ownerId: data.ownerId ?? null,
        targetDate: toParsedDate(data.targetDate),
      },
    });
    if (updated.count !== 1) throw new Error("El riesgo cambió mientras se editaba; vuelve a cargarlo.");
    await writeAuditLog(tx, { ctx, action: "update", module: "risk_treatment_item", recordId: data.id, before: { impact: before.impact, probability: before.probability, inherentRisk: before.inherentRisk }, after: { impact: data.impact, probability: data.probability, inherentRisk: data.impact * data.probability } });
    return { id: data.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function assessResidualRisk(input: unknown) {
  const data = parseInput(residualAssessmentSchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  const residualRisk = data.residualImpact * data.residualProbability;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.riskTreatmentItem.findFirst({ where: { id: data.itemId, organizationId } });
    if (!item) throw new Error("Riesgo no encontrado.");
    if (item.status === "CLOSED") throw new Error("Un riesgo cerrado no admite nuevas evaluaciones.");
    const assessment = await tx.residualRiskAssessment.create({ data: { organizationId, itemId: item.id, residualImpact: data.residualImpact, residualProbability: data.residualProbability, residualRisk, rationale: data.rationale ?? null, assessedById: ctx.user.id } });
    await tx.riskTreatmentItem.update({ where: { id: item.id }, data: { residualImpact: data.residualImpact, residualProbability: data.residualProbability, residualRisk, status: item.status === "OPEN" ? "IN_TREATMENT" : "RESIDUAL_PENDING" } });
    await writeAuditLog(tx, { ctx, action: "assess_residual", module: "risk_treatment_item", recordId: item.id, after: { assessmentId: assessment.id, residualRisk } });
    return assessment;
  });
  revalidatePath(PATH);
  return { id: result.id, residualRisk };
}

export async function approveResidualRisk(input: unknown) {
  const data = parseInput(residualApproveSchema, input);
  const ctx = await requirePermission("risk-treatment:approve");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const assessment = await tx.residualRiskAssessment.findFirst({ where: { id: data.id, organizationId } });
    if (!assessment) throw new Error("Evaluación de riesgo residual no encontrada.");
    const updated = await tx.residualRiskAssessment.updateMany({ where: { id: assessment.id, organizationId, approved: false }, data: { approved: true } });
    if (updated.count !== 1) throw new Error("La evaluación ya fue aprobada.");
    await tx.riskTreatmentItem.update({ where: { id: assessment.itemId }, data: { residualImpact: assessment.residualImpact, residualProbability: assessment.residualProbability, residualRisk: assessment.residualRisk, status: "RESIDUAL_PENDING" } });
    await writeAuditLog(tx, { ctx, action: "approve_residual", module: "risk_treatment_item", recordId: assessment.itemId, after: { assessmentId: assessment.id } });
    return assessment;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function acceptResidualRisk(input: unknown) {
  const data = parseInput(acceptanceSchema, input);
  const ctx = await requirePermission("risk-treatment:approve");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.riskTreatmentItem.findFirst({ where: { id: data.itemId, organizationId } });
    if (!item) throw new Error("Riesgo no encontrado.");
    const approvedResidual = await tx.residualRiskAssessment.findFirst({ where: { itemId: item.id, organizationId, approved: true }, orderBy: { assessedAt: "desc" } });
    if (!approvedResidual) throw new Error("El riesgo residual debe evaluarse y aprobarse antes de aceptarlo.");
    if (data.residualAssessmentId) {
      const linked = await tx.residualRiskAssessment.findFirst({ where: { id: data.residualAssessmentId, itemId: item.id } });
      if (!linked) throw new Error("La evaluación residual no corresponde a este riesgo.");
    }
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const acceptance = await tx.riskAcceptance.create({ data: { organizationId, itemId: item.id, residualAssessmentId: data.residualAssessmentId ?? approvedResidual.id, justification: data.justification, comment: data.comment ?? null, acceptedById: ctx.user.id, evidenceId: data.evidenceId ?? null, validUntil: toParsedDate(data.validUntil) } });
    await tx.riskTreatmentItem.update({ where: { id: item.id }, data: { status: "ACCEPTED" } });
    await writeAuditLog(tx, { ctx, action: "accept_residual", module: "risk_treatment_item", recordId: item.id, after: { acceptanceId: acceptance.id } });
    return acceptance;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function closeRiskTreatmentItem(input: unknown) {
  const data = parseInput(closeItemSchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.riskTreatmentItem.findFirst({ where: { id: data.id, organizationId } });
    if (!item) throw new Error("Riesgo no encontrado.");
    const approvedResidual = await tx.residualRiskAssessment.findFirst({ where: { itemId: item.id, organizationId, approved: true } });
    if (!approvedResidual) throw new Error("No se puede cerrar el riesgo sin una evaluación de riesgo residual aprobada.");
    const acceptance = await tx.riskAcceptance.findFirst({ where: { itemId: item.id, organizationId } });
    if (!acceptance) throw new Error("No se puede cerrar el riesgo sin una aceptación formal del riesgo residual.");
    const updated = await tx.riskTreatmentItem.updateMany({ where: { id: item.id, organizationId, status: { not: "CLOSED" } }, data: { status: "CLOSED" } });
    if (updated.count !== 1) throw new Error("El riesgo ya está cerrado.");
    await writeAuditLog(tx, { ctx, action: "close", module: "risk_treatment_item", recordId: item.id });
    return { id: item.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function linkItemControl(input: unknown) {
  const data = parseInput(itemControlLinkSchema, input);
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [item, control] = await Promise.all([
      tx.riskTreatmentItem.findFirst({ where: { id: data.itemId, organizationId } }),
      tx.organizationControl.findFirst({ where: { id: data.organizationControlId, organizationId } }),
    ]);
    if (!item || !control) throw new Error("Riesgo o control no pertenecen a la organización.");
    const link = await tx.riskTreatmentControl.create({ data: { organizationId, itemId: item.id, organizationControlId: control.id, role: data.role } });
    await writeAuditLog(tx, { ctx, action: "link_control", module: "risk_treatment_item", recordId: item.id, after: { linkId: link.id, organizationControlId: control.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function unlinkItemControl(id: string) {
  const ctx = await requirePermission("risk-treatment:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.riskTreatmentControl.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.riskTreatmentControl.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_control", module: "risk_treatment_item", recordId: link.itemId, before: { linkId: link.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function exportRiskTreatment(input: unknown) {
  const data = parseInput(riskExportSchema, input);
  const ctx = await requirePermission("risk-treatment:export");
  const now = new Date();
  const reportType = data.reportType ?? "risk-matrix";
  const titles: Record<string, string> = {
    "risk-matrix": "Matriz de riesgos",
    "risk-treatment-plan": "Plan de tratamiento de riesgos",
    "residual-risks": "Riesgos residuales",
  };
  const report = await queueReportForContext({
    ctx,
    reportType,
    title: titles[reportType] ?? "Tratamiento de riesgos",
    format: data.format,
    fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`,
    dateFrom: now,
    dateTo: now,
    filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
  });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
