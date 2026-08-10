import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import AimsClient from "@/components/aims/AimsClient";
import { getAppContext } from "@/lib/app-context";
import { getAimsPayload } from "@/lib/aims/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import { requiredSafeguards } from "@/lib/aims/classification";

export const metadata = { title: "Gestión de IA" };
export const dynamic = "force-dynamic";

export default async function AimsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="aims:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <AimsClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <AimsClient initial={await getAimsPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[aims] live payload failed:", error);
    return <LiveDataUnavailable section="Gestión de Inteligencia Artificial" />;
  }
}

const day = 86400000;

function demoPayload(): Awaited<ReturnType<typeof getAimsPayload>> {
  return {
    canManage: false,
    canUpdate: false,
    canApprove: false,
    members: [{ id: "demo-u1", name: "Marta Gobernanza" }, { id: "demo-u2", name: "Iván Datos" }],
    systems: [
      {
        id: "d-s1", code: "IA-0001", name: "Clasificador de currículums", ownerId: "demo-u1", provider: "OpenAI", providerType: "THIRD_PARTY_API",
        purpose: "Preseleccionar candidaturas para vacantes operativas", users: "Equipo de reclutamiento", context: "Solo criba inicial; la decisión final es humana",
        criticality: "HIGH", classification: "HIGH", autonomy: "HUMAN_IN_THE_LOOP", status: "IN_PRODUCTION",
        approvedAt: new Date(Date.now() - day * 60), retiredAt: null, nextReviewDate: new Date(Date.now() + day * 120),
        useCases: 1, risks: 3, incidents: 1, models: 2, oversightControls: 2, transparencyRecords: 1,
        impactAssessment: { id: "d-a1", code: "EIA-0001", version: "1", severity: "HIGH" },
        requiredSafeguards: requiredSafeguards("HIGH"), missingSafeguards: [], compliant: true,
      },
      {
        id: "d-s2", code: "IA-0002", name: "Asistente de redacción de procedimientos", ownerId: "demo-u2", provider: "Anthropic", providerType: "THIRD_PARTY_API",
        purpose: "Redactar borradores de procedimientos del SGC", users: "Calidad", context: "Borradores sujetos a revisión humana obligatoria",
        criticality: "MEDIUM", classification: "LIMITED", autonomy: "HUMAN_IN_COMMAND", status: "IN_VALIDATION",
        approvedAt: null, retiredAt: null, nextReviewDate: null,
        useCases: 1, risks: 1, incidents: 0, models: 1, oversightControls: 1, transparencyRecords: 0,
        impactAssessment: null,
        requiredSafeguards: requiredSafeguards("LIMITED"), missingSafeguards: [], compliant: true,
      },
    ],
    useCases: [
      { id: "d-uc1", code: "IAU-0001", systemId: "d-s1", title: "Criba inicial de candidaturas", objective: "Reducir el tiempo de preselección para vacantes operativas de alto volumen.", decisionAutonomy: "HUMAN_IN_THE_LOOP", affectedCount: 500 },
      { id: "d-uc2", code: "IAU-0002", systemId: "d-s2", title: "Borrador de procedimientos", objective: "Acelerar la redacción inicial de procedimientos del SGC.", decisionAutonomy: "HUMAN_IN_COMMAND", affectedCount: null },
    ],
    assessments: [
      { id: "d-a1", code: "EIA-0001", systemId: "d-s1", version: "1", overallSeverity: "HIGH", classification: "HIGH", reviewStatus: "APPROVED", reviewerId: "demo-u1", reviewedAt: new Date(Date.now() - day * 61), assessorId: "demo-u2" },
      { id: "d-a2", code: "EIA-0002", systemId: "d-s2", version: "1", overallSeverity: "MODERATE", classification: "LIMITED", reviewStatus: "HUMAN_REVIEW", reviewerId: null, reviewedAt: null, assessorId: "demo-u2" },
    ],
    risks: [
      { id: "d-r1", code: "IAR-0001", systemId: "d-s1", title: "Sesgo por antigüedad del historial de contratación", category: "BIAS_DISCRIMINATION", likelihood: 4, impact: 5, inherentScore: 20, inherentLevel: "CRITICAL", residualScore: 8, residualLevel: "MEDIUM", acceptability: "TOLERABLE", treatment: "MITIGATE", status: "IN_TREATMENT", ownerId: "demo-u1", dueDate: new Date(Date.now() + day * 30) },
      { id: "d-r2", code: "IAR-0002", systemId: "d-s1", title: "Falta de explicación al candidato descartado", category: "EXPLAINABILITY", likelihood: 3, impact: 4, inherentScore: 12, inherentLevel: "HIGH", residualScore: 12, residualLevel: "HIGH", acceptability: "NOT_ACCEPTABLE", treatment: "MITIGATE", status: "OPEN", ownerId: "demo-u1", dueDate: null },
    ],
    datasets: [
      { id: "d-d1", code: "DS-0001", name: "Histórico de candidaturas 2019-2025", purpose: "Entrenamiento del clasificador", ownerId: "demo-u2", classification: "RESTRICTED", containsPersonalData: true, containsSpecialCategories: false, legalBasis: "LEGITIMATE_INTEREST", recordCount: 48200, qualityScore: 78.5, qualityLevel: "GOOD", sources: 2, lineageSteps: 4, biasReviewed: true, biasFlags: ["contiene datos personales"], fitForTraining: true, traceable: true },
      { id: "d-d2", code: "DS-0002", name: "Corpus de procedimientos internos", purpose: "Contexto del asistente de redacción", ownerId: "demo-u2", classification: "INTERNAL", containsPersonalData: false, containsSpecialCategories: false, legalBasis: "NOT_APPLICABLE", recordCount: 320, qualityScore: null, qualityLevel: "NOT_ASSESSED", sources: 1, lineageSteps: 0, biasReviewed: false, biasFlags: ["sin revisión de sesgo"], fitForTraining: false, traceable: false },
    ],
    models: [
      { id: "d-m1", code: "MOD-0001", systemId: "d-s1", modelName: "cv-ranker", version: "2.1", algorithm: "Gradient boosting", provider: "Interno", stage: "PRODUCTION", reviewStatus: "APPROVED", reviewerId: "demo-u1", reviewedAt: new Date(Date.now() - day * 62), deployedAt: new Date(Date.now() - day * 60), explainabilityMethod: "SHAP", trainingDatasetId: "d-d1", lastEvaluation: { id: "d-e1", outcome: "PASSED_WITH_CONDITIONS", accuracy: 0.87, fairnessScore: 0.79, biasDetected: true, evaluatedAt: new Date(Date.now() - day * 65) } },
      { id: "d-m2", code: "MOD-0002", systemId: "d-s2", modelName: "claude-sonnet", version: "4.5", algorithm: null, provider: "Anthropic", stage: "EVALUATION", reviewStatus: "HUMAN_REVIEW", reviewerId: null, reviewedAt: null, deployedAt: null, explainabilityMethod: null, trainingDatasetId: null, lastEvaluation: { id: "d-e2", outcome: "PASSED", accuracy: 0.92, fairnessScore: null, biasDetected: false, evaluatedAt: new Date(Date.now() - day * 5) } },
    ],
    controls: [
      { id: "d-c1", code: "SUP-0001", systemId: "d-s1", name: "Revisión humana de la lista corta", type: "HUMAN_IN_THE_LOOP", responsibleId: "demo-u1", canOverride: true, canStop: true, effectiveness: 85, lastVerifiedAt: new Date(Date.now() - day * 20), active: true },
      { id: "d-c2", code: "SUP-0002", systemId: "d-s1", name: "Canal de apelación del candidato", type: "APPEAL_CHANNEL", responsibleId: "demo-u1", canOverride: true, canStop: false, effectiveness: 70, lastVerifiedAt: null, active: true },
    ],
    transparency: [
      { id: "d-t1", code: "TRA-0001", systemId: "d-s1", audience: "DATA_SUBJECT", disclosure: "Aviso de uso de IA en la criba inicial y derecho a revisión humana.", aiUseDisclosed: true, humanContactOffered: true, channel: "Portal de empleo", publishedAt: new Date(Date.now() - day * 58), version: "1" },
    ],
    incidents: [
      { id: "d-i1", code: "IAI-0001", systemId: "d-s1", type: "BIAS_DISCRIMINATION", severity: "HIGH", title: "Tasa de descarte desigual por grupo de edad", status: "ROOT_CAUSE", detectedAt: new Date(Date.now() - day * 12), affectedCount: 34, notificationRequired: true, responsibleId: "demo-u1", closedAt: null },
    ],
    suppliers: [
      { id: "d-p1", code: "PIA-0001", supplierName: "Anthropic", serviceType: "MODEL_API", outcome: "APPROVED", score: 88, usesCustomerDataForTraining: false, assessedAt: new Date(Date.now() - day * 40), nextReviewDate: new Date(Date.now() + day * 325) },
    ],
    changes: [
      { id: "d-ch1", code: "CIA-0001", systemId: "d-s1", title: "Reentrenamiento con datos de 2026", changeType: "RETRAINING", reviewStatus: "HUMAN_REVIEW", requiresReassessment: true, implementedAt: null, reviewerId: null, reviewedAt: null },
    ],
    metrics: [
      { id: "d-mt1", systemId: "d-s1", period: "2026-07", kind: "FAIRNESS", name: "Paridad de selección por grupo", value: 0.74, threshold: 0.8, baseline: 0.85, breached: true, driftDetected: true },
      { id: "d-mt2", systemId: "d-s1", period: "2026-07", kind: "HUMAN_OVERRIDE_RATE", name: "Tasa de anulación humana", value: 0.18, threshold: 0.3, baseline: 0.15, breached: false, driftDetected: false },
    ],
    outputs: [
      { id: "d-o1", code: "IAO-0001", systemId: "d-s2", purpose: "Borrador del procedimiento de compras", targetType: "DOCUMENT", model: "claude-sonnet", modelVersionLabel: "4.5", requestedById: "demo-u2", generatedAt: new Date(Date.now() - day * 2), reviewStatus: "HUMAN_REVIEW", reviewerId: null, reviewedAt: null, edited: true, containsPersonalData: false, promotedEntityType: null, promotedAt: null, integrity: { valid: true, problems: [] } },
      { id: "d-o2", code: "IAO-0002", systemId: "d-s2", purpose: "Resumen de hallazgos de auditoría", targetType: "AUDIT_FINDING", model: "claude-sonnet", modelVersionLabel: "4.5", requestedById: "demo-u1", generatedAt: new Date(Date.now() - day * 9), reviewStatus: "APPROVED", reviewerId: "demo-u1", reviewedAt: new Date(Date.now() - day * 8), edited: true, containsPersonalData: false, promotedEntityType: "AuditFinding", promotedAt: new Date(Date.now() - day * 8), integrity: { valid: true, problems: [] } },
      { id: "d-o3", code: "IAO-0003", systemId: "d-s2", purpose: "Nota de comunicación interna", targetType: "COMMUNICATION", model: "claude-sonnet", modelVersionLabel: "4.5", requestedById: "demo-u2", generatedAt: new Date(Date.now() - day), reviewStatus: "DRAFT", reviewerId: null, reviewedAt: null, edited: false, containsPersonalData: false, promotedEntityType: null, promotedAt: null, integrity: { valid: true, problems: [] } },
    ],
    summary: {
      systems: 2, inProduction: 1, retired: 0, highRisk: 1, systemsMissingSafeguards: 0, useCases: 2,
      approvedAssessments: 1, pendingAssessments: 1, risks: 2, unacceptableRisks: 1,
      datasets: 2, datasetsWithPersonalData: 1, datasetsWithoutBiasReview: 1,
      models: 2, modelsInProduction: 1, modelsAwaitingReview: 1,
      controls: 2, transparencyRecords: 1, openIncidents: 1, incidentsRequiringNotification: 1,
      suppliers: 1, suppliersPending: 0, changesAwaitingReview: 1,
      outputsAwaitingReview: 1, outputsApproved: 1, outputsRejected: 0, outputsPromoted: 1, humanRuleViolations: 0,
      monitoring: { measurements: 2, breached: 1, drifting: 1, systemsWithBreach: 1, unmonitoredSystems: 0 },
    },
  } as unknown as Awaited<ReturnType<typeof getAimsPayload>>;
}
