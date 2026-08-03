import type { Metadata } from "next";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = createMarketingMetadata({
  title: "GAP Assessment ISO por cláusula | NormaFlow",
  description: "Evalúa tu cumplimiento frente a ISO 9001 e ISO 27001, prioriza brechas y convierte el diagnóstico en un plan de acción trazable.",
  path: "/solutions/gap-assessment",
});

export default function GapAssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
