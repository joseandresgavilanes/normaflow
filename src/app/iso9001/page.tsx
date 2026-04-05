import MarketingLayout from "@/components/layout/MarketingLayout";
import Link from "next/link";
export const metadata = { title: "ISO 9001:2015 — NormaFlow", description: "Implementa y mantén tu Sistema de Gestión de la Calidad con NormaFlow." };
export default function ISO9001Page() {
  return (
    <MarketingLayout>
      <section style={{ background: "linear-gradient(135deg, #123C66, #1a5490)", padding: "clamp(48px, 10vw, 80px) 0 clamp(40px, 8vw, 60px)" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 720, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 20 }}>ISO 9001:2015</div>
          <h1 style={{ fontSize: "clamp(26px, 6vw, 44px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.03em", lineHeight: 1.12 }}>Sistema de Gestión de la Calidad</h1>
          <p style={{ fontSize: "clamp(15px, 3.5vw, 18px)", color: "rgba(255,255,255,0.72)", lineHeight: 1.65, marginBottom: 28 }}>Implementa, mantén y mejora tu SGC con trazabilidad total, evidencias siempre disponibles y auditorías sin estrés.</p>
          <Link href="/signup" style={{ display: "inline-block", padding: "12px 28px", background: "#2E8B57", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Solicitar demo gratuita →</Link>
        </div>
      </section>
      <section style={{ background: "#fff", padding: "clamp(40px, 8vw, 72px) 0" }}>
        <div className="nf-mkt-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 20 }}>
            {[
              { icon: "📋", title: "Contexto y liderazgo", desc: "Gestiona partes interesadas, alcance del SGC y política de calidad. Cláusulas 4 y 5 cubiertas.", clause: "4, 5" },
              { icon: "⚙️", title: "Planificación y apoyo", desc: "Objetivos de calidad, recursos, competencias y control documental. Todo en un solo lugar.", clause: "6, 7" },
              { icon: "🏭", title: "Control operacional", desc: "Documenta procesos, instrucciones y controles de calidad de producto/servicio.", clause: "8" },
              { icon: "📊", title: "Evaluación del desempeño", desc: "KPIs, satisfacción del cliente, auditorías internas y revisión por dirección.", clause: "9" },
              { icon: "🔄", title: "Mejora continua", desc: "CAPA, no conformidades, análisis de causa raíz y planes de acción.", clause: "10" },
              { icon: "✦", title: "IA para ISO 9001", desc: "Generación de procedimientos, análisis de GAP y sugerencias de mejora con IA.", clause: "Todos" },
            ].map(item => (
              <div key={item.title} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 12, padding: "22px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#142033" }}>{item.title}</span>
                  <span style={{ background: "#123C6618", color: "#123C66", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>Cláusula {item.clause}</span>
                </div>
                <div style={{ fontSize: 13, color: "#5E6B7A", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
