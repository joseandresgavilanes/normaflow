"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Eye, Menu, Search } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import QuickCreateMenu from "@/components/layout/QuickCreateMenu";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";

const PAGE_TITLES: Record<string, string> = {
  "/app/dashboard": "Home",
  "/app/setup": "Implementación",
  "/app/gap": "GAP Assessment",
  "/app/documents": "Documentos",
  "/app/training": "Capacitación",
  "/app/changes": "Cambios",
  "/app/processes": "Procesos",
  "/app/risks": "Riesgos",
  "/app/suppliers": "Proveedores",
  "/app/audits": "Auditorías",
  "/app/nonconformities": "No Conformidades",
  "/app/actions": "Plan de Acción",
  "/app/indicators": "Indicadores",
  "/app/evidence": "Evidencias",
  "/app/integrations": "Integraciones",
  "/app/reporting": "Informes",
  "/app/activity": "Actividad",
  "/app/notifications": "Notificaciones",
  "/app/billing": "Billing",
  "/app/settings": "Cuenta",
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
  const router = useRouter();
  const ws = useWorkspaceOptional();
  const displayName = ws?.state.session.name ?? userName;
  const unread = ws?.state.notifications.filter((n) => !n.read).length ?? 0;
  const pageTitle = PAGE_TITLES[pathname] ?? "NormaFlow";

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

      <div className="nf-topbar-search">
        <Search size={16} strokeWidth={2} className="nf-topbar-search-icon" aria-hidden />
        <input
          type="search"
          className="nf-topbar-search-input"
          placeholder={`Buscar en ${pageTitle.toLowerCase()}…`}
          aria-label="Buscar"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push("/app/activity");
            }
          }}
        />
        <span className="nf-topbar-search-kbd">⌘ K</span>
      </div>

      <div className="nf-topbar-actions">
        <QuickCreateMenu />
        <button type="button" className="nf-topbar-icon-btn" title="Modo privado" aria-label="Modo privado">
          <Eye size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <Link
          href="/app/notifications"
          className="nf-topbar-icon-btn"
          title="Notificaciones"
          style={{ position: "relative" }}
        >
          <Bell size={18} strokeWidth={1.75} aria-hidden />
          {unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#5266F6",
                border: "2px solid var(--bg)",
              }}
            />
          )}
        </Link>
        <Link href="/app/settings" title={displayName} aria-label="Cuenta">
          <Avatar name={displayName} size={32} />
        </Link>
      </div>
    </header>
  );
}
