/**
 * ISO 13485 medical device QMS — integration test.
 *
 * Pure privacy/workflow checks always run. DB checks require disposable Postgres.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-medical-devices.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import {
  assertNoUnnecessaryPersonalData,
  assertOpaqueSubjectRef,
} from "../src/lib/medical-devices/privacy";
import {
  assertAdverseEventTransition,
  assertComplaintTransition,
  assertFsaTransition,
  assertMdRecordPurgeable,
  assertPmsTransition,
  assertRecallTransition,
  assertRecordApproval,
  assertRecordTransition,
  assertTestResultAttribution,
  designInputCoverage,
  mdRetentionUntil,
  nextComplaintStatuses,
  nextRecallStatuses,
  nextRecordStatuses,
} from "../src/lib/medical-devices/workflows";

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
  console.log("ISO 13485 medical device QMS integration test\n");

  await t("privacy rejects email and long digit IDs", async () => {
    assert.throws(
      () => assertNoUnnecessaryPersonalData({ description: "Contactar a user@hospital.com" }),
      /correos/,
    );
    assert.throws(
      () => assertNoUnnecessaryPersonalData({ anonymizedSubjectRef: "12345678" }),
      /secuencias numéricas/,
    );
    assert.throws(
      () => assertNoUnnecessaryPersonalData({ investigationSummary: "historia clínica del paciente" }),
      /clínicos/,
    );
    assertOpaqueSubjectRef("CASE-8841");
  });

  await t("complaint / recall / DMR workflows", async () => {
    assert.deepEqual(nextComplaintStatuses("RECEIVED"), ["TRIAGED"]);
    assertComplaintTransition("RECEIVED", "TRIAGED");
    assertComplaintTransition("TRIAGED", "INVESTIGATING");
    assertComplaintTransition("INVESTIGATING", "CLOSED");
    assert.throws(() => assertComplaintTransition("RECEIVED", "CLOSED"), /Transición/);

    assert.deepEqual(nextRecallStatuses("DRAFT"), ["INITIATED"]);
    assertRecallTransition("INITIATED", "NOTIFYING");
    assertRecallTransition("COMPLETED", "CLOSED");
    assert.throws(() => assertRecallTransition("DRAFT", "CLOSED"), /Transición/);

    assert.deepEqual(nextRecordStatuses("DRAFT"), ["UNDER_REVIEW"]);
    assertRecordTransition("UNDER_REVIEW", "APPROVED");
    assert.throws(() => assertRecordApproval({ approvedById: null }), /quién/);
    assertTestResultAttribution({ result: "PASS", verifiedById: "u1" });
    assert.throws(() => assertTestResultAttribution({ result: "PASS" }), /atribución/);
  });

  await t("design input coverage", async () => {
    const cov = designInputCoverage({
      inputCodes: ["DI-1", "DI-2", "DI-3"],
      linkedInputCodes: [["DI-1"], ["DI-1", "DI-2"]],
    });
    assert.equal(cov.percent, 67);
    assert.deepEqual(cov.uncovered, ["DI-3"]);
  });

  await t("adverse event / FSCA / PMS workflows", async () => {
    assert.deepEqual(nextComplaintStatuses("RECEIVED"), ["TRIAGED"]); // sanity: unrelated import still wired
    assertAdverseEventTransition("REPORTED", "UNDER_REVIEW");
    assertAdverseEventTransition("UNDER_REVIEW", "REPORTED_TO_AUTHORITY");
    assertAdverseEventTransition("REPORTED_TO_AUTHORITY", "CLOSED");
    assert.throws(() => assertAdverseEventTransition("REPORTED", "CLOSED"), /Transición/);

    assertFsaTransition("DRAFT", "INITIATED");
    assertFsaTransition("INITIATED", "IN_PROGRESS");
    assertFsaTransition("COMPLETED", "CLOSED");
    assert.throws(() => assertFsaTransition("DRAFT", "COMPLETED"), /Transición/);

    assertPmsTransition("PLANNED", "IN_PROGRESS");
    assertPmsTransition("IN_PROGRESS", "OVERDUE");
    assertPmsTransition("OVERDUE", "COMPLETED");
    assert.throws(() => assertPmsTransition("COMPLETED", "PLANNED"), /Transición/);
  });

  await t("retention: date math and purge guard", async () => {
    const closedAt = new Date("2026-01-15T00:00:00.000Z");
    const until = mdRetentionUntil(closedAt, 15);
    assert.equal(until.getUTCFullYear(), 2041);
    assert.throws(
      () => assertMdRecordPurgeable({ closedAt, retentionUntil: until, purgedAt: null }, new Date("2030-01-01"), "La queja"),
      /vence/,
    );
    assertMdRecordPurgeable({ closedAt, retentionUntil: until, purgedAt: null }, new Date("2042-01-01"), "La queja");
    assert.throws(
      () => assertMdRecordPurgeable({ closedAt: null, retentionUntil: null, purgedAt: null }, new Date(), "El evento adverso"),
      /cerrado/,
    );
  });

  if (!prisma) {
    console.log(`\n${passed} pure checks passed (DB skipped — set disposable DATABASE_URL for full suite).`);
    return;
  }

  await t("ISO 13485 pack installs", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_13485" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-13485-7.3" } }));
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-13485-8.2" } }));
    const map = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-13485-8.5",
          targetRequirementId: "cl-9001-10.2",
        },
      },
    });
    assert.ok(map && map.relationType === "EQUIVALENT");
  });

  const org = await prisma.organization.upsert({
    where: { slug: "test-md-org" },
    update: {},
    create: { name: "MD QMS Test Org", slug: "test-md-org", plan: "GROWTH" },
  });

  await t("device → DMR → DHF → batch → complaint chain", async () => {
    await prisma.medicalDevice.deleteMany({ where: { organizationId: org.id } });
    await prisma.deviceFamily.deleteMany({ where: { organizationId: org.id } });

    const family = await prisma.deviceFamily.create({
      data: { organizationId: org.id, code: "FAM-1", name: "Familia demo" },
    });
    const device = await prisma.medicalDevice.create({
      data: {
        organizationId: org.id, code: "DEV-1", name: "Dispositivo demo",
        familyId: family.id, classification: "IIa", status: "PRODUCTION",
      },
    });
    await prisma.deviceMasterRecord.create({
      data: {
        organizationId: org.id, code: "DMR-1", deviceId: device.id, version: "1",
        title: "DMR demo", status: "APPROVED", approvedById: "approver", approvedAt: new Date(),
      },
    });
    const dhf = await prisma.designHistoryFile.create({
      data: { organizationId: org.id, code: "DHF-1", deviceId: device.id, title: "DHF demo" },
    });
    await prisma.designInput.create({
      data: { organizationId: org.id, code: "DI-1", dhfId: dhf.id, requirement: "Req A" },
    });
    await prisma.designOutput.create({
      data: {
        organizationId: org.id, code: "DO-1", dhfId: dhf.id,
        description: "Out A", linkedInputCodes: ["DI-1"],
      },
    });
    await prisma.designVerification.create({
      data: {
        organizationId: org.id, code: "DVE-1", dhfId: dhf.id, result: "PASS",
        verifiedAt: new Date(), verifiedById: "tester",
      },
    });
    const batch = await prisma.productionBatch.create({
      data: {
        organizationId: org.id, code: "LOT-1", deviceId: device.id,
        lotNumber: "L-MD-1", status: "RELEASED", manufacturedAt: new Date(),
      },
    });
    await prisma.deviceTraceability.create({
      data: {
        organizationId: org.id, code: "TRC-1", batchId: batch.id,
        customerAccountRef: "DIST-01",
      },
    });
    await prisma.complaint.create({
      data: {
        organizationId: org.id, code: "CMP-1", deviceId: device.id, batchId: batch.id,
        description: "Queja sin PII", anonymizedSubjectRef: "CASE-1", status: "TRIAGED",
      },
    });
    await prisma.regulatoryRequirement.create({
      data: {
        organizationId: org.id, code: "REG-1", jurisdiction: "UE",
        framework: "MDR", title: "Requisito configurable",
      },
    });
  });

  await t("CHECK rejects complaint email-like subject ref", async () => {
    const device = await prisma.medicalDevice.findFirst({ where: { organizationId: org.id } });
    assert.ok(device);
    try {
      await prisma.complaint.create({
        data: {
          organizationId: org.id, code: "CMP-BAD", deviceId: device.id,
          description: "x", anonymizedSubjectRef: "bad@email.com",
        },
      });
      assert.fail("expected CHECK violation");
    } catch (error) {
      assert.ok(isCheckViolation(error), String(error));
    }
  });

  await t("CHECK rejects DMR APPROVED without approver", async () => {
    const device = await prisma.medicalDevice.findFirst({ where: { organizationId: org.id } });
    assert.ok(device);
    try {
      await prisma.deviceMasterRecord.create({
        data: {
          organizationId: org.id, code: "DMR-BAD", deviceId: device.id, version: "9",
          title: "sin aprobador", status: "APPROVED",
        },
      });
      assert.fail("expected CHECK violation");
    } catch (error) {
      assert.ok(isCheckViolation(error), String(error));
    }
  });

  await t("CHECK rejects purge before retention expires; retention policy is per-org configurable", async () => {
    const device = await prisma.medicalDevice.findFirst({ where: { organizationId: org.id } });
    assert.ok(device);
    const policy = await prisma.mdRetentionPolicy.upsert({
      where: { organizationId: org.id },
      update: { retentionYears: 20 },
      create: { organizationId: org.id, retentionYears: 20 },
    });
    assert.equal(policy.retentionYears, 20);

    const closedAt = new Date();
    const complaint = await prisma.complaint.create({
      data: {
        organizationId: org.id, code: "CMP-RET", deviceId: device.id,
        description: "x", status: "CLOSED", closedAt, retentionUntil: mdRetentionUntil(closedAt, policy.retentionYears),
      },
    });
    try {
      await prisma.complaint.update({ where: { id: complaint.id }, data: { purgedAt: new Date() } });
      assert.fail("expected CHECK violation");
    } catch (error) {
      assert.ok(isCheckViolation(error, "md_complaint_purge_after_retention"), String(error));
    }
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((error) => {
    console.error("\n✗", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
