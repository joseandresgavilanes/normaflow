import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 13485:2016 — NormaFlow",
  description: "Plataforma configurable de gestión de calidad para dispositivos médicos con NormaFlow: DMR/DHF, controles de diseño, trazabilidad de lotes y vigilancia post-comercialización con acceso reforzado y cifrado. No sustituye requisitos regulatorios nacionales.",
  path: "/iso13485",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Expediente maestro y DHF versionados",       desc: "DMR y historial de diseño con inputs, outputs, revisión, verificación y validación atribuidas — aprobación reforzada por reglas de base de datos.", clause: "§4.2, §7.3" },
  { icon: "risk",   title: "Trazabilidad de lote sin datos de paciente", desc: "De materia prima a distribución con referencias opacas de cliente — la minimización de PII se aplica en el formulario y se refuerza con reglas SQL.", clause: "§7.5" },
  { icon: "warn",   title: "Vigilancia con acceso reforzado",            desc: "Quejas, eventos adversos, PMS y acciones de campo detrás de un permiso propio, no del acceso general de calidad — ni CONTRIBUTOR ni VIEWER lo tienen por defecto.", clause: "§8.2, §8.3" },
  { icon: "lock",   title: "Cifrado y retención configurable",           desc: "El texto libre de vigilancia se cifra en reposo, y la retención de quejas y eventos cerrados es un parámetro por organización, no un valor fijo.", clause: "§8.2" },
  { icon: "action", title: "Retiros y acciones de campo",                desc: "Un retiro marca los lotes afectados en la misma operación que lo crea, y solo puede cerrarse con fecha de cierre registrada.", clause: "§8.3" },
  { icon: "kpi",    title: "Requisitos regulatorios configurables",      desc: "Jurisdicción, marco y cláusula por organización — sin imponer un único esquema regulatorio ni certificar cumplimiento nacional.", clause: "§7.2" },
];

export default function ISO13485Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>13485</div>
              <div className="yr">2016</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 13485:2016</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Dispositivos<br/><span className="nf-grad-text">Médicos.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del expediente de diseño a un lote trazable, y de una queja a un evento adverso
            cerrado — con la vigilancia post-comercialización detrás de su propio permiso,
            cifrada en reposo y con retención configurable por tu organización.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            <a className="nf-btn nf-btn--primary" href="/demo">Solicitar demo <Ic.arrow className="nf-arrow"/></a>
            <a className="nf-btn nf-btn--ghost" href="/signup">Crear cuenta · 14 días gratis</a>
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container">
          <div className="nf-grid-3">
            {ITEMS.map((it) => {
              const Icon = Ic[it.icon];
              return (
                <article key={it.title} className="nf-tile">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-accent)" }}>
                      <Icon/>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "var(--nf-accent-soft)", color: "var(--nf-accent)", border: "1px solid rgba(82, 102, 246, 0.25)", letterSpacing: "0.06em" }}>
                      Cláusula {it.clause}
                    </span>
                  </div>
                  <div className="nf-h-4">{it.title}</div>
                  <div style={{ marginTop: 8, color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>{it.desc}</div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container" style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.7 }}>
            NormaFlow es una plataforma de gestión de calidad configurable — no sustituye los
            requisitos regulatorios nacionales aplicables (p. ej. MDR, FDA QSR/QMSR, MDSAP u
            otros), ni certifica cumplimiento. La conformidad regulatoria sigue siendo
            responsabilidad de tu organización y de tus asesores u organismos notificados.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
