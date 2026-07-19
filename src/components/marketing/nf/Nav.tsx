"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Ic } from "./Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const LINKS: [MessageKey | string, string][] = [
  ["marketing.features", "/features"],
  ["ISO 9001", "/iso9001"],
  ["ISO 27001", "/iso27001"],
  ["nav.gap", "/solutions/gap-assessment"],
  ["marketing.pricing", "/pricing"],
  ["marketing.cases", "/cases"],
  ["marketing.blog", "/blog"],
];

export function NfNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const label = (value: MessageKey | string) =>
    value.startsWith("marketing.") || value.startsWith("nav.") ? t(value as MessageKey) : value;

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="nf-nav">
      <div className="nf-container nf-nav-row">
        <Link href="/home" className="nf-logo">
          <span className="nf-logo-mark" aria-hidden />
          NormaFlow
        </Link>
        <nav className="nf-nav-links">
          {LINKS.map(([l, h]) => (
            <Link key={l} href={h} aria-current={pathname === h ? "page" : undefined}>{label(l)}</Link>
          ))}
        </nav>
        <div className="nf-nav-cta">
          <LanguageSwitcher compact />
          <Link className="nf-btn nf-btn--ghost nf-btn--sm" href="/login">{t("marketing.login")}</Link>
          <Link className="nf-btn nf-btn--primary nf-btn--sm" href="/demo">{t("marketing.freeDemo")} <Ic.arrow className="nf-arrow"/></Link>
        </div>
        <button
          type="button"
          className="nf-nav-burger"
          aria-expanded={open}
          aria-controls="nf-nav-drawer"
          aria-label={open ? t("marketing.closeMenu") : t("marketing.openMenu")}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
      </div>
      {open && (
        <>
          <button type="button" className="nf-nav-backdrop" aria-label={t("marketing.closeMenu")} onClick={() => setOpen(false)} />
          <div id="nf-nav-drawer" className="nf-nav-drawer" role="dialog" aria-modal="true" aria-label={t("marketing.navigation")}>
            {LINKS.map(([l, h]) => (
              <Link key={l} href={h} onClick={() => setOpen(false)}>{label(l)}</Link>
            ))}
            <div className="nf-nav-drawer-cta">
              <LanguageSwitcher compact />
              <Link className="nf-btn nf-btn--ghost" href="/login" onClick={() => setOpen(false)}>{t("marketing.login")}</Link>
              <Link className="nf-btn nf-btn--primary" href="/demo" onClick={() => setOpen(false)}>{t("marketing.freeDemo")} <Ic.arrow/></Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
