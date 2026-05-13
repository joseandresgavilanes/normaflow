"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ClipboardCheck,
  CreditCard,
  Factory,
  FileText,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Milestone,
  Paperclip,
  Plug,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
  Target,
  Timer,
  UserCircle,
  Users,
  Workflow,
  Zap,
  CircleOff,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { getDemoOrg } from "@/lib/demo/organizations";

const NAV: { href: string; Icon: LucideIcon; label: string }[] = [
  { href: "/app/dashboard", Icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/setup", Icon: Milestone, label: "Implementación" },
  { href: "/app/gap", Icon: Target, label: "GAP Assessment" },
  { href: "/app/documents", Icon: FileText, label: "Documentos" },
  { href: "/app/records", Icon: Archive, label: "Registros" },
  { href: "/app/training", Icon: GraduationCap, label: "Capacitación" },
  { href: "/app/changes", Icon: RefreshCw, label: "Cambios" },
  { href: "/app/processes", Icon: Workflow, label: "Procesos" },
  { href: "/app/risks", Icon: AlertTriangle, label: "Riesgos" },
  { href: "/app/suppliers", Icon: Factory, label: "Proveedores" },
  { href: "/app/audits", Icon: ClipboardCheck, label: "Auditorías" },
  { href: "/app/nonconformities", Icon: CircleOff, label: "No Conformidades" },
  { href: "/app/actions", Icon: Zap, label: "Plan de Acción" },
  { href: "/app/indicators", Icon: BarChart3, label: "Indicadores" },
  { href: "/app/evidence", Icon: Paperclip, label: "Evidencias" },
  { href: "/app/integrations", Icon: Plug, label: "Integraciones" },
  { href: "/app/reporting", Icon: ScrollText, label: "Informes" },
  { href: "/app/activity", Icon: Activity, label: "Actividad" },
  { href: "/app/notifications", Icon: Bell, label: "Notificaciones" },
  { href: "/app/billing", Icon: CreditCard, label: "Billing" },
  { href: "/app/settings", Icon: UserCircle, label: "Cuenta" },
];

const ADMIN_GROUPS: {
  label: string;
  items: { href: string; Icon: LucideIcon; label: string }[];
}[] = [
  {
    label: "Información general",
    items: [
      { href: "/app/info/positions", Icon: Briefcase, label: "Cargos" },
      { href: "/app/info/personnel", Icon: Users, label: "Personal" },
    ],
  },
  {
    label: "Catálogos",
    items: [
      { href: "/app/catalogs/locations", Icon: MapPin, label: "Lugares" },
      { href: "/app/catalogs/retention", Icon: Timer, label: "Retención" },
      { href: "/app/catalogs/disposition", Icon: Archive, label: "Disposición" },
      {
        href: "/app/catalogs/archive-method",
        Icon: FolderTree,
        label: "Método archivo",
      },
      { href: "/app/catalogs/record-type", Icon: FileText, label: "Tipo registro" },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/app/settings/organization", Icon: Building2, label: "Organización" },
      { href: "/app/settings/users", Icon: Users, label: "Usuarios y roles" },
      { href: "/app/settings/groups", Icon: Shield, label: "Grupos y permisos" },
    ],
  },
];

type Membership = {
  organizationId: string;
  organizationName: string;
  role: string;
};

function NavIcon({
  Icon,
  active,
}: {
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <span className="nf-sidebar-nav-icon">
      <Icon size={18} strokeWidth={active ? 2.1 : 1.75} aria-hidden />
    </span>
  );
}

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
  const demoAccent =
    demoSession && ws
      ? getDemoOrg(ws.state.session.activeOrgId)?.accent
      : undefined;

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
        transform: compact
          ? drawerOpen
            ? "translateX(0)"
            : "translateX(-100%)"
          : "none",
        transition: compact ? "transform 0.22s ease" : undefined,
        boxShadow:
          compact && drawerOpen ? "8px 0 32px rgba(0,0,0,0.2)" : undefined,
      }}
    >
      <div
        style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Link
          href="/home"
          onClick={() => onNavigate?.()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "#2E8B57",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
              N
            </span>
          </div>
          <div>
            <div
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.3px",
              }}
            >
              NormaFlow
            </div>
            <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 10 }}>
              v1.0
            </div>
          </div>
        </Link>
      </div>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "8px 10px",
            borderLeft: demoAccent ? `3px solid ${demoAccent}` : undefined,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.68)",
              marginBottom: 1,
            }}
          >
            Organización
          </div>
          {demoSession && ws ? (
            <select
              value={ws.state.session.activeOrgId}
              onChange={(e) => ws.switchDemoOrg(e.target.value)}
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
              {ws.state.demoOrganizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : memberships.length > 1 && onOrgChange ? (
            <select
              value={currentOrgId ?? ""}
              onChange={(e) => onOrgChange(e.target.value)}
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
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 500,
              }}
            >
              {displayOrgName}
            </div>
          )}
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px 8px", overflow: "auto" }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={`nf-sidebar-nav-link${active ? " nf-sidebar-nav-link--active" : ""}`}
            >
              <NavIcon Icon={item.Icon} active={active} />
              {item.label}
            </Link>
          );
        })}
        <div
          style={{
            marginTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 8,
          }}
        >
          <button type="button" onClick={onAI} className="nf-sidebar-ai-btn">
            <Sparkles size={16} strokeWidth={2} aria-hidden />
            Asistente IA
          </button>
        </div>

        {ADMIN_GROUPS.map((group) => {
          const groupActive = group.items.some(
            (it) => pathname === it.href || pathname?.startsWith(it.href + "/"),
          );
          return (
            <div key={group.label} style={{ marginTop: 12 }}>
              <div
                className={
                  groupActive
                    ? "nf-sidebar-group-title nf-sidebar-group-title--active"
                    : "nf-sidebar-group-title"
                }
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={`nf-sidebar-nav-link nf-sidebar-nav-link--admin${active ? " nf-sidebar-nav-link--active" : ""}`}
                  >
                    <NavIcon Icon={item.Icon} active={active} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <Link
          href="/app/settings"
          onClick={() => onNavigate?.()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
            flex: 1,
            minWidth: 0,
            color: "inherit",
          }}
        >
          <Avatar name={sidebarName} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sidebarName}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.58)", marginTop: 1 }}>
              {sidebarRole}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.14s ease, color 0.14s ease",
          }}
          title="Salir"
          aria-label="Salir"
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
