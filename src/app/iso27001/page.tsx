import MarketingLayout from "@/components/layout/MarketingLayout";
import Link from "next/link";
export const metadata = { title: "ISO 27001:2022 — NormaFlow" };
export default function ISO27001Page() {
  return (
    <MarketingLayout>
      <section style={{ background: "linear-gradient(135deg, #0D2E4E, #123C66)", padding: "80px 0 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(46,139,87,0.25)", border: "1px solid rgba(46,139,87,0.4)", borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700, color: "#4ade80", marginBottom: 20 }}>ISO 27001:2022</div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: "-1px", lineHeight: 1.1 }}>Sistema de Gestión de Seguridad de la Información</h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.72)", lineHeight: 1.65, marginBottom: 28 }}>Digitaliza tu SGSI con controles, riesgos y evidencias auditables. Compatible con la versión 2022 y los 93 controles del Anexo A.</p>
          <Link href="/signup" style={{ display: "inline-block", padding: "12px 28px", background: "#2E8B57", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Solicitar demo gratuita →</Link>
        </div>
      </section>
      <section style={{ background: "#fff", padding: "72px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {[
              { icon: "🔒", title: "Gestión de riesgos de SI", desc: "Metodología MAGERIT o propia. Probabilidad × impacto, tratamiento y controles Anexo A.", control: "6.1.2" },
              { icon: "📋", title: "Controles Anexo A", desc: "Los 93 controles ISO 27001:2022 organizados por dominio, con estado y evidencia adjunta.", control: "Anexo A" },
              { icon: "🔍", title: "Auditorías de seguridad", desc: "Auditorías técnicas y de gestión con hallazgos trazables y acciones correctivas vinculadas.", control: "9.2" },
              { icon: "📁", title: "Gestión de evidencias", desc: "Repositorio centralizado con vinculación a controles, auditorías y no conformidades.", control: "7.5" },
              { icon: "🚨", title: "Gestión de incidentes", desc: "Registro, análisis y cierre de incidentes de seguridad con notificación automática.", control: "A.5.24" },
              { icon: "🔁", title: "Continuidad del negocio", desc: "Plan BCP/DRP documentado, probado y vinculado al SGSI.", control: "A.5.29" },
            ].map(item => (
              <div key={item.title} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 12, padding: "22px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#142033" }}>{item.title}</span>
                  <span style={{ background: "#2E8B5718", color: "#2E8B57", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>{item.control}</span>
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
