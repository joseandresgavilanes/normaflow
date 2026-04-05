import Link from "next/link";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata = {
  title: "Recursos y blog — NormaFlow",
  description: "Artículos sobre ISO 9001, ISO 27001, auditorías, indicadores e implementación de sistemas de gestión.",
};

const categories = Array.from(new Set(BLOG_POSTS.map(p => p.category)));

export default function BlogPage() {
  return (
    <MarketingLayout>
      <section style={{ background: "#0D2E4E", padding: "clamp(40px, 8vw, 64px) 0 clamp(32px, 6vw, 48px)" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Recursos</div>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 800, color: "#fff", margin: "0 0 12px", lineHeight: 1.15 }}>Blog</h1>
          <p style={{ fontSize: "clamp(15px, 3.2vw, 17px)", color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.6 }}>Implementación, auditorías y mejora continua, sin relleno.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {categories.map(cat => (
              <span key={cat} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 99 }}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section style={{ background: "#F7F9FC", padding: "clamp(40px, 8vw, 56px) 0 clamp(48px, 10vw, 80px)" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>
          {BLOG_POSTS.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: "none", background: "#fff", border: "1px solid #E5EAF2", borderRadius: 14, padding: "clamp(18px, 4vw, 24px) clamp(18px, 4vw, 28px)", display: "block" }}
            >
              <div style={{ fontSize: 12, color: "#123C66", fontWeight: 600, marginBottom: 8 }}>{post.category}</div>
              <h2 style={{ fontSize: "clamp(17px, 4vw, 22px)", fontWeight: 800, color: "#142033", margin: "0 0 10px", lineHeight: 1.25 }}>{post.title}</h2>
              <p style={{ fontSize: 15, color: "#5E6B7A", lineHeight: 1.65, margin: "0 0 12px" }}>{post.excerpt}</p>
              <div style={{ fontSize: 13, color: "#5E6B7A" }}>
                {post.date} · {post.readTime}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
