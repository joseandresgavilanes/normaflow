import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import Landing from "./Landing";
import JsonLd from "@/components/seo/JsonLd";
import { HOME_FAQS } from "@/lib/seo-content";
import { createMarketingMetadata, faqJsonLd, organizationJsonLd, softwareJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = createMarketingMetadata({
  title: "NormaFlow — Software ISO 9001 e ISO 27001 para empresas",
  description: "Digitaliza tu sistema de gestión. Auditorías, riesgos, documentos y cumplimiento ISO en una plataforma. Sin hojas de cálculo, sin caos.",
  path: "/home",
  keywords: ["software ISO", "ISO 9001", "ISO 27001", "gestión de calidad", "cumplimiento normativo", "auditorías ISO"],
});

export default function HomePage() {
  return (
    <MarketingLayout>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd(HOME_FAQS)]} />
      <Landing />
    </MarketingLayout>
  );
}
