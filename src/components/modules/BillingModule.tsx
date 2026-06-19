"use client";

import { useTransition, type ReactNode } from "react";
import { CalendarDays, Check, CreditCard, HardDrive, Receipt, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import { useWorkspace } from "@/context/WorkspaceStore";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/actions/billing";
import type { BillingPayload } from "@/lib/server-queries";

const PLANS = [
  { key: "STARTER" as const, name: "Starter", price: "€99", period: "/mes", features: ["5 usuarios", "5 GB de almacenamiento", "Soporte email"] },
  { key: "GROWTH" as const, name: "Growth", price: "€299", period: "/mes", features: ["50 usuarios", "25 GB de almacenamiento", "Todos los módulos"] },
  { key: "ENTERPRISE" as const, name: "Enterprise", price: "A medida", period: "", features: ["Usuarios ampliables", "100 GB de almacenamiento", "Soporte dedicado"] },
];

function metric(icon: ReactNode, label: string, value: string) {
  return <div style={{ background: "#f8fafc", border: "1px solid var(--nf-line, #b8c8d9)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
    <span style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(18,60,102,.08)", display: "grid", placeItems: "center", color: "#123C66" }}>{icon}</span>
    <span><small style={{ display: "block", color: "var(--nf-ink-3, #314456)", fontWeight: 700, textTransform: "uppercase" }}>{label}</small><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{value}</strong></span>
  </div>;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function BillingModule({ liveData }: { liveData?: BillingPayload }) {
  const { state, showToast } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const live = liveData !== undefined;
  const planKey = liveData?.plan ?? state.billing.plan;
  const currentPlan = PLANS.find(plan => plan.key === planKey) ?? PLANS[1];
  const usage = liveData?.usage ?? { users: 18, userLimit: 50, storageBytes: 4.2 * 1024 ** 3, storageLimitGb: 25, documents: 8, auditsThisMonth: 2 };
  const usedGb = usage.storageBytes / 1024 ** 3;
  const storagePct = Math.min(100, usage.storageLimitGb > 0 ? (usedGb / usage.storageLimitGb) * 100 : 0);
  const status = liveData?.status ?? (live ? null : "ACTIVE");

  function launch(action: () => Promise<{ url: string }>) {
    startTransition(async () => {
      try {
        const { url } = await action();
        window.location.assign(url);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo iniciar el flujo de facturación");
      }
    });
  }

  return <div>
    <SectionTitle title="Billing y suscripción" sub={live ? "Suscripción, consumo y facturas persistidos en Supabase y sincronizados por Stripe." : "Vista de demostración de facturación."} />

    {live && !liveData.stripeConfigured && <Card style={{ padding: 16, marginBottom: 18, borderColor: "#D68A1A" }}>
      <strong style={{ color: "#9a6510" }}>Stripe no está configurado.</strong>
      <span style={{ marginLeft: 8, color: "var(--nf-ink-3)", fontSize: 13 }}>Los datos guardados siguen visibles, pero Checkout y el portal permanecen deshabilitados.</span>
    </Card>}

    <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
      <div className="nf-kpi-summary-cell"><CreditCard size={22} color="#123C66" /><div><strong style={{ fontSize: 20, color: "var(--nf-ink, #0f1b2d)" }}>{currentPlan.name}</strong><div className="nf-app-help">{currentPlan.price}{currentPlan.period}</div></div></div>
      <div className="nf-kpi-summary-cell"><CalendarDays size={22} color="#123C66" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{liveData?.currentPeriodEnd ? new Date(liveData.currentPeriodEnd).toLocaleDateString("es-ES") : "Sin fecha"}</strong><div className="nf-app-help">Fin del periodo</div></div></div>
      <div className="nf-kpi-summary-cell"><HardDrive size={22} color="#2E8B57" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{storagePct.toFixed(1)}%</strong><div className="nf-app-help">Almacenamiento usado</div></div></div>
      <div className="nf-kpi-summary-cell"><Users size={22} color="#2E8B57" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{usage.users}</strong><div className="nf-app-help">Miembros</div></div></div>
    </div>

    <Card style={{ marginBottom: 22, padding: 20 }}>
      <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 18 }}>
        {metric(<Users size={18} />, "Usuarios", `${usage.users}${usage.userLimit > 0 ? ` / ${usage.userLimit}` : ""}`)}
        {metric(<HardDrive size={18} />, "Almacenamiento", `${usedGb.toFixed(2)} / ${usage.storageLimitGb} GB`)}
        {metric(<Receipt size={18} />, "Documentos", String(usage.documents))}
        {metric(<CalendarDays size={18} />, "Auditorías este mes", String(usage.auditsThisMonth))}
      </div>
      <ProgressBar value={storagePct} color="#2E8B57" height={7} railColor="#eef2f9" />
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button className="nf-app-btn-primary" disabled={!live || pending || !liveData.canManage || !liveData.stripeConfigured || !liveData.status} onClick={() => launch(createBillingPortalSession)}>
          {pending ? "Abriendo…" : "Gestionar en Stripe"}
        </button>
        {status && <span className="nf-chip nf-chip--on">{status.replaceAll("_", " ")}{liveData?.cancelAtPeriodEnd ? " · cancelación programada" : ""}</span>}
      </div>
    </Card>

    <h3 style={{ fontSize: 16, marginBottom: 14, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>Planes</h3>
    <div className="nf-grid-stats nf-billing-plans" style={{ gap: 16, marginBottom: 24 }}>
      {PLANS.map(plan => {
        const current = plan.key === planKey;
        const checkoutReady = plan.key === "STARTER" ? liveData?.checkoutConfigured.STARTER : plan.key === "GROWTH" ? liveData?.checkoutConfigured.GROWTH : false;
        return <Card key={plan.key} style={{ padding: 18, border: current ? "2px solid #123C66" : "1px solid var(--nf-line, #b8c8d9)" }}>
          <strong style={{ fontSize: 18, color: "var(--nf-ink, #0f1b2d)" }}>{plan.name}</strong>
          <div style={{ fontSize: 27, fontWeight: 900, color: "#123C66", margin: "8px 0" }}>{plan.price}<small style={{ fontSize: 12 }}>{plan.period}</small></div>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>{plan.features.map(item => <li key={item} style={{ display: "flex", gap: 7, margin: "8px 0", fontSize: 13 }}><Check size={15} color="#2E8B57" />{item}</li>)}</ul>
          <button className={current ? "nf-app-btn-ghost" : "nf-app-btn-primary"} disabled={current || pending || !live || !liveData.canManage || !checkoutReady} onClick={() => {
            if (plan.key !== "ENTERPRISE") launch(() => createCheckoutSession(plan.key));
          }}>
            {current ? "Plan actual" : plan.key === "ENTERPRISE" ? "Contactar ventas" : checkoutReady ? "Seleccionar plan" : "Checkout no configurado"}
          </button>
        </Card>;
      })}
    </div>

    <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 16, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}><Receipt size={18} />Facturas</h3>
    <Card className="nf-billing-invoices" style={{ padding: 0, overflow: "hidden" }}>
      {liveData?.invoices.length ? liveData.invoices.map((invoice, index) => <div key={invoice.id} style={{ padding: "13px 16px", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", borderBottom: index < liveData.invoices.length - 1 ? "1px solid var(--nf-line, #b8c8d9)" : "none", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", color: "var(--nf-ink, #0f1b2d)", fontWeight: 700, fontSize: 14 }}>{invoice.number ?? "Factura Stripe"}</strong>
          <div className="nf-app-help" style={{ marginTop: 4, color: "var(--nf-ink-2, #223648)" }}>{new Date(invoice.createdAt).toLocaleDateString("es-ES")} · {invoice.status}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{money(invoice.amountDue, invoice.currency)}</strong>{(invoice.invoicePdf ?? invoice.hostedInvoiceUrl) && <a className="nf-app-btn-outline" href={invoice.invoicePdf ?? invoice.hostedInvoiceUrl ?? "#"} target="_blank" rel="noreferrer">Abrir</a>}</div>
      </div>) : <p className="nf-app-help" style={{ padding: 20, margin: 0, color: "var(--nf-ink-2, #223648)" }}>{live ? "Todavía no hay facturas sincronizadas." : "Las facturas demo no se muestran como datos reales."}</p>}
    </Card>
  </div>;
}
