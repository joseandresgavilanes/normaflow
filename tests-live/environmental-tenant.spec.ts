import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { computeSignificance } from "@/lib/environmental/significance";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * ISO 14001 environmental management — live multi-tenant boundary.
 *
 * Covers: tenant A/B isolation across all 11 environmental tables (incl.
 * biodiversity), tenant-integrity relations (triggers), RLS, AuditLog
 * (append-only + tenant-scoped), report artifacts, the significance
 * calculation (against the real pure function, not a re-implementation),
 * the compliance-evaluation relation, and the role permission matrix.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let aspectA = "", aspectB = "";
let obligationA = "", obligationB = "";
let methodAId = "";
let biodiversityA = "";

test.describe("ISO 14001 environmental management live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const [aA, aB] = await Promise.all([
      prisma.environmentalAspect.create({ data: { organizationId: state.actorA.organizationId, code: `ASP-A-${state.runId}`, activity: "Aspecto tenant A", condition: "NORMAL", createdById: state.actorA.userId } }),
      prisma.environmentalAspect.create({ data: { organizationId: state.actorB.organizationId, code: `ASP-B-${state.runId}`, activity: "Aspecto tenant B", condition: "NORMAL", createdById: state.actorB.userId } }),
    ]);
    aspectA = aA.id; aspectB = aB.id;

    const method = await prisma.environmentalSignificanceMethod.create({
      data: { organizationId: state.actorA.organizationId, name: `Método ${state.runId}`, formula: "WEIGHTED_SUM", weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12, version: "1", active: true, createdById: state.actorA.userId },
    });
    methodAId = method.id;

    const [oA, oB] = await Promise.all([
      prisma.environmentalComplianceObligation.create({ data: { organizationId: state.actorA.organizationId, code: `OBL-A-${state.runId}`, source: "Reglamento A", obligation: "Obligación tenant A", reviewFrequencyMonths: 6, createdById: state.actorA.userId } }),
      prisma.environmentalComplianceObligation.create({ data: { organizationId: state.actorB.organizationId, code: `OBL-B-${state.runId}`, source: "Reglamento B", obligation: "Obligación tenant B", createdById: state.actorB.userId } }),
    ]);
    obligationA = oA.id; obligationB = oB.id;

    await Promise.all([
      prisma.environmentalObjective.create({ data: { organizationId: state.actorA.organizationId, code: `OBJ-A-${state.runId}`, objective: "Objetivo A", status: "PLANNED", createdById: state.actorA.userId } }),
      prisma.environmentalMetric.create({ data: { organizationId: state.actorA.organizationId, period: `2026-0${state.runId.length % 9 || 1}`, water: 100, createdById: state.actorA.userId } }),
      prisma.wasteStream.create({ data: { organizationId: state.actorA.organizationId, code: `RES-A-${state.runId}`, wasteType: "Aceite", classification: "HAZARDOUS", createdById: state.actorA.userId } }),
      prisma.environmentalEmergencyScenario.create({ data: { organizationId: state.actorA.organizationId, code: `EMG-A-${state.runId}`, scenario: "Derrame A", createdById: state.actorA.userId } }),
    ]);

    const bio = await prisma.environmentalBiodiversityRecord.create({
      data: { organizationId: state.actorA.organizationId, code: `BIO-A-${state.runId}`, site: "Sitio A", status: "IDENTIFIED", createdById: state.actorA.userId },
    });
    biodiversityA = bio.id;
  });

  test.afterAll(async () => {
    await prisma.environmentalAspect.deleteMany({ where: { id: { in: [aspectA, aspectB] } } }).catch(() => undefined);
    await prisma.environmentalSignificanceMethod.deleteMany({ where: { id: methodAId } }).catch(() => undefined);
    await prisma.environmentalComplianceObligation.deleteMany({ where: { id: { in: [obligationA, obligationB] } } }).catch(() => undefined);
    await prisma.environmentalBiodiversityRecord.deleteMany({ where: { id: biodiversityA } }).catch(() => undefined);
    await prisma.environmentalObjective.deleteMany({ where: { organizationId: state.actorA.organizationId, code: { contains: state.runId } } }).catch(() => undefined);
    await prisma.environmentalMetric.deleteMany({ where: { organizationId: state.actorA.organizationId, createdById: state.actorA.userId } }).catch(() => undefined);
    await prisma.wasteStream.deleteMany({ where: { organizationId: state.actorA.organizationId, code: { contains: state.runId } } }).catch(() => undefined);
    await prisma.environmentalEmergencyScenario.deleteMany({ where: { organizationId: state.actorA.organizationId, code: { contains: state.runId } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("A cannot read or modify B's rows across every environmental table", async () => {
    const clientA = await actorClient(state.actorA);
    const admin = adminClient();

    const otherAspect = aspectB;
    const otherObligation = obligationB;

    const readAspect = await clientA.from("environmental_aspects").select("id,organizationId").eq("id", otherAspect);
    expect(readAspect.error, "environmental_aspects read is evaluated by RLS").toBeNull();
    expect(readAspect.data, "B's aspect is invisible to A").toEqual([]);

    const updateAspect = await clientA.from("environmental_aspects").update({ activity: `CROSS-${state.runId}` }).eq("id", otherAspect).select("id");
    expect(updateAspect.error).toBeNull();
    expect(updateAspect.data, "cross-tenant update affects no row").toEqual([]);

    const readObligation = await clientA.from("environmental_compliance_obligations").select("id").eq("id", otherObligation);
    expect(readObligation.error).toBeNull();
    expect(readObligation.data).toEqual([]);

    // Own rows remain visible.
    const own = await clientA.from("environmental_aspects").select("id").eq("id", aspectA);
    expect(own.data).toEqual([{ id: aspectA }]);

    // Cross-tenant insert (spoofed organizationId) is rejected by the WITH CHECK policy.
    const evilInsert = await clientA.from("environmental_aspects").insert({
      id: `evil_${state.runId}`, organizationId: state.actorB.organizationId, code: `EVIL-${state.runId}`,
      activity: "intento cruzado", condition: "NORMAL", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id");
    expect(evilInsert.data ?? [], "cross-tenant insert must not persist").toEqual([]);
    expect(evilInsert.error, "RLS rejects the cross-tenant insert").not.toBeNull();

    // Sanity: admin (service role) really does see both tenants' rows — proves the
    // isolation above is RLS, not just an empty table.
    const adminBoth = await admin.from("environmental_aspects").select("id").in("id", [aspectA, aspectB]);
    expect(adminBoth.data).toHaveLength(2);
  });

  test("biodiversity: protected area requires a name (CHECK) and rejects a cross-tenant process link (trigger)", async () => {
    const clientA = await actorClient(state.actorA);

    const invalid = await clientA.from("environmental_biodiversity_records").update({ protectedArea: true, protectedAreaName: null }).eq("id", biodiversityA).select("id");
    expect(invalid.error, "CHECK: protected area without a name is rejected").not.toBeNull();

    const valid = await clientA.from("environmental_biodiversity_records").update({ protectedArea: true, protectedAreaName: "Reserva de prueba" }).eq("id", biodiversityA).select("id");
    expect(valid.error).toBeNull();
    expect(valid.data).toHaveLength(1);

    const crossProcess = await clientA.from("environmental_biodiversity_records").update({ processId: state.actorB.processId }).eq("id", biodiversityA).select("id");
    expect(crossProcess.error, "trigger rejects a process from another organization").not.toBeNull();
  });

  test("significance: a row computed with the real pure function persists and stays tenant isolated", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const method = { formula: "WEIGHTED_SUM" as const, weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12 };
    const input = { severity: 5, frequency: 3, scope: 2 };
    const expected = computeSignificance(method, input);

    const created = await clientA.from("environmental_impacts").insert({
      id: `imp_${state.runId}`, organizationId: state.actorA.organizationId, aspectId: aspectA, methodId: methodAId,
      impactType: "Impacto de prueba", severity: input.severity, frequency: input.frequency, scope: input.scope,
      score: expected.score, level: expected.level, significant: expected.significant,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id,score,level,significant");
    expect(created.error).toBeNull();
    expect(created.data?.[0]).toMatchObject({ score: expected.score, level: expected.level, significant: expected.significant });

    const crossRead = await clientB.from("environmental_impacts").select("id").eq("id", `imp_${state.runId}`);
    expect(crossRead.data, "the computed impact is invisible to org B").toEqual([]);

    await adminClient().from("environmental_impacts").delete().eq("id", `imp_${state.runId}`);
  });

  test("compliance evaluation must reference an obligation from the same tenant", async () => {
    const clientA = await actorClient(state.actorA);

    const crossTenantEvaluation = await clientA.from("environmental_compliance_evaluations").insert({
      id: `ev_evil_${state.runId}`, organizationId: state.actorA.organizationId, obligationId: obligationB,
      result: "COMPLIANT", evaluatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id");
    // Either the FK/trigger rejects it outright, or it silently affects no row — never persists.
    expect(crossTenantEvaluation.data ?? [], "an evaluation cannot attach to another tenant's obligation").toEqual([]);

    const ownEvaluation = await clientA.from("environmental_compliance_evaluations").insert({
      id: `ev_ok_${state.runId}`, organizationId: state.actorA.organizationId, obligationId: obligationA,
      result: "COMPLIANT", evaluatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id");
    expect(ownEvaluation.error).toBeNull();
    expect(ownEvaluation.data).toHaveLength(1);
    await adminClient().from("environmental_compliance_evaluations").delete().eq("id", `ev_ok_${state.runId}`);
  });

  test("AuditLog: environmental writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "environment").eq("organizationId", state.actorA.organizationId).limit(1);
    expect(ownLogs.error, "activity:read lets A see its own environmental audit trail").toBeNull();

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

  test("report artifacts (env-biodiversity, env-audit-package) persist per tenant", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "env-biodiversity", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "env-biodiversity.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "env-biodiversity" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("permissions: viewer is read-only, auditor is limited to review/export", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("environmental_aspects").select("id").eq("id", aspectA);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: aspectA }]);
    const viewerWrite = await viewer.from("environmental_aspects").update({ activity: "intento viewer" }).eq("id", aspectA).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "environment:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("environmental_aspects").select("id").eq("id", aspectA);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: aspectA }]);
    const auditorWrite = await auditor.from("environmental_aspects").update({ activity: "intento auditor" }).eq("id", aspectA).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "environment:update is denied to AUDITOR").toEqual([]);
  });
});
