"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Ic } from "./Icons";

const LINKS: [string, string][] = [
  ["Funcionalidades", "/features"],
  ["ISO 9001", "/iso9001"],
  ["ISO 27001", "/iso27001"],
  ["Precios", "/pricing"],
  ["Casos", "/cases"],
  ["Blog", "/blog"],
];

export function NfNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            <Link key={l} href={h} aria-current={pathname === h ? "page" : undefined}>{l}</Link>
          ))}
        </nav>
        <div className="nf-nav-cta">
          <Link className="nf-btn nf-btn--ghost nf-btn--sm" href="/login">Entrar</Link>
          <Link className="nf-btn nf-btn--primary nf-btn--sm" href="/demo">Demo gratuita <Ic.arrow className="nf-arrow"/></Link>
        </div>
        <button
          type="button"
          className="nf-nav-burger"
          aria-expanded={open}
          aria-controls="nf-nav-drawer"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
      </div>
      {open && (
        <>
          <button type="button" className="nf-nav-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div id="nf-nav-drawer" className="nf-nav-drawer" role="dialog" aria-modal="true" aria-label="Navegación">
            {LINKS.map(([l, h]) => (
              <Link key={l} href={h} onClick={() => setOpen(false)}>{l}</Link>
            ))}
            <div className="nf-nav-drawer-cta">
              <Link className="nf-btn nf-btn--ghost" href="/login" onClick={() => setOpen(false)}>Entrar</Link>
              <Link className="nf-btn nf-btn--primary" href="/demo" onClick={() => setOpen(false)}>Demo gratuita <Ic.arrow/></Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
