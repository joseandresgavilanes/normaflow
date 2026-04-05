"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/Table";
import { useWorkspace, type InvoiceRow } from "@/context/WorkspaceStore";
import type { Column } from "@/components/ui/Table";

const PLANS = [
  { key: "STARTER" as const, name: "Starter", price: "€99", period: "/mes", desc: "Para equipos que empiezan.", features: ["5 usuarios", "Módulos básicos", "5 GB almacenamiento", "Soporte email"] },
  { key: "GROWTH" as const, name: "Growth", price: "€299", period: "/mes", desc: "El favorito de las PYMEs certificadas.", features: ["50 usuarios", "Todos los módulos", "Asistente IA incluido", "25 GB almacenamiento", "Soporte prioritario", "Onboarding guiado"] },
  { key: "ENTERPRISE" as const, name: "Enterprise", price: "A medida", period: "", desc: "Para grandes organizaciones.", features: ["Usuarios ilimitados", "Multi-organización", "100 GB almacenamiento", "SLA 99.9%", "Soporte dedicado", "API + integraciones"] },
];

export default function BillingModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { billing } = state;
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [stripeOpen, setStripeOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);

  const currentPlan = PLANS.find(p => p.key === billing.plan) ?? PLANS[1];
  const isEnterprise = billing.plan === "ENTERPRISE";

  const invoiceColumns: Column<InvoiceRow>[] = [
    { key: "period", label: "Periodo" },
    { key: "amount", label: "Importe", render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: "paid", label: "Estado", render: v => <span style={{ color: v ? "#2E8B57" : "#D68A1A", fontWeight: 600 }}>{v ? "Pagada" : "Pendiente"}</span> },
  ];

  function simulateEnterprise() {
    dispatch({ type: "setBillingPlan", plan: "ENTERPRISE" });
    setEnterpriseOpen(false);
    showToast("Plan actualizado a Enterprise (simulación en sesión demo — sin Stripe)");
  }

  function copyStripeDemo() {
    const text = "https://billing.stripe.com/p/demo_placeholder (no es un enlace real — integración pendiente)";
    void navigator.clipboard.writeText(text).then(() => showToast("Texto copiado al portapapeles"));
  }

  return (
    <div>
      <SectionTitle title="Billing y Suscripción" sub="Datos de facturación simulados en frontend; la pasarela real se conectará después." />

      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg, #0D2E4E 0%, #123C66 100%)", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Plan actual (demo)</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#fff" }}>{currentPlan.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
              Próxima facturación: {billing.nextBilling} · {currentPlan.price}
              {currentPlan.period}
            </div>
          </div>
          <div style={{ background: "#2E8B5730", border: "1px solid #2E8B5760", borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>● Activo (simulado)</span>
          </div>
        </div>
        <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 20 }}>
          {[
            ["Usuarios activos", "18 / 50"],
            ["Módulos", "Todos incluidos"],
            ["Almacenamiento", "4.2 GB / 25 GB"],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>
            <span>Almacenamiento usado</span>
            <span>4.2 GB / 25 GB</span>
          </div>
          <ProgressBar value={16.8} color="#4ade80" height={5} />
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>Los botones siguientes abren flujos simulados o explican el estado de la integración. No se redirige a Stripe real.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => (isEnterprise ? showToast("Ya estás en Enterprise en esta sesión demo.") : setEnterpriseOpen(true))}
            style={{
              flex: 1,
              minWidth: 160,
              background: "#fff",
              color: "#123C66",
              border: "none",
              borderRadius: 8,
              padding: "10px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isEnterprise ? 0.65 : 1,
            }}
          >
            {isEnterprise ? "Ya en Enterprise" : "Actualizar a Enterprise"}
          </button>
          <button type="button" onClick={() => setStripeOpen(true)} style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer" }}>
            Gestionar en Stripe →
          </button>
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
                    <span style={{ color: "#5E6B7A" }}>
                      {u.used} {u.total > 0 ? `/ ${u.total}` : ""} {u.unit}
                    </span>
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
            {billing.invoices.slice(0, 4).map(inv => (
              <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #E5EAF2", fontSize: 13 }}>
                <span style={{ color: "#5E6B7A" }}>{inv.period}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#142033" }}>{inv.amount}</span>
                  {inv.paid && <span style={{ color: "#2E8B57", fontSize: 11, fontWeight: 700 }}>✓ Pagada</span>}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setInvoicesOpen(true)} style={{ marginTop: 10, width: "100%", background: "transparent", color: "#123C66", border: "1px solid #E5EAF2", borderRadius: 8, padding: "7px", fontSize: 13, cursor: "pointer" }}>
              Ver todas las facturas
            </button>
          </Card>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: "0 0 16px" }}>Comparativa de planes</h3>
      <div className="nf-grid-stats" style={{ gap: 16 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.key === billing.plan;
          return (
            <Card key={plan.key} style={{ border: isCurrent ? `2px solid #123C66` : "1px solid #E5EAF2", position: "relative" }}>
              {isCurrent && (
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
              <button
                type="button"
                onClick={() => {
                  if (isCurrent) return;
                  if (plan.key === "ENTERPRISE") setEnterpriseOpen(true);
                  else {
                    dispatch({ type: "setBillingPlan", plan: plan.key });
                    showToast(`Plan cambiado a ${plan.name} (demo)`);
                  }
                }}
                disabled={isCurrent}
                style={{
                  marginTop: 16,
                  width: "100%",
                  background: isCurrent ? "#F7F9FC" : "#123C66",
                  color: isCurrent ? "#5E6B7A" : "#fff",
                  border: `1.5px solid ${isCurrent ? "#E5EAF2" : "#123C66"}`,
                  borderRadius: 8,
                  padding: "9px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isCurrent ? "default" : "pointer",
                }}
              >
                {isCurrent ? "Plan actual" : plan.key === "ENTERPRISE" ? "Contactar / simular Enterprise" : "Seleccionar plan (demo)"}
              </button>
            </Card>
          );
        })}
      </div>

      <Modal open={enterpriseOpen} onClose={() => setEnterpriseOpen(false)} title="Actualizar a Enterprise (simulación)" width={480}>
        <p style={{ fontSize: 14, color: "#142033", lineHeight: 1.6 }}>
          En producción aquí se abriría un flujo con ventas o Stripe Checkout. En esta sesión solo actualizamos el plan en memoria para que puedas probar la UI.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={simulateEnterprise} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Confirmar upgrade demo
          </button>
          <button type="button" onClick={() => setEnterpriseOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={stripeOpen} onClose={() => setStripeOpen(false)} title="Portal de cliente Stripe" width={480}>
        <p style={{ fontSize: 14, color: "#5E6B7A", lineHeight: 1.6 }}>
          La integración con Stripe Customer Portal no está conectada. No usamos enlaces reales para evitar confusiones. Cuando el backend esté listo, este botón abrirá una sesión segura de Stripe.
        </p>
        <button type="button" onClick={copyStripeDemo} style={{ marginTop: 12, width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Copiar texto de ejemplo (placeholder)
        </button>
      </Modal>

      <Modal open={invoicesOpen} onClose={() => setInvoicesOpen(false)} title="Todas las facturas (demo)" width={640}>
        <p style={{ fontSize: 13, color: "#5E6B7A", marginTop: 0 }}>Listado generado en el estado de la aplicación; no se obtiene de Stripe.</p>
        <Card style={{ padding: 0 }}>
          <DataTable columns={invoiceColumns} rows={billing.invoices} emptyText="Sin facturas en el estado demo" />
        </Card>
      </Modal>
    </div>
  );
}
