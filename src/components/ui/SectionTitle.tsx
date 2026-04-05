interface SectionTitleProps { title: string; sub?: string; action?: string; onAction?: () => void; }
export default function SectionTitle({ title, sub, action, onAction }: SectionTitleProps) {
  const dead = Boolean(action) && !onAction;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#142033", margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 14, color: "#5E6B7A", margin: "4px 0 0" }}>{sub}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          disabled={dead}
          title={dead ? "Acción no disponible en este contexto" : undefined}
          style={{
            fontSize: 13,
            color: dead ? "#9aa5b1" : "#123C66",
            background: "transparent",
            border: "1px solid #E5EAF2",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: dead ? "not-allowed" : "pointer",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
