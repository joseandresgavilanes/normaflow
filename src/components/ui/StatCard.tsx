import Card from "./Card";
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: string;
}
export default function StatCard({
  label,
  value,
  sub,
  color = "#5266F6",
  icon,
}: StatCardProps) {
  return (
    <Card style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 20px" }}>
      {icon && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: `${color}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--nf-ink-3)", marginBottom: 4, fontWeight: 500 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "var(--nf-ink)",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4, fontWeight: 500 }}>
            {sub}
          </div>
        )}
      </div>
    </Card>
  );
}
