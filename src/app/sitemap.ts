import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { MARKETING_CASES } from "@/lib/marketing-cases";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  ["/home", 1, "weekly"], ["/features", 0.9, "monthly"], ["/pricing", 0.8, "monthly"], ["/demo", 0.8, "monthly"],
  ["/solutions/gap-assessment", 0.9, "monthly"], ["/blog", 0.8, "weekly"], ["/cases", 0.7, "monthly"], ["/sig", 0.8, "monthly"],
  ["/iso9001", 0.9, "monthly"], ["/iso27001", 0.9, "monthly"], ["/iso14001", 0.8, "monthly"], ["/iso45001", 0.8, "monthly"],
  ["/iso22301", 0.8, "monthly"], ["/iso42001", 0.8, "monthly"], ["/iso20000", 0.8, "monthly"], ["/iso37301", 0.8, "monthly"],
  ["/iso37001", 0.8, "monthly"], ["/iso50001", 0.8, "monthly"], ["/iso22000", 0.8, "monthly"], ["/iso13485", 0.8, "monthly"],
  ["/legal/privacy", 0.3, "yearly"], ["/legal/security", 0.5, "monthly"], ["/legal/terms", 0.3, "yearly"],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticRoutes.map(([path, priority, changeFrequency]) => ({ url: absoluteUrl(path), priority, changeFrequency })),
    ...BLOG_POSTS.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(`${post.date}T00:00:00.000Z`), priority: 0.7, changeFrequency: "yearly" as const })),
    ...MARKETING_CASES.map((marketingCase) => ({ url: absoluteUrl(`/cases/${marketingCase.slug}`), priority: 0.6, changeFrequency: "yearly" as const })),
  ];
}
