export default function CaseStudySection() {
  return (
    <section style={{ background: "#0D2E4E", padding: "clamp(48px, 10vw, 80px) 0" }}>
      <div className="nf-mkt-container">
        <div className="nf-mkt-grid-2" style={{ alignItems: "center", gap: "clamp(28px, 6vw, 60px)" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Caso de éxito</div>
            <h2 style={{ fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 800, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.25 }}>
              "Pasamos de 3 semanas a 2 días de preparación para auditoría"
            </h2>
            <p style={{ fontSize: "clamp(14px, 3.5vw, 16px)", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 24 }}>
              Tecnoserv Industrial implementó NormaFlow para su certificación simultánea ISO 9001 e ISO 27001. El equipo de calidad redujo el tiempo de gestión documental un 70% y obtuvo cero no conformidades mayores en la auditoría de certificación.
            </p>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[["70%", "Menos tiempo en gestión documental"], ["2 días", "Preparación de auditoría"], ["0 NC", "Mayores en certificación"]].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{v}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "clamp(18px, 4vw, 28px)" }}>
            <div style={{ fontSize: "clamp(14px, 3.2vw, 15px)", color: "rgba(255,255,255,0.72)", fontStyle: "italic", lineHeight: 1.75, marginBottom: 20 }}>
              "Antes tardábamos semanas en preparar cada auditoría interna. Con NormaFlow, toda la evidencia está centralizada y siempre actualizada. La última revisión por dirección duró 45 minutos en lugar de medio día."
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2E8B57", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 14 }}>MT</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>María Torres</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Directora de Calidad · Tecnoserv Industrial S.A.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
