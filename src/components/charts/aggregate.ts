import type { BarDatum } from "./BarChart";
import { statusLabel } from "@/lib/status-labels";

/**
 * Reparto de un registro por uno de sus campos.
 *
 * Cuenta sobre las filas que el módulo ya tiene en memoria: no hay consulta
 * nueva ni cifra derivada de otra pantalla, así que el gráfico no puede
 * contradecir a la tabla que tiene debajo.
 *
 * Ordena de mayor a menor y agrupa la cola: un registro con veinte estados
 * distintos produce veinte barras de una unidad, que no comparan nada.
 */
export function distribution<T>(
  rows: readonly T[],
  key: (row: T) => string | null | undefined,
  options: { labels?: Record<string, string>; top?: number; emptyLabel?: string } = {},
): BarDatum[] {
  const { labels = {}, top = 8, emptyLabel = "Sin clasificar" } = options;
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const raw = key(row);
    const id = raw == null || raw === "" ? emptyLabel : String(raw);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  /* Sin catálogo explícito se pasa por el de estados: agrupar por `status` y
     pintar el enum tal cual ponía «ASSIGNED» o «DRAFT» delante del usuario. */
  const head = sorted.slice(0, top).map(([id, value]) => ({ label: labels[id] ?? statusLabel(id), value }));
  const tail = sorted.slice(top).reduce((sum, [, value]) => sum + value, 0);
  return tail > 0 ? [...head, { label: "Otros", value: tail }] : head;
}
