/**
 * ISO 37001 anti-bribery management system — integration test.
 *
 * Pure workflow/privacy checks always run. DB checks require a disposable Postgres.
 *
 * Extends compliance: does not recreate obligations, speak-up, Investigation or CAPA.
 * Exercises due-diligence / gift workflows, bribery risk uplift, high-risk approval
 * segregation and DB CHECK constraints on a DISPOSABLE Postgres only.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-antibribery.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import {
  assertDueDiligenceApproval,
  assertDueDiligenceRejection,
  assertDueDiligenceTransition,
  canTransitionDueDiligence,
  nextDueDiligenceStatuses,
  requiresEnhancedReview,
} from "../src/lib/antibribery/due-diligence";
import {
  assertComplianceDecision,
  assertGiftRejection,
  assertGiftTransition,
  canTransitionGift,
  mustReachComplianceReview,
  nextGiftStatuses,
} from "../src/lib/antibribery/gifts";
import { assertBriberyAssessmentApproval, computeBriberyRisk } from "../src/lib/antibribery/risk";
import {
  assertHighRiskApproval,
  assertHighRiskRejection,
  assertHighRiskTransition,
  requiresIndependentApproval,
} from "../src/lib/antibribery/approvals";

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
  console.log("ISO 37001 anti-bribery management system integration test\n");

  await t("due diligence workflow graph", async () => {
    assert.deepEqual(nextDueDiligenceStatuses("DRAFT"), ["SCREENING"]);
    assert.ok(canTransitionDueDiligence("SCREENING", "REVIEW"));
    assert.ok(canTransitionDueDiligence("REVIEW", "ENHANCED_REVIEW"));
    assert.ok(canTransitionDueDiligence("APPROVED", "PERIODIC_REVIEW"));
    assert.throws(() => assertDueDiligenceTransition("DRAFT", "APPROVED"), /Transición/);
    assert.throws(() => assertDueDiligenceApproval({ approvedById: null }), /quién/);
    assert.throws(() => assertDueDiligenceRejection({ rejectedById: "u1", rejectionReason: null }), /motivo/);
    assert.equal(requiresEnhancedReview({ riskTier: "HIGH" }), true);
    assert.equal(requiresEnhancedReview({ riskTier: "LOW", screeningResult: "CLEAR" }), false);
  });

  await t("gift / hospitality workflow and compliance gate", async () => {
    assert.deepEqual(nextGiftStatuses("SUBMITTED"), ["MANAGER_REVIEW"]);
    assert.ok(canTransitionGift("MANAGER_REVIEW", "COMPLIANCE_REVIEW"));
    assert.throws(() => assertGiftTransition("APPROVED", "MANAGER_REVIEW"), /no se reabre/);
    assert.throws(() => assertGiftRejection(null), /motivo/);
    assert.throws(() => assertComplianceDecision({ reviewerId: null }), /quién/);
    assert.equal(mustReachComplianceReview({ aboveThreshold: true, involvesPublicOfficial: false }), true);
    assert.equal(mustReachComplianceReview({ aboveThreshold: false, involvesPublicOfficial: true }), true);
    assert.equal(mustReachComplianceReview({
      aboveThreshold: false, involvesPublicOfficial: false, estimatedValue: 50, policyThreshold: 100,
    }), false);
  });

  await t("bribery risk uplift on country/sector/PEP/third-party", async () => {
    const base = computeBriberyRisk({ inherentLikelihood: 3, inherentImpact: 3, countryRisk: "LOW", sectorRisk: "LOW" });
    const hot = computeBriberyRisk({
      inherentLikelihood: 3, inherentImpact: 3, countryRisk: "CRITICAL", sectorRisk: "HIGH",
      publicOfficialRisk: true, thirdPartyRisk: true,
    });
    assert.ok(hot.inherentScore > base.inherentScore);
    assert.ok(hot.uplift >= 4);
    assert.throws(() => assertBriberyAssessmentApproval({ approvedById: null }), /quién/);
  });

  await t("high-risk approval segregation", async () => {
    assertHighRiskTransition("REQUESTED", "UNDER_REVIEW");
    assert.throws(() => assertHighRiskTransition("APPROVED", "REQUESTED"), /Transición/);
    assert.throws(() => assertHighRiskApproval({ approvedById: null }), /quién/);
    assert.throws(() => assertHighRiskRejection(null), /motivo/);
    assert.throws(
      () => requiresIndependentApproval({
        involvesPublicOfficial: true, transactionType: "AGENT_COMMISSION",
        requestedById: "u1", approvedById: "u1",
      }),
      /no puede aprobarla/,
    );
  });

  if (!prisma) {
    console.log(`\n${passed} pure checks passed (DB skipped — set disposable DATABASE_URL for full suite).`);
    return;
  }

  await t("ISO 37001 pack installs after 37301 (family, requirements, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_37001" } }), "ISO_37001 family");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37001-4.5" } }), "bribery risk 4.5");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37001-8.2" } }), "due diligence 8.2");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37001-8.7" } }), "gifts 8.7");
    const speakUpMap = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-37001-8.9",
          targetRequirementId: "req-iso-37301-8.3",
        },
      },
    });
    assert.ok(speakUpMap && speakUpMap.relationType === "EQUIVALENT", "37001 8.9 ⇄ 37301 8.3 speak-up reuse");
    const invMap = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-37001-8.10",
          targetRequirementId: "req-iso-37301-8.4",
        },
      },
    });
    assert.ok(invMap, "37001 investigation bridges to 37301 investigation");
  });

  const org = await prisma.organization.upsert({
    where: { slug: "abms-a" },
    update: {},
    create: { name: "AbmsA", slug: "abms-a", plan: "GROWTH" },
  });
  const owner = await prisma.user.upsert({
    where: { email: "abms-owner@x.com" },
    update: {},
    create: { email: "abms-owner@x.com", name: "Elena Antisoborno" },
  });

  await t("business associate + due diligence persist", async () => {
    const associate = await prisma.businessAssociate.create({
      data: {
        organizationId: org.id, code: "SOC-0001", name: "Agente Demo",
        associateType: "AGENT", riskTier: "HIGH", interactsWithPEPs: true,
        ownerId: owner.id, createdById: owner.id,
      },
    });
    const dd = await prisma.dueDiligenceCase.create({
      data: {
        organizationId: org.id, code: "DD-0001", associateId: associate.id,
        level: "ENHANCED", status: "DRAFT", createdById: owner.id,
      },
    });
    assert.equal(dd.status, "DRAFT");
    await prisma.dueDiligenceCase.update({
      where: { id: dd.id },
      data: { status: "SCREENING", screeningResult: "CLEAR" },
    });
  });

  await t("CHECK: due diligence approval without approver is rejected", async () => {
    const dd = await prisma.dueDiligenceCase.findFirst({ where: { organizationId: org.id, code: "DD-0001" } });
    assert.ok(dd);
    await prisma.dueDiligenceCase.update({ where: { id: dd.id }, data: { status: "ENHANCED_REVIEW" } });
    await assert.rejects(
      prisma.dueDiligenceCase.update({
        where: { id: dd.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      }),
      (error: unknown) => isCheckViolation(error, "due_diligence_cases_approval_attributed"),
      "CHECK: APPROVED exige approvedById",
    );
    await prisma.dueDiligenceCase.update({
      where: { id: dd.id },
      data: { status: "APPROVED", approvedById: owner.id, approvedAt: new Date(), nextReviewDate: new Date() },
    });
  });

  await t("CHECK: gift APPROVED without compliance reviewer is rejected", async () => {
    await assert.rejects(
      prisma.giftHospitalityRecord.create({
        data: {
          organizationId: org.id, code: "RGH-BAD", description: "Regalo sin revisor",
          status: "APPROVED", submittedById: owner.id,
        },
      }),
      (error: unknown) => isCheckViolation(error, "gift_hospitality_compliance_decision_attributed"),
      "CHECK: APPROVED/REJECTED exige complianceReviewerId",
    );
    const gift = await prisma.giftHospitalityRecord.create({
      data: {
        organizationId: org.id, code: "RGH-0001", description: "Hospitalidad con decisión",
        status: "APPROVED", submittedById: owner.id,
        complianceReviewerId: owner.id, complianceReviewedAt: new Date(),
        involvesPublicOfficial: true, aboveThreshold: true,
      },
    });
    assert.equal(gift.status, "APPROVED");
  });

  await t("CHECK: AB investigation closure requires outcome", async () => {
    await assert.rejects(
      prisma.antiBriberyInvestigation.create({
        data: {
          organizationId: org.id, code: "ISB-BAD",
          investigationId: "inv-placeholder-1", status: "CLOSED", closedAt: new Date(),
        },
      }),
      (error: unknown) => isCheckViolation(error, "abms_investigations_closure_has_outcome"),
      "CHECK: cierre exige outcome",
    );
    const row = await prisma.antiBriberyInvestigation.create({
      data: {
        organizationId: org.id, code: "ISB-0001",
        investigationId: "inv-placeholder-2", status: "ACTIVE",
        allegationType: "KICKBACK", involvesPublicOfficial: true, createdById: owner.id,
      },
    });
    assert.equal(row.status, "ACTIVE");
  });

  await t("beneficial owner + high-risk approval persist", async () => {
    const associate = await prisma.businessAssociate.findFirst({ where: { organizationId: org.id, code: "SOC-0001" } });
    assert.ok(associate);
    const ubo = await prisma.beneficialOwner.create({
      data: {
        organizationId: org.id, code: "UBO-0001", associateId: associate.id,
        fullName: "Persona Controladora", ownershipPercent: 55, isPep: true, pepRole: "Cargo local",
      },
    });
    assert.equal(ubo.isPep, true);
    const hr = await prisma.highRiskTransactionApproval.create({
      data: {
        organizationId: org.id, code: "OAR-0001", title: "Comisión de agente",
        transactionType: "AGENT_COMMISSION", amount: 10000, currency: "EUR",
        associateId: associate.id, involvesPublicOfficial: true,
        status: "REQUESTED", requestedById: owner.id,
      },
    });
    assert.equal(hr.status, "REQUESTED");
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
