/**
 * REGLA HUMANA (ISO/IEC 42001 §A.9.2) — ninguna salida de IA se convierte en
 * registro oficial de forma automática.
 *
 *   DRAFT → HUMAN_REVIEW → APPROVED | REJECTED
 *
 * Reglas del ciclo:
 *  - DRAFT solo puede avanzar a HUMAN_REVIEW (nunca directo a APPROVED).
 *  - APPROVED y REJECTED son estados decididos: exigen revisor humano y fecha.
 *  - Un artefacto rechazado puede volver a DRAFT para corregirse; uno aprobado
 *    es final (un cambio posterior exige una nueva versión / nuevo registro).
 *  - Solo un artefacto APPROVED puede promoverse a registro oficial.
 *
 * Puro y determinista: lo comparten las server actions, la UI y los tests. La
 * base de datos refuerza las mismas invariantes con CHECK constraints.
 */
import type { AIHumanReviewStatus } from "@prisma/client";

export const HUMAN_REVIEW_FLOW: AIHumanReviewStatus[] = ["DRAFT", "HUMAN_REVIEW", "APPROVED", "REJECTED"];

/** Estados que una persona puede decidir (nunca los decide el sistema). */
export const DECIDED_STATUSES: AIHumanReviewStatus[] = ["APPROVED", "REJECTED"];

const ALLOWED: Record<AIHumanReviewStatus, AIHumanReviewStatus[]> = {
  DRAFT: ["HUMAN_REVIEW"],
  HUMAN_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
};

export function isDecided(status: AIHumanReviewStatus): boolean {
  return DECIDED_STATUSES.includes(status);
}

/** Transiciones permitidas desde `status`. */
export function nextHumanReviewStatuses(status: AIHumanReviewStatus): AIHumanReviewStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionHumanReview(from: AIHumanReviewStatus, to: AIHumanReviewStatus): boolean {
  return nextHumanReviewStatuses(from).includes(to);
}

/** Lanza un error descriptivo salvo que la transición sea válida. */
export function assertHumanReviewTransition(from: AIHumanReviewStatus, to: AIHumanReviewStatus): void {
  if (from === to) throw new Error(`El artefacto ya está en estado ${from}.`);
  if (from === "DRAFT" && (to === "APPROVED" || to === "REJECTED")) {
    throw new Error("Una salida de IA no puede aprobarse ni rechazarse sin pasar por revisión humana (HUMAN_REVIEW).");
  }
  if (from === "APPROVED") {
    throw new Error("El artefacto ya fue aprobado por una persona; cree una nueva versión para modificarlo.");
  }
  if (!canTransitionHumanReview(from, to)) {
    const allowed = nextHumanReviewStatuses(from);
    throw new Error(
      allowed.length
        ? `Transición no permitida: de ${from} solo se puede pasar a ${allowed.join(" o ")}.`
        : `El artefacto está en estado final (${from}); no admite más transiciones.`,
    );
  }
}

/**
 * Una decisión humana exige siempre un revisor identificable. Se valida antes
 * de escribir para que el error sea legible en la UI en lugar de un fallo de
 * CHECK constraint.
 */
export function assertReviewerPresent(to: AIHumanReviewStatus, reviewerId: string | null | undefined): void {
  if (isDecided(to) && !reviewerId) {
    throw new Error("La decisión debe registrar al revisor humano que la toma.");
  }
}

/**
 * Puerta única para convertir una salida de IA en registro oficial. Devuelve un
 * error explícito con el estado actual para que quede claro qué falta.
 */
export function assertPromotable(status: AIHumanReviewStatus): void {
  if (status !== "APPROVED") {
    throw new Error(
      `Una salida de IA en estado ${status} no puede convertirse en registro oficial: requiere aprobación humana.`,
    );
  }
}

export function canBecomeOfficialRecord(status: AIHumanReviewStatus): boolean {
  return status === "APPROVED";
}

export type HumanReviewLike = {
  reviewStatus: AIHumanReviewStatus;
  reviewerId?: string | null;
  reviewedAt?: Date | null;
  submittedAt?: Date | null;
  promotedAt?: Date | null;
};

/**
 * Coherencia de un registro ya persistido — se usa en informes de auditoría
 * para detectar cualquier fila que contradiga la regla humana.
 */
export function humanReviewIntegrity(row: HumanReviewLike): { valid: boolean; problems: string[] } {
  const problems: string[] = [];
  if (isDecided(row.reviewStatus) && !row.reviewerId) problems.push("decisión sin revisor humano");
  if (isDecided(row.reviewStatus) && !row.reviewedAt) problems.push("decisión sin fecha");
  if (row.promotedAt && row.reviewStatus !== "APPROVED") problems.push("promovido a registro oficial sin aprobación");
  return { valid: problems.length === 0, problems };
}
