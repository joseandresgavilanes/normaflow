"use client";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";

const PLANS = [
  { name: "Starter", price: "€99", period: "/mes", desc: "Para equipos que empiezan.", features: ["5 usuarios", "Módulos básicos", "5 GB almacenamiento", "Soporte email"], current: false },
  { name: "Growth", price: "€299", period: "/mes", desc: "El favorito de las PYMEs certificadas.", features: ["50 usuarios", "Todos los módulos", "Asistente IA incluido", "25 GB almacenamiento", "Soporte prioritario", "Onboarding guiado"], current: true },
  { name: "Enterprise", price: "A medida", period: "", desc: "Para grandes organizaciones.", features: ["Usuarios ilimitados", "Multi-organización", "100 GB almacenamiento", "SLA 99.9%", "Soporte dedicado", "API + integraciones"], current: false },
];

export default function BillingModule() {
  return (
    <div>
      <SectionTitle title="Billing y Suscripción" sub="Gestión de tu plan y facturación" />

      {/* Current plan */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg, #0D2E4E 0%, #123C66 100%)", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Plan actual</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#fff" }}>Growth</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Próxima facturación: 15 Jul 2025 · €299/mes</div>
          </div>
          <div style={{ background: "#2E8B5730", border: "1px solid #2E8B5760", borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>● Activo</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[["Usuarios activos", "18 / 50"], ["Módulos", "Todos incluidos"], ["Almacenamiento", "4.2 GB / 25 GB"]].map(([k, v]) => (
            <div key={String(k)} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>
            <span>Almacenamiento usado</span><span>4.2 GB / 25 GB</span>
          </div>
          <ProgressBar value={16.8} color="#4ade80" height={5} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={{ flex: 1, background: "#fff", color: "#123C66", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Actualizar a Enterprise</button>
          <button style={{ flex: 1, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer" }}>Gestionar en Stripe →</button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: "0 0 14px" }}>Uso del plan</h3>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Usuarios", used: 18, total: 50, unit: "usuarios" },
                { label: "Almacenamiento", used: 4.2, total: 25, unit: "GB" },
                { label: "Documentos", used: 8, total: -1, unit: "documentos" },
                { label: "Auditorías este mes", used: 2, total: -1, unit: "auditorías" },
              ].map(u => (
                <div key={u.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: "#142033", fontWeight: 500 }}>{u.label}</span>
                    <span style={{ color: "#5E6B7A" }}>{u.used} {u.total > 0 ? `/ ${u.total}` : ""} {u.unit}</span>
                  </div>
                  {u.total > 0 && <ProgressBar value={(u.used / u.total) * 100} color="#123C66" height={5} />}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: "0 0 14px" }}>Últimas facturas</h3>
          <Card style={{ padding: "16px 20px" }}>
            {[["Jun 2025", "€299", true], ["May 2025", "€299", true], ["Apr 2025", "€299", true], ["Mar 2025", "€299", true]].map(([d, v, paid]) => (
              <div key={String(d)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #E5EAF2", fontSize: 13 }}>
                <span style={{ color: "#5E6B7A" }}>{d}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#142033" }}>{v}</span>
                  {paid && <span style={{ color: "#2E8B57", fontSize: 11, fontWeight: 700 }}>✓ Pagada</span>}
                </div>
              </div>
            ))}
            <button style={{ marginTop: 10, width: "100%", background: "transparent", color: "#123C66", border: "1px solid #E5EAF2", borderRadius: 8, padding: "7px", fontSize: 13, cursor: "pointer" }}>
              Ver todas las facturas
            </button>
          </Card>
        </div>
      </div>

      {/* Plans comparison */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: "0 0 16px" }}>Comparativa de planes</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {PLANS.map(plan => (
          <Card key={plan.name} style={{ border: plan.current ? `2px solid #123C66` : "1px solid #E5EAF2", position: "relative" }}>
            {plan.current && (
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#123C66", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap" }}>
                Plan actual
              </div>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, color: "#142033", marginBottom: 4 }}>{plan.name}</div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: "#123C66" }}>{plan.price}</span>
              <span style={{ fontSize: 13, color: "#5E6B7A" }}>{plan.period}</span>
            </div>
            <p style={{ fontSize: 12, color: "#5E6B7A", marginBottom: 16, lineHeight: 1.5 }}>{plan.desc}</p>
            {plan.features.map(f => (
              <div key={f} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 13 }}>
                <span style={{ color: "#2E8B57", fontWeight: 700 }}>✓</span>
                <span style={{ color: "#142033" }}>{f}</span>
              </div>
            ))}
            <button style={{ marginTop: 16, width: "100%", background: plan.current ? "#F7F9FC" : "#123C66", color: plan.current ? "#5E6B7A" : "#fff", border: `1.5px solid ${plan.current ? "#E5EAF2" : "#123C66"}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: plan.current ? "default" : "pointer" }}>
              {plan.current ? "Plan actual" : plan.name === "Enterprise" ? "Contactar ventas" : "Seleccionar plan"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
