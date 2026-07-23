import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import VulnerabilitiesLiveClient from "@/components/vulnerabilities/VulnerabilitiesLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getVulnerabilitiesPayload, type VulnerabilitiesPayload } from "@/lib/actions/vulnerabilities";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Vulnerabilidades | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function VulnerabilitiesPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="vulnerabilities:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <VulnerabilitiesLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <VulnerabilitiesLiveClient initial={await getVulnerabilitiesPayload({})} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[vulnerabilities] live payload failed:", error);
    return <LiveDataUnavailable section="Vulnerabilidades" />;
  }
}

function demoPayload(): VulnerabilitiesPayload {
  return {
    filters: {},
    canCreate: false, canUpdate: false, canExport: false,
    summary: { total: 2, open: 2, critical: 1, overdue: 1, severityCounts: { CRITICAL: 1, MEDIUM: 1 } },
    vulnerabilities: [
      { id: "demo-v1", code: "VULN-001", source: "Escáner externo", cve: "CVE-2026-1234", severity: "CRITICAL", exposure: "Internet", description: "RCE en componente web sin parchear", responsible: { id: "u2", name: "TI" }, targetDate: "2026-07-01", status: "IN_PROGRESS", discoveredAt: "2026-06-20", overdue: true, assets: [{ id: "va1", asset: { id: "act2", code: "ACT-002", name: "Servidor de aplicaciones" }, exposure: "Internet" }], remediations: [{ id: "rem1", description: "Aplicar parche del proveedor", responsible: { id: "u2", name: "TI" }, targetDate: "2026-07-01", status: "IN_PROGRESS", evidence: null, verifications: [] }] },
      { id: "demo-v2", code: "VULN-002", source: "Pentest interno", cve: null, severity: "MEDIUM", exposure: "Interna", description: "Contraseñas débiles en cuentas de servicio", responsible: null, targetDate: null, status: "OPEN", discoveredAt: "2026-07-10", overdue: false, assets: [], remediations: [] },
    ],
    members: [], assetOptions: [], evidenceOptions: [],
  };
}
