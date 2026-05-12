import { Ic } from "@/components/marketing/nf/Icons";

type Plan = { name: string; price: string; tag: string; features: string[]; cta: string; popular: boolean; href: string };

const PLANS: Plan[] = [
  { name: "Starter",    price: "€179",   tag: "Para implantar ISO sin caos",          features: ["10 usuarios", "ISO 9001 + ISO 27001", "Módulos esenciales", "10 GB almacenamiento", "Soporte por email"], cta: "Empezar 14 días gratis", popular: false, href: "/signup" },
  { name: "Growth",     price: "€549",   tag: "Para equipos en mantenimiento activo", features: ["50 usuarios", "Todos los módulos", "Asistente IA incluido", "50 GB almacenamiento", "Soporte prioritario", "Onboarding guiado"], cta: "Probar 14 días", popular: true, href: "/signup" },
  { name: "Enterprise", price: "Custom", tag: "Para multi-organización y SLA",         features: ["Usuarios ilimitados", "Multi-organización", "Almacenamiento ilimitado", "SLA 99.9% garantizado", "Soporte dedicado · CSM", "API + integraciones · SSO"], cta: "Hablar con ventas", popular: false, href: "/demo" },
];

export default function PricingSection() {
  return (
    <section className="nf-section" id="precios">
      <div className="nf-container">
        <div style={{ maxWidth: 740, textAlign: "center", margin: "0 auto" }}>
          <span className="nf-eyebrow"><span className="dot"/> Precios</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Tres planes. <span className="nf-grad-text">Una sola plataforma.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto" }}>
            14 días de prueba en cualquier plan. Sin tarjeta, sin compromiso.
          </p>
        </div>

        <div className="nf-pricing-grid">
          {PLANS.map((p, i) => (
            <div key={p.name} className={`nf-price-card ${p.popular ? "popular" : ""}`} style={{ transitionDelay: `${i * 60}ms` }}>
              {p.popular && <span className="nf-popular-badge">Más popular</span>}
              <div className="name">{p.name}</div>
              <div className="price">
                {p.price}
                {p.price.startsWith("€") && <span className="unit"> / mes</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>{p.tag}</div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: "var(--nf-accent)" }}><Ic.check/></span>{f}
                  </li>
                ))}
              </ul>
              <a href={p.href} className={`nf-btn ${p.popular ? "nf-btn--primary" : "nf-btn--ghost"}`} style={{ justifyContent: "center" }}>
                {p.cta} <Ic.arrow className="nf-arrow"/>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
