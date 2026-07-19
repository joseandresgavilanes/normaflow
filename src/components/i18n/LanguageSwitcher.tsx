"use client";

import { Globe2 } from "lucide-react";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/context/I18nProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={compact ? "nf-lang-switcher nf-lang-switcher--compact" : "nf-lang-switcher"} aria-label={t("common.language")}>
      <Globe2 size={compact ? 14 : 15} strokeWidth={2} aria-hidden />
      <div className="nf-lang-switcher-options" role="group" aria-label={t("common.language")}>
        {SUPPORTED_LOCALES.map((item: Locale) => (
          <button
            key={item}
            type="button"
            className={item === locale ? "nf-lang-switcher-btn nf-lang-switcher-btn--active" : "nf-lang-switcher-btn"}
            aria-pressed={item === locale}
            title={LOCALE_LABELS[item].native}
            onClick={() => setLocale(item)}
          >
            {LOCALE_LABELS[item].short}
          </button>
        ))}
      </div>
    </div>
  );
}
