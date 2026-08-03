"use client";

import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import { WorkflowStepper } from "@/components/ui/WorkflowStepper";
import type { WorkflowDefinition } from "@/lib/workflows";

/**
 * Patrón único de detalle de entidad.
 *
 * Hoy el detalle vive en 154 modales repartidos por 35 ficheros, cada uno con
 * su propia composición: `AuditsModule` a 560 px con una tabla de metadatos,
 * `RisksModule` a 700 con bloques de puntuación, `DocumentsLiveClient` a 820
 * con versiones y aprobaciones, `ContinuityLiveClient` a 1040 —una página
 * entera metida en una capa—. Ninguno coincide en dónde está el estado, ni en
 * cómo se llega al historial.
 *
 * Aquí el orden es siempre el mismo: identidad → estado en el flujo →
 * metadatos → pestañas → historial. Es el orden en el que se pregunta:
 * "¿qué es esto?", "¿por dónde va?", "¿qué dice?", "¿qué le ha pasado?".
 *
 * Sirve dentro de un modal y dentro de una ruta propia sin cambios: no
 * declara `<h1>` —lo pone la página— sino `<h2>`, para no duplicar el nivel
 * cuando vive bajo un `PageHeader`.
 */

export type DetailTab = {
  id: string;
  label: string;
  /** Contador que se pinta junto a la etiqueta (hallazgos, versiones…). */
  count?: number;
  content: ReactNode;
};

export function EntityDetail({
  code,
  title,
  subtitle,
  workflow,
  status,
  meta,
  actions,
  tabs,
  children,
  headingLevel = 2,
  className,
}: {
  /** Código legible de la entidad: NC-2026-014, DOC-003. */
  code?: string;
  /**
   * Opcional a propósito: dentro de un modal el título ya lo pone la capa, y
   * repetirlo aquí daría dos encabezados para la misma entidad.
   */
  title?: string;
  subtitle?: string;
  /** Clave del registro de flujos o definición completa. */
  workflow?: string | WorkflowDefinition;
  /** Valor actual del enum. */
  status?: string;
  /** Pares etiqueta/valor de cabecera. */
  meta?: { label: string; value: ReactNode }[];
  /** Transiciones y acciones del flujo. */
  actions?: ReactNode;
  tabs?: DetailTab[];
  /** Contenido sin pestañas. */
  children?: ReactNode;
  /** 1 en una ruta propia, 2 dentro de un modal bajo un título. */
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const { tx } = useI18n();
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <article className={cn("nf-detail", className)}>
      {(code || title || actions) && (
        <header className="nf-detail__head">
          <div className="nf-detail__identity">
            {code && <span className="nf-detail__code nf-tabular">{code}</span>}
            {title && <Heading className="nf-detail__title">{tx(title)}</Heading>}
            {subtitle && <p className="nf-detail__subtitle">{tx(subtitle)}</p>}
          </div>
          {actions && <div className="nf-detail__actions">{actions}</div>}
        </header>
      )}

      {workflow && status && (
        <WorkflowStepper workflow={workflow} current={status} className="nf-detail__workflow" />
      )}

      {meta && meta.length > 0 && (
        <dl className="nf-detail__meta">
          {meta.map((item) => (
            <div className="nf-detail__meta-item" key={item.label}>
              <dt>{tx(item.label)}</dt>
              <dd>{item.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {tabs && tabs.length > 0 ? <DetailTabs tabs={tabs} /> : children}
    </article>
  );
}

/**
 * Pestañas con el patrón ARIA completo.
 *
 * Las flechas mueven entre pestañas y solo la activa está en el orden de
 * tabulación: con `tabIndex=0` en todas, tabular por un detalle de siete
 * pestañas obliga a pasar por las siete antes de llegar al contenido.
 */
function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const { tx } = useI18n();
  const uid = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const salto = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (!delta && salto === null) return;
    event.preventDefault();
    const siguiente = salto ?? (index + delta + tabs.length) % tabs.length;
    setActive(tabs[siguiente].id);
    document.getElementById(`${uid}-tab-${tabs[siguiente].id}`)?.focus();
  }

  return (
    <div className="nf-detail__tabs">
      <div role="tablist" className="nf-detail__tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const seleccionada = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${tab.id}`}
              aria-selected={seleccionada}
              aria-controls={`${uid}-panel-${tab.id}`}
              tabIndex={seleccionada ? 0 : -1}
              className="nf-detail__tab"
              onClick={() => setActive(tab.id)}
            >
              {tx(tab.label)}
              {typeof tab.count === "number" && (
                <span className="nf-detail__tab-count nf-tabular">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${uid}-panel-${tab.id}`}
          aria-labelledby={`${uid}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="nf-detail__panel"
        >
          {tab.id === active && tab.content}
        </div>
      ))}
    </div>
  );
}
