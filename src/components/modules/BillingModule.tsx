"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { CalendarDays, Check, CreditCard, HardDrive, Receipt, Sparkles, Users, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import { useWorkspace } from "@/context/WorkspaceStore";
import { changePlan, createBillingPortalSession, createCheckoutSession } from "@/lib/actions/billing";
import type { BillingPayload } from "@/lib/server-queries";
import { PLAN_CATALOG, type PlanKey } from "@/lib/constants";

const DEMO_PLANS = (Object.keys(PLAN_CATALOG) as PlanKey[]).map((key) => ({
  key,
  name: PLAN_CATALOG[key].label,
  price: PLAN_CATALOG[key].monthlyUsd,
  currency: PLAN_CATALOG[key].currency,
  features: PLAN_CATALOG[key].features,
  checkoutConfigured: false,
}));

function metric(icon: ReactNode, label: string, value: string) {
  return <div style={{ background: "#f8fafc", border: "1px solid var(--nf-line, #b8c8d9)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}><span style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(82, 102, 246,.08)", display: "grid", placeItems: "center", color: "#5266F6" }}>{icon}</span><span><small style={{ display: "block", color: "var(--nf-ink-3, #314456)", fontWeight: 700 }}>{label}</small><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{value}</strong></span></div>;
}

function money(price: number | null, currency = "usd") {
  if (price == null) return "A medida";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(price);
}

