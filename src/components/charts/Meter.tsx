"use client";

import ChartCard from "./ChartCard";

/**
 * Una parte sobre un total.
 *
 * Sustituye a la barra apilada de dos tramos, que en organizaciones con pocos
 * datos degeneraba: con «Vencidas 0 · En plazo 1» pintaba un bloque macizo de
 * un solo color de lado a lado y una leyenda con un cero. Un bloque sólido no
 * es un reparto — no hay nada que comparar— y el color acababa asignado por la
 * posición en la paleta, no por lo que significaba.
 *
 * Aquí la lectura es explícita: la cifra, el total y el porcentaje escritos, y
 * la pista muestra cuánto falta para el total. Funciona igual con 1 de 1 que
 * con 340 de 1.200.
 */
export default function Meter({ title, subtitle, label, value, total, restLabel, tone = "neutral", empty = "Sin datos todavía.", action }: {
  title: string;
  subtitle?: string;
  /** Qué mide la parte destacada: «Significativos», «Vencidas», «SEU». */
  label: string;
  value: number;
  total: number;
  /** Nombre del resto, para el equivalente textual. */
  restLabel?: string;
  /**
   * `alert` solo cuando la parte medida ES el problema (vencidas, sin evaluar,
   * fuera de límite). No es decorativo: tiñe la cifra que el usuario debe
   * mirar primero.
   */
  tone?: "neutral" | "alert";
  empty?: string;
  action?: { label: string; href: string };
}) {
  const safeTotal = Math.max(total, 0);
  const safeValue = Math.min(Math.max(value, 0), safeTotal);
  const pct = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
  const rest = safeTotal - safeValue;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={safeTotal > 0 ? undefined : empty}
      action={action}
      table={
        <table>
          <caption>{title}</caption>
          <tbody>
            <tr><th scope="row">{label}</th><td>{safeValue}</td></tr>
            {restLabel && <tr><th scope="row">{restLabel}</th><td>{rest}</td></tr>}
            <tr><th scope="row">Total</th><td>{safeTotal}</td></tr>
          </tbody>
        </table>
      }
    >
      <div className="nf-meter">
        <p className="nf-meter__readout">
          <span className="nf-meter__value" data-tone={tone === "alert" && safeValue > 0 ? "alert" : undefined}>{safeValue}</span>
          <span className="nf-meter__of">de {safeTotal}</span>
          <span className="nf-meter__label">{label}</span>
          <span className="nf-meter__pct">{pct}%</span>
        </p>
        <div
          className="nf-meter__track"
          role="meter"
          aria-valuenow={safeValue}
          aria-valuemin={0}
          aria-valuemax={safeTotal}
          aria-label={`${label}: ${safeValue} de ${safeTotal}`}
        >
          <div
            className="nf-meter__fill"
            data-tone={tone === "alert" && safeValue > 0 ? "alert" : undefined}
            style={{ width: `${Math.max(pct, safeValue > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>
    </ChartCard>
  );
}
