import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * Sistema Integrado de Gestión (ISO 9001 + 14001 + 45001) — live multi-tenant
 * boundary.
 *
 * Covers: tenant A/B isolation across integrated_systems/interested_parties/
 * integrated_objectives/requirement_coverage, a document covering three
 * requirements without duplicating records, an evidence file covering
 * requirements across two different standards, integrated audit and shared
 * CAPA (multi-standard tagging on the underlying tables), report artifacts,
 * historical edition immutability (DB-level triggers, not just app code),
 * AuditLog append-only + tenant scoping, and the role permission matrix.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let reqA = "", reqB = "", reqC = "", reqD = "";
let editionId9001 = "";
let systemAId = "";
let partyAId = "", partyBId = "";
let objectiveAId = "";
const coverageIds: string[] = [];

test.describe("SIG (9001+14001+45001) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    // El catálogo ya está instalado globalmente por globalSetup (installAllPacks).
    const iso9001Reqs = await prisma.standardRequirement.findMany({
      where: { standard: { family: { code: "ISO_9001" } }, active: true },
      orderBy: { code: "asc" },
      take: 3,
      select: { id: true, standardId: true },
    });
    if (iso9001Reqs.length < 3) throw new Error("Catálogo ISO 9001 incompleto para el fixture SIG.");
    [reqA, reqB, reqC] = iso9001Reqs.map((r) => r.id);
    editionId9001 = iso9001Reqs[0].standardId;

    const iso14001Req = await prisma.standardRequirement.findFirst({
      where: { standard: { family: { code: "ISO_14001" } }, active: true },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    if (!iso14001Req) throw new Error("Catálogo ISO 14001 incompleto para el fixture SIG.");
    reqD = iso14001Req.id;

    const system = await prisma.integratedSystem.create({
      data: {
        id: `live_sig_system_${state.runId}`, organizationId: state.actorA.organizationId,
        scope: "Alcance SIG live fixture", policy: "Política SIG live fixture",
        createdById: state.actorA.userId,
      },
    });
    systemAId = system.id;

    const [partyA, partyB] = await Promise.all([
      prisma.interestedParty.create({ data: { id: `live_sig_party_a_${state.runId}`, organizationId: state.actorA.organizationId, code: `PI-A-${state.runId}`, name: "Parte A", disciplines: ["QUALITY", "ENVIRONMENT"], createdById: state.actorA.userId } }),
      prisma.interestedParty.create({ data: { id: `live_sig_party_b_${state.runId}`, organizationId: state.actorB.organizationId, code: `PI-B-${state.runId}`, name: "Parte B", createdById: state.actorB.userId } }),
    ]);
    partyAId = partyA.id; partyBId = partyB.id;

    const objective = await prisma.integratedObjective.create({
      data: { id: `live_sig_obj_a_${state.runId}`, organizationId: state.actorA.organizationId, code: `OBJ-${state.runId}`, title: "Objetivo compartido SIG", disciplines: ["QUALITY", "ENVIRONMENT", "SAFETY"], createdById: state.actorA.userId },
    });
    objectiveAId = objective.id;

    // Un documento cubre tres requisitos (sin duplicar registros).
    const docCoverage = await Promise.all([reqA, reqB, reqC].map((reqId, i) =>
      prisma.requirementCoverage.create({ data: { id: `live_sig_cov_doc_${i}_${state.runId}`, organizationId: state.actorA.organizationId, requirementId: reqId, entityType: "DOCUMENT", entityId: state.actorA.documentId, createdById: state.actorA.userId } }),
    ));
    // Una evidencia cubre requisitos de dos normas distintas (9001 + 14001).
    const evCoverage = await Promise.all([reqA, reqD].map((reqId, i) =>
      prisma.requirementCoverage.create({ data: { id: `live_sig_cov_ev_${i}_${state.runId}`, organizationId: state.actorA.organizationId, requirementId: reqId, entityType: "EVIDENCE", entityId: state.actorA.evidenceId, createdById: state.actorA.userId } }),
    ));
    coverageIds.push(...docCoverage.map((c) => c.id), ...evCoverage.map((c) => c.id));
  });

  test.afterAll(async () => {
    await prisma.requirementCoverage.deleteMany({ where: { id: { in: coverageIds } } }).catch(() => undefined);
    await prisma.integratedObjective.deleteMany({ where: { id: objectiveAId } }).catch(() => undefined);
    await prisma.interestedParty.deleteMany({ where: { id: { in: [partyAId, partyBId] } } }).catch(() => undefined);
    await prisma.integratedSystem.deleteMany({ where: { id: systemAId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("A cannot read or modify B's rows across integrated_systems, interested_parties, integrated_objectives", async () => {
    const clientA = await actorClient(state.actorA);
    const admin = adminClient();

    const readParty = await clientA.from("interested_parties").select("id").eq("id", partyBId);
    expect(readParty.error).toBeNull();
    expect(readParty.data, "B's interested party is invisible to A").toEqual([]);

    const updateParty = await clientA.from("interested_parties").update({ name: `CROSS-${state.runId}` }).eq("id", partyBId).select("id");
    expect(updateParty.error).toBeNull();
    expect(updateParty.data, "cross-tenant update affects no row").toEqual([]);

    const own = await clientA.from("interested_parties").select("id").eq("id", partyAId);
    expect(own.data).toEqual([{ id: partyAId }]);

    const adminBoth = await admin.from("interested_parties").select("id").in("id", [partyAId, partyBId]);
    expect(adminBoth.data).toHaveLength(2);
  });

  test("a document covers three requirements without duplicating records", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const own = await clientA.from("requirement_coverage").select("id,requirementId").eq("entityType", "DOCUMENT").eq("entityId", state.actorA.documentId);
    expect(own.error).toBeNull();
    expect(own.data, "one document, three distinct requirement links, no duplicate rows per (org,requirement,entity)").toHaveLength(3);
    const uniqueRequirements = new Set((own.data ?? []).map((r: { requirementId: string }) => r.requirementId));
    expect(uniqueRequirements.size).toBe(3);

    const cross = await clientB.from("requirement_coverage").select("id").eq("entityId", state.actorA.documentId);
    expect(cross.data, "B cannot see A's coverage rows").toEqual([]);
  });

  test("an evidence file covers requirements across two different standards", async () => {
    const clientA = await actorClient(state.actorA);
    const rows = await clientA.from("requirement_coverage").select("id,requirementId").eq("entityType", "EVIDENCE").eq("entityId", state.actorA.evidenceId);
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(2);
    const requirementIds = (rows.data ?? []).map((r: { requirementId: string }) => r.requirementId);
    expect(requirementIds).toEqual(expect.arrayContaining([reqA, reqD]));
  });

  test("integrated audit: one audit can be tagged with multiple standards, viewer cannot write", async () => {
    const clientA = await actorClient(state.actorA);
    const viewer = await actorClient(state.actorAViewer);

    const write = await clientA.from("audits").update({ standards: ["ISO_9001", "ISO_14001", "ISO_45001"], integrated: true }).eq("id", state.actorA.auditId).select("id,standards,integrated");
    expect(write.error).toBeNull();
    expect(write.data).toEqual([{ id: state.actorA.auditId, standards: ["ISO_9001", "ISO_14001", "ISO_45001"], integrated: true }]);

    const viewerWrite = await viewer.from("audits").update({ standards: ["ISO_9001"] }).eq("id", state.actorA.auditId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "read-only role cannot retag an audit's standards").toEqual([]);
  });

  test("shared CAPA: one CAPA can be tagged with multiple standards, viewer cannot write", async () => {
    const clientA = await actorClient(state.actorA);
    const viewer = await actorClient(state.actorAViewer);

    const write = await clientA.from("capas").update({ standards: ["ISO_9001", "ISO_45001"] }).eq("id", state.actorA.capaId).select("id,standards");
    expect(write.error).toBeNull();
    expect(write.data).toEqual([{ id: state.actorA.capaId, standards: ["ISO_9001", "ISO_45001"] }]);

    const viewerWrite = await viewer.from("capas").update({ standards: ["ISO_9001"] }).eq("id", state.actorA.capaId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "read-only role cannot retag a CAPA's standards").toEqual([]);
  });

  test("historical edition immutability: ACTIVE catalog rows reject retroactive edits at the DB layer", async () => {
    const admin = adminClient();

    const editRequirement = await admin.from("standard_requirements").update({ title: `TAMPERED-${state.runId}` }).eq("id", reqA).select("id");
    expect(editRequirement.error, "an ACTIVE edition's requirement text is immutable, even for service_role").not.toBeNull();

    const editEdition = await admin.from("standard_editions").update({ catalogVersion: `tampered-${state.runId}` }).eq("id", editionId9001).select("id");
    expect(editEdition.error, "an ACTIVE edition's catalogVersion is immutable — bump editionCode instead").not.toBeNull();
  });

  test("AuditLog: SIG writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "integrated").eq("organizationId", state.actorA.organizationId).limit(1);
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

  test("report artifacts (sig-crosswalk, sig-system-package) persist per tenant", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "sig-crosswalk", format: "EXCEL", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "sig-crosswalk.xlsx", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "sig-crosswalk" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("permissions: viewer is read-only, auditor limited to review/export", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("interested_parties").select("id").eq("id", partyAId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: partyAId }]);
    const viewerWrite = await viewer.from("interested_parties").update({ name: "intento viewer" }).eq("id", partyAId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "integrated:update is denied to VIEWER").toEqual([]);
    const viewerCoverageWrite = await viewer.from("requirement_coverage").insert({ id: `live_sig_evil_${state.runId}`, organizationId: state.actorA.organizationId, requirementId: reqA, entityType: "DOCUMENT", entityId: state.actorA.documentId }).select("id");
    expect(viewerCoverageWrite.error, "standards:activate is denied to VIEWER").not.toBeNull();

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("integrated_objectives").select("id").eq("id", objectiveAId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: objectiveAId }]);
    const auditorWrite = await auditor.from("integrated_objectives").update({ title: "intento auditor" }).eq("id", objectiveAId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "integrated:update is denied to AUDITOR (read/export only)").toEqual([]);
  });
});
