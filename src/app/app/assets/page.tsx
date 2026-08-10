import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import AssetsLiveClient from "@/components/assets/AssetsLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getAssetsPayload, type AssetsPayload } from "@/lib/actions/assets";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Activos de información" };
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="assets:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <AssetsLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <AssetsLiveClient initial={await getAssetsPayload({})} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[assets] live payload failed:", error);
    return <LiveDataUnavailable section="Activos de información" />;
  }
}

function demoPayload(): AssetsPayload {
  const assets: AssetsPayload["assets"] = [
    { id: "demo-a1", code: "ACT-001", name: "Base de datos de clientes", description: "CRM productivo", category: "INFORMATION", status: "ACTIVE", criticality: "CRITICAL", owner: { id: "u1", name: "Ana Ruiz" }, custodian: { id: "u2", name: "TI" }, process: { id: "p1", name: "Ventas" }, location: { id: "l1", name: "Nube" }, reviewDate: "2026-01-15", nextReviewDate: "2027-01-15", overdue: false, classification: { confidentiality: "HIGH", integrity: "HIGH", availability: "HIGH", classification: "CONFIDENTIAL", legalRequirements: "RGPD", retention: "5 años" }, risks: [{ id: "ar1", riskId: null, riskTitle: null, threat: "Acceso no autorizado", vulnerability: "Cifrado ausente", description: null }], controls: [{ id: "ac1", organizationControlId: "oc1", code: "8.24", title: "Cryptography use", status: "PLANNED", evidence: null, note: null }], dependencies: [], dependents: [] },
    { id: "demo-a2", code: "ACT-002", name: "Servidor de aplicaciones", description: null, category: "HARDWARE", status: "ACTIVE", criticality: "HIGH", owner: { id: "u2", name: "TI" }, custodian: null, process: null, location: { id: "l2", name: "CPD Madrid" }, reviewDate: null, nextReviewDate: "2026-06-01", overdue: true, classification: null, risks: [], controls: [], dependencies: [{ id: "d1", type: "SUPPORTS", asset: { id: "demo-a1", code: "ACT-001", name: "Base de datos de clientes" } }], dependents: [] },
  ];
  return {
    filters: {},
    canCreate: false, canUpdate: false, canDelete: false, canExport: false,
    summary: { total: 2, critical: 1, classified: 1, overdue: 1, categoryCounts: { INFORMATION: 1, HARDWARE: 1 } },
    overdueAlerts: [{ id: "demo-a2", code: "ACT-002", name: "Servidor de aplicaciones", nextReviewDate: "2026-06-01" }],
    assets,
    members: [], processes: [], locations: [], evidenceOptions: [], orgControlOptions: [], riskOptions: [],
  };
}
