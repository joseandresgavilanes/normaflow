"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STANDARD_OPTIONS = [
  { code: "ISO_9001", label: "ISO 9001:2015", detail: "Gestión de la Calidad" },
  { code: "ISO_27001", label: "ISO 27001:2022", detail: "Seguridad de la Información" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [standards, setStandards] = useState<string[]>(["ISO_9001"]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleStandard(code: string) {
    setStandards((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (orgName.trim().length < 2) {
      setError("Indica el nombre de tu organización.");
      return;
    }
    if (standards.length === 0) {
      setError("Selecciona al menos una norma para tu sistema de gestión.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: orgName.trim(), standards }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo crear la organización.",
        );
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
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F9FC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: "#5266F6",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>
                N
              </span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 20, color: "#142033" }}>
              NormaFlow
            </span>
          </Link>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#142033",
              margin: "0 0 8px",
            }}
          >
            Crea tu organización
          </h1>
          <p style={{ fontSize: 14, color: "#5E6B7A", margin: 0 }}>
            Un espacio aislado para documentos, auditorías y cumplimiento.
            Podrás invitar a tu equipo después.
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5EAF2",
            borderRadius: 16,
            padding: 28,
          }}
        >
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#142033",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Nombre de la organización
              </label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Ej. Acme Components S.L."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5EAF2",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#142033",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Normas de tu sistema de gestión
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STANDARD_OPTIONS.map((option) => {
                  const checked = standards.includes(option.code);
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => toggleStandard(option.code)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                        padding: "10px 12px",
                        border: `1px solid ${checked ? "#5266F6" : "#E5EAF2"}`,
                        background: checked ? "#F2F4FF" : "#fff",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          flexShrink: 0,
                          border: `1.5px solid ${checked ? "#5266F6" : "#B9C2CF"}`,
                          background: checked ? "#5266F6" : "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#142033", display: "block" }}>
                          {option.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#5E6B7A" }}>{option.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: "#5E6B7A", margin: "8px 0 0" }}>
                Se creará la evaluación GAP inicial con el desglose de cláusulas de cada norma.
                Podrás activar más normas después.
              </p>
            </div>
            {error ? (
              <div
                style={{
                  background: "#fff0f0",
                  border: "1px solid #f5c2c2",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#C93C37",
                }}
              >
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#5266F6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creando…" : "Continuar al panel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
