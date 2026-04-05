"use client";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { formatDate } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

export default function NotificationsModule({ items }: { items: NotificationRow[] }) {
  return (
    <div>
      <SectionTitle title="Notificaciones" sub="Aprobaciones, vencimientos y alertas" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center", color: "#5E6B7A" }}>No hay notificaciones recientes.</Card>
        ) : (
          items.map(n => (
            <Card
              key={n.id}
              style={{
                padding: "16px 18px",
                borderLeft: `4px solid ${n.type === "ALERT" ? "#C93C37" : n.type === "WARNING" ? "#D68A1A" : n.type === "SUCCESS" ? "#2E8B57" : "#123C66"}`,
                opacity: n.read ? 0.75 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "#142033" }}>{n.title}</span>
                <span style={{ fontSize: 12, color: "#5E6B7A" }}>{formatDate(n.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, color: "#5E6B7A", margin: "0 0 8px", lineHeight: 1.5 }}>{n.body}</p>
              {n.link && (
                <a href={n.link} style={{ fontSize: 13, color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
                  Ver detalle →
                </a>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
