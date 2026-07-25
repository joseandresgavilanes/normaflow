/**
 * Informe al órgano de gobierno (ISO 37301 §5.1.2, §9.3).
 *
 * Construye el agregado que se presenta al consejo. Del canal de denuncias solo
 * salen volúmenes, categorías y resultados: la función recibe datos ya
 * despersonalizados y no tiene forma de transportar una identidad, ni por
 * descuido de quien la llame.
 */
import type {
  BreachSeverity,
  BreachStatus,
  ComplianceRiskLevel,
  ObligationStatus,
  SpeakUpCategory,
  SpeakUpOutcome,
  SpeakUpStatus,
} from "@prisma/client";

/** Vista del canal permitida en el informe: sin informante, sin señalado, sin relato. */
export type AnonymizedCaseView = {
  category: SpeakUpCategory;
  status: SpeakUpStatus;
  outcome: SpeakUpOutcome | null;
  anonymous: boolean;
  acknowledgementOverdue: boolean;
  feedbackOverdue: boolean;
};

export type GoverningBodyInput = {
  obligations: { complianceStatus: ObligationStatus; criticality?: string | null }[];
  risks: { residualLevel: ComplianceRiskLevel; acceptability: string }[];
  evaluations: { result: string; reviewStatus: string }[];
  calendar: { overdue: number; dueSoon: number; onTimeRate: number | null };
  cases: AnonymizedCaseView[];
  investigations: { status: string; conflictDetected: boolean }[];
  breaches: { status: BreachStatus; severity: BreachSeverity; sanctionAmount?: number | null }[];
  remediation: { completed: number; overdue: number; completedNotVerified: number };
  training: { targetCount?: number | null; completedCount?: number | null; mandatory: boolean }[];
};

export type GoverningBodyDigest = {
  obligations: { total: number; nonCompliant: number; notEvaluated: number };
  risks: { total: number; highOrCritical: number; notAcceptable: number };
  evaluations: { total: number; approved: number; pendingReview: number };
  calendar: { overdue: number; dueSoon: number; onTimeRate: number | null };
  /** Canal: solo agregados. `byCategory` permite ver el patrón sin ver el caso. */
  speakUp: {
    total: number;
    open: number;
    anonymous: number;
    substantiated: number;
    overdueAcknowledgement: number;
    overdueFeedback: number;
    byCategory: { category: SpeakUpCategory; count: number }[];
  };
  investigations: { total: number; active: number; withConflict: number };
  breaches: { total: number; open: number; severe: number; sanctions: number };
  remediation: { completed: number; overdue: number; completedNotVerified: number };
  training: { mandatory: number; coverageRate: number | null };
  /** Puntos que el órgano de gobierno debe decidir, no solo conocer. */
  escalations: string[];
};

export function buildGoverningBodyDigest(input: GoverningBodyInput): GoverningBodyDigest {
  const nonCompliant = input.obligations.filter((row) => row.complianceStatus === "NON_COMPLIANT").length;
  const notEvaluated = input.obligations.filter((row) => row.complianceStatus === "NOT_EVALUATED").length;
  const highOrCritical = input.risks.filter((row) => row.residualLevel === "HIGH" || row.residualLevel === "CRITICAL").length;
  const notAcceptable = input.risks.filter((row) => row.acceptability === "NOT_ACCEPTABLE").length;

  const byCategoryMap = new Map<SpeakUpCategory, number>();
  for (const row of input.cases) byCategoryMap.set(row.category, (byCategoryMap.get(row.category) ?? 0) + 1);
  const byCategory = [...byCategoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const substantiated = input.cases.filter(
    (row) => row.outcome === "SUBSTANTIATED" || row.outcome === "PARTIALLY_SUBSTANTIATED",
  ).length;
  const overdueAcknowledgement = input.cases.filter((row) => row.acknowledgementOverdue).length;
  const overdueFeedback = input.cases.filter((row) => row.feedbackOverdue).length;

  const mandatoryTraining = input.training.filter((row) => row.mandatory);
  const target = mandatoryTraining.reduce((sum, row) => sum + (row.targetCount ?? 0), 0);
  const done = mandatoryTraining.reduce((sum, row) => sum + (row.completedCount ?? 0), 0);

  const escalations: string[] = [];
  if (notAcceptable > 0) escalations.push(`${notAcceptable} riesgo(s) de compliance con nivel residual no aceptable`);
  if (nonCompliant > 0) escalations.push(`${nonCompliant} obligación(es) evaluadas como incumplidas`);
  const severeBreaches = input.breaches.filter((row) => row.severity === "SEVERE" || row.severity === "MAJOR").length;
  if (severeBreaches > 0) escalations.push(`${severeBreaches} incumplimiento(s) grave(s)`);
  if (input.calendar.overdue > 0) escalations.push(`${input.calendar.overdue} vencimiento(s) regulatorios fuera de plazo`);
  if (overdueAcknowledgement > 0 || overdueFeedback > 0) {
    escalations.push(`plazos del canal de denuncias incumplidos (${overdueAcknowledgement} acuses, ${overdueFeedback} respuestas)`);
  }
  const conflicted = input.investigations.filter((row) => row.conflictDetected).length;
  if (conflicted > 0) escalations.push(`${conflicted} investigación(es) reasignadas por conflicto de interés`);
  if (input.remediation.completedNotVerified > 0) {
    escalations.push(`${input.remediation.completedNotVerified} plan(es) de remediación completados sin verificar su eficacia`);
  }
  if (notEvaluated > 0) escalations.push(`${notEvaluated} obligación(es) aplicables sin evaluar`);

  return {
    obligations: { total: input.obligations.length, nonCompliant, notEvaluated },
    risks: { total: input.risks.length, highOrCritical, notAcceptable },
    evaluations: {
      total: input.evaluations.length,
      approved: input.evaluations.filter((row) => row.reviewStatus === "APPROVED").length,
      pendingReview: input.evaluations.filter((row) => row.reviewStatus === "UNDER_REVIEW").length,
    },
    calendar: input.calendar,
    speakUp: {
      total: input.cases.length,
      open: input.cases.filter((row) => row.status !== "CLOSED").length,
      anonymous: input.cases.filter((row) => row.anonymous).length,
      substantiated,
      overdueAcknowledgement,
      overdueFeedback,
      byCategory,
    },
    investigations: {
      total: input.investigations.length,
      active: input.investigations.filter((row) => row.status === "ACTIVE").length,
      withConflict: conflicted,
    },
    breaches: {
      total: input.breaches.length,
      open: input.breaches.filter((row) => row.status !== "CLOSED").length,
      severe: severeBreaches,
      sanctions: input.breaches.reduce((sum, row) => sum + (row.sanctionAmount ?? 0), 0),
    },
    remediation: input.remediation,
    training: { mandatory: mandatoryTraining.length, coverageRate: target === 0 ? null : Math.round((done / target) * 100) },
    escalations,
  };
}

/**
 * Un informe presentado al órgano de gobierno no se da por conocido solo: quien
 * lo acusa queda registrado (también por CHECK en base).
 */
export function assertAcknowledgement(input: { acknowledgedById: string | null | undefined }): void {
  if (!input.acknowledgedById) {
    throw new Error("Registrar el acuse del órgano de gobierno exige identificar quién lo acusa.");
  }
}

/** Cobertura de una formación obligatoria (0-100), o null si no hay audiencia definida. */
export function trainingCoverage(row: { targetCount?: number | null; completedCount?: number | null }): number | null {
  if (!row.targetCount) return null;
  return Math.min(100, Math.round(((row.completedCount ?? 0) / row.targetCount) * 100));
}
