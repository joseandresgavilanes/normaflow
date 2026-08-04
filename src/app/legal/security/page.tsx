import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Seguridad de la plataforma | NormaFlow",
  description: "Prácticas de seguridad de la plataforma NormaFlow.",
  path: "/legal/security",
});

const PRACTICES: { icon: keyof typeof Ic; t: string; d: string }[] = [
  { icon: "lock",   t: "Cifrado en tránsito y reposo", d: "TLS para todas las comunicaciones. Datos en reposo cifrados en bases gestionadas con aislamiento por organización." },
  { icon: "shield", t: "Autenticación robusta",         d: "Proveedor estándar (Supabase Auth). Políticas de contraseña y MFA configurables según el proyecto." },
  { icon: "audit",  t: "Audit logs",                    d: "Registro de actividad para acciones relevantes en la aplicación, trazable por usuario y fecha." },
  { icon: "capa",   t: "Copias de seguridad",           d: "Backups gestionados por el proveedor de base de datos con políticas de retención configurables." },
];

export default function SecurityPage() {
  return (
    <MarketingLayout>
      <section className="nf-section">
        <div className="nf-container" style={{ maxWidth: 880 }}>
          <span className="nf-eyebrow"><span className="dot"/> Legal · Seguridad</span>
          <h1 className="nf-h-section" style={{ marginTop: 22 }}>
            Seguridad. <span className="nf-grad-text-cool">Por defecto.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            Resumen técnico para equipos de compliance e IT que evalúan NormaFlow.
          </p>

          <div className="nfm-grid-2" style={{ marginTop: 40 }}>
            {PRACTICES.map((p) => {
              const Icon = Ic[p.icon];
              return (
                <article key={p.t} className="nf-tile">
                  <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-primary-active)" }}>
                    <Icon/>
                  </span>
                  <div className="nf-h-4" style={{ marginTop: 14 }}>{p.t}</div>
                  <div style={{ marginTop: 8, color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>{p.d}</div>
                </article>
              );
            })}
          </div>

          <div className="nfm-card" style={{ marginTop: 32, padding: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--nf-accent), var(--nf-accent-2))", color: "var(--nf-text-on-primary)" }}>
              <Ic.mail/>
            </span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="nf-h-4">Informes de vulnerabilidad</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 4 }}>
                Para reportes responsables o preguntas de debida diligencia, escribe a <a href="mailto:security@normaflow.io" style={{ color: "var(--nf-primary-active)" }}>security@normaflow.io</a>.
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
