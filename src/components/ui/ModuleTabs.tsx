"use client";

import { useRef } from "react";
import { useI18n } from "@/context/I18nProvider";

/**
 * Pestañas de sección dentro de un módulo normativo.
 *
 * Hasta ahora la única vía para cambiar de sección era el sidebar global: los
 * 11 módulos leían `?section=` con `useModuleSection` pero no renderizaban
 * ningún control propio. Eso metía la sub-navegación de un módulo en la
 * columna de navegación del producto, donde llegaban a convivir ~143 enlaces.
 *
 * Teclado según el patrón WAI-ARIA de tablist: flechas para moverse, Home y
 * End a los extremos, y un solo punto de tabulación (roving tabindex) para que
 * el usuario no tenga que recorrer 15 pestañas para salir.
 */

export type ModuleSectionMeta = Record<string, { title: string; sub?: string }>;

export default function ModuleTabs<T extends string>({
  meta,
  value,
  onChange,
  label = "Secciones del módulo",
}: {
  meta: ModuleSectionMeta;
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  const { tx } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const keys = Object.keys(meta) as T[];
  if (keys.length < 2) return null;

  function focusTab(index: number) {
    const clamped = (index + keys.length) % keys.length;
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[clamped];
    el?.focus();
    onChange(keys[clamped]);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const current = keys.indexOf(value);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusTab(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusTab(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(keys.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={listRef}
      className="nf-module-tabs"
      role="tablist"
      aria-label={tx(label)}
      onKeyDown={onKeyDown}
    >
      {keys.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`nf-tab-${key}`}
            aria-selected={active}
            aria-controls={`nf-panel-${key}`}
            /* Roving tabindex: solo la pestaña activa entra en el orden de
               tabulación; el resto se alcanza con las flechas. */
            tabIndex={active ? 0 : -1}
            className="nf-module-tabs__tab"
            data-active={active || undefined}
            onClick={() => onChange(key)}
          >
            {/* `SECTION_META.panel.title` es el nombre del MÓDULO ("Gestión de
                la Energía"), porque hace doble uso como título de página. Como
                etiqueta de pestaña no funciona: la primera pestaña se llama
                igual que la pantalla entera. */}
            {key === "panel" ? tx("Panel") : tx(meta[key].title)}
          </button>
        );
      })}
    </div>
  );
}
