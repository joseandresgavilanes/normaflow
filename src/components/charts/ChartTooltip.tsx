"use client";

import { useCallback, useState, type ReactNode } from "react";

type Anchor = { x: number; y: number; content: ReactNode } | null;

/**
 * Capa de sobrevuelo compartida por los gráficos.
 *
 * El tooltip se posiciona respecto al contenedor del gráfico, no al puntero
 * global: así no se descoloca cuando la página tiene scroll ni cuando el
 * gráfico vive dentro de una tarjeta desplazable.
 */
export function useChartTooltip() {
  const [anchor, setAnchor] = useState<Anchor>(null);

  const show = useCallback((event: { currentTarget: Element; clientX: number; clientY: number }, content: ReactNode) => {
    const host = event.currentTarget.closest<HTMLElement>("[data-nf-chart-host]");
    if (!host) return;
    const box = host.getBoundingClientRect();
    setAnchor({ x: event.clientX - box.left, y: event.clientY - box.top, content });
  }, []);

  const hide = useCallback(() => setAnchor(null), []);

  const tooltip = anchor ? (
    <div
      className="nf-chart-tooltip"
      role="presentation"
      style={{ left: anchor.x, top: anchor.y }}
    >
      {anchor.content}
    </div>
  ) : null;

  return { show, hide, tooltip };
}

/** Contenido estándar del tooltip: nombre arriba, cifra debajo. */
export function TooltipRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <>
      <span className="nf-chart-tooltip__label">{label}</span>
      <span className="nf-chart-tooltip__value">{value}</span>
      {note && <span className="nf-chart-tooltip__note">{note}</span>}
    </>
  );
}
