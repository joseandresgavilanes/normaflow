"use client";

import ChartCard, { LegendItem } from "./ChartCard";
import { useChartTooltip, TooltipRow } from "./ChartTooltip";

export type StackSegment = { label: string; value: number; color: string };

/**
 * Barra apilada: reparto de un total entre estados.
 *
 * No hay etiqueta dentro de cada tramo. Un tramo interior no tiene extremo
 * libre donde poner el número, y meterlo dentro obliga a recortarlo en cuanto
 * el tramo se estrecha; el reparto lo cuentan la leyenda —que lleva las cifras—
 * y el sobrevuelo.
 */
export default function StackedBar({ title, subtitle, segments, unit = "", empty = "Sin datos todavía." }: {
  title: string;
  subtitle?: string;
  segments: StackSegment[];
  unit?: string;
  empty?: string;
}) {
  const { show, hide, tooltip } = useChartTooltip();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={total > 0 ? undefined : empty}
      legend={segments.map((s) => (
        <LegendItem key={s.label} color={s.color} label={s.label} value={`${s.value}${unit}`} />
      ))}
      table={
        <table>
          <caption>{title}</caption>
          <tbody>
            {segments.map((s) => (
              <tr key={s.label}><th scope="row">{s.label}</th><td>{s.value}{unit}</td></tr>
            ))}
            <tr><th scope="row">Total</th><td>{total}{unit}</td></tr>
          </tbody>
        </table>
      }
    >
      <div className="nf-chart-stack" data-nf-chart-host>
        {visible.map((s) => (
          <span
            key={s.label}
            className="nf-chart-stack__segment"
            style={{ flexGrow: s.value, background: s.color }}
            onMouseMove={(event) => show(event, <TooltipRow label={s.label} value={`${s.value}${unit}`} note={`${Math.round((s.value / total) * 100)}% del total`} />)}
            onMouseLeave={hide}
          />
        ))}
        {tooltip}
      </div>
    </ChartCard>
  );
}
