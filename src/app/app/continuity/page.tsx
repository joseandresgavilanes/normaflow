import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ContinuityLiveClient from "@/components/continuity/ContinuityLiveClient";
import { getAppContext } from "@/lib/app-context";
import { getContinuityPayload, type ContinuityPayload } from "@/lib/actions/continuity";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Continuidad de negocio | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ContinuityPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="continuity:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <ContinuityLiveClient initial={demoPayload()} />;
}

async function renderLive() {
  try { return <ContinuityLiveClient initial={await getContinuityPayload()} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[continuity] live payload failed:", error);
    return <LiveDataUnavailable section="Continuidad de negocio" />;
  }
}

function demoPayload(): ContinuityPayload {
  return {
    canCreate: false, canUpdate: false, canExport: false,
    summary: { bcps: 1, drps: 1, tests: 1, testsPassed: 1, openImprovements: 1 },
    bcps: [{
      id: "demo-b1", code: "BCP-001", title: "Continuidad de servicios críticos", scope: "Operaciones y atención al cliente", owner: { id: "u1", name: "Dirección" }, status: "APPROVED", rtoMinutes: 240, rpoMinutes: 60, dependencies: "Proveedor cloud", nextReviewDate: "2027-01-01",
      criticalProcesses: [{ id: "cp1", process: { id: "p1", name: "Atención al cliente" }, rtoMinutes: 240, rpoMinutes: 60 }],
      scenarios: [{ id: "s1", title: "Caída del centro de datos", description: null, type: "Tecnológico" }],
      tests: [{ id: "t1", title: "Simulacro de failover", type: "FAILOVER", status: "COMPLETED", plannedDate: "2026-05-01", executedDate: "2026-05-03", responsible: { id: "u1", name: "Dirección" }, scenario: { id: "s1", title: "Caída del centro de datos" }, results: [{ id: "r1", outcome: "PASSED", rtoAchievedMinutes: 210, rpoAchievedMinutes: 55, summary: "Objetivos cumplidos", testedBy: { id: "u1", name: "Dirección" }, testedAt: "2026-05-03T00:00:00.000Z", evidence: null, improvementActions: [{ id: "ia1", description: "Automatizar el failover de DNS", responsible: null, targetDate: "2026-09-01", status: "OPEN" }] }] }],
    }],
    drps: [{ id: "demo-d1", code: "DRP-001", title: "Recuperación de infraestructura cloud", owner: null, bcp: { id: "demo-b1", code: "BCP-001", title: "Continuidad de servicios críticos" }, status: "APPROVED", rtoMinutes: 180, rpoMinutes: 30, systems: "Base de datos, API", dependencies: null, nextReviewDate: null }],
    members: [], processOptions: [], evidenceOptions: [],
  };
}
