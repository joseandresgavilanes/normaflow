"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import {
  assertDueDiligenceApproval,
  assertDueDiligenceRejection,
  assertDueDiligenceTransition,
  requiresEnhancedReview,
} from "@/lib/antibribery/due-diligence";
import {
  assertComplianceDecision,
  assertGiftRejection,
  assertGiftTransition,
  mustReachComplianceReview,
} from "@/lib/antibribery/gifts";
import { assertBriberyAssessmentApproval, computeBriberyRisk } from "@/lib/antibribery/risk";
import {
  assertHighRiskApproval,
  assertHighRiskRejection,
  assertHighRiskTransition,
  requiresIndependentApproval,
} from "@/lib/antibribery/approvals";
import type { DueDiligenceStatus, GiftHospitalityStatus, HighRiskApprovalStatus } from "@prisma/client";

const MODULE = "compliance";
const revalidate = () => {
  revalidatePath("/app/antibribery");
  revalidatePath("/app/compliance");
  revalidatePath("/app/activity");
};

async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "riskId" | "capaId" | "evidenceId" | "documentId" | "supplierId" | "controlId" | "obligationId" | "complianceRiskId" | "complianceControlId" | "speakUpReportId" | "breachId" | "investigationId" | "remediationPlanId" | "conflictOfInterestDeclarationId" | "jurisdictionId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } as const });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.riskId) guard(prisma.risk.findFirst(w(refs.riskId)), "de riesgo");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  if (refs.controlId) guard(prisma.organizationControl.findFirst(w(refs.controlId)), "de control");
  if (refs.obligationId) guard(prisma.complianceObligation.findFirst(w(refs.obligationId)), "de obligación");
  if (refs.complianceRiskId) guard(prisma.complianceRisk.findFirst(w(refs.complianceRiskId)), "de riesgo de compliance");
  if (refs.complianceControlId) guard(prisma.complianceControl.findFirst(w(refs.complianceControlId)), "de control de compliance");
  if (refs.speakUpReportId) guard(prisma.speakUpReport.findFirst(w(refs.speakUpReportId)), "de denuncia");
  if (refs.breachId) guard(prisma.complianceBreach.findFirst(w(refs.breachId)), "de incumplimiento");
  if (refs.investigationId) guard(prisma.investigation.findFirst(w(refs.investigationId)), "de investigación");
  if (refs.remediationPlanId) guard(prisma.remediationPlan.findFirst(w(refs.remediationPlanId)), "de remediación");
  if (refs.conflictOfInterestDeclarationId) {
    guard(prisma.conflictOfInterestDeclaration.findFirst(w(refs.conflictOfInterestDeclarationId)), "de conflicto");
  }
  if (refs.jurisdictionId) guard(prisma.jurisdiction.findFirst(w(refs.jurisdictionId)), "de jurisdicción");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[antibribery] notify failed:", e instanceof Error ? e.message : e); }
}

// ─── Riesgo de soborno ───────────────────────────────

const assessmentSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  scope: z.string().max(4000).optional(),
  processId: z.string().optional(),
  jurisdictionId: z.string().optional(),
  obligationId: z.string().optional(),
  complianceRiskId: z.string().optional(),
  riskId: z.string().optional(),
  inherentLikelihood: z.number().int().min(1).max(5).default(3),
  inherentImpact: z.number().int().min(1).max(5).default(3),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  controlEffectiveness: z.number().int().min(0).max(100).optional(),
  publicOfficialRisk: z.boolean().default(false),
  thirdPartyRisk: z.boolean().default(false),
  countryRisk: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("MODERATE"),
  sectorRisk: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("MODERATE"),
  treatment: z.enum(["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"]).default("MITIGATE"),
  treatmentPlan: z.string().max(4000).optional(),
  ownerId: z.string().optional(),
  nextReviewDate: z.string().datetime().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
  capaId: z.string().optional(),
});

