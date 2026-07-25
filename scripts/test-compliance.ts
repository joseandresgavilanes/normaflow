/**
 * ISO 37301 compliance management system — integration test.
 *
 * Runnable against a DISPOSABLE Postgres (never prod). Exercises the speak-up
 * channel (anonymity, need-to-know independence of investigation, retention),
 * applicability decisions, risk valuation, evaluation review, calendar alerts,
 * breach notification, remediation verification and governing-body digests —
 * both as pure domain rules and as DB CHECK constraints.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-compliance.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import {
  assertApplicabilityDecision,
  rollupApplicability,
} from "../src/lib/compliance/applicability";
import {
  assertRiskAcceptance,
  computeComplianceRisk,
  levelFromScore,
} from "../src/lib/compliance/risk";
import {
  assertCalendarCompletion,
  calendarState,
  daysUntil,
  dueAlerts,
  nextOccurrence,
} from "../src/lib/compliance/calendar";
import {
  assertReviewTransition,
  assertReviewerPresent,
  canTransitionReview,
  statusFromResult,
} from "../src/lib/compliance/evaluation";
import {
  assertAdmissibilityDecision,
  assertClosure,
  assertIdentityConsistent,
  assertModeAllowed,
  assertPurgeable,
  assertStatusTransition,
  canTransitionStatus,
  caseDeadlines,
  caseIntegrity,
  chooseHandler,
  deadlineBreaches,
  identityForMode,
  retentionUntil,
} from "../src/lib/compliance/speak-up";
import {
  assertIndependence,
  assertInvestigationTransition,
  assertRecusal,
  checkIndependence,
} from "../src/lib/compliance/investigation";
import {
  assertBreachClosure,
  assertBreachTransition,
  nextBreachStatuses,
  notificationOverdue,
  requiresNotificationDecision,
} from "../src/lib/compliance/breach";
import {
  assertEffectivenessVerification,
  assertRemediationTransition,
  effectiveStatus,
} from "../src/lib/compliance/remediation";
import {
  assertAcknowledgement,
  buildGoverningBodyDigest,
} from "../src/lib/compliance/governing-body";

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

function isCheckViolation(error: unknown, constraint: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(constraint) || /violates check constraint/i.test(message);
}

async function main() {
  console.log("ISO 37301 compliance management system integration test\n");

  await t("ISO 37301 pack installs (family, edition, requirements, mappings)", async () => {
    await installAllPacks(prisma);
    assert.ok(await prisma.standardFamily.findUnique({ where: { code: "ISO_37301" } }), "ISO_37301 family");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37301-4.6" } }), "obligations clause 4.6");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37301-8.3" } }), "speak-up clause 8.3");
    assert.ok(await prisma.standardRequirement.findUnique({ where: { id: "req-iso-37301-8.4" } }), "investigation clause 8.4");
    const map = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-37301-9.2",
          targetRequirementId: "cl-9001-9.2",
        },
      },
    });
    assert.ok(map && map.relationType === "EQUIVALENT", "37301 9.2 ⇄ 9001 9.2 mapping");
    const channelMap = await prisma.requirementMapping.findUnique({
      where: {
        sourceRequirementId_targetRequirementId: {
          sourceRequirementId: "req-iso-37301-8.3",
          targetRequirementId: "req-iso-42001-A.3.3",
        },
      },
    });
    assert.ok(channelMap, "speak-up ⇄ AI concerns channel mapping");
  });

  // ── applicability ──
  await t("applicability: a decision requires rationale and assessor", async () => {
    assert.throws(() => assertApplicabilityDecision({ decision: "APPLICABLE", rationale: null, assessedById: "u1" }), /motivo/);
    assert.throws(() => assertApplicabilityDecision({ decision: "NOT_APPLICABLE", rationale: "fuera de alcance", assessedById: null }), /quién/);
    assertApplicabilityDecision({ decision: "APPLICABLE", rationale: "Operamos en ES", assessedById: "u1" });
    const rollup = rollupApplicability([
      { jurisdictionCode: "ES", decision: "APPLICABLE" },
      { jurisdictionCode: "MX", decision: "NOT_APPLICABLE" },
      { jurisdictionCode: "EU", decision: "UNDER_ASSESSMENT" },
    ]);
    assert.equal(rollup.decision, "PARTIALLY_APPLICABLE");
    assert.equal(rollup.incomplete, true);
    assert.equal(rollup.pending, 1);
    assert.ok(rollup.applicableIn.includes("ES"));
  });

  // ── risk ──
  await t("compliance risk: likelihood × impact, residual and acceptance", async () => {
    assert.equal(levelFromScore(4), "LOW");
    assert.equal(levelFromScore(12), "HIGH");
    const r = computeComplianceRisk({ likelihood: 4, impact: 5, controlEffectiveness: 50 });
    assert.equal(r.inherentScore, 20);
    assert.equal(r.inherentLevel, "CRITICAL");
    assert.ok(r.residualScore < r.inherentScore);
    assert.throws(
      () => assertRiskAcceptance({ acceptability: "NOT_ACCEPTABLE", rationale: null, acceptedById: "u1" }),
      /justificación|motivo|acept/,
    );
  });

  // ── calendar ──
  await t("calendar: state, alerts, recurrence and completion attribution", async () => {
    const today = new Date("2026-07-24T12:00:00.000Z");
    const due = new Date("2026-07-20T12:00:00.000Z");
    assert.equal(daysUntil(due, today), -4);
    const overdue = calendarState({ dueDate: due, leadTimeDays: 7, today });
    assert.equal(overdue.status, "OVERDUE");
    assert.equal(overdue.alertDue, true);
    const soon = calendarState({ dueDate: new Date("2026-07-28T12:00:00.000Z"), leadTimeDays: 7, today });
    assert.equal(soon.status, "DUE_SOON");
    const next = nextOccurrence(new Date("2026-01-31T00:00:00.000Z"), "MONTHLY");
    assert.ok(next);
    assert.throws(() => assertCalendarCompletion({ completedById: null }), /quién/);
    const alerts = dueAlerts(
      [{ id: "1", code: "C1", title: "x", dueDate: due, leadTimeDays: 7, responsibleId: "u1" }],
      today,
    );
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].status, "OVERDUE");
  });

  // ── evaluation review ──
  await t("evaluation: DRAFT cannot jump to APPROVED; reviewer is required", async () => {
    assert.equal(canTransitionReview("DRAFT", "APPROVED"), false);
    assert.throws(() => assertReviewTransition("DRAFT", "APPROVED"), /revisión|UNDER_REVIEW|permitida/i);
    assertReviewTransition("DRAFT", "UNDER_REVIEW");
    assertReviewTransition("UNDER_REVIEW", "APPROVED");
    assert.throws(
      () => assertReviewerPresent({ reviewStatus: "APPROVED", reviewerId: null, reviewedAt: new Date() }),
      /revisor/,
    );
    assert.equal(statusFromResult("NON_COMPLIANT"), "NON_COMPLIANT");
    assert.equal(statusFromResult("COMPLIANT"), "COMPLIANT");
  });

  // ── speak-up channel ──
  await t("speak-up: anonymity wipes identity and mode must be allowed", async () => {
    assert.throws(
      () => assertModeAllowed("ANONYMOUS", { allowAnonymous: false, allowConfidential: true, acknowledgementDays: 7, feedbackDays: 90, retentionMonths: 60 }),
      /no admite denuncias anónimas/,
    );
    const wiped = identityForMode("ANONYMOUS", {
      reporterUserId: "u1",
      reporterName: "Ana",
      reporterEmail: "a@x.com",
      reporterPhone: "600",
    });
    assert.deepEqual(wiped, {
      reporterUserId: null,
      reporterName: null,
      reporterEmail: null,
      reporterPhone: null,
    });
    assert.throws(
      () => assertIdentityConsistent("ANONYMOUS", { reporterUserId: "u1", reporterName: null, reporterEmail: null, reporterPhone: null }),
      /anónima/,
    );
    assertIdentityConsistent("IDENTIFIED", {
      reporterUserId: "u1",
      reporterName: null,
      reporterEmail: null,
      reporterPhone: null,
    });
  });

  await t("speak-up: case flow is linear; triage requires acknowledgement first", async () => {
    assert.equal(canTransitionStatus("RECEIVED", "UNDER_TRIAGE"), false);
    assert.throws(() => assertStatusTransition("RECEIVED", "UNDER_TRIAGE"), /acusar recibo/);
    assertStatusTransition("RECEIVED", "ACKNOWLEDGED");
    assertStatusTransition("ACKNOWLEDGED", "UNDER_TRIAGE");
    assert.deepEqual(
      ["ADMISSIBLE", "INADMISSIBLE"].sort(),
      (["ADMISSIBLE", "INADMISSIBLE"] as const).filter((s) => canTransitionStatus("UNDER_TRIAGE", s)).sort(),
    );
    assert.throws(() => assertAdmissibilityDecision({ decidedById: null, rationale: "motivo" }), /quién/);
    assert.throws(() => assertClosure({ outcome: null, summary: "ok", closedById: "u1" }), /resultado/);
  });

  await t("speak-up: deadlines, retention and purge gates", async () => {
    const receivedAt = new Date("2026-07-01T00:00:00.000Z");
    const config = { allowAnonymous: true, allowConfidential: true, acknowledgementDays: 7, feedbackDays: 90, retentionMonths: 60 };
    const deadlines = caseDeadlines(receivedAt, config);
    assert.ok(deadlines.acknowledgementDueAt > receivedAt);
    assert.ok(deadlines.feedbackDueAt > deadlines.acknowledgementDueAt);
    const overdue = deadlineBreaches(
      {
        acknowledgementDueAt: new Date("2026-07-05T00:00:00.000Z"),
        acknowledgedAt: null,
        feedbackDueAt: new Date("2026-10-01T00:00:00.000Z"),
        feedbackProvidedAt: null,
        status: "ACKNOWLEDGED",
      },
      new Date("2026-07-10T00:00:00.000Z"),
    );
    assert.equal(overdue.acknowledgementOverdue, true);
    const closedAt = new Date("2026-07-15T00:00:00.000Z");
    const until = retentionUntil(closedAt, config);
    assert.ok(until.getUTCFullYear() === 2031);
    assert.throws(
      () => assertPurgeable({ status: "CLOSED", retentionUntil: until, purgedAt: null }, new Date("2026-08-01T00:00:00.000Z")),
      /retención|purg/,
    );
    assert.equal(
      caseIntegrity({
        identificationMode: "ANONYMOUS",
        reporterUserId: "u1",
        status: "RECEIVED",
      }).valid,
      false,
    );
  });

  await t("speak-up: handler selection diverts on conflict of interest", async () => {
    const diverted = chooseHandler({
      defaultHandlerId: "handler-1",
      alternateHandlerId: "handler-2",
      fallbackIds: ["handler-3"],
      subjectUserId: "handler-1",
      reporterUserId: null,
    });
    assert.equal(diverted.handlerId, "handler-2");
    assert.equal(diverted.divertedFromDefault, true);
  });

  // ── investigation independence ──
  await t("investigation: subject and declared conflict cannot investigate", async () => {
    const conflict = checkIndependence({
      investigatorId: "u1",
      subjectUserId: "u1",
      declarations: [],
    });
    assert.equal(conflict.conflictDetected, true);
    assert.throws(() => assertIndependence({ investigatorId: "u1", subjectUserId: "u1" }), /señalada/);
    assert.throws(
      () =>
        assertIndependence({
          investigatorId: "u2",
          subjectUserId: "u9",
          declarations: [
            {
              declarantId: "u2",
              hasConflict: true,
              recusalRequired: true,
              reviewStatus: "ACCEPTED",
              relatedParty: "Proveedor X",
            },
          ],
        }),
      /conflicto/,
    );
    assert.throws(() => assertRecusal({ reason: null, reassignedToId: "u3" }), /motivo/);
    assert.throws(() => assertRecusal({ reason: "conflicto", reassignedToId: "u9", subjectUserId: "u9" }), /señalad/);
    assertInvestigationTransition("PLANNED", "ACTIVE");
  });

  // ── breach + remediation ──
  await t("breach: linear transitions, notification and closure signature", async () => {
    assert.deepEqual(nextBreachStatuses("OPEN"), ["UNDER_ANALYSIS"]);
    assertBreachTransition("OPEN", "UNDER_ANALYSIS");
    assert.throws(() => assertBreachTransition("OPEN", "CLOSED"), /permitida|no se puede/i);
    assert.equal(requiresNotificationDecision("DATA_PROTECTION", "MAJOR"), true);
    assert.equal(
      notificationOverdue(
        {
          notificationRequired: true,
          notificationDeadline: new Date("2026-07-01T00:00:00.000Z"),
          authorityNotifiedAt: null,
        },
        new Date("2026-07-10T00:00:00.000Z"),
      ),
      true,
    );
    assert.throws(
      () =>
        assertBreachClosure({
          closedById: null,
          rootCause: "causa",
          remediationVerified: true,
          notificationRequired: false,
          authorityNotifiedAt: null,
        }),
      /quién|cierra/i,
    );
  });

  await t("remediation: verifier cannot be the owner; overdue is derived", async () => {
    assertRemediationTransition("DRAFT", "APPROVED");
    assert.throws(
      () =>
        assertEffectivenessVerification({
          status: "COMPLETED",
          completedAt: new Date(),
          ownerId: "u1",
          verifierId: "u1",
          note: "ok",
        }),
      /propietario|responsable/i,
    );
    const overdue = effectiveStatus(
      {
        status: "IN_PROGRESS",
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        completedAt: null,
      },
      new Date("2026-07-24T00:00:00.000Z"),
    );
    assert.equal(overdue, "OVERDUE");
  });

  // ── governing body ──
  await t("governing body: digest anonymizes the channel and lists escalations", async () => {
    const digest = buildGoverningBodyDigest({
      obligations: [
        { complianceStatus: "NON_COMPLIANT", criticality: "HIGH" },
        { complianceStatus: "NOT_EVALUATED", criticality: "MEDIUM" },
        { complianceStatus: "COMPLIANT", criticality: "LOW" },
      ],
      risks: [
        { residualLevel: "CRITICAL", acceptability: "NOT_ACCEPTABLE" },
        { residualLevel: "LOW", acceptability: "ACCEPTABLE" },
      ],
      evaluations: [
        { result: "COMPLIANT", reviewStatus: "APPROVED" },
        { result: "PARTIALLY_COMPLIANT", reviewStatus: "UNDER_REVIEW" },
      ],
      calendar: { overdue: 2, dueSoon: 1, onTimeRate: 80 },
      cases: [
        {
          category: "FRAUD",
          status: "UNDER_INVESTIGATION",
          outcome: null,
          anonymous: true,
          acknowledgementOverdue: true,
          feedbackOverdue: false,
        },
        {
          category: "HARASSMENT",
          status: "CLOSED",
          outcome: "SUBSTANTIATED",
          anonymous: false,
          acknowledgementOverdue: false,
          feedbackOverdue: false,
        },
      ],
      investigations: [
        { status: "ACTIVE", conflictDetected: true },
        { status: "CLOSED", conflictDetected: false },
      ],
      breaches: [{ status: "OPEN", severity: "SEVERE", sanctionAmount: 1000 }],
      remediation: { completed: 1, overdue: 0, completedNotVerified: 1 },
      training: [{ targetCount: 100, completedCount: 70, mandatory: true }],
    });
    assert.equal(digest.speakUp.total, 2);
    assert.equal(digest.speakUp.anonymous, 1);
    assert.equal(digest.speakUp.substantiated, 1);
    assert.ok(digest.escalations.length >= 4);
    assert.ok(!JSON.stringify(digest).includes("reporter"));
    assert.throws(() => assertAcknowledgement({ acknowledgedById: null }), /quién|acus/i);
  });

  // ── fixtures + DB constraints ──
  const orgA = await prisma.organization.upsert({
    where: { slug: "cmp-a" },
    update: {},
    create: { name: "CmpA", slug: "cmp-a", plan: "GROWTH" },
  });
  const orgB = await prisma.organization.upsert({
    where: { slug: "cmp-b" },
    update: {},
    create: { name: "CmpB", slug: "cmp-b", plan: "GROWTH" },
  });
  const owner = await prisma.user.upsert({
    where: { email: "cmp-owner@x.com" },
    update: {},
    create: { email: "cmp-owner@x.com", name: "Elena Cumplimiento" },
  });
  const handler = await prisma.user.upsert({
    where: { email: "cmp-handler@x.com" },
    update: {},
    create: { email: "cmp-handler@x.com", name: "Rubén Canal" },
  });
  const subject = await prisma.user.upsert({
    where: { email: "cmp-subject@x.com" },
    update: {},
    create: { email: "cmp-subject@x.com", name: "Persona Señalada" },
  });

  await t("jurisdiction + source + obligation register persists with owner", async () => {
    const jurisdiction = await prisma.jurisdiction.create({
      data: {
        organizationId: orgA.id,
        code: "ES",
        name: "España",
        level: "NATIONAL",
        country: "ES",
        applicable: true,
        rationale: "Domicilio social",
        createdById: owner.id,
      },
    });
    const source = await prisma.regulatorySource.create({
      data: {
        organizationId: orgA.id,
        code: "FTE-0001",
        name: "Ley de protección del informante",
        sourceType: "LAW",
        issuer: "Cortes Generales",
        reference: "Ley 2/2023",
        jurisdictionId: jurisdiction.id,
        monitored: true,
        ownerId: owner.id,
      },
    });
    const obligation = await prisma.complianceObligation.create({
      data: {
        organizationId: orgA.id,
        code: "OBL-0001",
        title: "Canal interno de información",
        requirementText: "Disponer de canal interno con confidencialidad.",
        obligationType: "LEGAL",
        category: "CORPORATE_GOVERNANCE",
        criticality: "CRITICAL",
        sourceId: source.id,
        jurisdictionId: jurisdiction.id,
        ownerId: owner.id,
        applicability: "UNDER_ASSESSMENT",
      },
    });
    assert.equal(obligation.ownerId, owner.id);
    assert.equal(obligation.sourceId, source.id);
  });

  await t("CHECK: applicability decision without rationale is rejected", async () => {
    const obligation = await prisma.complianceObligation.findFirst({
      where: { organizationId: orgA.id, code: "OBL-0001" },
    });
    const jurisdiction = await prisma.jurisdiction.findFirst({
      where: { organizationId: orgA.id, code: "ES" },
    });
    assert.ok(obligation && jurisdiction);
    await assert.rejects(
      prisma.obligationApplicability.create({
        data: {
          organizationId: orgA.id,
          obligationId: obligation.id,
          jurisdictionId: jurisdiction.id,
          decision: "APPLICABLE",
        },
      }),
      (error: unknown) => isCheckViolation(error, "obligation_applicability_decision_requires_rationale"),
      "CHECK: aplicabilidad decidida exige motivo y evaluador",
    );
    await prisma.obligationApplicability.create({
      data: {
        organizationId: orgA.id,
        obligationId: obligation.id,
        jurisdictionId: jurisdiction.id,
        decision: "APPLICABLE",
        rationale: "Operamos y empleamos en España",
        assessedById: owner.id,
        assessedAt: new Date(),
      },
    });
  });

  await t("CHECK: anonymous speak-up report cannot store identity", async () => {
    await prisma.speakUpChannelConfig.upsert({
      where: { organizationId: orgA.id },
      update: { allowAnonymous: true, allowConfidential: true },
      create: {
        organizationId: orgA.id,
        allowAnonymous: true,
        allowConfidential: true,
        acknowledgementDays: 7,
        feedbackDays: 90,
        retentionMonths: 60,
      },
    });
    await assert.rejects(
      prisma.speakUpReport.create({
        data: {
          organizationId: orgA.id,
          code: "DEN-BAD",
          identificationMode: "ANONYMOUS",
          category: "FRAUD",
          description: "Hechos alegados suficientemente concretos para el expediente.",
          reporterName: "No debería guardarse",
        },
      }),
      (error: unknown) => isCheckViolation(error, "speak_up_reports_anonymous_has_no_identity"),
      "CHECK: anónimo sin identidad",
    );
    const anonymous = await prisma.speakUpReport.create({
      data: {
        organizationId: orgA.id,
        code: "DEN-0001",
        identificationMode: "ANONYMOUS",
        category: "FRAUD",
        severity: "HIGH",
        description: "Indicios de fraude en compras. Relato sin datos de identidad.",
      },
    });
    assert.equal(anonymous.reporterUserId, null);
    assert.equal(anonymous.reporterName, null);
  });

  await t("CHECK: investigator cannot be the subject; conflict forces recusal", async () => {
    const report = await prisma.speakUpReport.findFirst({
      where: { organizationId: orgA.id, code: "DEN-0001" },
    });
    assert.ok(report);
    await assert.rejects(
      prisma.investigation.create({
        data: {
          organizationId: orgA.id,
          code: "INV-BAD",
          reportId: report.id,
          title: "Investigación inválida",
          leadInvestigatorId: subject.id,
          subjectUserId: subject.id,
          independenceConfirmed: true,
        },
      }),
      (error: unknown) => isCheckViolation(error, "investigations_lead_is_not_the_subject"),
      "CHECK: instructor ≠ señalado",
    );
    await assert.rejects(
      prisma.investigation.create({
        data: {
          organizationId: orgA.id,
          code: "INV-BAD2",
          reportId: report.id,
          title: "Conflicto sin recusación",
          leadInvestigatorId: handler.id,
          subjectUserId: subject.id,
          conflictDetected: true,
          independenceConfirmed: false,
        },
      }),
      (error: unknown) => isCheckViolation(error, "investigations_conflict_requires_recusal"),
      "CHECK: conflicto obliga a recusar y reasignar",
    );
    const ok = await prisma.investigation.create({
      data: {
        organizationId: orgA.id,
        code: "INV-0001",
        reportId: report.id,
        title: "Investigación de fraude en compras",
        leadInvestigatorId: handler.id,
        subjectUserId: subject.id,
        independenceConfirmed: true,
        conflictChecked: true,
        conflictDetected: false,
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });
    assert.equal(ok.leadInvestigatorId, handler.id);
  });

  await t("CHECK: evaluation approval requires reviewer; remediation verifier ≠ owner", async () => {
    const obligation = await prisma.complianceObligation.findFirst({
      where: { organizationId: orgA.id, code: "OBL-0001" },
    });
    assert.ok(obligation);
    const evaluation = await prisma.complianceEvaluation.create({
      data: {
        organizationId: orgA.id,
        code: "EVC-0001",
        obligationId: obligation.id,
        period: "2026-S1",
        result: "PARTIALLY_COMPLIANT",
        score: 64,
        evaluatedById: owner.id,
        reviewStatus: "UNDER_REVIEW",
      },
    });
    await assert.rejects(
      prisma.complianceEvaluation.update({
        where: { id: evaluation.id },
        data: { reviewStatus: "APPROVED" },
      }),
      (error: unknown) => isCheckViolation(error, "compliance_evaluations_decision_requires_reviewer"),
      "CHECK: aprobación sin revisor",
    );
    await prisma.complianceEvaluation.update({
      where: { id: evaluation.id },
      data: { reviewStatus: "APPROVED", reviewerId: handler.id, reviewedAt: new Date() },
    });

    const breach = await prisma.complianceBreach.create({
      data: {
        organizationId: orgA.id,
        code: "INC-0001",
        title: "Formación del canal incompleta",
        obligationId: obligation.id,
        detectionSource: "INTERNAL_AUDIT",
        severity: "MINOR",
        status: "UNDER_REMEDIATION",
      },
    });
    const plan = await prisma.remediationPlan.create({
      data: {
        organizationId: orgA.id,
        code: "REM-0001",
        title: "Extender formación a turnos",
        breachId: breach.id,
        ownerId: owner.id,
        status: "COMPLETED",
        progressPercent: 100,
        completedAt: new Date(),
      },
    });
    await assert.rejects(
      prisma.remediationPlan.update({
        where: { id: plan.id },
        data: {
          effectivenessVerified: true,
          effectivenessVerifiedById: owner.id,
          effectivenessVerifiedAt: new Date(),
        },
      }),
      (error: unknown) => isCheckViolation(error, "remediation_plans_verifier_is_not_the_owner"),
      "CHECK: quien verifica no es quien ejecuta",
    );
    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        effectivenessVerified: true,
        effectivenessVerifiedById: handler.id,
        effectivenessVerifiedAt: new Date(),
      },
    });
  });

  await t("tenant isolation: org B cannot see org A compliance rows", async () => {
    const foreign = await prisma.complianceObligation.count({
      where: { organizationId: orgB.id, code: "OBL-0001" },
    });
    assert.equal(foreign, 0);
    const foreignCases = await prisma.speakUpReport.count({
      where: { organizationId: orgB.id },
    });
    assert.equal(foreignCases, 0);
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((error) => {
    console.error("\nCompliance test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
