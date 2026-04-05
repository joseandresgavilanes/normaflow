export interface Column<T> { key: keyof T | string; label: string; render?: (val: any, row: T) => React.ReactNode; }
interface TableProps<T> { columns: Column<T>[]; rows: T[]; onRow?: (row: T) => void; emptyText?: string; }
export default function DataTable<T extends Record<string, any>>({ columns, rows, onRow, emptyText = "Sin registros" }: TableProps<T>) {
  if (rows.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#5E6B7A", fontSize: 14 }}>{emptyText}</div>
  );
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #E5EAF2" }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#5E6B7A", fontSize: 12, whiteSpace: "nowrap" }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id != null ? String(row.id) : ri} onClick={() => onRow?.(row)}
              style={{ borderBottom: "1px solid #E5EAF2", cursor: onRow ? "pointer" : "default", transition: "background 0.1s" }}
              onMouseEnter={e => { if (onRow) (e.currentTarget as HTMLElement).style.background = "#F7F9FC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              {columns.map((col, ci) => (
                <td key={ci} style={{ padding: "12px 14px", verticalAlign: "middle", color: "#142033" }}>
                  {col.render ? col.render(row[col.key as string], row) : row[col.key as string]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
