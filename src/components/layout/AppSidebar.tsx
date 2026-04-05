"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { getDemoOrg } from "@/lib/demo/organizations";

const NAV = [
  { href: "/app/dashboard", icon: "⊞", label: "Dashboard" },
  { href: "/app/setup", icon: "◈", label: "Implementación" },
  { href: "/app/gap", icon: "◎", label: "GAP Assessment" },
  { href: "/app/documents", icon: "📄", label: "Documentos" },
  { href: "/app/training", icon: "🎓", label: "Capacitación" },
  { href: "/app/changes", icon: "↻", label: "Cambios" },
  { href: "/app/processes", icon: "⎔", label: "Procesos" },
  { href: "/app/risks", icon: "⚠", label: "Riesgos" },
  { href: "/app/suppliers", icon: "🏭", label: "Proveedores" },
  { href: "/app/audits", icon: "✓", label: "Auditorías" },
  { href: "/app/nonconformities", icon: "⊘", label: "No Conformidades" },
  { href: "/app/actions", icon: "⚡", label: "Plan de Acción" },
  { href: "/app/indicators", icon: "📊", label: "Indicadores" },
  { href: "/app/evidence", icon: "📎", label: "Evidencias" },
  { href: "/app/integrations", icon: "🔌", label: "Integraciones" },
  { href: "/app/reporting", icon: "📑", label: "Informes" },
  { href: "/app/activity", icon: "📜", label: "Actividad" },
  { href: "/app/notifications", icon: "🔔", label: "Notificaciones" },
  { href: "/app/billing", icon: "💳", label: "Billing" },
  { href: "/app/settings", icon: "👤", label: "Cuenta" },
];

type Membership = { organizationId: string; organizationName: string; role: string };

export default function AppSidebar({
  onAI,
  orgName,
  userName,
  roleLabel,
  memberships = [],
  currentOrgId,
  onOrgChange,
  demoSession = false,
  compact = false,
  drawerOpen = false,
  onNavigate,
}: {
  onAI: () => void;
  orgName: string;
  userName: string;
  roleLabel: string;
  memberships?: Membership[];
  currentOrgId?: string;
  onOrgChange?: (organizationId: string) => void;
  demoSession?: boolean;
  /** Móvil / tablet estrecho: drawer superpuesto */
  compact?: boolean;
  drawerOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const ws = useWorkspaceOptional();
  const sidebarName = ws?.state.session.name ?? userName;
  const sidebarRole = ws?.state.session.roleLabel ?? roleLabel;
  const displayOrgName = ws?.state.session.orgName ?? orgName;
  const demoAccent = demoSession && ws ? getDemoOrg(ws.state.session.activeOrgId)?.accent : undefined;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside
      style={{
        width: compact ? "min(280px, 88vw)" : 224,
        background: "#0D2E4E",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: compact ? 160 : 100,
        transform: compact ? (drawerOpen ? "translateX(0)" : "translateX(-100%)") : "none",
        transition: compact ? "transform 0.22s ease" : undefined,
        boxShadow: compact && drawerOpen ? "8px 0 32px rgba(0,0,0,0.2)" : undefined,
      }}
    >
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Link href="/home" onClick={() => onNavigate?.()} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, background: "#2E8B57", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>N</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>NormaFlow</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>v1.0</div>
          </div>
        </Link>
      </div>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "8px 10px",
            borderLeft: demoAccent ? `3px solid ${demoAccent}` : undefined,
          }}
        >
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>Organización</div>
          {demoSession && ws ? (
            <select
              value={ws.state.session.activeOrgId}
              onChange={e => ws.switchDemoOrg(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                fontSize: 12,
                color: "rgba(255,255,255,0.9)",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "4px 6px",
              }}
            >
              {ws.state.demoOrganizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : memberships.length > 1 && onOrgChange ? (
            <select
              value={currentOrgId ?? ""}
              onChange={e => onOrgChange(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                fontSize: 12,
                color: "rgba(255,255,255,0.9)",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "4px 6px",
              }}
            >
              {memberships.map(m => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{displayOrgName}</div>
          )}
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px 8px", overflow: "auto" }}>
        {NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 10px",
                borderRadius: 8,
                marginBottom: 1,
                textDecoration: "none",
                background: active ? "rgba(255,255,255,0.11)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: "all 0.12s",
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
          <button
            type="button"
            onClick={onAI}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "rgba(46,139,87,0.18)",
              color: "#3aa86a",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14 }}>✦</span> Asistente IA
          </button>
        </div>
      </nav>
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 9 }}>
        <Link href="/app/settings" onClick={() => onNavigate?.()} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flex: 1, minWidth: 0, color: "inherit" }}>
          <Avatar name={sidebarName} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sidebarName}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{sidebarRole}</div>
          </div>
        </Link>
        <button type="button" onClick={() => logout()} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }} title="Salir">
          ↩
        </button>
      </div>
    </aside>
  );
}
