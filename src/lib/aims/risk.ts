/**
 * Valoración de riesgos de IA (ISO/IEC 42001 §6.1.2).
 *
 *   riesgo = probabilidad × impacto        (matriz 5×5 → 1..25)
 *   residual = inherente × (1 − eficacia del control)
 *
 * Puro y determinista para que nivel y aceptabilidad sean testables y los
 * compartan la server action, la UI y los informes.
 */
import type { AIRiskLevel, AIRiskAcceptability } from "@prisma/client";

export type AIRiskInput = {
  /** 1..5 */
  likelihood: number;
  /** 1..5 */
  impact: number;
  /** 0..100 — mitigación aportada por los controles existentes. */
  controlEffectiveness?: number | null;
};

export type AIRiskResult = {
  inherentScore: number;
  inherentLevel: AIRiskLevel;
  residualScore: number;
  residualLevel: AIRiskLevel;
  acceptability: AIRiskAcceptability;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Bandas de la matriz 5×5. */
export function levelFromScore(score: number): AIRiskLevel {
  if (score <= 4) return "LOW";
  if (score <= 9) return "MEDIUM";
  if (score <= 16) return "HIGH";
  return "CRITICAL";
}

export function acceptabilityFromLevel(level: AIRiskLevel): AIRiskAcceptability {
  if (level === "LOW") return "ACCEPTABLE";
  if (level === "MEDIUM") return "TOLERABLE";
  return "NOT_ACCEPTABLE";
}

export function computeAIRisk(input: AIRiskInput): AIRiskResult {
  const likelihood = clamp(Math.round(input.likelihood || 0), 0, 5);
  const impact = clamp(Math.round(input.impact || 0), 0, 5);
  const inherentScore = round2(likelihood * impact);

  const effectiveness = typeof input.controlEffectiveness === "number" ? clamp(input.controlEffectiveness, 0, 100) : 0;
  const residualScore = round2(inherentScore * (1 - effectiveness / 100));

  const inherentLevel = levelFromScore(inherentScore);
  const residualLevel = levelFromScore(residualScore);
  return {
    inherentScore,
    inherentLevel,
    residualScore,
    residualLevel,
    acceptability: acceptabilityFromLevel(residualLevel),
  };
}

/**
 * Un riesgo no aceptable no puede cerrarse simplemente aceptándolo sin una
 * justificación y un aprobador: se usa antes de registrar la aceptación.
 */
export function assertRiskAcceptance(
  acceptability: AIRiskAcceptability,
  rationale: string | null | undefined,
  acceptedById: string | null | undefined,
): void {
  if (acceptability === "NOT_ACCEPTABLE" && !rationale) {
    throw new Error("Un riesgo no aceptable requiere una justificación documentada para su aceptación.");
  }
  if (!acceptedById) {
    throw new Error("La aceptación de un riesgo de IA debe registrar quién la aprueba.");
  }
}
