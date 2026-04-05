import { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import HeroSection from "@/components/marketing/HeroSection";
import TrustStrip from "@/components/marketing/TrustStrip";
import ProblemsSection from "@/components/marketing/ProblemsSection";
import ModulesGrid from "@/components/marketing/ModulesGrid";
import PDCASection from "@/components/marketing/PDCASection";
import StandardsSection from "@/components/marketing/StandardsSection";
import CaseStudySection from "@/components/marketing/CaseStudySection";
import PricingSection from "@/components/marketing/PricingSection";
import CTASection from "@/components/marketing/CTASection";

export const metadata: Metadata = {
  title: "NormaFlow — Software ISO 9001 e ISO 27001 para empresas",
  description: "Digitaliza tu sistema de gestión. Auditorías, riesgos, documentos y cumplimiento ISO en una plataforma. Sin hojas de cálculo, sin caos.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <TrustStrip />
      <ProblemsSection />
      <ModulesGrid />
      <PDCASection />
      <StandardsSection />
      <CaseStudySection />
      <PricingSection />
      <CTASection />
    </MarketingLayout>
  );
}
