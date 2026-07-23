import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import RiskTreatmentLiveClient from "@/components/risk-treatment/RiskTreatmentLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getRiskTreatmentPayload, type RiskTreatmentPayload } from "@/lib/actions/risk-treatment";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Tratamiento de riesgos | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function RiskTreatmentPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="risk-treatment:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <RiskTreatmentLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <RiskTreatmentLiveClient initial={await getRiskTreatmentPayload()} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[risk-treatment] live payload failed:", error);
    return <LiveDataUnavailable section="Tratamiento de riesgos" />;
  }
}

function demoPayload(): RiskTreatmentPayload {
  const items = [
    { id: "demo-r1", reference: "R-001", title: "Fuga de datos de clientes", description: null, asset: "Base de datos CRM", threat: "Acceso no autorizado", vulnerability: "Cifrado en reposo ausente", impact: 5, probability: 3, inherentRisk: 15, existingControls: "Control de acceso por roles", proposedControls: "Cifrado AES-256, DLP", treatment: "MITIGATE" as const, residualImpact: 3, residualProbability: 2, residualRisk: 6, owner: null, risk: null, targetDate: "2026-12-31", status: "RESIDUAL_PENDING" as const, controls: [], residualAssessments: [], acceptances: [], canClose: false },
    { id: "demo-r2", reference: "R-002", title: "Interrupción del servicio cloud", description: null, asset: "Infraestructura cloud", threat: "Caída del proveedor", vulnerability: "Sin redundancia multi-región", impact: 4, probability: 2, inherentRisk: 8, existingControls: "Backups diarios", proposedControls: "Failover multi-región", treatment: "MITIGATE" as const, residualImpact: null, residualProbability: null, residualRisk: null, owner: null, risk: null, targetDate: null, status: "OPEN" as const, controls: [], residualAssessments: [], acceptances: [], canClose: false },
  ];
  return {
    canUpdate: false,
    canApprove: false,
    canExport: false,
    methodology: { id: "demo-m", version: 1, title: "Metodología de evaluación de riesgos", description: "Escala 1-5 de impacto y probabilidad; riesgo = impacto × probabilidad.", acceptanceCriteria: "Se aceptan riesgos con nivel residual bajo (≤ 6).", acceptanceThreshold: 6, owner: null, approvedAt: null },
    plan: { id: "demo-plan", version: 1, title: "Plan de tratamiento de riesgos", status: "DRAFT", owner: null, approver: null, methodology: { id: "demo-m", title: "Metodología de evaluación de riesgos", version: 1 }, approvalComment: null, approvedAt: null, nextReviewDate: null, editable: true },
    summary: { total: items.length, open: 1, inTreatment: 0, residualPending: 1, accepted: 0, closed: 0, highInherent: 1, highResidual: 0 },
    items,
    plans: [{ id: "demo-plan", version: 1, title: "Plan de tratamiento de riesgos", status: "DRAFT", approvedAt: null }],
    members: [],
    evidenceOptions: [],
    orgControlOptions: [],
    riskOptions: [],
  };
}
