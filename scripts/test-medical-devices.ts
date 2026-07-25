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
  assertComplaintTransition,
  assertRecallTransition,
  assertRecordApproval,
  assertRecordTransition,
  assertTestResultAttribution,
  designInputCoverage,
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
