/**
 * Occupational risk evaluation — W.T. Fine "grado de peligrosidad" (GP).
 *
 *   GP = consequence × exposure × probability
 *
 * Pure and deterministic so the level and acceptability are testable and shared
 * by the server action and the tests. Residual risk applies a control-mitigation
 * factor (0..100%) to the inherent magnitude.
 */
import type { OccupationalRiskLevel, OccupationalRiskAcceptability } from "@prisma/client";

export type OccupationalRiskInput = {
  probability: number;
  consequence: number;
  exposure: number;
  /** 0..100 — mitigation applied by the planned controls (residual only). */
  controlEffectiveness?: number | null;
};

export type OccupationalRiskResult = {
  inherentMagnitude: number;
  inherentLevel: OccupationalRiskLevel;
  residualMagnitude: number;
  residualLevel: OccupationalRiskLevel;
  acceptability: OccupationalRiskAcceptability;
};

/** Fine bands on GP → risk level. */
export function levelFromMagnitude(gp: number): OccupationalRiskLevel {
  if (gp < 85) return "LOW";
  if (gp < 200) return "MEDIUM";
  if (gp < 400) return "HIGH";
  return "CRITICAL";
}

export function acceptabilityFromLevel(level: OccupationalRiskLevel): OccupationalRiskAcceptability {
  if (level === "LOW") return "ACCEPTABLE";
  if (level === "MEDIUM") return "TOLERABLE";
  return "NOT_ACCEPTABLE";
}

export function computeOccupationalRisk(input: OccupationalRiskInput): OccupationalRiskResult {
  const p = Math.max(0, input.probability || 0);
  const c = Math.max(0, input.consequence || 0);
  const e = Math.max(0, input.exposure || 0);
  const inherent = Math.round(c * e * p * 100) / 100;

  const eff = typeof input.controlEffectiveness === "number" ? Math.min(100, Math.max(0, input.controlEffectiveness)) : 0;
  const residual = Math.round(inherent * (1 - eff / 100) * 100) / 100;

  const inherentLevel = levelFromMagnitude(inherent);
  const residualLevel = levelFromMagnitude(residual);
  return {
    inherentMagnitude: inherent,
    inherentLevel,
    residualMagnitude: residual,
    residualLevel,
    acceptability: acceptabilityFromLevel(residualLevel),
  };
}
