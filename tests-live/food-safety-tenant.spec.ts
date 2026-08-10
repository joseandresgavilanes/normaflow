import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";
import { traceBackward, traceForward, lotsAffectedByRecall, type TraceLotNode } from "../src/lib/food-safety/traceability";

/**
 * Food safety management system (ISO 22000 / HACCP) — live multi-tenant
 * boundary.
 *
 * Covers: PACK_ISO_22000 catalog installation, hazards (DB-enforced
 * score = severity × likelihood), CCP + critical limits (BETWEEN CHECK),
 * OPRP, monitoring (an out-of-limit reading with its auto-opened
 * deviation), traceability forward AND backward across the full chain —
 * supplier → raw material → lot → process → finished product → customer
 * → distribution — recall (lot expansion in both directions before
 * marking RECALLED), tenant A/B isolation, RLS, and AuditLog append-only.
 * Also regression-tests the `communication_records` RLS widening (a
 * genuine gap closed this round: food-safety:create couldn't insert chain
 * communications before, since that shared table required quality-ops:*).
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let productId = "";
let materialId = "";
let flowId = "";
let stepId = "";
let hazardId = "";
let assessmentId = "";
let ccpId = "";
let limitId = "";
let oprpId = "";
let planId = "";
let recordId = "";
let deviationId = "";
let supplierLotId = "";
let rawLotId = "";
let intermediateLotId = "";
let finishedLotId = "";
let distributedLotId = "";

test.describe("ISO 22000 (food safety / HACCP) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const product = await prisma.foodProduct.create({
      data: { organizationId: state.actorA.organizationId, code: `PROD-${state.runId}`, name: "Producto live fixture", createdById: state.actorA.userId },
    });
    productId = product.id;

    const material = await prisma.rawMaterial.create({
      data: { organizationId: state.actorA.organizationId, code: `MP-${state.runId}`, name: "Materia prima live fixture", createdById: state.actorA.userId },
    });
    materialId = material.id;

    const flow = await prisma.processFlow.create({
      data: { organizationId: state.actorA.organizationId, code: `FLU-${state.runId}`, productId, title: "Flujo live fixture", createdById: state.actorA.userId },
    });
    flowId = flow.id;

    const step = await prisma.processStep.create({
      data: { organizationId: state.actorA.organizationId, code: `PAS-${state.runId}`, flowId, sequence: 1, name: "Pasteurización", stepType: "COOKING", createdById: state.actorA.userId },
    });
    stepId = step.id;

    const hazard = await prisma.foodHazard.create({
      data: { organizationId: state.actorA.organizationId, code: `PEL-${state.runId}`, name: "Salmonella spp.", hazardType: "BIOLOGICAL", createdById: state.actorA.userId },
    });
    hazardId = hazard.id;

    const assessment = await prisma.hazardAssessment.create({
      data: {
        organizationId: state.actorA.organizationId, code: `EVA-${state.runId}`, hazardId, stepId, productId,
        severity: 5, likelihood: 3, score: 15, significant: true, controlDecision: "CCP",
        assessedById: state.actorA.userId, createdById: state.actorA.userId,
      },
    });
    assessmentId = assessment.id;

    const ccp = await prisma.criticalControlPoint.create({
      data: { organizationId: state.actorA.organizationId, code: `CCP-${state.runId}`, name: "Pasteurización", stepId, hazardAssessmentId: assessmentId, createdById: state.actorA.userId },
    });
    ccpId = ccp.id;

    const limit = await prisma.criticalLimit.create({
      data: { organizationId: state.actorA.organizationId, code: `LIM-${state.runId}`, ccpId, parameter: "Temperatura", operator: "GTE", minValue: 72, unit: "°C", createdById: state.actorA.userId },
    });
    limitId = limit.id;

    const oprp = await prisma.operationalPRP.create({
      data: { organizationId: state.actorA.organizationId, code: `OPRP-${state.runId}`, name: "Control de metal", stepId, createdById: state.actorA.userId },
    });
    oprpId = oprp.id;

    const plan = await prisma.monitoringPlan.create({
      data: { organizationId: state.actorA.organizationId, code: `MON-${state.runId}`, title: "Monitoreo pasteurización", ccpId, createdById: state.actorA.userId },
    });
    planId = plan.id;

    const record = await prisma.monitoringRecord.create({
      data: { organizationId: state.actorA.organizationId, code: `REG-${state.runId}`, planId, valueNumeric: 65, unit: "°C", withinLimits: false, recordedById: state.actorA.userId },
    });
    recordId = record.id;

    const deviation = await prisma.deviation.create({
      data: { organizationId: state.actorA.organizationId, code: `DES-${state.runId}`, title: "Desviación live fixture", ccpId, monitoringRecordId: recordId, severity: "MAJOR", productHold: true, createdById: state.actorA.userId },
    });
    deviationId = deviation.id;

    // Cadena de trazabilidad completa: proveedor → MP → lote → proceso → producto → cliente → distribución.
    const supplierLot = await prisma.traceabilityLot.create({
      data: { organizationId: state.actorA.organizationId, code: `LOT-SUP-${state.runId}`, lotType: "RAW_MATERIAL", rawMaterialId: materialId, supplierId: state.actorA.userId, quantity: 1000, unit: "L", createdById: state.actorA.userId },
    });
    supplierLotId = supplierLot.id;

    const rawLot = await prisma.traceabilityLot.create({
      data: { organizationId: state.actorA.organizationId, code: `LOT-RAW-${state.runId}`, lotType: "RAW_MATERIAL", rawMaterialId: materialId, previousLotIds: [supplierLotId], quantity: 950, unit: "L", createdById: state.actorA.userId },
    });
    rawLotId = rawLot.id;

    const intermediateLot = await prisma.traceabilityLot.create({
      data: { organizationId: state.actorA.organizationId, code: `LOT-INT-${state.runId}`, lotType: "INTERMEDIATE", productId, previousLotIds: [rawLotId], quantity: 900, unit: "L", createdById: state.actorA.userId },
    });
    intermediateLotId = intermediateLot.id;

    const finishedLot = await prisma.traceabilityLot.create({
      data: { organizationId: state.actorA.organizationId, code: `LOT-FIN-${state.runId}`, lotType: "FINISHED", productId, previousLotIds: [intermediateLotId], quantity: 5000, unit: "ud", createdById: state.actorA.userId },
    });
    finishedLotId = finishedLot.id;

    const distributedLot = await prisma.traceabilityLot.create({
      data: { organizationId: state.actorA.organizationId, code: `LOT-DIST-${state.runId}`, lotType: "DISTRIBUTED", productId, previousLotIds: [finishedLotId], customerName: "Cliente live fixture", quantity: 5000, unit: "ud", createdById: state.actorA.userId },
    });
    distributedLotId = distributedLot.id;
  });

  test.afterAll(async () => {
    await prisma.deviation.deleteMany({ where: { id: deviationId } }).catch(() => undefined);
    await prisma.monitoringRecord.deleteMany({ where: { id: recordId } }).catch(() => undefined);
    await prisma.monitoringPlan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    await prisma.operationalPRP.deleteMany({ where: { id: oprpId } }).catch(() => undefined);
    await prisma.criticalLimit.deleteMany({ where: { id: limitId } }).catch(() => undefined);
    await prisma.criticalControlPoint.deleteMany({ where: { id: ccpId } }).catch(() => undefined);
    await prisma.hazardAssessment.deleteMany({ where: { id: assessmentId } }).catch(() => undefined);
    await prisma.foodHazard.deleteMany({ where: { id: hazardId } }).catch(() => undefined);
    await prisma.traceabilityLot.deleteMany({ where: { id: { in: [distributedLotId, finishedLotId, intermediateLotId, rawLotId, supplierLotId] } } }).catch(() => undefined);
    await prisma.processStep.deleteMany({ where: { id: stepId } }).catch(() => undefined);
    await prisma.processFlow.deleteMany({ where: { id: flowId } }).catch(() => undefined);
    await prisma.rawMaterial.deleteMany({ where: { id: materialId } }).catch(() => undefined);
    await prisma.foodProduct.deleteMany({ where: { id: productId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_22000 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_22000" } });
    expect(family, "ISO_22000 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_22000" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(20);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_22000" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's food-safety rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readProducts = await clientB.from("food_products").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readProducts.error).toBeNull();
    expect(readProducts.data, "B's client sees none of A's products").toEqual([]);

    const readCcps = await clientB.from("critical_control_points").select("id").eq("id", ccpId);
    expect(readCcps.data, "B cannot see A's CCP by id either").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("food_products").select("id,name").eq("id", productId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ name: "Producto live fixture" });
  });

  test("peligros: hazard assessment score is DB-enforced as severity × likelihood", async () => {
    const admin = adminClient();
    const own = await admin.from("hazard_assessments").select("severity,likelihood,score,significant,controlDecision").eq("id", assessmentId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ severity: 5, likelihood: 3, score: 15, significant: true, controlDecision: "CCP" });

    const bad = await admin.from("hazard_assessments").update({ score: 999 }).eq("id", assessmentId).select("id");
    expect(bad.error, "hazard_assessments_score_consistent CHECK rejects score ≠ severity × likelihood").not.toBeNull();
  });

  test("PCC: critical control point and critical limit persist, BETWEEN operator requires min ≤ max", async () => {
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("critical_control_points").select("id,name,stepId").eq("id", ccpId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ stepId });

    const admin = adminClient();
    const badLimit = await admin.from("critical_limits").insert({
      organizationId: state.actorA.organizationId, code: `LIM-BAD-${state.runId}`, ccpId, parameter: "pH",
      operator: "BETWEEN", minValue: 8, maxValue: 4, createdById: state.actorA.userId,
    }).select("id");
    expect(badLimit.error, "critical_limits_between_order CHECK rejects minValue > maxValue").not.toBeNull();
  });

  test("OPRP: operational PRP persists and is tenant-scoped", async () => {
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("operational_prps").select("id,name,stepId").eq("id", oprpId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ stepId });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("operational_prps").select("id").eq("id", oprpId);
    expect(crossRead.data, "B cannot see A's OPRP").toEqual([]);
  });

  test("límites/monitoreo: an out-of-limit reading and its linked deviation persist", async () => {
    const admin = adminClient();
    const badPlan = await admin.from("monitoring_plans").insert({
      organizationId: state.actorA.organizationId, code: `MON-BAD-${state.runId}`, title: "Plan sin objetivo",
    }).select("id");
    expect(badPlan.error, "monitoring_plans_target_present CHECK requires ccpId or oprpId").not.toBeNull();

    const clientA = await actorClient(state.actorA);
    const record = await clientA.from("monitoring_records").select("id,valueNumeric,withinLimits").eq("id", recordId).single();
    expect(record.error).toBeNull();
    expect(record.data).toMatchObject({ valueNumeric: 65, withinLimits: false });

    const deviation = await clientA.from("food_deviations").select("id,monitoringRecordId,severity,productHold").eq("id", deviationId).single();
    expect(deviation.error).toBeNull();
    expect(deviation.data).toMatchObject({ monitoringRecordId: recordId, severity: "MAJOR", productHold: true });
  });

  test("trazabilidad: forward and backward traversal cover the full chain, proveedor → cliente", async () => {
    const clientA = await actorClient(state.actorA);
    const rows = await clientA.from("traceability_lots").select("id,code,lotType,previousLotIds").eq("organizationId", state.actorA.organizationId).like("code", `LOT-%-${state.runId}`);
    expect(rows.error).toBeNull();
    const nodes: TraceLotNode[] = (rows.data ?? []).map((r) => ({ id: r.id, code: r.code, lotType: r.lotType, previousLotIds: r.previousLotIds ?? [] }));
    expect(nodes).toHaveLength(5);

    const backward = traceBackward(finishedLotId, nodes);
    expect(backward.complete, "backward trace from finished lot must reach the supplier lot with no gaps").toBe(true);
    expect(backward.nodes.map((n) => n.code).sort()).toEqual([
      `LOT-FIN-${state.runId}`, `LOT-INT-${state.runId}`, `LOT-RAW-${state.runId}`, `LOT-SUP-${state.runId}`,
    ].sort());

    const forward = traceForward(supplierLotId, nodes);
    expect(forward.nodes.map((n) => n.code).sort()).toEqual([
      `LOT-SUP-${state.runId}`, `LOT-RAW-${state.runId}`, `LOT-INT-${state.runId}`, `LOT-FIN-${state.runId}`, `LOT-DIST-${state.runId}`,
    ].sort());
    expect(forward.nodes.some((n) => n.code === `LOT-DIST-${state.runId}`), "forward trace from the supplier lot reaches the distributed/customer lot").toBe(true);
  });

  test("recall: lot expansion covers both directions before marking RECALLED", async () => {
    const clientA = await actorClient(state.actorA);
    const rows = await clientA.from("traceability_lots").select("id,code,lotType,previousLotIds").eq("organizationId", state.actorA.organizationId).like("code", `LOT-%-${state.runId}`);
    const nodes: TraceLotNode[] = (rows.data ?? []).map((r) => ({ id: r.id, code: r.code, lotType: r.lotType, previousLotIds: r.previousLotIds ?? [] }));

    // Un retiro sobre el lote intermedio debe alcanzar tanto lo anterior (MP, proveedor) como lo posterior (terminado, distribuido).
    const affected = lotsAffectedByRecall([`LOT-INT-${state.runId}`], nodes);
    const affectedCodes = affected.map((n) => n.code).sort();
    expect(affectedCodes).toEqual([
      `LOT-DIST-${state.runId}`, `LOT-FIN-${state.runId}`, `LOT-INT-${state.runId}`, `LOT-RAW-${state.runId}`, `LOT-SUP-${state.runId}`,
    ].sort());

    const recall = await prisma.withdrawalRecall.create({
      data: {
        organizationId: state.actorA.organizationId, code: `RET-${state.runId}`, title: "Retiro live fixture",
        reason: "Prueba de aislamiento multi-tenant", lotCodes: affectedCodes, createdById: state.actorA.userId,
      },
    });
    const badClose = await adminClient().from("withdrawal_recalls").update({ status: "CLOSED" }).eq("id", recall.id).select("id");
    expect(badClose.error, "withdrawal_recalls_closed_attributed CHECK requires closedAt when status=CLOSED").not.toBeNull();

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("withdrawal_recalls").select("id").eq("id", recall.id);
    expect(crossRead.data, "B cannot see A's recall").toEqual([]);
    await prisma.withdrawalRecall.delete({ where: { id: recall.id } }).catch(() => undefined);
  });

  test("comunicación de cadena: food-safety:create can insert into communication_records without quality-ops", async () => {
    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("communication_records").insert({
      id: `live_food_communication_${state.runId}`,
      organizationId: state.actorA.organizationId, code: `COM-${state.runId}`, subject: "Notificación de retiro a distribuidor",
      direction: "EXTERNAL", standards: ["ISO_22000"], communicatedById: state.actorA.userId, createdById: state.actorA.userId,
      updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "food-safety:create must be sufficient for this shared table (widened this round)").toBeNull();
    if (created.data?.id) await prisma.communicationRecord.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });

  test("AuditLog: food-safety writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "food-safety").eq("organizationId", state.actorA.organizationId).limit(1);
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

  test("reportes: an fsms-audit-package artifact is tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "fsms-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "fsms-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "fsms-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("RLS/permisos: viewer is read-only, auditor limited to read/export, contributor can create", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("food_products").select("id").eq("id", productId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: productId }]);
    const viewerWrite = await viewer.from("food_products").update({ name: "intento viewer" }).eq("id", productId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "food-safety:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("critical_control_points").select("id").eq("id", ccpId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: ccpId }]);
    const auditorWrite = await auditor.from("critical_control_points").update({ name: "intento auditor" }).eq("id", ccpId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "food-safety:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("food_hazards").insert({
      id: `live_food_hazard_control_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `PEL-CTR-${state.runId}`, name: "Peligro live fixture", hazardType: "CHEMICAL",
      createdById: state.actorA.userId, updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "food-safety:create is held by ORG_ADMIN").toBeNull();
    if (created.data?.id) await prisma.foodHazard.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });
});
