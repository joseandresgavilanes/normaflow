"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !org || !email || !password) {
      setError(t("error.requiredFields"));
      return;
    }
    if (password.length < 8) {
      setError(t("error.passwordMin"));
      return;
    }
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("error.supabaseMissing"));
      setLoading(false);
      return;
    }

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      const boot = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: org }),
      });
      if (!boot.ok) {
        const j = await boot.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : t("error.orgCreateFailed"));
        setLoading(false);
        return;
      }
      router.push("/app/onboarding");
      router.refresh();
      setLoading(false);
      return;
    }

    setError(t("error.confirmEmail"));
    setLoading(false);
  }

  const fields: { id: string; label: string; val: string; set: (v: string) => void; placeholder: string; type: string }[] = [
    { id: "signup-name", label: t("auth.signup.name"), val: name, set: setName, placeholder: t("auth.signup.namePlaceholder"), type: "text" },
    { id: "signup-org", label: t("auth.signup.org"), val: org, set: setOrg, placeholder: t("auth.signup.orgPlaceholder"), type: "text" },
    { id: "signup-email", label: t("auth.signup.email"), val: email, set: setEmail, placeholder: t("auth.signup.emailPlaceholder"), type: "email" },
    { id: "signup-password", label: t("common.password"), val: password, set: setPassword, placeholder: t("auth.signup.passwordPlaceholder"), type: "password" },
  ];

  return (
    <>
      <div className="nf-bg" aria-hidden="true" />
      <div className="nf-auth-lang"><LanguageSwitcher compact /></div>
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 460 }}>
            <div className="nf-auth-header">
              <Link href="/home" className="nf-logo" style={{ justifyContent: "center" }}>
                <span className="nf-logo-mark" aria-hidden />
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>{t("auth.signup.title")}</h1>
              <p>{t("auth.signup.subtitle")}</p>
            </div>

            <div className="nf-auth-card">
              <form onSubmit={handleSubmit} className="nf-auth-form">
                {fields.map((f) => (
                  <div key={f.id}>
                    <label className="nf-label" htmlFor={f.id}>{f.label}</label>
                    <input aria-label={f.placeholder}
                      id={f.id}
                      type={f.type}
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className="nf-input"
                    />
                  </div>
                ))}
                {error ? <div className="nf-auth-alert nf-auth-alert--error">{error}</div> : null}
                <button type="submit" disabled={loading} className="nf-btn nf-btn--primary" style={{ width: "100%", opacity: loading ? 0.7 : 1 }}>
                  {loading ? t("auth.signup.loading") : <>{t("auth.signup.submit")} <Ic.arrow className="nf-arrow" /></>}
                </button>
                <p style={{ fontSize: 12, color: "var(--nf-ink-3)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
                  {t("auth.signup.acceptPrefix")}{" "}
                  <Link href="/legal/terms" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>{t("marketing.terms")}</Link>{" "}
                  {t("auth.signup.acceptConnector")}{" "}
                  <Link href="/legal/privacy" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>{t("marketing.privacy")}</Link>.
                </p>
              </form>
            </div>

            <p className="nf-auth-footer">
              {t("auth.signup.haveAccount")} <Link href="/login">{t("auth.signup.signin")}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