export async function createBriberyRiskAssessment(input: z.infer<typeof assessmentSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = assessmentSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, {
    processId: data.processId, jurisdictionId: data.jurisdictionId, obligationId: data.obligationId,
    complianceRiskId: data.complianceRiskId, riskId: data.riskId, documentId: data.documentId,
    evidenceId: data.evidenceId, capaId: data.capaId,
  });
  const computed = computeBriberyRisk(data);
  const code = data.code ?? await nextCode("BRR", prisma.briberyRiskAssessment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.briberyRiskAssessment.create({
    data: tenantData(ctx, {
      code, title: data.title, scope: data.scope ?? null, processId: data.processId ?? null,
      jurisdictionId: data.jurisdictionId ?? null, obligationId: data.obligationId ?? null,
      complianceRiskId: data.complianceRiskId ?? null, riskId: data.riskId ?? null,
      inherentLikelihood: data.inherentLikelihood, inherentImpact: data.inherentImpact,
      inherentScore: computed.inherentScore, inherentLevel: computed.inherentLevel,
      residualLikelihood: data.residualLikelihood ?? null, residualImpact: data.residualImpact ?? null,
      residualScore: computed.residualScore, residualLevel: computed.residualLevel,
      publicOfficialRisk: data.publicOfficialRisk, thirdPartyRisk: data.thirdPartyRisk,
      countryRisk: data.countryRisk, sectorRisk: data.sectorRisk, treatment: data.treatment,
      treatmentPlan: data.treatmentPlan ?? null, ownerId: data.ownerId ?? null,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, residualLevel: computed.residualLevel }, extra: { event: "create_bribery_risk_assessment" } });
  revalidate();
  return { id: created.id, code };
}

export async function approveBriberyRiskAssessment(id: string, note?: string) {
  const ctx = await requirePermission("compliance:approve");
  const row = await prisma.briberyRiskAssessment.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Evaluación de riesgo de soborno no encontrada.");
  assertBriberyAssessmentApproval({ approvedById: ctx.user.id });
  await prisma.briberyRiskAssessment.update({
    where: { id },
    data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date() },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: row.status }, after: { status: "APPROVED" }, extra: { event: "approve_bribery_risk_assessment", note } });
  revalidate();
  return { id, status: "APPROVED" as const };
}

// ─── Socios de negocio ───────────────────────────────

const associateSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(300),
  associateType: z.enum(["SUPPLIER", "AGENT", "INTERMEDIARY", "DISTRIBUTOR", "JOINT_VENTURE", "CONSULTANT", "CUSTOMER", "PUBLIC_BODY", "NGO", "OTHER"]).default("SUPPLIER"),
  country: z.string().max(80).optional(),
  registrationNumber: z.string().max(80).optional(),
  industry: z.string().max(120).optional(),
  supplierId: z.string().optional(),
  riskTier: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  isPublicOfficial: z.boolean().default(false),
  interactsWithPEPs: z.boolean().default(false),
  ownershipKnown: z.boolean().default(false),
  ownerId: z.string().optional(),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createBusinessAssociate(input: z.infer<typeof associateSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = associateSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, documentId: data.documentId });
  const code = data.code ?? await nextCode("ASC", prisma.businessAssociate.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.businessAssociate.create({
    data: tenantData(ctx, {
      code, name: data.name, associateType: data.associateType, country: data.country ?? null,
      registrationNumber: data.registrationNumber ?? null, industry: data.industry ?? null,
      supplierId: data.supplierId ?? null, riskTier: data.riskTier, isPublicOfficial: data.isPublicOfficial,
      interactsWithPEPs: data.interactsWithPEPs, ownershipKnown: data.ownershipKnown,
      ownerId: data.ownerId ?? null, notes: data.notes ?? null, documentId: data.documentId ?? null,
      onboardingDate: new Date(), createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, riskTier: data.riskTier }, extra: { event: "create_business_associate" } });
  revalidate();
  return { id: created.id, code };
}

// ─── Debida diligencia ───────────────────────────────

const ddSchema = z.object({
  code: z.string().max(40).optional(),
  associateId: z.string().min(1),
  level: z.enum(["SIMPLIFIED", "STANDARD", "ENHANCED"]).default("STANDARD"),
  purpose: z.string().max(2000).optional(),
  obligationId: z.string().optional(),
  complianceRiskId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createDueDiligenceCase(input: z.infer<typeof ddSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = ddSchema.parse(input);
  const associate = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
  if (!associate) throw new Error("Socio de negocio no encontrado.");
  await assertRefInOrg(ctx.organization.id, {
    obligationId: data.obligationId, complianceRiskId: data.complianceRiskId,
    documentId: data.documentId, evidenceId: data.evidenceId,
  });
  const level = requiresEnhancedReview(associate) ? "ENHANCED" : data.level;
  const code = data.code ?? await nextCode("DD", prisma.dueDiligenceCase.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.dueDiligenceCase.create({
    data: tenantData(ctx, {
      code, associateId: data.associateId, level, purpose: data.purpose ?? null,
      obligationId: data.obligationId ?? null, complianceRiskId: data.complianceRiskId ?? null,
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, level }, extra: { event: "create_due_diligence_case" } });
  revalidate();
  return { id: created.id, code, level };
}

export async function transitionDueDiligence(
  id: string,
  input: {
    to: DueDiligenceStatus;
    screeningResult?: "NOT_SCREENED" | "CLEAR" | "POTENTIAL_MATCH" | "CONFIRMED_HIT" | "INCONCLUSIVE";
    findings?: string;
    residualRisk?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    conditions?: string;
    rejectionReason?: string;
    nextReviewDate?: string;
  },
) {
  const needsApprove = input.to === "APPROVED" || input.to === "REJECTED";
  const ctx = await requirePermission(needsApprove ? "compliance:approve" : "compliance:update");
  const row = await prisma.dueDiligenceCase.findFirst({
    where: tenantWhere(ctx, { id }),
    include: { associate: true },
  });
  if (!row) throw new Error("Caso de debida diligencia no encontrado.");
  assertDueDiligenceTransition(row.status, input.to);

  if (input.to === "APPROVED") {
    if (requiresEnhancedReview({ ...row.associate, screeningResult: input.screeningResult ?? row.screeningResult }) && row.status !== "ENHANCED_REVIEW" && row.status !== "PERIODIC_REVIEW") {
      throw new Error("Este socio exige revisión reforzada antes de la aprobación.");
    }
    assertDueDiligenceApproval({ approvedById: ctx.user.id });
  }
  if (input.to === "REJECTED") {
    assertDueDiligenceRejection({ rejectedById: ctx.user.id, rejectionReason: input.rejectionReason });
  }

  const now = new Date();
  const updated = await prisma.dueDiligenceCase.update({
    where: { id },
    data: {
      status: input.to,
      ...(input.screeningResult ? { screeningResult: input.screeningResult } : {}),
      ...(input.findings !== undefined ? { findings: input.findings } : {}),
      ...(input.residualRisk ? { residualRisk: input.residualRisk } : {}),
      ...(input.conditions !== undefined ? { conditions: input.conditions } : {}),
      ...(input.to === "REVIEW" || input.to === "ENHANCED_REVIEW"
        ? { reviewerId: ctx.user.id, reviewedAt: now }
        : {}),
      ...(input.to === "APPROVED"
        ? { approvedById: ctx.user.id, approvedAt: now, nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null }
        : {}),
      ...(input.to === "REJECTED"
        ? { rejectedById: ctx.user.id, rejectedAt: now, rejectionReason: input.rejectionReason ?? null }
        : {}),
    },
  });
  await logAuditEvent({ ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id, before: { status: row.status }, after: { status: input.to }, extra: { event: "transition_due_diligence" } });
  if (row.associate.ownerId && row.associate.ownerId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: row.associate.ownerId,
      title: `Debida diligencia ${updated.code}: ${input.to}`,
      body: `El caso del socio ${row.associate.name} pasó a ${input.to}.`,
      type: input.to === "REJECTED" ? "WARNING" : "INFO", link: "/app/antibribery",
      idempotencyKey: `dd:${id}:${input.to}`,
    });
  }
  revalidate();
  return { id, status: input.to };
}

// ─── Beneficiario final ──────────────────────────────

const ownerSchema = z.object({
  code: z.string().max(40).optional(),
  associateId: z.string().min(1),
  fullName: z.string().min(1).max(200),
  nationality: z.string().max(80).optional(),
  countryOfResidence: z.string().max(80).optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
  controlType: z.enum(["OWNERSHIP", "VOTING_RIGHTS", "OTHER_MEANS", "SENIOR_MANAGING_OFFICIAL"]).default("OWNERSHIP"),
  isPep: z.boolean().default(false),
  pepRole: z.string().max(200).optional(),
  evidenceId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createBeneficialOwner(input: z.infer<typeof ownerSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = ownerSchema.parse(input);
  const associate = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
  if (!associate) throw new Error("Socio de negocio no encontrado.");
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("UBO", prisma.beneficialOwner.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.beneficialOwner.create({
    data: tenantData(ctx, {
      code, associateId: data.associateId, fullName: data.fullName, nationality: data.nationality ?? null,
      countryOfResidence: data.countryOfResidence ?? null, ownershipPercent: data.ownershipPercent ?? null,
      controlType: data.controlType, isPep: data.isPep, pepRole: data.pepRole ?? null,
      evidenceId: data.evidenceId ?? null, notes: data.notes ?? null,
    }),
  });
  if (!associate.ownershipKnown) {
    await prisma.businessAssociate.update({ where: { id: associate.id }, data: { ownershipKnown: true } });
  }
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, isPep: data.isPep }, extra: { event: "create_beneficial_owner" } });
  revalidate();
  return { id: created.id, code };
}

export async function verifyBeneficialOwner(id: string) {
  const ctx = await requirePermission("compliance:update");
  const row = await prisma.beneficialOwner.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Beneficiario final no encontrado.");
  await prisma.beneficialOwner.update({
    where: { id },
    data: { verifiedAt: new Date(), verifiedById: ctx.user.id },
  });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, extra: { event: "verify_beneficial_owner" } });
  revalidate();
  return { id };
}

// ─── Regalos y hospitalidad ──────────────────────────

const giftSchema = z.object({
  code: z.string().max(40).optional(),
  recordType: z.enum(["GIFT", "HOSPITALITY", "TRAVEL", "ENTERTAINMENT", "OTHER"]).default("GIFT"),
  direction: z.enum(["GIVEN", "RECEIVED"]).default("GIVEN"),
  description: z.string().min(1).max(4000),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  occurredAt: z.string().datetime().optional(),
  counterpartyName: z.string().max(200).optional(),
  associateId: z.string().optional(),
  involvesPublicOfficial: z.boolean().default(false),
  publicOfficialRole: z.string().max(200).optional(),
  policyThreshold: z.number().nonnegative().optional(),
  conflictOfInterestDeclarationId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function submitGiftHospitality(input: z.infer<typeof giftSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = giftSchema.parse(input);
  if (data.associateId) {
    const associate = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
    if (!associate) throw new Error("Socio de negocio no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, {
    documentId: data.documentId, evidenceId: data.evidenceId,
    conflictOfInterestDeclarationId: data.conflictOfInterestDeclarationId,
  });
  const aboveThreshold = Boolean(
    typeof data.estimatedValue === "number" &&
    typeof data.policyThreshold === "number" &&
    data.estimatedValue > data.policyThreshold,
  );
  const code = data.code ?? await nextCode("GH", prisma.giftHospitalityRecord.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.giftHospitalityRecord.create({
    data: tenantData(ctx, {
      code, recordType: data.recordType, direction: data.direction, description: data.description,
      estimatedValue: data.estimatedValue ?? null, currency: data.currency ?? null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      counterpartyName: data.counterpartyName ?? null, associateId: data.associateId ?? null,
      involvesPublicOfficial: data.involvesPublicOfficial, publicOfficialRole: data.publicOfficialRole ?? null,
      submittedById: ctx.user.id, policyThreshold: data.policyThreshold ?? null, aboveThreshold,
      conflictDeclarationId: data.conflictOfInterestDeclarationId ?? null,
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, aboveThreshold, involvesPublicOfficial: data.involvesPublicOfficial }, extra: { event: "submit_gift_hospitality" } });
  revalidate();
  return { id: created.id, code };
}

export async function transitionGiftHospitality(
  id: string,
  input: { to: GiftHospitalityStatus; note?: string; rejectionReason?: string },
) {
  const decision = input.to === "APPROVED" || input.to === "REJECTED";
  const ctx = await requirePermission(decision || input.to === "COMPLIANCE_REVIEW" ? "compliance:approve" : "compliance:update");
  const row = await prisma.giftHospitalityRecord.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Registro de regalo u hospitalidad no encontrado.");
  assertGiftTransition(row.status, input.to);

  if (input.to === "REJECTED") assertGiftRejection(input.rejectionReason);
  if (decision) assertComplianceDecision({ reviewerId: ctx.user.id });

  // Manager no puede aprobar: el grafo solo permite APPROVED desde COMPLIANCE_REVIEW.
  const now = new Date();
  const data: Record<string, unknown> = { status: input.to };
  if (input.to === "COMPLIANCE_REVIEW") {
    data.managerId = ctx.user.id;
    data.managerReviewedAt = now;
    data.managerDecisionNote = input.note ?? null;
  }
  if (decision) {
    data.complianceReviewerId = ctx.user.id;
    data.complianceReviewedAt = now;
    data.complianceDecisionNote = input.note ?? null;
    data.rejectionReason = input.rejectionReason ?? null;
  }
  // Rechazo en revisión de manager: el CHECK exige revisor de compliance atribuido.
  if (input.to === "REJECTED" && row.status === "MANAGER_REVIEW") {
    data.managerId = ctx.user.id;
    data.managerReviewedAt = now;
    data.managerDecisionNote = input.note ?? null;
    data.complianceReviewerId = ctx.user.id;
    data.complianceReviewedAt = now;
  }

  await prisma.giftHospitalityRecord.update({ where: { id }, data });
  await logAuditEvent({
    ctx, action: decision ? "approve" : "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: input.to },
    extra: { event: "transition_gift_hospitality", requiresCompliance: mustReachComplianceReview(row) },
  });
  revalidate();
  return { id, status: input.to };
}

// ─── Donaciones y patrocinios ────────────────────────

const donationSchema = z.object({
  code: z.string().max(40).optional(),
  recordType: z.enum(["DONATION", "SPONSORSHIP", "COMMUNITY_INVESTMENT", "POLITICAL_CONTRIBUTION"]).default("DONATION"),
  beneficiaryName: z.string().min(1).max(300),
  associateId: z.string().optional(),
  purpose: z.string().max(2000).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  involvesPublicOfficial: z.boolean().default(false),
  politicalDonation: z.boolean().default(false),
  obligationId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createDonationSponsorship(input: z.infer<typeof donationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = donationSchema.parse(input);
  if (data.associateId) {
    const ok = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
    if (!ok) throw new Error("Socio de negocio no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, { obligationId: data.obligationId, documentId: data.documentId, evidenceId: data.evidenceId });
  const political = data.politicalDonation || data.recordType === "POLITICAL_CONTRIBUTION";
  const code = data.code ?? await nextCode("DON", prisma.donationSponsorshipRecord.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.donationSponsorshipRecord.create({
    data: tenantData(ctx, {
      code, recordType: data.recordType, beneficiaryName: data.beneficiaryName, associateId: data.associateId ?? null,
      purpose: data.purpose ?? null, amount: data.amount ?? null, currency: data.currency ?? null,
      involvesPublicOfficial: data.involvesPublicOfficial, politicalDonation: political,
      obligationId: data.obligationId ?? null, documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, politicalDonation: political }, extra: { event: "create_donation_sponsorship" } });
  revalidate();
  return { id: created.id, code };
}

export async function decideDonationSponsorship(id: string, input: { decision: "APPROVED" | "REJECTED"; rejectionReason?: string }) {
  const ctx = await requirePermission("compliance:approve");
  const row = await prisma.donationSponsorshipRecord.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Donación o patrocinio no encontrado.");
  if (input.decision === "REJECTED" && !input.rejectionReason) {
    throw new Error("Rechazar una donación o patrocinio exige un motivo.");
  }
  await prisma.donationSponsorshipRecord.update({
    where: { id },
    data: {
      status: input.decision,
      approvedById: input.decision === "APPROVED" ? ctx.user.id : null,
      approvedAt: input.decision === "APPROVED" ? new Date() : null,
      rejectionReason: input.rejectionReason ?? null,
    },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: row.status }, after: { status: input.decision }, extra: { event: "decide_donation_sponsorship" } });
  revalidate();
  return { id, status: input.decision };
}

// ─── Conflictos (ABMS) ───────────────────────────────

const conflictSchema = z.object({
  code: z.string().max(40).optional(),
  period: z.string().min(4).max(20),
  hasConflict: z.boolean().default(false),
  conflictNature: z.enum(["PUBLIC_OFFICIAL_RELATIONSHIP", "BUSINESS_ASSOCIATE", "FAMILY_IN_COUNTERPARTY", "FINANCIAL_INTEREST", "OUTSIDE_EMPLOYMENT", "GIFT_HOSPITALITY", "OTHER"]).default("OTHER"),
  description: z.string().max(4000).optional(),
  relatedAssociateId: z.string().optional(),
  relatedParty: z.string().max(200).optional(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  recusalRequired: z.boolean().default(false),
  conflictOfInterestDeclarationId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function declareAbmsConflict(input: z.infer<typeof conflictSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = conflictSchema.parse(input);
  if (data.hasConflict && !data.description) {
    throw new Error("Declarar un conflicto exige describirlo.");
  }
  await assertRefInOrg(ctx.organization.id, {
    evidenceId: data.evidenceId,
    conflictOfInterestDeclarationId: data.conflictOfInterestDeclarationId,
  });
  const code = data.code ?? await nextCode("ACD", prisma.conflictDeclaration.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.conflictDeclaration.create({
    data: tenantData(ctx, {
      code, declarantId: ctx.user.id, period: data.period, hasConflict: data.hasConflict,
      conflictNature: data.conflictNature, description: data.description ?? null,
      relatedAssociateId: data.relatedAssociateId ?? null, relatedParty: data.relatedParty ?? null,
      estimatedValue: data.estimatedValue ?? null, currency: data.currency ?? null,
      recusalRequired: data.recusalRequired,
      conflictOfInterestDeclarationId: data.conflictOfInterestDeclarationId ?? null,
      evidenceId: data.evidenceId ?? null,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, period: data.period, hasConflict: data.hasConflict }, extra: { event: "declare_abms_conflict" } });
  revalidate();
  return { id: created.id, code };
}

export async function reviewAbmsConflict(id: string, input: { decision: "ACCEPTED" | "MITIGATED" | "REJECTED"; mitigationMeasures?: string; recusalRequired?: boolean }) {
  const ctx = await requirePermission("compliance:approve");
  const row = await prisma.conflictDeclaration.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Declaración no encontrada.");
  if (row.declarantId === ctx.user.id) throw new Error("Nadie puede revisar su propia declaración de conflicto.");
  if (input.decision === "MITIGATED" && !input.mitigationMeasures) {
    throw new Error("Mitigar un conflicto exige registrar las medidas.");
  }
  await prisma.conflictDeclaration.update({
    where: { id },
    data: {
      reviewStatus: input.decision, reviewerId: ctx.user.id, reviewedAt: new Date(),
      mitigationMeasures: input.mitigationMeasures ?? row.mitigationMeasures,
      ...(input.recusalRequired !== undefined ? { recusalRequired: input.recusalRequired } : {}),
    },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { reviewStatus: row.reviewStatus }, after: { reviewStatus: input.decision }, extra: { event: "review_abms_conflict" } });
  revalidate();
  return { id, reviewStatus: input.decision };
}

// ─── Pagos de facilitación ───────────────────────────

const facilitationSchema = z.object({
  code: z.string().max(40).optional(),
  description: z.string().min(1).max(4000),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  occurredAt: z.string().datetime().optional(),
  country: z.string().max(80).optional(),
  publicOfficialRole: z.string().max(200).optional(),
  coerced: z.boolean().default(false),
  speakUpReportId: z.string().optional(),
  breachId: z.string().optional(),
  investigationId: z.string().optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function reportFacilitationPayment(input: z.infer<typeof facilitationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = facilitationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, {
    speakUpReportId: data.speakUpReportId, breachId: data.breachId,
    investigationId: data.investigationId, capaId: data.capaId, evidenceId: data.evidenceId,
  });
  const code = data.code ?? await nextCode("FP", prisma.facilitationPaymentReport.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.facilitationPaymentReport.create({
    data: tenantData(ctx, {
      code, description: data.description, amount: data.amount ?? null, currency: data.currency ?? null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : null, country: data.country ?? null,
      publicOfficialRole: data.publicOfficialRole ?? null, coerced: data.coerced,
      speakUpReportId: data.speakUpReportId ?? null, breachId: data.breachId ?? null,
      investigationId: data.investigationId ?? null, capaId: data.capaId ?? null,
      evidenceId: data.evidenceId ?? null, reportedById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, coerced: data.coerced }, extra: { event: "report_facilitation_payment" } });
  revalidate();
  return { id: created.id, code };
}

export async function reviewFacilitationPayment(id: string, input: { status: "UNDER_REVIEW" | "CONFIRMED" | "REMEDIATED" | "CLOSED" | "DISMISSED"; outcome?: string }) {
  const ctx = await requirePermission("compliance:update");
  const row = await prisma.facilitationPaymentReport.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Informe de pago de facilitación no encontrado.");
  await prisma.facilitationPaymentReport.update({
    where: { id },
    data: {
      status: input.status, reviewedById: ctx.user.id, reviewedAt: new Date(),
      outcome: input.outcome ?? row.outcome,
    },
  });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, before: { status: row.status }, after: { status: input.status }, extra: { event: "review_facilitation_payment" } });
  revalidate();
  return { id, status: input.status };
}

// ─── Controles financieros / no financieros ──────────

const controlTestSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  controlDescription: z.string().max(4000).optional(),
  complianceControlId: z.string().optional(),
  organizationControlId: z.string().optional(),
  obligationId: z.string().optional(),
  period: z.string().min(4).max(20),
  designAdequate: z.boolean().optional(),
  operatingEffective: z.boolean().optional(),
  sampleSize: z.number().int().positive().optional(),
  exceptionsFound: z.number().int().nonnegative().default(0),
  findings: z.string().max(4000).optional(),
  effectiveness: z.number().int().min(0).max(100).optional(),
  nextTestDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
  capaId: z.string().optional(),
  controlArea: z.enum(["PROCUREMENT", "HR_HIRING", "SALES_TENDERS", "TRAVEL_EXPENSES", "TRAINING_AWARENESS", "THIRD_PARTY_ONBOARDING", "WHISTLEBLOWING", "OTHER"]).optional(),
});

async function persistControlTest(kind: "financial" | "nonFinancial", input: z.infer<typeof controlTestSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = controlTestSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, {
    complianceControlId: data.complianceControlId, controlId: data.organizationControlId,
    obligationId: data.obligationId, evidenceId: data.evidenceId, capaId: data.capaId,
  });
  const failed = data.operatingEffective === false || (typeof data.exceptionsFound === "number" && data.exceptionsFound > 0 && data.operatingEffective !== true);
  const status = failed ? "FAILED" : "COMPLETED";
  if (kind === "financial") {
    const code = data.code ?? await nextCode("FCT", prisma.financialControlTest.count({ where: { organizationId: ctx.organization.id } }));
    const created = await prisma.financialControlTest.create({
      data: tenantData(ctx, {
        code, title: data.title, controlDescription: data.controlDescription ?? null,
        complianceControlId: data.complianceControlId ?? null, organizationControlId: data.organizationControlId ?? null,
        obligationId: data.obligationId ?? null, period: data.period, testedById: ctx.user.id,
        designAdequate: data.designAdequate ?? null, operatingEffective: data.operatingEffective ?? null,
        sampleSize: data.sampleSize ?? null, exceptionsFound: data.exceptionsFound,
        findings: data.findings ?? null, effectiveness: data.effectiveness ?? null, status,
        nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null,
        evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null, createdById: ctx.user.id,
      }),
    });
    await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, status }, extra: { event: "create_financial_control_test" } });
    revalidate();
    return { id: created.id, code, status };
  }
  const code = data.code ?? await nextCode("NFT", prisma.nonFinancialControlTest.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.nonFinancialControlTest.create({
    data: tenantData(ctx, {
      code, title: data.title, controlDescription: data.controlDescription ?? null,
      controlArea: data.controlArea ?? "OTHER",
      complianceControlId: data.complianceControlId ?? null, organizationControlId: data.organizationControlId ?? null,
      obligationId: data.obligationId ?? null, period: data.period, testedById: ctx.user.id,
      designAdequate: data.designAdequate ?? null, operatingEffective: data.operatingEffective ?? null,
      sampleSize: data.sampleSize ?? null, exceptionsFound: data.exceptionsFound,
      findings: data.findings ?? null, effectiveness: data.effectiveness ?? null, status,
      nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null,
      evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, status }, extra: { event: "create_non_financial_control_test" } });
  revalidate();
  return { id: created.id, code, status };
}

export async function recordFinancialControlTest(input: z.infer<typeof controlTestSchema>) {
  return persistControlTest("financial", input);
}

export async function recordNonFinancialControlTest(input: z.infer<typeof controlTestSchema>) {
  return persistControlTest("nonFinancial", input);
}

// ─── Operaciones de alto riesgo ──────────────────────

const highRiskSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  transactionType: z.enum(["AGENT_COMMISSION", "SUCCESS_FEE", "CASH_PAYMENT", "CROSS_BORDER_TRANSFER", "PUBLIC_TENDER", "CUSTOMS_CLEARANCE", "LICENSE_PERMIT", "OTHER"]).default("OTHER"),
  description: z.string().max(4000).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  associateId: z.string().optional(),
  counterpartyName: z.string().max(200).optional(),
  country: z.string().max(80).optional(),
  involvesPublicOfficial: z.boolean().default(false),
  riskRationale: z.string().max(4000).optional(),
  obligationId: z.string().optional(),
  complianceRiskId: z.string().optional(),
  dueDiligenceCaseId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function requestHighRiskApproval(input: z.infer<typeof highRiskSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = highRiskSchema.parse(input);
  if (data.associateId) {
    const ok = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
    if (!ok) throw new Error("Socio de negocio no encontrado.");
  }
  if (data.dueDiligenceCaseId) {
    const ok = await prisma.dueDiligenceCase.findFirst({ where: tenantWhere(ctx, { id: data.dueDiligenceCaseId }) });
    if (!ok) throw new Error("Caso de debida diligencia no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, {
    obligationId: data.obligationId, complianceRiskId: data.complianceRiskId,
    documentId: data.documentId, evidenceId: data.evidenceId,
  });
  const code = data.code ?? await nextCode("HRT", prisma.highRiskTransactionApproval.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.highRiskTransactionApproval.create({
    data: tenantData(ctx, {
      code, title: data.title, transactionType: data.transactionType, description: data.description ?? null,
      amount: data.amount ?? null, currency: data.currency ?? null, associateId: data.associateId ?? null,
      counterpartyName: data.counterpartyName ?? null, country: data.country ?? null,
      involvesPublicOfficial: data.involvesPublicOfficial, riskRationale: data.riskRationale ?? null,
      requestedById: ctx.user.id, obligationId: data.obligationId ?? null,
      complianceRiskId: data.complianceRiskId ?? null, dueDiligenceCaseId: data.dueDiligenceCaseId ?? null,
      documentId: data.documentId ?? null, evidenceId: data.evidenceId ?? null,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, transactionType: data.transactionType }, extra: { event: "request_high_risk_approval" } });
  revalidate();
  return { id: created.id, code };
}

export async function transitionHighRiskApproval(
  id: string,
  input: { to: HighRiskApprovalStatus; rejectionReason?: string; conditions?: string },
) {
  const needsApprove = input.to === "APPROVED" || input.to === "REJECTED";
  const ctx = await requirePermission(needsApprove ? "compliance:approve" : "compliance:update");
  const row = await prisma.highRiskTransactionApproval.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Solicitud de aprobación no encontrada.");
  assertHighRiskTransition(row.status, input.to);
  if (input.to === "APPROVED") {
    assertHighRiskApproval({ approvedById: ctx.user.id });
    requiresIndependentApproval({
      involvesPublicOfficial: row.involvesPublicOfficial,
      transactionType: row.transactionType,
      requestedById: row.requestedById,
      approvedById: ctx.user.id,
    });
  }
  if (input.to === "REJECTED") assertHighRiskRejection(input.rejectionReason);

  await prisma.highRiskTransactionApproval.update({
    where: { id },
    data: {
      status: input.to,
      ...(input.to === "APPROVED" ? { approvedById: ctx.user.id, approvedAt: new Date(), conditions: input.conditions ?? row.conditions } : {}),
      ...(input.to === "REJECTED" ? { rejectionReason: input.rejectionReason ?? null } : {}),
    },
  });
  await logAuditEvent({ ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id, before: { status: row.status }, after: { status: input.to }, extra: { event: "transition_high_risk_approval" } });
  revalidate();
  return { id, status: input.to };
}

// ─── Compromisos ─────────────────────────────────────

const commitmentSchema = z.object({
  code: z.string().max(40).optional(),
  commitmentType: z.enum(["EMPLOYEE", "BUSINESS_ASSOCIATE", "BOARD", "SENIOR_MANAGEMENT"]).default("EMPLOYEE"),
  subjectUserId: z.string().optional(),
  associateId: z.string().optional(),
  subjectName: z.string().max(200).optional(),
  version: z.string().max(20).default("1"),
  expiresAt: z.string().datetime().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function recordAntiBriberyCommitment(input: z.infer<typeof commitmentSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = commitmentSchema.parse(input);
  if (data.associateId) {
    const ok = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
    if (!ok) throw new Error("Socio de negocio no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("ABC", prisma.antiBriberyCommitment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.antiBriberyCommitment.create({
    data: tenantData(ctx, {
      code, commitmentType: data.commitmentType, subjectUserId: data.subjectUserId ?? null,
      associateId: data.associateId ?? null, subjectName: data.subjectName ?? null, version: data.version,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, documentId: data.documentId ?? null,
      evidenceId: data.evidenceId ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, commitmentType: data.commitmentType }, extra: { event: "record_anti_bribery_commitment" } });
  revalidate();
  return { id: created.id, code };
}

// ─── Investigación antisoborno (puente) ──────────────

const abInvestigationSchema = z.object({
  code: z.string().max(40).optional(),
  investigationId: z.string().min(1),
  speakUpReportId: z.string().optional(),
  breachId: z.string().optional(),
  allegationType: z.enum(["BRIBE_OFFER", "BRIBE_ACCEPTANCE", "FACILITATION_PAYMENT", "KICKBACK", "INFLUENCE_PEDDLING", "EMBEZZLEMENT_RELATED", "OTHER"]).default("OTHER"),
  involvesPublicOfficial: z.boolean().default(false),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  jurisdictionId: z.string().optional(),
  associateId: z.string().optional(),
  remediationPlanId: z.string().optional(),
  capaId: z.string().optional(),
});

export async function linkAntiBriberyInvestigation(input: z.infer<typeof abInvestigationSchema>) {
  const ctx = await requirePermission("compliance:create");
  const data = abInvestigationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, {
    investigationId: data.investigationId, speakUpReportId: data.speakUpReportId,
    breachId: data.breachId, jurisdictionId: data.jurisdictionId,
    remediationPlanId: data.remediationPlanId, capaId: data.capaId,
  });
  if (data.associateId) {
    const ok = await prisma.businessAssociate.findFirst({ where: tenantWhere(ctx, { id: data.associateId }) });
    if (!ok) throw new Error("Socio de negocio no encontrado.");
  }
  const code = data.code ?? await nextCode("ABI", prisma.antiBriberyInvestigation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.antiBriberyInvestigation.create({
    data: tenantData(ctx, {
      code, investigationId: data.investigationId, speakUpReportId: data.speakUpReportId ?? null,
      breachId: data.breachId ?? null, allegationType: data.allegationType,
      involvesPublicOfficial: data.involvesPublicOfficial, estimatedValue: data.estimatedValue ?? null,
      currency: data.currency ?? null, jurisdictionId: data.jurisdictionId ?? null,
      associateId: data.associateId ?? null, remediationPlanId: data.remediationPlanId ?? null,
      capaId: data.capaId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, investigationId: data.investigationId }, extra: { event: "link_anti_bribery_investigation" } });
  revalidate();
  return { id: created.id, code };
}

export async function closeAntiBriberyInvestigation(
  id: string,
  input: {
    outcome: "SUBSTANTIATED" | "PARTIALLY_SUBSTANTIATED" | "UNSUBSTANTIATED" | "INCONCLUSIVE" | "REFERRED_EXTERNALLY";
    sanctionsImposed?: string;
    status?: "CONCLUDED" | "CLOSED" | "REFERRED";
  },
) {
  const ctx = await requirePermission("compliance:approve");
  const row = await prisma.antiBriberyInvestigation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Investigación antisoborno no encontrada.");
  const status = input.status ?? "CLOSED";
  await prisma.antiBriberyInvestigation.update({
    where: { id },
    data: {
      status, outcome: input.outcome, sanctionsImposed: input.sanctionsImposed ?? row.sanctionsImposed,
      closedAt: new Date(),
    },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: row.status }, after: { status, outcome: input.outcome }, extra: { event: "close_anti_bribery_investigation" } });
  revalidate();
  return { id, status, outcome: input.outcome };
}
