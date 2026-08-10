"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Rows3 } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import EmptyState from "@/components/ui/EmptyState";

/**
 * DataTable empresarial.
 *
 * Sustituye a `ui/Table.tsx`, que no tenía ordenación, selección, densidad,
 * columnas configurables ni paginación, recortaba las columnas de la derecha
 * sin scroll ni aviso, y hacía la fila clicable con `onClick` en el `<tr>` —
 * inalcanzable por teclado.
 *
 * Reglas que aplica:
 *  · El desbordamiento se resuelve DENTRO del contenedor; la página nunca
 *    desplaza horizontalmente.
 *  · La navegación a la fila es un enlace real en la primera celda.
 *  · Las celdas de datos llevan `data-i18n="off"`: el puente de i18n recorre el
 *    DOM y traduciría el contenido del cliente.
 *  · Por debajo de 768px la tabla se convierte en tarjetas.
 */

export type Density = "compact" | "default" | "comfortable";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Celda. Devuelve texto plano salvo que se necesite formato. */
  cell: (row: T) => ReactNode;
  /** Valor para ordenar. Si falta, la columna no es ordenable. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Alineación: `end` para importes y contadores. */
  align?: "start" | "end";
  /** Ancho mínimo; evita que un código como SGSI-MAN-002 se parta en 3 líneas. */
  minWidth?: number;
  /** Cifras tabulares para que la columna no baile al ordenar. */
  numeric?: boolean;
  /** Se puede ocultar desde el selector de columnas. */
  hideable?: boolean;
  /** Oculta por defecto. */
  defaultHidden?: boolean;
  /** En móvil, esta columna es el título de la tarjeta. */
  primary?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Enlace de detalle de la fila. Se aplica a la celda primaria. */
  rowHref?: (row: T) => string;
  /**
   * Alternativa a `rowHref` cuando la fila abre un panel en vez de navegar.
   * Se renderiza como `<button>` en la primera celda: nunca `onClick` sobre el
   * `<tr>`, que no es alcanzable por teclado.
   */
  rowAction?: (row: T) => void;
  caption: string;
  loading?: boolean;
  /** Estado vacío. Si se omite, se usa uno genérico. */
  empty?: ReactNode;
  /** Hay filas pero el filtro no devuelve nada. */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Selección múltiple + acciones masivas. */
  selectable?: boolean;
  bulkActions?: (selected: T[]) => ReactNode;
  /** Filas por página. 0 desactiva la paginación. */
  pageSize?: number;
  /** Barra de filtros que se integra en la cabecera de la tabla. */
  toolbar?: ReactNode;
  density?: Density;
  storageKey?: string;
};

