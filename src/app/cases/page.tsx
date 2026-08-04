import Link from "next/link";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { MARKETING_CASES } from "@/lib/marketing-cases";
import { Ic } from "@/components/marketing/nf/Icons";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl, createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Casos de éxito de software ISO | NormaFlow",
  description: "Resultados y experiencias de equipos que gestionan calidad, seguridad y cumplimiento con NormaFlow.",
  path: "/cases",
});

export default function CasesPage() {
  const cases = MARKETING_CASES;
  return (
    <MarketingLayout>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Casos de éxito de NormaFlow",
        url: absoluteUrl("/cases"),
        // No se declaran como `Article`: son escenarios ilustrativos con los
        // datos demo del producto, no artículos sobre hechos reales.
        hasPart: cases.map((c) => ({ "@type": "WebPage", name: c.company, url: absoluteUrl(`/cases/${c.slug}`) })),
      }} />
      <section className="nf-section">
        <div className="nf-container">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
            <span className="nf-eyebrow"><span className="dot"/> Casos de éxito</span>
            <h1 className="nf-h-section" style={{ marginTop: 22 }}>
              Empresas que ya gestionan su cumplimiento <span className="nf-grad-text">con NormaFlow.</span>
            </h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 56 }}>
            {cases.map((c) => (
              <article
                key={c.company}
                className="nfm-card"
                style={{
                  padding: "clamp(24px, 4vw, 40px)",
                  display: "grid",
                  gridTemplateColumns: "1.1fr 1fr",
                  gap: "clamp(28px, 5vw, 56px)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nf-accent-soft)", color: "var(--nf-accent)", border: "1px solid rgba(82, 102, 246, 0.25)", letterSpacing: "0.06em" }}>{c.industry}</span>
                    <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nf-glass-2)", color: "var(--nf-ink-2)", border: "1px solid var(--nf-line)" }}>{c.normas}</span>
                    <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nf-glass-2)", color: "var(--nf-ink-2)", border: "1px solid var(--nf-line)" }}>{c.employees}</span>
                  </div>
                  <h3 className="nf-h-3">{c.company}</h3>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-accent)", marginTop: 8, marginBottom: 14 }}>↑ {c.result}</div>
                  <p style={{ fontSize: 15, color: "var(--nf-ink-2)", fontStyle: "italic", lineHeight: 1.7, margin: "0 0 18px" }}>&ldquo;{c.quote}&rdquo;</p>
                  <Link href={`/cases/${c.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--nf-accent)" }}>
                    Ver caso completo <Ic.arrow/>
                  </Link>
                </div>

                <div style={{ background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, oklch(0.7 0.06 30), oklch(0.55 0.04 30))", display: "grid", placeItems: "center", color: "var(--nf-c-neutral-0)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>
                      {c.initials}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--nf-ink)" }}>{c.person}</div>
                      <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{c.role} · {c.company}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {([
                      ["ISO certificadas", String(c.normas.split(" + ").length)],
                      ["Empleados", c.employees.split(" ")[0]],
                      ["Implementación", "< 6 m"],
                      ["Auditorías/año", "4+"],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="nf-case-metric" style={{ padding: 12 }}>
                        <div className="v" style={{ fontSize: 22 }}>{v}</div>
                        <div className="l">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
