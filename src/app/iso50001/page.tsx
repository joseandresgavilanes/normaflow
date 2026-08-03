import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 50001:2018 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de la Energía con NormaFlow: revisión energética, usos significativos, líneas base y EnPI con fórmulas versionadas, y verificación de ahorros.",
  path: "/iso50001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Revisión energética y usos significativos", desc: "Fuentes, usos y consumos con criterios de significancia configurables — participación en el consumo y potencial de mejora.", clause: "6.3" },
  { icon: "kpi",    title: "Líneas base y EnPI versionados",            desc: "Cada cambio de fórmula crea una nueva versión; la anterior queda supersedida, nunca sobrescrita — trazabilidad completa del cálculo.", clause: "6.5, 9.1" },
  { icon: "risk",   title: "Medidores, lecturas y variables relevantes", desc: "Consumo, coste y emisiones calculados automáticamente por lectura, con normalización por variable relevante o factor estático.", clause: "6.6, 9.1" },
  { icon: "action", title: "Oportunidades y planes de acción",          desc: "De la oportunidad identificada al plan de acción con responsable, avance y verificación de ahorro por un formulismo configurable (tipo IPMVP).", clause: "8.1, 10.2" },
  { icon: "warn",   title: "Compras y diseño energéticamente eficientes", desc: "Evaluación de proveedores de energía por criterios ponderados, y revisión del desempeño energético en el diseño de instalaciones y equipos.", clause: "8.2, 8.3" },
  { icon: "lock",   title: "Fórmulas versionadas y configurables",      desc: "Consumo, intensidad, desviación, ahorro absoluto y normalizado, coste y emisiones — cada cálculo queda con su versión de fórmula registrada.", clause: "6.5" },
];

export default function ISO50001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>50001</div>
              <div className="yr">2018</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 50001:2018</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Gestión de<br/><span className="nf-grad-text">la Energía.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            De la revisión energética a un indicador de desempeño con fórmula versionada:
            líneas base que nunca se sobrescriben, ahorro verificado con un método configurable,
            y el coste y las emisiones de cada lectura calculados automáticamente con el factor
            de tu propia fuente de energía.
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
            No sustituye la certificación, no garantiza un ahorro energético concreto y no
            reemplaza la auditoría energética de un profesional — es la plataforma que deja
            trazabilidad completa de cómo se calculó cada cifra: qué fórmula, en qué versión y
            con qué datos.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
