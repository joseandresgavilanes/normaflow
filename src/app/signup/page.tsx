"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

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
      setError("Supabase no está configurado. Usa AUTH_DEMO_MODE y el login demo, o añade las variables NEXT_PUBLIC_SUPABASE_*.");
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

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, background: "#123C66", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>N</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: "#142033" }}>NormaFlow</span>
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#142033", margin: "0 0 8px" }}>Empieza gratis 14 días</h1>
          <p style={{ fontSize: 14, color: "#5E6B7A" }}>Sin tarjeta de crédito. Sin compromiso.</p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Nombre completo", val: name, set: setName, placeholder: "María García", type: "text" },
              { label: "Organización", val: org, set: setOrg, placeholder: "Empresa S.A.", type: "text" },
              { label: "Email profesional", val: email, set: setEmail, placeholder: "maria@empresa.com", type: "email" },
              { label: "Contraseña", val: password, set: setPassword, placeholder: "Mínimo 8 caracteres", type: "password" },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#142033", display: "block", marginBottom: 6 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            {error ? (
              <div style={{ background: "#fff0f0", border: "1px solid #f5c2c2", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#C93C37" }}>{error}</div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#2E8B57",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta gratuita →"}
            </button>
            <p style={{ fontSize: 12, color: "#5E6B7A", textAlign: "center", margin: 0 }}>
              Al registrarte aceptas nuestros{" "}
              <Link href="/legal/terms" style={{ color: "#123C66" }}>
                Términos de uso
              </Link>{" "}
              y{" "}
              <Link href="/legal/privacy" style={{ color: "#123C66" }}>
                Política de privacidad
              </Link>
              .
            </p>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#5E6B7A" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" style={{ color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
