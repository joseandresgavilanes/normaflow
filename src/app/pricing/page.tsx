import MarketingLayout from "@/components/layout/MarketingLayout";
import PricingSection from "@/components/marketing/PricingSection";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Precios del software de gestión ISO | NormaFlow",
  description: "Planes de NormaFlow para equipos que gestionan calidad, seguridad y cumplimiento. Prueba de 14 días sin tarjeta de crédito.",
  path: "/pricing",
});
export default function PricingPage() {
  return <MarketingLayout><PricingSection /></MarketingLayout>;
}
