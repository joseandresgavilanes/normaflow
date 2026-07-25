/**
 * Evaluación de aplicabilidad de obligaciones (ISO 37301 §4.6).
 *
 * Una obligación no se cumple ni se incumple hasta que alguien decide si le
 * aplica y por qué. Estas funciones son puras: la misma decisión se valida en la
 * UI, en la server action y en el informe.
 */
import type { ApplicabilityDecision, ObligationStatus } from "@prisma/client";

/** Decisiones que ya son una respuesta (frente a seguir en evaluación). */
export function isDecided(decision: ApplicabilityDecision): boolean {
  return decision !== "UNDER_ASSESSMENT";
}

/**
 * Toda decisión de aplicabilidad exige motivo y persona. Duplica el CHECK de la
 * base para devolver un mensaje legible antes de llegar a Postgres.
 */
export function assertApplicabilityDecision(input: {
  decision: ApplicabilityDecision;
  rationale: string | null | undefined;
  assessedById: string | null | undefined;
}): void {
  if (!isDecided(input.decision)) return;
  if (!input.rationale) {
    throw new Error("Decidir la aplicabilidad de una obligación exige un motivo documentado.");
  }
  if (!input.assessedById) {
    throw new Error("Decidir la aplicabilidad exige registrar quién la evalúa.");
  }
}

/** Una obligación no aplicable no puede evaluarse como incumplida. */
export function statusForApplicability(
  decision: ApplicabilityDecision,
  current: ObligationStatus,
): ObligationStatus {
  return decision === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : current;
}

export type ApplicabilityRollup = {
  decision: ApplicabilityDecision;
  /** Jurisdicciones en las que la obligación aplica (total o parcialmente). */
  applicableIn: string[];
  pending: number;
  /** Cierto cuando queda alguna jurisdicción sin evaluar. */
  incomplete: boolean;
};

/**
 * Aplicabilidad agregada de una obligación evaluada en varias jurisdicciones.
 * Basta que aplique en una para que la organización esté sujeta a ella; el
 * agregado se queda en PARTIALLY_APPLICABLE cuando conviven aplica y no aplica,
 * porque el matiz territorial es justo lo que el auditor pregunta.
 */
export function rollupApplicability(
  rows: { jurisdictionCode: string; decision: ApplicabilityDecision }[],
): ApplicabilityRollup {
  const pending = rows.filter((row) => row.decision === "UNDER_ASSESSMENT").length;
  const applicable = rows.filter((row) => row.decision === "APPLICABLE");
  const partial = rows.filter((row) => row.decision === "PARTIALLY_APPLICABLE");
  const notApplicable = rows.filter((row) => row.decision === "NOT_APPLICABLE");
  const applicableIn = [...applicable, ...partial].map((row) => row.jurisdictionCode);

  let decision: ApplicabilityDecision = "UNDER_ASSESSMENT";
  if (rows.length === 0 || (pending > 0 && applicableIn.length === 0 && notApplicable.length === 0)) {
    decision = "UNDER_ASSESSMENT";
  } else if (applicableIn.length === 0) {
    decision = "NOT_APPLICABLE";
  } else if (partial.length > 0 || notApplicable.length > 0 || pending > 0) {
    decision = "PARTIALLY_APPLICABLE";
  } else {
    decision = "APPLICABLE";
  }

  return { decision, applicableIn, pending, incomplete: pending > 0 };
}
