import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import IncidentsLiveClient from "@/components/incidents/IncidentsLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getIncidentsPayload, type IncidentsPayload } from "@/lib/actions/incidents";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Incidentes de seguridad | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="incidents:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <IncidentsLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <IncidentsLiveClient initial={await getIncidentsPayload({})} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[incidents] live payload failed:", error);
    return <LiveDataUnavailable section="Incidentes de seguridad" />;
  }
}

function demoPayload(): IncidentsPayload {
  const order: IncidentsPayload["order"] = ["DETECTED", "TRIAGED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERED", "CLOSED"];
  return {
    filters: {},
    canCreate: false, canUpdate: false, canExport: false,
    summary: { total: 2, open: 1, critical: 1, notifiable: 1, statusCounts: { INVESTIGATING: 1, CLOSED: 1 } },
    order, openStatuses: order.filter((s) => s !== "CLOSED"),
    incidents: [
      { id: "demo-i1", code: "INC-001", detectedAt: "2026-07-20", occurredAt: "2026-07-19", reporter: { id: "u1", name: "SOC" }, responsible: { id: "u2", name: "Ana Ruiz" }, severity: "CRITICAL", category: "DATA_LEAK", description: "Posible exfiltración de datos de clientes", impact: "Datos personales potencialmente expuestos", status: "INVESTIGATING", nextStatus: "CONTAINED", notificationRequired: true, notificationDetails: "Notificación a la autoridad en 72h (RGPD)", lessonsLearned: null, closedAt: null, assets: [{ id: "a1", asset: { id: "act1", code: "ACT-001", name: "Base de datos de clientes" } }], evidence: [] },
      { id: "demo-i2", code: "INC-002", detectedAt: "2026-06-10", occurredAt: null, reporter: null, responsible: { id: "u2", name: "Ana Ruiz" }, severity: "LOW", category: "PHISHING", description: "Correo de phishing reportado por un empleado", impact: null, status: "CLOSED", nextStatus: null, notificationRequired: false, notificationDetails: null, lessonsLearned: "Reforzar formación de concienciación", closedAt: "2026-06-12", assets: [], evidence: [] },
    ],
    members: [], assetOptions: [], evidenceOptions: [],
  };
}
