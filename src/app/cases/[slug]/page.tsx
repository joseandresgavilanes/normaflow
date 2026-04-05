import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { MARKETING_CASES } from "@/lib/marketing-cases";

export function generateStaticParams() {
  return MARKETING_CASES.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = MARKETING_CASES.find(x => x.slug === slug);
  return { title: c ? `${c.company} — Caso de éxito | NormaFlow` : "Caso | NormaFlow" };
}

export default async function CaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = MARKETING_CASES.find(x => x.slug === slug);
  if (!c) notFound();

  return (
    <MarketingLayout>
      <article style={{ background: "#fff", padding: "56px 0 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/cases" style={{ fontSize: 14, color: "#123C66", textDecoration: "none", fontWeight: 600 }}>
            ← Casos de éxito
          </Link>
          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: c.color + "18", color: c.color, padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{c.industry}</span>
            <span style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", color: "#5E6B7A", padding: "4px 12px", borderRadius: 99, fontSize: 12 }}>{c.normas}</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#142033", margin: "16px 0 12px", letterSpacing: "-0.5px" }}>{c.company}</h1>
          <p style={{ fontSize: 18, color: "#2E8B57", fontWeight: 600, margin: "0 0 28px" }}>{c.result}</p>
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#142033", marginBottom: 10 }}>Contexto</h2>
            <p style={{ fontSize: 16, color: "#5E6B7A", lineHeight: 1.75, margin: 0 }}>{c.challenge}</p>
          </section>
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#142033", marginBottom: 10 }}>Qué hicieron con NormaFlow</h2>
            <p style={{ fontSize: 16, color: "#5E6B7A", lineHeight: 1.75, margin: 0 }}>{c.solution}</p>
          </section>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#142033", marginBottom: 14 }}>Resultados medibles</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {c.metrics.map(m => (
                <div key={m.label} style={{ border: "1px solid #E5EAF2", borderRadius: 12, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#142033" }}>{m.label}</span>
                  <span style={{ color: "#5E6B7A" }}>
                    <span style={{ textDecoration: "line-through", marginRight: 8 }}>{m.before}</span>
                    <span style={{ color: "#2E8B57", fontWeight: 700 }}>{m.after}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <blockquote style={{ borderLeft: `4px solid ${c.color}`, paddingLeft: 20, margin: "0 0 28px", fontSize: 17, color: "#142033", fontStyle: "italic", lineHeight: 1.7 }}>&ldquo;{c.quote}&rdquo;</blockquote>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{c.initials}</div>
            <div>
              <div style={{ fontWeight: 700, color: "#142033" }}>{c.person}</div>
              <div style={{ fontSize: 14, color: "#5E6B7A" }}>{c.role}</div>
            </div>
          </div>
          <Link href="/demo" style={{ display: "inline-block", background: "#123C66", color: "#fff", padding: "12px 22px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>
            Solicitar una demo
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}
