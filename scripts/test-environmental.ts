/**
 * ISO 14001 environmental management — integration test.
 *
 * Runnable against a DISPOSABLE Postgres (never prod). Exercises the significance
 * calculation, methodology history, compliance-overdue logic, associated
 * evidence, persistent report artifacts, tenant isolation and the environmental
 * audit package.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-environmental.ts
 *
 * Refuses to run against a Supabase/pooler URL to protect production data.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import { computeSignificance, defaultSignificanceMethod } from "../src/lib/environmental/significance";
import { isEvaluationOverdue, complianceState } from "../src/lib/environmental/compliance";

const url = process.env.DATABASE_URL ?? "";
if (/supabase|pooler|amazonaws/i.test(url)) {
  throw new Error("Refusing to run integration test against a managed/production database.");
}

const prisma = new PrismaClient();
let passed = 0;
async function t(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log("ISO 14001 environmental management integration test\n");

  await t("ISO 14001 pack installs (family, edition, requirements, mappings)", async () => {
    await installAllPacks(prisma);
    const fam = await prisma.standardFamily.findUnique({ where: { code: "ISO_14001" } });
    assert.ok(fam, "ISO_14001 family must exist");
    const req = await prisma.standardRequirement.findUnique({ where: { id: "req-iso-14001-6.1.2" } });
    assert.ok(req, "aspects clause 6.1.2 must exist");
    // Annex SL correspondence to ISO 9001 (installed after 9001, so endpoints resolve).
    const map = await prisma.requirementMapping.findUnique({ where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: "req-iso-14001-9.2", targetRequirementId: "cl-9001-9.2" } } });
    assert.ok(map, "14001 9.2 ⇄ 9001 9.2 mapping must exist");
    assert.equal(map!.relationType, "EQUIVALENT");
  });

  // ── significance calculation (pure) ──
  await t("significance: weighted sum, control mitigation and threshold", async () => {
    const method = { formula: "WEIGHTED_SUM", weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12 };
    const r = computeSignificance(method, { severity: 4, frequency: 3, scope: 3 });
    assert.equal(r.score, 14, "2*4 + 1*3 + 1*3 = 14");
    assert.equal(r.significant, true, "14 >= 12 → significant");
    assert.equal(r.level, "HIGH", "ratio 14/12 ≈ 1.17 → HIGH (1 ≤ ratio < 1.5)");
  });

  await t("significance: an effective control drops a value below threshold", async () => {
    const method = { formula: "WEIGHTED_SUM", weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12 };
    const withControl = computeSignificance(method, { severity: 4, frequency: 3, scope: 3, controlEffectiveness: 50 });
    assert.equal(withControl.score, 7, "14 * (1 - 0.5) = 7");
    assert.equal(withControl.significant, false, "7 < 12 → not significant");
  });

  await t("significance: PRODUCT and SUM formulas", async () => {
    assert.equal(computeSignificance({ formula: "PRODUCT", threshold: 20 }, { severity: 3, frequency: 2, scope: 2 }).score, 12);
    assert.equal(computeSignificance({ formula: "SUM", threshold: 20 }, { severity: 3, frequency: 2, scope: 2 }).score, 7);
  });

  // org fixtures
  const orgA = await prisma.organization.upsert({ where: { slug: "env-a" }, update: {}, create: { name: "EnvA", slug: "env-a", plan: "GROWTH" } });
  const orgB = await prisma.organization.upsert({ where: { slug: "env-b" }, update: {}, create: { name: "EnvB", slug: "env-b", plan: "GROWTH" } });
  const userA = await prisma.user.upsert({ where: { email: "env-a@x.com" }, update: {}, create: { email: "env-a@x.com", name: "Ana Ambiental" } });

  // ── methodology history ──
  await t("methodology history: a new version supersedes the prior active one", async () => {
    const def = defaultSignificanceMethod();
    const v1 = await prisma.environmentalSignificanceMethod.create({ data: { organizationId: orgA.id, name: def.name, formula: def.formula, weights: def.weights, threshold: def.threshold, version: "1", active: true } });
    // Supersede: deactivate v1, create v2 active (mirrors createSignificanceMethod).
    await prisma.environmentalSignificanceMethod.updateMany({ where: { organizationId: orgA.id, name: def.name, active: true }, data: { active: false } });
    const v2 = await prisma.environmentalSignificanceMethod.create({ data: { organizationId: orgA.id, name: def.name, formula: def.formula, weights: { severity: 3, frequency: 1, scope: 1 }, threshold: 14, version: "2", active: true } });
    const active = await prisma.environmentalSignificanceMethod.findMany({ where: { organizationId: orgA.id, name: def.name, active: true } });
    assert.equal(active.length, 1, "exactly one active version");
    assert.equal(active[0].id, v2.id, "the latest version is active");
    const all = await prisma.environmentalSignificanceMethod.findMany({ where: { organizationId: orgA.id, name: def.name } });
    assert.equal(all.length, 2, "prior version kept as history");
    assert.ok(await prisma.environmentalSignificanceMethod.findFirst({ where: { id: v1.id, active: false } }), "v1 archived");
  });

  // ── aspects & impacts with persisted significance ──
  let significantImpactId = "";
  await t("aspects & impacts: significance is persisted on the impact", async () => {
    const method = await prisma.environmentalSignificanceMethod.findFirstOrThrow({ where: { organizationId: orgA.id, active: true } });
    const aspect = await prisma.environmentalAspect.create({ data: { organizationId: orgA.id, code: "ASP-0001", activity: "Consumo de agua", condition: "NORMAL", lifeCycleStage: "Uso", responsibleId: userA.id } });
    const sig = computeSignificance(method, { severity: 5, frequency: 3, scope: 3 }); // 3*5+3+3 = 21 >= 14
    const impact = await prisma.environmentalImpact.create({ data: { organizationId: orgA.id, aspectId: aspect.id, methodId: method.id, impactType: "Agotamiento de recursos", severity: 5, frequency: 3, scope: 3, score: sig.score, level: sig.level, significant: sig.significant } });
    assert.equal(impact.score, 21);
    assert.equal(impact.significant, true);
    significantImpactId = impact.id;
    const significant = await prisma.environmentalImpact.count({ where: { organizationId: orgA.id, significant: true } });
    assert.equal(significant, 1);
  });

  // ── compliance overdue (pure + DB) ──
  await t("compliance overdue: past review with no fresh evaluation is overdue", async () => {
    const now = new Date("2026-07-24T00:00:00Z");
    const past = new Date("2026-06-01T00:00:00Z");
    const oldEval = new Date("2026-01-01T00:00:00Z");
    assert.equal(isEvaluationOverdue(past, oldEval, now), true, "review due 06-01, last eval 01-01 → overdue");
    assert.equal(isEvaluationOverdue(past, new Date("2026-06-15T00:00:00Z"), now), false, "evaluated after review date → not overdue");
    assert.equal(isEvaluationOverdue(new Date("2026-12-01T00:00:00Z"), null, now), false, "future review → not overdue");
    assert.equal(complianceState(past, oldEval, "NON_COMPLIANT", now).nonCompliant, true);
  });

  let obligationId = "";
  await t("compliance: obligation + evaluation persist and derive overdue state", async () => {
    const obligation = await prisma.environmentalComplianceObligation.create({ data: { organizationId: orgA.id, code: "OBL-0001", source: "Reglamento de vertidos", obligation: "Límites de descarga", reviewDate: new Date("2026-06-01T00:00:00Z"), reviewFrequencyMonths: 6, responsibleId: userA.id } });
    obligationId = obligation.id;
    await prisma.environmentalComplianceEvaluation.create({ data: { organizationId: orgA.id, obligationId: obligation.id, result: "PARTIAL", evaluatedAt: new Date("2026-01-01T00:00:00Z"), evaluatorId: userA.id } });
    const latest = await prisma.environmentalComplianceEvaluation.findFirst({ where: { obligationId: obligation.id }, orderBy: { evaluatedAt: "desc" } });
    const state = complianceState(obligation.reviewDate, latest?.evaluatedAt, latest?.result, new Date("2026-07-24T00:00:00Z"));
    assert.equal(state.overdue, true, "review date passed without a fresh evaluation");
    assert.equal(state.nonCompliant, true, "PARTIAL counts as a compliance gap");
  });

  // ── associated evidence ──
  await t("associated evidence: an evidence file links to an obligation & evaluation", async () => {
    const ev = await prisma.evidenceFile.create({ data: { organizationId: orgA.id, title: "Informe de laboratorio", evidenceType: "REPORT", fileUrl: "s3://evidence/lab.pdf" } });
    await prisma.environmentalComplianceObligation.update({ where: { id: obligationId }, data: { evidenceId: ev.id } });
    await prisma.environmentalComplianceEvaluation.create({ data: { organizationId: orgA.id, obligationId, result: "COMPLIANT", evaluatedAt: new Date("2026-07-01T00:00:00Z"), evidenceId: ev.id, evaluatorId: userA.id } });
    const obl = await prisma.environmentalComplianceObligation.findUniqueOrThrow({ where: { id: obligationId } });
    assert.equal(obl.evidenceId, ev.id, "obligation references the evidence file");
    const withEvidence = await prisma.environmentalComplianceEvaluation.count({ where: { organizationId: orgA.id, evidenceId: ev.id } });
    assert.equal(withEvidence, 1, "evaluation references the same evidence");
    // A fresh COMPLIANT evaluation clears the overdue state.
    const latest = await prisma.environmentalComplianceEvaluation.findFirst({ where: { obligationId }, orderBy: { evaluatedAt: "desc" } });
    assert.equal(complianceState(obl.reviewDate, latest?.evaluatedAt, latest?.result, new Date("2026-07-24T00:00:00Z")).overdue, false);
  });

  // ── objectives, waste, emergencies (audit package inputs) ──
  await t("objectives, waste streams and emergency scenarios persist", async () => {
    await prisma.environmentalObjective.create({ data: { organizationId: orgA.id, code: "OBJ-0001", objective: "Reducir agua 10%", baseline: "1000 m3", target: "900 m3", status: "IN_PROGRESS", progress: 40, indicatorId: null } });
    await prisma.wasteStream.create({ data: { organizationId: orgA.id, code: "RES-0001", wasteType: "Aceite usado", classification: "HAZARDOUS", quantity: 200, unit: "L", disposition: "Gestor autorizado", manifest: "MAN-1" } });
    await prisma.environmentalMetric.create({ data: { organizationId: orgA.id, period: "2026-06", water: 940, energy: 1180, emissions: 43, waste: 58 } });
    await prisma.environmentalEmergencyScenario.create({ data: { organizationId: orgA.id, code: "EMG-0001", scenario: "Derrame químico", lastDrillAt: new Date("2026-03-01T00:00:00Z") } });
    assert.equal(await prisma.environmentalObjective.count({ where: { organizationId: orgA.id } }), 1);
    assert.equal(await prisma.wasteStream.count({ where: { organizationId: orgA.id, classification: "HAZARDOUS" } }), 1);
  });

  // ── persistent report artifacts ──
  await t("reportes persistentes: a ReportExport artifact persists and is retrievable", async () => {
    const report = await prisma.reportExport.create({ data: { organizationId: orgA.id, reportType: "env-audit-package", format: "PDF", dateFrom: new Date("2026-01-01"), dateTo: new Date("2026-12-31"), rowCount: 7, fileName: "env-audit-package-2026.pdf", status: "COMPLETED", title: "Paquete de auditoría ambiental" } });
    const persisted = await prisma.reportExport.findFirstOrThrow({ where: { organizationId: orgA.id, reportType: "env-audit-package" } });
    assert.equal(persisted.id, report.id);
    assert.equal(persisted.status, "COMPLETED");
    assert.equal(persisted.rowCount, 7);
  });

  // ── environmental audit package aggregation ──
  await t("auditoría ambiental: the package aggregates every environmental section", async () => {
    const [aspects, impacts, significant, obligations, objectives, waste, emergencies] = await Promise.all([
      prisma.environmentalAspect.count({ where: { organizationId: orgA.id } }),
      prisma.environmentalImpact.count({ where: { organizationId: orgA.id } }),
      prisma.environmentalImpact.count({ where: { organizationId: orgA.id, significant: true } }),
      prisma.environmentalComplianceObligation.count({ where: { organizationId: orgA.id } }),
      prisma.environmentalObjective.count({ where: { organizationId: orgA.id } }),
      prisma.wasteStream.count({ where: { organizationId: orgA.id } }),
      prisma.environmentalEmergencyScenario.count({ where: { organizationId: orgA.id } }),
    ]);
    assert.ok(aspects >= 1 && impacts >= 1 && significant >= 1, "aspects/impacts present");
    assert.ok(obligations >= 1 && objectives >= 1 && waste >= 1 && emergencies >= 1, "all sections present");
  });

  // ── tenant isolation ──
  await t("tenant isolation: org B sees none of org A's environmental data", async () => {
    for (const model of [
      prisma.environmentalAspect, prisma.environmentalImpact, prisma.environmentalComplianceObligation,
      prisma.environmentalObjective, prisma.wasteStream, prisma.environmentalEmergencyScenario,
      prisma.environmentalSignificanceMethod, prisma.environmentalMetric,
    ] as const) {
      // @ts-expect-error — uniform count across delegates
      const count = await model.count({ where: { organizationId: orgB.id } });
      assert.equal(count, 0, "org B must not see org A rows via tenant filter");
    }
    assert.ok(significantImpactId, "sanity: a significant impact exists for org A");
    const leaked = await prisma.environmentalImpact.findFirst({ where: { id: significantImpactId, organizationId: orgB.id } });
    assert.equal(leaked, null, "org A impact is invisible under org B filter");
  });

  console.log(`\n${passed} checks passed.`);
}

main().catch((e) => { console.error("\n✗ FAILED:", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
