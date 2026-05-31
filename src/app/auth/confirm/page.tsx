"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
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
    <div className="nf-app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        {status === "loading" ? (
          <p style={{ color: "var(--nf-ink-3)" }}>{message}</p>
        ) : (
          <>
            <h1 className="nf-h-3" style={{ marginBottom: 12 }}>
              No se pudo completar el acceso
            </h1>
            <p style={{ color: "var(--nf-ink-3)", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
            <p style={{ color: "var(--nf-ink-4)", fontSize: 12, marginTop: 16 }}>
              Los enlaces de invitación caducan. Si el enlace tiene más de 24 horas, solicita uno nuevo.
            </p>
            <Link href="/login" className="nf-btn nf-btn--primary" style={{ display: "inline-flex", marginTop: 20 }}>
              Ir a iniciar sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--nf-bg-0)" }} />}>
      <AuthConfirmInner />
    </Suspense>
  );
}
