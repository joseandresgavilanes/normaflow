"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (orgName.trim().length < 2) {
      setError("Indica el nombre de tu organización.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: orgName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo crear la organización.");
        setLoading(false);
        return;
      }
      router.refresh();
      router.push("/app/dashboard");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: "#123C66", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>N</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: "#142033" }}>NormaFlow</span>
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#142033", margin: "0 0 8px" }}>Crea tu organización</h1>
          <p style={{ fontSize: 14, color: "#5E6B7A", margin: 0 }}>
            Un espacio aislado para documentos, auditorías y cumplimiento. Podrás invitar a tu equipo después.
          </p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: 28 }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#142033", display: "block", marginBottom: 6 }}>Nombre de la organización</label>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Ej. Acme Components S.L."
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
              {loading ? "Creando…" : "Continuar al panel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
