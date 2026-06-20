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
  ChevronDown,
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
  { href: "/app/dashboard", Icon: LayoutDashboard, label: "Home" },
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
      <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden />
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
      className="nf-sidebar"
      style={{
        width: compact ? "min(280px, 88vw)" : undefined,
        zIndex: compact ? 160 : 100,
        transform: compact
          ? drawerOpen
            ? "translateX(0)"
            : "translateX(-100%)"
          : "none",
        transition: compact ? "transform 0.22s ease" : undefined,
        boxShadow:
          compact && drawerOpen ? "4px 0 24px rgba(0,0,0,0.08)" : undefined,
      }}
    >
      <Link
        href="/app/dashboard"
        onClick={() => onNavigate?.()}
        className="nf-sidebar-brand"
      >
        <div className="nf-sidebar-brand-mark">N</div>
        <span className="nf-sidebar-brand-name">{displayOrgName}</span>
        <ChevronDown size={16} strokeWidth={2} color="#9ca3af" aria-hidden />
      </Link>

      <div
        className="nf-sidebar-org"
        style={demoAccent ? { borderLeftColor: demoAccent, borderLeftWidth: 3 } : undefined}
      >
        <div className="nf-sidebar-org-label">Organización</div>
        {demoSession && ws ? (
          <select
            value={ws.state.session.activeOrgId}
            onChange={(e) => ws.switchDemoOrg(e.target.value)}
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
          >
            {memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.organizationName}
              </option>
            ))}
          </select>
        ) : (
          <div className="nf-sidebar-org-name">{displayOrgName}</div>
        )}
      </div>

      <nav className="nf-sidebar-nav">
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

        <button type="button" onClick={onAI} className="nf-sidebar-ai-btn">
          <Sparkles size={16} strokeWidth={2} aria-hidden />
          Asistente IA
        </button>

        {ADMIN_GROUPS.map((group) => {
          const groupActive = group.items.some(
            (it) => pathname === it.href || pathname?.startsWith(it.href + "/"),
          );
          return (
            <div key={group.label}>
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

      <div className="nf-sidebar-footer">
        <Link
          href="/app/settings"
          onClick={() => onNavigate?.()}
          className="nf-sidebar-footer-profile"
        >
          <Avatar name={sidebarName} size={32} />
          <div style={{ minWidth: 0 }}>
            <div className="nf-sidebar-footer-name">{sidebarName}</div>
            <div className="nf-sidebar-footer-role">{sidebarRole}</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="nf-sidebar-logout"
          title="Salir"
          aria-label="Salir"
        >
          <LogOut size={17} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
