import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO/IEC 20000-1:2018 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de Servicios de TI con NormaFlow: catálogo, SLA, incidentes de servicio, problemas, cambios y CMDB — sin confundirlos con incidentes de seguridad, de IA o laborales.",
  path: "/iso20000",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Catálogo, SLA y OLA",                    desc: "Portafolio de servicios con propietario, acuerdos de nivel de servicio y acuerdos operativos con tiempos de respuesta y resolución medibles.", clause: "8.2, 8.3" },
  { icon: "warn",   title: "Incidentes de servicio, no de seguridad", desc: "ITSMIncident sigue su propio workflow NEW→…→CLOSED, con cumplimiento de SLA calculado por lectura — nunca se confunde con un SecurityIncident.", clause: "8.6" },
  { icon: "action", title: "Problemas y errores conocidos",          desc: "Un problema puede convertirse en error conocido con workaround documentado, en la misma operación que lo registra.", clause: "8.6" },
  { icon: "kpi",    title: "Cambios, releases y despliegues",        desc: "Todo cambio exige evaluación y aprobación atribuida antes de programarse o implementarse — reforzado por reglas de base de datos.", clause: "8.5" },
  { icon: "risk",   title: "CMDB con relaciones entre CI",           desc: "Elementos de configuración relacionados (depende de, corre sobre, se conecta a…) sin permitir que un CI se relacione consigo mismo.", clause: "8.7" },
  { icon: "lock",   title: "Integración sin fusionar workflows",     desc: "Un incidente de servicio puede vincularse a un incidente de seguridad, de IA o laboral para trazabilidad — cada dominio conserva su propio estado.", clause: "8.6" },
];

export default function ISO20000Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO/IEC</div>
              <div className="num" style={{ color: "var(--nf-primary-active)", fontSize: 15 }}>20000</div>
              <div className="yr">2018</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO/IEC 20000-1:2018</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Gestión de<br/><span className="nf-grad-text">Servicios TI.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del catálogo de servicios a un incidente cerrado con SLA verificado: cada dominio de
            incidente —servicio, seguridad, IA, laboral— conserva su propio workflow, y puedes
            relacionarlos sin fusionarlos cuando comparten una misma causa.
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
            No sustituye la certificación ni el juicio del equipo de servicio — es la plataforma
            que deja trazabilidad completa de cada incidente, cambio y acuerdo, distinguiendo
            siempre un incidente de servicio de uno de seguridad, de IA o laboral.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
