"use client";

import { useState } from "react";
import ChartCard from "./ChartCard";

export type TrendPoint = { label: string; value: number };

const W = 320;
const H = 96;
const PAD = { top: 8, right: 8, bottom: 18, left: 30 };

/**
 * Serie temporal de una sola métrica.
 *
 * `viewBox` sin ancho fijo: el gráfico escala con la tarjeta que lo contiene.
 * Los valores se escriben en el sobrevuelo y en el extremo, no sobre cada
 * punto — un número por punto deja de leerse en cuanto hay más de cuatro.
 */
export default function TrendLine({ title, subtitle, points, unit = "", target, empty = "Aún no hay serie histórica." }: {
  title: string;
  subtitle?: string;
  points: TrendPoint[];
  unit?: string;
  /** Línea de referencia (meta del indicador). */
  target?: number | null;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return <ChartCard title={title} subtitle={subtitle} empty={empty}>{null}</ChartCard>;
  }

  const values = points.map((p) => p.value).concat(target != null ? [target] : []);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;
  const last = points[points.length - 1];
  const active = hover != null ? points[hover] : null;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <table>
          <caption>{title}</caption>
          <tbody>
            {points.map((p) => <tr key={p.label}><th scope="row">{p.label}</th><td>{p.value}{unit}</td></tr>)}
          </tbody>
        </table>
      }
    >
      <div className="nf-chart-trend" data-nf-chart-host>
        <svg viewBox={`0 0 ${W} ${H}`} className="nf-chart-trend__svg" role="img" aria-label={`${title}: ${points.length} periodos, último valor ${last.value}${unit}`}>
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--nf-chart-axis)" strokeWidth="1" />
          <text x={PAD.left - 4} y={y(max)} textAnchor="end" dominantBaseline="middle" className="nf-chart-trend__tick">{Math.round(max)}</text>
          <text x={PAD.left - 4} y={y(min)} textAnchor="end" dominantBaseline="middle" className="nf-chart-trend__tick">{Math.round(min)}</text>

          {target != null && (
            <line x1={PAD.left} y1={y(target)} x2={W - PAD.right} y2={y(target)} stroke="var(--nf-chart-grid)" strokeWidth="1" />
          )}

          <path d={area} fill="var(--nf-series-1)" fillOpacity="0.1" />
          <path d={line} fill="none" stroke="var(--nf-series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {active && <line x1={x(hover!)} y1={PAD.top} x2={x(hover!)} y2={H - PAD.bottom} stroke="var(--nf-chart-axis)" strokeWidth="1" />}

          <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--nf-series-1)" stroke="var(--nf-surface)" strokeWidth="2" />
          {active && <circle cx={x(hover!)} cy={y(active.value)} r="4" fill="var(--nf-series-1)" stroke="var(--nf-surface)" strokeWidth="2" />}

          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="nf-chart-trend__tick">{last.label}</text>
          <text x={PAD.left} y={H - 4} textAnchor="start" className="nf-chart-trend__tick">{points[0].label}</text>

          {/* Zonas de sobrevuelo: más anchas que el punto, que con r=4 sería
              un objetivo imposible de acertar con el ratón. */}
          {points.map((p, i) => (
            <rect
              key={p.label}
              x={x(i) - (W / points.length) / 2}
              y={0}
              width={W / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {active && (
          <div className="nf-chart-trend__readout">
            <span className="nf-chart-trend__readout-label">{active.label}</span>
            <span className="nf-chart-trend__readout-value">{active.value}{unit}</span>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
