"use client";

import type { ReactNode } from "react";
import InfoTip from "@/components/ui/InfoTip";

/**
 * Marco común de todos los gráficos.
 *
 * Es un `<figure>` con `<figcaption>`: el título del gráfico no es un
 * encabezado de sección —no debe entrar en el índice del documento— pero sí
 * tiene que estar asociado a la imagen que describe.
 *
 * El bloque de datos que acompaña a cada gráfico (`table`) no es decorativo:
 * la paleta clara tiene tres series por debajo de 3:1 sobre blanco, y la
 * regla que las admite exige que el valor esté además escrito. Aquí se
 * cumple dos veces: etiqueta directa sobre la marca y tabla equivalente.
 */
export default function ChartCard({ title, subtitle, legend, table, empty, action, children }: {
  title: string;
  subtitle?: string;
  /** Leyenda; obligatoria a partir de dos series. */
  legend?: ReactNode;
  /** Equivalente textual del gráfico, oculto salvo para lectores de pantalla. */
  table?: ReactNode;
  /** Mensaje cuando no hay datos. Sustituye al gráfico, no lo acompaña. */
  empty?: string;
  /**
   * Salida del estado vacío. Una tarjeta vacía sin nada que hacer es un
   * callejón: en una organización recién creada la mitad del panel son
   * gráficos sin datos, y sin este enlace el usuario no sabe qué falta.
   */
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <figure className="nf-chart-card" data-empty={empty ? true : undefined}>
      <figcaption className="nf-chart-card__head nf-heading-row">
        <span className="nf-chart-card__title">{title}</span>
        {/* Qué mide el gráfico es ayuda, no dato: el eje y la leyenda ya lo
            dicen a quien mira. Pedirla no cuesta un clic más que leerla. */}
        {subtitle && <InfoTip text={subtitle} label={title} />}
      </figcaption>
      {empty ? (
        <div className="nf-chart-card__empty">
          <p>{empty}</p>
          {action && <a className="nf-chart-card__empty-action" href={action.href}>{action.label}</a>}
        </div>
      ) : (
        <>
          {legend && <div className="nf-chart-legend">{legend}</div>}
          <div className="nf-chart-card__plot">{children}</div>
          {table && <div className="nf-sr-only">{table}</div>}
        </>
      )}
    </figure>
  );
}

/** Entrada de leyenda: muestra de color + nombre. El texto nunca va del color de la serie. */
export function LegendItem({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="nf-chart-legend__item">
      <span className="nf-chart-legend__swatch" style={{ background: color }} aria-hidden="true" />
      {label}
      {value !== undefined && <span className="nf-chart-legend__value">{value}</span>}
    </span>
  );
}

/** Las ocho ranuras categóricas del sistema, en orden fijo: nunca se ciclan. */
export const SERIES = [
  "var(--nf-series-1)", "var(--nf-series-2)", "var(--nf-series-3)", "var(--nf-series-4)",
  "var(--nf-series-5)", "var(--nf-series-6)", "var(--nf-series-7)", "var(--nf-series-8)",
] as const;

/** Colores de estado. Reservados: no se reparten como si fueran una serie más. */
export const STATUS = {
  good: "var(--nf-success)",
  warning: "var(--nf-warning)",
  serious: "var(--nf-c-warning-700)",
  critical: "var(--nf-danger)",
  neutral: "var(--nf-text-subtle)",
} as const;
