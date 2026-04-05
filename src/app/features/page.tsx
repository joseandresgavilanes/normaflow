import MarketingLayout from "@/components/layout/MarketingLayout";
import Link from "next/link";
export const metadata = { title: "Funcionalidades — NormaFlow" };
export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <section style={{ background: "#0D2E4E", padding: "clamp(48px, 10vw, 80px) 0 clamp(40px, 8vw, 60px)" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 760, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Funcionalidades</div>
          <h1 style={{ fontSize: "clamp(26px, 6vw, 48px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.03em", lineHeight: 1.12 }}>Cada módulo, diseñado para tu SGC</h1>
          <p style={{ fontSize: "clamp(15px, 3.5vw, 18px)", color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>De la evaluación inicial a la mejora continua, NormaFlow cubre todo el ciclo de vida.</p>
        </div>
      </section>
      <section style={{ background: "#fff", padding: "clamp(48px, 10vw, 80px) 0" }}>
        <div className="nf-mkt-container">
          {[
            { icon: "◎", title: "GAP Assessment", color: "#123C66", desc: "Evalúa el nivel de cumplimiento de tu organización frente a los requisitos de cada norma. Obtén un diagnóstico detallado por cláusula, con scoring automatizado y plan de acción sugerido por IA.", features: ["Plantillas por norma (ISO 9001, 27001, 14001, 45001)", "Scoring por cláusula y puntuación global", "Plan de acción sugerido automáticamente", "Exportación a PDF con portada y resumen ejecutivo", "Versión resumida gratuita para captación de leads"] },
            { icon: "📄", title: "Control de Documentos", color: "#2E8B57", desc: "Centraliza todos tus documentos del sistema de gestión con control de versiones, flujos de aprobación configurables y trazabilidad total. Sin correos, sin versiones desactualizadas circulando.", features: ["Versionado automático con historial completo", "Flujo de aprobación configurable por tipo de documento", "Relación con cláusulas ISO, procesos y auditorías", "Vista previa y descarga segura de archivos", "Alertas de revisión periódica"] },
            { icon: "⚠", title: "Gestión de Riesgos", color: "#D68A1A", desc: "Registra, evalúa y trata los riesgos de tu organización con matriz probabilidad × impacto, heatmap visual e historial de controles. Compatible con ISO 27001 Anexo A y metodologías MAGERIT.", features: ["Heatmap 5×5 interactivo con drill-down", "Tratamiento: mitigar, aceptar, transferir, evitar", "Controles preventivos, detectivos y correctivos", "Vencimientos y alertas de revisión", "Sugerencias de controles mediante IA"] },
            { icon: "✓", title: "Auditorías", color: "#2E8B57", desc: "Planifica y ejecuta auditorías internas y externas con checklists por cláusula, registro de hallazgos con evidencias y generación automática del informe final.", features: ["Plan anual de auditorías con calendario", "Checklists editables por norma y alcance", "Registro de hallazgos: NC mayor, menor, observación", "Vinculación de evidencias y documentos", "Informe final en PDF con firma digital"] },
            { icon: "⊘", title: "No Conformidades y CAPA", color: "#C93C37", desc: "Gestiona el ciclo completo de no conformidades: alta manual o desde auditoría, análisis de causa raíz, acción correctiva, seguimiento y validación de eficacia.", features: ["Alta desde auditoría o de forma manual", "Análisis de causa raíz (5 porqués, Ishikawa)", "Acción correctiva y preventiva vinculada", "Validación de eficacia con fecha límite", "Cierre con evidencia adjunta"] },
            { icon: "✦", title: "Asistente IA", color: "#6B3FB5", desc: "Integración real con IA para acelerar el trabajo de cumplimiento. Genera borradores, analiza gaps y sugiere tratamientos. Toda sugerencia requiere confirmación humana antes de guardarse.", features: ["Generación de borradores de políticas y procedimientos", "Resumen de evaluaciones GAP", "Sugerencia de acciones correctivas", "Análisis de tratamiento de riesgos", "Resumen de hallazgos de auditoría"] },
            { icon: "📊", title: "Indicadores", color: "#123C66", desc: "Define KPIs con metas, frecuencia y semáforo. Historial de valores para la revisión por la dirección y las auditorías.", features: ["Metas y umbrales configurables", "Histórico por periodo", "Alertas cuando se sale de objetivo", "Vínculo a cláusulas y procesos"] },
            { icon: "📎", title: "Evidencias", color: "#2E8B57", desc: "Un solo sitio para pruebas de cumplimiento: subidas seguras, filtros por módulo y trazabilidad hasta auditorías, riesgos o NC.", features: ["Almacenamiento centralizado", "Vínculo a auditoría, riesgo, documento o NC", "Vista previa y descarga controlada"] },
          ].map((feat, i) => (
            <div
              key={feat.title}
              className="nf-mkt-feature-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: "clamp(24px, 5vw, 60px)",
                alignItems: "center",
                marginBottom: "clamp(48px, 10vw, 80px)",
                direction: i % 2 !== 0 ? "rtl" : "ltr",
              }}
            >
              <div style={{ direction: "ltr" }}>
                <div style={{ width: 52, height: 52, background: feat.color + "18", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 18, color: feat.color }}>
                  {feat.icon}
                </div>
                <h3 style={{ fontSize: "clamp(20px, 4.5vw, 28px)", fontWeight: 800, color: "#142033", margin: "0 0 12px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>{feat.title}</h3>
                <p style={{ fontSize: 16, color: "#5E6B7A", lineHeight: 1.7, marginBottom: 20 }}>{feat.desc}</p>
                {feat.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0" }}>
                    <span style={{ color: feat.color, fontWeight: 700, fontSize: 15 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#142033" }}>{f}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  direction: "ltr",
                  background: feat.color + "08",
                  border: `1px solid ${feat.color}25`,
                  borderRadius: 16,
                  padding: "clamp(20px, 5vw, 36px)",
                  minHeight: "min(200px, 40vw)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: "clamp(40px, 12vw, 72px)", opacity: 0.15, color: feat.color }}>{feat.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
