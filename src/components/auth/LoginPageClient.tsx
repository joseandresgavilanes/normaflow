"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

export type DemoLoginCredentials = {
  demo: { id: "demo-local"; email: string; password: string; name: string };
  customer: { id: "customer-local"; email: string; password: string; name: string };
};

function LoginForm({ demoAccounts, home }: { demoAccounts?: DemoLoginCredentials; home: string }) {
  const searchParams = useSearchParams();
  const { t, tx } = useI18n();
  /* `next` manda sobre la preferencia: si llegas a /login por haber pedido una
     página concreta, ahí es donde quieres volver. */
  const next = searchParams.get("next") || home;
  const authError = searchParams.get("error");
  const emailParam = searchParams.get("email") ?? "";
  const invited = searchParams.get("invited") === "1";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(authError ? tx(decodeURIComponent(authError.replace(/\+/g, " "))) : "");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (emailParam) setEmail(emailParam); }, [emailParam]);
  useEffect(() => { setError(authError ? tx(decodeURIComponent(authError.replace(/\+/g, " "))) : ""); }, [authError, tx]);
  useEffect(() => { setSuccess(invited ? t("auth.login.invitedSuccess") : ""); }, [invited, t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email || !password) { setError(t("error.requiredFields")); return; }
    setLoading(true);
    try {
      clearSupabaseLegacyStorage();
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(typeof data.error === "string" ? tx(data.error) : t("error.loginFailed")); return; }
      /* Navegación dura: el router del cliente guarda 30 s de payloads RSC
         (`staleTimes.dynamic` en next.config.ts), así que un `push` pintaba
         primero los de la cuenta anterior y el `refresh` llegaba después. Al
         cambiar de identidad se descarta todo el estado del cliente. */
      window.location.assign(next.startsWith("/") ? next : home);
      return;
    } catch { setError(t("error.loginUnexpected")); }
    finally { setLoading(false); }
  }

  return <>
    <div className="nf-bg" aria-hidden="true" />
    <div className="nf-auth-lang"><ThemeSwitcher compact /><LanguageSwitcher compact /></div>
    <div className="nf-app"><main className="nf-auth-shell"><div style={{ width: "100%", maxWidth: 440 }}>
      <div className="nf-auth-header">
        <Link href="/home" className="nf-logo" style={{ justifyContent: "center" }}><span className="nf-logo-mark" aria-hidden />NormaFlow</Link>
        <h1 className="nf-h-3" style={{ marginTop: 20 }}>{t("auth.login.title")}</h1><p>{t("auth.login.subtitle")}</p>
      </div>
      <div className="nf-auth-card">
        {demoAccounts && <div className="nf-auth-callouts">
          <div className="nf-auth-callout"><span className="nf-auth-callout-label">{t("auth.login.demoAccess")}</span><code>{demoAccounts.demo.email}</code> · <code>{demoAccounts.demo.password}</code><div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>{t("auth.login.demoHelp")}</div></div>
          <div className="nf-auth-callout"><span className="nf-auth-callout-label">{t("auth.login.newCustomer")}</span><code>{demoAccounts.customer.email}</code> · <code>{demoAccounts.customer.password}</code><div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>{t("auth.login.customerHelp")}</div></div>
        </div>}
        <form onSubmit={handleSubmit} className="nf-auth-form">
          <div><label className="nf-label" htmlFor="login-email">{t("common.email")}</label><input aria-label={demoAccounts?.demo.email ?? "tu@empresa.com"} id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={demoAccounts?.demo.email ?? "tu@empresa.com"} autoComplete="email" className="nf-input" /></div>
          <div><label className="nf-label" htmlFor="login-password">{t("common.password")}</label><input aria-label="••••••••" id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" className="nf-input" /></div>
          {success && <div className="nf-auth-alert nf-auth-alert--success">{success}</div>}{error && <div className="nf-auth-alert nf-auth-alert--error">{error}</div>}
          <button type="submit" disabled={loading} className="nf-btn nf-btn--primary" style={{ width: "100%", opacity: loading ? 0.7 : 1 }}>{loading ? t("auth.login.loading") : <>{t("auth.login.submit")} <Ic.arrow className="nf-arrow" /></>}</button>
          <p style={{ margin: 0, textAlign: "center", fontSize: 13 }}><Link href="/forgot-password" style={{ color: "var(--nf-ink-3)" }}>{t("auth.login.forgot")}</Link></p>
          {demoAccounts && <><button type="button" onClick={() => { setEmail(demoAccounts.demo.email); setPassword(demoAccounts.demo.password); }} className="nf-btn nf-btn--ghost" style={{ width: "100%" }}>{t("auth.login.useDemo")}</button><button type="button" onClick={() => { setEmail(demoAccounts.customer.email); setPassword(demoAccounts.customer.password); }} className="nf-btn nf-btn--ghost" style={{ width: "100%" }}>{t("auth.login.useCustomer")}</button></>}
        </form>
      </div>
      <p className="nf-auth-footer">{t("auth.login.noAccount")} <Link href="/signup">{t("auth.login.signup")}</Link></p>
    </div></main></div>
  </>;
}

export default function LoginPageClient({ demoAccounts, home = "/app/dashboard" }: { demoAccounts?: DemoLoginCredentials; home?: string }) {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--nf-bg-0)" }} />}><LoginForm demoAccounts={demoAccounts} home={home} /></Suspense>;
}
