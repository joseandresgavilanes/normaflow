"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";
import { Ic } from "@/components/marketing/nf/Icons";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    clearSupabaseLegacyStorage();

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setChecking(false);
      setError("Supabase no está configurado.");
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setChecking(false);
      if (!session?.user?.email) {
        setError("Sesión no válida. Abre de nuevo el enlace del correo de invitación.");
        return;
      }
      setInviteEmail(session.user.email);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase no está configurado.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? inviteEmail;

    await fetch("/api/auth/sync-user", { method: "POST" }).catch(() => {});

    // Cerrar todo y forzar login explícito con el email invitado (evita sesiones cruzadas).
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSupabaseLegacyStorage();

    const params = new URLSearchParams({
      email,
      invited: "1",
      next: "/app/dashboard",
    });
    router.replace(`/login?${params.toString()}`);
  }

  if (checking) {
    return <div style={{ minHeight: "100vh", background: "var(--nf-bg-0)" }} />;
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
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>Establece tu contraseña</h1>
              <p>
                {inviteEmail
                  ? `Cuenta: ${inviteEmail}`
                  : "Último paso para acceder a tu organización"}
              </p>
            </div>

            <div className="nf-auth-card">
              <form onSubmit={handleSubmit} className="nf-auth-form">
                <div>
                  <label className="nf-label" htmlFor="set-password">Nueva contraseña</label>
                  <input
                    id="set-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className="nf-input"
                    disabled={Boolean(error && error.includes("Sesión"))}
                  />
                </div>
                <div>
                  <label className="nf-label" htmlFor="set-password-confirm">Confirmar contraseña</label>
                  <input
                    id="set-password-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    className="nf-input"
                    disabled={Boolean(error && error.includes("Sesión"))}
                  />
                </div>
                {error ? <div className="nf-auth-alert nf-auth-alert--error">{error}</div> : null}
                <button
                  type="submit"
                  disabled={loading || Boolean(error && error.includes("Sesión"))}
                  className="nf-btn nf-btn--primary"
                  style={{ width: "100%", opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "Guardando…" : <>Guardar contraseña <Ic.arrow className="nf-arrow" /></>}
                </button>
                <p style={{ margin: 0, fontSize: 12, color: "var(--nf-ink-4)", textAlign: "center" }}>
                  Después irás a iniciar sesión con este email y tu nueva contraseña.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
