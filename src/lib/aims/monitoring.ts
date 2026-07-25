/**
 * Monitoreo continuo de sistemas de IA en producción (ISO/IEC 42001 §A.6.2.6).
 *
 * Evalúa una medición contra su umbral y su línea base. La dirección importa:
 * en exactitud "más es mejor", en latencia o tasa de error "menos es mejor",
 * por eso cada métrica declara `higherIsBetter`.
 */
import type { AIMetricKind } from "@prisma/client";

export type MetricSample = {
  value: number;
  threshold?: number | null;
  baseline?: number | null;
  higherIsBetter?: boolean;
};

export type MetricEvaluation = {
  breached: boolean;
  driftDetected: boolean;
  /** Desvío relativo frente a la línea base, en % (positivo = mejora). */
  deviationPercent: number | null;
};

/** Umbral de deriva: un 10% de degradación frente a la línea base. */
export const DRIFT_TOLERANCE_PERCENT = 10;

/** Métricas en las que un valor más bajo es mejor por naturaleza. */
const LOWER_IS_BETTER: AIMetricKind[] = [
  "ERROR_RATE",
  "LATENCY",
  "DRIFT",
  "TOXICITY",
  "HALLUCINATION_RATE",
  "HUMAN_OVERRIDE_RATE",
  "REJECTION_RATE",
  "COST",
];

/** Dirección por defecto de una métrica según su tipo. */
export function defaultHigherIsBetter(kind: AIMetricKind): boolean {
  return !LOWER_IS_BETTER.includes(kind);
}

export function evaluateMetric(sample: MetricSample): MetricEvaluation {
  const higherIsBetter = sample.higherIsBetter ?? true;
  const breached =
    typeof sample.threshold === "number"
      ? higherIsBetter
        ? sample.value < sample.threshold
        : sample.value > sample.threshold
      : false;

  let deviationPercent: number | null = null;
  let driftDetected = false;
  if (typeof sample.baseline === "number" && sample.baseline !== 0) {
    const raw = ((sample.value - sample.baseline) / Math.abs(sample.baseline)) * 100;
    // Se normaliza para que un valor negativo signifique siempre degradación.
    const signed = higherIsBetter ? raw : -raw;
    deviationPercent = Math.round(signed * 100) / 100;
    driftDetected = signed <= -DRIFT_TOLERANCE_PERCENT;
  }

  return { breached, driftDetected, deviationPercent };
}

export type MonitoringSummary = {
  measurements: number;
  breached: number;
  drifting: number;
  systemsWithBreach: number;
  /** Sistemas en producción sin ninguna medición en el periodo evaluado. */
  unmonitoredSystems: number;
};

export function summarizeMonitoring(
  rows: { systemId: string; breached: boolean; driftDetected: boolean }[],
  productionSystemIds: string[],
): MonitoringSummary {
  const measured = new Set(rows.map((row) => row.systemId));
  const withBreach = new Set(rows.filter((row) => row.breached || row.driftDetected).map((row) => row.systemId));
  return {
    measurements: rows.length,
    breached: rows.filter((row) => row.breached).length,
    drifting: rows.filter((row) => row.driftDetected).length,
    systemsWithBreach: withBreach.size,
    unmonitoredSystems: productionSystemIds.filter((id) => !measured.has(id)).length,
  };
}
