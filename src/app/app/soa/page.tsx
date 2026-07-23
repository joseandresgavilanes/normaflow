import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import SoALiveClient from "@/components/soa/SoALiveClient";
import { getAppContext } from "@/lib/app-context";
import { getSoAPayload, type SoAPayload } from "@/lib/actions/soa";
import { isAuthorizationError } from "@/lib/permissions/server";
import { SECURITY_CONTROL_CATALOG, securityControlCounts } from "@/lib/security-control-catalog";

export const metadata = { title: "Declaración de Aplicabilidad | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function SoAPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="soa:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <SoALiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <SoALiveClient initial={await getSoAPayload()} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[soa] live payload failed:", error);
    return <LiveDataUnavailable section="Declaración de Aplicabilidad" />;
  }
}

function demoPayload(): SoAPayload {
  const entries = SECURITY_CONTROL_CATALOG.map((item, index) => ({
    id: `demo-soa-${index}`,
    code: item.code,
    title: item.title,
    domain: item.domain,
    applicability: "UNDER_REVIEW" as const,
    justification: null,
    implementationStatus: "NOT_ASSESSED" as const,
    responsible: null,
    evidence: null,
    relatedRiskItem: null,
    reviewDate: null,
    notes: null,
  }));
  return {
    canCreate: false,
    canUpdate: false,
    canApprove: false,
    canExport: false,
    catalogVersion: { version: "2022", catalogDate: "2022-10-25T00:00:00.000Z" },
    current: { id: "demo", version: 1, status: "DRAFT", scope: "Demostración del alcance del SGSI.", owner: null, approver: null, approvalComment: null, approvalEvidence: null, approvedAt: null, nextReviewDate: null, editable: true },
    summary: { total: entries.length, included: 0, excluded: 0, pending: entries.length, implemented: 0, domainCounts: securityControlCounts() },
    entries,
    history: [{ id: "demo", version: 1, status: "DRAFT", approvedAt: null, createdAt: new Date("2026-07-23T00:00:00.000Z") }],
    members: [],
    evidenceOptions: [],
    riskItemOptions: [],
  };
}
