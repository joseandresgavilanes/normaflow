import Link from "next/link";
export default function PricingSection() {
  return (
    <section style={{ background: "#F7F9FC", padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Precios</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#142033", margin: "0 0 14px", letterSpacing: "-0.5px" }}>Planes para cada etapa</h2>
          <p style={{ fontSize: 17, color: "#5E6B7A" }}>Sin sorpresas. Sin costes ocultos. Cancela cuando quieras.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 920, margin: "0 auto" }}>
          {[
            { name: "Starter", price: "€99", period: "/mes", recommended: false, features: ["5 usuarios", "ISO 9001 + ISO 27001", "Módulos básicos", "5 GB almacenamiento", "Soporte email"], cta: "Empezar 14 días gratis" },
            { name: "Growth", price: "€299", period: "/mes", recommended: true, features: ["50 usuarios", "Todos los módulos", "Asistente IA incluido", "25 GB almacenamiento", "Soporte prioritario", "Onboarding guiado"], cta: "Solicitar demo" },
            { name: "Enterprise", price: "A medida", period: "", recommended: false, features: ["Usuarios ilimitados", "Multi-organización", "100 GB almacenamiento", "SLA 99.9% garantizado", "Soporte dedicado", "API + integraciones"], cta: "Contactar ventas" },
          ].map(plan => (
            <div key={plan.name} style={{ background: "#fff", border: plan.recommended ? "2px solid #123C66" : "1px solid #E5EAF2", borderRadius: 16, padding: "28px", position: "relative" }}>
              {plan.recommended && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#123C66", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap" }}>Más popular</div>}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#142033", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#123C66" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "#5E6B7A" }}>{plan.period}</span>
              </div>
              {plan.features.map(f => <div key={f} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 13 }}><span style={{ color: "#2E8B57", fontWeight: 700 }}>✓</span><span style={{ color: "#142033" }}>{f}</span></div>)}
              <Link href="/signup" style={{ display: "block", marginTop: 20, background: plan.recommended ? "#123C66" : "transparent", color: plan.recommended ? "#fff" : "#123C66", border: `1.5px solid #123C66`, borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
