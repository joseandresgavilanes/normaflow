"use client";
import { useState, type ReactNode } from "react";
import { CalendarDays, Check, CreditCard, HardDrive, Receipt, Sparkles, Users } from "lucide-react";
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

function metricBox(icon: ReactNode, label: string, value: string, valueColor?: string) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f0f4f9 100%)",
        border: "1px solid rgba(18, 60, 102, 0.1)",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(18, 60, 102, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#123C66",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: valueColor || "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
}

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

  const storagePct = 16.8;

  return (
    <div>
      <SectionTitle title="Billing y Suscripción" sub="Datos de facturación simulados en frontend; la pasarela real se conectará después." />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.16) 0%, rgba(18, 60, 102, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#123C66", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{currentPlan.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>
              {currentPlan.price}
              {currentPlan.period}
              <span style={{ marginLeft: 8, opacity: 0.85 }}>· Plan actual (demo)</span>
            </div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.2) 0%, rgba(214, 138, 26, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <CalendarDays size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink-2)", lineHeight: 1.3 }}>Próxima facturación</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em", marginTop: 4 }}>{billing.nextBilling}</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <HardDrive size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{storagePct}%</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Almacenamiento usado</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.22) 0%, rgba(46, 139, 87, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e6b45",
            }}
          >
            <CreditCard size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e6b45", letterSpacing: "-0.02em" }}>Activo</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Suscripción simulada</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 22, padding: "20px 22px 22px", border: "1px solid var(--nf-line)", boxShadow: "0 1px 0 rgba(18, 60, 102, 0.04)" }}>
        <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 18 }}>
          {metricBox(<Users size={18} strokeWidth={2.25} aria-hidden />, "Usuarios activos", "18 / 50")}
          {metricBox(<Sparkles size={18} strokeWidth={2.25} aria-hidden />, "Módulos", "Todos incluidos")}
          {metricBox(<HardDrive size={18} strokeWidth={2.25} aria-hidden />, "Almacenamiento", "4.2 / 25 GB", "#123C66")}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginBottom: 6 }}>
            <span>Progreso de almacenamiento</span>
            <span style={{ color: "#123C66" }}>4.2 GB / 25 GB</span>
          </div>
          <ProgressBar value={storagePct} color="#2E8B57" height={7} railColor="#eef2f9" />
        </div>
        <p style={{ fontSize: 12, color: "var(--nf-ink-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
          Los botones siguientes abren flujos simulados o explican el estado de la integración. No se redirige a Stripe real.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => (isEnterprise ? showToast("Ya estás en Enterprise en esta sesión demo.") : setEnterpriseOpen(true))}
            style={{
              flex: "1 1 180px",
              background: "#123C66",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isEnterprise ? 0.65 : 1,
            }}
          >
            {isEnterprise ? "Ya en Enterprise" : "Actualizar a Enterprise"}
          </button>
          <button
            type="button"
            onClick={() => setStripeOpen(true)}
            style={{
              flex: "1 1 180px",
              background: "#fff",
              color: "#123C66",
              border: "1px solid var(--nf-line)",
              borderRadius: 10,
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Gestionar en Stripe →
          </button>
        </div>
      </Card>

      <div className="nf-app-split-2" style={{ marginBottom: 28 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", margin: "0 0 14px", letterSpacing: "-0.02em" }}>Uso del plan</h3>
          <Card style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Usuarios", used: 18, total: 50, unit: "usuarios" },
                { label: "Almacenamiento", used: 4.2, total: 25, unit: "GB" },
                { label: "Documentos", used: 8, total: -1, unit: "documentos" },
                { label: "Auditorías este mes", used: 2, total: -1, unit: "auditorías" },
              ].map(u => (
                <div key={u.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: "var(--nf-ink)" }}>{u.label}</span>
                    <span style={{ color: "var(--nf-ink-3)", fontWeight: 600 }}>
                      {u.used} {u.total > 0 ? `/ ${u.total}` : ""} {u.unit}
                    </span>
                  </div>
                  {u.total > 0 && <ProgressBar value={(u.used / u.total) * 100} color="#123C66" height={6} railColor="#eef2f9" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", margin: "0 0 14px", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={18} strokeWidth={2.25} aria-hidden style={{ color: "#123C66" }} />
            Últimas facturas
          </h3>
          <Card style={{ padding: "16px 18px" }}>
            {billing.invoices.slice(0, 4).map((inv, i, arr) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--nf-line)" : "none",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--nf-ink-3)", fontWeight: 600 }}>{inv.period}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "var(--nf-ink)" }}>{inv.amount}</span>
                  {inv.paid && (
                    <span style={{ color: "#2E8B57", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Check size={13} strokeWidth={2.5} aria-hidden />
                      Pagada
                    </span>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setInvoicesOpen(true)}
              style={{
                marginTop: 12,
                width: "100%",
                background: "transparent",
                color: "#123C66",
                border: "1px solid var(--nf-line)",
                borderRadius: 10,
                padding: "9px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Ver todas las facturas
            </button>
          </Card>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", margin: "0 0 16px", letterSpacing: "-0.02em" }}>Comparativa de planes</h3>
      <div className="nf-grid-stats" style={{ gap: 16 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.key === billing.plan;
          return (
            <Card
              key={plan.key}
              style={{
                padding: 0,
                overflow: "hidden",
                border: isCurrent ? "2px solid #123C66" : "1px solid var(--nf-line)",
                borderRadius: 14,
                boxShadow: isCurrent ? "0 14px 40px -24px rgba(18, 60, 102, 0.28)" : "0 1px 0 rgba(18, 60, 102, 0.04)",
              }}
            >
              <div style={{ height: 4, background: isCurrent ? "linear-gradient(90deg, #123C66, #2E8B57)" : "linear-gradient(90deg, #e2e8f0, #cbd5e1)" }} />
              <div style={{ padding: "18px 18px 20px", position: "relative" }}>
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 14,
                      background: "#123C66",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: 99,
                      letterSpacing: "0.03em",
                    }}
                  >
                    ACTUAL
                  </div>
                )}
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--nf-ink)", marginBottom: 6, letterSpacing: "-0.02em" }}>{plan.name}</div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: "#123C66", letterSpacing: "-0.03em" }}>{plan.price}</span>
                  <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontWeight: 600 }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--nf-ink-3)", margin: "0 0 14px", lineHeight: 1.55, fontWeight: 500 }}>{plan.desc}</p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13, alignItems: "flex-start" }}>
                      <Check size={16} strokeWidth={2.25} color="#2E8B57" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                      <span style={{ color: "var(--nf-ink)", fontWeight: 500 }}>{f}</span>
                    </li>
                  ))}
                </ul>
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
                    marginTop: 18,
                    width: "100%",
                    background: isCurrent ? "var(--nf-app-surface-2)" : "#123C66",
                    color: isCurrent ? "var(--nf-ink-3)" : "#fff",
                    border: `1.5px solid ${isCurrent ? "var(--nf-line)" : "#123C66"}`,
                    borderRadius: 10,
                    padding: "10px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isCurrent ? "default" : "pointer",
                  }}
                >
                  {isCurrent ? "Plan actual" : plan.key === "ENTERPRISE" ? "Contactar / simular Enterprise" : "Seleccionar plan (demo)"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={enterpriseOpen} onClose={() => setEnterpriseOpen(false)} title="Actualizar a Enterprise (simulación)" width={480}>
        <p style={{ fontSize: 14, color: "var(--nf-ink)", lineHeight: 1.6 }}>
          En producción aquí se abriría un flujo con ventas o Stripe Checkout. En esta sesión solo actualizamos el plan en memoria para que puedas probar la UI.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={simulateEnterprise} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Confirmar upgrade demo
          </button>
          <button type="button" onClick={() => setEnterpriseOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={stripeOpen} onClose={() => setStripeOpen(false)} title="Portal de cliente Stripe" width={480}>
        <p style={{ fontSize: 14, color: "var(--nf-ink-3)", lineHeight: 1.6 }}>
          La integración con Stripe Customer Portal no está conectada. No usamos enlaces reales para evitar confusiones. Cuando el backend esté listo, este botón abrirá una sesión segura de Stripe.
        </p>
        <button type="button" onClick={copyStripeDemo} style={{ marginTop: 14, width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Copiar texto de ejemplo (placeholder)
        </button>
      </Modal>

      <Modal open={invoicesOpen} onClose={() => setInvoicesOpen(false)} title="Todas las facturas (demo)" width={640}>
        <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 0 }}>Listado generado en el estado de la aplicación; no se obtiene de Stripe.</p>
        <Card style={{ padding: 0 }}>
          <DataTable columns={invoiceColumns} rows={billing.invoices} emptyText="Sin facturas en el estado demo" />
        </Card>
      </Modal>
    </div>
  );
}
