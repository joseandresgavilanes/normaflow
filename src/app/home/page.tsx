import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import Landing from "./Landing";

export const metadata: Metadata = {
  title: "NormaFlow — Software ISO 9001 e ISO 27001 para empresas",
  description: "Digitaliza tu sistema de gestión. Auditorías, riesgos, documentos y cumplimiento ISO en una plataforma. Sin hojas de cálculo, sin caos.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <Landing />
    </MarketingLayout>
  );
}
