/**
 * Catálogo controlado para categorías de riesgo.
 * ISO 31000 (gestión del riesgo) e ISO 27005 (riesgos de seguridad de la información)
 * recomiendan clasificar riesgos para análisis, priorización y reporting;
 * un vocabulario cerrado facilita matrices, tendencias y auditoría.
 */

export const RISK_CATEGORIES = [
  "Operacional",
  "Estratégico",
  "Financiero",
  "Legal / regulatorio",
  "Cumplimiento / normativo",
  "Seguridad de la información / TI",
  "Tecnológico",
  "Reputacional",
  "Recursos humanos",
  "Proveedor / cadena de suministro",
  "Ambiental / SST",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const DEFAULT_RISK_CATEGORY: RiskCategory = "Operacional";

/** Incluye valor histórico al editar registros creados antes del catálogo. */
export function riskCategoryOptions(current?: string): string[] {
  if (current && !RISK_CATEGORIES.includes(current as RiskCategory)) {
    return [current, ...RISK_CATEGORIES];
  }
  return [...RISK_CATEGORIES];
}
