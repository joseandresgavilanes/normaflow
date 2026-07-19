"use client";
import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("error.forgotEmailRequired"));
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("error.passwordResetUnavailable"));
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(t("error.passwordResetFailed"));
      return;
    }
    setSent(true);
  }

  return (
    <>
      <div className="nf-bg" aria-hidden="true" />
      <div className="nf-auth-lang"><LanguageSwitcher compact /></div>
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 440 }}>
            <div className="nf-auth-header">
              <Link href="/home" className="nf-logo" style={{ justifyContent: "center" }}>
                <span className="nf-logo-mark" aria-hidden />
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>{t("auth.forgot.title")}</h1>
              <p>{t("auth.forgot.subtitle")}</p>
            </div>

            <div className="nf-auth-card">
              {sent ? (
                <div className="nf-auth-form">
                  <div className="nf-auth-alert nf-auth-alert--success">
                    {t("auth.forgot.sentPrefix")} <strong>{email.trim()}</strong>, {t("auth.forgot.sentSuffix")}
                  </div>
                  <Link href="/login" className="nf-btn nf-btn--ghost" style={{ width: "100%", textAlign: "center" }}>
                    {t("auth.forgot.backToLogin")}
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="nf-auth-form">
                  <div>
                    <label className="nf-label" htmlFor="forgot-email">{t("common.email")}</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.forgot.emailPlaceholder")}
                      autoComplete="email"
                      className="nf-input"
                    />
                  </div>
                  {error ? <div className="nf-auth-alert nf-auth-alert--error">{error}</div> : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="nf-btn nf-btn--primary"
                    style={{ width: "100%", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? t("auth.forgot.loading") : <>{t("auth.forgot.submit")} <Ic.arrow className="nf-arrow" /></>}
                  </button>
                </form>
              )}
            </div>

            <p className="nf-auth-footer">
              {t("auth.forgot.remembered")} <Link href="/login">{t("auth.signup.signin")}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