const DENSITY_ORDER: Density[] = ["compact", "default", "comfortable"];

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  rowAction,
  caption,
  loading = false,
  empty,
  filtered = false,
  onClearFilters,
  selectable = false,
  bulkActions,
  pageSize = 25,
  toolbar,
  density: densityProp,
  storageKey,
}: DataTableProps<T>) {
  const { t, tx } = useI18n();
  const tableId = useId();

  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [density, setDensity] = useState<Density>(densityProp ?? "default");
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Preferencias de vista por usuario y por tabla.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`nf.table.${storageKey}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { density?: Density; hidden?: string[] };
      if (saved.density) setDensity(saved.density);
      if (saved.hidden) setHidden(new Set(saved.hidden));
    } catch {
      /* preferencia no crítica */
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: { density?: Density; hidden?: Set<string> }) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          `nf.table.${storageKey}`,
          JSON.stringify({
            density: next.density ?? density,
            hidden: [...(next.hidden ?? hidden)],
          }),
        );
      } catch {
        /* preferencia no crítica */
      }
    },
    [density, hidden, storageKey],
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.has(column.id)),
    [columns, hidden],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // los vacíos siempre al final
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * factor;
    });
  }, [columns, rows, sort]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = pageSize > 0
    ? sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sortedRows;

  useEffect(() => { setPage(0); }, [rows.length, sort]);

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.id !== column.id
        ? { id: column.id, dir: "asc" }
        : current.dir === "asc"
          ? { id: column.id, dir: "desc" }
          : null,
    );
  };

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  if (loading) {
    return (
      <div className="nf-dt">
        {toolbar && <div className="nf-dt__toolbar">{toolbar}</div>}
        <div className="nf-dt__skeleton" role="status" aria-live="polite" aria-busy="true">
          <span className="nf-sr-only">{t("common.loading")}</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="nf-dt__skeleton-row" aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = rows.length === 0;

  return (
    <div className="nf-dt" data-density={density}>
      <div className="nf-dt__toolbar">
        <div className="nf-dt__toolbar-main">{toolbar}</div>
        <div className="nf-dt__toolbar-tools">
          {selectable && selectedRows.length > 0 && (
            <div className="nf-dt__bulk" role="group" aria-label={tx("Acciones sobre la selección")}>
              <span className="nf-dt__bulk-count">
                {tx("{n} seleccionados").replace("{n}", String(selectedRows.length))}
              </span>
              {bulkActions?.(selectedRows)}
            </div>
          )}

          <button
            type="button"
            className="nf-dt__tool"
            onClick={() => {
              const next = DENSITY_ORDER[(DENSITY_ORDER.indexOf(density) + 1) % DENSITY_ORDER.length];
              setDensity(next);
              persist({ density: next });
            }}
            aria-label={tx("Cambiar densidad de la tabla")}
            title={tx("Densidad")}
          >
            <Rows3 size={15} strokeWidth={1.9} aria-hidden />
          </button>

          <div className="nf-dt__columns">
            <button
              type="button"
              className="nf-dt__tool"
              aria-expanded={columnsOpen}
              aria-controls={`${tableId}-cols`}
              onClick={() => setColumnsOpen((v) => !v)}
              aria-label={tx("Configurar columnas")}
              title={tx("Columnas")}
            >
              <Columns3 size={15} strokeWidth={1.9} aria-hidden />
            </button>
            {columnsOpen && (
              <div id={`${tableId}-cols`} className="nf-dt__columns-menu" role="group" aria-label={tx("Columnas")}>
                {columns.filter((c) => c.hideable !== false).map((column) => (
                  <label key={column.id} className="nf-dt__columns-item">
                    <input
                      type="checkbox"
                      checked={!hidden.has(column.id)}
                      onChange={() => {
                        setHidden((current) => {
                          const next = new Set(current);
                          if (next.has(column.id)) next.delete(column.id);
                          else next.add(column.id);
                          persist({ hidden: next });
                          return next;
                        });
                      }}
                    />
                    {tx(column.header)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="nf-dt__empty">
          {empty ?? (
            filtered ? (
              <EmptyState
                kind="no-results"
                title="Ningún resultado coincide con los filtros"
                description="Prueba a ampliar el rango o a quitar alguno de los filtros aplicados."
                action={
                  onClearFilters ? (
                    <button type="button" className="nf-app-btn-outline nf-app-btn-sm" onClick={onClearFilters}>
                      {tx("Quitar filtros")}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState kind="empty" title="Todavía no hay registros" />
            )
          )}
        </div>
      ) : (
        <>
          {/* El scroll vive aquí dentro: la página nunca se desplaza en horizontal. */}
          <div className="nf-dt__scroll" tabIndex={0} role="region" aria-label={tx(caption)}>
            <table className="nf-dt__table">
              <caption className="nf-sr-only">{tx(caption)}</caption>
              <thead>
                <tr>
                  {selectable && (
                    <th scope="col" className="nf-dt__th nf-dt__th--select">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        aria-label={tx("Seleccionar todas las filas de la página")}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            for (const row of pageRows) {
                              if (event.target.checked) next.add(rowKey(row));
                              else next.delete(rowKey(row));
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.map((column) => {
                    const active = sort?.id === column.id;
                    const sortable = Boolean(column.sortValue);
                    return (
                      <th
                        key={column.id}
                        scope="col"
                        className="nf-dt__th"
                        data-align={column.align}
                        style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                        aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                      >
                        {sortable ? (
                          <button type="button" className="nf-dt__sort" onClick={() => toggleSort(column)}>
                            {tx(column.header)}
                            {active
                              ? (sort!.dir === "asc"
                                  ? <ArrowUp size={13} strokeWidth={2.2} aria-hidden />
                                  : <ArrowDown size={13} strokeWidth={2.2} aria-hidden />)
                              : <ChevronsUpDown size={13} strokeWidth={1.7} aria-hidden className="nf-dt__sort-idle" />}
                          </button>
                        ) : (
                          tx(column.header)
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const key = rowKey(row);
                  const href = rowHref?.(row);
                  return (
                    <tr key={key} data-selected={selected.has(key) || undefined}>
                      {selectable && (
                        <td className="nf-dt__td nf-dt__td--select">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            aria-label={tx("Seleccionar fila")}
                            onChange={(event) => {
                              setSelected((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(key);
                                else next.delete(key);
                                return next;
                              });
                            }}
                          />
                        </td>
                      )}
                      {visibleColumns.map((column, index) => (
                        <td
                          key={column.id}
                          className="nf-dt__td"
                          data-align={column.align}
                          data-numeric={column.numeric || undefined}
                          /* Contenido del cliente: fuera del puente de i18n. */
                          data-i18n="off"
                        >
                          {index === 0 && href ? (
                            // Enlace real: la fila es alcanzable por teclado.
                            <Link href={href} className="nf-dt__row-link">
                              {column.cell(row)}
                            </Link>
                          ) : index === 0 && rowAction ? (
                            <button type="button" className="nf-dt__row-link" onClick={() => rowAction(row)}>
                              {column.cell(row)}
                            </button>
                          ) : (
                            column.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil: la tabla se convierte en tarjetas resumidas. */}
          <ul className="nf-dt__cards" data-i18n="off">
            {pageRows.map((row) => {
              const key = rowKey(row);
              const href = rowHref?.(row);
              const primary = visibleColumns.find((c) => c.primary) ?? visibleColumns[0];
              const rest = visibleColumns.filter((c) => c.id !== primary.id).slice(0, 5);
              return (
                <li key={key} className="nf-dt__card">
                  <div className="nf-dt__card-title">
                    {href ? (
                      <Link href={href}>{primary.cell(row)}</Link>
                    ) : rowAction ? (
                      <button type="button" onClick={() => rowAction(row)}>{primary.cell(row)}</button>
                    ) : (
                      primary.cell(row)
                    )}
                  </div>
                  <dl className="nf-dt__card-fields">
                    {rest.map((column) => (
                      <div key={column.id} className="nf-dt__card-field">
                        <dt>{tx(column.header)}</dt>
                        <dd data-numeric={column.numeric || undefined}>{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>

          {pageSize > 0 && totalPages > 1 && (
            <nav className="nf-dt__pagination" aria-label={tx("Paginación")}>
              <span className="nf-dt__pagination-info nf-tabular">
                {tx("{from}–{to} de {total}")
                  .replace("{from}", String(safePage * pageSize + 1))
                  .replace("{to}", String(Math.min((safePage + 1) * pageSize, sortedRows.length)))
                  .replace("{total}", String(sortedRows.length))}
              </span>
              <div className="nf-dt__pagination-controls">
                <button
                  type="button"
                  className="nf-app-btn-outline nf-app-btn-sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {tx("Anterior")}
                </button>
                <button
                  type="button"
                  className="nf-app-btn-outline nf-app-btn-sm"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  {tx("Siguiente")}
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
