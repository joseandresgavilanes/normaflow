export default function PDCASection() {
  return (
    <section style={{ background: "#F7F9FC", padding: "clamp(48px, 10vw, 80px) 0" }}>
      <div className="nf-mkt-container">
        <div style={{ textAlign: "center", marginBottom: "clamp(32px, 8vw, 48px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Metodología</div>
          <h2 style={{ fontSize: "clamp(22px, 5vw, 36px)", fontWeight: 800, color: "#142033", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>Mejora continua con el ciclo PDCA</h2>
          <p style={{ fontSize: "clamp(15px, 3.5vw, 18px)", color: "#5E6B7A", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>NormaFlow estructura tu trabajo alrededor de las cuatro fases fundamentales de la mejora continua.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
          {[
            { num: "01", label: "Planificar", color: "#123C66", items: ["GAP Assessment", "Plan de auditorías", "Registro de riesgos", "Objetivos de calidad"] },
            { num: "02", label: "Hacer", color: "#2E8B57", items: ["Control documental", "Formación y evidencias", "Acciones preventivas", "Implementación de controles"] },
            { num: "03", label: "Verificar", color: "#D68A1A", items: ["Auditorías internas", "Indicadores KPI", "Revisión por dirección", "Seguimiento de acciones"] },
            { num: "04", label: "Actuar", color: "#C93C37", items: ["CAPA", "Acciones correctivas", "Mejora continua", "Actualización del SGC"] },
          ].map(p => (
            <div key={p.label} style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 12, padding: "clamp(18px, 4vw, 24px)", borderTop: `4px solid ${p.color}`, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: p.color, letterSpacing: 2, marginBottom: 8 }}>{p.num}</div>
              <div style={{ fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 800, color: "#142033", marginBottom: 14 }}>{p.label}</div>
              {p.items.map(item => <div key={item} style={{ fontSize: 13, color: "#5E6B7A", padding: "4px 0" }}>{item}</div>)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
