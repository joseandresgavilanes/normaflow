import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import AuthHashRedirect from "@/components/auth/AuthHashRedirect";
import AppActionIcons from "@/components/ui/AppActionIcons";
import { LiveRegionProvider } from "@/components/ui/LiveRegion";
import I18nDomBridge from "@/components/i18n/I18nDomBridge";
import { I18nProvider } from "@/context/I18nProvider";
import { localeToOpenGraph } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";
import { getServerLocale } from "@/lib/i18n/server";
import { absoluteUrl, SITE_NAME, SITE_URL, SOCIAL_IMAGE_PATH } from "@/lib/seo";
// Los tokens deben cargarse antes que cualquier hoja que los consuma.
import "@/styles/tokens.css";
import "./globals.css";
// Se carga después de globals.css: corrige el layout del shell sin editar el
// monolito de 7k líneas.
import "@/styles/app-shell.css";
import "@/styles/data-table.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const keywords = translate(locale, "meta.keywords").split(",");

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: translate(locale, "meta.title.default"), template: translate(locale, "meta.title.template") },
    description: translate(locale, "meta.description"),
    keywords,
    authors: [{ name: "NormaFlow" }],
    alternates: { canonical: absoluteUrl("/home") },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      title: translate(locale, "meta.title.default"),
      description: translate(locale, "meta.og.description"),
      url: absoluteUrl("/home"),
      siteName: SITE_NAME,
      type: "website",
      locale: localeToOpenGraph(locale),
      images: [{ url: absoluteUrl(SOCIAL_IMAGE_PATH), width: 1200, height: 630, alt: "NormaFlow — software de gestión ISO" }],
    },
    twitter: { card: "summary_large_image", title: translate(locale, "meta.title.default"), description: translate(locale, "meta.og.description"), images: [absoluteUrl(SOCIAL_IMAGE_PATH)] },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <I18nProvider initialLocale={locale}>
          {/* En la raíz para que también cubra login y registro: los errores de
              autenticación tienen que anunciarse. */}
          <LiveRegionProvider>
            <AuthHashRedirect />
            <I18nDomBridge />
            <AppActionIcons />
            {children}
          </LiveRegionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
