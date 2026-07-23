import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import SupplierSecurityLiveClient from "@/components/suppliers/SupplierSecurityLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getSupplierSecurityPayload, type SupplierSecurityPayload } from "@/lib/actions/supplier-security";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Proveedores de seguridad | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function SupplierSecurityPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="suppliers:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <SupplierSecurityLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <SupplierSecurityLiveClient initial={await getSupplierSecurityPayload()} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[supplier-security] live payload failed:", error);
    return <LiveDataUnavailable section="Proveedores de seguridad" />;
  }
}

function demoPayload(): SupplierSecurityPayload {
  return {
    canUpdate: false, canExport: false,
    summary: { total: 2, profiled: 1, critical: 1, expiringSoon: 1, reviewOverdue: 0 },
    suppliers: [
      { id: "demo-s1", code: "PROV-001", name: "Proveedor Cloud S.A.", category: "Tecnología", criticality: "HIGH", profile: { securityCriticality: "CRITICAL", dataProcessed: "Datos de clientes (PII)", accessGranted: "Acceso a infraestructura productiva", obligations: "Cláusulas RGPD y notificación de brechas en 24h", controls: "Cifrado, MFA, ISO 27001 certificado", riskLevel: "Alto", reviewDate: "2026-01-10", nextReviewDate: "2027-01-10", contractExpiry: "2026-09-15", evidence: null, notes: null, reviewOverdue: false, contractExpiringSoon: true } },
      { id: "demo-s2", code: "PROV-002", name: "Consultora Local", category: "Servicios", criticality: "LOW", profile: null },
    ],
    evidenceOptions: [],
  };
}
