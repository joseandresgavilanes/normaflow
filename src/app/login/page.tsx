"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_CREDENTIALS } from "@/lib/constants";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Completa todos los campos.");
      return;
    }
    setLoading(true);
    try {
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
      <div className="nf-bg" aria-hidden="true"></div>
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <Link href="/home" className="nf-logo" style={{ marginBottom: 22 }}>
                <span className="nf-logo-mark"></span>
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 18 }}>Bienvenido de nuevo</h1>
              <p style={{ fontSize: 14, color: "var(--nf-ink-3)", marginTop: 6 }}>Accede a tu panel de cumplimiento</p>
            </div>

            <div className="nf-auth-card">
              <div style={{ padding: 12, borderRadius: 10, background: "oklch(0.78 0.13 195 / 0.08)", border: "1px solid oklch(0.78 0.13 195 / 0.3)", marginBottom: 20, fontSize: 12, color: "var(--nf-ink-2)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nf-accent-2)", marginBottom: 4 }}>● Acceso demo</div>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nf-ink)" }}>{DEMO_CREDENTIALS.email}</code> · <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nf-ink)" }}>{DEMO_CREDENTIALS.password}</code>
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--nf-ink-3)" }}>En desarrollo local, define <code>AUTH_DEMO_MODE=true</code> si aún no usas Supabase.</div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="nf-label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={DEMO_CREDENTIALS.email}
                    autoComplete="email"
                    className="nf-input"
                  />
                </div>
                <div>
                  <label className="nf-label">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="nf-input"
                  />
                </div>
                {error ? (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "oklch(0.70 0.18 25 / 0.08)", border: "1px solid oklch(0.70 0.18 25 / 0.35)", fontSize: 13, color: "oklch(0.85 0.14 30)" }}>{error}</div>
                ) : null}
                <button type="submit" disabled={loading} className="nf-btn nf-btn--primary" style={{ justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Iniciando sesión…" : <>Entrar <Ic.arrow className="nf-arrow"/></>}
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail(DEMO_CREDENTIALS.email); setPassword(DEMO_CREDENTIALS.password); }}
                  className="nf-btn nf-btn--ghost"
                  style={{ justifyContent: "center" }}
                >
                  Usar credenciales demo
                </button>
              </form>
            </div>

            <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--nf-ink-3)" }}>
              ¿No tienes cuenta?{" "}
              <Link href="/signup" style={{ color: "var(--nf-accent)", fontWeight: 600 }}>
                Regístrate gratis
              </Link>
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
