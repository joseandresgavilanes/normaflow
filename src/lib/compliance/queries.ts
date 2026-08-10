import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { rollupApplicability } from "@/lib/compliance/applicability";
import { calendarState, dueAlerts, summarizeCalendar } from "@/lib/compliance/calendar";
import { summarizeProgramme } from "@/lib/compliance/evaluation";
import { notificationOverdue, summarizeBreaches } from "@/lib/compliance/breach";
import { effectiveStatus, summarizeRemediation } from "@/lib/compliance/remediation";
import { buildGoverningBodyDigest, trainingCoverage, type AnonymizedCaseView } from "@/lib/compliance/governing-body";
import { DEFAULT_CHANNEL_CONFIG, caseIntegrity, deadlineBreaches } from "@/lib/compliance/speak-up";
import { decryptSpeakUpField } from "@/lib/crypto/field-encryption";

export type CompliancePayload = Awaited<ReturnType<typeof getCompliancePayload>>;

/**
 * Live payload for the /app/compliance module (ISO 37301).
 *
 * The speak-up channel is fetched in a separate, deliberately narrow query:
 *   - the case list only contains cases the caller is authorized to handle
 *     (a live `SpeakUpCaseAccess` grant) or filed themselves;
 *   - the channel statistics that feed the dashboard and the governing-body
 *     report are read with an explicit `select` that never touches the reporter
 *     columns nor the narrative, so an aggregate cannot leak an identity even by
 *     accident downstream.
 */
