import type { Metadata } from "next";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = createMarketingMetadata({
  title: "Solicita una demo de NormaFlow | Software ISO",
  description: "Habla con un especialista y descubre cómo centralizar documentos, riesgos, auditorías y evidencias ISO en NormaFlow.",
  path: "/demo",
});

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
