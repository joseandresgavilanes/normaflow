"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { clearSupabaseLegacyStorage } from "@/lib/auth/clear-client-auth";
import "@/components/marketing/nf/nf.css";

function parseHashParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/auth/set-password";
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Validando enlace…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setStatus("error");
        setMessage("Supabase no está configurado en esta instalación.");
        return;
      }

      const hash = window.location.hash;
      if (hash) {
        const params = parseHashParams(hash);
        const authError = params.get("error_description") || params.get("error");
        if (authError) {
          setStatus("error");
          setMessage(decodeURIComponent(authError.replace(/\+/g, " ")));
          return;
        }

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          clearSupabaseLegacyStorage();

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (cancelled) return;
          if (error) {
            setStatus("error");
            setMessage(error.message);
            return;
          }
          await fetch("/api/auth/sync-user", { method: "POST" }).catch(() => {});
          router.replace(next.startsWith("/") ? next : "/auth/set-password");
          router.refresh();
          return;
        }
      }

      const code = searchParams.get("code");
      if (code) {
        router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
        return;
      }

      setStatus("error");
      setMessage("Enlace inválido o caducado. Pide al administrador que reenvíe la invitación.");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, next]);

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
              <h1 className="nf-h-3" style={{ marginTop: 20 }}>
                {status === "loading" ? "Validando enlace" : "No se pudo completar el acceso"}
              </h1>
              {status === "error" ? (
                <p>Los enlaces de invitación caducan. Si el enlace tiene más de 24 horas, solicita uno nuevo.</p>
              ) : null}
            </div>

            <div className="nf-auth-card" style={{ textAlign: "center" }}>
              {status === "loading" ? (
                <p style={{ color: "var(--nf-ink-3)", fontSize: 14, margin: 0 }}>{message}</p>
              ) : (
                <>
                  <div className="nf-auth-alert nf-auth-alert--error">{message}</div>
                  <Link href="/login" className="nf-btn nf-btn--primary" style={{ width: "100%", marginTop: 16 }}>
                    Ir a iniciar sesión
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--nf-bg-0)" }} />}>
      <AuthConfirmInner />
    </Suspense>
  );
}