export async function getCompliancePayload() {
  const auth = await requireAuthorization("compliance:read");
  const organizationId = auth.ctx.organization.id;
  const userId = auth.ctx.user.id;
  const today = new Date();
  /**
   * Una declaración de conflicto describe la vida privada de una persona: su
   * empresa familiar, su cuñado proveedor, el regalo que recibió. Quien revisa
   * las declaraciones las ve; el resto ve solo las propias y los recuentos.
   */
  const canReviewDeclarations = auth.can("compliance:approve");

  const [
    jurisdictions,
    sources,
    obligations,
    risks,
    controls,
    evaluations,
    calendar,
    declarations,
    declarationStats,
    changes,
    breaches,
    plans,
    trainings,
    reports,
    members,
  ] = await Promise.all([
    prisma.jurisdiction.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.regulatorySource.findMany({
      where: { organizationId },
      include: { jurisdiction: { select: { code: true, name: true } }, _count: { select: { obligations: true, changes: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.complianceObligation.findMany({
      where: { organizationId },
      include: {
        jurisdiction: { select: { code: true, name: true } },
        source: { select: { code: true, name: true } },
        applicabilityAssessments: { include: { jurisdiction: { select: { code: true } } } },
        _count: { select: { risks: true, controls: true, evaluations: true, breaches: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.complianceRisk.findMany({
      where: { organizationId },
      include: { obligation: { select: { code: true, title: true } }, _count: { select: { controls: true } } },
      orderBy: [{ residualScore: "desc" }, { code: "asc" }],
    }),
    prisma.complianceControl.findMany({
      where: { organizationId },
      include: { obligation: { select: { code: true } }, risk: { select: { code: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.complianceEvaluation.findMany({
      where: { organizationId },
      include: { obligation: { select: { code: true, title: true } }, control: { select: { code: true } } },
      orderBy: [{ evaluatedAt: "desc" }, { code: "asc" }],
      take: 200,
    }),
    prisma.complianceCalendar.findMany({
      where: { organizationId },
      include: { obligation: { select: { code: true } }, jurisdiction: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.conflictOfInterestDeclaration.findMany({
      where: canReviewDeclarations ? { organizationId } : { organizationId, declarantId: userId },
      orderBy: [{ period: "desc" }, { code: "asc" }],
    }),
    // Recuentos sin contenido ni declarante: alimentan el panel y el informe al
    // órgano de gobierno sin exponer una sola declaración.
    prisma.conflictOfInterestDeclaration.findMany({
      where: { organizationId },
      select: { hasConflict: true, conflictType: true, reviewStatus: true, recusalRequired: true, period: true },
    }),
    prisma.regulatoryChange.findMany({
      where: { organizationId },
      include: { source: { select: { code: true, name: true } }, obligation: { select: { code: true } } },
      orderBy: { detectedAt: "desc" },
    }),
    prisma.complianceBreach.findMany({
      where: { organizationId },
      include: {
        obligation: { select: { code: true, title: true } },
        _count: { select: { investigations: true, remediationPlans: true } },
      },
      orderBy: { detectedAt: "desc" },
    }),
    prisma.remediationPlan.findMany({
      where: { organizationId },
      include: { breach: { select: { code: true, title: true } } },
      orderBy: [{ dueDate: "asc" }, { code: "asc" }],
    }),
    prisma.complianceTraining.findMany({
      where: { organizationId },
      include: { obligation: { select: { code: true } } },
      orderBy: [{ scheduledFor: "desc" }, { code: "asc" }],
    }),
    prisma.governingBodyReport.findMany({ where: { organizationId }, orderBy: [{ period: "desc" }, { code: "asc" }] }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
  ]);

  const channel = await getSpeakUpView(organizationId, userId, today);

  const obligationRows = obligations.map((obligation) => {
    const rollup = rollupApplicability(
      obligation.applicabilityAssessments.map((row) => ({ jurisdictionCode: row.jurisdiction.code, decision: row.decision })),
    );
    return {
      id: obligation.id,
      code: obligation.code,
      title: obligation.title,
      requirementText: obligation.requirementText,
      obligationType: obligation.obligationType,
      category: obligation.category,
      criticality: obligation.criticality,
      applicability: obligation.applicability,
      applicabilityRollup: rollup,
      complianceStatus: obligation.complianceStatus,
      ownerId: obligation.ownerId,
      accountableId: obligation.accountableId,
      jurisdiction: obligation.jurisdiction,
      source: obligation.source,
      articleReference: obligation.articleReference,
      sanctionDescription: obligation.sanctionDescription,
      maxSanctionAmount: obligation.maxSanctionAmount,
      evaluationFrequency: obligation.evaluationFrequency,
      lastEvaluatedAt: obligation.lastEvaluatedAt,
      nextEvaluationDate: obligation.nextEvaluationDate,
      status: obligation.status,
      counts: obligation._count,
      /** Aplicable pero sin controles: hueco de diseño del programa. */
      uncontrolled: obligation.applicability !== "NOT_APPLICABLE" && obligation._count.controls === 0,
    };
  });

  const calendarRows = calendar.map((item) => ({
    id: item.id,
    code: item.code,
    title: item.title,
    obligationCode: item.obligation?.code ?? null,
    jurisdictionCode: item.jurisdiction?.code ?? null,
    dueDate: item.dueDate,
    recurrence: item.recurrence,
    leadTimeDays: item.leadTimeDays,
    criticality: item.criticality,
    responsibleId: item.responsibleId,
    authority: item.authority,
    completedAt: item.completedAt,
    alertSentAt: item.alertSentAt,
    state: calendarState({
      dueDate: item.dueDate,
      leadTimeDays: item.leadTimeDays,
      completedAt: item.completedAt,
      cancelled: item.status === "CANCELLED",
      today,
    }),
  }));

  const breachRows = breaches.map((breach) => ({
    id: breach.id,
    code: breach.code,
    title: breach.title,
    obligation: breach.obligation,
    detectionSource: breach.detectionSource,
    severity: breach.severity,
    status: breach.status,
    detectedAt: breach.detectedAt,
    rootCause: breach.rootCause,
    recurrence: breach.recurrence,
    financialExposure: breach.financialExposure,
    sanctionImposed: breach.sanctionImposed,
    sanctionAmount: breach.sanctionAmount,
    notificationRequired: breach.notificationRequired,
    notificationDeadline: breach.notificationDeadline,
    authorityNotifiedAt: breach.authorityNotifiedAt,
    notificationOverdue: notificationOverdue(breach, today),
    closedAt: breach.closedAt,
    counts: breach._count,
  }));

  const planRows = plans.map((plan) => ({
    id: plan.id,
    code: plan.code,
    title: plan.title,
    breach: plan.breach,
    ownerId: plan.ownerId,
    startDate: plan.startDate,
    dueDate: plan.dueDate,
    progressPercent: plan.progressPercent,
    status: plan.status,
    effectiveStatus: effectiveStatus(plan, today),
    approvedById: plan.approvedById,
    approvedAt: plan.approvedAt,
    completedAt: plan.completedAt,
    effectivenessVerified: plan.effectivenessVerified,
    effectivenessVerifiedById: plan.effectivenessVerifiedById,
    cost: plan.cost,
  }));

  const trainingRows = trainings.map((training) => ({
    id: training.id,
    code: training.code,
    title: training.title,
    topic: training.topic,
    obligationCode: training.obligation?.code ?? null,
    audience: training.audience,
    mandatory: training.mandatory,
    deliveryMode: training.deliveryMode,
    scheduledFor: training.scheduledFor,
    completedAt: training.completedAt,
    targetCount: training.targetCount,
    completedCount: training.completedCount,
    coverage: trainingCoverage(training),
    passRate: training.passRate,
    effectivenessEvaluated: training.effectivenessEvaluated,
    nextDueDate: training.nextDueDate,
  }));

  const calendarSummary = summarizeCalendar(calendar, today);
  const programme = summarizeProgramme(obligations);
  const breachSummary = summarizeBreaches(breaches, today);
  const remediationSummary = summarizeRemediation(plans, today);

  const digest = buildGoverningBodyDigest({
    obligations: obligations.map((row) => ({ complianceStatus: row.complianceStatus, criticality: row.criticality })),
    risks: risks.map((row) => ({ residualLevel: row.residualLevel, acceptability: row.acceptability })),
    evaluations: evaluations.map((row) => ({ result: row.result, reviewStatus: row.reviewStatus })),
    calendar: { overdue: calendarSummary.overdue, dueSoon: calendarSummary.dueSoon, onTimeRate: calendarSummary.onTimeRate },
    cases: channel.anonymizedCases,
    investigations: channel.investigationStats,
    breaches: breaches.map((row) => ({ status: row.status, severity: row.severity, sanctionAmount: row.sanctionAmount })),
    remediation: {
      completed: remediationSummary.completed,
      overdue: remediationSummary.overdue,
      completedNotVerified: remediationSummary.completedNotVerified,
    },
    training: trainings.map((row) => ({ targetCount: row.targetCount, completedCount: row.completedCount, mandatory: row.mandatory })),
  });

  return {
    can: {
      create: auth.can("compliance:create"),
      update: auth.can("compliance:update"),
      approve: auth.can("compliance:approve"),
      export: auth.can("compliance:export"),
      /** Capacidades del canal, separadas del módulo de compliance a propósito. */
      channelRead: auth.can("speakup:read"),
      channelReport: auth.can("speakup:create"),
      channelHandle: auth.can("speakup:update"),
      channelDecide: auth.can("speakup:approve"),
    },
    members,
    jurisdictions,
    sources,
    obligations: obligationRows,
    risks,
    controls,
    evaluations,
    calendar: calendarRows,
    calendarSummary,
    alerts: dueAlerts(calendar, today),
    declarations,
    /** Cierto cuando `declarations` son todas; falso cuando son solo las propias. */
    declarationsComplete: canReviewDeclarations,
    declarationSummary: {
      total: declarationStats.length,
      withConflict: declarationStats.filter((row) => row.hasConflict).length,
      pending: declarationStats.filter((row) => row.reviewStatus === "PENDING").length,
      recusalRequired: declarationStats.filter((row) => row.recusalRequired).length,
    },
    changes,
    breaches: breachRows,
    breachSummary,
    plans: planRows,
    remediationSummary,
    trainings: trainingRows,
    governingBodyReports: reports,
    programme,
    channel,
    digest,
  };
}

/**
 * Speak-up channel view. Everything here is need-to-know:
 *   - `cases` holds full case data, and only for cases the caller may handle;
 *   - `myReports` is the reporter's own reduced view of the cases they filed;
 *   - `anonymizedCases` and `investigationStats` are aggregates read with a
 *     narrow `select` that excludes every identifying column, so they can feed
 *     the dashboard and the board report for anyone with `compliance:read`.
 */
async function getSpeakUpView(organizationId: string, userId: string, today: Date) {
  const config = await prisma.speakUpChannelConfig.findUnique({ where: { organizationId } });
  const effectiveConfig = config
    ? {
        allowAnonymous: config.allowAnonymous,
        allowConfidential: config.allowConfidential,
        acknowledgementDays: config.acknowledgementDays,
        feedbackDays: config.feedbackDays,
        retentionMonths: config.retentionMonths,
      }
    : DEFAULT_CHANNEL_CONFIG;

  // Aggregates: no reporter columns, no narrative, no subject. An identity that
  // is never selected cannot be leaked by a later refactor of the UI.
  const [aggregateCases, investigationStats] = await Promise.all([
    prisma.speakUpReport.findMany({
      where: { organizationId },
      select: {
        category: true,
        status: true,
        outcome: true,
        severity: true,
        identificationMode: true,
        receivedAt: true,
        acknowledgedAt: true,
        acknowledgementDueAt: true,
        feedbackProvidedAt: true,
        feedbackDueAt: true,
        closedAt: true,
        retentionUntil: true,
        purgedAt: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.investigation.findMany({
      where: { organizationId },
      select: { status: true, conflictDetected: true, reportId: true, dueDate: true, concludedAt: true },
    }),
  ]);

  const anonymizedCases: AnonymizedCaseView[] = aggregateCases.map((row) => {
    const overdue = deadlineBreaches(row, today);
    return {
      category: row.category,
      status: row.status,
      outcome: row.outcome,
      anonymous: row.identificationMode === "ANONYMOUS",
      acknowledgementOverdue: overdue.acknowledgementOverdue,
      feedbackOverdue: overdue.feedbackOverdue,
    };
  });

  const retentionDue = aggregateCases.filter(
    (row) => !row.purgedAt && row.status === "CLOSED" && row.retentionUntil && row.retentionUntil <= today,
  ).length;

  const { cases: caseRows, myReports } = await loadAccessibleCases(organizationId, userId, today);

  return {
    config: effectiveConfig,
    configured: Boolean(config),
    externalChannelUrl: config?.externalChannelUrl ?? null,
    cases: caseRows,
    /** Casos propios sin autorización de gestión: vista reducida del informante. */
    myReports,
    /** Casos existentes que el usuario no puede ver: se dice, no se disimula. */
    restrictedCount: aggregateCases.length - caseRows.length,
    retentionDue,
    anonymizedCases,
    investigationStats,
  };
}

/**
 * Cases the caller may actually handle, plus the reduced view of the cases they
 * filed themselves.
 *
 * Need-to-know means one thing only: a live grant in `SpeakUpCaseAccess`. A
 * module permission — `speakup:read`, `speakup:*` or even the global wildcard —
 * opens no case on its own, which is why the grants query comes first and drives
 * everything else.
 *
 * Own reports are a separate, deliberately poorer channel: the reporter follows
 * the state of their case and the feedback they were given, and sees nothing of
 * the investigation, the evidence collected or who is handling it.
 */
async function loadAccessibleCases(organizationId: string, userId: string, today: Date) {
  const grants = await prisma.speakUpCaseAccess.findMany({
    where: { organizationId, userId, revokedAt: null },
    select: { reportId: true, caseRole: true },
  });
  const grantedIds = grants.map((grant) => grant.reportId);

  const [granted, own] = await Promise.all([
    prisma.speakUpReport.findMany({
      where: { organizationId, id: { in: grantedIds } },
      include: {
        access: { where: { revokedAt: null }, orderBy: { grantedAt: "asc" } },
        evidence: { orderBy: { collectedAt: "desc" } },
        investigations: { orderBy: { code: "asc" } },
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.speakUpReport.findMany({
      where: { organizationId, reporterUserId: userId, id: { notIn: grantedIds } },
      select: {
        id: true,
        code: true,
        category: true,
        severity: true,
        identificationMode: true,
        receivedAt: true,
        status: true,
        acknowledgedAt: true,
        acknowledgementDueAt: true,
        feedbackProvidedAt: true,
        feedbackDueAt: true,
        outcome: true,
        closedAt: true,
        protectionMeasures: true,
        retaliationRisk: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  const roleByReport = new Map(grants.map((grant) => [grant.reportId, grant.caseRole]));
  return {
    // Descifrado solo para quien ya tiene una concesión viva sobre el caso
    // (comprobado arriba): el receptor autorizado necesita poder contactar a
    // un informante identificado o confidencial, no solo saber que existe.
    cases: granted.map((row) => ({
      ...row,
      reporterName: decryptSpeakUpField(row.reporterName),
      reporterEmail: decryptSpeakUpField(row.reporterEmail),
      reporterPhone: decryptSpeakUpField(row.reporterPhone),
      myCaseRole: roleByReport.get(row.id) ?? null,
      deadlines: deadlineBreaches(row, today),
      integrity: caseIntegrity(row),
    })),
    myReports: own,
  };
}
