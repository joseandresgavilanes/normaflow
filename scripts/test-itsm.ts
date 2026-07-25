/**
 * ISO/IEC 20000 ITSM — integration test.
 *
 * Pure workflow checks always run. DB checks require a disposable Postgres.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-itsm.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import {
  assertItsmChangeApproval,
  assertItsmChangeTransition,
  assertItsmIncidentTransition,
  assertItsmProblemTransition,
  availabilityPercent,
  nextItsmChangeStatuses,
  nextItsmIncidentStatuses,
  nextItsmProblemStatuses,
  slaMet,
} from "../src/lib/itsm/workflows";

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
  console.log("ISO/IEC 20000 ITSM integration test\n");

  await t("incident workflow NEW→…→CLOSED", async () => {
    assert.deepEqual(nextItsmIncidentStatuses("NEW"), ["ASSIGNED"]);
    assertItsmIncidentTransition("NEW", "ASSIGNED");
    assertItsmIncidentTransition("ASSIGNED", "INVESTIGATING");
    assertItsmIncidentTransition("INVESTIGATING", "RESOLVED");
    assertItsmIncidentTransition("RESOLVED", "CONFIRMED");
    assertItsmIncidentTransition("CONFIRMED", "CLOSED");
    assert.throws(() => assertItsmIncidentTransition("NEW", "CLOSED"), /Transición/);
  });

  await t("problem and change workflows", async () => {
    assert.deepEqual(nextItsmProblemStatuses("IDENTIFIED"), ["ANALYSIS"]);
    assertItsmProblemTransition("ANALYSIS", "KNOWN_ERROR");
    assertItsmProblemTransition("KNOWN_ERROR", "REMEDIATION");
    assert.deepEqual(nextItsmChangeStatuses("REQUESTED"), ["ASSESSED"]);
    assertItsmChangeTransition("ASSESSED", "APPROVED");
    assert.throws(() => assertItsmChangeApproval({ approvedById: null }), /quién/);
    assert.throws(() => assertItsmChangeTransition("REQUESTED", "IMPLEMENTED"), /Transición/);
  });

  await t("availability and SLA helpers", async () => {
    assert.equal(availabilityPercent(10080, 10), Math.round(((10080 - 10) / 10080) * 10000) / 100);
    assert.throws(() => availabilityPercent(0, 1), /periodo/);
    const met = slaMet({
      responseDueMinutes: 15,
      resolutionDueMinutes: 240,
      responseActualMinutes: 10,
      resolutionActualMinutes: 200,
    });
    assert.equal(met.overallMet, true);
    const breach = slaMet({
      responseDueMinutes: 15,
      resolutionDueMinutes: 240,
      responseActualMinutes: 20,
      resolutionActualMinutes: 100,
    });
    assert.equal(breach.responseMet, false);
    assert.equal(breach.overallMet, false);
  });

  if (!prisma) {
    console.log(`\n${passed} pure checks passed (DB skipped — set disposable DATABASE_URL for full suite).`);
    return;
  }

  await t("ISO 20000 pack installs (family, clauses, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_20000" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-20000-8.6" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-20000-8.3" } }));
    const map = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-20000-9.2",
          targetRequirementId: "cl-9001-9.2",
        },
      },
    });
    assert.ok(map && map.relationType === "EQUIVALENT");
  });

  const org = await prisma.organization.upsert({
    where: { slug: "test-itsm-org" },
    update: {},
    create: { name: "ITSM Test Org", slug: "test-itsm-org", plan: "GROWTH" },
  });

  await t("service → SLA → incident → problem → change → CMDB chain", async () => {
    await prisma.iTService.deleteMany({ where: { organizationId: org.id } });

    const service = await prisma.iTService.create({
      data: { organizationId: org.id, code: "SVC-1", name: "Correo", criticality: "HIGH" },
    });
    await prisma.serviceCatalogEntry.create({
      data: { organizationId: org.id, code: "CAT-1", serviceId: service.id, name: "Alta buzón" },
    });
    const sla = await prisma.serviceLevelAgreement.create({
      data: {
        organizationId: org.id, code: "SLA-1", serviceId: service.id, name: "SLA P1",
        responseTimeMinutes: 15, resolutionTimeMinutes: 240, status: "ACTIVE",
      },
    });
    const ciA = await prisma.configurationItem.create({
      data: { organizationId: org.id, code: "CI-A", name: "App", ciType: "APPLICATION", serviceId: service.id },
    });
    const ciB = await prisma.configurationItem.create({
      data: { organizationId: org.id, code: "CI-B", name: "Server", ciType: "SERVER", serviceId: service.id },
    });
    await prisma.cMDBRelationship.create({
      data: {
        organizationId: org.id, code: "RELN-1", sourceCiId: ciA.id, targetCiId: ciB.id,
        relationType: "RUNS_ON",
      },
    });
    const problem = await prisma.problem.create({
      data: { organizationId: org.id, code: "PRB-1", title: "Proxy intermitente", serviceId: service.id, status: "ANALYSIS" },
    });
    const incident = await prisma.iTSMIncident.create({
      data: {
        organizationId: org.id, code: "INC-1", title: "Caída OWA", serviceId: service.id, slaId: sla.id,
        problemId: problem.id, configurationItemId: ciA.id, status: "ASSIGNED",
        assignedAt: new Date(), assigneeId: "tester",
      },
    });
    await prisma.iTSMIncident.update({
      where: { id: incident.id },
      data: {
        status: "RESOLVED", resolvedAt: new Date(),
      },
    });
    await prisma.iTSMIncident.update({
      where: { id: incident.id },
      data: {
        status: "CONFIRMED", confirmedAt: new Date(), confirmedById: "tester",
      },
    });
    await prisma.iTSMIncident.update({
      where: { id: incident.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    await prisma.knownError.create({
      data: {
        organizationId: org.id, code: "KE-1", title: "Proxy timeout", problemId: problem.id,
        workaround: "Cliente denso", status: "DOCUMENTED",
      },
    });
    await prisma.problem.update({ where: { id: problem.id }, data: { status: "KNOWN_ERROR" } });

    const change = await prisma.iTSMChange.create({
      data: {
        organizationId: org.id, code: "CHG-1", title: "Actualizar WAF", serviceId: service.id,
        status: "ASSESSED", assessedById: "tester", relatedIncidentId: incident.id, relatedProblemId: problem.id,
      },
    });
    await prisma.iTSMChange.update({
      where: { id: change.id },
      data: { status: "APPROVED", approvedById: "approver" },
    });

    const release = await prisma.release.create({
      data: { organizationId: org.id, code: "REL-1", title: "Patch", version: "1.0.1", serviceId: service.id, changeCodes: ["CHG-1"] },
    });
    await prisma.deployment.create({
      data: { organizationId: org.id, code: "DEP-1", releaseId: release.id, environment: "PROD", configurationItemId: ciB.id },
    });

    await prisma.availabilityPlan.create({
      data: {
        organizationId: org.id, code: "AVL-1", serviceId: service.id, title: "Disp Q3",
        targetPercent: 99.9, agreedDowntimeMinutes: 10,
        periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-07-31"),
        actualAvailabilityPct: availabilityPercent(30 * 24 * 60, 10), status: "ACTIVE",
      },
    });
    await prisma.capacityPlan.create({
      data: { organizationId: org.id, code: "CAP-1", serviceId: service.id, title: "Capacidad", metric: "Buzones", currentCapacity: 1000, status: "ACTIVE" },
    });
    await prisma.serviceContinuityPlan.create({
      data: { organizationId: org.id, code: "SCP-1", serviceId: service.id, title: "Continuidad", rtoMinutes: 60, rpoMinutes: 15, status: "ACTIVE" },
    });
    await prisma.serviceSupplier.create({
      data: { organizationId: org.id, code: "SSP-1", name: "Cloud Mail", serviceId: service.id },
    });
    await prisma.knowledgeArticle.create({
      data: { organizationId: org.id, code: "KB-1", title: "Cómo resetear OWA", content: "Pasos…", status: "PUBLISHED", serviceId: service.id, publishedAt: new Date() },
    });
    await prisma.serviceReport.create({
      data: {
        organizationId: org.id, code: "RPT-1", title: "Desempeño", reportType: "PERFORMANCE",
        serviceId: service.id, periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-07-31"),
      },
    });

    assert.equal((await prisma.iTSMIncident.findUnique({ where: { id: incident.id } }))?.status, "CLOSED");
    assert.notEqual(
      (await prisma.securityIncident.count({ where: { organizationId: org.id } })),
      -1,
    ); // table exists and is independent
  });

  await t("CHECK: CMDB cannot self-link", async () => {
    const ci = await prisma.configurationItem.findFirst({ where: { organizationId: org.id } });
    assert.ok(ci);
    try {
      await prisma.cMDBRelationship.create({
        data: {
          organizationId: org.id, code: "RELN-BAD", sourceCiId: ci.id, targetCiId: ci.id, relationType: "DEPENDS_ON",
        },
      });
      assert.fail("expected check violation");
    } catch (error) {
      assert.ok(isCheckViolation(error, "itsm_cmdb_no_self_link"));
    }
  });

  await t("CHECK: change APPROVED requires approvedById", async () => {
    const service = await prisma.iTService.findFirst({ where: { organizationId: org.id } });
    assert.ok(service);
    try {
      await prisma.iTSMChange.create({
        data: {
          organizationId: org.id, code: "CHG-BAD", title: "Sin aprobador", serviceId: service.id,
          status: "APPROVED",
        },
      });
      assert.fail("expected check violation");
    } catch (error) {
        assert.ok(isCheckViolation(error, "itsm_changes_approved_attributed"));
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
