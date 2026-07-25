/**
 * Calidad de datos y sesgo de los datasets (ISO/IEC 42001 §A.7.4, §A.7.5).
 *
 * Cinco dimensiones puntuadas 0..100 —completitud, exactitud, consistencia,
 * actualidad y representatividad— se agregan en un único índice. La
 * representatividad pesa más porque es la dimensión que gobierna el sesgo: un
 * dataset impecable pero no representativo produce un modelo discriminatorio.
 */
import type { DataQualityLevel } from "@prisma/client";

export const QUALITY_DIMENSIONS = [
  "completeness",
  "accuracy",
  "consistency",
  "timeliness",
  "representativeness",
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

const WEIGHTS: Record<QualityDimension, number> = {
  completeness: 1,
  accuracy: 2,
  consistency: 1,
  timeliness: 1,
  representativeness: 2,
};

export type DataQualityInput = Partial<Record<QualityDimension, number | null | undefined>>;

export type DataQualityResult = {
  qualityScore: number;
  qualityLevel: DataQualityLevel;
  unassessed: QualityDimension[];
  /** Dimensiones por debajo de 60 — las que impiden usar el dataset sin acción. */
  weakDimensions: QualityDimension[];
  complete: boolean;
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function levelFromQualityScore(score: number): DataQualityLevel {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "ACCEPTABLE";
  return "POOR";
}

export function computeDataQuality(input: DataQualityInput): DataQualityResult {
  const unassessed: QualityDimension[] = [];
  const weakDimensions: QualityDimension[] = [];
  let weighted = 0;
  let weight = 0;

  for (const dimension of QUALITY_DIMENSIONS) {
    const raw = input[dimension];
    if (typeof raw !== "number") {
      unassessed.push(dimension);
      continue;
    }
    const value = clamp(raw);
    weighted += value * WEIGHTS[dimension];
    weight += WEIGHTS[dimension];
    if (value < 60) weakDimensions.push(dimension);
  }

  if (weight === 0) {
    return { qualityScore: 0, qualityLevel: "NOT_ASSESSED", unassessed, weakDimensions, complete: false };
  }

  const qualityScore = Math.round((weighted / weight) * 100) / 100;
  return {
    qualityScore,
    qualityLevel: levelFromQualityScore(qualityScore),
    unassessed,
    weakDimensions,
    complete: unassessed.length === 0,
  };
}

export type BiasReviewInput = {
  representativeness?: number | null;
  biasReviewed: boolean;
  underrepresentedGroups?: string | null;
  containsPersonalData: boolean;
  containsSpecialCategories: boolean;
};

/**
 * Señales de sesgo de un dataset: qué falta revisar y por qué. Se usa para el
 * informe de datasets y para bloquear la promoción de modelos entrenados con
 * datos sin revisión de sesgo.
 */
export function biasFlags(input: BiasReviewInput): string[] {
  const flags: string[] = [];
  if (!input.biasReviewed) flags.push("sin revisión de sesgo");
  if (typeof input.representativeness === "number" && input.representativeness < 60) {
    flags.push("representatividad insuficiente");
  }
  if (input.underrepresentedGroups) flags.push("grupos subrepresentados identificados");
  if (input.containsSpecialCategories) flags.push("categorías especiales de datos personales");
  else if (input.containsPersonalData) flags.push("contiene datos personales");
  return flags;
}

/**
 * Un dataset no debería alimentar un modelo destinado a producción si su
 * calidad es pobre o no se ha revisado el sesgo.
 */
export function isDatasetFitForTraining(input: { qualityLevel: DataQualityLevel; biasReviewed: boolean }): boolean {
  return input.biasReviewed && input.qualityLevel !== "POOR" && input.qualityLevel !== "NOT_ASSESSED";
}
