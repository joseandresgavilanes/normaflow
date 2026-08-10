import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import EnvironmentClient from "@/components/environment/EnvironmentClient";
import { getAppContext } from "@/lib/app-context";
import { getEnvironmentPayload } from "@/lib/environmental/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Gestión Ambiental" };
export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="environment:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <EnvironmentClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <EnvironmentClient initial={await getEnvironmentPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[environment] live payload failed:", error);
    return <LiveDataUnavailable section="Gestión Ambiental" />;
  }
}

/** Catalog-only demo payload (no organization data). */
function demoPayload(): Awaited<ReturnType<typeof getEnvironmentPayload>> {
  return {
    canManage: false, canUpdate: false, canDelete: false,
    members: [{ id: "demo-u1", name: "Ana García" }],
    aspects: [
      { id: "d-a1", code: "ASP-0001", activity: "Consumo de agua en planta", productService: "Producción", condition: "NORMAL", lifeCycleStage: "Uso", responsibleId: "demo-u1", processId: null, description: null,
        impacts: [{ id: "d-i1", aspectId: "d-a1", impactType: "Agotamiento de recursos hídricos", description: null, existingControl: "Medición mensual", controlEffectiveness: 60, riskId: null, controlId: null, severity: 4, frequency: 3, scope: 3, score: 14, level: "HIGH", significant: true }] },
      { id: "d-a2", code: "ASP-0002", activity: "Generación de residuos peligrosos", productService: "Mantenimiento", condition: "ABNORMAL", lifeCycleStage: "Fin de vida", responsibleId: "demo-u1", processId: null, description: null,
        impacts: [{ id: "d-i2", aspectId: "d-a2", impactType: "Contaminación de suelo", description: null, existingControl: "Almacenamiento temporal", controlEffectiveness: 40, riskId: null, controlId: null, severity: 5, frequency: 2, scope: 4, score: 16, level: "CRITICAL", significant: true }] },
    ],
    methods: [{ id: "d-m1", name: "Método de significancia ambiental", version: "1", formula: "WEIGHTED_SUM", threshold: 12, active: true, approvedAt: null }],
    obligations: [
      { id: "d-o1", code: "OBL-0001", source: "Reglamento de aguas residuales", obligation: "Límites de vertido", jurisdiction: "Nacional", applicability: "Planta", responsibleId: "demo-u1", reviewDate: new Date(Date.now() - 86400000 * 10), reviewFrequencyMonths: 12, evidenceId: null, documentId: null, lastResult: "PARTIAL", lastEvaluatedAt: new Date(Date.now() - 86400000 * 40), overdue: true, nonCompliant: true, neverEvaluated: false },
    ],
    objectives: [{ id: "d-obj1", code: "OBJ-0001", objective: "Reducir consumo de agua 10%", baseline: "1000 m³", target: "900 m³", indicatorId: null, responsibleId: "demo-u1", resources: "Medición y mantenimiento", status: "IN_PROGRESS", progress: 40, dueDate: null, programs: [{ id: "d-p1", objectiveId: "d-obj1", name: "Optimización de consumo", activities: "Revisión de fugas", responsibleId: "demo-u1", budget: null, progress: 40, status: "IN_PROGRESS", startDate: null, dueDate: null, evidenceId: null }] }],
    trends: [{ period: "2026-05", water: 980, energy: 1200, fuel: 300, emissions: 45, discharges: 120, waste: 60, rawMaterials: 500 }, { period: "2026-06", water: 940, energy: 1180, fuel: 290, emissions: 43, discharges: 110, waste: 58, rawMaterials: 490 }],
    waste: [{ id: "d-w1", code: "RES-0001", wasteType: "Aceite usado", classification: "HAZARDOUS", quantity: 200, unit: "L", period: "2026-07", storage: "Bodega de residuos", processId: null, disposition: "Gestor autorizado", managerName: "EcoGestión", manifest: "MAN-2026-01" }],
    emergencies: [{ id: "d-e1", code: "EMG-0001", scenario: "Derrame de químicos", impact: "Contaminación de suelo", controls: "Kit de derrames", responsePlan: "Aislar y contener", drillResults: null, documentId: null, lastDrillAt: new Date(Date.now() - 86400000 * 120), nextDrillAt: new Date(Date.now() + 86400000 * 60), responsibleId: "demo-u1" }],
    biodiversity: [{ id: "d-b1", code: "BIO-0001", site: "Planta norte", ecosystemType: "Bosque ribereño", protectedArea: true, protectedAreaName: "Reserva Río Claro", speciesOrHabitat: "Nutria de río", impactDescription: "Riesgo por escorrentía", mitigationMeasures: "Monitoreo y barrera vegetal", status: "MONITORING", monitoringFrequency: "Trimestral", responsibleId: "demo-u1", processId: null, evidenceId: null, lastMonitoredAt: new Date(Date.now() - 86400000 * 30), nextMonitoringAt: new Date(Date.now() + 86400000 * 60) }],
    summary: { aspects: 2, impacts: 2, significant: 2, obligations: 1, overdue: 1, nonCompliant: 1, objectives: 1, waste: 1, emergencies: 1, biodiversity: 1, metrics: 2, measuredPeriods: 2 },
  };
}
