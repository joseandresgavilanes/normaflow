/**
 * ISO 22000 / HACCP food safety management — integration test.
 *
 * Pure hazard/monitoring/traceability checks always run. DB checks require a disposable Postgres.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-food-safety.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import { decideControlMeasure, scoreHazard, assertHazardAssessmentApproval } from "../src/lib/food-safety/hazard";
import { assertLimitDefinition, isWithinCriticalLimits } from "../src/lib/food-safety/monitoring";
import { lotsAffectedByRecall, runTraceabilityTest, traceBackward, traceForward } from "../src/lib/food-safety/traceability";

const url = process.env.DATABASE_URL ?? "";
const managed = /supabase|pooler|amazonaws/i.test(url);
const skipDb = !url || managed;
if (managed) {
  console.warn("DATABASE_URL apunta a un entorno gestionado: solo se ejecutan checks puros (sin DB).\n");
}

const prisma = skipDb ? null : new PrismaClient();
let passed = 0;
async function t(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function isCheckViolation(error: unknown, constraint?: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (constraint && message.includes(constraint)) return true;
  return /violates check constraint/i.test(message);
}

async function main() {
  console.log("ISO 22000 / HACCP food safety management integration test\n");

  await t("hazard score and control decision tree", async () => {
    assert.deepEqual(scoreHazard({ severity: 5, likelihood: 3 }), { score: 15, significant: true });
    assert.deepEqual(scoreHazard({ severity: 2, likelihood: 2 }), { score: 4, significant: false });
    assert.equal(decideControlMeasure({ significant: false }), "NONE");
    assert.equal(decideControlMeasure({ significant: true, controlAtStep: true, criticalAndMeasurable: true }), "CCP");
    assert.equal(decideControlMeasure({ significant: true, essentialOperational: true }), "OPRP");
    assert.equal(decideControlMeasure({ significant: true }), "PRP");
    assert.throws(() => assertHazardAssessmentApproval({ assessedById: null }), /quién/);
  });

  await t("critical limits BETWEEN / GTE / LT", async () => {
    assert.equal(isWithinCriticalLimits(72, { operator: "GTE", minValue: 72 }), true);
    assert.equal(isWithinCriticalLimits(71.9, { operator: "GTE", minValue: 72 }), false);
    assert.equal(isWithinCriticalLimits(4.5, { operator: "BETWEEN", minValue: 0, maxValue: 5 }), true);
    assert.equal(isWithinCriticalLimits(5.1, { operator: "BETWEEN", minValue: 0, maxValue: 5 }), false);
    assert.equal(isWithinCriticalLimits(3, { operator: "LT", maxValue: 4 }), true);
    assert.throws(() => assertLimitDefinition({ operator: "BETWEEN", minValue: 5, maxValue: 1 }), /mínimo/);
    assert.throws(() => assertLimitDefinition({ operator: "EQ" }), /objetivo/);
  });

  await t("traceability backward and forward + recall expansion", async () => {
    const lots = [
      { id: "1", code: "LOT-MP", lotType: "RAW_MATERIAL", previousLotIds: [], supplierId: "sup-1" },
      { id: "2", code: "LOT-WIP", lotType: "INTERMEDIATE", previousLotIds: ["1"] },
      { id: "3", code: "LOT-FG", lotType: "FINISHED", previousLotIds: ["2"], customerName: "Cliente A" },
      { id: "4", code: "LOT-DIST", lotType: "DISTRIBUTED", previousLotIds: ["3"], distributionRef: "DESP-1", customerName: "Cliente B" },
    ];
    const back = traceBackward("3", lots);
    assert.equal(back.complete, true);
    assert.deepEqual(back.nodes.map((n) => n.code), ["LOT-FG", "LOT-WIP", "LOT-MP"]);
    const fwd = traceForward("1", lots);
    assert.deepEqual(fwd.nodes.map((n) => n.code).sort(), ["LOT-DIST", "LOT-FG", "LOT-MP", "LOT-WIP"].sort());
    const test = runTraceabilityTest({ rootIdOrCode: "LOT-FG", lots });
    assert.equal(test.ok, true);
    assert.ok(test.backward.nodes.length >= 3);
    assert.ok(test.forward.nodes.length >= 1);
    const affected = lotsAffectedByRecall(["LOT-FG"], lots);
    assert.ok(affected.some((l) => l.code === "LOT-MP"));
    assert.ok(affected.some((l) => l.code === "LOT-DIST"));
  });

  if (!prisma) {
    console.log(`\n${passed} pure checks passed (DB skipped — set disposable DATABASE_URL for full suite).`);
    return;
  }

  await t("ISO 22000 pack installs (family, HACCP clauses, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_22000" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-22000-8.5" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-22000-8.3" } }));
    const map = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-22000-9.2",
          targetRequirementId: "cl-9001-9.2",
        },
      },
    });
    assert.ok(map && map.relationType === "EQUIVALENT");
  });

  const org = await prisma.organization.upsert({
    where: { slug: "test-fsms-org" },
    update: {},
    create: { name: "FSMS Test Org", slug: "test-fsms-org", plan: "GROWTH" },
  });

  await t("HACCP chain: product → flow → hazard → CCP → limit → monitor → deviation", async () => {
    await prisma.foodProduct.deleteMany({ where: { organizationId: org.id } });
    await prisma.allergen.deleteMany({ where: { organizationId: org.id } });

    const allergen = await prisma.allergen.create({
      data: { organizationId: org.id, code: "ALR-LECHE", name: "Leche", category: "EU-14" },
    });
    const product = await prisma.foodProduct.create({
      data: {
        organizationId: org.id, code: "PROD-1", name: "Yogur",
        allergenCodes: [allergen.code], shelfLifeDays: 28,
      },
    });
    const material = await prisma.rawMaterial.create({
      data: { organizationId: org.id, code: "MP-1", name: "Leche", allergenCodes: [allergen.code] },
    });
    const flow = await prisma.processFlow.create({
      data: { organizationId: org.id, code: "FLU-1", productId: product.id, title: "Flujo", version: "1", status: "APPROVED" },
    });
    const step = await prisma.processStep.create({
      data: { organizationId: org.id, code: "PAS-1", flowId: flow.id, sequence: 1, name: "Pasteurización", stepType: "COOKING" },
    });
    const hazard = await prisma.foodHazard.create({
      data: { organizationId: org.id, code: "PEL-1", name: "Salmonella", hazardType: "BIOLOGICAL" },
    });
    const scored = scoreHazard({ severity: 5, likelihood: 3 });
    const assessment = await prisma.hazardAssessment.create({
      data: {
        organizationId: org.id, code: "EVA-1", hazardId: hazard.id, stepId: step.id, productId: product.id,
        severity: 5, likelihood: 3, score: scored.score, significant: scored.significant,
        controlDecision: "CCP", status: "APPROVED", assessedById: "tester",
      },
    });
    const ccp = await prisma.criticalControlPoint.create({
      data: {
        organizationId: org.id, code: "CCP-1", name: "Pasteurización",
        stepId: step.id, hazardAssessmentId: assessment.id,
      },
    });
    await prisma.criticalLimit.create({
      data: {
        organizationId: org.id, code: "LIM-1", ccpId: ccp.id,
        parameter: "Temperatura", operator: "GTE", minValue: 72, unit: "C",
      },
    });
    const plan = await prisma.monitoringPlan.create({
      data: { organizationId: org.id, code: "MON-1", title: "Monitoreo CCP", ccpId: ccp.id, parameter: "Temperatura" },
    });
    const out = !isWithinCriticalLimits(68, { operator: "GTE", minValue: 72 });
    assert.equal(out, true);
    const record = await prisma.monitoringRecord.create({
      data: {
        organizationId: org.id, code: "REG-1", planId: plan.id,
        valueNumeric: 68, unit: "C", withinLimits: false,
      },
    });
    const deviation = await prisma.deviation.create({
      data: {
        organizationId: org.id, code: "DES-1", title: "Bajo límite",
        ccpId: ccp.id, monitoringRecordId: record.id, severity: "MAJOR", productHold: true,
        lotCodes: ["LOT-FG"],
      },
    });
    await prisma.foodSafetyCorrection.create({
      data: {
        organizationId: org.id, code: "COR-1", deviationId: deviation.id,
        actionTaken: "Reproceso", completedAt: new Date(),
      },
    });

    const lotMp = await prisma.traceabilityLot.create({
      data: {
        organizationId: org.id, code: "LOT-MP", lotType: "RAW_MATERIAL",
        rawMaterialId: material.id, supplierId: null, previousLotIds: [],
      },
    });
    const lotFg = await prisma.traceabilityLot.create({
      data: {
        organizationId: org.id, code: "LOT-FG", lotType: "FINISHED",
        productId: product.id, previousLotIds: [lotMp.id], customerName: "Cliente",
        distributionRef: "DESP-1",
      },
    });
    const allLots = await prisma.traceabilityLot.findMany({ where: { organizationId: org.id } });
    const nodes = allLots.map((l) => ({
      id: l.id, code: l.code, lotType: l.lotType, previousLotIds: l.previousLotIds,
      supplierId: l.supplierId, customerName: l.customerName,
    }));
    const test = runTraceabilityTest({ rootIdOrCode: lotFg.code, lots: nodes });
    assert.equal(test.ok, true);
    assert.ok(test.backward.nodes.some((n) => n.code === "LOT-MP"));

    await prisma.withdrawalRecall.create({
      data: {
        organizationId: org.id, code: "RET-1", title: "Retiro LOT-FG",
        reason: "Desviación CCP", recallType: "WITHDRAWAL", lotCodes: ["LOT-FG"], status: "INITIATED",
      },
    });
    await prisma.foodSafetyEmergency.create({
      data: {
        organizationId: org.id, code: "EME-1", title: "Contaminación potencial",
        emergencyType: "CONTAMINATION", status: "ACTIVE",
      },
    });

    assert.ok(await prisma.prerequisiteProgram.create({
      data: { organizationId: org.id, code: "PRP-1", name: "Higiene", category: "HYGIENE" },
    }));
    assert.ok(await prisma.operationalPRP.create({
      data: { organizationId: org.id, code: "OPRP-1", name: "Metal", stepId: step.id, hazardAssessmentId: assessment.id },
    }));
    assert.ok(await prisma.validationRecord.create({
      data: { organizationId: org.id, code: "VAL-1", title: "Validación CCP", targetType: "CCP", targetCode: "CCP-1", result: "VALID" },
    }));
    assert.ok(await prisma.verificationActivity.create({
      data: { organizationId: org.id, code: "VER-1", title: "Revisión registros", activityType: "RECORD_REVIEW", result: "CONFORMING" },
    }));
  });

  await t("CHECK: hazard score must equal severity × likelihood", async () => {
    const hazard = await prisma.foodHazard.findFirst({ where: { organizationId: org.id } });
    assert.ok(hazard);
    try {
      await prisma.hazardAssessment.create({
        data: {
          organizationId: org.id, code: "EVA-BAD", hazardId: hazard.id,
          severity: 3, likelihood: 3, score: 8, significant: false,
        },
      });
      assert.fail("expected check violation");
    } catch (error) {
      assert.ok(isCheckViolation(error, "hazard_assessments_score_consistent"));
    }
  });

  await t("CHECK: monitoring plan requires CCP or OPRP", async () => {
    try {
      await prisma.monitoringPlan.create({
        data: { organizationId: org.id, code: "MON-BAD", title: "Sin destino" },
      });
      assert.fail("expected check violation");
    } catch (error) {
      assert.ok(isCheckViolation(error, "monitoring_plans_target_present"));
    }
  });

  console.log(`\n${passed} checks passed.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  if (prisma) await prisma.$disconnect();
  process.exit(1);
});
