"use client";

import ChartCard from "./ChartCard";
import { useChartTooltip, TooltipRow } from "./ChartTooltip";

export type BarDatum = {
  label: string;
  value: number;
  /** Color de la marca. Por defecto una sola tinta: la magnitud no es identidad. */
  color?: string;
  /** Texto del valor si no es el número crudo (porcentajes, unidades). */
  display?: string;
  note?: string;
};

/**
 * Barras horizontales para comparar magnitudes entre categorías.
 *
 * Horizontal y no vertical porque las categorías de este producto son frases
 * («Consulta a trabajadores», «Cumplimiento legal»): en columnas habría que
 * girar las etiquetas, y una etiqueta girada se deja de leer.
 *
 * Una sola tinta por defecto. La paleta categórica solo entra cuando las
 * series *son* el tema; para «cuál es más grande» el color no aporta nada y
 * ocho tintas convierten una comparación en un juego de memoria.
 */
export default function BarChart({ title, subtitle, data, max, unit = "", empty = "Sin datos todavía.", action }: {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  /** Tope de la escala. Por defecto el mayor valor, mínimo 1 para no dividir por cero. */
  max?: number;
  unit?: string;
  empty?: string;
  /** Salida del estado vacío: dónde se crean los datos que faltan. */
  action?: { label: string; href: string };
}) {
  const { show, hide, tooltip } = useChartTooltip();
  const top = Math.max(max ?? Math.max(...data.map((d) => d.value), 0), 1);
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={hasData ? undefined : empty}
      action={action}
      table={
        <table>
          <caption>{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}><th scope="row">{d.label}</th><td>{d.display ?? `${d.value}${unit}`}</td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="nf-chart-bars" data-nf-chart-host>
        {data.map((d) => (
          <div
            key={d.label}
            className="nf-chart-bars__row"
            onMouseMove={(event) => show(event, <TooltipRow label={d.label} value={d.display ?? `${d.value}${unit}`} note={d.note} />)}
            onMouseLeave={hide}
          >
            <span className="nf-chart-bars__label" title={d.label}>{d.label}</span>
            <span className="nf-chart-bars__track">
              <span
                className="nf-chart-bars__fill"
                style={{ width: `${Math.max((d.value / top) * 100, d.value > 0 ? 1.5 : 0)}%`, background: d.color ?? "var(--nf-series-1)" }}
              />
            </span>
            <span className="nf-chart-bars__value">{d.display ?? `${d.value}${unit}`}</span>
          </div>
        ))}
        {tooltip}
      </div>
    </ChartCard>
  );
}
