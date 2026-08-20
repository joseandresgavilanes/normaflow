"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Eye, Menu, Search } from "lucide-react";
import ProfileMenu from "@/components/layout/ProfileMenu";
import QuickCreateMenu from "@/components/layout/QuickCreateMenu";
import { setPrivateMode as setPrivateModePreference } from "@/lib/actions/preferences";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const PAGE_TITLE_KEYS: Record<string, MessageKey> = {
  "/app/dashboard": "nav.home",
  "/app/setup": "nav.setup",
  "/app/gap": "nav.gap",
  "/app/documents": "nav.documents",
  "/app/records": "nav.records",
  "/app/training": "nav.training",
  "/app/changes": "nav.changes",
  "/app/processes": "nav.processes",
  "/app/risks": "nav.risks",
  "/app/suppliers": "nav.suppliers",
  "/app/audit-program": "nav.auditProgram",
  "/app/audits": "nav.audits",
  "/app/management-review": "nav.managementReview",
  "/app/nonconformities": "nav.nonconformities",
  "/app/actions": "nav.actions",
  "/app/indicators": "nav.indicators",
  "/app/evidence": "nav.evidence",
  "/app/integrations": "nav.integrations",
  "/app/reporting": "nav.reporting",
  "/app/activity": "nav.activity",
  "/app/notifications": "nav.notifications",
  "/app/billing": "nav.billing",
  "/app/settings": "nav.settings",
  "/app/info/positions": "nav.positions",
  "/app/info/personnel": "nav.personnel",
  "/app/catalogs/locations": "nav.locations",
  "/app/catalogs/retention": "nav.retention",
  "/app/catalogs/disposition": "nav.disposition",
  "/app/catalogs/archive-method": "nav.archiveMethod",
  "/app/catalogs/record-type": "nav.recordType",
  "/app/settings/organization": "nav.orgSettings",
  "/app/settings/users": "nav.usersRoles",
  "/app/settings/groups": "nav.groupsPermissions",
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
  const { t } = useI18n();
  /* El estado inicial se lee de la clase que ya pintó el servidor desde la
     cookie, igual que hace `ThemeSwitcher` con `data-theme`: así el conmutador
     aparece en la posición correcta sin arrastrar la cookie por el layout. */
  const [privateMode, setPrivateMode] = useState(false);
  useEffect(() => {
    setPrivateMode(document.body.classList.contains("nf-private-mode"));
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const displayName = ws?.state.session.name ?? userName;
  const unread = ws?.state.notifications.filter((n) => !n.read).length ?? 0;
  const pageTitle = PAGE_TITLE_KEYS[pathname] ? t(PAGE_TITLE_KEYS[pathname]) : "NormaFlow";

  function togglePrivateMode() {
    const next = !privateMode;
    setPrivateMode(next);
    // La clase se aplica aquí, no en un efecto: el efecto de limpieza la
    // quitaba al desmontar y el modo se perdía en cada navegación.
    document.body.classList.toggle("nf-private-mode", next);
    void setPrivateModePreference(next);
  }

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <header className="nf-topbar">
      {onMenuClick && (
        <button
          type="button"
          className="nf-topbar-menu"
          onClick={onMenuClick}
          aria-label={t("topbar.openNavigation")}
        >
          <Menu size={20} strokeWidth={2} aria-hidden />
        </button>
      )}

      <div className="nf-topbar-search">
        <Search size={16} strokeWidth={2} className="nf-topbar-search-icon" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          className="nf-topbar-search-input"
          placeholder={t("topbar.searchIn", { page: pageTitle.toLowerCase() })}
          aria-label={t("topbar.search")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push("/app/activity");
            }
          }}
        />
        <span className="nf-topbar-search-kbd">⌘ K</span>
      </div>

      {/* El tema y el idioma se han ido al menú de la cuenta: eran dos
          conmutadores permanentes para ajustes que se tocan una vez, y dejaban
          la barra sin sitio para lo que sí se usa a diario. */}
      <div className="nf-topbar-actions">
        <QuickCreateMenu />
        <button
          type="button"
          className={`nf-topbar-icon-btn${privateMode ? " nf-topbar-icon-btn--active" : ""}`}
          title={t("topbar.privateMode")}
          aria-label={t("topbar.privateMode")}
          aria-pressed={privateMode}
          onClick={togglePrivateMode}
        >
          <Eye size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <Link
          href="/app/notifications"
          className="nf-topbar-icon-btn"
          title={t("common.notifications")}
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
                background: "var(--nf-primary)",
                border: "2px solid var(--bg)",
              }}
            />
          )}
        </Link>
        <ProfileMenu
          userName={displayName}
          email={ws?.state.session.email}
          roleLabel={roleLabel}
          organizationName={ws?.state.session.orgName}
        />
      </div>
    </header>
  );
}
