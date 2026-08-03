import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 45001:2018 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de Seguridad y Salud en el Trabajo con NormaFlow: peligros, riesgos, incidentes y vigilancia de la salud protegida.",
  path: "/iso45001",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Contexto y participación de trabajadores", desc: "Partes interesadas, consulta y participación — disponible sin necesidad de un sistema integrado.", clause: "4, 5.4" },
  { icon: "risk",   title: "Peligros y riesgos (W.T. Fine)",           desc: "Matriz de peligros, metodología de evaluación versionada, jerarquía de controles y riesgos residuales.", clause: "6.1.2" },
  { icon: "shield", title: "Requisitos legales y cumplimiento",         desc: "Obligaciones legales con evaluación de cumplimiento programada.", clause: "6.1.3, 9.1.2" },
  { icon: "action", title: "Control operacional",                      desc: "Permisos de trabajo, EPP, contratistas y gestión del cambio, con workflows aplicados por base de datos, no solo por la interfaz.", clause: "8.1, 8.1.4" },
  { icon: "warn",   title: "Incidentes con cierre condicionado",        desc: "Investigación en ocho etapas obligatorias — reportado, causa raíz, acciones, verificación de eficacia — sin saltos ni atajos.", clause: "10.2" },
  { icon: "lock",   title: "Vigilancia de la salud protegida",          desc: "Datos médicos cifrados, con permiso reforzado independiente del resto del módulo: nunca visibles para roles operativos por defecto.", clause: "7.1.2, privacidad" },
];

export default function ISO45001Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 16 }}>45001</div>
              <div className="yr">2018</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 45001:2018</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Seguridad y Salud<br/><span className="nf-grad-text">en el Trabajo.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Peligros, riesgos y jerarquía de controles; incidentes con investigación en ocho etapas sin atajos; vigilancia de la salud cifrada y con permiso reforzado — trazabilidad total, auditoría cruzada de tenant.
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
