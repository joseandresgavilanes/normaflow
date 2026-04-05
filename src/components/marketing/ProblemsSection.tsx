export default function ProblemsSection() {
  return (
    <section style={{ background: "#F7F9FC", padding: "clamp(48px, 10vw, 80px) 0" }}>
      <div className="nf-mkt-container">
        <div style={{ textAlign: "center", marginBottom: "clamp(32px, 8vw, 48px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#C93C37", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>El problema</div>
          <h2 style={{ fontSize: "clamp(22px, 5vw, 36px)", fontWeight: 800, color: "#142033", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            Gestionar el cumplimiento sin las herramientas adecuadas tiene un coste real
          </h2>
          <p style={{ fontSize: "clamp(15px, 3.5vw, 18px)", color: "#5E6B7A", maxWidth: 580, margin: "0 auto", lineHeight: 1.65 }}>La mayoría de empresas certificadas gestionan sus sistemas en hojas de cálculo, correos y carpetas compartidas.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 20 }}>
          {[
            { icon: "📧", title: "Correos perdidos", desc: "Aprobaciones de documentos que nadie recuerda. Versiones desactualizadas circulando entre equipos." },
            { icon: "📋", title: "Auditorías estresantes", desc: "Buscar evidencias durante semanas antes de cada auditoría. Preparación reactiva en lugar de continua." },
            { icon: "🧮", title: "Hojas de cálculo inviables", desc: "Registros de riesgos y planes de acción en archivos sin trazabilidad ni control de cambios real." },
            { icon: "🔔", title: "Sin alertas ni seguimiento", desc: "Acciones vencidas sin responsable. Indicadores que nadie actualiza. El cumplimiento se deteriora lentamente." },
          ].map(p => (
            <div key={p.title} style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 12, padding: "24px", borderTop: "3px solid #C93C37" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{p.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#142033", marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 14, color: "#5E6B7A", lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
