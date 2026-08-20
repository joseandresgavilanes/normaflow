"use client";

import ChartCard, { LegendItem } from "./ChartCard";
import { useChartTooltip, TooltipRow } from "./ChartTooltip";

export type MatrixRisk = { id: string; probability: number; impact: number; score: number };

/**
 * Niveles de la matriz. Son los mismos cortes que usa el resto del producto
 * (`riskLevel`, el contador de críticos del dashboard y las fichas de riesgo):
 * si la matriz pintara sus propios cortes, dos pantallas dirían cosas
 * distintas del mismo riesgo.
 */
const LEVELS = [
  { id: "critical", label: "Crítico (≥15)", min: 15, fill: "var(--nf-danger-subtle)", ink: "var(--nf-danger-text)", swatch: "var(--nf-danger)" },
  { id: "high", label: "Alto (8–14)", min: 8, fill: "var(--nf-warning-subtle)", ink: "var(--nf-warning-text)", swatch: "var(--nf-warning)" },
  { id: "moderate", label: "Moderado (<8)", min: 0, fill: "var(--nf-success-subtle)", ink: "var(--nf-success-text)", swatch: "var(--nf-success)" },
] as const;

function levelFor(score: number) {
  return LEVELS.find((level) => score >= level.min) ?? LEVELS[LEVELS.length - 1];
}

const AXIS = [1, 2, 3, 4, 5];

/**
 * Matriz de riesgos: probabilidad × impacto.
 *
 * Cada celda lleva escrito **cuántos riesgos** caen en ella, no su puntuación.
 * La puntuación ya la dice la posición —es el producto de los dos ejes— y
 * repetirla dejaba las celdas vacías indistinguibles de las ocupadas: se leía
 * una cuadrícula de 25 números de los que solo unos pocos eran datos.
 *
 * El color va por nivel y nunca viaja solo: la cifra está escrita en la celda
 * y la tabla equivalente acompaña al gráfico.
 */
export default function RiskMatrix<T extends MatrixRisk>({ risks, onSelect, title = "Matriz de riesgos", subtitle = "Probabilidad × impacto. Cada celda cuenta los riesgos que caen en ella." }: {
  risks: T[];
  /**
   * Recibe la celda completa, con el tipo de fila de quien llama: el módulo
   * que abre un detalle necesita su registro entero, no los cuatro campos que
   * la matriz usa para colocarlo.
   */
  onSelect?: (cell: T[]) => void;
  title?: string;
  subtitle?: string;
}) {
  const { show, hide, tooltip } = useChartTooltip();
  const cellsFor = (probability: number, impact: number) =>
    risks.filter((risk) => risk.probability === probability && risk.impact === impact);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={risks.length > 0 ? undefined : "No hay riesgos evaluados todavía."}
      legend={LEVELS.map((level) => <LegendItem key={level.id} color={level.swatch} label={level.label} />)}
      table={
        <table>
          <caption>{title}</caption>
          <thead>
            <tr><th scope="col">Probabilidad</th>{AXIS.map((i) => <th key={i} scope="col">Impacto {i}</th>)}</tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((p) => (
              <tr key={p}>
                <th scope="row">{p}</th>
                {AXIS.map((i) => <td key={i}>{cellsFor(p, i).length} riesgos</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="nf-risk-matrix" data-nf-chart-host>
        <span className="nf-risk-matrix__axis-y">Probabilidad →</span>
        <div className="nf-risk-matrix__grid">
          {[5, 4, 3, 2, 1].map((p) => (
            <div key={p} className="nf-risk-matrix__row">
              <span className="nf-risk-matrix__tick">{p}</span>
              {AXIS.map((i) => {
                const cell = cellsFor(p, i);
                const score = p * i;
                const level = levelFor(score);
                const filled = cell.length > 0;
                return (
                  <button
                    key={i}
                    type="button"
                    data-nf-no-action-icon
                    className="nf-risk-matrix__cell"
                    data-filled={filled || undefined}
                    style={{ background: level.fill, color: level.ink }}
                    disabled={!filled || !onSelect}
                    aria-label={`Probabilidad ${p}, impacto ${i}: ${cell.length} riesgos, nivel ${level.label}`}
                    onClick={() => filled && onSelect?.(cell)}
                    onMouseMove={(event) => show(event, (
                      <TooltipRow
                        label={`Probabilidad ${p} × impacto ${i}`}
                        value={filled ? `${cell.length} riesgo${cell.length === 1 ? "" : "s"}` : "Sin riesgos"}
                        note={`Puntuación ${score} · ${level.label}`}
                      />
                    ))}
                    onMouseLeave={hide}
                  >
                    {filled ? cell.length : ""}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="nf-risk-matrix__row">
            <span className="nf-risk-matrix__tick" />
            {AXIS.map((i) => <span key={i} className="nf-risk-matrix__tick">{i}</span>)}
          </div>
        </div>
        <span className="nf-risk-matrix__axis-x">Impacto →</span>
        {tooltip}
      </div>
    </ChartCard>
  );
}
