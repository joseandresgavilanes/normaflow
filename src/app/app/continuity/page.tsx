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
    ...demoBcm(),
  };
}

/** Demo del paquete de continuidad del negocio (ISO 22301). */
function demoBcm() {
  const gaps = [
    { activityId: "demo-a2", activityName: "Facturación", kind: "NO_STRATEGY" as const, detail: "Sin estrategia de continuidad aprobada o implementada." },
    { activityId: "demo-a2", activityName: "Facturación", kind: "SPOF" as const, detail: "Punto único de fallo: ERP en un único servidor." },
  ];
  return {
    bias: [{
      id: "demo-bia", code: "BIA-001", title: "BIA corporativo 2026", scope: "Operaciones críticas",
      methodology: "Escala 1-5 por categoría de impacto", version: "1.0", status: "APPROVED" as const,
      owner: { id: "u1", name: "Dirección" }, approvedBy: { id: "u1", name: "Dirección" },
      approvedAt: "2026-03-01", performedAt: "2026-02-15", nextReviewDate: "2027-02-15", activityCount: 2,
    }],
    activities: [
      {
        id: "demo-a1", biaId: "demo-bia", code: "ACT-001", name: "Atención al cliente", description: null,
        processId: "p1", owner: { id: "u1", name: "Dirección" },
        mtpdMinutes: 480, rtoMinutes: 240, rpoMinutes: 60, minimumServiceLevel: "50% de agentes",
        impactScore: 78, criticality: "HIGH" as const, priority: 1,
        impacts: { financial: 4, operational: 5, legal: 3, reputational: 5, people: 3 },
        dependencies: [{ id: "d1", type: "TECHNOLOGY" as const, name: "CRM cloud", criticality: "HIGH" as const, maxOutageMinutes: 120, alternative: "Registro manual", singlePointOfFailure: false, supplierId: null, assetId: null, processId: null }],
        resources: [{ id: "rr1", type: "PEOPLE" as const, name: "Agentes de soporte", normalQuantity: 20, minimumQuantity: 8, unit: "personas", alternativeResource: "Turnos extendidos", leadTimeMinutes: 120 }],
        strategies: [{ id: "st1", code: "EST-001", title: "Sitio alterno", type: "RELOCATION" as const, status: "IMPLEMENTED" as const, achievesRtoMinutes: 180 }],
        procedures: [{ id: "rp1", code: "PR-001", title: "Reanudación de atención al cliente" }],
        gaps: [] as typeof gaps,
      },
      {
        id: "demo-a2", biaId: "demo-bia", code: "ACT-002", name: "Facturación", description: null,
        processId: null, owner: null,
        mtpdMinutes: 1440, rtoMinutes: 720, rpoMinutes: 240, minimumServiceLevel: null,
        impactScore: 52, criticality: "MEDIUM" as const, priority: 2,
        impacts: { financial: 5, operational: 3, legal: 3, reputational: 2, people: 1 },
        dependencies: [{ id: "d2", type: "TECHNOLOGY" as const, name: "ERP en un único servidor", criticality: "CRITICAL" as const, maxOutageMinutes: 480, alternative: null, singlePointOfFailure: true, supplierId: null, assetId: null, processId: null }],
        resources: [],
        strategies: [],
        procedures: [],
        gaps,
      },
    ],
    productPriorities: [{ id: "demo-ps1", code: "PS-001", name: "Servicio de soporte 24/7", priority: 1, criticality: "CRITICAL" as const, mtpdMinutes: 480, rtoMinutes: 240, minimumServiceLevel: "Cobertura de incidencias críticas", revenueShare: 45, customersAffected: 1200 }],
    strategies: [{ id: "st1", code: "EST-001", title: "Sitio alterno de operación", type: "RELOCATION" as const, status: "IMPLEMENTED" as const, achievesRtoMinutes: 180, achievesRpoMinutes: 60, cost: 24000, owner: null, activity: { id: "demo-a1", code: "ACT-001", name: "Atención al cliente" }, description: null }],
    recoveryProcedures: [{ id: "rp1", code: "PR-001", title: "Reanudación de atención al cliente", objective: "Restablecer el servicio en el sitio alterno", order: 1, version: "1.0", estimatedMinutes: 180, responsible: null, activity: { id: "demo-a1", code: "ACT-001", name: "Atención al cliente" }, documentId: null }],
    crisisTeams: [{
      id: "ct1", code: "EQ-001", name: "Comité de crisis", purpose: "Dirigir la respuesta", planId: "demo-b1",
      leader: { id: "u1", name: "Dirección" }, deputy: null,
      activationRule: "Interrupción > 4 h", meetingPoint: "Sala de juntas / videollamada",
      contacts: [{ id: "cc1", name: "Dirección", role: "Líder", type: "INTERNAL" as const, primaryPhone: "+34 600 000 000", altPhone: null, email: null, escalationOrder: 1, isDeputy: false }],
      communicationTree: [{ id: "n1", parentId: null, contactId: "cc1", label: "Comité de crisis", audience: "Dirección", channel: "Teléfono", order: 1, maxDelayMinutes: 15 }],
    }],
    activations: [],
    planVersions: [{ id: "pv1", planId: "demo-b1", version: "1.0", changeSummary: "Versión inicial", approvedBy: { id: "u1", name: "Dirección" }, approvedAt: "2026-03-01", createdAt: "2026-02-20" }],
    planStatus: [{ id: "demo-b1", code: "BCP-001", title: "Continuidad de servicios críticos", version: "1.0", status: "APPROVED", activated: false }],
    gaps,
    bcmSummary: {
      bias: 1, approvedBias: 1, activities: 2, criticalActivities: 1, dependencies: 2,
      singlePointsOfFailure: 1, strategies: 1, approvedStrategies: 1, procedures: 1,
      crisisTeams: 1, crisisContacts: 1, activePlans: 0, totalGaps: gaps.length, readiness: 60,
    },
  };
}
