import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 27001:2022 — NormaFlow",
  description: "Digitaliza tu SGSI con controles, riesgos y evidencias auditables. Compatible con ISO 27001:2022.",
  path: "/iso27001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; control: string }[] = [
  { icon: "lock",   title: "Gestión de riesgos de SI",    desc: "Metodología MAGERIT o propia. Probabilidad × impacto, tratamiento y controles Anexo A.",  control: "6.1.2" },
  { icon: "shield", title: "Controles Anexo A",           desc: "Los 93 controles ISO 27001:2022 organizados por dominio, con estado y evidencia adjunta.", control: "Anexo A" },
  { icon: "audit",  title: "Auditorías de seguridad",     desc: "Auditorías técnicas y de gestión con hallazgos trazables y acciones correctivas vinculadas.", control: "9.2" },
  { icon: "evid",   title: "Gestión de evidencias",       desc: "Repositorio centralizado con vinculación a controles, auditorías y no conformidades.",     control: "7.5" },
  { icon: "warn",   title: "Gestión de incidentes",       desc: "Registro, análisis y cierre de incidentes de seguridad con notificación automática.",      control: "A.5.24" },
  { icon: "capa",   title: "Continuidad del negocio",     desc: "Plan BCP/DRP documentado, probado y vinculado al SGSI.",                                    control: "A.5.29" },
];

export default function ISO27001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent-2)", fontSize: 14 }}>27001</div>
              <div className="yr">2022</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 27001:2022</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(34px, 5.8vw, 60px)", marginTop: 22 }}>
            Seguridad de la<br/>
            <span className="nf-grad-text-cool">Información.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Digitaliza tu SGSI con controles, riesgos y evidencias auditables. Compatible con la versión 2022 y los 93 controles del Anexo A.
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
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-accent-2)" }}>
                      <Icon/>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "var(--nf-accent-soft)", color: "var(--nf-accent-2)", border: "1px solid var(--nf-primary-border)", letterSpacing: "0.06em" }}>
                      {it.control}
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
