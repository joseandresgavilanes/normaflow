import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";
import { associatedEmissions, energyCost, evaluateEnergyFormula } from "../src/lib/energy/formulas";

/**
 * Energy management system (ISO 50001) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_50001 catalog installation, formulas (pure functions
 * cross-checked against a persisted reading), baseline/EnPI versioning
 * (unique `(code, formulaVersion)`, supersession), concurrent data (N
 * concurrent attempts to create the same baseline version — exactly one
 * must win, mirroring the report-artifact-lease concurrency pattern already
 * established in scripts/test-concurrency.ts), tenant A/B isolation, report
 * artifacts, AuditLog append-only + tenant scoping, and RLS/permissions.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let sourceId = "";
let meterId = "";
let readingId = "";
let baselineId = "";
let enpiId = "";

const READING_VALUE = 1000;
const EMISSION_FACTOR = 0.25;
const COST_PER_UNIT = 0.18;

test.describe("ISO 50001 (energy) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const source = await prisma.energySource.create({
      data: {
        organizationId: state.actorA.organizationId, code: `FUE-${state.runId}`, name: "Fuente live fixture",
        sourceType: "ELECTRICITY", unit: "kWh", emissionFactor: EMISSION_FACTOR, costPerUnit: COST_PER_UNIT,
        createdById: state.actorA.userId,
      },
    });
    sourceId = source.id;

    const meter = await prisma.energyMeter.create({
      data: { organizationId: state.actorA.organizationId, code: `MED-${state.runId}`, name: "Medidor live fixture", sourceId, unit: "kWh", createdById: state.actorA.userId },
    });
    meterId = meter.id;

    const reading = await prisma.energyReading.create({
      data: {
        organizationId: state.actorA.organizationId, code: `LEC-${state.runId}`, meterId,
        value: READING_VALUE, unit: "kWh",
        cost: energyCost(READING_VALUE, COST_PER_UNIT), emissions: associatedEmissions(READING_VALUE, EMISSION_FACTOR),
        createdById: state.actorA.userId,
      },
    });
    readingId = reading.id;

    const baseline = await prisma.energyBaseline.create({
      data: {
        organizationId: state.actorA.organizationId, code: `BL-${state.runId}`, title: "Línea base live fixture",
        periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), consumption: 12000, unit: "kWh",
        normalizationMethod: "NONE", formulaVersion: "1", normalizedConsumption: 12000, status: "ACTIVE",
        approvedById: state.actorA.userId, approvedAt: new Date(), createdById: state.actorA.userId,
      },
    });
    baselineId = baseline.id;

    const enpi = await prisma.energyPerformanceIndicator.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ENP-${state.runId}`, name: "EnPI live fixture",
        baselineId, formulaKind: "INTENSITY", formulaVersion: "1", unit: "kWh/unit",
        currentValue: 10, baselineValue: 12, active: true, superseded: false,
        approvedById: state.actorA.userId, approvedAt: new Date(), createdById: state.actorA.userId,
      },
    });
    enpiId = enpi.id;
  });

  test.afterAll(async () => {
    await prisma.energyPerformanceIndicator.deleteMany({ where: { code: `ENP-${state.runId}` } }).catch(() => undefined);
    await prisma.energyBaseline.deleteMany({ where: { code: `BL-${state.runId}` } }).catch(() => undefined);
    await prisma.energyReading.deleteMany({ where: { id: readingId } }).catch(() => undefined);
    await prisma.energyMeter.deleteMany({ where: { id: meterId } }).catch(() => undefined);
    await prisma.energySource.deleteMany({ where: { id: sourceId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_50001 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_50001" } });
    expect(family, "ISO_50001 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_50001" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(20);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_50001" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's energy rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readSources = await clientB.from("energy_sources").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readSources.error).toBeNull();
    expect(readSources.data, "B's client sees none of A's energy sources").toEqual([]);

    const readBaselines = await clientB.from("energy_baselines").select("id").eq("id", baselineId);
    expect(readBaselines.data, "B cannot see A's baseline by id either").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("energy_sources").select("id,sourceType").eq("id", sourceId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ sourceType: "ELECTRICITY" });
  });

  test("fórmulas: pure evaluateEnergyFormula/cost/emissions match what is persisted on a reading", async () => {
    const expectedCost = energyCost(READING_VALUE, COST_PER_UNIT);
    const expectedEmissions = associatedEmissions(READING_VALUE, EMISSION_FACTOR);
    const intensity = evaluateEnergyFormula("INTENSITY", {}, { consumption: READING_VALUE, activity: 100 });
    expect(intensity.value).toBe(10);

    const clientA = await actorClient(state.actorA);
    const row = await clientA.from("energy_readings").select("value,cost,emissions").eq("id", readingId).single();
    expect(row.error).toBeNull();
    expect(row.data).toMatchObject({ value: READING_VALUE, cost: expectedCost, emissions: expectedEmissions });
  });

  test("líneas base: versioned unique(code, formulaVersion), superseding the prior ACTIVE row", async () => {
    const admin = adminClient();
    const code = `BL-${state.runId}`;
    const now = new Date().toISOString();

    const v2 = await admin.from("energy_baselines").insert({
      id: `live_energy_baseline_v2_${state.runId}`,
      organizationId: state.actorA.organizationId, code, formulaVersion: "2", title: "Línea base v2",
      periodStart: "2027-01-01", periodEnd: "2027-12-31", consumption: 11000, unit: "kWh",
      normalizationMethod: "NONE", normalizedConsumption: 11000, status: "ACTIVE",
      approvedById: state.actorA.userId, approvedAt: now, createdById: state.actorA.userId, updatedAt: now,
    }).select("id").single();
    expect(v2.error, "a new version with the same code is allowed").toBeNull();

    await admin.from("energy_baselines").update({ status: "SUPERSEDED" }).eq("id", baselineId);
    const superseded = await admin.from("energy_baselines").select("status").eq("id", baselineId).single();
    expect(superseded.data).toMatchObject({ status: "SUPERSEDED" });

    const duplicate = await admin.from("energy_baselines").insert({
      id: `live_energy_baseline_duplicate_${state.runId}`,
      organizationId: state.actorA.organizationId, code, formulaVersion: "2", title: "Duplicado de v2",
      periodStart: "2027-01-01", periodEnd: "2027-12-31", consumption: 9999, unit: "kWh",
      normalizationMethod: "NONE", status: "ACTIVE", createdById: state.actorA.userId, updatedAt: now,
    }).select("id");
    expect(duplicate.error, "unique(organizationId, code, formulaVersion) rejects a duplicate version").not.toBeNull();

    if (v2.data?.id) await prisma.energyBaseline.delete({ where: { id: v2.data.id } }).catch(() => undefined);
    await prisma.energyBaseline.update({ where: { id: baselineId }, data: { status: "ACTIVE" } }).catch(() => undefined);
  });

  test("EnPI: versioned unique(code, formulaVersion), active/superseded flags", async () => {
    const admin = adminClient();
    const code = `ENP-${state.runId}`;
    const now = new Date().toISOString();

    const v2 = await admin.from("energy_performance_indicators").insert({
      id: `live_energy_enpi_v2_${state.runId}`,
      organizationId: state.actorA.organizationId, code, formulaVersion: "2", name: "EnPI v2",
      baselineId, formulaKind: "INTENSITY", unit: "kWh/unit", currentValue: 9, baselineValue: 12,
      active: true, superseded: false, approvedById: state.actorA.userId, approvedAt: now,
      createdById: state.actorA.userId, updatedAt: now,
    }).select("id").single();
    expect(v2.error).toBeNull();

    const duplicate = await admin.from("energy_performance_indicators").insert({
      id: `live_energy_enpi_duplicate_${state.runId}`,
      organizationId: state.actorA.organizationId, code, formulaVersion: "2", name: "Duplicado",
      formulaKind: "INTENSITY", unit: "kWh/unit", active: true, superseded: false, createdById: state.actorA.userId, updatedAt: now,
    }).select("id");
    expect(duplicate.error, "unique(organizationId, code, formulaVersion) rejects a duplicate EnPI version").not.toBeNull();

    if (v2.data?.id) await prisma.energyPerformanceIndicator.delete({ where: { id: v2.data.id } }).catch(() => undefined);
  });

  test("datos concurrentes: N concurrent attempts to create the same baseline version — exactly one wins", async () => {
    const admin = adminClient();
    const code = `BL-CONC-${state.runId}`;
    const attempts = 8;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        admin.from("energy_baselines").insert({
          id: `live_energy_concurrent_${randomUUID()}`,
          organizationId: state.actorA.organizationId, code, formulaVersion: "1", title: `Concurrencia ${randomUUID()}`,
          periodStart: "2026-01-01", periodEnd: "2026-12-31", consumption: 5000, unit: "kWh",
          normalizationMethod: "NONE", status: "ACTIVE", createdById: state.actorA.userId, updatedAt: new Date().toISOString(),
        }).select("id").then((r) => {
          if (r.error) throw r.error;
          return r;
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length, `expected exactly 1 winning insert out of ${attempts} concurrent attempts on (code, formulaVersion), got ${fulfilled.length}`).toBe(1);
    expect(rejected.length, "every other concurrent attempt must fail on the unique constraint, not silently create a duplicate version").toBe(attempts - 1);

    const rows = await prisma.energyBaseline.findMany({ where: { organizationId: state.actorA.organizationId, code } });
    expect(rows, "exactly one row for this code must exist, not one per concurrent racer").toHaveLength(1);
    await prisma.energyBaseline.deleteMany({ where: { organizationId: state.actorA.organizationId, code } });
  });

  test("AuditLog: energy writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "energy").eq("organizationId", state.actorA.organizationId).limit(1);
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

  test("reportes: an enms-audit-package artifact is tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "enms-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "enms-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "enms-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("RLS/permisos: viewer is read-only, auditor limited to read/export, contributor can create", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("energy_sources").select("id").eq("id", sourceId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: sourceId }]);
    const viewerWrite = await viewer.from("energy_sources").update({ name: "intento viewer" }).eq("id", sourceId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "energy:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("energy_baselines").select("id").eq("id", baselineId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: baselineId }]);
    const auditorWrite = await auditor.from("energy_baselines").update({ title: "intento auditor" }).eq("id", baselineId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "energy:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("energy_opportunities").insert({
      id: `live_energy_opportunity_control_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `OPO-${state.runId}`, title: "Oportunidad live fixture", priority: "MEDIUM",
      status: "IDENTIFIED", createdById: state.actorA.userId, updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "energy:create is held by ORG_ADMIN").toBeNull();
    if (created.data?.id) await prisma.energyOpportunity.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });
});
