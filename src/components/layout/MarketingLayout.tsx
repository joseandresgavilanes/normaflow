"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "/home", label: "Inicio" },
  { href: "/features", label: "Funcionalidades" },
  { href: "/solutions/gap-assessment", label: "GAP" },
  { href: "/iso9001", label: "ISO 9001" },
  { href: "/iso27001", label: "ISO 27001" },
  { href: "/pricing", label: "Precios" },
  { href: "/cases", label: "Casos" },
  { href: "/blog", label: "Blog" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#F7F9FC", minHeight: "100dvh" }}>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}

function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(64);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const close = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [open]);

  return (
    <>
      <header ref={headerRef} className="nf-mkt-header">
        <div className="nf-mkt-header-inner">
          <Link href="/home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, background: "#123C66", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>N</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: "clamp(16px, 4vw, 18px)", color: "#142033", letterSpacing: "-0.5px" }}>NormaFlow</span>
          </Link>
          <nav className="nf-mkt-nav-desktop" aria-label="Principal">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} style={{ padding: "6px 10px", fontSize: 13, color: "#5E6B7A", textDecoration: "none", borderRadius: 6, fontWeight: 400 }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="nf-mkt-header-cta">
            <Link href="/login" style={{ padding: "8px 14px", background: "none", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, color: "#5E6B7A", textDecoration: "none", display: "inline-block", whiteSpace: "nowrap" }}>
              Entrar
            </Link>
            <Link href="/demo" style={{ padding: "8px 16px", background: "#123C66", border: "none", borderRadius: 8, fontSize: 14, color: "#fff", fontWeight: 600, textDecoration: "none", display: "inline-block", whiteSpace: "nowrap" }}>
              Demo / Contacto
            </Link>
          </div>
          <button
            type="button"
            className="nf-mkt-menu-btn"
            aria-expanded={open}
            aria-controls="mkt-nav-drawer"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen(v => !v)}
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </header>
      {open && (
        <>
          <button type="button" className="nf-mkt-backdrop" style={{ top: headerH }} aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div id="mkt-nav-drawer" className="nf-mkt-drawer" style={{ top: headerH }} role="dialog" aria-modal="true" aria-label="Navegación">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="nf-mkt-drawer-actions">
              <Link href="/login" onClick={() => setOpen(false)} style={{ padding: "12px 14px", textAlign: "center", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 15, color: "#5E6B7A", textDecoration: "none", fontWeight: 500 }}>
                Entrar
              </Link>
              <Link href="/demo" onClick={() => setOpen(false)} style={{ padding: "12px 14px", textAlign: "center", background: "#123C66", borderRadius: 8, fontSize: 15, color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                Demo / Contacto
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MarketingFooter() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Producto",
      links: [
        { label: "Funcionalidades", href: "/features" },
        { label: "ISO 9001", href: "/iso9001" },
        { label: "ISO 27001", href: "/iso27001" },
        { label: "Precios", href: "/pricing" },
        { label: "GAP Assessment", href: "/solutions/gap-assessment" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { label: "Casos de éxito", href: "/cases" },
        { label: "Blog", href: "/blog" },
        { label: "Demo / Contacto", href: "/demo" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacidad", href: "/legal/privacy" },
        { label: "Términos", href: "/legal/terms" },
        { label: "Seguridad", href: "/legal/security" },
      ],
    },
  ];

  return (
    <footer style={{ background: "#142033", padding: "clamp(32px, 8vw, 48px) 0 28px" }}>
      <div className="nf-mkt-container" style={{ maxWidth: 1100 }}>
        <div className="nf-mkt-footer-grid">
          <div className="nf-mkt-footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, background: "#2E8B57", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>N</span>
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>NormaFlow</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0 }}>
              Software B2B para la gestión, cumplimiento y mejora continua de sistemas ISO 9001 e ISO 27001.
            </p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>{col.title}</div>
              {col.links.map(l => (
                <Link key={l.href} href={l.href} style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.55)", padding: "4px 0", textDecoration: "none" }}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>© 2026 NormaFlow. Todos los derechos reservados.</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Hecho en España</span>
        </div>
      </div>
    </footer>
  );
}
