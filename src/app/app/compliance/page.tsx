import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ComplianceClient from "@/components/compliance/ComplianceClient";
import { getAppContext } from "@/lib/app-context";
import { getCompliancePayload, type CompliancePayload } from "@/lib/compliance/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import { buildGoverningBodyDigest } from "@/lib/compliance/governing-body";
import { DEFAULT_CHANNEL_CONFIG } from "@/lib/compliance/speak-up";

export const metadata = { title: "Compliance | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="compliance:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <ComplianceClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <ComplianceClient initial={await getCompliancePayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[compliance] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema de Gestión de Compliance" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const ahead = (days: number) => new Date(Date.now() + day * days);
const stamps = { createdAt: ago(120), updatedAt: ago(10) };

/**
 * Demo: programa de compliance de una organización ficticia. Del canal solo se
 * muestran agregados y un caso asignado, para que se vea cómo funciona el acceso
 * por necesidad de conocer sin exhibir un expediente completo.
 */
function demoPayload(): CompliancePayload {
  const jurisdictions: CompliancePayload["jurisdictions"] = [
    {
      id: "d-j1", organizationId: "demo", code: "EU", name: "Unión Europea", level: "SUPRANATIONAL", parentId: null,
      country: null, authority: "Comisión Europea", applicable: true,
      rationale: "La organización opera en el mercado único y trata datos de residentes de la UE.",
      notes: null, createdById: null, ...stamps,
    },
    {
      id: "d-j2", organizationId: "demo", code: "ES", name: "España", level: "NATIONAL", parentId: "d-j1",
      country: "ES", authority: "AEPD", applicable: true, rationale: "Domicilio social y centro de trabajo principal.",
      notes: null, createdById: null, ...stamps,
    },
  ];

  const sources: CompliancePayload["sources"] = [
    {
      id: "d-s1", organizationId: "demo", code: "FTE-0001", name: "Reglamento General de Protección de Datos",
      sourceType: "REGULATION", issuer: "Parlamento Europeo", reference: "UE 2016/679",
      officialUrl: null, jurisdictionId: "d-j1", publishedAt: new Date("2016-04-27"), effectiveFrom: new Date("2018-05-25"),
      effectiveTo: null, monitored: true, monitoringFrequency: "QUARTERLY", ownerId: "demo-u1",
      lastCheckedAt: ago(40), nextCheckDate: ahead(50), status: "IN_FORCE", documentId: null, notes: null,
      createdById: null, ...stamps,
      jurisdiction: { code: "EU", name: "Unión Europea" },
      _count: { obligations: 2, changes: 1 },
    },
    {
      id: "d-s2", organizationId: "demo", code: "FTE-0002", name: "Ley de protección del informante",
      sourceType: "LAW", issuer: "Cortes Generales", reference: "Ley 2/2023",
      officialUrl: null, jurisdictionId: "d-j2", publishedAt: new Date("2023-02-20"), effectiveFrom: new Date("2023-03-13"),
      effectiveTo: null, monitored: true, monitoringFrequency: "SEMIANNUAL", ownerId: "demo-u2",
      lastCheckedAt: ago(200), nextCheckDate: ago(20), status: "IN_FORCE", documentId: null, notes: null,
      createdById: null, ...stamps,
      jurisdiction: { code: "ES", name: "España" },
      _count: { obligations: 1, changes: 0 },
    },
  ];

  const obligations: CompliancePayload["obligations"] = [
    {
      id: "d-o1", code: "OBL-0001", title: "Registro de actividades de tratamiento",
      requirementText: "Mantener un registro actualizado de las actividades de tratamiento de datos personales.",
      obligationType: "REGULATORY", category: "DATA_PROTECTION", criticality: "HIGH", applicability: "APPLICABLE",
      applicabilityRollup: { decision: "APPLICABLE", applicableIn: ["EU", "ES"], pending: 0, incomplete: false },
      complianceStatus: "COMPLIANT", ownerId: "demo-u1", accountableId: "demo-u3",
      jurisdiction: { code: "EU", name: "Unión Europea" }, source: { code: "FTE-0001", name: "Reglamento General de Protección de Datos" },
      articleReference: "Art. 30", sanctionDescription: "Multa administrativa", maxSanctionAmount: 10000000,
      evaluationFrequency: "ANNUAL", lastEvaluatedAt: ago(80), nextEvaluationDate: ahead(285), status: "ACTIVE",
      counts: { risks: 1, controls: 2, evaluations: 2, breaches: 0 }, uncontrolled: false,
    },
    {
      id: "d-o2", code: "OBL-0002", title: "Canal interno de información",
      requirementText: "Disponer de un canal interno de información con garantías de confidencialidad y protección frente a represalias.",
      obligationType: "LEGAL", category: "CORPORATE_GOVERNANCE", criticality: "CRITICAL", applicability: "APPLICABLE",
      applicabilityRollup: { decision: "APPLICABLE", applicableIn: ["ES"], pending: 0, incomplete: false },
      complianceStatus: "PARTIALLY_COMPLIANT", ownerId: "demo-u2", accountableId: "demo-u3",
      jurisdiction: { code: "ES", name: "España" }, source: { code: "FTE-0002", name: "Ley de protección del informante" },
      articleReference: "Art. 5", sanctionDescription: "Sanción grave por carecer de canal", maxSanctionAmount: 1000000,
      evaluationFrequency: "SEMIANNUAL", lastEvaluatedAt: ago(150), nextEvaluationDate: ago(10), status: "ACTIVE",
      counts: { risks: 1, controls: 1, evaluations: 1, breaches: 1 }, uncontrolled: false,
    },
    {
      id: "d-o3", code: "OBL-0003", title: "Información sobre el uso de decisiones automatizadas",
      requirementText: "Informar a las personas afectadas cuando una decisión se apoye en tratamiento automatizado.",
      obligationType: "REGULATORY", category: "DATA_PROTECTION", criticality: "MEDIUM", applicability: "APPLICABLE",
      applicabilityRollup: { decision: "UNDER_ASSESSMENT", applicableIn: ["EU"], pending: 1, incomplete: true },
      complianceStatus: "NOT_EVALUATED", ownerId: "demo-u1", accountableId: null,
      jurisdiction: { code: "EU", name: "Unión Europea" }, source: { code: "FTE-0001", name: "Reglamento General de Protección de Datos" },
      articleReference: "Art. 22", sanctionDescription: null, maxSanctionAmount: null,
      evaluationFrequency: "ANNUAL", lastEvaluatedAt: null, nextEvaluationDate: ahead(30), status: "ACTIVE",
      counts: { risks: 0, controls: 0, evaluations: 0, breaches: 0 }, uncontrolled: true,
    },
  ];

  const risks: CompliancePayload["risks"] = [
    {
      id: "d-r1", organizationId: "demo", code: "RCP-0001", title: "Registro de tratamientos desactualizado tras nuevos proyectos",
      description: null, obligationId: "d-o1", category: "DATA_PROTECTION", likelihood: 3, impact: 4,
      inherentScore: 12, inherentLevel: "HIGH", controlEffectiveness: 70, residualScore: 4, residualLevel: "LOW",
      acceptability: "ACCEPTABLE", treatment: "MITIGATE", sanctionExposure: 250000, reputationalImpact: "MODERATE",
      ownerId: "demo-u1", status: "IN_TREATMENT", dueDate: ahead(60), acceptedById: null, acceptedAt: null,
      acceptanceRationale: null, riskId: null, capaId: null, createdById: null, ...stamps,
      obligation: { code: "OBL-0001", title: "Registro de actividades de tratamiento" },
      _count: { controls: 2 },
    },
    {
      id: "d-r2", organizationId: "demo", code: "RCP-0002", title: "Represalias informales contra quien denuncia",
      description: null, obligationId: "d-o2", category: "CORPORATE_GOVERNANCE", likelihood: 3, impact: 5,
      inherentScore: 15, inherentLevel: "CRITICAL", controlEffectiveness: 30, residualScore: 11, residualLevel: "HIGH",
      acceptability: "NOT_ACCEPTABLE", treatment: "MITIGATE", sanctionExposure: 600000, reputationalImpact: "MAJOR",
      ownerId: "demo-u2", status: "OPEN", dueDate: ahead(20), acceptedById: null, acceptedAt: null,
      acceptanceRationale: null, riskId: null, capaId: null, createdById: null, ...stamps,
      obligation: { code: "OBL-0002", title: "Canal interno de información" },
      _count: { controls: 1 },
    },
  ];

  const controls: CompliancePayload["controls"] = [
    {
      id: "d-c1", organizationId: "demo", code: "CCP-0001", name: "Revisión trimestral del registro de tratamientos",
      description: null, obligationId: "d-o1", riskId: "d-r1", controlType: "DETECTIVE", nature: "MANUAL",
      frequency: "QUARTERLY", ownerId: "demo-u1", designAdequate: true, operatingEffective: true, effectiveness: 80,
      lastTestedAt: ago(30), nextTestDate: ahead(60), active: true, organizationControlId: "demo-oc1",
      documentId: null, evidenceId: null, createdById: null, ...stamps,
      obligation: { code: "OBL-0001" }, risk: { code: "RCP-0001" },
    },
    {
      id: "d-c2", organizationId: "demo", code: "CCP-0002", name: "Formación anual en el canal de denuncias",
      description: null, obligationId: "d-o2", riskId: "d-r2", controlType: "PREVENTIVE", nature: "MANUAL",
      frequency: "ANNUAL", ownerId: "demo-u2", designAdequate: true, operatingEffective: null, effectiveness: 30,
      lastTestedAt: null, nextTestDate: ahead(15), active: true, organizationControlId: null,
      documentId: null, evidenceId: null, createdById: null, ...stamps,
      obligation: { code: "OBL-0002" }, risk: { code: "RCP-0002" },
    },
  ];

  const evaluations: CompliancePayload["evaluations"] = [
    {
      id: "d-e1", organizationId: "demo", code: "EVC-0001", obligationId: "d-o1", controlId: "d-c1",
      scope: "OBLIGATION", method: "INTERNAL_AUDIT", period: "2026-S1", evaluatedById: "demo-u1",
      evaluatedAt: ago(80), result: "COMPLIANT", score: 92, findings: "Registro completo y actualizado.",
      gapsIdentified: null, recommendation: null, reviewStatus: "APPROVED", reviewerId: "demo-u3",
      reviewedAt: ago(78), decisionNote: null, evidenceId: null, capaId: null, breachId: null,
      createdById: null, ...stamps,
      obligation: { code: "OBL-0001", title: "Registro de actividades de tratamiento" }, control: { code: "CCP-0001" },
    },
    {
      id: "d-e2", organizationId: "demo", code: "EVC-0002", obligationId: "d-o2", controlId: null,
      scope: "OBLIGATION", method: "SELF_ASSESSMENT", period: "2026-S1", evaluatedById: "demo-u2",
      evaluatedAt: ago(12), result: "PARTIALLY_COMPLIANT", score: 64,
      findings: "El canal existe, pero la formación al personal no alcanza al turno de noche.",
      gapsIdentified: "Cobertura de formación insuficiente.", recommendation: "Sesión específica para el turno de noche.",
      reviewStatus: "UNDER_REVIEW", reviewerId: null, reviewedAt: null, decisionNote: null,
      evidenceId: null, capaId: null, breachId: null, createdById: null, ...stamps,
      obligation: { code: "OBL-0002", title: "Canal interno de información" }, control: null,
    },
  ];

  const calendar: CompliancePayload["calendar"] = [
    {
      id: "d-k1", code: "CAL-0001", title: "Declaración anual de actividades de tratamiento",
      obligationCode: "OBL-0001", jurisdictionCode: "EU", dueDate: ahead(12), recurrence: "ANNUAL",
      leadTimeDays: 30, criticality: "HIGH", responsibleId: "demo-u1", authority: "AEPD",
      completedAt: null, alertSentAt: null,
      state: { status: "DUE_SOON", daysRemaining: 12, alertDue: true, overdueDays: 0 },
    },
    {
      id: "d-k2", code: "CAL-0002", title: "Informe semestral del canal al órgano de gobierno",
      obligationCode: "OBL-0002", jurisdictionCode: "ES", dueDate: ago(6), recurrence: "SEMIANNUAL",
      leadTimeDays: 15, criticality: "CRITICAL", responsibleId: "demo-u2", authority: null,
      completedAt: null, alertSentAt: ago(20),
      state: { status: "OVERDUE", daysRemaining: -6, alertDue: true, overdueDays: 6 },
    },
    {
      id: "d-k3", code: "CAL-0003", title: "Revisión de la política de compliance",
      obligationCode: null, jurisdictionCode: null, dueDate: ago(40), recurrence: "ANNUAL",
      leadTimeDays: 30, criticality: "MEDIUM", responsibleId: "demo-u3", authority: null,
      completedAt: ago(45), alertSentAt: ago(70),
      state: { status: "COMPLETED", daysRemaining: -40, alertDue: false, overdueDays: 0 },
    },
  ];

  const declarations: CompliancePayload["declarations"] = [
    {
      id: "d-d1", organizationId: "demo", code: "CDI-0001", declarantId: "demo-u2", period: "2026",
      hasConflict: true, conflictType: "FAMILY_RELATIONSHIP",
      description: "Familiar directo empleado por un proveedor habitual.", relatedParty: "Suministros Delta, S.L.",
      supplierId: null, estimatedValue: 45000, currency: "EUR", declaredAt: ago(60),
      reviewStatus: "MITIGATED", reviewerId: "demo-u3", reviewedAt: ago(55),
      mitigationMeasures: "Se aparta de toda decisión de compra que afecte a ese proveedor.",
      recusalRequired: true, confidential: true, nextDeclarationDate: ahead(305), evidenceId: null, ...stamps,
    },
  ];

  const changes: CompliancePayload["changes"] = [
    {
      id: "d-ch1", organizationId: "demo", code: "CRG-0001", title: "Nuevas directrices sobre decisiones automatizadas",
      sourceId: "d-s1", jurisdictionId: "d-j1", obligationId: "d-o3", changeType: "GUIDANCE",
      summary: "El comité publica criterios sobre información previa en decisiones automatizadas.",
      detectedAt: ago(18), detectedById: "demo-u1", publishedAt: ago(25), effectiveFrom: ahead(70),
      transitionUntil: ahead(160), impactStatus: "PENDING_ASSESSMENT", impactLevel: "MODERATE",
      impactAnalysis: null, affectedAreas: null, actionsRequired: null, responsibleId: "demo-u1",
      dueDate: ahead(40), implementedAt: null, changeRequestId: null, documentId: null, evidenceId: null, ...stamps,
      source: { code: "FTE-0001", name: "Reglamento General de Protección de Datos" }, obligation: { code: "OBL-0003" },
    },
  ];

  const breaches: CompliancePayload["breaches"] = [
    {
      id: "d-b1", code: "INC-0001", title: "Formación obligatoria del canal no impartida al turno de noche",
      obligation: { code: "OBL-0002", title: "Canal interno de información" }, detectionSource: "INTERNAL_AUDIT",
      severity: "MINOR", status: "UNDER_REMEDIATION", detectedAt: ago(30),
      rootCause: "El plan de formación no contemplaba turnos rotativos.", recurrence: false,
      financialExposure: 15000, sanctionImposed: false, sanctionAmount: null,
      notificationRequired: false, notificationDeadline: null, authorityNotifiedAt: null,
      notificationOverdue: false, closedAt: null, counts: { investigations: 0, remediationPlans: 1 },
    },
  ];

  const plans: CompliancePayload["plans"] = [
    {
      id: "d-p1", code: "REM-0001", title: "Extender la formación del canal a todos los turnos",
      breach: { code: "INC-0001", title: "Formación obligatoria del canal no impartida al turno de noche" },
      ownerId: "demo-u2", startDate: ago(25), dueDate: ahead(35), progressPercent: 60,
      status: "IN_PROGRESS", effectiveStatus: "IN_PROGRESS", approvedById: "demo-u3", approvedAt: ago(24),
      completedAt: null, effectivenessVerified: false, effectivenessVerifiedById: null, cost: 4200,
    },
  ];

  const trainings: CompliancePayload["trainings"] = [
    {
      id: "d-t1", code: "FCP-0001", title: "Canal de denuncias y protección del informante",
      topic: "SPEAK_UP_CHANNEL", obligationCode: "OBL-0002", audience: "Toda la plantilla", mandatory: true,
      deliveryMode: "ONLINE", scheduledFor: ago(70), completedAt: ago(60), targetCount: 180, completedCount: 142,
      coverage: 79, passRate: 91, effectivenessEvaluated: true, nextDueDate: ahead(295),
    },
    {
      id: "d-t2", code: "FCP-0002", title: "Protección de datos para responsables de proceso",
      topic: "DATA_PROTECTION", obligationCode: "OBL-0001", audience: "Responsables de proceso", mandatory: true,
      deliveryMode: "CLASSROOM", scheduledFor: ahead(25), completedAt: null, targetCount: 24, completedCount: 0,
      coverage: 0, passRate: null, effectivenessEvaluated: false, nextDueDate: null,
    },
  ];

  const governingBodyReports: CompliancePayload["governingBodyReports"] = [
    {
      id: "d-g1", organizationId: "demo", code: "IOG-0001", title: "Informe de compliance del primer semestre",
      period: "2026-S1", presentedTo: "BOARD", preparedById: "demo-u3", reportedAt: ago(20),
      executiveSummary: "El programa cubre las obligaciones críticas; queda pendiente la formación del turno de noche y una obligación sin evaluar.",
      obligationsSummary: null, risksSummary: null, evaluationsSummary: null, breachesSummary: null,
      speakUpSummary: "3 casos recibidos, 1 anónimo, 1 fundado. Sin identidades en este informe.",
      investigationsSummary: null, trainingSummary: null, remediationSummary: null,
      resourcesRequested: null, decisionsRequested: "Aprobar el refuerzo de formación en turnos rotativos.",
      decisionsTaken: null, reviewStatus: "SUBMITTED", submittedAt: ago(19), presentedAt: null,
      acknowledgedAt: null, acknowledgedById: null, documentId: null, evidenceId: null,
      managementReviewId: null, ...stamps,
    },
  ];

  const anonymizedCases: CompliancePayload["channel"]["anonymizedCases"] = [
    { category: "HARASSMENT", status: "CLOSED", outcome: "SUBSTANTIATED", anonymous: false, acknowledgementOverdue: false, feedbackOverdue: false },
    { category: "FRAUD", status: "UNDER_INVESTIGATION", outcome: null, anonymous: true, acknowledgementOverdue: false, feedbackOverdue: false },
    { category: "DATA_PRIVACY", status: "UNDER_TRIAGE", outcome: null, anonymous: false, acknowledgementOverdue: true, feedbackOverdue: false },
  ];

  const investigationStats: CompliancePayload["channel"]["investigationStats"] = [
    { status: "ACTIVE", conflictDetected: true, reportId: "d-case2", dueDate: ahead(25), concludedAt: null },
    { status: "CLOSED", conflictDetected: false, reportId: "d-case1", dueDate: ago(50), concludedAt: ago(45) },
  ];

  const digest = buildGoverningBodyDigest({
    obligations: obligations.map((row) => ({ complianceStatus: row.complianceStatus, criticality: row.criticality })),
    risks: risks.map((row) => ({ residualLevel: row.residualLevel, acceptability: row.acceptability })),
    evaluations: evaluations.map((row) => ({ result: row.result, reviewStatus: row.reviewStatus })),
    calendar: { overdue: 1, dueSoon: 1, onTimeRate: 100 },
    cases: anonymizedCases,
    investigations: investigationStats,
    breaches: breaches.map((row) => ({ status: row.status, severity: row.severity, sanctionAmount: row.sanctionAmount })),
    remediation: { completed: 0, overdue: 0, completedNotVerified: 0 },
    training: trainings.map((row) => ({ targetCount: row.targetCount, completedCount: row.completedCount, mandatory: row.mandatory })),
  });

  return {
    can: { create: false, update: false, approve: false, export: false, channelRead: false, channelReport: true, channelHandle: false, channelDecide: false },
    members: [
      { id: "demo-u1", name: "Elena Cumplimiento" },
      { id: "demo-u2", name: "Rubén Canal" },
      { id: "demo-u3", name: "Consejo de administración" },
    ],
    jurisdictions,
    sources,
    obligations,
    risks,
    controls,
    evaluations,
    calendar,
    calendarSummary: { total: 3, scheduled: 0, dueSoon: 1, overdue: 1, completed: 1, onTimeRate: 100 },
    alerts: [
      { id: "d-k2", code: "CAL-0002", title: "Informe semestral del canal al órgano de gobierno", dueDate: ago(6), status: "OVERDUE", daysRemaining: -6, responsibleId: "demo-u2", alreadyAlerted: true },
      { id: "d-k1", code: "CAL-0001", title: "Declaración anual de actividades de tratamiento", dueDate: ahead(12), status: "DUE_SOON", daysRemaining: 12, responsibleId: "demo-u1", alreadyAlerted: false },
    ],
    declarations,
    declarationsComplete: false,
    declarationSummary: { total: 4, withConflict: 1, pending: 1, recusalRequired: 1 },
    changes,
    breaches,
    breachSummary: { total: 1, open: 1, severe: 0, recurrent: 0, pendingNotification: 0, overdueNotification: 0, totalSanctions: 0 },
    plans,
    remediationSummary: { total: 1, inProgress: 1, overdue: 0, completed: 0, verified: 0, completedNotVerified: 0, averageProgress: 60 },
    trainings,
    governingBodyReports,
    programme: { applicable: 3, compliant: 1, partiallyCompliant: 1, nonCompliant: 0, notEvaluated: 1, complianceRate: 50, coverageRate: 67 },
    // El canal en demo enseña lo que ve alguien sin autorización: agregados y nada más.
    channel: {
      config: DEFAULT_CHANNEL_CONFIG,
      configured: true,
      externalChannelUrl: null,
      cases: [],
      myReports: [],
      restrictedCount: 3,
      retentionDue: 0,
      anonymizedCases,
      investigationStats,
    },
    digest,
  };
}
