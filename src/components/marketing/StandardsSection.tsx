import Link from "next/link";
export default function StandardsSection() {
  return (
    <section style={{ background: "#fff", padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Normas ISO</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#142033", margin: "0 0 16px", letterSpacing: "-0.5px" }}>Soporte nativo para las normas más demandadas</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {[
            { code: "ISO 9001", year: "2015", title: "Sistema de Gestión de la Calidad", color: "#123C66", href: "/iso9001", features: ["GAP Assessment por cláusula", "Control documental completo", "Auditorías y CAPA", "Indicadores de calidad", "Revisión por dirección"] },
            { code: "ISO 27001", year: "2022", title: "Sistema de Gestión de Seguridad de la Información", color: "#2E8B57", href: "/iso27001", features: ["Gestión de riesgos de seguridad", "Controles Anexo A (93 controles)", "Gestión de incidentes", "Continuidad del negocio", "Auditorías técnicas"] },
          ].map(s => (
            <div key={s.code} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 16, padding: 32, borderLeft: `5px solid ${s.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ background: s.color, color: "#fff", padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 800 }}>{s.code}:{s.year}</div>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#142033", margin: "0 0 14px" }}>{s.title}</h3>
              {s.features.map(f => <div key={f} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 14, color: "#142033" }}><span style={{ color: s.color, fontWeight: 700 }}>✓</span>{f}</div>)}
              <Link href={s.href} style={{ display: "inline-block", marginTop: 20, color: s.color, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Ver más sobre {s.code} →</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
