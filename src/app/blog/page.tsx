import Link from "next/link";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { Ic } from "@/components/marketing/nf/Icons";

export const metadata = {
  title: "Recursos y blog — NormaFlow",
  description: "Artículos sobre ISO 9001, ISO 27001, auditorías, indicadores e implementación de sistemas de gestión.",
};

const categories = Array.from(new Set(BLOG_POSTS.map(p => p.category)));

export default function BlogPage() {
  return (
    <MarketingLayout>
      <section className="nf-section">
        <div className="nf-container" style={{ maxWidth: 900 }}>
          <span className="nf-eyebrow"><span className="dot"/> Recursos</span>
          <h1 className="nf-h-section" style={{ marginTop: 22 }}>
            Blog. <span className="nf-grad-text-cool">Sin relleno.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            Implementación, auditorías y mejora continua — escrito por gente que sabe de qué habla.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <span key={cat} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-2)", border: "1px solid var(--nf-line)", padding: "5px 10px", borderRadius: 99, background: "var(--nf-glass-2)" }}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container" style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 16 }}>
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="nf-card"
              style={{ display: "block", padding: "clamp(20px, 3vw, 28px)", color: "inherit" }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-accent)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{post.category}</div>
              <h2 className="nf-h-3" style={{ marginBottom: 10 }}>{post.title}</h2>
              <p style={{ fontSize: 15, color: "var(--nf-ink-2)", lineHeight: 1.65, margin: "0 0 14px" }}>{post.excerpt}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nf-ink-3)" }}>
                <span>{post.date} · {post.readTime}</span>
                <span style={{ color: "var(--nf-accent)", display: "inline-flex", alignItems: "center", gap: 6 }}>Leer <Ic.arrow/></span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
