/**
 * Lógica pura del Análisis de Impacto en el Negocio (BIA) — ISO 22301 §8.2.
 *
 * Sin acceso a base de datos: testeable de forma aislada.
 */

export type CriticalityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ImpactScores = {
  financialImpact: number;
  operationalImpact: number;
  legalImpact: number;
  reputationalImpact: number;
  peopleImpact: number;
};

/** Peso relativo de cada categoría de impacto (suma 1). */
const WEIGHTS: Record<keyof ImpactScores, number> = {
  financialImpact: 0.25,
  operationalImpact: 0.2,
  legalImpact: 0.2,
  reputationalImpact: 0.15,
  peopleImpact: 0.2,
};

const clamp = (n: number, min = 0, max = 5) => Math.min(max, Math.max(min, n));

/**
 * Puntuación de impacto 0-100 a partir de las cinco categorías (escala 1-5).
 * La seguridad de las personas y el impacto legal pesan alto de forma
 * deliberada: una actividad con impacto en personas nunca queda como baja.
 */
export function impactScore(scores: ImpactScores): number {
  const weighted = (Object.keys(WEIGHTS) as (keyof ImpactScores)[])
    .reduce((sum, key) => sum + clamp(scores[key]) * WEIGHTS[key], 0);
  return Math.round((weighted / 5) * 100);
}

/**
 * Nivel de criticidad combinando el impacto y la urgencia temporal (MTPD).
 * Cuanto menor es el MTPD, más crítica es la actividad aunque el impacto sea
 * moderado: una actividad que no tolera 4 horas de parada es crítica.
 */
export function criticalityFor(score: number, mtpdMinutes?: number | null): CriticalityLevel {
  const urgent = typeof mtpdMinutes === "number" && mtpdMinutes <= 240;   // <= 4 h
  const veryUrgent = typeof mtpdMinutes === "number" && mtpdMinutes <= 60; // <= 1 h

  if (score >= 80 || veryUrgent) return "CRITICAL";
  if (score >= 60 || urgent) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

/** Orden de prioridad de recuperación: primero lo más crítico y urgente. */
export function recoveryPriority(
  items: { id: string; impactScore: number; mtpdMinutes?: number | null }[],
): { id: string; priority: number }[] {
  return [...items]
    .sort((a, b) => {
      if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
      const am = a.mtpdMinutes ?? Number.MAX_SAFE_INTEGER;
      const bm = b.mtpdMinutes ?? Number.MAX_SAFE_INTEGER;
      return am - bm;
    })
    .map((item, index) => ({ id: item.id, priority: index + 1 }));
}

export class ContinuityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContinuityValidationError";
  }
}

/**
 * Regla dura de ISO 22301: el RTO debe ser MENOR O IGUAL que el MTPD.
 * Recuperar después del máximo periodo tolerable equivale a no recuperar.
 */
export function assertRtoWithinMtpd(rtoMinutes?: number | null, mtpdMinutes?: number | null): void {
  if (typeof rtoMinutes !== "number" || typeof mtpdMinutes !== "number") return;
  if (rtoMinutes > mtpdMinutes) {
    throw new ContinuityValidationError(
      `El RTO (${rtoMinutes} min) no puede superar el MTPD (${mtpdMinutes} min).`,
    );
  }
}

/** Brechas de continuidad detectadas sobre una actividad crítica. */
export type ContinuityGap = {
  activityId: string;
  activityName: string;
  kind: "NO_RTO" | "NO_MTPD" | "RTO_EXCEEDS_MTPD" | "NO_STRATEGY" | "NO_PROCEDURE" | "SPOF" | "STRATEGY_RTO_INSUFFICIENT" | "NEVER_TESTED";
  detail: string;
};

export type GapInput = {
  id: string;
  name: string;
  mtpdMinutes?: number | null;
  rtoMinutes?: number | null;
  strategies: { achievesRtoMinutes?: number | null; status: string }[];
  procedures: number;
  dependencies: { name: string; singlePointOfFailure: boolean }[];
  tested: boolean;
};

