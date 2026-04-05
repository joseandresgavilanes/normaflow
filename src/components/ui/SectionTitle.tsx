interface SectionTitleProps { title: string; sub?: string; action?: string; onAction?: () => void; }
export default function SectionTitle({ title, sub, action, onAction }: SectionTitleProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#142033", margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 14, color: "#5E6B7A", margin: "4px 0 0" }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ fontSize: 13, color: "#123C66", background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>
          {action}
        </button>
      )}
    </div>
  );
}
