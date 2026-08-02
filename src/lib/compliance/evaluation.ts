/**
 * Evaluación de cumplimiento (ISO 37301 §9.1) y estado agregado del programa.
 *
 * Una evaluación en borrador no cambia el estado de nada: solo la evaluación
 * aprobada por una persona mueve el estado de cumplimiento de la obligación.
 */
import type {
  ComplianceResult,
  ComplianceReviewStatus,
  ObligationStatus,
} from "@prisma/client";

/** Transiciones permitidas de la revisión de una evaluación. */
const ALLOWED_REVIEW: Record<ComplianceReviewStatus, ComplianceReviewStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
};

export function nextReviewStatuses(status: ComplianceReviewStatus): ComplianceReviewStatus[] {
  return ALLOWED_REVIEW[status] ?? [];
}

export function canTransitionReview(from: ComplianceReviewStatus, to: ComplianceReviewStatus): boolean {
  return nextReviewStatuses(from).includes(to);
}

export function assertReviewTransition(from: ComplianceReviewStatus, to: ComplianceReviewStatus): void {
  if (from === to) throw new Error(`La evaluación ya está en estado ${from}.`);
  if (from === "APPROVED") throw new Error("Una evaluación aprobada no se reabre: registre una evaluación nueva del periodo.");
  if ((to === "APPROVED" || to === "REJECTED") && from !== "UNDER_REVIEW") {
    throw new Error("Una evaluación solo puede aprobarse o rechazarse desde revisión.");
  }
  if (!canTransitionReview(from, to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextReviewStatuses(from).join(", ") || "ningún estado"}.`);
  }
}

/** Una decisión (aprobada o rechazada) nombra a su revisor y su fecha. */
export function assertReviewerPresent(input: {
  reviewStatus: ComplianceReviewStatus;
  reviewerId: string | null | undefined;
  reviewedAt: Date | null | undefined;
}): void {
  if (input.reviewStatus === "DRAFT" || input.reviewStatus === "UNDER_REVIEW") return;
  if (!input.reviewerId || !input.reviewedAt) {
    throw new Error("Una evaluación decidida debe registrar el revisor y la fecha de la decisión.");
  }
}

/** Traducción directa del resultado de una evaluación al estado de la obligación. */
export function statusFromResult(result: ComplianceResult): ObligationStatus {
  switch (result) {
    case "COMPLIANT":
      return "COMPLIANT";
    case "PARTIALLY_COMPLIANT":
      return "PARTIALLY_COMPLIANT";
    case "NON_COMPLIANT":
      return "NON_COMPLIANT";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
    default:
      return "NOT_EVALUATED";
  }
}

/**
 * Estado de cumplimiento de una obligación a partir de su historial. Solo
 * cuentan las evaluaciones aprobadas y manda la más reciente: el cumplimiento es
 * una foto del presente, no un promedio histórico.
 */
export function obligationStatusFromEvaluations(
  evaluations: { result: ComplianceResult; reviewStatus: ComplianceReviewStatus; evaluatedAt: Date }[],
): { status: ObligationStatus; lastEvaluatedAt: Date | null } {
  const approved = evaluations
    .filter((evaluation) => evaluation.reviewStatus === "APPROVED")
    .sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime());
  if (approved.length === 0) return { status: "NOT_EVALUATED", lastEvaluatedAt: null };
  return { status: statusFromResult(approved[0].result), lastEvaluatedAt: approved[0].evaluatedAt };
}

/** Una evaluación no conforme tiene que decir qué falló. */
export function assertFindingsForNonCompliance(input: {
  result: ComplianceResult;
  findings: string | null | undefined;
}): void {
  if ((input.result === "NON_COMPLIANT" || input.result === "PARTIALLY_COMPLIANT") && !input.findings) {
    throw new Error("Una evaluación no conforme debe describir el hallazgo que la sustenta.");
  }
}

export type ProgrammeCompliance = {
  applicable: number;
  compliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  notEvaluated: number;
  /** Tasa de cumplimiento sobre las obligaciones aplicables y evaluadas. */
  complianceRate: number | null;
  /** Aplicables que nadie ha evaluado todavía: la deuda real del programa. */
  coverageRate: number | null;
};

/**
 * Cumplimiento del programa. Las obligaciones no aplicables se excluyen del
 * denominador: inflar el porcentaje con lo que no nos obliga sería engañarse.
 */
export function summarizeProgramme(
  obligations: { complianceStatus: ObligationStatus }[],
): ProgrammeCompliance {
  const applicableRows = obligations.filter((row) => row.complianceStatus !== "NOT_APPLICABLE");
  const compliant = applicableRows.filter((row) => row.complianceStatus === "COMPLIANT").length;
  const partiallyCompliant = applicableRows.filter((row) => row.complianceStatus === "PARTIALLY_COMPLIANT").length;
  const nonCompliant = applicableRows.filter((row) => row.complianceStatus === "NON_COMPLIANT").length;
  const notEvaluated = applicableRows.filter((row) => row.complianceStatus === "NOT_EVALUATED").length;
  const evaluated = applicableRows.length - notEvaluated;

  return {
    applicable: applicableRows.length,
    compliant,
    partiallyCompliant,
    nonCompliant,
    notEvaluated,
    complianceRate: evaluated === 0 ? null : Math.round((compliant / evaluated) * 100),
    coverageRate: applicableRows.length === 0 ? null : Math.round((evaluated / applicableRows.length) * 100),
  };
}
