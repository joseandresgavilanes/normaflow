"use client";

import { useMemo, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn, type Density } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import EntityToolbar, { EntityFilterSelect, todosLabel } from "@/components/ui/EntityToolbar";
import { fold } from "@/components/ui/Picker";
import { statusLabel } from "@/lib/status-labels";

/**
 * Listado de entidades.
 *
 * Los módulos operativos pintaban sus listas como rejillas de tarjetas. Una
 * tarjeta está bien para un resumen suelto, pero no para trabajar: no se puede
 * ordenar, no se pueden comparar dos filas —cada dato está en un sitio distinto
 * de cada tarjeta—, ocupa cuatro veces más alto por elemento, y con cincuenta
 * registros no hay paginación ni filtros, solo scroll.
 *
 * Esto junta la barra de filtros y `DataTable` para que cada listado tenga lo
 * mismo sin repetirlo: búsqueda sin acentos, filtros deducidos de los propios
 * datos con su recuento, ordenación, densidad, columnas configurables,
 * paginación y una columna de acciones fija a la derecha.
 */

export type EntityFilter<T> = {
  id: string;
  label: string;
  /** Valor de la fila por el que se compara. `null` queda fuera del filtro. */
  value: (row: T) => string | null | undefined;
  /** Cómo se lee cada valor. Por defecto, la etiqueta de estado del producto. */
  format?: (value: string) => string;
  /** Opciones fijas. Si se omite, salen de las filas presentes con su recuento. */
  options?: { value: string; label: string }[];
  allLabel?: string;
};

export type EntityTableProps<T> = {
  caption: string;
  rows: readonly T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  /** Abre el detalle. Se aplica a la primera columna, nunca al `<tr>`. */
  rowAction?: (row: T) => void;
  rowHref?: (row: T) => string;
  /** Botones de fila. Se pintan en una última columna alineada a la derecha. */
  actions?: (row: T) => ReactNode;
  /** Texto sobre el que busca la caja de búsqueda. Sin él no hay búsqueda. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: EntityFilter<T>[];
  /** Controles extra a la derecha de los filtros (exportar, vistas…). */
  toolbarExtra?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  selectable?: boolean;
  bulkActions?: (selected: T[]) => ReactNode;
  pageSize?: number;
  density?: Density;
  storageKey?: string;
};

export default function EntityTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  rowAction,
  rowHref,
  actions,
  searchText,
  searchPlaceholder = "Buscar…",
  filters = [],
  toolbarExtra,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selectable,
  bulkActions,
  pageSize = 25,
  density,
  storageKey,
}: EntityTableProps<T>) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Record<string, string>>({});

  // Las opciones salen de los datos que hay, con su recuento: un filtro que
  // ofrece estados inexistentes hace perder el tiempo a quien lo usa.
  const opciones = useMemo(
    () =>
      filters.map((filter) => {
        if (filter.options) return { filter, items: filter.options };
        const cuenta = new Map<string, number>();
        rows.forEach((row) => {
          const value = filter.value(row);
          if (value) cuenta.set(value, (cuenta.get(value) ?? 0) + 1);
        });
        const format = filter.format ?? statusLabel;
        return {
          filter,
          items: [...cuenta.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, total]) => ({ value, label: `${format(value)} (${total})` })),
        };
      }),
    [filters, rows],
  );

  const activos = Object.values(selection).filter(Boolean).length + (query.trim() ? 1 : 0);

  const visibles = useMemo(() => {
    const needle = fold(query.trim());
    return rows.filter((row) => {
      for (const filter of filters) {
        const elegido = selection[filter.id];
        if (elegido && filter.value(row) !== elegido) return false;
      }
      if (!needle || !searchText) return true;
      return fold(searchText(row)).includes(needle);
    });
  }, [rows, filters, selection, query, searchText]);

  const limpiar = () => {
    setQuery("");
    setSelection({});
  };

  const columnas = useMemo<DataTableColumn<T>[]>(() => {
    if (!actions) return columns;
    return [
      ...columns,
      {
        id: "__acciones",
        header: "Acciones",
        align: "end",
        cell: (row) => <div className="nf-row-actions">{actions(row)}</div>,
      },
    ];
  }, [columns, actions]);

  return (
    // Misma estructura que Control de Documentos y Registros: la tarjeta de la
    // página contiene la fila de filtros, y la tabla va dentro en su propia
    // caja. Antes los filtros vivían en la barra interna de `DataTable`, que es
    // por lo que estos listados no se parecían a ninguno de los que ya había.
    <Card>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <EntityToolbar
          search={searchText ? query : undefined}
          onSearch={searchText ? setQuery : undefined}
          searchPlaceholder={searchPlaceholder}
          searchLabel={`Buscar en ${caption.toLowerCase()}`}
          onClear={limpiar}
          activeCount={activos}
          count={`${visibles.length} de ${rows.length}`}
          extra={toolbarExtra}
          filters={opciones.map(({ filter, items }) => (
            <EntityFilterSelect
              key={filter.id}
              label={filter.label}
              value={selection[filter.id] ?? ""}
              onChange={(value) => setSelection((previo) => ({ ...previo, [filter.id]: value }))}
            >
              <option value="">{filter.allLabel ?? todosLabel(filter.label)}</option>
              {items.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </EntityFilterSelect>
          ))}
        />
      </div>

      <DataTable
        columns={columnas}
        rows={visibles}
        rowKey={rowKey}
        rowAction={rowAction}
        rowHref={rowHref}
        caption={caption}
        selectable={selectable}
        bulkActions={bulkActions}
        pageSize={pageSize}
        density={density}
        storageKey={storageKey}
        filtered={activos > 0}
        onClearFilters={limpiar}
        empty={
          <EmptyState
            kind="empty"
            title={emptyTitle ?? "Todavía no hay nada aquí"}
            description={emptyDescription}
            action={emptyAction}
          />
        }
      />
    </Card>
  );
}
