export default function ModulesGrid() {
  return (
    <section style={{ background: "#fff", padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Funcionalidades</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#142033", margin: "0 0 16px", letterSpacing: "-0.5px" }}>Todo lo que necesitas en una plataforma</h2>
          <p style={{ fontSize: 18, color: "#5E6B7A", maxWidth: 560, margin: "0 auto" }}>Módulos diseñados para el ciclo de vida completo de tu sistema de gestión.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {[
            { icon: "◎", name: "GAP Assessment", desc: "Evalúa tu nivel de cumplimiento por cláusula", color: "#123C66" },
            { icon: "📄", name: "Control de Documentos", desc: "Versionado, aprobación y trazabilidad", color: "#2E8B57" },
            { icon: "⚠", name: "Gestión de Riesgos", desc: "Heatmap, controles y tratamiento", color: "#D68A1A" },
            { icon: "✓", name: "Auditorías", desc: "Plan, checklist, hallazgos e informes", color: "#2E8B57" },
            { icon: "⊘", name: "No Conformidades", desc: "CAPA completo con causa raíz", color: "#C93C37" },
            { icon: "📊", name: "Indicadores KPI", desc: "Semáforo, tendencia y alertas", color: "#123C66" },
            { icon: "⚡", name: "Plan de Acción", desc: "Seguimiento centralizado de acciones", color: "#D68A1A" },
            { icon: "✦", name: "Asistente IA", desc: "Borradores, análisis y sugerencias", color: "#6B3FB5" },
          ].map(m => (
            <div key={m.name} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 12, padding: "20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: m.color + "18", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, color: m.color }}>
                {m.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 5 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "#5E6B7A", lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
