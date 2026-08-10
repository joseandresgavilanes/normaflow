import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n/server";
import { translateKnownText } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: { absolute: translateKnownText(locale, "Crear cuenta gratuita | NormaFlow") }, robots: { index: false, follow: false } };
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
