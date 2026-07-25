/**
 * Evaluación de impacto y clasificación de riesgo del sistema de IA
 * (ISO/IEC 42001 §6.1.4 y §A.5.2).
 *
 * Las siete dimensiones evaluadas —derechos, seguridad, privacidad, sesgo,
 * transparencia, explicabilidad y supervisión humana— se puntúan por separado.
 * El agregado toma la peor dimensión como techo (un impacto SEVERE sobre
 * derechos no se compensa con buena explicabilidad) y usa la media ponderada
 * para desempatar.
 *
 * La clasificación resultante determina las salvaguardas mínimas exigidas; la
 * decisión final sigue siendo humana (la evaluación se aprueba en HUMAN_REVIEW).
 */
import type { AIImpactSeverity, AIRiskClassification, AISystemCriticality } from "@prisma/client";

export const IMPACT_DIMENSIONS = [
  "rights",
  "safety",
  "privacy",
  "bias",
  "transparency",
  "explainability",
  "oversight",
] as const;

export type ImpactDimension = (typeof IMPACT_DIMENSIONS)[number];

/** Las dimensiones que afectan a las personas pesan más que las instrumentales. */
const WEIGHTS: Record<ImpactDimension, number> = {
  rights: 3,
  safety: 3,
  privacy: 2,
  bias: 2,
  transparency: 1,
  explainability: 1,
  oversight: 2,
};

const SEVERITY_SCORE: Record<AIImpactSeverity, number> = {
  NOT_ASSESSED: 0,
  NONE: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  SEVERE: 4,
};

const SCORE_SEVERITY: AIImpactSeverity[] = ["NONE", "LOW", "MODERATE", "HIGH", "SEVERE"];

export type ImpactAssessmentInput = Partial<Record<ImpactDimension, AIImpactSeverity | null | undefined>>;

export type ImpactAssessmentResult = {
  /** Media ponderada 0..4 de las dimensiones evaluadas. */
  overallScore: number;
  overallSeverity: AIImpactSeverity;
  classification: AIRiskClassification;
  /** Dimensiones sin valorar — la evaluación está incompleta mientras existan. */
  unassessed: ImpactDimension[];
  /** Dimensiones en HIGH o SEVERE, las que obligan a salvaguardas. */
  drivers: ImpactDimension[];
  complete: boolean;
};

function severityFromScore(score: number): AIImpactSeverity {
  return SCORE_SEVERITY[Math.min(SCORE_SEVERITY.length - 1, Math.max(0, Math.round(score)))];
}

/**
 * Agrega las dimensiones evaluadas. `overallSeverity` nunca queda por debajo de
 * la peor dimensión: el máximo manda y la media ponderada solo puede elevarlo.
 */
export function assessImpact(input: ImpactAssessmentInput): ImpactAssessmentResult {
  const unassessed: ImpactDimension[] = [];
  const drivers: ImpactDimension[] = [];
  let weighted = 0;
  let weight = 0;
  let worst = 0;

  for (const dimension of IMPACT_DIMENSIONS) {
    const severity = input[dimension];
    if (!severity || severity === "NOT_ASSESSED") {
      unassessed.push(dimension);
      continue;
    }
    const score = SEVERITY_SCORE[severity];
    weighted += score * WEIGHTS[dimension];
    weight += WEIGHTS[dimension];
    worst = Math.max(worst, score);
    if (severity === "HIGH" || severity === "SEVERE") drivers.push(dimension);
  }

  if (weight === 0) {
    return { overallScore: 0, overallSeverity: "NOT_ASSESSED", classification: "NOT_CLASSIFIED", unassessed, drivers, complete: false };
  }

  const mean = Math.round((weighted / weight) * 100) / 100;
  const overallSeverity = severityFromScore(Math.max(worst, mean));
  return {
    overallScore: mean,
    overallSeverity,
    classification: classifyFromSeverity(overallSeverity),
    unassessed,
    drivers,
    complete: unassessed.length === 0,
  };
}

/** Severidad agregada → clasificación de riesgo del sistema. */
export function classifyFromSeverity(severity: AIImpactSeverity): AIRiskClassification {
  switch (severity) {
    case "SEVERE":
      return "UNACCEPTABLE";
    case "HIGH":
      return "HIGH";
    case "MODERATE":
      return "LIMITED";
    case "LOW":
    case "NONE":
      return "MINIMAL";
    default:
      return "NOT_CLASSIFIED";
  }
}

/**
 * Clasificación del sistema combinando la evaluación de impacto con la
 * criticidad declarada: la criticidad puede elevar la clase, nunca rebajarla.
 */
export function classifySystem(
  criticality: AISystemCriticality,
  impact: AIRiskClassification,
): AIRiskClassification {
  const order: AIRiskClassification[] = ["NOT_CLASSIFIED", "MINIMAL", "LIMITED", "HIGH", "UNACCEPTABLE"];
  const fromCriticality: Record<AISystemCriticality, AIRiskClassification> = {
    LOW: "MINIMAL",
    MEDIUM: "LIMITED",
    HIGH: "HIGH",
    CRITICAL: "HIGH",
  };
  const floor = fromCriticality[criticality];
  return order.indexOf(impact) >= order.indexOf(floor) ? impact : floor;
}

/**
 * Salvaguardas mínimas exigidas por clasificación. Se usan en la UI y en el
 * informe de evaluación de impacto como lista de verificación.
 */
export function requiredSafeguards(classification: AIRiskClassification): string[] {
  const base = ["Registro en el inventario de sistemas de IA", "Propietario y propósito documentados"];
  switch (classification) {
    case "UNACCEPTABLE":
      return [
        ...base,
        "Uso prohibido: no desplegar y documentar la decisión",
        "Escalar a la dirección y registrar la revisión",
      ];
    case "HIGH":
      return [
        ...base,
        "Evaluación de impacto aprobada por una persona",
        "Supervisión humana con capacidad de anular y detener",
        "Evaluación del modelo con métricas de sesgo antes de producción",
        "Procedencia y calidad de los datos documentadas",
        "Transparencia hacia las personas afectadas",
        "Monitoreo continuo con umbrales y alertas",
      ];
    case "LIMITED":
      return [
        ...base,
        "Evaluación de impacto aprobada por una persona",
        "Supervisión humana definida",
        "Aviso de uso de IA a los usuarios",
        "Monitoreo periódico del desempeño",
      ];
    case "MINIMAL":
      return [...base, "Revisión periódica del inventario"];
    default:
      return [...base, "Completar la evaluación de impacto para clasificar el sistema"];
  }
}

/** Un sistema de clase HIGH/UNACCEPTABLE no puede producir sin controles clave. */
export function missingHighRiskSafeguards(input: {
  classification: AIRiskClassification;
  hasApprovedImpactAssessment: boolean;
  hasOversightControl: boolean;
  hasPassedEvaluation: boolean;
  hasTransparencyRecord: boolean;
}): string[] {
  if (input.classification !== "HIGH" && input.classification !== "UNACCEPTABLE") return [];
  const missing: string[] = [];
  if (!input.hasApprovedImpactAssessment) missing.push("evaluación de impacto aprobada");
  if (!input.hasOversightControl) missing.push("control de supervisión humana");
  if (!input.hasPassedEvaluation) missing.push("evaluación del modelo superada");
  if (!input.hasTransparencyRecord) missing.push("registro de transparencia");
  return missing;
}
