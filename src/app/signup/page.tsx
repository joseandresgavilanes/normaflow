"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/context/I18nProvider";

export default function SignupPage() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /* El alta no se hace sobre la sesión de otra persona. `signUp` no cierra la
     que hubiera abierta, así que quien venía de dentro creaba la cuenta contra
     su propio usuario: el nombre de empresa se descartaba y aterrizaba en su
     organización de siempre. Se avisa y se ofrece salir, que es menos brusco
     que cerrarle la sesión sin preguntar. */
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setActiveSession(data.user?.email ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  async function signOutAndStay() {
    setSigningOut(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase?.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      clearSupabaseLegacyStorage();
      setActiveSession(null);
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (activeSession) {
      setError(t("auth.signup.sessionActive", { email: activeSession }));
      return;
    }
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
      const body = await boot.json().catch(() => ({}));
      if (!boot.ok) {
        setError(typeof body.error === "string" ? body.error : t("error.orgCreateFailed"));
        setLoading(false);
        return;
      }
      /* `created: false` significa que la cuenta ya tenía organización y el
         alta no llegó a crear nada. Antes esto pasaba por éxito. */
      if (body.created === false) {
        setError(t("error.signupAlreadyMember", { organization: String(body.organizationName ?? "") }));
        setLoading(false);
        return;
      }
      /* Navegación dura, no `router.push`: con `staleTimes.dynamic` el router
         guarda 30 s de payloads y pintaría los de la sesión anterior antes de
         que llegue el refresco. Al cambiar de identidad se tira todo. */
      window.location.assign("/app/onboarding");
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
        <main className="nf-auth-shell">
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
              {activeSession && (
                <div className="nf-auth-alert nf-auth-alert--error" style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 10px" }}>{t("auth.signup.sessionActive", { email: activeSession })}</p>
                  <button
                    type="button"
                    onClick={() => void signOutAndStay()}
                    disabled={signingOut}
                    className="nf-btn nf-btn--ghost"
                    style={{ width: "100%" }}
                  >
                    {signingOut ? t("auth.signup.signOutLoading") : t("auth.signup.signOutFirst")}
                  </button>
                </div>
              )}
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
                <button type="submit" disabled={loading || Boolean(activeSession)} className="nf-btn nf-btn--primary" style={{ width: "100%", opacity: loading || activeSession ? 0.7 : 1 }}>
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
        </main>
      </div>
    </>
  );
}
