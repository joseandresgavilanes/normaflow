import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 37001:2016 — NormaFlow",
  description: "Sistema de Gestión Antisoborno con NormaFlow: riesgo de soborno, debida diligencia de terceros, beneficiario final, regalos y hospitalidad, y aprobaciones de alto riesgo con segregación de funciones — extensión configurable de tu programa de compliance.",
  path: "/iso37001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "risk",   title: "Mapa de riesgo de soborno",                desc: "Probabilidad × impacto con un uplift automático por país, sector, funcionario público y terceros — sin inventar una segunda matriz de riesgo.", clause: "§4.5" },
  { icon: "doc",    title: "Debida diligencia con revisión reforzada",  desc: "Terceros de riesgo alto, PEP o con funcionario público pasan obligatoriamente por revisión reforzada antes de aprobarse — la plataforma lo exige, no solo lo sugiere.", clause: "§8.2" },
  { icon: "warn",   title: "Beneficiario final con acceso reforzado",   desc: "Nombre legal y condición PEP de terceros reales detrás de un permiso propio, no del acceso general de compliance — ni CONTRIBUTOR ni VIEWER lo tienen por defecto.", clause: "Anexo A.4.5" },
  { icon: "action", title: "Regalos y hospitalidad sin atajos",         desc: "Por encima del umbral de política o con funcionario público, la decisión de compliance no se puede saltar — reforzado por reglas de base de datos.", clause: "§8.7" },
  { icon: "lock",   title: "Alto riesgo con segregación de funciones",  desc: "Quien solicita una operación de alto riesgo nunca puede aprobarla — la regla vive en el dominio, no solo en la interfaz.", clause: "§5.3.3" },
  { icon: "kpi",    title: "Extiende tu compliance, no lo duplica",     desc: "Reutiliza obligaciones, canal de denuncias e investigaciones del sistema de compliance (ISO 37301) — el soborno se tipifica, no se reinventa.", clause: "§8.9, §8.10" },
];

export default function ISO37001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>37001</div>
              <div className="yr">2016</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 37001:2016</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Gestión<br/><span className="nf-grad-text">Antisoborno.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            De un tercero de alto riesgo a una debida diligencia reforzada, y de un regalo por
            encima del umbral a una decisión de compliance que no se puede saltar — con el
            beneficiario final detrás de su propio permiso, no del acceso general.
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
            NormaFlow es una plataforma de gestión configurable que extiende tu sistema de
            compliance — no sustituye el juicio de tu equipo de cumplimiento ni certifica la
            ausencia de soborno. Es la plataforma que deja trazabilidad completa de cada
            decisión: qué tercero, qué debida diligencia, qué aprobación y quién la firmó.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
