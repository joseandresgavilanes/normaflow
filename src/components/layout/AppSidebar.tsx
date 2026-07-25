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
  CalendarRange,
  Building2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Factory,
  FileText,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
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
  Gavel,
  LockKeyhole,
  FileCheck2,
  ShieldAlert,
  Boxes,
  Siren,
  Bug,
  LifeBuoy,
  Handshake,
  HardHat,
  Leaf,
  Library,
  Layers,
  BrainCircuit,
  Scale,
  ShieldBan,
  Flame,
  UtensilsCrossed,
  Server,
  Cross,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { useI18n } from "@/context/I18nProvider";
import { getDemoOrg } from "@/lib/demo/organizations";
import type { MessageKey } from "@/lib/i18n/messages";
import { planHasModule } from "@/lib/constants";

const NAV: { href: string; Icon: LucideIcon; labelKey: MessageKey }[] = [
  { href: "/app/dashboard", Icon: LayoutDashboard, labelKey: "nav.home" },
  { href: "/app/setup", Icon: Milestone, labelKey: "nav.setup" },
  { href: "/app/standards", Icon: Library, labelKey: "nav.standards" },
  { href: "/app/integrated", Icon: Layers, labelKey: "nav.integrated" },
  { href: "/app/gap", Icon: Target, labelKey: "nav.gap" },
  { href: "/app/documents", Icon: FileText, labelKey: "nav.documents" },
  { href: "/app/records", Icon: Archive, labelKey: "nav.records" },
  { href: "/app/training", Icon: GraduationCap, labelKey: "nav.training" },
  { href: "/app/changes", Icon: RefreshCw, labelKey: "nav.changes" },
  { href: "/app/processes", Icon: Workflow, labelKey: "nav.processes" },
  { href: "/app/risks", Icon: AlertTriangle, labelKey: "nav.risks" },
  { href: "/app/opportunities", Icon: Lightbulb, labelKey: "nav.opportunities" },
  { href: "/app/suppliers", Icon: Factory, labelKey: "nav.suppliers" },
  { href: "/app/audit-program", Icon: CalendarRange, labelKey: "nav.auditProgram" },
  { href: "/app/audits", Icon: ClipboardCheck, labelKey: "nav.audits" },
  { href: "/app/management-review", Icon: Gavel, labelKey: "nav.managementReview" },
  { href: "/app/nonconformities", Icon: CircleOff, labelKey: "nav.nonconformities" },
  { href: "/app/actions", Icon: Zap, labelKey: "nav.actions" },
  { href: "/app/indicators", Icon: BarChart3, labelKey: "nav.indicators" },
  { href: "/app/evidence", Icon: Paperclip, labelKey: "nav.evidence" },
  { href: "/app/security-controls", Icon: LockKeyhole, labelKey: "nav.securityControls" },
  { href: "/app/assets", Icon: Boxes, labelKey: "nav.assets" },
  { href: "/app/soa", Icon: FileCheck2, labelKey: "nav.soa" },
  { href: "/app/risk-treatment", Icon: ShieldAlert, labelKey: "nav.riskTreatment" },
  { href: "/app/incidents", Icon: Siren, labelKey: "nav.incidents" },
  { href: "/app/vulnerabilities", Icon: Bug, labelKey: "nav.vulnerabilities" },
  { href: "/app/continuity", Icon: LifeBuoy, labelKey: "nav.continuity" },
  { href: "/app/environment", Icon: Leaf, labelKey: "nav.environment" },
  { href: "/app/energy", Icon: Flame, labelKey: "nav.energy" },
  { href: "/app/food-safety", Icon: UtensilsCrossed, labelKey: "nav.foodSafety" },
  { href: "/app/itsm", Icon: Server, labelKey: "nav.itsm" },
  { href: "/app/medical-devices", Icon: Cross, labelKey: "nav.medicalDevices" },
  { href: "/app/safety", Icon: HardHat, labelKey: "nav.safety" },
  { href: "/app/aims", Icon: BrainCircuit, labelKey: "nav.aims" },
  { href: "/app/compliance", Icon: Scale, labelKey: "nav.compliance" },
  { href: "/app/antibribery", Icon: ShieldBan, labelKey: "nav.antibribery" },
  { href: "/app/suppliers/security", Icon: Handshake, labelKey: "nav.supplierSecurity" },
  { href: "/app/integrations", Icon: Plug, labelKey: "nav.integrations" },
  { href: "/app/reporting", Icon: ScrollText, labelKey: "nav.reporting" },
  { href: "/app/activity", Icon: Activity, labelKey: "nav.activity" },
  { href: "/app/notifications", Icon: Bell, labelKey: "nav.notifications" },
  { href: "/app/billing", Icon: CreditCard, labelKey: "nav.billing" },
  { href: "/app/settings", Icon: UserCircle, labelKey: "nav.settings" },
];

