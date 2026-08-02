"use client";

import { useMemo } from "react";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Adaptador de compatibilidad.
 *
 * Conserva la firma que ya usan los 8 módulos que importan este componente y
 * delega en `DataTable`, de modo que todos ganan scroll contenido, cabecera
 * fija, ordenación accesible, densidad, columnas configurables y colapso a
 * tarjetas en móvil sin tocar sus llamadas.
 *
 * El código nuevo debe importar `DataTable` directamente: da acceso a
 * selección, acciones masivas, paginación y estados vacíos con contexto.
 */

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (val: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRow?: (row: T) => void;
  emptyText?: string;
  /** Descripción de la tabla para lectores de pantalla. */
  caption?: string;
  storageKey?: string;
}

export default function Table<T extends Record<string, any>>({
  columns,
  rows,
  onRow,
  emptyText = "Sin registros",
  caption = "Listado",
  storageKey,
}: TableProps<T>) {
  const mapped = useMemo<DataTableColumn<T>[]>(
    () =>
      columns.map((column, index) => {
        const key = column.key as string;
        const raw = (row: T) => row[key];
        return {
          id: key || `col-${index}`,
          header: column.label,
          cell: (row) => (column.render ? column.render(raw(row), row) : raw(row)),
          // Se ordena por el valor crudo: el nodo ya renderizado no es comparable.
          sortValue: (row) => {
            const value = raw(row);
            if (value == null) return null;
            return typeof value === "number" ? value : String(value);
          },
          primary: index === 0,
        } satisfies DataTableColumn<T>;
      }),
    [columns],
  );

  return (
    <DataTable
      columns={mapped}
      rows={rows}
      rowKey={(row) => (row.id != null ? String(row.id) : JSON.stringify(row).slice(0, 64))}
      rowAction={onRow}
      caption={caption}
      storageKey={storageKey}
      empty={<EmptyState kind="empty" title={emptyText} compact />}
    />
  );
}
