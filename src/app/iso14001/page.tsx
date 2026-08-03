import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 14001:2015 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión Ambiental con NormaFlow: aspectos, impactos, cumplimiento legal y mejora continua.",
  path: "/iso14001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Contexto y partes interesadas",  desc: "Alcance, partes interesadas y política ambiental — disponible sin necesidad de un sistema integrado.", clause: "4" },
  { icon: "risk",   title: "Aspectos e impactos",             desc: "Matriz de aspectos, condiciones normales/anormales/emergencia, ciclo de vida y metodología de significancia versionada.", clause: "6.1.2" },
  { icon: "shield", title: "Cumplimiento legal",               desc: "Obligaciones legales y otras obligaciones, con evaluación de cumplimiento y revisión programada.", clause: "6.1.3, 9.1.2" },
  { icon: "kpi",    title: "Objetivos, programas e indicadores", desc: "Objetivos ambientales medibles, programas de acción y consumos de agua, energía, emisiones y residuos.", clause: "6.2, 9.1.1" },
  { icon: "warn",   title: "Emergencias y biodiversidad",      desc: "Escenarios de emergencia con simulacros y registro configurable de biodiversidad: sitio, ecosistema y cadencia propia.", clause: "8.2, 6.1.2" },
  { icon: "capa",   title: "Auditoría y mejora continua",      desc: "Auditorías internas, revisión por la dirección, no conformidades y CAPA — el mismo motor que ISO 9001.", clause: "9, 10" },
];

export default function ISO14001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 16 }}>14001</div>
              <div className="yr">2015</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 14001:2015</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Sistema de Gestión<br/><span className="nf-grad-text">Ambiental.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Aspectos, impactos y significancia versionada; cumplimiento legal con evaluaciones y revisiones programadas; objetivos, indicadores y biodiversidad — todo con trazabilidad y auditoría cruzada de tenant.
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
