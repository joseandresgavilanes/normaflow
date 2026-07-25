import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import AntibriberyClient from "@/components/antibribery/AntibriberyClient";
import { getAppContext } from "@/lib/app-context";
import { getAntibriberyPayload, type AntibriberyPayload } from "@/lib/antibribery/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Antisoborno | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function AntibriberyPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="compliance:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <AntibriberyClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <AntibriberyClient initial={await getAntibriberyPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[antibribery] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema de Gestión Antisoborno" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const ahead = (days: number) => new Date(Date.now() + day * days);
const stamps = { createdAt: ago(90), updatedAt: ago(5) };

/** Demo: programa antisoborno ficticio que reutiliza el SGC (sin inventar obligaciones ni canal). */
function demoPayload(): AntibriberyPayload {
  return {
    can: { create: false, update: false, approve: false, export: false },
    members: [
      { id: "demo-u1", name: "Elena Cumplimiento" },
      { id: "demo-u2", name: "Marco Compras" },
      { id: "demo-u3", name: "Consejo de administración" },
    ],
    assessments: [
      {
        id: "d-a1", organizationId: "demo", code: "RSB-0001", title: "Soborno en contratación pública internacional",
        scope: "Licitaciones en LatAm con intermediarios", processId: null, jurisdictionId: null,
        obligationId: null, complianceRiskId: null, riskId: null,
        inherentLikelihood: 4, inherentImpact: 5, inherentScore: 22, inherentLevel: "CRITICAL",
        residualLikelihood: 2, residualImpact: 4, residualScore: 9, residualLevel: "MEDIUM",
        publicOfficialRisk: true, thirdPartyRisk: true, countryRisk: "HIGH", sectorRisk: "HIGH",
        treatment: "MITIGATE", treatmentPlan: "Debida diligencia reforzada + aprobación dual",
        ownerId: "demo-u1", assessedAt: ago(40), nextReviewDate: ahead(325), status: "APPROVED",
        approvedById: "demo-u3", approvedAt: ago(35), documentId: null, evidenceId: null, capaId: null,
        createdById: "demo-u1", ...stamps,
        computed: {
          inherentScore: 22, inherentLevel: "CRITICAL", residualScore: 9, residualLevel: "MEDIUM",
          acceptability: "TOLERABLE", uplift: 4,
        },
      },
    ],
    associates: [
      {
        id: "d-ba1", organizationId: "demo", code: "SOC-0001", name: "Agente Comercial Andino Ltda.",
        associateType: "AGENT", country: "CO", registrationNumber: "900123", industry: "Intermediación",
        supplierId: null, riskTier: "HIGH", isPublicOfficial: false, interactsWithPEPs: true,
        sanctionedScreen: "CLEAR", adverseMedia: "POTENTIAL_MATCH", ownershipKnown: true,
        status: "ACTIVE", ownerId: "demo-u2", onboardingDate: ago(200), nextReviewDate: ahead(40),
        notes: null, documentId: null, createdById: "demo-u1", ...stamps,
        _count: { beneficialOwners: 1, dueDiligence: 1 },
      },
      {
        id: "d-ba2", organizationId: "demo", code: "SOC-0002", name: "Suministros Delta, S.L.",
        associateType: "SUPPLIER", country: "ES", registrationNumber: "B123", industry: "Materiales",
        supplierId: "demo-sup1", riskTier: "LOW", isPublicOfficial: false, interactsWithPEPs: false,
        sanctionedScreen: "CLEAR", adverseMedia: "CLEAR", ownershipKnown: true,
        status: "ACTIVE", ownerId: "demo-u2", onboardingDate: ago(400), nextReviewDate: ahead(200),
        notes: null, documentId: null, createdById: "demo-u1", ...stamps,
        _count: { beneficialOwners: 0, dueDiligence: 1 },
      },
    ],
    dueDiligence: [
      {
        id: "d-dd1", organizationId: "demo", code: "DD-0001", associateId: "d-ba1", level: "ENHANCED",
        purpose: "Onboarding de agente en Colombia", status: "ENHANCED_REVIEW",
        screeningResult: "POTENTIAL_MATCH", findings: "Medios adversos por litigio comercial; sin hit de sanciones.",
        residualRisk: "HIGH", conditions: "Contrato con cláusula antisoborno y auditoría anual",
        reviewerId: "demo-u1", reviewedAt: ago(3), approvedById: null, approvedAt: null,
        rejectedById: null, rejectedAt: null, rejectionReason: null, nextReviewDate: null,
        obligationId: null, complianceRiskId: null, documentId: null, evidenceId: null, capaId: null,
        createdById: "demo-u1", ...stamps,
        associate: { code: "SOC-0001", name: "Agente Comercial Andino Ltda.", riskTier: "HIGH", isPublicOfficial: false, interactsWithPEPs: true },
        enhancedRequired: true,
      },
    ],
    owners: [
      {
        id: "d-ubo1", organizationId: "demo", code: "UBO-0001", associateId: "d-ba1",
        fullName: "Laura M. Restrepo", nationality: "CO", countryOfResidence: "CO",
        ownershipPercent: 60, controlType: "OWNERSHIP", isPep: true, pepRole: "Familiar de cargo municipal",
        identifiedAt: ago(180), verifiedAt: ago(170), verifiedById: "demo-u1", evidenceId: null, notes: null, ...stamps,
        associate: { code: "SOC-0001", name: "Agente Comercial Andino Ltda." },
      },
    ],
    gifts: [
      {
        id: "d-g1", organizationId: "demo", code: "RGH-0001", recordType: "HOSPITALITY", direction: "GIVEN",
        description: "Cena con funcionarios de una entidad contratante", estimatedValue: 420, currency: "EUR",
        occurredAt: ago(8), counterpartyName: "Dirección de compras", associateId: "d-ba1",
        involvesPublicOfficial: true, publicOfficialRole: "Director de compras",
        status: "COMPLIANCE_REVIEW", submittedById: "demo-u2", submittedAt: ago(8),
        managerId: "demo-u2", managerReviewedAt: ago(7), managerDecisionNote: "Escalar a compliance",
        complianceReviewerId: null, complianceReviewedAt: null, complianceDecisionNote: null,
        rejectionReason: null, policyThreshold: 100, aboveThreshold: true,
        conflictDeclarationId: null, documentId: null, evidenceId: null, ...stamps,
        associate: { code: "SOC-0001", name: "Agente Comercial Andino Ltda." },
        requiresCompliance: true,
      },
    ],
    donations: [
      {
        id: "d-don1", organizationId: "demo", code: "DON-0001", recordType: "SPONSORSHIP",
        beneficiaryName: "Foro Industria Local", associateId: null, purpose: "Patrocinio de jornada técnica",
        amount: 5000, currency: "EUR", grantedAt: ago(20), involvesPublicOfficial: false,
        politicalDonation: false, status: "UNDER_REVIEW", approvedById: null, approvedAt: null,
        rejectionReason: null, obligationId: null, documentId: null, evidenceId: null,
        createdById: "demo-u2", ...stamps, associate: null,
      },
    ],
    conflicts: [
      {
        id: "d-c1", organizationId: "demo", code: "CAB-0001", declarantId: "demo-u2", period: "2026",
        hasConflict: true, conflictNature: "BUSINESS_ASSOCIATE",
        description: "Familiar en plantilla del agente comercial andino.",
        relatedAssociateId: "d-ba1", relatedParty: "Agente Comercial Andino Ltda.",
        estimatedValue: null, currency: null, declaredAt: ago(50),
        reviewStatus: "MITIGATED", reviewerId: "demo-u1", reviewedAt: ago(48),
        mitigationMeasures: "Abstención en evaluación y pagos al agente.",
        recusalRequired: true, conflictOfInterestDeclarationId: null, evidenceId: null, ...stamps,
      },
    ],
    conflictsComplete: true,
    facilitation: [
      {
        id: "d-f1", organizationId: "demo", code: "FAC-0001",
        description: "Pago solicitado para liberar mercancía en aduana",
        amount: 250, currency: "USD", occurredAt: ago(12), reportedAt: ago(11),
        country: "CO", publicOfficialRole: "Inspector aduanero", coerced: true,
        status: "UNDER_REVIEW", speakUpReportId: null, breachId: null, investigationId: null,
        capaId: null, reportedById: "demo-u2", reviewedById: "demo-u1", reviewedAt: ago(10),
        outcome: null, evidenceId: null, ...stamps,
      },
    ],
    financialTests: [
      {
        id: "d-fc1", organizationId: "demo", code: "TCF-0001", title: "Doble firma en pagos > 5.000 EUR",
        controlDescription: "Segregación solicitante/aprobador en tesorería",
        complianceControlId: null, organizationControlId: null, obligationId: null,
        period: "2026-Q2", testedAt: ago(15), testedById: "demo-u1",
        designAdequate: true, operatingEffective: true, sampleSize: 25, exceptionsFound: 0,
        findings: "Sin excepciones en la muestra.", effectiveness: 95, status: "COMPLETED",
        nextTestDate: ahead(75), evidenceId: null, capaId: null, createdById: "demo-u1", ...stamps,
      },
    ],
    nonFinancialTests: [
      {
        id: "d-nfc1", organizationId: "demo", code: "TCN-0001", title: "Cláusula antisoborno en contratos de agentes",
        controlDescription: null, controlArea: "THIRD_PARTY_ONBOARDING",
        complianceControlId: null, organizationControlId: null, obligationId: null,
        period: "2026-Q2", testedAt: ago(18), testedById: "demo-u1",
        designAdequate: true, operatingEffective: false, sampleSize: 8, exceptionsFound: 2,
        findings: "Dos contratos legacy sin cláusula actualizada.", effectiveness: 55, status: "FAILED",
        nextTestDate: ahead(30), evidenceId: null, capaId: null, createdById: "demo-u1", ...stamps,
      },
    ],
    highRisk: [
      {
        id: "d-hr1", organizationId: "demo", code: "OAR-0001", title: "Comisión de éxito del agente andino",
        transactionType: "AGENT_COMMISSION", description: "Comisión 8% sobre adjudicación",
        amount: 48000, currency: "EUR", associateId: "d-ba1", counterpartyName: null, country: "CO",
        involvesPublicOfficial: true, riskRationale: "Intermediario + funcionario público en proceso",
        status: "UNDER_REVIEW", requestedById: "demo-u2", requestedAt: ago(6),
        approvedById: null, approvedAt: null, rejectionReason: null, conditions: null,
        obligationId: null, complianceRiskId: null, dueDiligenceCaseId: "d-dd1",
        documentId: null, evidenceId: null, ...stamps,
        associate: { code: "SOC-0001", name: "Agente Comercial Andino Ltda." },
      },
    ],
    commitments: [
      {
        id: "d-cm1", organizationId: "demo", code: "CAB-COM-0001", commitmentType: "EMPLOYEE",
        subjectUserId: "demo-u2", associateId: null, subjectName: null,
        committedAt: ago(100), version: "2026.1", acknowledged: true, expiresAt: ahead(265),
        documentId: null, evidenceId: null, notes: null, createdById: "demo-u1", ...stamps,
        associate: null,
      },
    ],
    investigations: [
      {
        id: "d-inv1", organizationId: "demo", code: "ISB-0001",
        investigationId: "demo-investigation-1", speakUpReportId: "demo-speakup-1", breachId: null,
        allegationType: "KICKBACK", involvesPublicOfficial: true, estimatedValue: 12000,
        currency: "EUR", jurisdictionId: null, associateId: "d-ba1", status: "ACTIVE",
        outcome: null, sanctionsImposed: null, remediationPlanId: null, capaId: null,
        closedAt: null, createdById: "demo-u1", ...stamps,
      },
    ],
    summary: {
      assessments: 1, assessmentsApproved: 1, highResidual: 0, associates: 2, highRiskAssociates: 1,
      dueDiligenceOpen: 1, dueDiligenceOverdue: 0, pepOwners: 1, giftsPending: 1,
      donationsPolitical: 0, facilitationOpen: 1, controlFailures: 1, highRiskPending: 1,
      commitments: 1, investigationsOpen: 1,
    },
  };
}
