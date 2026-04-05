"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_CREDENTIALS } from "@/lib/constants";

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
    <div style={{ minHeight: "100vh", background: "#F7F9FC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, background: "#123C66", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>N</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: "#142033" }}>NormaFlow</span>
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#142033", margin: "0 0 8px" }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize: 14, color: "#5E6B7A" }}>Accede a tu panel de cumplimiento</p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: 32 }}>
          <div style={{ background: "#f0f4ff", border: "1px solid #123C6630", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#123C66" }}>
            <strong>Acceso demo:</strong> {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
            <div style={{ marginTop: 6, fontSize: 12, color: "#5E6B7A" }}>En desarrollo local, define AUTH_DEMO_MODE=true si aún no usas Supabase.</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#142033", display: "block", marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={DEMO_CREDENTIALS.email}
                autoComplete="email"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#142033", display: "block", marginBottom: 6 }}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {error ? (
              <div style={{ background: "#fff0f0", border: "1px solid #f5c2c2", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#C93C37" }}>{error}</div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Iniciando sesión..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail(DEMO_CREDENTIALS.email);
                setPassword(DEMO_CREDENTIALS.password);
              }}
              style={{ background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, color: "#5E6B7A", cursor: "pointer" }}
            >
              Usar credenciales demo
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#5E6B7A" }}>
          ¿No tienes cuenta?{" "}
          <Link href="/signup" style={{ color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F7F9FC" }} />}>
      <LoginForm />
    </Suspense>
  );
}
