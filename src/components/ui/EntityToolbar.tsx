"use client";

import type { ReactNode } from "react";
import Picker from "@/components/ui/Picker";

/**
 * Barra de filtros de un listado.
 *
 * Copia el patrón que ya usaban Documentos y Registros: una fila de controles
 * planos —la caja de búsqueda y un desplegable por filtro— con la misma clase
 * `.nf-app-input` que el resto del producto.
 *
 * Antes esto usaba `FilterBar`, que envuelve cada filtro en una etiqueta con su
 * propio borde: al lado de un desplegable con borde parecían dos cajas pegadas,
 * y no se parecía a ninguna otra barra de la aplicación. Aquí el nombre del
 * campo va dentro de la propia opción vacía —«Todos los estados»—, que es como
 * están escritos los demás listados.
 */

/** «Todos los estados», no «Todos · estado». El género y el plural del español
 *  no se deducen de la etiqueta, así que van escritos. */
const TODOS: Record<string, string> = {
  estado: "Todos los estados",
  tipo: "Todos los tipos",
  norma: "Todas las normas",
  categoría: "Todas las categorías",
  responsable: "Todos los responsables",
  revisor: "Todos los revisores",
  severidad: "Todas las severidades",
  origen: "Todos los orígenes",
  prioridad: "Todas las prioridades",
  frecuencia: "Todas las frecuencias",
  canal: "Todos los canales",
  año: "Todos los años",
  módulo: "Todos los módulos",
  criticidad: "Todas las criticidades",
  tratamiento: "Todos los tratamientos",
  dirección: "Todas las direcciones",
  impacto: "Todos los impactos",
  fuente: "Todas las fuentes",
  cargo: "Todos los cargos",
  pertinencia: "Todas",
};

export function todosLabel(label: string) {
  return TODOS[label.toLowerCase()] ?? `Todos · ${label.toLowerCase()}`;
}

export default function EntityToolbar({
  search,
  onSearch,
  searchPlaceholder,
  searchLabel,
  filters,
  onClear,
  activeCount,
  count,
  extra,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  filters: ReactNode;
  onClear: () => void;
  activeCount: number;
  /** «12 de 40», como en Documentos. */
  count?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
      {onSearch && (
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          value={search ?? ""}
          onChange={(event) => onSearch(event.target.value)}
          className="nf-app-input"
          style={{ flex: 1, minWidth: 240 }}
        />
      )}
      {filters}
      {count != null && <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{count}</span>}
      {activeCount > 0 && (
        <button type="button" className="nf-app-btn-ghost" data-nf-no-action-icon onClick={onClear}>
          Limpiar filtros
        </button>
      )}
      {extra}
    </div>
  );
}

/** Un filtro: desplegable plano, sin etiqueta externa, como en Documentos. */
export function EntityFilterSelect({
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
  return (
    <Picker
      aria-label={`Filtrar por ${label.toLowerCase()}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: "auto", minWidth: 150 }}
    >
      {children}
    </Picker>
  );
}
