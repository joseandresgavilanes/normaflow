import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ItsmClient from "@/components/itsm/ItsmClient";
import { getAppContext } from "@/lib/app-context";
import { getItsmPayload, type ItsmPayload } from "@/lib/itsm/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Gestión de servicios TI | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ItsmPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="itsm:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <ItsmClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <ItsmClient initial={await getItsmPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[itsm] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema de Gestión de Servicios TI" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const ahead = (days: number) => new Date(Date.now() + day * days);
const stamps = { createdAt: ago(60), updatedAt: ago(2) };

function demoPayload(): ItsmPayload {
  return {
    can: { create: false, update: false, approve: false, export: false },
    members: [{ id: "demo-u1", name: "Ana Servicio" }, { id: "demo-u2", name: "Luis Soporte" }],
    services: [{
      id: "d-svc1", organizationId: "demo", code: "SVC-0001", name: "Correo corporativo",
      description: "Exchange Online", category: "Colaboración", criticality: "HIGH",
      status: "ACTIVE", processId: null, documentId: null, createdById: "demo-u1", ...stamps,
    }],
    catalog: [{
      id: "d-cat1", organizationId: "demo", code: "CAT-0001", serviceId: "d-svc1",
      name: "Alta de buzón", description: null, requestable: true, estimatedFulfillmentHours: 8,
      active: true, createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    owners: [{
      id: "d-own1", organizationId: "demo", code: "OWN-0001", serviceId: "d-svc1",
      userId: "demo-u1", ownerName: "Ana Servicio", ownershipRole: "PRIMARY",
      effectiveFrom: ago(200), effectiveTo: null, createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    slas: [{
      id: "d-sla1", organizationId: "demo", code: "SLA-0001", serviceId: "d-svc1",
      name: "SLA correo P1", description: null, priority: "CRITICAL",
      responseTimeMinutes: 15, resolutionTimeMinutes: 240, availabilityTargetPct: 99.9,
      measurementPeriod: "Mensual", status: "ACTIVE", effectiveFrom: ago(180), effectiveTo: null,
      documentId: null, createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    olas: [{
      id: "d-ola1", organizationId: "demo", code: "OLA-0001", serviceId: "d-svc1", slaId: "d-sla1",
      name: "OLA plataforma messaging", supportingTeam: "Messaging Ops",
      responseTimeMinutes: 10, resolutionTimeMinutes: 180, description: null,
      status: "ACTIVE", documentId: null, createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
      sla: { code: "SLA-0001", name: "SLA correo P1" },
    }],
    requests: [{
      id: "d-req1", organizationId: "demo", code: "SRQ-0001", title: "Alta buzón comercial",
      description: null, serviceId: "d-svc1", catalogEntryId: "d-cat1", slaId: "d-sla1",
      requesterId: "demo-u2", assigneeId: "demo-u1", priority: "MEDIUM", status: "IN_PROGRESS",
      dueAt: ahead(1), fulfilledAt: null, closedAt: null, createdById: "demo-u2", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
      catalogEntry: { code: "CAT-0001", name: "Alta de buzón" },
    }],
    incidents: [{
      id: "d-inc1", organizationId: "demo", code: "INC-0001", title: "Caída de acceso OWA",
      description: "Usuarios sin acceso web", serviceId: "d-svc1", slaId: "d-sla1",
      requestId: null, problemId: "d-prb1", configurationItemId: "d-ci1",
      reporterId: "demo-u2", assigneeId: "demo-u1", priority: "CRITICAL", impact: "HIGH",
      urgency: "CRITICAL", status: "INVESTIGATING", detectedAt: ago(0.1),
      assignedAt: ago(0.08), resolvedAt: null, confirmedAt: null, confirmedById: null,
      closedAt: null, resolutionNotes: null, capaId: null, documentId: null, evidenceId: null,
      createdById: "demo-u2", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
      sla: { code: "SLA-0001", responseTimeMinutes: 15, resolutionTimeMinutes: 240 },
      configurationItem: { code: "CI-0001", name: "CAS Cluster" },
      slaEval: { id: "d-inc1", responseMet: true, resolutionMet: null, overallMet: true },
    }],
    problems: [{
      id: "d-prb1", organizationId: "demo", code: "PRB-0001", title: "Intermitencia proxy reverse",
      description: null, serviceId: "d-svc1", status: "ANALYSIS", rootCause: null,
      workaround: "Usar cliente Outlook denso", assigneeId: "demo-u1",
      identifiedAt: ago(3), resolvedAt: null, closedAt: null, capaId: null,
      documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
      _count: { incidents: 1, knownErrors: 0 },
    }],
    knownErrors: [],
    changes: [{
      id: "d-chg1", organizationId: "demo", code: "CHG-0001", title: "Actualizar WAF reglas OWA",
      description: null, serviceId: "d-svc1", changeType: "NORMAL", status: "ASSESSED",
      riskLevel: "MEDIUM", impact: "MEDIUM", requestedById: "demo-u1", assessedById: "demo-u1",
      approvedById: null, implementedById: null, scheduledStart: ahead(2), scheduledEnd: ahead(2.1),
      implementedAt: null, reviewedAt: null, closedAt: null, relatedIncidentId: "d-inc1",
      relatedProblemId: "d-prb1", capaId: null, documentId: null, evidenceId: null,
      createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
      relatedIncident: { code: "INC-0001" }, relatedProblem: { code: "PRB-0001" },
    }],
    releases: [{
      id: "d-rel1", organizationId: "demo", code: "REL-0001", title: "Patch messaging Q3",
      version: "2026.3.1", serviceId: "d-svc1", status: "PLANNED", plannedAt: ahead(3),
      releasedAt: null, changeCodes: ["CHG-0001"], notes: null, documentId: null,
      createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" }, _count: { deployments: 0 },
    }],
    deployments: [],
    cis: [{
      id: "d-ci1", organizationId: "demo", code: "CI-0001", name: "CAS Cluster",
      ciType: "SERVER", status: "IN_USE", serviceId: "d-svc1", assetId: null, ownerId: "demo-u1",
      locationId: null, criticality: "HIGH", version: "v12", serialNumber: null, notes: null,
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }, {
      id: "d-ci2", organizationId: "demo", code: "CI-0002", name: "App OWA",
      ciType: "APPLICATION", status: "IN_USE", serviceId: "d-svc1", assetId: null, ownerId: "demo-u1",
      locationId: null, criticality: "HIGH", version: "16.0", serialNumber: null, notes: null,
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    relationships: [{
      id: "d-reln1", organizationId: "demo", code: "RELN-0001", sourceCiId: "d-ci2",
      targetCiId: "d-ci1", relationType: "RUNS_ON", notes: null, createdById: "demo-u1", ...stamps,
      sourceCi: { code: "CI-0002", name: "App OWA" }, targetCi: { code: "CI-0001", name: "CAS Cluster" },
    }],
    availability: [{
      id: "d-avl1", organizationId: "demo", code: "AVL-0001", serviceId: "d-svc1",
      title: "Disponibilidad correo 2026-Q3", targetPercent: 99.9, measurementPeriod: "Trimestral",
      agreedDowntimeMinutes: 120, actualAvailabilityPct: 99.85, periodStart: ago(40), periodEnd: ahead(50),
      status: "ACTIVE", notes: null, documentId: null, createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" }, computedAvailability: 99.85,
    }],
    capacity: [{
      id: "d-cap1", organizationId: "demo", code: "CAP-0001", serviceId: "d-svc1",
      title: "Capacidad buzones", metric: "Buzones activos", currentCapacity: 4200,
      forecastCapacity: 4800, thresholdPercent: 85, unit: "ud", periodStart: ago(30),
      periodEnd: ahead(60), status: "ACTIVE", notes: null, documentId: null,
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    continuity: [{
      id: "d-scp1", organizationId: "demo", code: "SCP-0001", serviceId: "d-svc1",
      title: "Continuidad correo", description: "Failover a sitio B", rtoMinutes: 60, rpoMinutes: 15,
      status: "ACTIVE", bcpId: null, lastTestedAt: ago(45), documentId: null, evidenceId: null,
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    suppliers: [{
      id: "d-ssp1", organizationId: "demo", code: "SSP-0001", name: "Cloud Mail Provider",
      serviceId: "d-svc1", supplierId: null, contractRef: "CTR-MAIL-26", criticality: "HIGH",
      status: "ACTIVE", reviewDueAt: ahead(90), notes: null, documentId: null,
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    reports: [{
      id: "d-rpt1", organizationId: "demo", code: "RPT-0001", title: "Desempeño correo jun-2026",
      reportType: "PERFORMANCE", serviceId: "d-svc1", periodStart: ago(30), periodEnd: ago(1),
      summary: "Disponibilidad 99.85%. Un incidente P1 en investigación.", metrics: { mttrMin: 0 },
      documentId: null, generatedAt: ago(1), createdById: "demo-u1", ...stamps,
      service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    articles: [{
      id: "d-kb1", organizationId: "demo", code: "KB-0001", title: "Restablecer acceso OWA",
      category: "HOWTO", content: "Pasos de diagnóstico proxy…", status: "PUBLISHED",
      serviceId: "d-svc1", knownErrorId: null, problemId: "d-prb1", incidentId: null,
      tags: ["owa", "proxy"], authorId: "demo-u1", publishedAt: ago(10),
      createdById: "demo-u1", ...stamps, service: { code: "SVC-0001", name: "Correo corporativo" },
    }],
    summary: {
      services: 1, catalogEntries: 1, activeSlas: 1, openRequests: 1, openIncidents: 1,
      openProblems: 1, openChanges: 1, slaBreaches: 0, cis: 2, publishedArticles: 1, releasesOpen: 1,
    },
  };
}
