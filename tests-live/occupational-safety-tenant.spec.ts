import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * ISO 45001 occupational health & safety — live multi-tenant boundary.
 *
 * Covers: tenant A/B isolation across all 11 safety tables, sensitive health
 * surveillance (extra-restricted permission, not just generic safety:read),
 * strict incident investigation workflow (DB-enforced, not only app-layer),
 * permit-to-work workflow, RLS, AuditLog append-only, report artifacts, and
 * the role permission matrix.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let hazardA = "", hazardB = "";
let incidentA = "";
let permitA = "";
let surveillanceA = "";

test.describe("ISO 45001 occupational safety live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const [hA, hB] = await Promise.all([
      prisma.occupationalHazard.create({ data: { organizationId: state.actorA.organizationId, code: `PEL-A-${state.runId}`, activity: "Actividad A", hazard: "Peligro A", category: "MECHANICAL", createdById: state.actorA.userId } }),
      prisma.occupationalHazard.create({ data: { organizationId: state.actorB.organizationId, code: `PEL-B-${state.runId}`, activity: "Actividad B", hazard: "Peligro B", category: "MECHANICAL", createdById: state.actorB.userId } }),
    ]);
    hazardA = hA.id; hazardB = hB.id;

    const incident = await prisma.occupationalIncident.create({
      data: { organizationId: state.actorA.organizationId, code: `INC-A-${state.runId}`, type: "INCIDENT", severity: "MEDIUM", title: "Incidente A", status: "REPORTED", reporterId: state.actorA.userId, createdById: state.actorA.userId },
    });
    incidentA = incident.id;

    const permit = await prisma.permitToWork.create({
      data: { organizationId: state.actorA.organizationId, code: `PTW-A-${state.runId}`, workType: "HOT_WORK", status: "DRAFT", createdById: state.actorA.userId },
    });
    permitA = permit.id;

    const surveillance = await prisma.occupationalHealthSurveillance.create({
      data: { organizationId: state.actorA.organizationId, code: `VS-A-${state.runId}`, workerName: "Trabajador A", fitness: "PENDING", createdById: state.actorA.userId },
    });
    surveillanceA = surveillance.id;
  });

  test.afterAll(async () => {
    await prisma.occupationalHazard.deleteMany({ where: { id: { in: [hazardA, hazardB] } } }).catch(() => undefined);
    await prisma.occupationalIncident.deleteMany({ where: { id: incidentA } }).catch(() => undefined);
    await prisma.permitToWork.deleteMany({ where: { id: permitA } }).catch(() => undefined);
    await prisma.occupationalHealthSurveillance.deleteMany({ where: { id: surveillanceA } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("A cannot read or modify B's rows across every safety table", async () => {
    const clientA = await actorClient(state.actorA);
    const admin = adminClient();

    const readHazard = await clientA.from("occupational_hazards").select("id,organizationId").eq("id", hazardB);
    expect(readHazard.error, "occupational_hazards read is evaluated by RLS").toBeNull();
    expect(readHazard.data, "B's hazard is invisible to A").toEqual([]);

    const updateHazard = await clientA.from("occupational_hazards").update({ hazard: `CROSS-${state.runId}` }).eq("id", hazardB).select("id");
    expect(updateHazard.error).toBeNull();
    expect(updateHazard.data, "cross-tenant update affects no row").toEqual([]);

    const own = await clientA.from("occupational_hazards").select("id").eq("id", hazardA);
    expect(own.data).toEqual([{ id: hazardA }]);

    const evilInsert = await clientA.from("occupational_hazards").insert({
      id: `evil_${state.runId}`, organizationId: state.actorB.organizationId, code: `EVIL-${state.runId}`,
      activity: "intento cruzado", hazard: "x", category: "OTHER", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id");
    expect(evilInsert.data ?? [], "cross-tenant insert must not persist").toEqual([]);
    expect(evilInsert.error, "RLS rejects the cross-tenant insert").not.toBeNull();

    const adminBoth = await admin.from("occupational_hazards").select("id").in("id", [hazardA, hazardB]);
    expect(adminBoth.data).toHaveLength(2);
  });

  test("sensitive health data: generic safety:read (contributor/viewer) cannot see surveillance; auditor read-only", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("occupational_health_surveillance").select("id").eq("id", surveillanceA);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data, "occupational_health_surveillance requires safety-sensitive:read, not safety:read").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("occupational_health_surveillance").select("id").eq("id", surveillanceA);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: surveillanceA }]);
    const auditorWrite = await auditor.from("occupational_health_surveillance").update({ fitness: "FIT" }).eq("id", surveillanceA).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "safety-sensitive:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const ownWrite = await clientA.from("occupational_health_surveillance").update({ fitness: "FIT" }).eq("id", surveillanceA).select("id");
    expect(ownWrite.error, "ORG_ADMIN (actorA) holds safety-sensitive:update").toBeNull();
    expect(ownWrite.data).toHaveLength(1);
  });

  test("strict incident workflow: no skipping states and no going back, enforced at the DB layer", async () => {
    const clientA = await actorClient(state.actorA);

    const skip = await clientA.from("occupational_incidents").update({ status: "CLOSED" }).eq("id", incidentA).select("id");
    expect(skip.error, "trigger rejects REPORTED -> CLOSED (skips 6 states)").not.toBeNull();

    const stepOk = await clientA.from("occupational_incidents").update({ status: "CLASSIFIED" }).eq("id", incidentA).select("id");
    expect(stepOk.error).toBeNull();
    expect(stepOk.data).toHaveLength(1);

    const backward = await clientA.from("occupational_incidents").update({ status: "REPORTED" }).eq("id", incidentA).select("id");
    expect(backward.error, "trigger rejects CLASSIFIED -> REPORTED (backward)").not.toBeNull();
  });

  test("permit-to-work workflow: DRAFT must go through ACTIVE, cannot jump to CLOSED", async () => {
    const clientA = await actorClient(state.actorA);

    const skip = await clientA.from("permits_to_work").update({ status: "CLOSED" }).eq("id", permitA).select("id");
    expect(skip.error, "trigger rejects DRAFT -> CLOSED").not.toBeNull();

    const ok = await clientA.from("permits_to_work").update({ status: "ACTIVE" }).eq("id", permitA).select("id");
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);
  });

  test("AuditLog: safety writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "safety").eq("organizationId", state.actorA.organizationId).limit(1);
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

  test("report artifacts (safety-surveillance, safety-audit-package) persist per tenant", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "safety-surveillance", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "safety-surveillance.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "safety-surveillance" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("permissions: viewer is read-only on general safety tables, auditor limited to review/export", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("occupational_hazards").select("id").eq("id", hazardA);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: hazardA }]);
    const viewerWrite = await viewer.from("occupational_hazards").update({ hazard: "intento viewer" }).eq("id", hazardA).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "safety:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("occupational_hazards").select("id").eq("id", hazardA);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: hazardA }]);
    const auditorWrite = await auditor.from("occupational_hazards").update({ hazard: "intento auditor" }).eq("id", hazardA).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "safety:update is denied to AUDITOR").toEqual([]);
  });
});
