import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 22301:2019 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de Continuidad del Negocio con NormaFlow: BIA, MTPD/RTO/RPO, estrategias, planes, equipos de crisis y simulacros.",
  path: "/iso22301",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Análisis de Impacto en el Negocio (BIA)",   desc: "Actividades críticas, productos y servicios prioritarios con MTPD, RTO, RPO y nivel mínimo aceptable, priorizados automáticamente por impacto y urgencia.", clause: "8.2" },
  { icon: "risk",   title: "Dependencias y recursos",                   desc: "Personas, instalaciones, tecnología, datos y proveedores — con puntos únicos de fallo señalados y recursos mínimos frente a los normales.", clause: "8.2" },
  { icon: "action", title: "Estrategias y procedimientos",               desc: "Estrategias de recuperación con su capacidad real de RTO/RPO, aprobación y procedimientos de recuperación paso a paso.", clause: "8.3" },
  { icon: "audit",  title: "Planes con versionado y aprobación",         desc: "Cada nueva versión de un plan vuelve a borrador hasta su aprobación — sin planes desactualizados circulando como vigentes.", clause: "8.4" },
  { icon: "warn",   title: "Equipos de crisis y activación real",        desc: "Cascada de contactos, árbol de comunicación jerárquico y activación del plan ante una interrupción real, con cierre y lecciones aprendidas.", clause: "8.4" },
  { icon: "kpi",    title: "Simulacros y grado de preparación",          desc: "Ejercicios con objetivo de RTO/RPO, resultado y acciones de mejora — panel único con el grado de preparación del sistema.", clause: "8.5" },
];

export default function ISO22301Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-primary-active)", fontSize: 16 }}>22301</div>
              <div className="yr">2019</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 22301:2019</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Continuidad<br/><span className="nf-grad-text">del negocio.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del análisis de impacto a la activación real del plan: MTPD, RTO, RPO y nivel mínimo aceptable
            por actividad, estrategias con capacidad de recuperación medible, equipos de crisis con
            cascada de comunicación y simulacros con seguimiento de mejora — trazabilidad completa,
            auditoría cruzada de tenant.
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
            No sustituye la certificación ni garantiza la continuidad operativa por sí sola —
            es la plataforma que evita que tu plan de continuidad viva desactualizado en un PDF.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
