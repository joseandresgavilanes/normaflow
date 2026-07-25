/**
 * Límites críticos y evaluación de monitoreo CCP/OPRP.
 */
import type { LimitOperator } from "@prisma/client";

export type LimitLike = {
  operator: LimitOperator | string;
  minValue?: number | null;
  maxValue?: number | null;
  targetValue?: number | null;
};

export function isWithinCriticalLimits(value: number, limit: LimitLike): boolean {
  if (!Number.isFinite(value)) return false;
  const op = String(limit.operator || "BETWEEN").toUpperCase();
  const min = limit.minValue;
  const max = limit.maxValue;
  const target = limit.targetValue;

  switch (op) {
    case "LT":
      return typeof max === "number" ? value < max : typeof target === "number" ? value < target : false;
    case "LTE":
      return typeof max === "number" ? value <= max : typeof target === "number" ? value <= target : false;
    case "GT":
      return typeof min === "number" ? value > min : typeof target === "number" ? value > target : false;
    case "GTE":
      return typeof min === "number" ? value >= min : typeof target === "number" ? value >= target : false;
    case "EQ":
      return typeof target === "number" ? value === target : false;
    case "BETWEEN":
    default:
      if (typeof min === "number" && typeof max === "number") return value >= min && value <= max;
      if (typeof min === "number") return value >= min;
      if (typeof max === "number") return value <= max;
      return true;
  }
}

export function assertLimitDefinition(limit: LimitLike): void {
  const op = String(limit.operator || "BETWEEN").toUpperCase();
  if (op === "BETWEEN") {
    if (typeof limit.minValue !== "number" || typeof limit.maxValue !== "number") {
      throw new Error("Un límite BETWEEN exige valor mínimo y máximo.");
    }
    if (limit.minValue > limit.maxValue) {
      throw new Error("El valor mínimo del límite crítico no puede superar al máximo.");
    }
  }
  if ((op === "LT" || op === "LTE") && typeof limit.maxValue !== "number" && typeof limit.targetValue !== "number") {
    throw new Error(`El operador ${op} exige un valor máximo o un valor objetivo.`);
  }
  if ((op === "GT" || op === "GTE") && typeof limit.minValue !== "number" && typeof limit.targetValue !== "number") {
    throw new Error(`El operador ${op} exige un valor mínimo o un valor objetivo.`);
  }
  if (op === "EQ" && typeof limit.targetValue !== "number") {
    throw new Error("El operador EQ exige un valor objetivo.");
  }
}
