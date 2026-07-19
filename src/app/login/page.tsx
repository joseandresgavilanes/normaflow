"use client";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CUSTOMER_CREDENTIALS, DEMO_CREDENTIALS } from "@/lib/constants";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, tx } = useI18n();
  const next = searchParams.get("next") || "/app/dashboard";
  const authError = searchParams.get("error");
  const emailParam = searchParams.get("email") ?? "";
  const invited = searchParams.get("invited") === "1";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    authError ? tx(decodeURIComponent(authError.replace(/\+/g, " "))) : "",
  );
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const demoMode = process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true";

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    setError(authError ? tx(decodeURIComponent(authError.replace(/\+/g, " "))) : "");
  }, [authError, tx]);

  useEffect(() => {
    setSuccess(invited ? t("auth.login.invitedSuccess") : "");
  }, [invited, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t("error.requiredFields"));
      return;
    }
    setLoading(true);
    try {
      clearSupabaseLegacyStorage();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? tx(data.error) : t("error.loginFailed"));
        setLoading(false);
        return;
      }
      router.push(next.startsWith("/") ? next : "/app/dashboard");
      router.refresh();
    } catch {
      setError(t("error.loginUnexpected"));
    }
    setLoading(false);
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
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>{t("auth.login.title")}</h1>
              <p>{t("auth.login.subtitle")}</p>
            </div>

            <div className="nf-auth-card">
              {demoMode ? (
                <div className="nf-auth-callouts">
                  <div className="nf-auth-callout">
                    <span className="nf-auth-callout-label">{t("auth.login.demoAccess")}</span>
                    <code>{DEMO_CREDENTIALS.email}</code> · <code>{DEMO_CREDENTIALS.password}</code>
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>
                      {t("auth.login.demoHelp")}
                    </div>
                  </div>
                  <div className="nf-auth-callout">
                    <span className="nf-auth-callout-label">{t("auth.login.newCustomer")}</span>
                    <code>{CUSTOMER_CREDENTIALS.email}</code> · <code>{CUSTOMER_CREDENTIALS.password}</code>
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>
                      {t("auth.login.customerHelp")}
                    </div>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="nf-auth-form">
                <div>
                  <label className="nf-label" htmlFor="login-email">{t("common.email")}</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={DEMO_CREDENTIALS.email}
                    autoComplete="email"
                    className="nf-input"
                  />
                </div>
                <div>
                  <label className="nf-label" htmlFor="login-password">{t("common.password")}</label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="nf-input"
                  />
                </div>
                {success ? <div className="nf-auth-alert nf-auth-alert--success">{success}</div> : null}
                {error ? <div className="nf-auth-alert nf-auth-alert--error">{error}</div> : null}
                <button type="submit" disabled={loading} className="nf-btn nf-btn--primary" style={{ width: "100%", opacity: loading ? 0.7 : 1 }}>
                  {loading ? t("auth.login.loading") : <>{t("auth.login.submit")} <Ic.arrow className="nf-arrow" /></>}
                </button>
                <p style={{ margin: 0, textAlign: "center", fontSize: 13 }}>
                  <Link href="/forgot-password" style={{ color: "var(--nf-ink-3)" }}>
                    {t("auth.login.forgot")}
                  </Link>
                </p>
                {demoMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEmail(DEMO_CREDENTIALS.email); setPassword(DEMO_CREDENTIALS.password); }}
                      className="nf-btn nf-btn--ghost"
                      style={{ width: "100%" }}
                    >
                      {t("auth.login.useDemo")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmail(CUSTOMER_CREDENTIALS.email); setPassword(CUSTOMER_CREDENTIALS.password); }}
                      className="nf-btn nf-btn--ghost"
                      style={{ width: "100%" }}
                    >
                      {t("auth.login.useCustomer")}
                    </button>
                  </>
                ) : null}
              </form>
            </div>

            <p className="nf-auth-footer">
              {t("auth.login.noAccount")} <Link href="/signup">{t("auth.login.signup")}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--nf-bg-0)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
