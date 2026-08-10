import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import SafetyClient from "@/components/safety/SafetyClient";
import { getAppContext } from "@/lib/app-context";
import { getHealthSurveillancePayload, getSafetyPayload, type HealthSurveillancePayload } from "@/lib/safety/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Seguridad y Salud" };
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="safety:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <SafetyClient initial={demoPayload()} sensitive={demoSensitivePayload()} demo />;
}

async function renderLive() {
  try {
    const initial = await getSafetyPayload();
    let sensitive: HealthSurveillancePayload | null = null;
    if (initial.canSeeSensitive) {
      sensitive = await getHealthSurveillancePayload().catch(() => null);
    }
    return <SafetyClient initial={initial} sensitive={sensitive} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[safety] live payload failed:", error);
    return <LiveDataUnavailable section="Seguridad y Salud" />;
  }
}

function demoSensitivePayload(): HealthSurveillancePayload {
  return {
    canManage: false,
    canUpdate: false,
    canDelete: false,
    records: [{ id: "d-s1", code: "VS-0001", workerName: "Ana R.", personnelId: null, positionId: null, exposure: "Ruido > 85 dB", protocol: "Audiometría anual", fitness: "FIT_WITH_RESTRICTIONS", restrictions: "Uso obligatorio de protección auditiva", examinedAt: new Date(Date.now() - 86400000 * 200), nextReviewDate: new Date(Date.now() + 86400000 * 120) }],
  };
}

function demoPayload(): Awaited<ReturnType<typeof getSafetyPayload>> {
  return {
    canManage: false,
    canUpdate: false,
    canSensitiveCreate: false,
    canSensitiveUpdate: false,
    canSensitiveDelete: false,
    canSeeSensitive: true,
    members: [{ id: "demo-u1", name: "Luis Prevención" }],
    indicators: { frequencyIndex: 12.5, severityIndex: 180.2, accidentRate: 2.25, lostDays: 18, nearMisses: 7, inspections: 12, overdueActions: 2 },
    hazards: [
      { id: "d-h1", code: "PEL-0001", activity: "Trabajo en altura", task: "Montaje", hazard: "Caída de altura", category: "MECHANICAL", exposedWorkers: 4, inherentLevel: "CRITICAL", residualLevel: "HIGH", acceptability: "NOT_ACCEPTABLE", active: true, processId: null, existingControls: null, responsibleId: null, assessment: null },
      { id: "d-h2", code: "PEL-0002", activity: "Soldadura", task: "Fabricación", hazard: "Exposición a humos", category: "CHEMICAL", exposedWorkers: 3, inherentLevel: "HIGH", residualLevel: "MEDIUM", acceptability: "TOLERABLE", active: true, processId: null, existingControls: null, responsibleId: null, assessment: null },
    ],
    assessments: [],
    consultations: [],
    incidents: [
      { id: "d-i1", code: "INC-0001", type: "ACCIDENT", severity: "HIGH", title: "Corte en mano", occurredAt: new Date(Date.now() - 86400000 * 5), status: "INVESTIGATING", lostDays: 3, responsibleId: "demo-u1" },
      { id: "d-i2", code: "INC-0002", type: "NEAR_MISS", severity: "LOW", title: "Casi caída", occurredAt: new Date(Date.now() - 86400000 * 2), status: "CLASSIFIED", lostDays: 0, responsibleId: null },
    ],
    incidentFlow: ["REPORTED", "CLASSIFIED", "INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"],
    incidentsByStatus: { REPORTED: 0, CLASSIFIED: 1, INVESTIGATING: 1, ROOT_CAUSE: 0, ACTION_PLAN: 0, IMPLEMENTED: 0, EFFECTIVENESS_VERIFIED: 0, CLOSED: 4 },
    inspections: [{ id: "d-ins1", code: "INS-0001", type: "PLANNED", area: "Taller", inspectedAt: new Date(Date.now() - 86400000 * 10), findings: "Extintor vencido" }],
    ppeItems: [{ id: "d-p1", code: "EPP-0001", name: "Casco de seguridad", ppeType: "Protección craneal", technicalStandard: "EN 397", lifespanMonths: 36, assignments: 12 }],
    ppeAssignments: [],
    permits: [{ id: "d-pt1", code: "PTW-0001", workType: "HOT_WORK", area: "Almacén", status: "ACTIVE", validTo: new Date(Date.now() + 86400000) }],
    drills: [{ id: "d-d1", code: "SIM-0001", scenario: "Evacuación por incendio", outcome: "PARTIAL", responseTimeMinutes: 8, drillDate: new Date(Date.now() - 86400000 * 60) }],
    contractors: [{ id: "d-c1", code: "CTR-0001", contractorName: "Montajes SA", outcome: "CONDITIONAL", incidents: 1, nextReviewDate: new Date(Date.now() + 86400000 * 90) }],
    summary: { hazards: 2, criticalRisks: 1, openIncidents: 2, nearMisses: 7, permits: 1, overdueActions: 2, surveillance: 1 },
  } as unknown as Awaited<ReturnType<typeof getSafetyPayload>>;
}
