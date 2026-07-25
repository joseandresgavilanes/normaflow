/**
 * Fórmulas configurables y versionadas del SGEn (ISO 50001).
 *
 * Cada cálculo recibe un `formulaKind`, una `formulaConfig` (JSON) y entradas
 * numéricas. La versión vive en el registro (EnPI / baseline / verificación);
 * aquí solo se evalúa de forma pura y determinista.
 */

export type EnergyFormulaKind =
  | "CONSUMPTION"
  | "INTENSITY"
  | "BASELINE_COMPARISON"
  | "DEVIATION"
  | "ABSOLUTE_SAVINGS"
  | "NORMALIZED_SAVINGS"
  | "COST"
  | "EMISSIONS"
  | "CUSTOM";

export type NormalizationMethod = "NONE" | "RATIO" | "LINEAR" | "CUSTOM";

export type FormulaConfig = {
  /** Método de normalización cuando aplica. */
  normalizationMethod?: NormalizationMethod;
  /** Coeficiente de regresión lineal (consumo = a + b·variable). */
  intercept?: number;
  slope?: number;
  /** Clave de variable relevante en el mapa de valores. */
  variableKey?: string;
  /** Clave de factor estático (p. ej. área). */
  staticFactorKey?: string;
  /** Factor de emisión override (tCO2e / unidad). */
  emissionFactor?: number;
  /** Coste unitario override. */
  costPerUnit?: number;
  /** Expresión personalizada reconocida: "consumption/denominator". */
  expression?: string;
};

export type FormulaInputs = {
  consumption?: number;
  baselineConsumption?: number;
  expectedConsumption?: number;
  activity?: number;
  denominator?: number;
  relevantVariables?: Record<string, number>;
  staticFactors?: Record<string, number>;
  emissionFactor?: number;
  costPerUnit?: number;
};

export type FormulaResult = {
  kind: EnergyFormulaKind;
  value: number;
  unitHint?: string;
  detail: Record<string, number>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function readFormulaConfig(raw: unknown): FormulaConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    normalizationMethod: (["NONE", "RATIO", "LINEAR", "CUSTOM"].includes(String(o.normalizationMethod))
      ? String(o.normalizationMethod) as NormalizationMethod
      : undefined),
    intercept: o.intercept !== undefined ? num(o.intercept) : undefined,
    slope: o.slope !== undefined ? num(o.slope) : undefined,
    variableKey: typeof o.variableKey === "string" ? o.variableKey : undefined,
    staticFactorKey: typeof o.staticFactorKey === "string" ? o.staticFactorKey : undefined,
    emissionFactor: o.emissionFactor !== undefined ? num(o.emissionFactor) : undefined,
    costPerUnit: o.costPerUnit !== undefined ? num(o.costPerUnit) : undefined,
    expression: typeof o.expression === "string" ? o.expression : undefined,
  };
}

/** Suma de lecturas / consumos del periodo. */
export function consumptionByPeriod(values: number[]): number {
  return round2(values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0));
}

/** Intensidad energética = consumo / actividad (o denominador). */
export function energyIntensity(consumption: number, activity: number): number {
  if (!activity || activity <= 0) throw new Error("La intensidad energética exige una actividad (denominador) mayor que cero.");
  return round2(consumption / activity);
}

/** Comparación con línea base: ratio actual/base (1 = igual). */
export function baselineComparison(actual: number, baseline: number): number {
  if (!baseline) throw new Error("La comparación con línea base exige un consumo base distinto de cero.");
  return round2(actual / baseline);
}

/** Desviación porcentual respecto a lo esperado/base. */
export function deviationPercent(actual: number, expected: number): number {
  if (!expected) throw new Error("La desviación exige un valor esperado distinto de cero.");
  return round2(((actual - expected) / expected) * 100);
}

/** Ahorro absoluto = base − actual (positivo = mejora). */
export function absoluteSaving(baseline: number, actual: number): number {
  return round2(baseline - actual);
}

/**
 * Normaliza un consumo según método configurado.
 * - RATIO: consumo × (var_ref / var_actual) o consumo / factor estático
 * - LINEAR: consumo − (intercept + slope × variable)
 * - NONE: sin ajuste
 */
