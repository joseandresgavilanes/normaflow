import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * IT service management (ISO/IEC 20000 / ITSM) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_20000 catalog installation, SLA (DB-enforced positive
 * times), incidents (full workflow + attribution CHECKs), problems (known
 * error conversion), changes (approval CHECK), CMDB (no self-link CHECK),
 * cross-domain incident linking (ITSMIncident ↔ AIIncident — proving the
 * two workflows stay fully independent while still being related), tenant
 * A/B isolation, RLS, AuditLog, and the itsm-audit-package report.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let serviceId = "";
let slaId = "";
let ciAId = "";
let ciBId = "";
let problemId = "";
let incidentId = "";
let changeId = "";
let aiIncidentId = "";
let crossLinkId = "";

test.describe("ISO/IEC 20000 (ITSM) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const service = await prisma.iTService.create({
      data: { organizationId: state.actorA.organizationId, code: `SVC-${state.runId}`, name: "Correo corporativo live fixture", criticality: "HIGH", createdById: state.actorA.userId },
    });
    serviceId = service.id;

    const sla = await prisma.serviceLevelAgreement.create({
      data: { organizationId: state.actorA.organizationId, code: `SLA-${state.runId}`, serviceId, name: "SLA live fixture", responseTimeMinutes: 15, resolutionTimeMinutes: 240, status: "ACTIVE", createdById: state.actorA.userId },
    });
    slaId = sla.id;

    const ciA = await prisma.configurationItem.create({
      data: { organizationId: state.actorA.organizationId, code: `CI-A-${state.runId}`, name: "App live fixture", ciType: "APPLICATION", serviceId, createdById: state.actorA.userId },
    });
    ciAId = ciA.id;
    const ciB = await prisma.configurationItem.create({
      data: { organizationId: state.actorA.organizationId, code: `CI-B-${state.runId}`, name: "Server live fixture", ciType: "SERVER", serviceId, createdById: state.actorA.userId },
    });
    ciBId = ciB.id;

    const problem = await prisma.problem.create({
      data: { organizationId: state.actorA.organizationId, code: `PRB-${state.runId}`, title: "Problema live fixture", serviceId, status: "ANALYSIS", createdById: state.actorA.userId },
    });
    problemId = problem.id;

    const incident = await prisma.iTSMIncident.create({
      data: {
        organizationId: state.actorA.organizationId, code: `INC-${state.runId}`, title: "Incidente live fixture",
        serviceId, slaId, problemId, configurationItemId: ciAId, status: "ASSIGNED",
        assignedAt: new Date(), assigneeId: state.actorA.userId, createdById: state.actorA.userId,
      },
    });
    incidentId = incident.id;

    const change = await prisma.iTSMChange.create({
      data: {
        organizationId: state.actorA.organizationId, code: `CHG-${state.runId}`, title: "Cambio live fixture",
        serviceId, status: "ASSESSED", assessedById: state.actorA.userId, relatedIncidentId: incidentId,
        createdById: state.actorA.userId,
      },
    });
    changeId = change.id;

    const aiIncident = await prisma.aIIncident.create({
      data: { organizationId: state.actorA.organizationId, code: `AII-${state.runId}`, title: "Incidente de IA live fixture", type: "OTHER", status: "REPORTED" },
    });
    aiIncidentId = aiIncident.id;

    const crossLink = await prisma.incidentCrossLink.create({
      data: {
        organizationId: state.actorA.organizationId, itsmIncidentId: incidentId, targetDomain: "AI",
        targetId: aiIncidentId, relationType: "related", createdById: state.actorA.userId,
      },
    });
    crossLinkId = crossLink.id;
  });

  test.afterAll(async () => {
    await prisma.incidentCrossLink.deleteMany({ where: { id: crossLinkId } }).catch(() => undefined);
    await prisma.aIIncident.deleteMany({ where: { id: aiIncidentId } }).catch(() => undefined);
    await prisma.iTSMChange.deleteMany({ where: { id: changeId } }).catch(() => undefined);
    await prisma.iTSMIncident.deleteMany({ where: { id: incidentId } }).catch(() => undefined);
    await prisma.problem.deleteMany({ where: { id: problemId } }).catch(() => undefined);
    await prisma.cMDBRelationship.deleteMany({ where: { organizationId: state.actorA.organizationId, sourceCiId: { in: [ciAId, ciBId] } } }).catch(() => undefined);
    await prisma.configurationItem.deleteMany({ where: { id: { in: [ciAId, ciBId] } } }).catch(() => undefined);
    await prisma.serviceLevelAgreement.deleteMany({ where: { id: slaId } }).catch(() => undefined);
    await prisma.iTService.deleteMany({ where: { id: serviceId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_20000 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_20000" } });
    expect(family, "ISO_20000 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_20000" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(20);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_20000" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's ITSM rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readServices = await clientB.from("itsm_services").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readServices.error).toBeNull();
    expect(readServices.data, "B's client sees none of A's services").toEqual([]);

    const readIncidents = await clientB.from("itsm_incidents").select("id").eq("id", incidentId);
    expect(readIncidents.data, "B cannot see A's incident by id either").toEqual([]);

    const readLinks = await clientB.from("incident_cross_links").select("id").eq("id", crossLinkId);
    expect(readLinks.data, "B cannot see A's cross-domain link").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("itsm_services").select("id,name").eq("id", serviceId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ name: "Correo corporativo live fixture" });
  });

  test("SLA: response/resolution times persist, DB rejects non-positive times", async () => {
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("itsm_service_level_agreements").select("responseTimeMinutes,resolutionTimeMinutes,status").eq("id", slaId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ responseTimeMinutes: 15, resolutionTimeMinutes: 240, status: "ACTIVE" });

    const admin = adminClient();
    const bad = await admin.from("itsm_service_level_agreements").insert({
      organizationId: state.actorA.organizationId, code: `SLA-BAD-${state.runId}`, serviceId,
      name: "SLA inválido", responseTimeMinutes: 0, resolutionTimeMinutes: 100, status: "DRAFT",
    }).select("id");
    expect(bad.error, "itsm_sla_times_positive CHECK rejects responseTimeMinutes = 0").not.toBeNull();
  });

  test("incidentes: full workflow to CLOSED, attribution CHECKs enforced", async () => {
    const admin = adminClient();
    const badConfirmed = await admin.from("itsm_incidents").update({ status: "CONFIRMED" }).eq("id", incidentId).select("id");
    expect(badConfirmed.error, "itsm_incidents_confirmed_attributed CHECK requires confirmedAt/confirmedById").not.toBeNull();

    await prisma.iTSMIncident.update({ where: { id: incidentId }, data: { status: "INVESTIGATING" } });
    await prisma.iTSMIncident.update({ where: { id: incidentId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    await prisma.iTSMIncident.update({ where: { id: incidentId }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: state.actorA.userId } });
    await prisma.iTSMIncident.update({ where: { id: incidentId }, data: { status: "CLOSED", closedAt: new Date() } });

    const clientA = await actorClient(state.actorA);
    const closed = await clientA.from("itsm_incidents").select("status,resolvedAt,confirmedAt,confirmedById,closedAt").eq("id", incidentId).single();
    expect(closed.error).toBeNull();
    expect(closed.data?.status).toBe("CLOSED");
    expect(closed.data?.confirmedById).toBe(state.actorA.userId);

    const badClosed = await admin.from("itsm_incidents").insert({
      organizationId: state.actorA.organizationId, code: `INC-BAD-${state.runId}`, title: "Sin cierre atribuido",
      serviceId, status: "CLOSED",
    }).select("id");
    expect(badClosed.error, "itsm_incidents_closed_attributed CHECK requires closedAt").not.toBeNull();
  });

  test("problemas: conversión a error conocido queda reflejada de forma atómica", async () => {
    const knownError = await prisma.knownError.create({
      data: { organizationId: state.actorA.organizationId, code: `KE-${state.runId}`, title: "Error conocido live fixture", problemId, workaround: "Reiniciar servicio", status: "DOCUMENTED" },
    });
    await prisma.problem.update({ where: { id: problemId }, data: { status: "KNOWN_ERROR" } });

    const clientA = await actorClient(state.actorA);
    const problem = await clientA.from("itsm_problems").select("status").eq("id", problemId).single();
    expect(problem.data?.status).toBe("KNOWN_ERROR");
    const ke = await clientA.from("itsm_known_errors").select("problemId,workaround").eq("id", knownError.id).single();
    expect(ke.data).toMatchObject({ problemId, workaround: "Reiniciar servicio" });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("itsm_known_errors").select("id").eq("id", knownError.id);
    expect(crossRead.data, "B cannot see A's known error").toEqual([]);
    await prisma.knownError.delete({ where: { id: knownError.id } }).catch(() => undefined);
  });

  test("cambios: aprobación requiere approvedById, CHECK lo impide sin él", async () => {
    const admin = adminClient();
    const badApproved = await admin.from("itsm_changes").insert({
      organizationId: state.actorA.organizationId, code: `CHG-BAD-${state.runId}`, title: "Sin aprobador",
      serviceId, status: "APPROVED",
    }).select("id");
    expect(badApproved.error, "itsm_changes_approved_attributed CHECK rejects APPROVED without approvedById").not.toBeNull();

    await prisma.iTSMChange.update({ where: { id: changeId }, data: { status: "APPROVED", approvedById: state.actorA.userId } });
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("itsm_changes").select("status,approvedById,relatedIncidentId").eq("id", changeId).single();
    expect(own.data).toMatchObject({ status: "APPROVED", approvedById: state.actorA.userId, relatedIncidentId: incidentId });
  });

  test("CMDB: relaciones persisten, CHECK impide que un CI se relacione consigo mismo", async () => {
    const rel = await prisma.cMDBRelationship.create({
      data: { organizationId: state.actorA.organizationId, code: `RELN-${state.runId}`, sourceCiId: ciAId, targetCiId: ciBId, relationType: "RUNS_ON", createdById: state.actorA.userId },
    });
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("itsm_cmdb_relationships").select("sourceCiId,targetCiId,relationType").eq("id", rel.id).single();
    expect(own.data).toMatchObject({ sourceCiId: ciAId, targetCiId: ciBId, relationType: "RUNS_ON" });

    const admin = adminClient();
    const badSelf = await admin.from("itsm_cmdb_relationships").insert({
      organizationId: state.actorA.organizationId, code: `RELN-BAD-${state.runId}`, sourceCiId: ciAId, targetCiId: ciAId, relationType: "DEPENDS_ON",
    }).select("id");
    expect(badSelf.error, "itsm_cmdb_no_self_link CHECK rejects sourceCiId = targetCiId").not.toBeNull();
    await prisma.cMDBRelationship.delete({ where: { id: rel.id } }).catch(() => undefined);
  });

  test("integración: ITSMIncident se relaciona con AIIncident sin fusionar sus workflows", async () => {
    const clientA = await actorClient(state.actorA);
    const link = await clientA.from("incident_cross_links").select("itsmIncidentId,targetDomain,targetId,relationType").eq("id", crossLinkId).single();
    expect(link.error).toBeNull();
    expect(link.data).toMatchObject({ itsmIncidentId: incidentId, targetDomain: "AI", targetId: aiIncidentId, relationType: "related" });

    // El incidente ITSM ya está CLOSED (test anterior); el incidente de IA relacionado
    // conserva su propio estado independiente (REPORTED) — ningún merge de workflow.
    const itsmSide = await clientA.from("itsm_incidents").select("status").eq("id", incidentId).single();
    const aiSide = await clientA.from("ai_incidents").select("status").eq("id", aiIncidentId).single();
    expect(itsmSide.data?.status).toBe("CLOSED");
    expect(aiSide.data?.status).toBe("REPORTED");

    // Regresión de duplicado: (itsmIncidentId, targetDomain, targetId) es único.
    const admin = adminClient();
    const dup = await admin.from("incident_cross_links").insert({
      organizationId: state.actorA.organizationId, itsmIncidentId: incidentId, targetDomain: "AI", targetId: aiIncidentId,
    }).select("id");
    expect(dup.error, "unique(itsmIncidentId, targetDomain, targetId) rejects a duplicate link").not.toBeNull();
  });

  test("AuditLog: itsm writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "itsm").eq("organizationId", state.actorA.organizationId).limit(1);
    expect(ownLogs.error).toBeNull();

    if (ownLogs.data && ownLogs.data.length > 0) {
      const logId = ownLogs.data[0].id;
      const crossRead = await clientB.from("audit_logs").select("id").eq("id", logId);
      expect(crossRead.data, "B cannot read A's audit log row").toEqual([]);

      const tamper = await clientA.from("audit_logs").update({ action: "TAMPERED" }).eq("id", logId).select("id");
      expect(tamper.error, "audit_logs is append-only — UPDATE is rejected even for the owning tenant").not.toBeNull();

      const destroy = await clientA.from("audit_logs").delete().eq("id", logId).select("id");
      expect(destroy.error, "audit_logs is append-only — DELETE is rejected even for the owning tenant").not.toBeNull();
    }
  });

  test("reportes: un artefacto itsm-audit-package es tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "itsm-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "itsm-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "itsm-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("RLS/permisos: viewer es solo lectura, auditor limitado a lectura/export, contributor puede crear", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("itsm_services").select("id").eq("id", serviceId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: serviceId }]);
    const viewerWrite = await viewer.from("itsm_services").update({ name: "intento viewer" }).eq("id", serviceId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "itsm:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("itsm_incidents").select("id").eq("id", incidentId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: incidentId }]);
    const auditorWrite = await auditor.from("itsm_incidents").update({ title: "intento auditor" }).eq("id", incidentId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "itsm:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("itsm_services").insert({
      id: `live_itsm_service_control_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `SVC-CTR-${state.runId}`, name: "Servicio live fixture", createdById: state.actorA.userId,
      updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "itsm:create is held by ORG_ADMIN").toBeNull();
    if (created.data?.id) await prisma.iTService.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });
});
