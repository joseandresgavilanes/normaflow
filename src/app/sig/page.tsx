import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Sistema Integrado de Gestión — ISO 9001 + 14001 + 45001 | NormaFlow",
  description: "Calidad, ambiente y seguridad y salud en el trabajo como un solo sistema: un alcance, una política, auditoría integrada y CAPA única — sin duplicar documentos ni evidencias.",
  path: "/sig",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",   title: "Alcance y política integrados", desc: "Un solo alcance y una sola política para las tres normas, con nota, exclusiones y responsable propios de cada una.", clause: "4.3, 5.2" },
  { icon: "risk",  title: "Riesgos por disciplina e integrados", desc: "Un riesgo puede pertenecer a calidad, ambiente y/o SST a la vez, sin triplicar el registro.", clause: "6.1" },
  { icon: "spread",title: "Documentos y evidencias multirrequisito", desc: "Un mismo documento o evidencia satisface requisitos de varias normas — factor de reutilización medible.", clause: "7.5" },
  { icon: "audit", title: "Auditoría integrada", desc: "Un programa, un checklist, hallazgos y CAPA compartidos entre las tres normas en un solo ciclo.", clause: "9.2" },
  { icon: "capa",  title: "CAPA única", desc: "Una sola acción correctiva resuelve la causa raíz de hallazgos que afectan a más de una norma.", clause: "10.2" },
  { icon: "kpi",   title: "Dashboard SIG", desc: "Cumplimiento por norma y global, grado de integración y factor de reutilización en un solo panel.", clause: "9.1, 9.3" },
];

export default function SIGPage() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 780, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 22 }}>
            {["9001", "14001", "45001"].map((n) => (
              <div key={n} className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 64, height: 64 }}>
                <div>
                  <div className="top" style={{ fontSize: 9 }}>ISO</div>
                  <div className="num" style={{ color: "var(--nf-primary-active)", fontSize: 13 }}>{n}</div>
                </div>
              </div>
            ))}
          </div>
          <span className="nf-eyebrow"><span className="dot"/> Sistema Integrado de Gestión</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Un solo sistema.<br/><span className="nf-grad-text">Tres normas.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            ISO 9001, ISO 14001 e ISO 45001 gestionadas como un único sistema — no tres en paralelo.
            Un alcance, una política, auditoría integrada y CAPA única: la matriz de correspondencia
            demuestra qué se comparte y qué es específico de cada norma, con evidencia real de
            reutilización, no solo teoría.
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
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-primary-active)" }}>
                      <Icon/>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "var(--nf-primary-subtle)", color: "var(--nf-primary-active)", border: "1px solid var(--nf-primary-border)", letterSpacing: "0.06em" }}>
                      Anexo SL {it.clause}
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
            Requiere ISO 9001, ISO 14001 e ISO 45001 activas. No sustituye la certificación —
            es la plataforma que evita que gestiones tres sistemas de papel en paralelo.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
