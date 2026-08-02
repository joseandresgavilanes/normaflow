"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Pin, PinOff, Search, Sparkles, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { useI18n } from "@/context/I18nProvider";
import { getDemoOrg } from "@/lib/demo/organizations";
import { planHasModule } from "@/lib/constants";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import {
  CONTRIBUTOR_ROUTES,
  NAV_GROUPS,
  groupIdForPath,
  isRouteActive,
  moduleForPath,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation";

type Membership = { organizationId: string; organizationName: string; role: string };

const PINNED_STORAGE_KEY = "nf.nav.pinned";
const OPEN_GROUPS_STORAGE_KEY = "nf.nav.openGroups";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible (modo privado): la navegación sigue usable */
  }
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
  drawerOpen = false,
  onNavigate,
  onClose,
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
  drawerOpen?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSection = useSearchParams().get("section");
  const ws = useWorkspaceOptional();
  const { t, tx } = useI18n();
  const permissions = useDemoPermission();

  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean> | null>(null);
  const prefetched = useRef(new Set<string>());

  const sidebarName = ws?.state.session.name ?? userName;
  const sidebarRole = ws?.state.session.roleLabel ?? roleLabel;
  const activeRoleKey = ws?.state.session.roleKey ?? roleKey;
  const displayOrgName = ws?.state.session.orgName ?? orgName;
  const activeGroupId = groupIdForPath(pathname);

  // El estado persistido se lee tras montar: leerlo durante el render rompería
  // la hidratación, porque el servidor no tiene localStorage.
  useEffect(() => {
    setPinned(readStorage<string[]>(PINNED_STORAGE_KEY, []));
    setOpenGroups(readStorage<Record<string, boolean>>(OPEN_GROUPS_STORAGE_KEY, {}));
  }, []);

  const prefetchRoute = useCallback(
    (href: string) => {
      if (prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  const togglePin = useCallback((href: string) => {
    setPinned((current) => {
      const next = current.includes(href)
        ? current.filter((item) => item !== href)
        : [...current, href];
      writeStorage(PINNED_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string, isOpen: boolean) => {
    setOpenGroups((current) => {
      const next = { ...(current ?? {}), [groupId]: !isOpen };
      writeStorage(OPEN_GROUPS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const labelFor = useCallback(
    (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label ? tx(item.label) : ""),
    [t, tx],
  );

  /** Grupos filtrados por rol, por permiso y por el filtro de texto. */
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return NAV_GROUPS.map((group) => {
      const items = group.items.filter((item) => {
        if (activeRoleKey === "CONTRIBUTOR" && !CONTRIBUTOR_ROUTES.has(item.href)) return false;
        if (item.permission && !permissions.can(item.permission)) return false;
        if (needle && !labelFor(item).toLowerCase().includes(needle)) return false;
        return true;
      });
      return { ...group, items } satisfies NavGroup;
    }).filter((group) => group.items.length > 0);
  }, [activeRoleKey, labelFor, permissions, query]);

  const pinnedItems = useMemo(() => {
    if (query.trim()) return [];
    const all = visibleGroups.flatMap((group) => group.items);
    return pinned
      .map((href) => all.find((item) => item.href === href))
      .filter((item): item is NavItem => Boolean(item));
  }, [pinned, query, visibleGroups]);

  const filtering = query.trim().length > 0;
  const demoAccent = demoSession && ws ? getDemoOrg(ws.state.session.activeOrgId)?.accent : undefined;

  const renderItem = (item: NavItem, options: { inPinned?: boolean } = {}) => {
    const active = isRouteActive(pathname, item.href);
    const navModule = item.module ?? moduleForPath(item.href);
    // El gating por plan se aplica solo donde ya se aplicaba. Los módulos
    // normativos (los que declaran secciones) nunca pasaron por `planHasModule`
    // en el sidebar anterior: extenderlo aquí los habría redirigido a billing.
    const locked = Boolean(!item.sections && navModule && !planHasModule(plan, navModule, trialActive));
    const href = locked ? `/app/billing?upgrade=${navModule}` : item.href;
    const isPinned = pinned.includes(item.href);
    const label = labelFor(item);
    const badgeId = locked ? `nf-nav-plan-${item.href.replace(/\W+/g, "-")}` : undefined;

    return (
      <li key={`${options.inPinned ? "pin:" : ""}${item.href}`} className="nf-sidenav__row">
        <Link
          href={href}
          prefetch={false}
          aria-current={active ? "page" : undefined}
          /* El plan es una descripción, no parte del nombre del enlace: si el
             badge entra en el nombre accesible, el enlace pasa a llamarse
             "Compliance Growth". */
          aria-describedby={badgeId}
          onPointerEnter={() => prefetchRoute(href)}
          onFocus={() => prefetchRoute(href)}
          onTouchStart={() => prefetchRoute(href)}
          onClick={() => onNavigate?.()}
          className="nf-sidenav__link"
          data-active={active || undefined}
          data-locked={locked || undefined}
        >
          <item.Icon className="nf-sidenav__icon" size={17} strokeWidth={active ? 2 : 1.75} aria-hidden />
          <span className="nf-sidenav__label">{label}</span>
        </Link>
        {locked && (
          /* El plan se comunica con texto, no solo con un icono: antes era un
             candado con `title`, invisible para teclado y lectores. */
          <span className="nf-sidenav__badge" id={badgeId} title={t("nav.locked")}>
            {t("nav.lockedBadge")}
          </span>
        )}
        <button
          type="button"
          className="nf-sidenav__pin"
          data-pinned={isPinned || undefined}
          aria-label={`${isPinned ? t("nav.unpin") : t("nav.pin")}: ${label}`}
          aria-pressed={isPinned}
          onClick={() => togglePin(item.href)}
        >
          {isPinned ? <PinOff size={13} aria-hidden /> : <Pin size={13} aria-hidden />}
        </button>

        {/* Secciones del módulo bajo la norma abierta. El bloque 6 las retiró
            de aquí para llevarlas a pestañas dentro de la página; se restauran
            porque la navegación por el sidebar es la que se espera. Alimentan
            `?section=`, que `useModuleSection` lee para cambiar la vista. */}
        {active && !locked && item.sections && item.sections.length > 0 && (
          <ul className="nf-sidenav__sections">
            {item.sections.map((section) => {
              const sectionHref = section.section === "panel"
                ? item.href
                : `${item.href}?section=${section.section}`;
              const sectionActive = currentSection === section.section
                || (!currentSection && section.section === "panel");
              return (
                <li key={section.section}>
                  <Link
                    href={sectionHref}
                    prefetch={false}
                    aria-current={sectionActive ? "true" : undefined}
                    onClick={() => onNavigate?.()}
                    className="nf-sidenav__section-link"
                    data-active={sectionActive || undefined}
                  >
                    {tx(section.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const groupLabel = t(group.labelKey);
    // Mientras se filtra, todo abierto. Si no, manda la preferencia guardada y,
    // a falta de ella, se abre el grupo que contiene la ruta activa.
    const isOpen = filtering || (openGroups?.[group.id] ?? group.id === activeGroupId);
    const panelId = `nf-nav-group-${group.id}`;

    return (
      <li key={group.id} className="nf-sidenav__group">
        <button
          type="button"
          className="nf-sidenav__group-toggle"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={
            isOpen
              ? t("nav.collapseGroup", { group: groupLabel })
              : t("nav.expandGroup", { group: groupLabel })
          }
          onClick={() => toggleGroup(group.id, isOpen)}
          disabled={filtering}
        >
          <span className="nf-sidenav__group-title">{groupLabel}</span>
          <ChevronDown
            className="nf-sidenav__chevron"
            data-open={isOpen || undefined}
            size={14}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        <ul id={panelId} className="nf-sidenav__list" hidden={!isOpen}>
          {group.items.map((item) => renderItem(item))}
        </ul>
      </li>
    );
  };

  return (
    <aside
      className="nf-sidenav"
      data-open={drawerOpen || undefined}
      style={demoAccent ? ({ "--nf-nav-accent": demoAccent } as React.CSSProperties) : undefined}
    >
      <div className="nf-sidenav__head">
        <Link
          href="/app/dashboard"
          prefetch={false}
          className="nf-sidenav__brand"
          onClick={() => onNavigate?.()}
          aria-label="NormaFlow"
        >
          <span className="nf-sidenav__brand-mark" aria-hidden>N</span>
        </Link>

        {/* Un único selector de organización. Antes había dos controles para lo
            mismo: la marca truncada con un chevron que no desplegaba nada, y
            una caja "Organización" con un select justo debajo. */}
        <OrgSwitcher
          displayOrgName={displayOrgName}
          demoSession={demoSession}
          memberships={memberships}
          currentOrgId={currentOrgId}
          onOrgChange={onOrgChange}
        />

        {onClose && (
          <button type="button" className="nf-sidenav__close" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <div className="nf-sidenav__filter">
        <Search size={15} strokeWidth={2} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("nav.filter.placeholder")}
          aria-label={t("nav.filter.label")}
        />
      </div>

      <nav className="nf-sidenav__scroll" aria-label={t("nav.primaryLabel")}>
        <ul className="nf-sidenav__groups">
          {pinnedItems.length > 0 && (
            <li className="nf-sidenav__group">
              <p className="nf-sidenav__group-title nf-sidenav__group-title--static">{t("nav.pinned")}</p>
              <ul className="nf-sidenav__list">
                {pinnedItems.map((item) => renderItem(item, { inPinned: true }))}
              </ul>
            </li>
          )}
          {visibleGroups.map(renderGroup)}
        </ul>

        {filtering && visibleGroups.length === 0 && (
          <p className="nf-sidenav__empty">{t("nav.filter.empty", { query: query.trim() })}</p>
        )}
      </nav>

      <div className="nf-sidenav__foot">
        <button type="button" onClick={onAI} className="nf-sidenav__ai">
          <Sparkles size={15} strokeWidth={2} aria-hidden />
          {t("nav.ai")}
        </button>
        <div className="nf-sidenav__account">
          <Link
            href="/app/settings"
            prefetch={false}
            onClick={() => onNavigate?.()}
            className="nf-sidenav__profile"
          >
            <Avatar name={sidebarName} size={28} />
            <span className="nf-sidenav__profile-text">
              <span className="nf-sidenav__profile-name">{sidebarName}</span>
              <span className="nf-sidenav__profile-role">{sidebarRole}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="nf-sidenav__logout"
            aria-label={t("nav.logout")}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}

function OrgSwitcher({
  displayOrgName,
  demoSession,
  memberships,
  currentOrgId,
  onOrgChange,
}: {
  displayOrgName: string;
  demoSession: boolean;
  memberships: Membership[];
  currentOrgId?: string;
  onOrgChange?: (organizationId: string) => void;
}) {
  const ws = useWorkspaceOptional();
  const { t } = useI18n();

  const options =
    demoSession && ws
      ? ws.state.demoOrganizations.map((org) => ({ id: org.id, name: org.name }))
      : memberships.map((m) => ({ id: m.organizationId, name: m.organizationName }));

  const value = demoSession && ws ? ws.state.session.activeOrgId : currentOrgId ?? "";
  const canSwitch = options.length > 1 && (demoSession ? Boolean(ws) : Boolean(onOrgChange));

  if (!canSwitch) {
    return (
      <span className="nf-sidenav__org">
        <span className="nf-sidenav__org-label">{t("common.organization")}</span>
        <span className="nf-sidenav__org-name" title={displayOrgName}>{displayOrgName}</span>
      </span>
    );
  }

  return (
    <span className="nf-sidenav__org nf-sidenav__org--switch">
      <span className="nf-sidenav__org-label">{t("common.organization")}</span>
      <span className="nf-sidenav__org-control">
        <select
          value={value}
          aria-label={t("common.organization")}
          onChange={(event) => {
            if (demoSession && ws) ws.switchDemoOrg(event.target.value);
            else onOrgChange?.(event.target.value);
          }}
        >
          {options.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={2} aria-hidden />
      </span>
    </span>
  );
}
