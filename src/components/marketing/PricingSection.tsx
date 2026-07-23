"use client";
import { useState } from "react";
import { Ic } from "@/components/marketing/nf/Icons";
import { PLAN_CATALOG, PLAN_LIMITS, ENTERPRISE_LIFETIME_FROM_USD, ENTERPRISE_MAINTENANCE_FROM_USD } from "@/lib/constants";

type Mode = "saas" | "lifetime";

type Plan = {
  name: string;
  saasPrice: string;
  saasUnit: string;
  lifetimePrice: string;
  lifetimeUnit: string;
  tag: string;
  features: string[];
  cta: string;
  popular: boolean;
  href: string;
};

const STARTER_USERS = PLAN_LIMITS.STARTER.maxUsers!;
const GROWTH_USERS = PLAN_LIMITS.GROWTH.maxUsers!;
const STARTER_SAAS = PLAN_LIMITS.STARTER.saasMonthlyUsd!;
const GROWTH_SAAS  = PLAN_LIMITS.GROWTH.saasMonthlyUsd!;
const STARTER_LIFETIME = PLAN_LIMITS.STARTER.lifetimeUsd!;
const GROWTH_LIFETIME  = PLAN_LIMITS.GROWTH.lifetimeUsd!;

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

const PLANS: Plan[] = [
  {
    name: "Starter",
    saasPrice: fmtUsd(STARTER_SAAS),    saasUnit: "USD / mes",
    lifetimePrice: fmtUsd(STARTER_LIFETIME), lifetimeUnit: "USD · pago único",
    tag: "Para implementar ISO sin caos",
    features: [
      ...PLAN_CATALOG.STARTER.features,
    ],
    cta: "Empezar 14 días gratis",
    popular: false,
    href: "/signup",
  },
  {
    name: "Growth",
    saasPrice: fmtUsd(GROWTH_SAAS),     saasUnit: "USD / mes",
    lifetimePrice: fmtUsd(GROWTH_LIFETIME), lifetimeUnit: "USD · pago único",
    tag: "Para equipos en mantenimiento activo",
    features: [
      ...PLAN_CATALOG.GROWTH.features,
    ],
    cta: "Probar 14 días",
    popular: true,
    href: "/signup",
  },
  {
    name: "Enterprise",
    saasPrice: "A medida",   saasUnit: "",
    lifetimePrice: `desde ${fmtUsd(ENTERPRISE_LIFETIME_FROM_USD)}`,   lifetimeUnit: "USD · pago único",
    tag: "Para multi-organización y SLA",
    features: [
      ...PLAN_CATALOG.ENTERPRISE.features,
    ],
    cta: "Hablar con ventas",
    popular: false,
    href: "/demo",
  },
];

export default function PricingSection() {
  const [mode, setMode] = useState<Mode>("saas");

  return (
    <section className="nf-section" id="precios">
      <div className="nf-container">
        <div style={{ maxWidth: 740, textAlign: "center", margin: "0 auto" }}>
          <span className="nf-eyebrow"><span className="dot"/> Precios</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Tres planes. <span className="nf-grad-text">Una sola plataforma.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto" }}>
            Elige cómo prefieres usar NormaFlow: suscripción mensual gestionada por nosotros, o licencia única para instalar en tu propia infraestructura.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: "inline-flex",
          margin: "32px auto 0",
          padding: 4,
          borderRadius: 999,
          border: "1px solid var(--nf-line-2)",
          background: "var(--nf-glass)",
          backdropFilter: "blur(12px)",
        }}>
          <button
            type="button"
            onClick={() => setMode("saas")}
            style={toggleBtn(mode === "saas")}
          >
            SaaS · mensual
          </button>
          <button
            type="button"
            onClick={() => setMode("lifetime")}
            style={toggleBtn(mode === "lifetime")}
          >
            Self-hosted · lifetime
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", textAlign: "center", maxWidth: 560 }}>
            {mode === "saas"
              ? "14 días de prueba gratis. Sin tarjeta, sin compromiso. Hosting, respaldos y actualizaciones incluidos."
              : "Pago único. Te entregamos el software listo para desplegar en tu propio Supabase + Vercel. Instalación remota + 12 meses de actualizaciones incluidos."}
          </p>
        </div>

        <div className="nf-pricing-grid" style={{ marginTop: 32 }}>
          {PLANS.map((p, i) => {
            const price = mode === "saas" ? p.saasPrice : p.lifetimePrice;
            const unit = mode === "saas" ? p.saasUnit : p.lifetimeUnit;
            return (
              <div key={p.name} className={`nf-price-card ${p.popular ? "popular" : ""}`} style={{ transitionDelay: `${i * 60}ms` }}>
                {p.popular && <span className="nf-popular-badge">Más popular</span>}
                <div className="name">{p.name}</div>
                <div className="price">
                  {price}
                  {unit && <span className="unit"> {unit}</span>}
                </div>
                <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>{p.tag}</div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <span style={{ flexShrink: 0, marginTop: 1, color: "var(--nf-accent)" }}><Ic.check/></span>{f}
                    </li>
                  ))}
                  {mode === "lifetime" && p.name !== "Enterprise" && (
                    <li>
                      <span style={{ flexShrink: 0, marginTop: 1, color: "var(--nf-accent)" }}><Ic.check/></span>
                      Instalación remota + 12 meses de actualizaciones
                    </li>
                  )}
                </ul>
                <a href={p.href} className={`nf-btn ${p.popular ? "nf-btn--primary" : "nf-btn--ghost"}`} style={{ justifyContent: "center" }}>
                  {p.cta} <Ic.arrow className="nf-arrow"/>
                </a>
              </div>
            );
          })}
        </div>

        {mode === "lifetime" && (
          <p style={{ marginTop: 24, fontSize: 12, color: "var(--nf-ink-4)", textAlign: "center", maxWidth: 640, marginInline: "auto" }}>
            Mantenimiento anual opcional desde el año 2 (actualizaciones ISO, parches y soporte):
            Starter ${PLAN_LIMITS.STARTER.maintenanceYearlyUsd}/año ·
            Growth ${PLAN_LIMITS.GROWTH.maintenanceYearlyUsd}/año ·
            Enterprise desde ${ENTERPRISE_MAINTENANCE_FROM_USD}/año (USD).
          </p>
        )}
      </div>
    </section>
  );
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--nf-ink)" : "transparent",
    color: active ? "var(--nf-bg-1)" : "var(--nf-ink-2)",
    transition: "background 0.15s, color 0.15s",
  };
}
