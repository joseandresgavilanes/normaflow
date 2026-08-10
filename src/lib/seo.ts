import type { Metadata } from "next";

export const SITE_NAME = "NormaFlow";
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://normaflow.io").replace(/\/$/, "");
export const SOCIAL_IMAGE_PATH = "/opengraph-image";

export function absoluteUrl(path = "") {
  return `${SITE_URL}${path.startsWith("/") || !path ? path : `/${path}`}`;
}

export function createMarketingMetadata({ title, description, path, keywords }: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title: { absolute: title },
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: "website", locale: "es_ES", images: [{ url: absoluteUrl(SOCIAL_IMAGE_PATH), width: 1200, height: 630, alt: "NormaFlow — software de gestión ISO" }] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(SOCIAL_IMAGE_PATH)] },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    email: "hola@normaflow.io",
    description: "Plataforma SaaS para gestionar sistemas de gestión ISO con trazabilidad continua.",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ["es", "en", "pt-BR"],
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: "Software de gestión ISO para documentos, riesgos, auditorías, evidencias, CAPA e indicadores.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Prueba gratuita de 14 días; no requiere tarjeta de crédito." },
  };
}

export function faqJsonLd(faqs: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}
