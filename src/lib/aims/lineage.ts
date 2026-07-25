/**
 * Procedencia de datos (ISO/IEC 42001 §A.7.2).
 *
 * Ordena los pasos de transformación de un dataset y verifica que la cadena sea
 * auditable: numeración sin huecos ni duplicados, ingesta como primer paso y
 * fuentes declaradas. Puro: la cadena se valida igual en la UI y en el informe.
 */
import type { DataLineageOperation } from "@prisma/client";

export type LineageStep = {
  step: number;
  operation: DataLineageOperation;
  description?: string | null;
  inputRef?: string | null;
  outputRef?: string | null;
  performedAt?: Date | null;
};

export type LineageChain = {
  steps: LineageStep[];
  /** Problemas que rompen la trazabilidad de la procedencia. */
  gaps: string[];
  traceable: boolean;
  /** Operaciones que destruyen información y no pueden revertirse. */
  irreversibleOperations: DataLineageOperation[];
};

const IRREVERSIBLE: DataLineageOperation[] = ["ANONYMIZATION", "AGGREGATION", "DELETION"];

/**
 * Construye la cadena de procedencia. `sourceCount` permite exigir al menos una
 * fuente declarada: sin origen no hay procedencia, solo un dataset huérfano.
 */
export function buildLineageChain(rows: LineageStep[], sourceCount = 0): LineageChain {
  const steps = [...rows].sort((a, b) => a.step - b.step);
  const gaps: string[] = [];

  if (sourceCount === 0) gaps.push("el dataset no declara ninguna fuente de datos");
  if (steps.length === 0) {
    gaps.push("no hay pasos de procedencia registrados");
    return { steps, gaps, traceable: false, irreversibleOperations: [] };
  }

  const seen = new Set<number>();
  for (const [index, current] of steps.entries()) {
    if (seen.has(current.step)) gaps.push(`paso ${current.step} duplicado`);
    seen.add(current.step);
    const expected = index + 1;
    if (current.step !== expected) gaps.push(`falta el paso ${expected} en la secuencia`);
  }
  if (steps[0].operation !== "INGESTION") gaps.push("la cadena no comienza por una ingesta de datos");

  return {
    steps,
    gaps,
    traceable: gaps.length === 0,
    irreversibleOperations: steps.map((s) => s.operation).filter((op) => IRREVERSIBLE.includes(op)),
  };
}

/** Siguiente número de paso libre para un dataset. */
export function nextLineageStep(rows: { step: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.step), 0) + 1;
}
