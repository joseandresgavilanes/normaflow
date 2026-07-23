import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import SecurityControlsLiveClient from "@/components/security-controls/SecurityControlsLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getSecurityControlsPayload } from "@/lib/actions/security-controls";
import { isAuthorizationError } from "@/lib/permissions/server";
import { SECURITY_CONTROL_CATALOG } from "@/lib/security-control-catalog";

export const metadata = { title: "Controles ISO 27001 | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function SecurityControlsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="security-controls:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <DemoControls />;
}

async function renderLive() {
  try { return <SecurityControlsLiveClient initial={await getSecurityControlsPayload({})} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[security-controls] live payload failed:", error);
    return <LiveDataUnavailable section="controles ISO 27001" />;
  }
}

function DemoControls() {
  const controls = SECURITY_CONTROL_CATALOG.map((item, index) => ({ id: `demo-control-${index}`, controlId: `demo-control-${index}`, code: item.code, domain: item.domain, title: item.title, descriptionInternal: "Resumen operativo propio de NormaFlow; contenido autorizado pendiente de carga.", objective: `Mantener una práctica verificable para el control ${item.code}.`, applicability: "UNDER_REVIEW" as const, status: "NOT_ASSESSED" as const, implementationLevel: 0, responsible: null, reviewDate: null, nextReviewDate: null, notes: null, evidence: [], risks: [], reviews: [] }));
  const initial = { filters: {}, canUpdate: false, canApprove: false, canExport: false, catalogVersion: { id: "demo", version: "2022", catalogDate: "2022-10-25T00:00:00.000Z", status: "PUBLISHED" as const }, summary: { total: controls.length, included: 0, implemented: 0, coverage: 0, overdue: 0, statusCounts: { NOT_ASSESSED: controls.length }, domainCounts: { ORGANIZATIONAL: 37, PEOPLE: 8, PHYSICAL: 14, TECHNOLOGICAL: 34 } }, controls, evidenceOptions: [], riskOptions: [], members: [] };
  return <SecurityControlsLiveClient initial={initial} />;
}