/**
 * Detecta las brechas de continuidad de una actividad: objetivos sin definir,
 * RTO inalcanzable, ausencia de estrategia o procedimiento, puntos únicos de
 * fallo y actividades nunca ejercitadas.
 */
export function detectGaps(activity: GapInput): ContinuityGap[] {
  const gaps: ContinuityGap[] = [];
  const base = { activityId: activity.id, activityName: activity.name };

  if (typeof activity.mtpdMinutes !== "number") {
    gaps.push({ ...base, kind: "NO_MTPD", detail: "Sin MTPD definido." });
  }
  if (typeof activity.rtoMinutes !== "number") {
    gaps.push({ ...base, kind: "NO_RTO", detail: "Sin RTO definido." });
  }
  if (typeof activity.rtoMinutes === "number" && typeof activity.mtpdMinutes === "number" && activity.rtoMinutes > activity.mtpdMinutes) {
    gaps.push({ ...base, kind: "RTO_EXCEEDS_MTPD", detail: `RTO ${activity.rtoMinutes} min supera el MTPD ${activity.mtpdMinutes} min.` });
  }

  const usable = activity.strategies.filter((s) => s.status === "APPROVED" || s.status === "IMPLEMENTED");
  if (!usable.length) {
    gaps.push({ ...base, kind: "NO_STRATEGY", detail: "Sin estrategia de continuidad aprobada o implementada." });
  } else if (typeof activity.rtoMinutes === "number") {
    const best = usable
      .map((s) => s.achievesRtoMinutes)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b)[0];
    if (typeof best === "number" && best > activity.rtoMinutes) {
      gaps.push({ ...base, kind: "STRATEGY_RTO_INSUFFICIENT", detail: `La mejor estrategia recupera en ${best} min pero el RTO es ${activity.rtoMinutes} min.` });
    }
  }

  if (activity.procedures === 0) {
    gaps.push({ ...base, kind: "NO_PROCEDURE", detail: "Sin procedimiento de recuperación documentado." });
  }
  for (const dep of activity.dependencies.filter((d) => d.singlePointOfFailure)) {
    gaps.push({ ...base, kind: "SPOF", detail: `Punto único de fallo: ${dep.name}.` });
  }
  if (!activity.tested) {
    gaps.push({ ...base, kind: "NEVER_TESTED", detail: "La actividad nunca se ha ejercitado en un simulacro." });
  }
  return gaps;
}

/**
 * Grado de preparación 0-100: proporción de actividades críticas sin brechas,
 * ponderada para que las actividades CRITICAL/HIGH pesen más.
 */
export function readinessScore(
  activities: { criticality: CriticalityLevel; gaps: number }[],
): number {
  if (!activities.length) return 0;
  const weightOf = (c: CriticalityLevel) => (c === "CRITICAL" ? 4 : c === "HIGH" ? 3 : c === "MEDIUM" ? 2 : 1);
  const total = activities.reduce((sum, a) => sum + weightOf(a.criticality), 0);
  const ready = activities.reduce((sum, a) => sum + (a.gaps === 0 ? weightOf(a.criticality) : 0), 0);
  return Math.round((ready / total) * 100);
}

/** Comprueba si el resultado de un simulacro cumplió los objetivos fijados. */
export function meetsObjectives(args: {
  targetRtoMinutes?: number | null;
  targetRpoMinutes?: number | null;
  achievedRtoMinutes?: number | null;
  achievedRpoMinutes?: number | null;
}): boolean {
  const rtoOk = typeof args.targetRtoMinutes !== "number" || typeof args.achievedRtoMinutes !== "number"
    ? true
    : args.achievedRtoMinutes <= args.targetRtoMinutes;
  const rpoOk = typeof args.targetRpoMinutes !== "number" || typeof args.achievedRpoMinutes !== "number"
    ? true
    : args.achievedRpoMinutes <= args.targetRpoMinutes;
  return rtoOk && rpoOk;
}
