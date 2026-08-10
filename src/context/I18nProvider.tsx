"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { enUS, es as dateFnsEs, ptBR } from "date-fns/locale";
import { format, formatDistanceToNow } from "date-fns";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  localeToIntl,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";
import { translate, translateText, type MessageKey } from "@/lib/i18n/messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  tx: (text: string) => string;
  formatDate: (date: Date | string, fmt?: string) => string;
  timeAgo: (date: Date | string) => string;
};

const dateFnsLocales = {
  es: dateFnsEs,
  en: enUS,
  "pt-BR": ptBR,
} satisfies Record<Locale, typeof dateFnsEs>;

const I18nContext = createContext<I18nContextValue | null>(null);

function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.localStorage.setItem(LOCALE_COOKIE, locale);
  document.documentElement.lang = localeToIntl(locale);
}

export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale | string;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));

  useEffect(() => {
    const storedRaw = window.localStorage.getItem(LOCALE_COOKIE);
    const resolved = storedRaw ? normalizeLocale(storedRaw) : locale;
    if (resolved !== locale) setLocaleState(resolved);
    persistLocale(resolved);
    // Run once after hydration so client preference can win over Accept-Language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      tx: (text) => translateText(locale, text),
      formatDate: (date, fmt = locale === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy") =>
        format(new Date(date), fmt, { locale: dateFnsLocales[locale] }),
      timeAgo: (date) =>
        formatDistanceToNow(new Date(date), {
          addSuffix: true,
          locale: dateFnsLocales[locale],
        }),
    };
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = localeToIntl(locale);
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
}
