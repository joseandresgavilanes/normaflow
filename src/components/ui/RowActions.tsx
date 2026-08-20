"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/context/I18nProvider";

/**
 * Acciones de fila.
 *
 * Antes cada listado se las inventaba: `nf-app-btn-ghost` con `style` en línea
 * en unos, `nf-app-btn-outline` con el rojo a fuego en otros, alturas de 28, 30
 * y 34 px, y ningún icono propio. Los iconos los ponía `AppActionIcons`
 * adivinándolos por expresión regular sobre el TEXTO del botón, con el
 * resultado esperable: «Desactivar» contiene «activar», así que la acción de
 * dar de baja un registro se anunciaba con un triángulo de reproducir.
 *
 * Aquí el icono se declara. Es un dato de la acción, no una deducción sobre su
 * nombre, y además sobrevive a la traducción: el adivinador solo reconoce
 * verbos en español e inglés, así que en portugués la mitad de la interfaz se
 * quedaba sin icono.
 *
 * El tono destructivo NO se pinta de rojo en reposo. Una fila con un botón
 * rojo por cada registro convierte el listado en una alarma y el rojo deja de
 * significar nada; se colorea al apuntarlo, que es cuando importa.
 */

export type RowActionTone = "neutral" | "primary" | "danger" | "success";

export function RowAction({
  icon: Icon,
  label,
  tone = "neutral",
  onClick,
  disabled,
  /** Solo icono: para tablas muy anchas. El nombre sigue en `aria-label`. */
  compact = false,
  title,
}: {
  icon: LucideIcon;
  label: string;
  tone?: RowActionTone;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
}) {
  const { tx } = useI18n();
  const texto = tx(label);
  return (
    <button
      type="button"
      className="nf-row-action"
      data-tone={tone}
      data-compact={compact || undefined}
      /* El adivinador de iconos no debe tocar este botón: ya trae el suyo, y
         el que él deduciría del texto sería otro. */
      data-nf-no-action-icon
      disabled={disabled}
      aria-label={compact ? texto : undefined}
      title={title ? tx(title) : compact ? texto : undefined}
      onClick={(event) => {
        // La fila entera suele ser pulsable y abre el detalle: sin esto, pulsar
        // «Eliminar» abriría además el panel del registro que se acaba de
        // borrar.
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {!compact && <span className="nf-row-action__label">{texto}</span>}
    </button>
  );
}

/** Contenedor: las acciones van juntas, a la derecha y sin partirse. */
export function RowActionGroup({ children }: { children: ReactNode }) {
  return <div className="nf-row-actions">{children}</div>;
}
