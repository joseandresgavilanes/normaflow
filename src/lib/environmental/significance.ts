/**
 * Environmental significance evaluation (ISO 14001:2015 §6.1.2).
 *
 * Pure, deterministic helpers so the calculation can be unit-tested and reused
 * by both the server actions and the report builders. A significance *method*
 * (org-defined, versioned) supplies the formula, the per-factor weights and the
 * significance threshold; an *impact* supplies the factor scores.
 */
import type { EnvironmentalSignificance } from "@prisma/client";

export type SignificanceFormula = "WEIGHTED_SUM" | "PRODUCT" | "SUM";

/** Factor scores taken from an EnvironmentalImpact row. */
export type SignificanceFactors = {
  severity: number;
  frequency: number;
  scope: number;
  /** 0..100 — effectiveness of the existing control; mitigates the raw value. */
  controlEffectiveness?: number | null;
};

/** The subset of a significance method the calculation needs. */
export type SignificanceMethodLike = {
  formula?: string | null;
  weights?: unknown; // Json — { severity, frequency, scope }
  threshold?: number | null;
};

export type SignificanceResult = {
  score: number;
  level: EnvironmentalSignificance;
  significant: boolean;
};

export const DEFAULT_WEIGHTS = { severity: 1, frequency: 1, scope: 1 } as const;

const FACTORS = ["severity", "frequency", "scope"] as const;

function normalizeFormula(formula?: string | null): SignificanceFormula {
  const f = (formula ?? "WEIGHTED_SUM").toUpperCase();
  return f === "PRODUCT" || f === "SUM" ? f : "WEIGHTED_SUM";
}

/** Read a weight map from arbitrary Json, falling back to 1 per factor. */
export function readWeights(weights: unknown): Record<(typeof FACTORS)[number], number> {
  const out: Record<(typeof FACTORS)[number], number> = { ...DEFAULT_WEIGHTS };
  if (weights && typeof weights === "object") {
    for (const key of FACTORS) {
      const raw = (weights as Record<string, unknown>)[key];
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n) && n >= 0) out[key] = n;
    }
  }
  return out;
}

function bucketLevel(score: number, threshold: number): EnvironmentalSignificance {
  if (threshold > 0) {
    const ratio = score / threshold;
    if (ratio < 0.5) return "LOW";
    if (ratio < 1) return "MODERATE";
    if (ratio < 1.5) return "HIGH";
    return "CRITICAL";
  }
  // No meaningful threshold: absolute bands on a 1..5 factor scale.
  if (score <= 3) return "LOW";
  if (score <= 6) return "MODERATE";
  if (score <= 9) return "HIGH";
  return "CRITICAL";
}

/**
 * Compute the significance value, level and significant flag for an impact.
 * `significant` is true when the (control-mitigated) score reaches the method
 * threshold. The result is rounded to 2 decimals for stable persistence.
 */
export function computeSignificance(
  method: SignificanceMethodLike | null | undefined,
  factors: SignificanceFactors,
): SignificanceResult {
  const formula = normalizeFormula(method?.formula);
  const weights = readWeights(method?.weights);
  const threshold = typeof method?.threshold === "number" ? method.threshold : 0;

  const s = Math.max(0, factors.severity || 0);
  const f = Math.max(0, factors.frequency || 0);
  const c = Math.max(0, factors.scope || 0);

  let raw: number;
  if (formula === "PRODUCT") raw = s * f * c;
  else if (formula === "SUM") raw = s + f + c;
  else raw = weights.severity * s + weights.frequency * f + weights.scope * c;

  const eff = factors.controlEffectiveness;
  if (typeof eff === "number" && eff > 0) {
    raw = raw * (1 - Math.min(100, eff) / 100);
  }

  const score = Math.round(raw * 100) / 100;
  return {
    score,
    level: bucketLevel(score, threshold),
    significant: threshold > 0 ? score >= threshold : score > 0 && bucketLevel(score, threshold) !== "LOW",
  };
}

/**
 * Default significance method definition used to seed a new organization or as
 * a fallback. Weighted sum of severity·frequency·scope on a 1..5 scale, with a
 * significance threshold of 12 (of a 15 max on equal weights).
 */
export function defaultSignificanceMethod() {
  return {
    name: "Método de significancia ambiental",
    formula: "WEIGHTED_SUM" as const,
    weights: { severity: 2, frequency: 1, scope: 1 },
    threshold: 12,
    version: "1",
    criteria: {
      scale: "1-5",
      factors: [
        { key: "severity", label: "Severidad" },
        { key: "frequency", label: "Frecuencia" },
        { key: "scope", label: "Alcance" },
      ],
      note: "El control existente reduce el valor según su efectividad (0-100%).",
    },
  };
}
