"use client";

import { useTransition } from "react";
import { DatabaseZap, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";

export default function LiveDataUnavailable({
  section = "esta sección",
}: {
  section?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{
        minHeight: "min(70vh, 680px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <Card style={{ width: "min(100%, 560px)", padding: 28, textAlign: "center" }}>
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            margin: "0 auto 16px",
            display: "grid",
            placeItems: "center",
            color: "var(--nf-warning-text)",
            background: "rgba(214, 138, 26, 0.14)",
          }}
        >
          <DatabaseZap size={25} strokeWidth={2.1} aria-hidden />
        </span>
        <h1 style={{ margin: "0 0 10px", fontSize: 21, color: "var(--nf-ink)" }}>
          No pudimos cargar {section}
        </h1>
        <p style={{ margin: "0 auto 20px", maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: "var(--nf-ink-3)" }}>
          La conexión con Supabase no respondió correctamente. Para proteger la integridad de la información,
          no se mostraron datos demo ni datos guardados localmente.
        </p>
        <button
          type="button"
          disabled={isPending}
          className="nf-app-btn-primary"
          onClick={() => startTransition(() => router.refresh())}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <RefreshCw size={16} className={isPending ? "nf-icon-spin" : undefined} aria-hidden />
          {isPending ? "Reintentando…" : "Reintentar conexión"}
        </button>
      </Card>
    </div>
  );
}
