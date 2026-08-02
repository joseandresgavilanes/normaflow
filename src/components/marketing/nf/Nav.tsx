"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Ic } from "./Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type NavLink = [MessageKey | string, string];

const PRODUCT_LINKS: NavLink[] = [
  ["marketing.features", "/features"],
  ["nav.gap", "/solutions/gap-assessment"],
];

const STANDARD_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Fundamentos",
    links: [["ISO 9001", "/iso9001"], ["ISO 14001", "/iso14001"], ["ISO 45001", "/iso45001"], ["Sistema Integrado", "/sig"]],
  },
  {
    title: "Resiliencia y tecnología",
    links: [["ISO 22301", "/iso22301"], ["ISO/IEC 42001", "/iso42001"], ["ISO/IEC 20000", "/iso20000"], ["ISO 27001", "/iso27001"]],
  },
  {
    title: "Especializadas",
    links: [["ISO 37301", "/iso37301"], ["ISO 37001", "/iso37001"], ["ISO 50001", "/iso50001"], ["ISO 22000", "/iso22000"], ["ISO 13485", "/iso13485"]],
  },
];

const RESOURCE_LINKS: NavLink[] = [
  ["marketing.cases", "/cases"],
  ["marketing.blog", "/blog"],
  ["marketing.pricing", "/pricing"],
];

export function NfNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<"product" | "standards" | "resources" | null>(null);
  const { t, tx } = useI18n();
  const label = (value: MessageKey | string) => {
    if (value.startsWith("marketing.") || value.startsWith("nav.")) return t(value as MessageKey);
    return tx(value);
  };
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setOpen(false);
    setMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menu]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const closeAll = () => { setOpen(false); setMenu(null); };
  const toggleMenu = (next: "product" | "standards" | "resources") => setMenu((current) => current === next ? null : next);

  return (
    <header className="nf-nav">
      <div className="nf-container nf-nav-row">
        <Link href="/home" className="nf-logo" onClick={closeAll}>
          <span className="nf-logo-mark" aria-hidden />
          NormaFlow
        </Link>

        <nav className="nf-nav-links" aria-label={t("marketing.navigation")}>
          <div className="nf-nav-menu">
            <button type="button" className={`nf-nav-trigger ${menu === "product" ? "is-open" : ""}`} aria-expanded={menu === "product"} onClick={() => toggleMenu("product")}>
              {tx("Producto")} <span className="nf-nav-chevron" aria-hidden />
            </button>
            {menu === "product" && (
              <div className="nf-nav-popover nf-nav-popover--compact">
                {PRODUCT_LINKS.map(([text, href]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={closeAll}>{label(text)}<span className="nf-nav-external-arrow" aria-hidden>↗</span></Link>)}
              </div>
            )}
          </div>

          <div className="nf-nav-menu">
            <button type="button" className={`nf-nav-trigger ${menu === "standards" ? "is-open" : ""}`} aria-expanded={menu === "standards"} onClick={() => toggleMenu("standards")}>
              {tx("Normas")} <span className="nf-nav-chevron" aria-hidden />
            </button>
            {menu === "standards" && (
              <div className="nf-nav-popover nf-nav-popover--wide">
                <div className="nf-nav-popover-intro">
                  <span className="nf-nav-popover-kicker">{tx("Sistemas de gestión")}</span>
                  <strong>{tx("Una plataforma para cada estándar.")}</strong>
                  <span>{tx("Explora el enfoque que necesita tu organización.")}</span>
                </div>
                <div className="nf-nav-standard-grid">
                  {STANDARD_GROUPS.map((group) => (
                    <div key={group.title} className="nf-nav-standard-group">
                      <span className="nf-nav-group-title">{group.title}</span>
                      {group.links.map(([text, href]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={closeAll}>{label(text)}</Link>)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="nf-nav-menu">
            <button type="button" className={`nf-nav-trigger ${menu === "resources" ? "is-open" : ""}`} aria-expanded={menu === "resources"} onClick={() => toggleMenu("resources")}>
              {tx("Recursos")} <span className="nf-nav-chevron" aria-hidden />
            </button>
            {menu === "resources" && (
              <div className="nf-nav-popover nf-nav-popover--compact">
                {RESOURCE_LINKS.map(([text, href]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={closeAll}>{label(text)}<span className="nf-nav-external-arrow" aria-hidden>↗</span></Link>)}
              </div>
            )}
          </div>
        </nav>

        <div className="nf-nav-cta">
          <LanguageSwitcher compact />
          <Link className="nf-btn nf-btn--ghost nf-btn--sm" href="/login">{t("marketing.login")}</Link>
          <Link className="nf-btn nf-btn--primary nf-btn--sm" href="/demo">{t("marketing.freeDemo")} <Ic.arrow className="nf-arrow" /></Link>
        </div>

        <button type="button" className="nf-nav-burger" aria-expanded={open} aria-controls="nf-nav-drawer" aria-label={open ? t("marketing.closeMenu") : t("marketing.openMenu")} onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
      </div>

      {menu && <button type="button" className="nf-nav-menu-backdrop" aria-label={t("marketing.closeMenu")} onClick={() => setMenu(null)} />}

      {open && (
        <>
          <button type="button" className="nf-nav-backdrop" aria-label={t("marketing.closeMenu")} onClick={closeAll} />
          <div id="nf-nav-drawer" className="nf-nav-drawer" role="dialog" aria-modal="true" aria-label={t("marketing.navigation")}>
            <MobileGroup title={tx("Producto")} links={PRODUCT_LINKS} label={label} onNavigate={closeAll} />
            <div className="nf-nav-mobile-group">
              <span className="nf-nav-mobile-title">{tx("Normas")}</span>
              <div className="nf-nav-mobile-standards">
                {STANDARD_GROUPS.map((group) => <div key={group.title}><span className="nf-nav-group-title">{group.title}</span>{group.links.map(([text, href]) => <Link key={href} href={href} onClick={closeAll}>{label(text)}</Link>)}</div>)}
              </div>
            </div>
            <MobileGroup title={tx("Recursos")} links={RESOURCE_LINKS} label={label} onNavigate={closeAll} />
            <div className="nf-nav-drawer-cta">
              <LanguageSwitcher compact />
              <Link className="nf-btn nf-btn--ghost" href="/login" onClick={closeAll}>{t("marketing.login")}</Link>
              <Link className="nf-btn nf-btn--primary" href="/demo" onClick={closeAll}>{t("marketing.freeDemo")} <Ic.arrow /></Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function MobileGroup({ title, links, label, onNavigate }: { title: string; links: NavLink[]; label: (value: MessageKey | string) => string; onNavigate: () => void }) {
  return <div className="nf-nav-mobile-group"><span className="nf-nav-mobile-title">{title}</span>{links.map(([text, href]) => <Link key={href} href={href} onClick={onNavigate}>{label(text)}</Link>)}</div>;
}
