import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { MARKETING_CASES } from "@/lib/marketing-cases";
import { Ic } from "@/components/marketing/nf/Icons";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl, breadcrumbJsonLd, createMarketingMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return MARKETING_CASES.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = MARKETING_CASES.find(x => x.slug === slug);
  return createMarketingMetadata({
    title: c ? `${c.company} — Caso de éxito | NormaFlow` : "Caso de éxito | NormaFlow",
    description: c?.challenge || "Caso de éxito sobre la gestión de sistemas ISO con NormaFlow.",
    path: `/cases/${slug}`,
  });
}

export default async function CaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = MARKETING_CASES.find(x => x.slug === slug);
  if (!c) notFound();

  return (
    <MarketingLayout>
      {/* Sin `Article`: declararlo haría que los buscadores indexaran un
          escenario ilustrativo como un artículo publicado sobre hechos reales.
          Las migas sí se mantienen: describen la navegación, no el contenido. */}
      <JsonLd data={[breadcrumbJsonLd([{ name: "Inicio", path: "/home" }, { name: "Casos de éxito", path: "/cases" }, { name: c.company, path: `/cases/${c.slug}` }])]} />
      <article className="nf-section">
        <div className="nf-container" style={{ maxWidth: 800 }}>
          <Link href="/cases" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--nf-ink-3)" }}>
            ← Casos de éxito
          </Link>
          <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nf-primary-subtle)", color: "var(--nf-primary-active)", border: "1px solid var(--nf-primary-border)", letterSpacing: "0.06em" }}>{c.industry}</span>
            <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nf-glass-2)", color: "var(--nf-ink-2)", border: "1px solid var(--nf-line)" }}>{c.normas}</span>
          </div>
          <h1 className="nf-h-section" style={{ marginTop: 18 }}>{c.company}</h1>
          <p className="nf-case-illustrative" role="note">
            <strong>Escenario ilustrativo.</strong> Esta empresa y las personas
            que aparecen son los datos de ejemplo del producto. Describe un uso
            plausible de NormaFlow, no resultados obtenidos por un cliente.
          </p>
          <p style={{ fontSize: 20, color: "var(--nf-primary-active)", fontWeight: 600, marginTop: 14, marginBottom: 36, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
            ↑ {c.result}
          </p>

          <div className="nf-prose">
            <h2>Contexto</h2>
            <p>{c.challenge}</p>

            <h2>Qué hicieron con NormaFlow</h2>
            <p>{c.solution}</p>

            <h2>Resultados medibles</h2>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16, marginBottom: 36 }}>
            {c.metrics.map((m) => (
              <div key={m.label} style={{ border: "1px solid var(--nf-line)", borderRadius: 12, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "var(--nf-glass-2)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--nf-ink)" }}>{m.label}</span>
                <span style={{ color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                  <span style={{ textDecoration: "line-through", marginRight: 10 }}>{m.before}</span>
                  <span style={{ color: "var(--nf-primary-active)", fontWeight: 700 }}>{m.after}</span>
                </span>
              </div>
            ))}
          </div>

          <blockquote style={{
            borderLeft: "3px solid var(--nf-accent)",
            paddingLeft: 22,
            margin: "0 0 32px",
            fontSize: 18,
            color: "var(--nf-ink)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            lineHeight: 1.6,
            letterSpacing: "-0.01em",
          }}>
            &ldquo;{c.quote}&rdquo;
          </blockquote>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, oklch(0.55 0.04 30), oklch(0.45 0.06 30))", display: "grid", placeItems: "center", color: "var(--nf-c-neutral-0)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{c.initials}</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--nf-ink)" }}>{c.person}</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>{c.role}</div>
            </div>
          </div>

          <Link href="/demo" className="nf-btn nf-btn--primary">
            Solicitar una demo <Ic.arrow className="nf-arrow"/>
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}
