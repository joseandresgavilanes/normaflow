"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useI18n } from "@/context/I18nProvider";

/**
 * Menú de la cuenta.
 *
 * El tema y el idioma vivían sueltos en la barra superior, ocupando sitio
 * permanente para dos ajustes que se tocan una vez. Aquí siguen a un clic —no
 * hay que entrar en ajustes para cambiar de tema— pero dejan de competir con
 * la búsqueda y las acciones de creación.
 */
export default function ProfileMenu({ userName, email, roleLabel, organizationName }: {
  userName: string;
  email?: string;
  roleLabel: string;
  organizationName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="nf-profile-menu" ref={rootRef}>
      <button
        type="button"
        className="nf-profile-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("common.account")}
        data-nf-no-action-icon
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={userName} size={32} />
      </button>

      {open && (
        <div className="nf-profile-menu__panel" role="menu" aria-label={t("common.account")}>
          <div className="nf-profile-menu__identity">
            <Avatar name={userName} size={40} />
            <div className="nf-profile-menu__identity-text">
              <span className="nf-profile-menu__name">{userName}</span>
              {email && <span className="nf-profile-menu__email" title={email}>{email}</span>}
              <span className="nf-profile-menu__role">
                {roleLabel.replaceAll("_", " ")}
                {organizationName ? ` · ${organizationName}` : ""}
              </span>
            </div>
          </div>

          <div className="nf-profile-menu__section">
            <span className="nf-profile-menu__section-label">{t("theme.label")}</span>
            <ThemeSwitcher />
          </div>

          <div className="nf-profile-menu__section">
            <span className="nf-profile-menu__section-label">{t("common.language")}</span>
            <LanguageSwitcher />
          </div>

          <div className="nf-profile-menu__actions">
            <Link
              href="/app/settings"
              role="menuitem"
              className="nf-profile-menu__item"
              onClick={() => setOpen(false)}
            >
              <Settings size={15} strokeWidth={2} aria-hidden />
              {t("nav.settings")}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="nf-profile-menu__item nf-profile-menu__item--danger"
              data-nf-no-action-icon
              onClick={() => void logout()}
            >
              <LogOut size={15} strokeWidth={2} aria-hidden />
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
