/**
 * ISO 50001 energy management system — integration test.
 *
 * Pure formula/workflow checks always run. DB checks require a disposable Postgres.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-energy.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import {
  absoluteSaving,
  associatedEmissions,
  baselineComparison,
  consumptionByPeriod,
  deviationPercent,
  energyCost,
  energyIntensity,
  evaluateEnergyFormula,
  isSignificantEnergyUse,
  normalizeConsumption,
  normalizedSaving,
} from "../src/lib/energy/formulas";
import { assertEnergyReviewApproval, assertEnergyReviewTransition, nextEnergyReviewStatuses } from "../src/lib/energy/review";

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
  console.log("ISO 50001 energy management system integration test\n");

  await t("formulas: consumption, intensity, baseline, deviation, savings, cost, emissions", async () => {
    assert.equal(consumptionByPeriod([10, 20, 5.5]), 35.5);
    assert.equal(energyIntensity(1000, 50), 20);
    assert.throws(() => energyIntensity(1000, 0), /actividad|denominador/i);
    assert.equal(baselineComparison(110, 100), 1.1);
    assert.equal(deviationPercent(110, 100), 10);
    assert.equal(absoluteSaving(100, 85), 15);
    assert.equal(energyCost(100, 0.14), 14);
    assert.equal(associatedEmissions(1000, 0.00025), 0.25);
    assert.equal(isSignificantEnergyUse({ consumptionShare: 12 }), true);
    assert.equal(isSignificantEnergyUse({ consumptionShare: 5, improvementPotential: 2 }), false);
  });

  await t("normalization RATIO / LINEAR and versioned evaluateEnergyFormula", async () => {
    const ratio = normalizeConsumption(1000, { normalizationMethod: "RATIO", variableKey: "production" }, {
      relevantVariables: { production: 80 }, activity: 100,
    });
    assert.equal(ratio, 1250);
    const linear = normalizeConsumption(1000, { normalizationMethod: "LINEAR", intercept: 100, slope: 2, variableKey: "x" }, {
      relevantVariables: { x: 50 }, activity: 40,
    });
    assert.equal(linear, 980);
    // Misma intensidad: ahorro normalizado ~0. Con mejora real a igual producción: >0.
    const flat = normalizedSaving(1000, 900, { normalizationMethod: "RATIO", variableKey: "production" }, {
      relevantVariables: { production: 100 }, activity: 100,
    }, {
      relevantVariables: { production: 90 }, activity: 100,
    });
    assert.ok(Math.abs(flat) < 0.01);
    const normSave = normalizedSaving(1000, 850, { normalizationMethod: "RATIO", variableKey: "production" }, {
      relevantVariables: { production: 100 }, activity: 100,
    }, {
      relevantVariables: { production: 90 }, activity: 100,
    });
    assert.ok(normSave > 50);
    const enpi = evaluateEnergyFormula("INTENSITY", { activity: 50 }, { consumption: 1000, activity: 50 }, "3");
    assert.equal(enpi.value, 20);
    assert.equal(enpi.formulaVersion, "3");
    const savings = evaluateEnergyFormula("ABSOLUTE_SAVINGS", {}, { consumption: 90, baselineConsumption: 100 });
    assert.equal(savings.value, 10);
  });

  await t("energy review workflow graph", async () => {
    assert.deepEqual(nextEnergyReviewStatuses("DRAFT"), ["IN_PROGRESS"]);
    assertEnergyReviewTransition("IN_PROGRESS", "UNDER_REVIEW");
    assert.throws(() => assertEnergyReviewTransition("DRAFT", "APPROVED"), /Transición/);
    assert.throws(() => assertEnergyReviewApproval({ approvedById: null }), /quién/);
  });

  if (!prisma) {
    console.log(`\n${passed} pure checks passed (DB skipped — set disposable DATABASE_URL for full suite).`);
    return;
  }

  await t("ISO 50001 pack installs (family, EnPI clause, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_50001" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-50001-6.3" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-50001-6.4" } }));
    const map = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-50001-9.2",
          targetRequirementId: "cl-9001-9.2",
        },
      },
    });
    assert.ok(map && map.relationType === "EQUIVALENT");
  });

  const org = await prisma.organization.upsert({
    where: { slug: "enms-a" },
    update: {},
    create: { name: "EnmsA", slug: "enms-a", plan: "GROWTH" },
  });
  const owner = await prisma.user.upsert({
    where: { email: "enms-owner@x.com" },
    update: {},
    create: { email: "enms-owner@x.com", name: "Ana Energía" },
  });

  await t("source → use → SEU → baseline versioned persist", async () => {
    const source = await prisma.energySource.create({
      data: {
        organizationId: org.id, code: "FUE-0001", name: "Red", sourceType: "ELECTRICITY",
        emissionFactor: 0.0002, costPerUnit: 0.12, createdById: owner.id,
      },
    });
    const use = await prisma.energyUse.create({
      data: {
        organizationId: org.id, code: "USO-0001", name: "Hornos", sourceId: source.id,
        annualEstimate: 100000, createdById: owner.id,
      },
    });
    const review = await prisma.energyReview.create({
      data: {
        organizationId: org.id, code: "REV-0001", title: "Revisión 2026",
        periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"),
        status: "IN_PROGRESS", createdById: owner.id,
      },
    });
    const seu = await prisma.significantEnergyUse.create({
      data: {
        organizationId: org.id, code: "SEU-0001", energyUseId: use.id, reviewId: review.id,
        consumptionShare: 40, significant: true, createdById: owner.id,
      },
    });
    await prisma.energyBaseline.create({
      data: {
        organizationId: org.id, code: "BL-0001", title: "Base v1", seuId: seu.id,
        periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31"),
        consumption: 1000, normalizationMethod: "NONE", formulaVersion: "1",
        status: "SUPERSEDED", createdById: owner.id,
      },
    });
    const bl2 = await prisma.energyBaseline.create({
      data: {
        organizationId: org.id, code: "BL-0001", title: "Base v2", seuId: seu.id,
        periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31"),
        consumption: 1000, normalizationMethod: "RATIO", formulaVersion: "2",
        formulaConfig: { normalizationMethod: "RATIO", variableKey: "production" },
        status: "ACTIVE", approvedById: owner.id, approvedAt: new Date(), createdById: owner.id,
      },
    });
    assert.equal(bl2.formulaVersion, "2");
  });

  await t("CHECK: review APPROVED without approver is rejected", async () => {
    const review = await prisma.energyReview.findFirst({ where: { organizationId: org.id, code: "REV-0001" } });
    assert.ok(review);
    await assert.rejects(
      prisma.energyReview.update({
        where: { id: review.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      }),
      (error: unknown) => isCheckViolation(error, "energy_reviews_approval_attributed"),
    );
    await prisma.energyReview.update({
      where: { id: review.id },
      data: { status: "APPROVED", approvedById: owner.id, approvedAt: new Date() },
    });
  });

  await t("CHECK: verification VERIFIED without verifier is rejected", async () => {
    const plan = await prisma.energyActionPlan.create({
      data: {
        organizationId: org.id, code: "PAE-0001", title: "Plan demo",
        status: "IN_PROGRESS", createdById: owner.id,
      },
    });
    await assert.rejects(
      prisma.energySavingVerification.create({
        data: {
          organizationId: org.id, code: "VER-BAD", actionPlanId: plan.id,
          periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-03-31"),
          baselineConsumption: 100, actualConsumption: 80, absoluteSaving: 20,
          status: "VERIFIED", verifiedAt: new Date(),
        },
      }),
      (error: unknown) => isCheckViolation(error, "energy_verifications_verified_attributed"),
    );
    const ok = await prisma.energySavingVerification.create({
      data: {
        organizationId: org.id, code: "VER-0001", actionPlanId: plan.id,
        periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-03-31"),
        baselineConsumption: 100, actualConsumption: 80, absoluteSaving: 20,
        status: "VERIFIED", verifiedById: owner.id, verifiedAt: new Date(),
        formulaKind: "ABSOLUTE_SAVINGS", formulaVersion: "1", createdById: owner.id,
      },
    });
    assert.equal(ok.status, "VERIFIED");
  });

  await t("EnPI unique (code, formulaVersion) allows superseding versions", async () => {
    await prisma.energyPerformanceIndicator.create({
      data: {
        organizationId: org.id, code: "EnPI-0001", name: "Intensidad", formulaKind: "INTENSITY",
        formulaVersion: "1", active: false, superseded: true, createdById: owner.id,
      },
    });
    const v2 = await prisma.energyPerformanceIndicator.create({
      data: {
        organizationId: org.id, code: "EnPI-0001", name: "Intensidad", formulaKind: "INTENSITY",
        formulaVersion: "2", formulaConfig: { activity: 10 }, currentValue: 12,
        active: true, createdById: owner.id,
      },
    });
    assert.equal(v2.formulaVersion, "2");
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((error) => {
    console.error("\nFAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
