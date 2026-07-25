/**
 * Occupational safety indicators (ISO 45001 §9.1). Pure, testable formulas.
 *
 *   Índice de frecuencia (IF)      = accidentes con baja × 1e6 / horas-hombre
 *   Índice de gravedad (IG)        = días perdidos × 1e6 / horas-hombre
 *   Índice de accidentabilidad (IA) = (IF × IG) / 1000
 *
 * When `hoursWorked` is 0/unknown the rate indices are 0 (no division by zero);
 * the count indicators (lost days, near misses, inspections, overdue actions)
 * are always meaningful.
 */
export type SafetyIndicatorInput = {
  /** Lost-time accidents in the period. */
  accidentsWithLostTime: number;
  /** Total incidents (accidents + incidents) — for accident rate context. */
  totalAccidents?: number;
  lostDays: number;
  nearMisses: number;
  inspections: number;
  overdueActions: number;
  /** Horas-hombre trabajadas en el periodo. */
  hoursWorked: number;
};

export type SafetyIndicators = {
  frequencyIndex: number;
  severityIndex: number;
  accidentRate: number;
  lostDays: number;
  nearMisses: number;
  inspections: number;
  overdueActions: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function computeSafetyIndicators(input: SafetyIndicatorInput): SafetyIndicators {
  const hh = Math.max(0, input.hoursWorked || 0);
  const frequencyIndex = hh > 0 ? round((input.accidentsWithLostTime * 1_000_000) / hh) : 0;
  const severityIndex = hh > 0 ? round((input.lostDays * 1_000_000) / hh) : 0;
  const accidentRate = round((frequencyIndex * severityIndex) / 1000);
  return {
    frequencyIndex,
    severityIndex,
    accidentRate,
    lostDays: input.lostDays,
    nearMisses: input.nearMisses,
    inspections: input.inspections,
    overdueActions: input.overdueActions,
  };
}
