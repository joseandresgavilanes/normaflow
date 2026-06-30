import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";

export const metadata = {
  title: "ISO 9001:2015 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de la Calidad con NormaFlow.",
};

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Contexto y liderazgo",      desc: "Gestiona partes interesadas, alcance del SGC y política de calidad.",                clause: "4, 5" },
  { icon: "action", title: "Planificación y apoyo",      desc: "Objetivos de calidad, recursos, competencias y control documental.",                 clause: "6, 7" },
  { icon: "audit",  title: "Control operacional",        desc: "Documenta procesos, instrucciones y controles de calidad de producto/servicio.",     clause: "8" },
  { icon: "kpi",    title: "Evaluación del desempeño",   desc: "KPIs, satisfacción del cliente, auditorías internas y revisión por dirección.",       clause: "9" },
  { icon: "capa",   title: "Mejora continua",            desc: "CAPA, no conformidades, análisis de causa raíz y planes de acción.",                  clause: "10" },
  { icon: "ai",     title: "IA para ISO 9001",           desc: "Generación de procedimientos, análisis de GAP y sugerencias de mejora con IA.",        clause: "Todos" },
];

export default function ISO9001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 16 }}>9001</div>
              <div className="yr">2015</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 9001:2015</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Sistema de Gestión<br/>de la <span className="nf-grad-text">Calidad.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Implementa, mantén y mejora tu SGC con trazabilidad total, evidencias siempre disponibles y auditorías sin estrés.
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
    </MarketingLayout>
  );
}