export function normalizeConsumption(
  consumption: number,
  config: FormulaConfig,
  inputs: FormulaInputs,
): number {
  const method = config.normalizationMethod ?? "NONE";
  if (method === "NONE") return round2(consumption);

  if (method === "RATIO") {
    const key = config.variableKey;
    const staticKey = config.staticFactorKey;
    if (key) {
      const actual = num(inputs.relevantVariables?.[key]);
      const ref = num(inputs.activity, actual);
      if (!actual) throw new Error(`Variable relevante "${key}" ausente o cero para normalizar.`);
      return round2(consumption * (ref / actual));
    }
    if (staticKey) {
      const factor = num(inputs.staticFactors?.[staticKey], inputs.denominator);
      if (!factor) throw new Error(`Factor estático "${staticKey}" ausente o cero para normalizar.`);
      return round2(consumption / factor);
    }
    const den = num(inputs.denominator, inputs.activity);
    if (!den) throw new Error("Normalización RATIO exige denominador, variable o factor estático.");
    return round2(consumption / den);
  }

  if (method === "LINEAR") {
    const key = config.variableKey ?? "x";
    const x = num(inputs.relevantVariables?.[key], inputs.activity);
    const intercept = num(config.intercept);
    const slope = num(config.slope);
    // Consumo ajustado a condiciones de referencia (x=activity o 0).
    const ref = num(inputs.activity, 0);
    const expectedAtActual = intercept + slope * x;
    const expectedAtRef = intercept + slope * ref;
    return round2(consumption - (expectedAtActual - expectedAtRef));
  }

  // CUSTOM: consumo / denominator si existe.
  const den = num(inputs.denominator, inputs.activity);
  if (!den) return round2(consumption);
  return round2(consumption / den);
}

export function normalizedSaving(
  baseline: number,
  actual: number,
  config: FormulaConfig,
  baselineInputs: FormulaInputs,
  actualInputs: FormulaInputs,
): number {
  const nb = normalizeConsumption(baseline, config, baselineInputs);
  const na = normalizeConsumption(actual, config, actualInputs);
  return round2(nb - na);
}

export function energyCost(consumption: number, costPerUnit: number): number {
  return round2(consumption * costPerUnit);
}

export function associatedEmissions(consumption: number, emissionFactor: number): number {
  return round2(consumption * emissionFactor);
}

/**
 * Evalúa una fórmula versionada. `formulaVersion` se registra en el caller;
 * aquí solo se usa para trazabilidad del resultado.
 */
export function evaluateEnergyFormula(
  kind: EnergyFormulaKind | string,
  configRaw: unknown,
  inputs: FormulaInputs,
  formulaVersion = "1",
): FormulaResult & { formulaVersion: string } {
  const config = readFormulaConfig(configRaw);
  const k = (kind || "CONSUMPTION").toUpperCase() as EnergyFormulaKind;
  const consumption = num(inputs.consumption);
  const baseline = num(inputs.baselineConsumption);
  const expected = num(inputs.expectedConsumption, baseline);
  const activity = num(inputs.activity, inputs.denominator);
  const emissionFactor = num(config.emissionFactor, inputs.emissionFactor);
  const costPerUnit = num(config.costPerUnit, inputs.costPerUnit);

  let value: number;
  const detail: Record<string, number> = { consumption };

  switch (k) {
    case "INTENSITY":
      value = energyIntensity(consumption, activity || num(inputs.denominator));
      detail.activity = activity || num(inputs.denominator);
      break;
    case "BASELINE_COMPARISON":
      value = baselineComparison(consumption, baseline);
      detail.baseline = baseline;
      break;
    case "DEVIATION":
      value = deviationPercent(consumption, expected);
      detail.expected = expected;
      break;
    case "ABSOLUTE_SAVINGS":
      value = absoluteSaving(baseline, consumption);
      detail.baseline = baseline;
      break;
    case "NORMALIZED_SAVINGS":
      value = normalizedSaving(baseline, consumption, config, {
        ...inputs, consumption: baseline, activity: num(inputs.activity),
        relevantVariables: inputs.relevantVariables,
        staticFactors: inputs.staticFactors,
      }, inputs);
      detail.baseline = baseline;
      break;
    case "COST":
      if (!costPerUnit) throw new Error("El cálculo de coste exige costPerUnit en la fórmula o en la fuente.");
      value = energyCost(consumption, costPerUnit);
      detail.costPerUnit = costPerUnit;
      break;
    case "EMISSIONS":
      if (!emissionFactor) throw new Error("El cálculo de emisiones exige emissionFactor configurable.");
      value = associatedEmissions(consumption, emissionFactor);
      detail.emissionFactor = emissionFactor;
      break;
    case "CUSTOM": {
      const den = num(inputs.denominator, activity);
      if (config.expression === "consumption/denominator" || den) {
        if (!den) throw new Error("Fórmula CUSTOM consumption/denominator sin denominador.");
        value = energyIntensity(consumption, den);
        detail.denominator = den;
      } else {
        value = normalizeConsumption(consumption, config, inputs);
      }
      break;
    }
    case "CONSUMPTION":
    default:
      value = round2(consumption);
  }

  return { kind: k, value, detail, formulaVersion };
}

/** ¿Un SEU es significativo por participación o potencial? Umbrales configurables. */
export function isSignificantEnergyUse(input: {
  consumptionShare?: number | null;
  improvementPotential?: number | null;
  shareThreshold?: number;
  potentialThreshold?: number;
}): boolean {
  const shareT = input.shareThreshold ?? 10;
  const potT = input.potentialThreshold ?? 5;
  if (typeof input.consumptionShare === "number" && input.consumptionShare >= shareT) return true;
  if (typeof input.improvementPotential === "number" && input.improvementPotential >= potT) return true;
  return false;
}
