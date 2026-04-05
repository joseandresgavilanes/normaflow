import Card from "./Card";
interface StatCardProps { label: string; value: string | number; sub?: string; color?: string; icon?: string; }
export default function StatCard({ label, value, sub, color = "#123C66", icon }: StatCardProps) {
  return (
    <Card style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      {icon && (
        <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#142033", lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{sub}</div>}
      </div>
    </Card>
  );
}
