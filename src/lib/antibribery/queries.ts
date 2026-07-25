import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { computeBriberyRisk } from "@/lib/antibribery/risk";
import { requiresEnhancedReview } from "@/lib/antibribery/due-diligence";
import { mustReachComplianceReview } from "@/lib/antibribery/gifts";

export type AntibriberyPayload = Awaited<ReturnType<typeof getAntibriberyPayload>>;

/**
 * Payload del módulo ISO 37001. Extiende compliance: no trae obligaciones ni
 * denuncias completas — solo los artefactos especializados y los puentes.
 */
export async function getAntibriberyPayload() {
  const auth = await requireAuthorization("compliance:read");
  const organizationId = auth.ctx.organization.id;
  const userId = auth.ctx.user.id;
  const canApprove = auth.can("compliance:approve");

  const [
    assessments,
    associates,
    dueDiligence,
    owners,
    gifts,
    donations,
    conflicts,
    facilitation,
    financialTests,
    nonFinancialTests,
    highRisk,
    commitments,
    investigations,
    members,
  ] = await Promise.all([
    prisma.briberyRiskAssessment.findMany({ where: { organizationId }, orderBy: [{ residualScore: "desc" }, { code: "asc" }] }),
    prisma.businessAssociate.findMany({
      where: { organizationId },
      include: { _count: { select: { beneficialOwners: true, dueDiligence: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.dueDiligenceCase.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true, riskTier: true, isPublicOfficial: true, interactsWithPEPs: true } } },
      orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
    }),
    prisma.beneficialOwner.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.giftHospitalityRecord.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.donationSponsorshipRecord.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.conflictDeclaration.findMany({
      where: canApprove ? { organizationId } : { organizationId, declarantId: userId },
      orderBy: [{ period: "desc" }, { code: "asc" }],
    }),
    prisma.facilitationPaymentReport.findMany({ where: { organizationId }, orderBy: { reportedAt: "desc" } }),
    prisma.financialControlTest.findMany({ where: { organizationId }, orderBy: [{ period: "desc" }, { code: "asc" }] }),
    prisma.nonFinancialControlTest.findMany({ where: { organizationId }, orderBy: [{ period: "desc" }, { code: "asc" }] }),
    prisma.highRiskTransactionApproval.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.antiBriberyCommitment.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { committedAt: "desc" },
    }),
    prisma.antiBriberyInvestigation.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
  ]);

  const assessmentRows = assessments.map((row) => {
    const computed = computeBriberyRisk({
      inherentLikelihood: row.inherentLikelihood,
      inherentImpact: row.inherentImpact,
      residualLikelihood: row.residualLikelihood,
      residualImpact: row.residualImpact,
      countryRisk: row.countryRisk,
      sectorRisk: row.sectorRisk,
      publicOfficialRisk: row.publicOfficialRisk,
      thirdPartyRisk: row.thirdPartyRisk,
    });
    return { ...row, computed };
  });

  const giftRows = gifts.map((row) => ({
    ...row,
    requiresCompliance: mustReachComplianceReview({
      aboveThreshold: row.aboveThreshold,
      involvesPublicOfficial: row.involvesPublicOfficial,
      estimatedValue: row.estimatedValue,
      policyThreshold: row.policyThreshold,
    }),
  }));

  const ddRows = dueDiligence.map((row) => ({
    ...row,
    enhancedRequired: requiresEnhancedReview({
      riskTier: row.associate.riskTier,
      isPublicOfficial: row.associate.isPublicOfficial,
      interactsWithPEPs: row.associate.interactsWithPEPs,
      screeningResult: row.screeningResult,
    }),
  }));

  return {
    can: {
      create: auth.can("compliance:create"),
      update: auth.can("compliance:update"),
      approve: canApprove,
      export: auth.can("compliance:export"),
    },
    members,
    assessments: assessmentRows,
    associates,
    dueDiligence: ddRows,
    owners,
    gifts: giftRows,
    donations,
    conflicts,
    conflictsComplete: canApprove,
    facilitation,
    financialTests,
    nonFinancialTests,
    highRisk,
    commitments,
    investigations,
    summary: {
      assessments: assessments.length,
      assessmentsApproved: assessments.filter((r) => r.status === "APPROVED").length,
      highResidual: assessments.filter((r) => r.residualLevel === "HIGH" || r.residualLevel === "CRITICAL").length,
      associates: associates.length,
      highRiskAssociates: associates.filter((r) => r.riskTier === "HIGH" || r.riskTier === "CRITICAL").length,
      dueDiligenceOpen: dueDiligence.filter((r) => !["APPROVED", "REJECTED"].includes(r.status)).length,
      dueDiligenceOverdue: dueDiligence.filter((r) => r.nextReviewDate && r.nextReviewDate < new Date() && r.status === "APPROVED").length,
      pepOwners: owners.filter((r) => r.isPep).length,
      giftsPending: gifts.filter((r) => !["APPROVED", "REJECTED"].includes(r.status)).length,
      donationsPolitical: donations.filter((r) => r.politicalDonation).length,
      facilitationOpen: facilitation.filter((r) => !["CLOSED", "DISMISSED"].includes(r.status)).length,
      controlFailures: [...financialTests, ...nonFinancialTests].filter((r) => r.status === "FAILED" || r.operatingEffective === false).length,
      highRiskPending: highRisk.filter((r) => r.status === "REQUESTED" || r.status === "UNDER_REVIEW").length,
      commitments: commitments.length,
      investigationsOpen: investigations.filter((r) => r.status === "OPEN" || r.status === "ACTIVE").length,
    },
  };
}
