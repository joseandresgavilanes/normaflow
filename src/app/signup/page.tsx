"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";

export default function SignupPage() {
  const router = useRouter();
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
      setError("Completa todos los campos.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase no está configurado. Usa AUTH_DEMO_MODE y los logins locales, o añade las variables NEXT_PUBLIC_SUPABASE_*.");
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
        setError(typeof j.error === "string" ? j.error : "No se pudo crear la organización.");
        setLoading(false);
        return;
      }
      router.push("/app/dashboard");
      router.refresh();
      setLoading(false);
      return;
    }

    setError("Revisa tu correo para confirmar la cuenta. Tras confirmar, inicia sesión y se completará el alta de la organización.");
    setLoading(false);
  }

  const fields: { label: string; val: string; set: (v: string) => void; placeholder: string; type: string }[] = [
    { label: "Nombre completo",     val: name,     set: setName,     placeholder: "María García",        type: "text" },
    { label: "Organización",         val: org,      set: setOrg,      placeholder: "Tecnoserv Industrial", type: "text" },
    { label: "Email profesional",    val: email,    set: setEmail,    placeholder: "maria@empresa.com",   type: "email" },
    { label: "Contraseña",           val: password, set: setPassword, placeholder: "Mínimo 8 caracteres", type: "password" },
  ];

  return (
    <>
      <div className="nf-bg" aria-hidden="true"></div>
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 460 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <Link href="/home" className="nf-logo" style={{ marginBottom: 22 }}>
                <span className="nf-logo-mark"></span>
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 18 }}>Empieza gratis · 14 días</h1>
              <p style={{ fontSize: 14, color: "var(--nf-ink-3)", marginTop: 6 }}>Sin tarjeta de crédito. Sin compromiso.</p>
            </div>

            <div className="nf-auth-card">
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {fields.map((f) => (
                  <div key={f.label}>
                    <label className="nf-label">{f.label}</label>
                    <input
                      type={f.type}
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className="nf-input"
                    />
                  </div>
                ))}
                {error ? (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "oklch(0.70 0.18 25 / 0.08)", border: "1px solid oklch(0.70 0.18 25 / 0.35)", fontSize: 13, color: "oklch(0.85 0.14 30)" }}>{error}</div>
                ) : null}
                <button type="submit" disabled={loading} className="nf-btn nf-btn--primary" style={{ justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Creando cuenta…" : <>Crear cuenta gratuita <Ic.arrow className="nf-arrow"/></>}
                </button>
                <p style={{ fontSize: 11, color: "var(--nf-ink-3)", textAlign: "center", margin: 0, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  Al registrarte aceptas los{" "}
                  <Link href="/legal/terms" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>Términos</Link>{" "}y la{" "}
                  <Link href="/legal/privacy" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>Privacidad</Link>.
                </p>
              </form>
            </div>

            <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--nf-ink-3)" }}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" style={{ color: "var(--nf-accent)", fontWeight: 600 }}>
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
