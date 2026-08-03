import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n/server";
import { translateKnownText } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: { absolute: translateKnownText(locale, "Recuperar contraseña | NormaFlow") }, robots: { index: false, follow: false } };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
