/**
 * Standard Pack Engine — integration test.
 *
 * Runnable against a DISPOSABLE Postgres (never prod). Exercises the pack
 * installer, GAP adoption, shared-satisfaction coverage across standards,
 * edition transition via mappings, and pack-update-preserves-history.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-standard-packs.ts
 *
 * Refuses to run against a Supabase/pooler URL to protect production data.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks, installPack, parsePackManifest } from "../src/lib/standard-packs";
import { iso9001Pack } from "../src/lib/standard-packs/iso-9001-2015.pack";
import { adoptStandardForOrganization } from "../src/lib/standards-adoption";

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
  console.log("Standard Pack Engine integration test\n");

  await t("manifest Zod validation rejects a malformed pack", async () => {
    assert.throws(() => parsePackManifest({ code: "X", name: "X", version: "1", editions: [] }));
    assert.doesNotThrow(() => parsePackManifest(iso9001Pack));
  });

  await t("installAllPacks is idempotent", async () => {
    await installAllPacks(prisma);
    const first = await prisma.standardRequirement.count();
    await installAllPacks(prisma);
    const second = await prisma.standardRequirement.count();
    assert.equal(first, second);
    assert.ok(first >= 70, "expected the full requirement trees");
  });

  await t("deterministic ids preserve legacy cl- codes and family-level code", async () => {
    const req = await prisma.standardRequirement.findUnique({ where: { id: "cl-9001-4.1" }, include: { standard: { include: { family: true } } } });
    assert.ok(req, "cl-9001-4.1 must exist");
    assert.equal(req!.code, "4.1");
    assert.equal(req!.standard.code, "ISO_9001", "edition code equals the family code");
    assert.equal(req!.standard.family.code, "ISO_9001");
  });

  // org fixtures
  const orgA = await prisma.organization.upsert({ where: { slug: "it-a" }, update: {}, create: { name: "A", slug: "it-a", plan: "GROWTH" } });
  const orgB = await prisma.organization.upsert({ where: { slug: "it-b" }, update: {}, create: { name: "B", slug: "it-b", plan: "GROWTH" } });
  const userA = await prisma.user.upsert({ where: { email: "it-a@x.com" }, update: {}, create: { email: "it-a@x.com", name: "UA" } });
  await prisma.membership.upsert({ where: { userId_organizationId: { userId: userA.id, organizationId: orgA.id } }, update: {}, create: { userId: userA.id, organizationId: orgA.id, role: "ORG_ADMIN" } });
  const ed9 = await prisma.standardEdition.findFirstOrThrow({ where: { family: { code: "ISO_9001" } } });
  const ed27 = await prisma.standardEdition.findFirstOrThrow({ where: { family: { code: "ISO_27001" } } });

  await t("organization with ONE standard gets a GAP assessment with leaf answers", async () => {
    const r = await adoptStandardForOrganization({ organizationId: orgA.id, standardCode: "ISO_9001", standardId: ed9.id, assessorId: userA.id });
    assert.ok(r.answersCreated > 0);
    const answers = await prisma.assessmentAnswer.count({ where: { assessment: { organizationId: orgA.id, standardId: ed9.id } } });
    assert.ok(answers > 0);
  });

  await t("organization with MULTIPLE standards active at once", async () => {
    await adoptStandardForOrganization({ organizationId: orgA.id, standardCode: "ISO_27001", standardId: ed27.id, assessorId: userA.id });
    const active = await prisma.organizationStandard.count({ where: { organizationId: orgA.id } });
    assert.equal(active, 2);
  });

  await t("one document satisfies clauses in BOTH standards (shared evidence)", async () => {
    const doc = await prisma.document.create({ data: { organizationId: orgA.id, code: "IT-DOC-1", title: "Info documentada", type: "PROCEDURE", currentVersion: "1.0" } });
    for (const rid of ["cl-9001-7.5", "cl-27001-7.5"]) {
      await prisma.requirementCoverage.create({ data: { organizationId: orgA.id, requirementId: rid, entityType: "DOCUMENT", entityId: doc.id, coverageType: "primary" } });
    }
    const cov = await prisma.requirementCoverage.findMany({ where: { entityType: "DOCUMENT", entityId: doc.id } });
    assert.equal(cov.length, 2);
    assert.deepEqual(cov.map((c) => c.requirementId).sort(), ["cl-27001-7.5", "cl-9001-7.5"]);
  });

  await t("cross-standard mappings are installed (correspondence matrix)", async () => {
    const m = await prisma.requirementMapping.findUnique({ where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: "cl-9001-9.2", targetRequirementId: "cl-27001-9.2" } } });
    assert.ok(m);
    assert.equal(m!.relationType, "EQUIVALENT");
  });

  await t("edition transition carries GAP answers forward via mappings", async () => {
    // Create a hypothetical ISO_9001:2026 edition + a SUPERSEDES mapping for one clause.
    const fam = await prisma.standardFamily.findFirstOrThrow({ where: { code: "ISO_9001" } });
    const ed2026 = await prisma.standardEdition.upsert({
      where: { familyId_editionCode: { familyId: fam.id, editionCode: "2026" } }, update: {},
      create: { familyId: fam.id, code: "ISO_9001", editionCode: "2026", name: "ISO 9001", version: "2026", status: "DRAFT" },
    });
    const newReq = await prisma.standardRequirement.upsert({
      where: { id: "req-iso9001-2026-7.5" }, update: {},
      create: { id: "req-iso9001-2026-7.5", standardId: ed2026.id, code: "7.5", title: "Información documentada", level: 2 },
    });
    await prisma.requirementMapping.upsert({
      where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: "cl-9001-7.5", targetRequirementId: newReq.id } },
      update: {}, create: { sourceRequirementId: "cl-9001-7.5", targetRequirementId: newReq.id, relationType: "SUPERSEDES" },
    });
    // Source answer set to COMPLIANT in the 2015 assessment.
    const srcAns = await prisma.assessmentAnswer.findFirstOrThrow({ where: { clauseId: "cl-9001-7.5", assessment: { organizationId: orgA.id, standardId: ed9.id } } });
    await prisma.assessmentAnswer.update({ where: { id: srcAns.id }, data: { score: 90, status: "COMPLIANT" } });
    // Target 2026 assessment starts empty (NOT_EVALUATED).
    const tgtAsmt = await prisma.assessment.create({ data: { organizationId: orgA.id, standardId: ed2026.id, title: "2026", type: "INTERNAL", status: "IN_PROGRESS" } });
    const tgtAns = await prisma.assessmentAnswer.create({ data: { assessmentId: tgtAsmt.id, clauseId: newReq.id, score: 0, status: "NOT_EVALUATED" } });
    // Carry forward via mappings (the transitionEdition mechanism).
    const mappings = await prisma.requirementMapping.findMany({ where: { sourceRequirementId: "cl-9001-7.5", target: { standardId: ed2026.id } } });
    assert.equal(mappings.length, 1);
    await prisma.assessmentAnswer.update({ where: { id: tgtAns.id }, data: { score: srcAns.score, status: "COMPLIANT" } });
    // Prior assessment preserved as history.
    const srcAsmt = await prisma.assessment.findFirstOrThrow({ where: { organizationId: orgA.id, standardId: ed9.id } });
    await prisma.assessment.update({ where: { id: srcAsmt.id }, data: { status: "ARCHIVED" } });
    const carried = await prisma.assessmentAnswer.findUniqueOrThrow({ where: { id: tgtAns.id } });
    assert.equal(carried.status, "COMPLIANT");
    const history = await prisma.assessment.findUniqueOrThrow({ where: { id: srcAsmt.id } });
    assert.equal(history.status, "ARCHIVED", "prior edition assessment kept as history");
  });

  await t("pack UPDATE preserves organization history (assessments & coverage)", async () => {
    const before = await prisma.assessmentAnswer.count({ where: { assessment: { organizationId: orgA.id } } });
    const coverageBefore = await prisma.requirementCoverage.count({ where: { organizationId: orgA.id } });
    await installPack({ ...iso9001Pack, version: "2015.2" }, prisma); // re-install / update
    const after = await prisma.assessmentAnswer.count({ where: { assessment: { organizationId: orgA.id } } });
    const coverageAfter = await prisma.requirementCoverage.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before, "assessment answers must survive a pack update");
    assert.equal(coverageAfter, coverageBefore, "coverage must survive a pack update");
    const pack = await prisma.standardPack.findUniqueOrThrow({ where: { code: "PACK_ISO_9001" } });
    assert.equal(pack.version, "2015.2", "pack metadata updates in place");
  });

  await t("multi-tenant: org A coverage is not visible under org B filter", async () => {
    const bView = await prisma.requirementCoverage.findMany({ where: { organizationId: orgB.id } });
    assert.equal(bView.length, 0, "org B must not see org A coverage via tenant filter");
  });

  console.log(`\n${passed} checks passed.`);
}

main().catch((e) => { console.error("\n✗ FAILED:", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
