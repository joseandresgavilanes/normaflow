"use client";

import { useI18n } from "@/context/I18nProvider";

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
}
export default function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  onRow,
  emptyText = "Sin registros",
}: TableProps<T>) {
  const { tx } = useI18n();
  if (rows.length === 0)
    return (
      <div className="nf-data-table-wrap">
        <div className="nf-data-table-empty">{tx(emptyText)}</div>
      </div>
    );
  return (
    <div className="nf-data-table-wrap">
      <table className="nf-data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{tx(col.label)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.id != null ? String(row.id) : ri}
              onClick={() => onRow?.(row)}
              style={{
                cursor: onRow ? "pointer" : "default",
              }}
            >
              {columns.map((col, ci) => (
                <td key={ci}>
                  {col.render
                    ? col.render(row[col.key as string], row)
                    : row[col.key as string]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
