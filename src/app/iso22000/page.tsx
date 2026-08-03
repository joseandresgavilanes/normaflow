import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 22000:2018 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de la Inocuidad de los Alimentos con NormaFlow: análisis de peligros, PCC y OPRP, monitoreo con desviación automática, y trazabilidad completa proveedor–cliente.",
  path: "/iso22000",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "risk",   title: "Análisis de peligros PRP / OPRP / PCC",     desc: "Peligros biológicos, químicos, físicos y alérgenos evaluados por severidad × probabilidad, con la decisión de control derivada del puntaje resultante.", clause: "8.5" },
  { icon: "warn",   title: "Límites críticos y monitoreo en tiempo real", desc: "Cada lectura fuera de límite abre automáticamente una desviación en la misma operación — sin huecos entre el hallazgo y la respuesta.", clause: "8.5.4, 8.9.2" },
  { icon: "action", title: "Desviaciones, corrección y verificación",    desc: "Flujo encadenado desviación → corrección → verificación, con el estado del expediente actualizándose de forma consistente en cada paso.", clause: "8.9.2, 8.9.3" },
  { icon: "kpi",    title: "Trazabilidad proveedor → cliente",          desc: "Prueba de trazabilidad hacia adelante y hacia atrás sobre la cadena real: proveedor, materia prima, lote, proceso, producto terminado, cliente y distribución.", clause: "8.9.1" },
  { icon: "doc",    title: "Retiro y recall con expansión de lotes",    desc: "Un retiro expande automáticamente los lotes afectados en ambas direcciones de la cadena antes de marcarlos, evitando dejar producto fuera del alcance.", clause: "8.9.5" },
  { icon: "lock",   title: "Comunicación de cadena y emergencias",      desc: "Comunicación documentada con proveedores, clientes y autoridades, y gestión de emergencias e incidentes que afectan la inocuidad.", clause: "5.6, 8.4" },
];

export default function ISO22000Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>22000</div>
              <div className="yr">2018</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 22000:2018</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Inocuidad<br/><span className="nf-grad-text">Alimentaria.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del análisis de peligros a un PCC monitoreado: una lectura fuera de límite abre su
            desviación en la misma transacción, y un retiro expande la cadena real de lotes —
            hacia el proveedor y hacia el cliente — antes de tocar un solo registro.
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
            No sustituye la certificación, no elimina peligros por sí sola y no reemplaza el
            juicio del equipo de inocuidad alimentaria — es la plataforma que deja trazabilidad
            completa de cada decisión: qué peligro, qué evaluación, qué límite y qué lote.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
