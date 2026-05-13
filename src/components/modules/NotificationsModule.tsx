"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, Sparkles } from "lucide-react";
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

function typeAccent(type: string): { color: string; bg: string; Icon: typeof Bell } {
  if (type === "ALERT") return { color: "#C93C37", bg: "rgba(201, 60, 55, 0.12)", Icon: AlertTriangle };
  if (type === "WARNING") return { color: "#D68A1A", bg: "rgba(214, 138, 26, 0.14)", Icon: AlertTriangle };
  if (type === "SUCCESS") return { color: "#2E8B57", bg: "rgba(46, 139, 87, 0.12)", Icon: CheckCircle2 };
  return { color: "#123C66", bg: "rgba(18, 60, 102, 0.1)", Icon: Info };
}

export default function NotificationsModule({ serverItems }: { serverItems?: NotificationRow[] }) {
  const { state, dispatch, showToast } = useWorkspace();

  const [liveItems, setLiveItems] = useState<NotificationRow[] | null>(() =>
    serverItems ? serverItems.map(n => ({ ...n })) : null
  );
  const [inboxTab, setInboxTab] = useState<"ALL" | "UNREAD">("ALL");

  const demoItems = useMemo(() => {
    if (serverItems) return null;
    return state.notifications;
  }, [serverItems, state.notifications]);

  const items: NotificationRow[] = demoItems ?? liveItems ?? [];

  const unreadCount = items.filter(n => !n.read).length;
  const readCount = items.length - unreadCount;

  const list = useMemo(
    () => (inboxTab === "UNREAD" ? items.filter(n => !n.read) : items),
    [items, inboxTab]
  );

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
        sub="Aprobaciones, vencimientos y alertas del espacio de trabajo"
        action={
          unreadCount > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <CheckCheck size={17} strokeWidth={2.25} aria-hidden />
              Marcar todas leídas
            </span>
          ) : undefined
        }
        onAction={unreadCount > 0 ? markAll : undefined}
      />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.14) 0%, rgba(18, 60, 102, 0.05) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <Bell size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{items.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En bandeja</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.22) 0%, rgba(214, 138, 26, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{unreadCount}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Sin leer</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{readCount}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Leídas</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Bandeja
        </span>
        <button type="button" className={inboxTab === "ALL" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setInboxTab("ALL")}>
          Todas
        </button>
        <button type="button" className={inboxTab === "UNREAD" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setInboxTab("UNREAD")}>
          Sin leer ({unreadCount})
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? (
          <Card style={{ padding: 44, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 14px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #f3f6fa, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#123C66",
              }}
            >
              <Bell size={26} strokeWidth={2} aria-hidden />
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nf-ink)" }}>
              {inboxTab === "UNREAD" ? "No tienes notificaciones sin leer" : "No hay notificaciones recientes"}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--nf-ink-3)", lineHeight: 1.55 }}>
              {inboxTab === "UNREAD" ? "Cuando lleguen alertas o aprobaciones, aparecerán aquí." : "La actividad del espacio de trabajo generará avisos en esta lista."}
            </p>
          </Card>
        ) : (
          list.map(n => {
            const { color, bg, Icon } = typeAccent(n.type);
            return (
              <Card
                key={n.id}
                style={{
                  padding: 0,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "stretch",
                  borderRadius: 14,
                  boxShadow: "0 12px 36px -24px rgba(18, 60, 102, 0.18)",
                  opacity: n.read ? 0.88 : 1,
                }}
              >
                <div style={{ width: 5, flexShrink: 0, background: `linear-gradient(180deg, ${color}, ${color}99)` }} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "16px 18px",
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: "8px 12px",
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      gridRow: 1,
                      gridColumn: 1,
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color,
                    }}
                  >
                    <Icon size={20} strokeWidth={2.25} aria-hidden />
                  </div>
                  <div style={{ gridRow: 1, gridColumn: 2, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        color: "var(--nf-ink)",
                        fontSize: 15,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.25,
                        fontFamily: "var(--font-manrope, Manrope), var(--font-inter, Inter), system-ui, sans-serif",
                      }}
                    >
                      {n.title}
                      {!n.read && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            verticalAlign: "middle",
                            color: "#fff",
                            background: color,
                            padding: "3px 8px",
                            borderRadius: 99,
                          }}
                        >
                          Nuevo
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4, display: "inline-block" }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <p style={{ gridRow: 2, gridColumn: "1 / -1", fontSize: 14, color: "var(--nf-ink-3)", margin: 0, lineHeight: 1.55 }}>{n.body}</p>
                  <div style={{ gridRow: 3, gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => markRead(n.id)}
                        style={{
                          fontSize: 13,
                          color: "#fff",
                          fontWeight: 700,
                          textDecoration: "none",
                          background: "linear-gradient(180deg, #154a7a 0%, #123c66 100%)",
                          padding: "8px 14px",
                          borderRadius: 10,
                          boxShadow: "0 2px 8px rgba(18, 60, 102, 0.2)",
                        }}
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
                          fontWeight: 700,
                          color: "var(--nf-ink-2)",
                          background: "#fff",
                          border: "1px solid var(--nf-line)",
                          borderRadius: 10,
                          padding: "8px 14px",
                          cursor: "pointer",
                        }}
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
