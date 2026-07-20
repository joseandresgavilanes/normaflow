import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import AuthHashRedirect from "@/components/auth/AuthHashRedirect";
import I18nDomBridge from "@/components/i18n/I18nDomBridge";
import { I18nProvider } from "@/context/I18nProvider";
import { localeToOpenGraph } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

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
    title: { default: translate(locale, "meta.title.default"), template: translate(locale, "meta.title.template") },
    description: translate(locale, "meta.description"),
    keywords,
    authors: [{ name: "NormaFlow" }],
    openGraph: {
      title: translate(locale, "meta.title.default"),
      description: translate(locale, "meta.og.description"),
      type: "website",
      locale: localeToOpenGraph(locale),
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <I18nProvider initialLocale={locale}>
          <AuthHashRedirect />
          <I18nDomBridge />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
