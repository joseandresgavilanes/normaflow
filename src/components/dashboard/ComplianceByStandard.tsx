"use client";

import { useId } from "react";
import { useI18n } from "@/context/I18nProvider";

/**
 * Cumplimiento por norma.
 *
 * Sustituye al gráfico anterior, que era una línea de tendencia **inventada**:
 * de sus diez puntos (`62, 58, 65, 61, 70, 68, 72, 69, 74, …`) solo el último
 * salía de los datos. En un producto de cumplimiento eso es inaceptable —una
 * captura de ese gráfico puede acabar en un informe de auditoría— y no existe
 * ninguna serie histórica en el sistema con la que sustituirla honestamente.
 *
 * Se muestra por tanto la comparación que SÍ es real: el porcentaje actual de
 * cada norma frente a la meta, con eje, escala, leyenda y una tabla equivalente
 * para lectores de pantalla.
 */

export type StandardScore = {
  code: string;
  name: string;
  /** null cuando la norma aún no tiene evaluación GAP. */
  pct: number | null;
};

const TICKS = [0, 25, 50, 75, 100];

export default function ComplianceByStandard({
  standards,
  /** Umbral de referencia acordado con la organización. */
  target = 85,
}: {
  standards: StandardScore[];
  target?: number;
}) {
  const { tx } = useI18n();
  const titleId = useId();
  const evaluadas = standards.filter((s) => s.pct != null);

  if (evaluadas.length === 0) {
    return (
      <p className="nf-chart__empty">
        {tx("Todavía no hay evaluación GAP de ninguna norma. Complétala para ver el nivel de cumplimiento.")}
      </p>
    );
  }

  return (
    <figure className="nf-chart" role="group" aria-labelledby={titleId}>
      <figcaption id={titleId} className="nf-sr-only">
        {tx("Nivel de cumplimiento por norma, en porcentaje, frente a la meta.")}
      </figcaption>

      <div className="nf-chart__legend">
        <span className="nf-chart__legend-item">
          <span className="nf-chart__swatch" data-kind="value" aria-hidden />
          {tx("Cumplimiento actual")}
        </span>
        <span className="nf-chart__legend-item">
          <span className="nf-chart__swatch" data-kind="target" aria-hidden />
          {tx("Meta")} {target}%
        </span>
      </div>

      <div className="nf-chart__plot">
        {/* Escala del eje: sin ella un porcentaje no es interpretable. */}
        <div className="nf-chart__axis" aria-hidden>
          {TICKS.map((t) => (
            <span key={t} className="nf-chart__tick" style={{ left: `${t}%` }}>
              <span className="nf-chart__tick-label nf-tabular">{t}</span>
            </span>
          ))}
          <span className="nf-chart__target" style={{ left: `${target}%` }} />
        </div>

        <ul className="nf-chart__bars">
          {evaluadas.map((s) => {
            const pct = s.pct ?? 0;
            const cumple = pct >= target;
            return (
              <li key={s.code} className="nf-chart__row">
                <span className="nf-chart__row-label" title={s.name}>{s.code}</span>
                <span className="nf-chart__track">
                  <span
                    className="nf-chart__bar"
                    /* El estado no depende solo del color: va acompañado del
                       valor numérico y del símbolo en la etiqueta. */
                    data-meets={cumple || undefined}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="nf-chart__row-value nf-tabular">
                  {pct}% {cumple ? "✓" : "▲"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Alternativa tabular: un gráfico por sí solo no es accesible.
          La tabla va dentro del contenedor oculto, no con la clase encima: el
          layout intrínseco de <table> ignora `width: 1px` y desbordaba la
          página en móvil. */}
      <div className="nf-sr-only">
      <table>
        <caption>{tx("Cumplimiento por norma")}</caption>
        <thead>
          <tr>
            <th scope="col">{tx("Norma")}</th>
            <th scope="col">{tx("Cumplimiento")}</th>
            <th scope="col">{tx("Meta")}</th>
          </tr>
        </thead>
        <tbody>
          {evaluadas.map((s) => (
            <tr key={s.code}>
              <th scope="row">{s.name}</th>
              <td>{s.pct}%</td>
              <td>{target}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
