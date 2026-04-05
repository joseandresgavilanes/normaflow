"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { formatDate } from "@/lib/utils";
import { useWorkspace } from "@/context/WorkspaceStore";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

export default function NotificationsModule({ serverItems }: { serverItems?: NotificationRow[] }) {
  const { state, dispatch, showToast } = useWorkspace();

  const [liveItems, setLiveItems] = useState<NotificationRow[] | null>(() =>
    serverItems ? serverItems.map(n => ({ ...n })) : null
  );

  const demoItems = useMemo(() => {
    if (serverItems) return null;
    return state.notifications;
  }, [serverItems, state.notifications]);

  const items: NotificationRow[] = demoItems ?? liveItems ?? [];

  const unreadCount = items.filter(n => !n.read).length;

  const markRead = useCallback(
    (id: string) => {
      if (demoItems) {
        dispatch({ type: "markNotificationRead", id });
        return;
      }
      setLiveItems(prev => (prev ? prev.map(n => (n.id === id ? { ...n, read: true } : n)) : prev));
    },
    [demoItems, dispatch]
  );

  const markAll = useCallback(() => {
    if (demoItems) {
      dispatch({ type: "markAllNotificationsRead" });
      showToast("Todas las notificaciones marcadas como leídas");
      return;
    }
    setLiveItems(prev => (prev ? prev.map(n => ({ ...n, read: true })) : prev));
    showToast("Actualizado");
  }, [demoItems, dispatch, showToast]);

  return (
    <div>
      <SectionTitle
        title="Notificaciones"
        sub="Aprobaciones, vencimientos y alertas"
        action={unreadCount > 0 ? "Marcar todas leídas" : undefined}
        onAction={unreadCount > 0 ? markAll : undefined}
      />
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "#142033" }}>{n.title}</span>
                <span style={{ fontSize: 12, color: "#5E6B7A" }}>{formatDate(n.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, color: "#5E6B7A", margin: "0 0 10px", lineHeight: 1.5 }}>{n.body}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {n.link && (
                  <Link
                    href={n.link}
                    onClick={() => markRead(n.id)}
                    style={{ fontSize: 13, color: "#123C66", fontWeight: 600, textDecoration: "none" }}
                  >
                    Ver detalle →
                  </Link>
                )}
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      if (demoItems) showToast("Marcada como leída");
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#5E6B7A",
                      background: "#F7F9FC",
                      border: "1px solid #E5EAF2",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Marcar leída
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
