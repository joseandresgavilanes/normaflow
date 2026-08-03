"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const COLS: { h: MessageKey; l: [MessageKey | string, string][] }[] = [
  { h: "marketing.product", l: [["marketing.features", "/features"], ["nav.gap", "/solutions/gap-assessment"], ["ISO 9001", "/iso9001"], ["ISO 27001", "/iso27001"], ["ISO 14001", "/iso14001"], ["ISO 45001", "/iso45001"], ["Sistema Integrado", "/sig"], ["ISO 22301", "/iso22301"], ["ISO/IEC 42001", "/iso42001"], ["ISO 37301", "/iso37301"], ["ISO 50001", "/iso50001"], ["ISO 22000", "/iso22000"], ["ISO/IEC 20000", "/iso20000"], ["ISO 13485", "/iso13485"], ["ISO 37001", "/iso37001"], ["marketing.pricing", "/pricing"]] },
  { h: "marketing.company", l: [["marketing.cases", "/cases"], ["marketing.blog", "/blog"], ["marketing.contact", "/demo"], ["marketing.signIn", "/login"], ["marketing.createAccount", "/signup"]] },
  { h: "marketing.legal", l: [["marketing.privacy", "/legal/privacy"], ["marketing.terms", "/legal/terms"], ["marketing.security", "/legal/security"]] },
];

export function NfFooter() {
  const { t, tx } = useI18n();

  return (
    <footer className="nf-footer">
      <div className="nf-container">
        <div className="nf-footer-grid">
          <div>
            <Link href="/home" className="nf-logo">
              <span className="nf-logo-mark" aria-hidden />
              NormaFlow
            </Link>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 14, maxWidth: 320, lineHeight: 1.6 }}>
              {t("marketing.footerCopy")}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>ISO 9001</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>ISO 27001</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>{t("marketing.soc2")}</span>
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.h}>
              <h4>{t(c.h)}</h4>
              <ul>{c.l.map(([label, href]) => <li key={label}><Link href={href}>{label.startsWith("marketing.") || label.startsWith("nav.") ? t(label as MessageKey) : tx(label)}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        {/* Un solo sitio para el aviso: NfShell lo monta en las 25 rutas
            públicas. Antes lo llevaban 9 de 13 páginas de norma y ninguna de
            /home, /features o /cases. */}
        <p className="nf-footer-disclaimer">
          NormaFlow es una herramienta de gestión. No emite certificados, no
          sustituye una auditoría de certificación ni constituye asesoría legal.
          La certificación la concede un organismo acreditado independiente.
        </p>
        <div className="nf-footer-bottom">
          <span>{t("marketing.footerBottom")}</span>
          <span>Madrid · Barcelona · Lisboa</span>
        </div>
      </div>
    </footer>
  );
}
