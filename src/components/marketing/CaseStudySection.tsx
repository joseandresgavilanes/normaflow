export default function CaseStudySection() {
  return (
    <section style={{ background: "#0D2E4E", padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Caso de éxito</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.25 }}>
              "Pasamos de 3 semanas a 2 días de preparación para auditoría"
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 24 }}>
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
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", fontStyle: "italic", lineHeight: 1.75, marginBottom: 20 }}>
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
