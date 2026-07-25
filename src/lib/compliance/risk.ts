/**
 * Riesgo de compliance (ISO 37301 §6.1): probabilidad de incumplir una
 * obligación por la consecuencia del incumplimiento.
 *
 * Misma escala 1-5 que el resto de NormaFlow para que las matrices sean
 * comparables entre módulos. El residual se obtiene descontando la eficacia
 * agregada de los controles, nunca al revés: un control no puede subir el riesgo.
 */
import type { ComplianceAcceptability, ComplianceRiskLevel } from "@prisma/client";

export type ComplianceRiskInput = {
  likelihood: number; // 1-5
  impact: number; // 1-5
  /** Eficacia agregada de los controles asociados, 0-100. */
  controlEffectiveness?: number | null;
};

export type ComplianceRiskValuation = {
  inherentScore: number;
  inherentLevel: ComplianceRiskLevel;
  residualScore: number;
  residualLevel: ComplianceRiskLevel;
  acceptability: ComplianceAcceptability;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function levelFromScore(score: number): ComplianceRiskLevel {
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

/**
 * Aceptabilidad: solo lo bajo es aceptable sin más; lo crítico y lo alto nunca
 * lo son. El nivel medio es tolerable, es decir, aceptable con seguimiento.
 */
export function acceptabilityFromLevel(level: ComplianceRiskLevel): ComplianceAcceptability {
  if (level === "CRITICAL" || level === "HIGH") return "NOT_ACCEPTABLE";
  if (level === "MEDIUM") return "TOLERABLE";
  return "ACCEPTABLE";
}

export function computeComplianceRisk(input: ComplianceRiskInput): ComplianceRiskValuation {
  const likelihood = clamp(Math.round(input.likelihood), 1, 5);
  const impact = clamp(Math.round(input.impact), 1, 5);
  const inherentScore = likelihood * impact;

  const effectiveness = typeof input.controlEffectiveness === "number" ? clamp(input.controlEffectiveness, 0, 100) : 0;
  // El residual nunca baja de 1: un riesgo tratado sigue existiendo.
  const residualScore = Math.max(1, Math.round(inherentScore * (1 - effectiveness / 100)));
  const residualLevel = levelFromScore(residualScore);

  return {
    inherentScore,
    inherentLevel: levelFromScore(inherentScore),
    residualScore,
    residualLevel,
    acceptability: acceptabilityFromLevel(residualLevel),
  };
}

/**
 * Eficacia agregada de un conjunto de controles. Un control inefectivo no
 * cuenta, y el conjunto no supera el 95%: el riesgo cero no existe.
 */
export function aggregateControlEffectiveness(
  controls: { effectiveness?: number | null; active?: boolean; operatingEffective?: boolean | null }[],
): number {
  const usable = controls.filter(
    (control) => control.active !== false && control.operatingEffective !== false && typeof control.effectiveness === "number",
  );
  if (usable.length === 0) return 0;
  // Los controles se combinan por fallo residual: dos controles del 60% dejan
  // pasar 0,4 × 0,4 = 16%, es decir, cubren el 84%.
  const residual = usable.reduce((factor, control) => factor * (1 - clamp(control.effectiveness ?? 0, 0, 100) / 100), 1);
  return Math.min(95, Math.round((1 - residual) * 100));
}

/** Aceptar un riesgo de compliance exige justificación y quién lo acepta. */
export function assertRiskAcceptance(input: {
  acceptability: ComplianceAcceptability;
  rationale: string | null | undefined;
  acceptedById: string | null | undefined;
}): void {
  if (!input.rationale) throw new Error("Aceptar un riesgo de compliance exige una justificación registrada.");
  if (!input.acceptedById) throw new Error("Aceptar un riesgo de compliance exige registrar quién lo acepta.");
  if (input.acceptability === "NOT_ACCEPTABLE" && !input.rationale) {
    throw new Error("Un riesgo no aceptable solo puede aceptarse con justificación del órgano de gobierno.");
  }
}

/** Exposición económica total de una cartera de riesgos. */
export function totalExposure(rows: { sanctionExposure?: number | null }[]): number {
  return rows.reduce((total, row) => total + (row.sanctionExposure ?? 0), 0);
}