export default function BillingModule({ liveData }: { liveData?: BillingPayload }) {
  const router = useRouter();
  const { state, showToast } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const live = liveData !== undefined;
  const planKey = liveData?.plan ?? state.billing.plan;
  const currentPlan = (liveData?.plans ?? DEMO_PLANS).find((plan) => plan.key === planKey) ?? (liveData?.plans ?? DEMO_PLANS)[0];
  const plans = liveData?.plans ?? DEMO_PLANS;
  const usage = liveData?.usage ?? { users: 18, userLimit: 20, storageBytes: 4.2 * 1024 ** 3, storageLimitGb: 50, documents: 8, auditsThisMonth: 2, exportsThisMonth: 2 };
  const usedGb = usage.storageBytes / 1024 ** 3;
  const storagePct = usage.storageLimitGb == null ? 0 : Math.min(100, (usedGb / usage.storageLimitGb) * 100);
  const status = liveData?.status ?? (live ? null : "ACTIVE");
  const trialActive = liveData?.trialActive ?? false;
  const exportLimit = liveData?.entitlements.exportsPerMonth;
  const exportPct = exportLimit == null ? 0 : Math.min(100, (usage.exportsThisMonth / exportLimit) * 100);

  function launch(action: () => Promise<{ url?: string; updated?: boolean }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.url) window.location.assign(result.url);
        else { router.refresh(); showToast("El cambio de plan se ha solicitado correctamente."); }
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo iniciar el flujo de facturación"); }
    });
  }

  return <div>
    <SectionTitle title="Billing y suscripción" sub={live ? "Suscripción, límites, consumo y facturas sincronizados con Stripe." : "Vista de demostración de los planes comerciales."} />

    {live && trialActive && <Card style={{ padding: 17, marginBottom: 18, borderColor: "#5266F6", background: "#f3f5ff" }}><strong style={{ color: "#3344bd" }}>Trial activo · {liveData.trialDaysRemaining ?? 0} días restantes</strong><span style={{ display: "block", marginTop: 5, color: "#5e6b7a", fontSize: 13 }}>Prueba NormaFlow sin tarjeta. Elige un plan cuando quieras conservar el acceso después del trial.</span></Card>}
    {live && !liveData.stripeConfigured && <Card style={{ padding: 16, marginBottom: 18, borderColor: "#D97706" }}><strong style={{ color: "#9a6510" }}>Stripe no está configurado.</strong><span style={{ marginLeft: 8, color: "var(--nf-ink-3)", fontSize: 13 }}>Checkout, portal y sincronización de webhooks permanecerán deshabilitados hasta configurar las variables Stripe.</span></Card>}
    {live && usage.userLimit != null && usage.users >= usage.userLimit && <Card style={{ padding: 14, marginBottom: 18, borderColor: "#efb0ab", background: "#fff7f6", color: "#9c302a", fontSize: 13 }}><strong>Límite de usuarios alcanzado.</strong> Puedes seguir usando el workspace, pero no añadir nuevos miembros hasta actualizar el plan.</Card>}
    {live && usage.storageLimitGb != null && usedGb >= usage.storageLimitGb && <Card style={{ padding: 14, marginBottom: 18, borderColor: "#efb0ab", background: "#fff7f6", color: "#9c302a", fontSize: 13 }}><strong>Límite de almacenamiento alcanzado.</strong> Las nuevas cargas quedarán bloqueadas de forma suave hasta actualizar el plan.</Card>}

    <div className="nf-kpi-summary" style={{ marginBottom: 18 }}><div className="nf-kpi-summary-cell"><CreditCard size={22} color="#5266F6" /><div><strong style={{ fontSize: 20, color: "var(--nf-ink, #0f1b2d)" }}>{currentPlan.name}</strong><div className="nf-app-help">{money(currentPlan.price, currentPlan.currency)}{currentPlan.price == null ? "" : " / mes"}</div></div></div><div className="nf-kpi-summary-cell"><CalendarDays size={22} color="#5266F6" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{liveData?.currentPeriodEnd ? new Date(liveData.currentPeriodEnd).toLocaleDateString("es-ES") : trialActive ? "Trial" : "Sin fecha"}</strong><div className="nf-app-help">{trialActive ? "Fin del trial" : "Fin del periodo"}</div></div></div><div className="nf-kpi-summary-cell"><HardDrive size={22} color="#16A34A" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{usedGb.toFixed(2)} GB</strong><div className="nf-app-help">de {usage.storageLimitGb == null ? "ilimitado" : `${usage.storageLimitGb} GB`}</div></div></div><div className="nf-kpi-summary-cell"><Users size={22} color="#16A34A" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{usage.users}{usage.userLimit != null ? ` / ${usage.userLimit}` : ""}</strong><div className="nf-app-help">Usuarios activos</div></div></div></div>

    <Card style={{ marginBottom: 22, padding: 20 }}><div className="nf-grid-stats" style={{ gap: 12, marginBottom: 18 }}>{metric(<Users size={18} />, "Usuarios", `${usage.users}${usage.userLimit != null ? ` / ${usage.userLimit}` : " / ilimitados"}`)}{metric(<HardDrive size={18} />, "Almacenamiento", `${usedGb.toFixed(2)}${usage.storageLimitGb == null ? " GB" : ` / ${usage.storageLimitGb} GB`}`)}{metric(<Receipt size={18} />, "Documentos", String(usage.documents))}{metric(<Zap size={18} />, "Exportes", `${usage.exportsThisMonth}${exportLimit == null ? " / ilimitados" : ` / ${exportLimit}`}`)}</div><ProgressBar value={storagePct} color={storagePct >= 90 ? "#D97706" : "#16A34A"} height={7} railColor="#eef2f9" /><div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--nf-ink-3)" }}><span>Storage {storagePct.toFixed(0)}%</span>{exportLimit != null && <span>· Exportes {exportPct.toFixed(0)}%</span>}</div><div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}><button className="nf-app-btn-primary" disabled={!live || pending || !liveData.canManage || !liveData.stripeConfigured || !liveData.status} onClick={() => launch(createBillingPortalSession)}>{pending ? "Abriendo…" : "Gestionar suscripción en Stripe"}</button>{status && <span className="nf-chip nf-chip--on">{status.replaceAll("_", " ")}{liveData?.cancelAtPeriodEnd ? " · cancelación programada" : ""}</span>}</div></Card>

    <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 17, marginBottom: 14, fontWeight: 700, color: "var(--nf-ink, #0f1b2d)" }}><CreditCard size={18} /> Planes comerciales</h3><div className="nf-grid-stats nf-billing-plans" style={{ gap: 16, marginBottom: 24 }}>{plans.map((plan) => { const current = plan.key === planKey; const isEnterprise = plan.key === "ENTERPRISE"; return <Card key={plan.key} style={{ padding: 18, border: current ? "2px solid #5266F6" : "1px solid var(--nf-line, #b8c8d9)", position: "relative" }}>{plan.key === "GROWTH" && <span style={{ position: "absolute", right: 14, top: 14, color: "#5266F6", background: "#eef0ff", padding: "4px 7px", borderRadius: 20, fontSize: 10, fontWeight: 800 }}>MÁS POPULAR</span>}<strong style={{ fontSize: 18, color: "var(--nf-ink, #0f1b2d)" }}>{plan.name}</strong><div style={{ fontSize: 28, fontWeight: 900, color: "#5266F6", margin: "8px 0" }}>{money(plan.price, plan.currency)}<small style={{ fontSize: 12 }}>{plan.price == null ? "" : " / mes"}</small></div><ul style={{ paddingLeft: 0, listStyle: "none", minHeight: 138 }}>{plan.features.map((item) => <li key={item} style={{ display: "flex", gap: 7, margin: "8px 0", fontSize: 13 }}><Check size={15} color="#16A34A" />{item}</li>)}</ul><button className={current ? "nf-app-btn-ghost" : "nf-app-btn-primary"} disabled={current || pending || !live || !liveData.canManage || (isEnterprise ? false : !plan.checkoutConfigured)} onClick={() => { if (isEnterprise) window.location.href = "/demo"; else launch(liveData?.hasStripeSubscription ? () => changePlan(plan.key as "STARTER" | "GROWTH") : () => createCheckoutSession(plan.key as "STARTER" | "GROWTH")); }}>{current ? "Plan actual" : isEnterprise ? "Contactar ventas" : plan.checkoutConfigured ? "Actualizar plan" : "Checkout no configurado"}</button></Card>; })}</div>

    <h3 style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 17, fontWeight: 700, color: "var(--nf-ink, #0f1b2d)" }}><Receipt size={18} /> Historial de facturas</h3><Card className="nf-billing-invoices" style={{ padding: 0, overflow: "hidden" }}>{liveData?.invoices.length ? liveData.invoices.map((invoice, index) => <div key={invoice.id} style={{ padding: "13px 16px", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", borderBottom: index < liveData.invoices.length - 1 ? "1px solid var(--nf-line, #b8c8d9)" : "none", flexWrap: "wrap" }}><div style={{ minWidth: 0 }}><strong style={{ display: "block", color: "var(--nf-ink, #0f1b2d)", fontWeight: 700, fontSize: 14 }}>{invoice.number ?? "Factura Stripe"}</strong><div className="nf-app-help" style={{ marginTop: 4, color: "var(--nf-ink-2, #223648)" }}>{new Date(invoice.createdAt).toLocaleDateString("es-ES")} · {invoice.status}</div></div><div style={{ display: "flex", gap: 12, alignItems: "center" }}><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{money(invoice.amountDue / 100, invoice.currency)}</strong>{(invoice.invoicePdf ?? invoice.hostedInvoiceUrl) && <a className="nf-app-btn-outline" href={invoice.invoicePdf ?? invoice.hostedInvoiceUrl ?? "#"} target="_blank" rel="noreferrer">Abrir</a>}</div></div>) : <p className="nf-app-help" style={{ padding: 20, margin: 0, color: "var(--nf-ink-2, #223648)" }}>{live ? "Todavía no hay facturas sincronizadas." : "Las facturas demo no se muestran como datos reales."}</p>}</Card>
    <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--nf-ink-3)", fontSize: 12, marginTop: 18 }}><Sparkles size={14} /> Los cambios de plan se prorratean en Stripe. El acceso se actualiza cuando el webhook confirma el estado.</div>
  </div>;
}
