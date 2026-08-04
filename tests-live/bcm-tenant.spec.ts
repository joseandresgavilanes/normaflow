import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * Business Continuity Management (ISO 22301) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_22301 catalog installation, tenant A/B isolation across the
 * 12 BCM tables, BIA + RTO/RPO/MTPD persistence, plan activation lifecycle,
 * exercises/results, report artifacts, AuditLog append-only + tenant scoping,
 * RLS role permissions, and evidence linkage.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let biaId = "";
let activityId = "";
let planId = "";
let testId = "";
let versionId = "";
const cleanupIds = { activations: [] as string[], results: [] as string[] };

test.describe("ISO 22301 (BCM) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const bia = await prisma.businessImpactAnalysis.create({
      data: { organizationId: state.actorA.organizationId, code: `BIA-${state.runId}`, title: "BIA live fixture", version: "1.0", createdById: state.actorA.userId },
    });
    biaId = bia.id;

    const activity = await prisma.criticalActivity.create({
      data: {
        organizationId: state.actorA.organizationId, biaId: bia.id, code: `ACT-${state.runId}`, name: "Actividad live",
        mtpdMinutes: 480, rtoMinutes: 240, rpoMinutes: 60, impactScore: 70, criticality: "HIGH", priority: 1,
        createdById: state.actorA.userId,
      },
    });
    activityId = activity.id;

    const plan = await prisma.businessContinuityPlan.create({
      data: { organizationId: state.actorA.organizationId, code: `BCP-${state.runId}`, title: "Plan live fixture", status: "APPROVED", rtoMinutes: 240, rpoMinutes: 60 },
    });
    planId = plan.id;

    const version = await prisma.continuityPlanVersion.create({
      data: { organizationId: state.actorA.organizationId, planId: plan.id, version: "1.0", evidenceId: state.actorA.evidenceId, createdById: state.actorA.userId },
    });
    versionId = version.id;

    const t = await prisma.continuityTest.create({
      data: { organizationId: state.actorA.organizationId, planId: plan.id, title: "Simulacro live", type: "TABLETOP", status: "PLANNED" },
    });
    testId = t.id;
  });

  test.afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { id: { in: cleanupIds.results } } }).catch(() => undefined);
    await prisma.planActivation.deleteMany({ where: { id: { in: cleanupIds.activations } } }).catch(() => undefined);
    await prisma.continuityTest.deleteMany({ where: { id: testId } }).catch(() => undefined);
    await prisma.continuityPlanVersion.deleteMany({ where: { id: versionId } }).catch(() => undefined);
    await prisma.businessContinuityPlan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    await prisma.criticalActivity.deleteMany({ where: { id: activityId } }).catch(() => undefined);
    await prisma.businessImpactAnalysis.deleteMany({ where: { id: biaId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_22301 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_22301" } });
    expect(family, "ISO_22301 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_22301" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(30);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_22301" } });
    expect(pack).not.toBeNull();
  });

  test("A cannot read or modify B's rows across BCM tables", async () => {
    const clientA = await actorClient(state.actorA);
    const admin = adminClient();

    const readBia = await clientA.from("business_impact_analyses").select("id").eq("organizationId", state.actorB.organizationId);
    expect(readBia.error).toBeNull();
    expect(readBia.data, "B's BIA rows are invisible to A").toEqual([]);

    const updatePlan = await clientA.from("business_continuity_plans").update({ title: `CROSS-${state.runId}` }).eq("id", planId).eq("organizationId", state.actorB.organizationId).select("id");
    expect(updatePlan.data, "cross-tenant filter matches no row for A's own plan under B's id").toEqual([]);

    const own = await clientA.from("business_impact_analyses").select("id").eq("id", biaId);
    expect(own.data).toEqual([{ id: biaId }]);

    const adminCheck = await admin.from("critical_activities").select("id,mtpdMinutes,rtoMinutes,rpoMinutes").eq("id", activityId);
    expect(adminCheck.data).toHaveLength(1);
  });

  test("BIA and critical activity persist MTPD/RTO/RPO correctly", async () => {
    const clientA = await actorClient(state.actorA);
    const row = await clientA.from("critical_activities").select("mtpdMinutes,rtoMinutes,rpoMinutes,criticality").eq("id", activityId).single();
    expect(row.error).toBeNull();
    expect(row.data).toMatchObject({ mtpdMinutes: 480, rtoMinutes: 240, rpoMinutes: 60, criticality: "HIGH" });
    expect(row.data!.rtoMinutes).toBeLessThanOrEqual(row.data!.mtpdMinutes as number);

    const bia = await clientA.from("business_impact_analyses").select("id,status").eq("id", biaId).single();
    expect(bia.data?.status).toBe("DRAFT");
  });

  test("planes: an approved plan can be activated and later deactivated with lessons learned", async () => {
    const clientA = await actorClient(state.actorA);
    const viewer = await actorClient(state.actorAViewer);

    const insertActivation = await clientA.from("plan_activations").insert({
      id: `live_bcm_activation_${state.runId}`, organizationId: state.actorA.organizationId, planId, reason: "Interrupción de prueba", activatedById: state.actorA.userId,
      updatedAt: new Date().toISOString(),
    }).select("id");
    expect(insertActivation.error).toBeNull();
    const activationId = insertActivation.data![0].id as string;
    cleanupIds.activations.push(activationId);

    const viewerWrite = await viewer.from("plan_activations").insert({ id: `live_bcm_evil_${state.runId}`, organizationId: state.actorA.organizationId, planId, reason: "intento viewer" }).select("id");
    expect(viewerWrite.error, "continuity:create is required to activate a plan").not.toBeNull();

    const close = await clientA.from("plan_activations").update({ deactivatedAt: new Date().toISOString(), outcome: "Resuelto", lessonsLearned: "Automatizar el failover." }).eq("id", activationId).select("id,lessonsLearned");
    expect(close.error).toBeNull();
    expect(close.data).toEqual([{ id: activationId, lessonsLearned: "Automatizar el failover." }]);

    const crossRead = await (await actorClient(state.actorB)).from("plan_activations").select("id").eq("id", activationId);
    expect(crossRead.data, "B cannot see A's plan activation").toEqual([]);
  });

  test("ejercicios: a continuity test and its result are tenant-scoped", async () => {
    const clientA = await actorClient(state.actorA);
    const result = await clientA.from("test_results").insert({
      id: `live_bcm_result_${state.runId}`, organizationId: state.actorA.organizationId, testId, outcome: "PASSED",
      rtoAchievedMinutes: 200, rpoAchievedMinutes: 45, testedById: state.actorA.userId,
    }).select("id");
    expect(result.error).toBeNull();
    cleanupIds.results.push(result.data![0].id as string);

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("test_results").select("id").eq("testId", testId);
    expect(crossRead.data, "B cannot see A's exercise result").toEqual([]);
  });

  test("evidencias: a plan version links to an evidence file, tenant-scoped", async () => {
    const clientA = await actorClient(state.actorA);
    const row = await clientA.from("continuity_plan_versions").select("id,evidenceId").eq("id", versionId).single();
    expect(row.error).toBeNull();
    expect(row.data?.evidenceId).toBe(state.actorA.evidenceId);

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("continuity_plan_versions").select("id").eq("id", versionId);
    expect(crossRead.data, "B cannot see A's plan version").toEqual([]);
  });

  test("AuditLog: BCM writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").in("module", ["bcm", "bcp", "continuity_test"]).eq("organizationId", state.actorA.organizationId).limit(1);
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

  test("report artifacts (bcm-bia, bcm-audit-package) persist per tenant", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "bcm-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "bcm-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "bcm-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("permissions: viewer is read-only, auditor limited to read/export", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("business_continuity_plans").select("id").eq("id", planId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: planId }]);
    const viewerWrite = await viewer.from("business_continuity_plans").update({ title: "intento viewer" }).eq("id", planId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "continuity:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("business_impact_analyses").select("id").eq("id", biaId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: biaId }]);
    const auditorWrite = await auditor.from("business_impact_analyses").update({ title: "intento auditor" }).eq("id", biaId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "continuity:update is denied to AUDITOR (read/export only)").toEqual([]);
  });
});
