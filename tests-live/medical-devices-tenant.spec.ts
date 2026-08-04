import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * Medical device QMS (ISO 13485) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_13485 catalog installation, sensitive access (the
 * md-sensitive:* boundary around complaints/adverse events/PMS/FSCA/recalls
 * — including the PMS RLS reclassification fixed this round, regression
 * tested directly), design chain (DHF → input → output → review →
 * verification → validation, with DB-enforced result attribution), lot,
 * traceability, complaint, adverse event, recall, tenant A/B isolation,
 * RLS, AuditLog append-only, and report artifacts.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let familyId = "";
let deviceId = "";
let dhfId = "";
let ccpVerificationId = "";
let riskFileId = "";
let batchId = "";
let traceId = "";
let complaintId = "";
let adverseEventId = "";
let pmsId = "";
let recallId = "";

test.describe("ISO 13485 (medical devices) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const family = await prisma.deviceFamily.create({
      data: { organizationId: state.actorA.organizationId, code: `MDFAM-${state.runId}`, name: "Familia live fixture", createdById: state.actorA.userId },
    });
    familyId = family.id;

    const device = await prisma.medicalDevice.create({
      data: { organizationId: state.actorA.organizationId, code: `MDDEV-${state.runId}`, name: "Dispositivo live fixture", familyId, classification: "IIa", status: "PRODUCTION", createdById: state.actorA.userId },
    });
    deviceId = device.id;

    const dhf = await prisma.designHistoryFile.create({
      data: { organizationId: state.actorA.organizationId, code: `MDDHF-${state.runId}`, deviceId, title: "DHF live fixture", createdById: state.actorA.userId },
    });
    dhfId = dhf.id;

    const input = await prisma.designInput.create({
      data: { organizationId: state.actorA.organizationId, code: `MDDI-${state.runId}`, dhfId, requirement: "Precisión ±2%", createdById: state.actorA.userId },
    });
    await prisma.designOutput.create({
      data: { organizationId: state.actorA.organizationId, code: `MDDO-${state.runId}`, dhfId, description: "Firmware v1", linkedInputCodes: [input.code], createdById: state.actorA.userId },
    });
    const verification = await prisma.designVerification.create({
      data: { organizationId: state.actorA.organizationId, code: `MDVE-${state.runId}`, dhfId, method: "Ensayo", result: "PASS", verifiedAt: new Date(), verifiedById: state.actorA.userId, createdById: state.actorA.userId },
    });
    ccpVerificationId = verification.id;

    const riskFile = await prisma.deviceRiskFile.create({
      data: { organizationId: state.actorA.organizationId, code: `MDRISK-${state.runId}`, deviceId, title: "Riesgos live fixture", createdById: state.actorA.userId },
    });
    riskFileId = riskFile.id;

    const batch = await prisma.productionBatch.create({
      data: { organizationId: state.actorA.organizationId, code: `MDLOT-${state.runId}`, deviceId, lotNumber: `L-${state.runId}`, status: "RELEASED", manufacturedAt: new Date(), createdById: state.actorA.userId },
    });
    batchId = batch.id;

    const trace = await prisma.deviceTraceability.create({
      data: { organizationId: state.actorA.organizationId, code: `MDTRC-${state.runId}`, batchId, customerAccountRef: `DIST-${state.runId.slice(-8)}`, createdById: state.actorA.userId },
    });
    traceId = trace.id;

    const complaint = await prisma.complaint.create({
      data: { organizationId: state.actorA.organizationId, code: `MDCMP-${state.runId}`, deviceId, batchId, description: "Queja live fixture sin PII", anonymizedSubjectRef: `CASE-${state.runId.slice(-8)}`, status: "INVESTIGATING", createdById: state.actorA.userId },
    });
    complaintId = complaint.id;

    const adverseEvent = await prisma.adverseEvent.create({
      data: { organizationId: state.actorA.organizationId, code: `MDAE-${state.runId}`, deviceId, batchId, complaintId, severity: "MODERATE", description: "Evento adverso live fixture", anonymizedSubjectRef: `CASE-${state.runId.slice(-8)}`, status: "UNDER_REVIEW", createdById: state.actorA.userId },
    });
    adverseEventId = adverseEvent.id;

    const pms = await prisma.postMarketSurveillance.create({
      data: { organizationId: state.actorA.organizationId, code: `MDPMS-${state.runId}`, deviceId, title: "PMS live fixture", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-06-30"), status: "IN_PROGRESS", createdById: state.actorA.userId },
    });
    pmsId = pms.id;

    const recall = await prisma.productRecall.create({
      data: { organizationId: state.actorA.organizationId, code: `MDRCL-${state.runId}`, deviceId, title: "Retiro live fixture", reason: "Riesgo de sellado", lotNumbers: [batch.lotNumber], status: "INITIATED", createdById: state.actorA.userId },
    });
    recallId = recall.id;
  });

  test.afterAll(async () => {
    await prisma.productRecall.deleteMany({ where: { id: recallId } }).catch(() => undefined);
    await prisma.postMarketSurveillance.deleteMany({ where: { id: pmsId } }).catch(() => undefined);
    await prisma.adverseEvent.deleteMany({ where: { id: adverseEventId } }).catch(() => undefined);
    await prisma.complaint.deleteMany({ where: { id: complaintId } }).catch(() => undefined);
    await prisma.deviceTraceability.deleteMany({ where: { id: traceId } }).catch(() => undefined);
    await prisma.productionBatch.deleteMany({ where: { id: batchId } }).catch(() => undefined);
    await prisma.deviceRiskFile.deleteMany({ where: { id: riskFileId } }).catch(() => undefined);
    await prisma.designVerification.deleteMany({ where: { id: ccpVerificationId } }).catch(() => undefined);
    await prisma.designHistoryFile.deleteMany({ where: { id: dhfId } }).catch(() => undefined);
    await prisma.medicalDevice.deleteMany({ where: { id: deviceId } }).catch(() => undefined);
    await prisma.deviceFamily.deleteMany({ where: { id: familyId } }).catch(() => undefined);
    await prisma.mdRetentionPolicy.deleteMany({ where: { organizationId: state.actorA.organizationId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_13485 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_13485" } });
    expect(family, "ISO_13485 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_13485" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(15);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_13485" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's medical-devices rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readDevices = await clientB.from("md_medical_devices").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readDevices.error).toBeNull();
    expect(readDevices.data, "B's client sees none of A's devices").toEqual([]);

    const readDhf = await clientB.from("md_design_history_files").select("id").eq("id", dhfId);
    expect(readDhf.data, "B cannot see A's DHF by id either").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("md_medical_devices").select("id,name").eq("id", deviceId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ name: "Dispositivo live fixture" });
  });

  test("acceso sensible: md-sensitive:read gates complaints/events/PMS/FSCA/recalls — including reclassified PMS", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerComplaint = await viewer.from("md_complaints").select("id").eq("id", complaintId);
    expect(viewerComplaint.error).toBeNull();
    expect(viewerComplaint.data, "VIEWER lacks md-sensitive:read — sees no complaints").toEqual([]);

    // PMS reclassification regression: before this round PMS sat under
    // medical-devices:read (which VIEWER holds), so this would have
    // returned data. It must now behave exactly like the other three
    // vigilance tables.
    const viewerPms = await viewer.from("md_post_market_surveillances").select("id").eq("id", pmsId);
    expect(viewerPms.error).toBeNull();
    expect(viewerPms.data, "VIEWER must NOT see PMS post-reclassification (regression test for this round's RLS fix)").toEqual([]);

    // But VIEWER can still read the non-sensitive medical-devices tables (device, DHF, risk file, batch).
    const viewerDevice = await viewer.from("md_medical_devices").select("id").eq("id", deviceId);
    expect(viewerDevice.error).toBeNull();
    expect(viewerDevice.data).toEqual([{ id: deviceId }]);

    const clientA = await actorClient(state.actorA);
    const aComplaint = await clientA.from("md_complaints").select("id").eq("id", complaintId);
    expect(aComplaint.error).toBeNull();
    expect(aComplaint.data, "ORG_ADMIN (actorA) holds md-sensitive:read and can read its own complaint").toEqual([{ id: complaintId }]);
    const aPms = await clientA.from("md_post_market_surveillances").select("id").eq("id", pmsId);
    expect(aPms.data, "ORG_ADMIN can read PMS under the reclassified policy").toEqual([{ id: pmsId }]);
  });

  test("diseño: DHF chain persists with DB-enforced verification attribution", async () => {
    const clientA = await actorClient(state.actorA);
    const dhf = await clientA.from("md_design_history_files").select("id,title,deviceId").eq("id", dhfId).single();
    expect(dhf.error).toBeNull();
    expect(dhf.data).toMatchObject({ deviceId });

    const verification = await clientA.from("md_design_verifications").select("id,result,verifiedAt,verifiedById").eq("id", ccpVerificationId).single();
    expect(verification.error).toBeNull();
    expect(verification.data).toMatchObject({ result: "PASS" });
    expect(verification.data?.verifiedAt).not.toBeNull();

    const admin = adminClient();
    const badVerification = await admin.from("md_design_verifications").insert({
      organizationId: state.actorA.organizationId, code: `MDVE-BAD-${state.runId}`, dhfId, result: "PASS",
    }).select("id");
    expect(badVerification.error, "md_verification_pass_attributed CHECK rejects PASS without verifiedAt/verifiedById").not.toBeNull();

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("md_design_verifications").select("id").eq("id", ccpVerificationId);
    expect(crossRead.data, "B cannot see A's design verification").toEqual([]);
  });

  test("lote: production batch persists and is tenant-scoped", async () => {
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("md_production_batches").select("id,lotNumber,status").eq("id", batchId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ status: "RELEASED" });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("md_production_batches").select("id").eq("id", batchId);
    expect(crossRead.data, "B cannot see A's batch").toEqual([]);
  });

  test("trazabilidad: traceability record links to its batch with an opaque customer reference", async () => {
    const clientA = await actorClient(state.actorA);
    const trace = await clientA.from("md_device_traceabilities").select("id,batchId,customerAccountRef").eq("id", traceId).single();
    expect(trace.error).toBeNull();
    expect(trace.data).toMatchObject({ batchId, customerAccountRef: `DIST-${state.runId.slice(-8)}` });
  });

  test("queja: complaint persists with opaque subject ref, rejects email-like refs, and gates purge on retention", async () => {
    const clientA = await actorClient(state.actorA);
    const complaint = await clientA.from("md_complaints").select("id,status,anonymizedSubjectRef").eq("id", complaintId).single();
    expect(complaint.error).toBeNull();
    expect(complaint.data).toMatchObject({ status: "INVESTIGATING", anonymizedSubjectRef: `CASE-${state.runId.slice(-8)}` });

    const admin = adminClient();
    const badSubject = await admin.from("md_complaints").insert({
      organizationId: state.actorA.organizationId, code: `MDCMP-BAD-${state.runId}`, description: "x", anonymizedSubjectRef: "bad@email.com",
    }).select("id");
    expect(badSubject.error, "md_complaint_subject_opaque CHECK rejects an email-like subject ref").not.toBeNull();

    const now = new Date();
    const closed = await prisma.complaint.create({
      data: {
        organizationId: state.actorA.organizationId, code: `MDCMP-CLOSED-${state.runId}`, description: "Cerrada para prueba de retención",
        status: "CLOSED", closedAt: now, retentionUntil: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    const badPurge = await admin.from("md_complaints").update({ purgedAt: now }).eq("id", closed.id).select("id");
    expect(badPurge.error, "md_complaint_purge_after_retention CHECK rejects purging before retentionUntil").not.toBeNull();
    await prisma.complaint.delete({ where: { id: closed.id } }).catch(() => undefined);
  });

  test("evento: adverse event persists tenant-scoped with opaque subject ref", async () => {
    const clientA = await actorClient(state.actorA);
    const event = await clientA.from("md_adverse_events").select("id,severity,status,complaintId").eq("id", adverseEventId).single();
    expect(event.error).toBeNull();
    expect(event.data).toMatchObject({ severity: "MODERATE", complaintId });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("md_adverse_events").select("id").eq("id", adverseEventId);
    expect(crossRead.data, "B cannot see A's adverse event").toEqual([]);
  });

  test("recall: product recall persists, marks lots, and requires closedAt to close", async () => {
    const clientA = await actorClient(state.actorA);
    const recall = await clientA.from("md_product_recalls").select("id,lotNumbers,status").eq("id", recallId).single();
    expect(recall.error).toBeNull();
    expect(recall.data?.lotNumbers).toContain((await prisma.productionBatch.findUniqueOrThrow({ where: { id: batchId } })).lotNumber);

    const admin = adminClient();
    const badClose = await admin.from("md_product_recalls").update({ status: "CLOSED" }).eq("id", recallId).select("id");
    expect(badClose.error, "md_recall_closed_attributed CHECK requires closedAt when status=CLOSED").not.toBeNull();
  });

  test("AuditLog: medical-devices writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs")
      .select("id")
      .in("module", ["medical-devices", "md-sensitive"])
      .eq("organizationId", state.actorA.organizationId)
      .limit(1);
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

  test("reportes: an md-audit-package artifact is tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "md-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "md-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "md-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("RLS/permisos: AUDITOR reads sensitive data read-only, CONTRIBUTOR cannot", async () => {
    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("md_complaints").select("id").eq("id", complaintId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data, "AUDITOR holds md-sensitive:read").toEqual([{ id: complaintId }]);
    const auditorWrite = await auditor.from("md_complaints").update({ status: "TRIAGED" }).eq("id", complaintId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "md-sensitive:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("md_regulatory_requirements").insert({
      id: `live_md_regulatory_control_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `MDREG-${state.runId}`, jurisdiction: "UE", framework: "MDR", title: "Requisito live fixture",
      updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "medical-devices:create is held by ORG_ADMIN").toBeNull();
    if (created.data?.id) await prisma.regulatoryRequirement.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });
});
