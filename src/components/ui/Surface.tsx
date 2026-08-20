"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import InfoTip from "@/components/ui/InfoTip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nProvider";

/**
 * Superficies: Card, SectionHeader y MetricCard.
 *
 * Consolidan 55 variantes de tarjeta (`nf-card`, `nf-dash-card`,
 * `nf-iso-dashboard-card`, `nf-kpi-card`, `nf-audit-card`, `nf-operational-card`,
 * `nf-panel`…) y cuatro componentes de métrica distintos (`StatCard`,
 * `MetricCell`, `IsoMetricCard`, `nf-kpi-card`).
 */

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export type CardPadding = "none" | "sm" | "md" | "lg";

export function Card({
  children,
  /** Cabecera opcional: título, subtítulo y acción alineada a la derecha. */
  title,
  /** Se pide con el icono de ayuda del encabezado; no ocupa una línea fija. */
  subtitle,
  action,
  footer,
  padding = "md",
  /** Marca la tarjeta como agrupación semántica con su propio encabezado. */
  as: Tag = "div",
  /** Nivel del encabezado. Debe encajar en la jerarquía de la página. */
  headingLevel = 2,
  className,
  id,
}: {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  padding?: CardPadding;
  as?: "div" | "section" | "article";
  headingLevel?: 2 | 3 | 4;
  className?: string;
  id?: string;
}) {
  const { tx } = useI18n();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const label = typeof title === "string" ? tx(title) : title;

  return (
    <Tag id={id} className={cn("nf-card2", `nf-card2--pad-${padding}`, className)}>
      {(title || action) && (
        <div className="nf-card2__head">
          <div className="nf-card2__head-text nf-heading-row">
            {title && <Heading className="nf-card2__title">{label}</Heading>}
            {/* El texto va sin traducir: `InfoTip` lo pasa por `tx` una sola
                vez. Un subtítulo enriquecido (nodo) no cabe en un globo y se
                queda a la vista. */}
            {subtitle && (typeof subtitle === "string"
              ? <InfoTip text={subtitle} label={typeof title === "string" ? title : undefined} />
              : <span className="nf-card2__subtitle">{subtitle}</span>)}
          </div>
          {action && <div className="nf-card2__head-action">{action}</div>}
        </div>
      )}
      <div className="nf-card2__body">{children}</div>
      {footer && <div className="nf-card2__foot">{footer}</div>}
    </Tag>
  );
}

/**
 * Encabezado de sección dentro de una página. Sustituye a `SectionTitle`,
 * `PanelHeader` e `IsoSectionHeader`, que hacían lo mismo con tres marcados.
 */
export function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
  headingLevel = 2,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const { tx } = useI18n();
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <header className="nf-section-head">
      {Icon && (
        <span className="nf-section-head__icon" aria-hidden>
          <Icon size={16} strokeWidth={1.9} />
        </span>
      )}
      <div className="nf-section-head__text nf-heading-row">
        <Heading className="nf-section-head__title">{tx(title)}</Heading>
        {/* La descripción va tras el icono de ayuda. No es el tooltip de CSS
            que se quitó en su día —aquel solo respondía al ratón y lo recortaba
            el primer contenedor con overflow—: `InfoTip` es un botón real,
            alcanzable con teclado y toque, y su texto está siempre enlazado con
            `aria-describedby` aunque el globo esté cerrado. */}
        {description && <InfoTip text={description} label={title} />}
      </div>
      {action && <div className="nf-section-head__action">{action}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* MetricCard                                                                  */
/* -------------------------------------------------------------------------- */

export type MetricTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export type MetricTrend = "up" | "down" | "flat";

const TREND_ICON: Record<MetricTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export function MetricCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  /**
   * Tono explícito. `IsoMetricCard` lo deducía con una batería de expresiones
   * regulares sobre el TEXTO de la etiqueta, así que al traducir la interfaz
   * cambiaban el icono y el color de la métrica.
   */
  tone = "neutral",
  trend,
  /** Qué significa "mejor" aquí: en NC abiertas, bajar es bueno. */
  trendIsGood,
  href,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  trend?: MetricTrend;
  trendIsGood?: boolean;
  href?: string;
}) {
  const { tx } = useI18n();
  const TrendIcon = trend ? TREND_ICON[trend] : null;

  const body = (
    <>
      {Icon && (
        <span className="nf-metric__icon" aria-hidden>
          <Icon size={18} strokeWidth={1.9} />
        </span>
      )}
      <span className="nf-metric__body">
        <span className="nf-metric__value nf-tabular">
          {value}
          {unit && <span className="nf-metric__unit">{unit}</span>}
          {TrendIcon && (
            <TrendIcon
              className="nf-metric__trend"
              data-good={trendIsGood === undefined ? undefined : trendIsGood}
              size={14}
              strokeWidth={2.2}
              aria-hidden
            />
          )}
        </span>
        <span className="nf-metric__label">{tx(label)}</span>
        {sub && <span className="nf-metric__sub">{tx(sub)}</span>}
      </span>
      {href && <ArrowRight className="nf-metric__go" size={15} strokeWidth={2} aria-hidden />}
    </>
  );

  if (href) {
    // Cada métrica debe poder llevar a su detalle.
    return (
      <Link href={href} className="nf-metric nf-metric--link" data-tone={tone}>
        {body}
      </Link>
    );
  }
  return (
    <div className="nf-metric" data-tone={tone}>
      {body}
    </div>
  );
}

/** Fila de métricas con reflujo automático. */
export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("nf-metric-row", className)}>{children}</div>;
}
