import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Funcionalidades del software ISO | NormaFlow",
  description: "Documentos, riesgos, auditorías, CAPA, indicadores, evidencias y asistente IA para gestionar tu sistema ISO.",
  path: "/features",
});

const FEATURES: { icon: keyof typeof Ic; title: string; desc: string; bullets: string[] }[] = [
  { icon: "kpi",    title: "GAP Assessment", desc: "Evalúa el nivel de cumplimiento de tu organización frente a los requisitos de cada norma. Diagnóstico por cláusula, scoring automatizado y plan de acción sugerido por IA.", bullets: ["Plantillas por norma (ISO 9001, 27001, 14001, 45001)", "Scoring por cláusula y puntuación global", "Plan de acción sugerido automáticamente", "Exportación a PDF con portada y resumen ejecutivo", "Versión resumida gratuita para captación de leads"] },
  { icon: "doc",    title: "Control de Documentos", desc: "Centraliza todos tus documentos del sistema de gestión con control de versiones, flujos de aprobación configurables y trazabilidad total. Sin correos, sin versiones desactualizadas circulando.", bullets: ["Versionado automático con historial completo", "Flujo de aprobación configurable por tipo de documento", "Relación con cláusulas ISO, procesos y auditorías", "Vista previa y descarga segura de archivos", "Alertas de revisión periódica"] },
  { icon: "risk",   title: "Gestión de Riesgos", desc: "Registra, evalúa y trata los riesgos de tu organización con matriz probabilidad × impacto, heatmap visual e historial de controles. Compatible con ISO 27001 Anexo A y metodologías MAGERIT.", bullets: ["Heatmap 5×5 interactivo con drill-down", "Tratamiento: mitigar, aceptar, transferir, evitar", "Controles preventivos, detectivos y correctivos", "Vencimientos y alertas de revisión", "Sugerencias de controles mediante IA"] },
  { icon: "audit",  title: "Auditorías", desc: "Planifica y ejecuta auditorías internas y externas con checklists por cláusula, registro de hallazgos con evidencias y generación automática del informe final.", bullets: ["Plan anual de auditorías con calendario", "Checklists editables por norma y alcance", "Registro de hallazgos: NC mayor, menor, observación", "Vinculación de evidencias y documentos", "Informe final en PDF con firma digital"] },
  { icon: "capa",   title: "No Conformidades y CAPA", desc: "Gestiona el ciclo completo de no conformidades: alta manual o desde auditoría, análisis de causa raíz, acción correctiva, seguimiento y validación de eficacia.", bullets: ["Alta desde auditoría o de forma manual", "Análisis de causa raíz (5 porqués, Ishikawa)", "Acción correctiva y preventiva vinculada", "Validación de eficacia con fecha límite", "Cierre con evidencia adjunta"] },
  { icon: "ai",     title: "Asistente IA", desc: "Integración real con IA para acelerar el trabajo de cumplimiento. Genera borradores, analiza gaps y sugiere tratamientos. Toda sugerencia requiere confirmación humana antes de guardarse.", bullets: ["Generación de borradores de políticas y procedimientos", "Resumen de evaluaciones GAP", "Sugerencia de acciones correctivas", "Análisis de tratamiento de riesgos", "Resumen de hallazgos de auditoría"] },
  { icon: "kpi",    title: "Indicadores", desc: "Define KPIs con metas, frecuencia y semáforo. Historial de valores para la revisión por la dirección y las auditorías.", bullets: ["Metas y umbrales configurables", "Histórico por periodo", "Alertas cuando se sale de objetivo", "Vínculo a cláusulas y procesos"] },
  { icon: "evid",   title: "Evidencias", desc: "Un solo sitio para pruebas de cumplimiento: subidas seguras, filtros por módulo y trazabilidad hasta auditorías, riesgos o NC.", bullets: ["Almacenamiento centralizado", "Vínculo a auditoría, riesgo, documento o NC", "Vista previa y descarga controlada"] },
];

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="nf-section" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <span className="nf-eyebrow"><span className="dot"/> Funcionalidades</span>
          <h1 className="nf-h-section" style={{ marginTop: 22 }}>
            Cada módulo, <span className="nf-grad-text">diseñado para tu SGC.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto" }}>
            De la evaluación inicial a la mejora continua, NormaFlow cubre todo el ciclo de vida del cumplimiento.
          </p>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {FEATURES.map((feat, i) => {
            const Icon = Ic[feat.icon];
            return (
              <article
                key={feat.title}
                className="nfm-card"
                style={{
                  display: "grid",
                  gridTemplateColumns: i % 2 === 0 ? "1.1fr 1fr" : "1fr 1.1fr",
                  gap: 36,
                  alignItems: "center",
                  padding: "clamp(24px, 4vw, 40px)",
                }}
              >
                <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--nf-accent-soft)", border: "1px solid var(--nf-line)", color: "var(--nf-accent)", marginBottom: 18 }}>
                    <Icon />
                  </div>
                  <h3 className="nf-h-3">{feat.title}</h3>
                  <p style={{ color: "var(--nf-ink-2)", fontSize: 15, lineHeight: 1.65, margin: "10px 0 18px" }}>{feat.desc}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {feat.bullets.map((b) => (
                      <li key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "var(--nf-ink-2)" }}>
                        <span style={{ color: "var(--nf-accent)", marginTop: 3 }}><Ic.check/></span>{b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{
                  order: i % 2 === 0 ? 2 : 1,
                  background: "var(--nf-accent-soft)",
                  border: "1px solid var(--nf-line)",
                  borderRadius: 18,
                  minHeight: 220,
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{ color: "var(--nf-accent)", transform: "scale(4)", opacity: 0.35 }}>
                    <Icon />
                  </div>
                  <div style={{ position: "absolute", bottom: 14, left: 16, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    módulo · {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container">
          <div className="nf-cta-final">
            <h2 className="nf-h-display" style={{ fontSize: "clamp(28px, 4vw, 44px)", maxWidth: "22ch", marginInline: "auto" }}>
              ¿Listo para verlo en tu sistema?
            </h2>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
              <a className="nf-btn nf-btn--primary" href="/demo">Solicitar demo <Ic.arrow className="nf-arrow"/></a>
              <a className="nf-btn nf-btn--ghost" href="/pricing">Ver precios</a>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
