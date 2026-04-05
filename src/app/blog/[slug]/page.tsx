import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { BLOG_POSTS } from "@/lib/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  return {
    title: post ? `${post.title} | NormaFlow` : "Artículo | NormaFlow",
    description: post?.excerpt,
  };
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
    description: post.excerpt,
    publisher: { "@type": "Organization", name: "NormaFlow" },
  };

  return (
    <MarketingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article style={{ background: "#fff", padding: "48px 0 72px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/blog" style={{ fontSize: 14, color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
            ← Blog
          </Link>
          <div style={{ fontSize: 13, color: "#123C66", fontWeight: 600, marginTop: 20 }}>{post.category}</div>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: "#142033", margin: "10px 0 12px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>{post.title}</h1>
          <p style={{ fontSize: 14, color: "#5E6B7A", marginBottom: 32 }}>
            {post.date} · {post.readTime}
          </p>
          <div style={{ fontSize: 17, color: "#142033", lineHeight: 1.8 }}>
            {post.body.map((para, i) => (
              <p key={i} style={{ margin: "0 0 18px" }}>
                {para}
              </p>
            ))}
          </div>
          <Link href="/demo" style={{ display: "inline-block", marginTop: 24, background: "#123C66", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>
            Hablar con el equipo
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}
