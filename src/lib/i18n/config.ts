export const SUPPORTED_LOCALES = ["es", "en", "pt-BR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "nf_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; native: string; english: string }> = {
  es: { short: "ES", native: "Español", english: "Spanish" },
  en: { short: "EN", native: "English", english: "English" },
  "pt-BR": { short: "PT", native: "Português (Brasil)", english: "Portuguese (Brazil)" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  if (!value || typeof value !== "string") return DEFAULT_LOCALE;
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "pt-br" || normalized === "pt" || normalized.startsWith("pt-")) return "pt-BR";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "es" || normalized.startsWith("es-")) return "es";
  return DEFAULT_LOCALE;
}

export function detectLocale(cookieLocale?: string | null, acceptLanguage?: string | null): Locale {
  if (cookieLocale) return normalizeLocale(cookieLocale);
  if (!acceptLanguage) return DEFAULT_LOCALE;

  for (const item of acceptLanguage.split(",")) {
    const candidate = normalizeLocale(item.trim().split(";")[0]);
    if (isLocale(candidate)) return candidate;
  }

  return DEFAULT_LOCALE;
}

export function localeToOpenGraph(locale: Locale) {
  if (locale === "en") return "en_US";
  if (locale === "pt-BR") return "pt_BR";
  return "es_ES";
}

export function localeToIntl(locale: Locale) {
  if (locale === "en") return "en-US";
  if (locale === "pt-BR") return "pt-BR";
  return "es-ES";
}
