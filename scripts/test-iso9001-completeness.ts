/**
 * ISO 9001 completeness gap-closure — integration test.
 *
 * Exercises the new structured capture built to close the "depends on free
 * documents" gaps: organizational context (4.2/6.2, standalone — no SIG
 * required), quality operations (7.2, 7.4, 8.5.3, 8.5.4, 9.1.2), and generic
 * design & development (8.3).
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-iso9001-completeness.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabase, assertTenantIsolated, createTenantPair, TestRunner } from "./lib/pack-test-factory";

assertDisposableDatabase();
const prisma = new PrismaClient();

async function main() {
  const t = new TestRunner("ISO 9001 completeness — organizational context, quality operations, design & development");
  const runKey = `iso9001c-${process.pid}-${Date.now()}`;
  const { orgA, orgB, userA } = await createTenantPair(prisma, runKey, { plan: "GROWTH" });

  // ── Organizational context (standalone, no SIG) ──
  await t.t("interested party + objective persist without any IntegratedSystem row", async () => {
    const hasSystem = await prisma.integratedSystem.findUnique({ where: { organizationId: orgA.id } });
    assert.equal(hasSystem, null, "precondition: org has not adopted the Integrated System");

    const party = await prisma.interestedParty.create({
      data: { organizationId: orgA.id, code: "PI-0001", name: "Cliente principal", influence: 5, dependency: 4, createdById: userA.id },
    });
    const objective = await prisma.integratedObjective.create({
      data: { organizationId: orgA.id, code: "OBJ-0001", title: "Reducir reclamos 20%", targetValue: 20, currentValue: 5, unit: "%", createdById: userA.id },
    });
    assert.ok(party.id && objective.id, "both persist with zero IntegratedSystem dependency");
  });

  // ── Customer requirements (7.2) ──
  const req = await prisma.customerRequirement.create({
    data: { organizationId: orgA.id, code: "REQ-CLI-0001", title: "Certificado de origen en cada envío", source: "Contrato marco 2026", createdById: userA.id },
  });
  await t.t("customer requirement defaults to OPEN and can be reviewed", async () => {
    assert.equal(req.status, "OPEN");
    const updated = await prisma.customerRequirement.update({ where: { id: req.id }, data: { status: "MET", reviewedById: userA.id, reviewedAt: new Date() } });
    assert.equal(updated.status, "MET");
  });

  // ── Customer property (8.5.3) — CHECK: LOST_OR_DAMAGED requires incidentNote ──
  const property = await prisma.customerProperty.create({
    data: { organizationId: orgA.id, code: "PROP-CLI-0001", description: "Molde de inyección", customerName: "Cliente X", createdById: userA.id },
  });
  await t.t("CHECK: customer property marked LOST_OR_DAMAGED without incidentNote is rejected", async () => {
    await assert.rejects(
      prisma.customerProperty.update({ where: { id: property.id }, data: { status: "LOST_OR_DAMAGED" } }),
      /violates check constraint|customer_properties_incident_requires_note/,
    );
    const ok = await prisma.customerProperty.update({ where: { id: property.id }, data: { status: "LOST_OR_DAMAGED", incidentNote: "Dañado en transporte, cliente notificado." } });
    assert.equal(ok.status, "LOST_OR_DAMAGED");
  });

  // ── Preservation (8.5.4) ──
  await t.t("preservation record captures handling/storage/packaging", async () => {
    const rec = await prisma.preservationRecord.create({
      data: { organizationId: orgA.id, code: "PRES-0001", itemDescription: "Lote 2026-07", storageConditions: "Refrigerado 2-8°C", status: "COMPLIANT", createdById: userA.id },
    });
    assert.equal(rec.status, "COMPLIANT");
  });

  // ── Customer satisfaction (9.1.2) — CHECK: score 0-100 ──
  await t.t("CHECK: customer feedback score out of range is rejected", async () => {
    await assert.rejects(
      prisma.customerFeedback.create({ data: { organizationId: orgA.id, code: "SAT-0001", score: 150, createdById: userA.id } }),
      /violates check constraint|customer_feedback_score_range/,
    );
    const ok = await prisma.customerFeedback.create({ data: { organizationId: orgA.id, code: "SAT-0002", score: 87, channel: "SURVEY", createdById: userA.id } });
    assert.equal(ok.score, 87);
  });

  // ── Communication (7.4 — shared clause with ISO 27001) ──
  await t.t("communication record can be tagged for multiple standards", async () => {
    const comm = await prisma.communicationRecord.create({
      data: { organizationId: orgA.id, code: "COM-0001", subject: "Cambio de política de calidad", direction: "INTERNAL", standards: ["ISO_9001", "ISO_27001"], createdById: userA.id },
    });
    assert.deepEqual(comm.standards.sort(), ["ISO_27001", "ISO_9001"]);
  });

  // ── Design & development (8.3) — generic, not medical-devices-scoped ──
  const project = await prisma.designProject.create({
    data: { organizationId: orgA.id, code: "PDD-0001", name: "Nuevo servicio de onboarding remoto", createdById: userA.id },
  });
  await t.t("design project has no deviceId — usable by any org, not only ISO 13485", async () => {
    assert.ok(!("deviceId" in project), "DesignProject must not require a MedicalDevice, unlike DesignHistoryFile");
  });

  const stage = await prisma.designStage.create({
    data: { organizationId: orgA.id, projectId: project.id, code: "STG-0001", stageType: "INPUT", title: "Requisitos de UX remoto", createdById: userA.id },
  });
  await t.t("CHECK: design stage marked COMPLETED without a result is rejected", async () => {
    await assert.rejects(
      prisma.designStage.update({ where: { id: stage.id }, data: { status: "COMPLETED" } }),
      /violates check constraint|design_stages_completed_requires_result/,
    );
    const ok = await prisma.designStage.update({ where: { id: stage.id }, data: { status: "COMPLETED", result: "Requisitos validados con 5 usuarios piloto." } });
    assert.equal(ok.status, "COMPLETED");
  });

  await t.t("CHECK: design project marked COMPLETED without completedAt is rejected", async () => {
    await assert.rejects(
      prisma.designProject.update({ where: { id: project.id }, data: { status: "COMPLETED" } }),
      /violates check constraint|design_projects_completed_has_date/,
    );
    const ok = await prisma.designProject.update({ where: { id: project.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    assert.equal(ok.status, "COMPLETED");
  });

  // ── Tenant isolation across every new table ──
  await t.t("multi-tenant: org B sees none of org A's new quality/design records", async () => {
    await assertTenantIsolated(prisma.interestedParty, orgB.id);
    await assertTenantIsolated(prisma.integratedObjective, orgB.id);
    await assertTenantIsolated(prisma.customerRequirement, orgB.id);
    await assertTenantIsolated(prisma.customerProperty, orgB.id);
    await assertTenantIsolated(prisma.preservationRecord, orgB.id);
    await assertTenantIsolated(prisma.customerFeedback, orgB.id);
    await assertTenantIsolated(prisma.communicationRecord, orgB.id);
    await assertTenantIsolated(prisma.designProject, orgB.id);
    await assertTenantIsolated(prisma.designStage, orgB.id);
  });

  t.summary();
}

main().catch((error) => {
  console.error("\n✗ FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
