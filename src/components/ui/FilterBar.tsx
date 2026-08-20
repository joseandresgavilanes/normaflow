"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/context/I18nProvider";
import Picker from "@/components/ui/Picker";

/**
 * Barra de filtros horizontal.
 *
 * Los listados apilaban búsqueda y selects a ancho completo, uno por fila:
 * unos 200px de alto antes del primer dato, y en móvil casi una pantalla
 * entera. Aquí van en línea y desbordan con scroll en vez de crecer hacia
 * abajo.
 */
export default function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Buscar…",
  searchLabel = "Buscar en la lista",
  children,
  chips,
  onClear,
  activeCount = 0,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Selects y controles de filtro. */
  children?: ReactNode;
  /** Chips de estado (`FilterChip`). */
  chips?: ReactNode;
  onClear?: () => void;
  activeCount?: number;
}) {
  const { tx } = useI18n();

  return (
    <div className="nf-filterbar">
      <div className="nf-filterbar__row">
        {onSearch && (
          <div className="nf-filterbar__search">
            <Search size={15} strokeWidth={2} aria-hidden />
            <input
              type="search"
              data-nf-clear="propio"
              value={search ?? ""}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={tx(searchPlaceholder)}
              aria-label={tx(searchLabel)}
            />
            {/* Aspa propia, y por eso el campo desactiva la nativa: esta existe
                también en Firefox, que no trae ninguna. */}
            {search && (
              <button
                type="button"
                data-nf-no-action-icon
                className="nf-filterbar__search-clear"
                aria-label={tx("Borrar búsqueda")}
                onClick={() => onSearch("")}
              >
                <X size={13} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
        )}
        {children}
        {onClear && activeCount > 0 && (
          <button type="button" className="nf-filterbar__clear" onClick={onClear}>
            <X size={13} strokeWidth={2.2} aria-hidden />
            {tx("Quitar filtros")} ({activeCount})
          </button>
        )}
      </div>
      {chips && <div className="nf-filterbar__chips">{chips}</div>}
    </div>
  );
}

/**
 * Chip de filtro. Es un botón con `aria-pressed`: el estado no se comunica
 * solo con color.
 */
export function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  const { tx } = useI18n();
  return (
    <button
      type="button"
      className="nf-chip-filter"
      data-active={active || undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      {tx(label)}
      {count != null && <span className="nf-chip-filter__count nf-tabular">{count}</span>}
    </button>
  );
}

/** Select de filtro con etiqueta visible: nunca etiqueta solo por placeholder. */
export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const { tx } = useI18n();
  return (
    <label className="nf-filterbar__select">
      <span className="nf-filterbar__select-label">{tx(label)}</span>
      <Picker aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Picker>
    </label>
  );
}
