/**
 * Evaluación de peligros HACCP / ISO 22000.
 * Severidad × probabilidad → significancia → decisión PRP | OPRP | CCP.
 */
import type { HazardControlDecision } from "@prisma/client";

export type HazardScoreInput = {
  severity: number; // 1-5
  likelihood: number; // 1-5
  /** Umbral de significancia (score). Por defecto 9. */
  significanceThreshold?: number;
};

export type HazardScoreResult = {
  score: number;
  significant: boolean;
};

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

export function scoreHazard(input: HazardScoreInput): HazardScoreResult {
  const severity = clamp(input.severity);
  const likelihood = clamp(input.likelihood);
  const score = severity * likelihood;
  const threshold = input.significanceThreshold ?? 9;
  return { score, significant: score >= threshold };
}

/**
 * Decisión simplificada de control (árbol CCP):
 * - no significativo → NONE o PRP
 * - significativo + control en el paso + medible crítico → CCP
 * - significativo + control esencial no crítico → OPRP
 * - significativo + control general → PRP
 */
export function decideControlMeasure(input: {
  significant: boolean;
  controlAtStep?: boolean;
  criticalAndMeasurable?: boolean;
  essentialOperational?: boolean;
}): HazardControlDecision {
  if (!input.significant) return "NONE";
  if (input.controlAtStep && input.criticalAndMeasurable) return "CCP";
  if (input.essentialOperational) return "OPRP";
  return "PRP";
}

export function assertHazardAssessmentApproval(input: {
  assessedById: string | null | undefined;
}): void {
  if (!input.assessedById) {
    throw new Error("Aprobar una evaluación de peligro exige registrar quién la evalúa.");
  }
}
