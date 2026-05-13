"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";

const BREADCRUMBS: Record<string, string[]> = {
  "/app/dashboard": ["Dashboard"],
  "/app/setup": ["Implementación guiada"],
  "/app/gap": ["GAP Assessment"],
  "/app/documents": ["Control de Documentos"],
  "/app/training": ["Capacitación"],
  "/app/changes": ["Control de cambios"],
  "/app/processes": ["Mapa de procesos"],
  "/app/risks": ["Gestión de Riesgos"],
  "/app/suppliers": ["Proveedores"],
  "/app/audits": ["Auditorías"],
  "/app/nonconformities": ["No Conformidades", "CAPA"],
  "/app/actions": ["Plan de Acción"],
  "/app/indicators": ["Indicadores y KPIs"],
  "/app/evidence": ["Repositorio de evidencias"],
  "/app/integrations": ["Integraciones"],
  "/app/reporting": ["Informes y auditoría"],
  "/app/activity": ["Actividad del sistema"],
  "/app/notifications": ["Notificaciones"],
  "/app/billing": ["Billing"],
  "/app/settings": ["Cuenta"],
};

export default function AppTopbar({
  userName,
  roleLabel,
  onMenuClick,
}: {
  userName: string;
  roleLabel: string;
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const ws = useWorkspaceOptional();
  const displayName = ws?.state.session.name ?? userName;
  const displayRole = ws?.state.session.roleLabel ?? roleLabel;
  const unread = ws?.state.notifications.filter((n) => !n.read).length ?? 0;
  const crumbs = BREADCRUMBS[pathname] ?? ["Aplicación"];
  return (
    <header className="nf-topbar">
      {onMenuClick && (
        <button
          type="button"
          className="nf-topbar-menu"
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
        >
          <Menu size={20} strokeWidth={2} aria-hidden />
        </button>
      )}
      <div className="nf-topbar-crumbs">
        <Link href="/app/dashboard" className="nf-topbar-link">
          NormaFlow
        </Link>
        {crumbs.map((c, i) => (
          <span
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span className="nf-topbar-sep">/</span>
            <span
              className={
                i === crumbs.length - 1
                  ? "nf-topbar-crumb nf-topbar-crumb--current"
                  : "nf-topbar-crumb"
              }
            >
              {c}
            </span>
          </span>
        ))}
      </div>
      <Link
        href="/app/notifications"
        className="nf-topbar-notify"
        title="Notificaciones"
      >
        <Bell size={18} strokeWidth={1.85} color="#123C66" aria-hidden />
        {unread > 0 ? (
          <span
            style={{
              background: "#C93C37",
              color: "#fff",
              borderRadius: 99,
              fontSize: 10,
              padding: "2px 6px",
              fontWeight: 700,
              minWidth: 18,
              textAlign: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : (
          <span className="nf-topbar-notify-zero">0</span>
        )}
      </Link>
      <Link
        href="/app/settings"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
          color: "inherit",
          flexShrink: 0,
        }}
        title="Cuenta y perfil"
      >
        <Avatar name={displayName} size={30} />
        <div className="nf-topbar-profile-text">
          <div className="nf-topbar-name">{displayName}</div>
          <div className="nf-topbar-role">{displayRole}</div>
        </div>
      </Link>
    </header>
  );
}
