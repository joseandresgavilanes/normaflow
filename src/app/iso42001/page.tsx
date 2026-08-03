import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO/IEC 42001:2023 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de Inteligencia Artificial con NormaFlow: inventario, evaluación de impacto, datos, modelos y una regla humana que ninguna salida de IA puede saltarse.",
  path: "/iso42001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Inventario y evaluación de impacto",       desc: "Cada sistema de IA clasificado por criticidad y riesgo, con evaluación de impacto en siete dimensiones antes de aprobarse.", clause: "6.1.4, A.5" },
  { icon: "risk",   title: "Datos: procedencia, calidad y sesgo",       desc: "Cada dataset con su fuente, cadena de linaje auditable y revisión de sesgo obligatoria antes de usarse para entrenar.", clause: "A.7" },
  { icon: "action", title: "Modelos con aprobación humana",             desc: "Ningún modelo llega a producción sin evaluación superada y aprobación de una persona — bloqueado también a nivel de base de datos.", clause: "A.6.2" },
  { icon: "lock",   title: "La regla humana",                          desc: "DRAFT → revisión humana → aprobado o rechazado. Ninguna salida de IA se convierte en registro oficial sin que una persona lo decida — nunca la propia IA.", clause: "A.9.2" },
  { icon: "warn",   title: "Incidentes y supervisión",                 desc: "Controles de supervisión humana verificables, e investigación de incidentes de IA en ocho etapas obligatorias.", clause: "A.9.2, A.10.4" },
  { icon: "kpi",    title: "Seguridad de las salidas de IA",           desc: "Detección de secretos y datos personales, heurística de inyección de prompt y presupuesto mensual de uso — sobre el propio asistente de IA del producto.", clause: "A.10" },
];

export default function ISO42001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO/IEC</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>42001</div>
              <div className="yr">2023</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO/IEC 42001:2023</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Gestión de<br/><span className="nf-grad-text">Inteligencia Artificial.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del inventario de sistemas de IA a la aprobación humana de cada modelo y cada salida generada:
            evaluación de impacto en siete dimensiones, procedencia y sesgo de datos, supervisión humana
            verificable y una regla que ninguna IA puede saltarse — ningún texto generado se convierte en
            registro oficial sin que una persona lo decida.
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
            No sustituye la certificación ni garantiza el cumplimiento normativo de tus sistemas de IA
            por sí sola — es la plataforma que hace imposible que una salida de IA se convierta en
            decisión oficial sin que una persona la revise.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
