"use client";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CUSTOMER_CREDENTIALS, DEMO_CREDENTIALS } from "@/lib/constants";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app/dashboard";
  const authError = searchParams.get("error");
  const emailParam = searchParams.get("email") ?? "";
  const invited = searchParams.get("invited") === "1";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    authError ? decodeURIComponent(authError.replace(/\+/g, " ")) : "",
  );
  const [success, setSuccess] = useState(
    invited ? "Contraseña establecida. Inicia sesión con tu email y la contraseña que acabas de crear." : "",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Completa todos los campos.");
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
        setError(typeof data.error === "string" ? data.error : "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      router.push(next.startsWith("/") ? next : "/app/dashboard");
      router.refresh();
    } catch {
      setError("Error al iniciar sesión. Inténtalo de nuevo.");
    }
    setLoading(false);
  }

  return (
    <>
      <div className="nf-bg" aria-hidden="true" />
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 440 }}>
            <div className="nf-auth-header">
              <Link href="/home" className="nf-logo" style={{ justifyContent: "center" }}>
                <span className="nf-logo-mark" aria-hidden />
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>Bienvenido de nuevo</h1>
              <p>Accede a tu panel de cumplimiento</p>
            </div>

            <div className="nf-auth-card">
              <div className="nf-auth-callouts">
                <div className="nf-auth-callout">
                  <span className="nf-auth-callout-label">Acceso demo</span>
                  <code>{DEMO_CREDENTIALS.email}</code> · <code>{DEMO_CREDENTIALS.password}</code>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>
                    Incluye datos de ejemplo para enseñar el flujo completo.
                  </div>
                </div>
                <div className="nf-auth-callout">
                  <span className="nf-auth-callout-label">Cuenta cliente nuevo</span>
                  <code>{CUSTOMER_CREDENTIALS.email}</code> · <code>{CUSTOMER_CREDENTIALS.password}</code>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>
                    Entra como admin con workspace limpio, sin depender de Supabase.
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="nf-auth-form">
                <div>
                  <label className="nf-label" htmlFor="login-email">Email</label>
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
                  <label className="nf-label" htmlFor="login-password">Contraseña</label>
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
                  {loading ? "Iniciando sesión…" : <>Entrar <Ic.arrow className="nf-arrow" /></>}
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail(DEMO_CREDENTIALS.email); setPassword(DEMO_CREDENTIALS.password); }}
                  className="nf-btn nf-btn--ghost"
                  style={{ width: "100%" }}
                >
                  Usar credenciales demo
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail(CUSTOMER_CREDENTIALS.email); setPassword(CUSTOMER_CREDENTIALS.password); }}
                  className="nf-btn nf-btn--ghost"
                  style={{ width: "100%" }}
                >
                  Usar cuenta cliente nuevo
                </button>
              </form>
            </div>

            <p className="nf-auth-footer">
              ¿No tienes cuenta? <Link href="/signup">Regístrate gratis</Link>
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
