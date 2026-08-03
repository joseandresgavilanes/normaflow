import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { Ic } from "@/components/marketing/nf/Icons";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl, breadcrumbJsonLd, createMarketingMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return BLOG_POSTS.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  return createMarketingMetadata({
    title: post ? `${post.title} | NormaFlow` : "Artículo | NormaFlow",
    description: post?.excerpt || "Recursos de NormaFlow sobre sistemas de gestión ISO.",
    path: `/blog/${slug}`,
  });
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    description: post.excerpt,
    author: { "@type": "Organization", name: "Equipo NormaFlow", url: absoluteUrl("/home") },
    publisher: { "@type": "Organization", name: "NormaFlow", url: absoluteUrl("/home") },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <MarketingLayout>
      <JsonLd data={[jsonLd, breadcrumbJsonLd([{ name: "Inicio", path: "/home" }, { name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }])]} />
      <article className="nf-section">
        <div className="nf-container" style={{ maxWidth: 760 }}>
          <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--nf-ink-3)" }}>
            ← Blog
          </Link>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-accent)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 24 }}>{post.category}</div>
          <h1 className="nf-h-section" style={{ marginTop: 14 }}>{post.title}</h1>
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 14, marginBottom: 36, fontFamily: "var(--font-mono)" }}>
            <time dateTime={post.date}>{post.date}</time> · {post.readTime} · Equipo NormaFlow
          </p>

          <div className="nf-prose">
            {post.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div style={{ marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--nf-line)" }}>
            <Link href="/demo" className="nf-btn nf-btn--primary">
              Hablar con el equipo <Ic.arrow className="nf-arrow"/>
            </Link>
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
}
