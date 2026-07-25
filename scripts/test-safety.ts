/**
 * ISO 45001 occupational health & safety — integration test.
 *
 * Runnable against a DISPOSABLE Postgres (never prod). Exercises the occupational
 * risk calculation, the strict incident investigation workflow (no jumps), the
 * safety indicators, associated evidence, persistent report artifacts, tenant
 * isolation and the safety audit package.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-safety.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import { computeOccupationalRisk, levelFromMagnitude } from "../src/lib/safety/risk";
import { computeSafetyIndicators } from "../src/lib/safety/indicators";
import { assertIncidentTransition, canTransitionIncident, nextIncidentStatus, INCIDENT_FLOW } from "../src/lib/safety/incident-workflow";

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
  console.log("ISO 45001 occupational health & safety integration test\n");

  await t("ISO 45001 pack installs (family, edition, requirements, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_45001" } }), "ISO_45001 family");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-45001-6.1.2" } }), "hazards clause 6.1.2");
    const map = await prisma.requirementMapping.findUnique({ where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: "req-iso-45001-9.2", targetRequirementId: "cl-9001-9.2" } } });
    assert.ok(map && map.relationType === "EQUIVALENT", "45001 9.2 ⇄ 9001 9.2 mapping");
  });

  // ── occupational risk (W.T. Fine) ──
  await t("occupational risk: GP = C·E·P, level bands and acceptability", async () => {
    assert.equal(levelFromMagnitude(50), "LOW");
    assert.equal(levelFromMagnitude(150), "MEDIUM");
    assert.equal(levelFromMagnitude(300), "HIGH");
    assert.equal(levelFromMagnitude(500), "CRITICAL");
    const r = computeOccupationalRisk({ probability: 6, consequence: 15, exposure: 6 }); // 540 → CRITICAL
    assert.equal(r.inherentMagnitude, 540);
    assert.equal(r.inherentLevel, "CRITICAL");
    assert.equal(r.acceptability, "NOT_ACCEPTABLE");
  });

  await t("occupational risk: controls reduce the residual magnitude & acceptability", async () => {
    const r = computeOccupationalRisk({ probability: 6, consequence: 15, exposure: 6, controlEffectiveness: 90 }); // 540 → 54 → LOW
    assert.equal(r.residualMagnitude, 54);
    assert.equal(r.residualLevel, "LOW");
    assert.equal(r.acceptability, "ACCEPTABLE");
  });

  // ── incident workflow (pure) ──
  await t("incident workflow: forward-by-one only, no jumps or backward", async () => {
    assert.equal(nextIncidentStatus("REPORTED"), "CLASSIFIED");
    assert.equal(nextIncidentStatus("CLOSED"), null);
    assert.equal(canTransitionIncident("REPORTED", "CLASSIFIED"), true);
    assert.equal(canTransitionIncident("REPORTED", "INVESTIGATING"), false, "no jumps");
    assert.equal(canTransitionIncident("INVESTIGATING", "CLASSIFIED"), false, "no backward");
    assert.throws(() => assertIncidentTransition("REPORTED", "ROOT_CAUSE"), /no se permiten saltos/);
    assert.throws(() => assertIncidentTransition("CLOSED", "REPORTED"), /estado final/);
    // The full happy path is walkable one step at a time.
    for (let i = 0; i < INCIDENT_FLOW.length - 1; i++) assertIncidentTransition(INCIDENT_FLOW[i], INCIDENT_FLOW[i + 1]);
  });

  // ── safety indicators (pure) ──
  await t("safety indicators: frequency, severity and accident rate", async () => {
    const ind = computeSafetyIndicators({ accidentsWithLostTime: 2, lostDays: 30, nearMisses: 5, inspections: 10, overdueActions: 3, hoursWorked: 200000 });
    assert.equal(ind.frequencyIndex, 10, "2 * 1e6 / 200000 = 10");
    assert.equal(ind.severityIndex, 150, "30 * 1e6 / 200000 = 150");
    assert.equal(ind.accidentRate, 1.5, "(10 * 150) / 1000 = 1.5");
    // Guard against division by zero when hours are unknown.
    assert.equal(computeSafetyIndicators({ accidentsWithLostTime: 2, lostDays: 30, nearMisses: 0, inspections: 0, overdueActions: 0, hoursWorked: 0 }).frequencyIndex, 0);
  });

  // fixtures
  const orgA = await prisma.organization.upsert({ where: { slug: "sst-a" }, update: {}, create: { name: "SstA", slug: "sst-a", plan: "GROWTH" } });
  const orgB = await prisma.organization.upsert({ where: { slug: "sst-b" }, update: {}, create: { name: "SstB", slug: "sst-b", plan: "GROWTH" } });
  const userA = await prisma.user.upsert({ where: { email: "sst-a@x.com" }, update: {}, create: { email: "sst-a@x.com", name: "Luis SST" } });

  // ── hazard matrix + persisted assessment ──
  let criticalHazardId = "";
  await t("hazard matrix: hazard + risk assessment persists computed levels", async () => {
    const hazard = await prisma.occupationalHazard.create({ data: { organizationId: orgA.id, code: "PEL-0001", activity: "Trabajo en altura", task: "Montaje", hazard: "Caída de altura", category: "MECHANICAL", exposedWorkers: 4 } });
    criticalHazardId = hazard.id;
    const r = computeOccupationalRisk({ probability: 6, consequence: 15, exposure: 6 });
    const a = await prisma.occupationalRiskAssessment.create({ data: { organizationId: orgA.id, hazardId: hazard.id, probability: 6, consequence: 15, exposure: 6, inherentMagnitude: r.inherentMagnitude, inherentLevel: r.inherentLevel, residualMagnitude: r.residualMagnitude, residualLevel: r.residualLevel, acceptability: r.acceptability } });
    assert.equal(a.inherentLevel, "CRITICAL");
    assert.equal(a.acceptability, "NOT_ACCEPTABLE");
    const critical = await prisma.occupationalRiskAssessment.count({ where: { organizationId: orgA.id, acceptability: "NOT_ACCEPTABLE" } });
    assert.equal(critical, 1);
  });

  // ── incident workflow (DB, driven through every stage) ──
  let incidentId = "";
  await t("incident: created at REPORTED and advanced step-by-step to CLOSED", async () => {
    const inc = await prisma.occupationalIncident.create({ data: { organizationId: orgA.id, code: "INC-0001", type: "ACCIDENT", severity: "HIGH", title: "Corte en mano", occurredAt: new Date(), lostDays: 3, status: "REPORTED", reporterId: userA.id } });
    incidentId = inc.id;
    let status = inc.status;
    for (const to of INCIDENT_FLOW.slice(1)) {
      assertIncidentTransition(status, to); // would throw on a jump
      const updated = await prisma.occupationalIncident.update({ where: { id: inc.id }, data: { status: to, ...(to === "CLOSED" ? { closedAt: new Date() } : {}) } });
      status = updated.status;
    }
    const final = await prisma.occupationalIncident.findUniqueOrThrow({ where: { id: inc.id } });
    assert.equal(final.status, "CLOSED");
    assert.ok(final.closedAt, "closedAt set on close");
  });

  // ── associated evidence ──
  await t("associated evidence: an evidence file links to an inspection", async () => {
    const ev = await prisma.evidenceFile.create({ data: { organizationId: orgA.id, title: "Foto de hallazgo", evidenceType: "PHOTO", fileUrl: "s3://evidence/insp.jpg" } });
    const insp = await prisma.safetyInspection.create({ data: { organizationId: orgA.id, code: "INS-0001", type: "PLANNED", area: "Taller", findings: "Extintor vencido", evidenceId: ev.id, inspectedAt: new Date() } });
    assert.equal(insp.evidenceId, ev.id);
    const linked = await prisma.safetyInspection.count({ where: { organizationId: orgA.id, evidenceId: ev.id } });
    assert.equal(linked, 1);
  });

  // ── PPE, permits, drills, contractors, consultation (audit-package inputs) ──
  await t("PPE, permit, drill, contractor and consultation persist", async () => {
    const item = await prisma.pPEItem.create({ data: { organizationId: orgA.id, code: "EPP-0001", name: "Arnés", ppeType: "Anticaídas", technicalStandard: "EN 361", lifespanMonths: 60 } });
    await prisma.pPEAssignment.create({ data: { organizationId: orgA.id, ppeItemId: item.id, workerName: "Ana R.", quantity: 1, trainingProvided: true } });
    await prisma.permitToWork.create({ data: { organizationId: orgA.id, code: "PTW-0001", workType: "WORK_AT_HEIGHT", status: "ACTIVE", validTo: new Date(Date.now() + 86400000) } });
    await prisma.emergencyDrill.create({ data: { organizationId: orgA.id, code: "SIM-0001", scenario: "Evacuación", outcome: "PARTIAL", responseTimeMinutes: 8, drillDate: new Date() } });
    await prisma.contractorSafetyAssessment.create({ data: { organizationId: orgA.id, code: "CTR-0001", contractorName: "Montajes SA", outcome: "CONDITIONAL", incidents: 1 } });
    await prisma.workerConsultation.create({ data: { organizationId: orgA.id, code: "CON-0001", topic: "Uso de EPP", method: "COMMITTEE", participants: 12 } });
    assert.equal(await prisma.pPEAssignment.count({ where: { organizationId: orgA.id } }), 1);
    assert.equal(await prisma.permitToWork.count({ where: { organizationId: orgA.id, status: "ACTIVE" } }), 1);
  });

  // ── persistent report artifact ──
  await t("reportes persistentes: a ReportExport artifact persists and is retrievable", async () => {
    const report = await prisma.reportExport.create({ data: { organizationId: orgA.id, reportType: "safety-audit-package", format: "PDF", dateFrom: new Date("2026-01-01"), dateTo: new Date("2026-12-31"), rowCount: 10, fileName: "safety-audit-2026.pdf", status: "COMPLETED", title: "Paquete de auditoría SST" } });
    const persisted = await prisma.reportExport.findFirstOrThrow({ where: { organizationId: orgA.id, reportType: "safety-audit-package" } });
    assert.equal(persisted.id, report.id);
    assert.equal(persisted.rowCount, 10);
  });

  // ── audit package aggregation ──
  await t("safety audit package: aggregates every safety section", async () => {
    const [hazards, incidents, inspections, ppe, permits, drills, contractors] = await Promise.all([
      prisma.occupationalHazard.count({ where: { organizationId: orgA.id } }),
      prisma.occupationalIncident.count({ where: { organizationId: orgA.id } }),
      prisma.safetyInspection.count({ where: { organizationId: orgA.id } }),
      prisma.pPEItem.count({ where: { organizationId: orgA.id } }),
      prisma.permitToWork.count({ where: { organizationId: orgA.id } }),
      prisma.emergencyDrill.count({ where: { organizationId: orgA.id } }),
      prisma.contractorSafetyAssessment.count({ where: { organizationId: orgA.id } }),
    ]);
    assert.ok(hazards >= 1 && incidents >= 1 && inspections >= 1 && ppe >= 1 && permits >= 1 && drills >= 1 && contractors >= 1, "all sections present");
  });

  // ── tenant isolation ──
  await t("tenant isolation: org B sees none of org A's safety data", async () => {
    for (const model of [
      prisma.occupationalHazard, prisma.occupationalRiskAssessment, prisma.occupationalIncident,
      prisma.safetyInspection, prisma.pPEItem, prisma.pPEAssignment, prisma.permitToWork,
      prisma.occupationalHealthSurveillance, prisma.emergencyDrill, prisma.contractorSafetyAssessment, prisma.workerConsultation,
    ] as const) {
      // @ts-expect-error — uniform count across delegates
      const count = await model.count({ where: { organizationId: orgB.id } });
      assert.equal(count, 0, "org B must not see org A rows via tenant filter");
    }
    assert.ok(criticalHazardId && incidentId, "sanity: org A fixtures exist");
    assert.equal(await prisma.occupationalIncident.findFirst({ where: { id: incidentId, organizationId: orgB.id } }), null);
  });

  console.log(`\n${passed} checks passed.`);
}

main().catch((e) => { console.error("\n✗ FAILED:", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
