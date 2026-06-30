import Link from "next/link";

const COLS: { h: string; l: [string, string][] }[] = [
  { h: "Producto", l: [["Funcionalidades", "/features"], ["GAP Assessment", "/solutions/gap-assessment"], ["ISO 9001", "/iso9001"], ["ISO 27001", "/iso27001"], ["Precios", "/pricing"]] },
  { h: "Empresa", l: [["Casos", "/cases"], ["Blog", "/blog"], ["Contacto", "/demo"], ["Iniciar sesión", "/login"], ["Crear cuenta", "/signup"]] },
  { h: "Legal", l: [["Privacidad", "/legal/privacy"], ["Términos", "/legal/terms"], ["Seguridad", "/legal/security"]] },
];

export function NfFooter() {
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
              Software de gestión ISO 9001 e ISO 27001. Documentos, riesgos, auditorías, evidencias, CAPA e IA — en una sola plataforma.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>ISO 9001</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>ISO 27001</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", color: "var(--nf-ink-2)" }}>SOC 2 (en proceso)</span>
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.h}>
              <h4>{c.h}</h4>
              <ul>{c.l.map(([t, h]) => <li key={t}><Link href={h}>{t}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="nf-footer-bottom">
          <span>© 2026 NormaFlow · Hecho con cumplimiento en mente.</span>
          <span>Madrid · Barcelona · Lisboa</span>
        </div>
      </div>
    </footer>
  );
}
