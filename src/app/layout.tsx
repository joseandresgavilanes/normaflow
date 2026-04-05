import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: { default: "NormaFlow — Software de Gestión ISO", template: "%s | NormaFlow" },
  description: "Digitaliza y gestiona tu sistema ISO 9001 e ISO 27001 con trazabilidad total. Auditorías, riesgos, documentos y cumplimiento en una plataforma.",
  keywords: ["ISO 9001", "ISO 27001", "gestión de calidad", "cumplimiento", "auditorías", "software ISO"],
  authors: [{ name: "NormaFlow" }],
  openGraph: {
    title: "NormaFlow — Software de Gestión ISO",
    description: "Tu sistema de gestión, digitalizado y bajo control.",
    type: "website",
    locale: "es_ES",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