const ADMIN_GROUPS: {
  labelKey: MessageKey;
  items: { href: string; Icon: LucideIcon; labelKey: MessageKey }[];
}[] = [
  {
    labelKey: "nav.generalInfo",
    items: [
      { href: "/app/info/positions", Icon: Briefcase, labelKey: "nav.positions" },
      { href: "/app/info/personnel", Icon: Users, labelKey: "nav.personnel" },
    ],
  },
  {
    labelKey: "nav.catalogs",
    items: [
      { href: "/app/catalogs/locations", Icon: MapPin, labelKey: "nav.locations" },
      { href: "/app/catalogs/retention", Icon: Timer, labelKey: "nav.retention" },
      { href: "/app/catalogs/disposition", Icon: Archive, labelKey: "nav.disposition" },
      {
        href: "/app/catalogs/archive-method",
        Icon: FolderTree,
        labelKey: "nav.archiveMethod",
      },
      { href: "/app/catalogs/record-type", Icon: FileText, labelKey: "nav.recordType" },
      { href: "/app/settings/catalogs", Icon: ClipboardCheck, labelKey: "nav.catalogs" },
    ],
  },
  {
    labelKey: "nav.admin",
    items: [
      { href: "/app/settings/organization", Icon: Building2, labelKey: "nav.orgSettings" },
      { href: "/app/settings/users", Icon: Users, labelKey: "nav.usersRoles" },
      { href: "/app/settings/groups", Icon: Shield, labelKey: "nav.groupsPermissions" },
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

function moduleForPath(href: string) {
  return /^\/app\/([^/]+)/.exec(href)?.[1] ?? null;
}

export default function AppSidebar({
  onAI,
  orgName,
  userName,
  roleLabel,
  roleKey,
  plan = "STARTER",
  trialActive = false,
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
  roleKey?: string;
  plan?: string;
  trialActive?: boolean;
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
  const { t } = useI18n();
  const sidebarName = ws?.state.session.name ?? userName;
  const sidebarRole = ws?.state.session.roleLabel ?? roleLabel;
  const activeRoleKey = ws?.state.session.roleKey ?? roleKey;
  const contributorNav = new Set([
    "/app/dashboard", "/app/documents", "/app/records", "/app/training", "/app/changes",
    "/app/processes", "/app/risks", "/app/opportunities", "/app/suppliers", "/app/audits",
    "/app/nonconformities", "/app/actions", "/app/indicators", "/app/evidence", "/app/notifications", "/app/settings",
  ]);
  const visibleNav = activeRoleKey === "CONTRIBUTOR" ? NAV.filter((item) => contributorNav.has(item.href)) : NAV;
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
        <div className="nf-sidebar-org-label">{t("common.organization")}</div>
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
        {visibleNav.map((item) => {
          const active = pathname === item.href;
          const navModule = moduleForPath(item.href);
          const locked = Boolean(navModule && !planHasModule(plan, navModule, trialActive));
          return (
            <Link
              key={item.href}
              href={locked ? `/app/billing?upgrade=${navModule}` : item.href}
              onClick={() => onNavigate?.()}
              className={`nf-sidebar-nav-link${active ? " nf-sidebar-nav-link--active" : ""}`}
              title={locked ? "Disponible desde Growth" : undefined}
            >
              <NavIcon Icon={item.Icon} active={active} />
              {t(item.labelKey)}
              {locked && <LockKeyhole size={13} style={{ marginLeft: "auto", color: "#9aa6b5" }} aria-label="Disponible desde Growth" />}
            </Link>
          );
        })}

        <button type="button" onClick={onAI} className="nf-sidebar-ai-btn">
          <Sparkles size={16} strokeWidth={2} aria-hidden />
          {t("nav.ai")}
        </button>

        {ADMIN_GROUPS.map((group) => {
          const groupActive = group.items.some(
            (it) => pathname === it.href || pathname?.startsWith(it.href + "/"),
          );
          return (
            <div key={group.labelKey}>
              <div
                className={
                  groupActive
                    ? "nf-sidebar-group-title nf-sidebar-group-title--active"
                    : "nf-sidebar-group-title"
                }
              >
                {t(group.labelKey)}
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
                    {t(item.labelKey)}
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
          title={t("nav.logout")}
          aria-label={t("nav.logout")}
        >
          <LogOut size={17} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
