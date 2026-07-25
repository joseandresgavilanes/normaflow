/**
 * Valoración de riesgo de soborno. Reutiliza la mecánica de ComplianceRisk
 * (probabilidad × impacto); aquí solo se agregan factores típicos 37001.
 */
import type { ComplianceRiskLevel } from "@prisma/client";
import { acceptabilityFromLevel, computeComplianceRisk, levelFromScore } from "@/lib/compliance/risk";

export type BriberyRiskInput = {
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
  controlEffectiveness?: number | null;
  countryRisk?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  sectorRisk?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  publicOfficialRisk?: boolean;
  thirdPartyRisk?: boolean;
};

const COUNTRY_UPLIFT: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 1, CRITICAL: 2 };

export function computeBriberyRisk(input: BriberyRiskInput) {
  const base = computeComplianceRisk({
    likelihood: input.inherentLikelihood,
    impact: input.inherentImpact,
    controlEffectiveness: input.controlEffectiveness,
  });

  // Los factores de país/sector/funcionario elevan el inherente sin inventar otra matriz.
  const uplift =
    (COUNTRY_UPLIFT[input.countryRisk ?? "MODERATE"] ?? 0) +
    (COUNTRY_UPLIFT[input.sectorRisk ?? "MODERATE"] ?? 0) +
    (input.publicOfficialRisk ? 1 : 0) +
    (input.thirdPartyRisk ? 1 : 0);

  const inherentScore = Math.min(25, base.inherentScore + uplift);
  const inherentLevel = levelFromScore(inherentScore);

  let residualScore = base.residualScore;
  let residualLevel = base.residualLevel;
  if (typeof input.residualLikelihood === "number" && typeof input.residualImpact === "number") {
    residualScore = Math.max(1, Math.round(input.residualLikelihood) * Math.round(input.residualImpact));
    residualLevel = levelFromScore(residualScore);
  } else {
    // El uplift también afecta al residual si no se declara explícitamente.
    residualScore = Math.max(1, Math.min(25, residualScore + Math.floor(uplift / 2)));
    residualLevel = levelFromScore(residualScore);
  }

  return {
    inherentScore,
    inherentLevel,
    residualScore,
    residualLevel,
    acceptability: acceptabilityFromLevel(residualLevel as ComplianceRiskLevel),
    uplift,
  };
}

export function assertBriberyAssessmentApproval(input: {
  approvedById: string | null | undefined;
}): void {
  if (!input.approvedById) {
    throw new Error("Aprobar una evaluación de riesgo de soborno exige registrar quién la aprueba.");
  }
}
