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

  const fields: { id: string; label: string; val: string; set: (v: string) => void; placeholder: string; type: string }[] = [
    { id: "signup-name", label: "Nombre completo", val: name, set: setName, placeholder: "María García", type: "text" },
    { id: "signup-org", label: "Organización", val: org, set: setOrg, placeholder: "Tecnoserv Industrial", type: "text" },
    { id: "signup-email", label: "Email profesional", val: email, set: setEmail, placeholder: "maria@empresa.com", type: "email" },
    { id: "signup-password", label: "Contraseña", val: password, set: setPassword, placeholder: "Mínimo 8 caracteres", type: "password" },
  ];

  return (
    <>
      <div className="nf-bg" aria-hidden="true" />
      <div className="nf-app">
        <div className="nf-auth-shell">
          <div style={{ width: "100%", maxWidth: 460 }}>
            <div className="nf-auth-header">
              <Link href="/home" className="nf-logo" style={{ justifyContent: "center" }}>
                <span className="nf-logo-mark" aria-hidden />
                NormaFlow
              </Link>
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>Empieza gratis · 14 días</h1>
              <p>Sin tarjeta de crédito. Sin compromiso.</p>
            </div>

            <div className="nf-auth-card">
              <form onSubmit={handleSubmit} className="nf-auth-form">
                {fields.map((f) => (
                  <div key={f.id}>
                    <label className="nf-label" htmlFor={f.id}>{f.label}</label>
                    <input
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
                  {loading ? "Creando cuenta…" : <>Crear cuenta gratuita <Ic.arrow className="nf-arrow" /></>}
                </button>
                <p style={{ fontSize: 12, color: "var(--nf-ink-3)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
                  Al registrarte aceptas los{" "}
                  <Link href="/legal/terms" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>Términos</Link>{" "}
                  y la{" "}
                  <Link href="/legal/privacy" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>Privacidad</Link>.
                </p>
              </form>
            </div>

            <p className="nf-auth-footer">
              ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
