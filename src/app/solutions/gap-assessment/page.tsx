"use client";
import Link from "next/link";
import { useState } from "react";
import MarketingLayout from "@/components/layout/MarketingLayout";

export default function GapAssessmentLandingPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSent(true);
  }

  return (
    <MarketingLayout>
      <section style={{ background: "linear-gradient(135deg, #0D2E4E, #123C66)", padding: "clamp(40px, 8vw, 72px) 0 clamp(36px, 7vw, 56px)" }}>
        <div
          className="nf-mkt-container"
          style={{
            maxWidth: 960,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "clamp(28px, 5vw, 48px)",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: "clamp(24px, 5.5vw, 42px)", fontWeight: 900, color: "#fff", margin: "0 0 14px", lineHeight: 1.12 }}>GAP Assessment sin caos de hojas de cálculo</h1>
            <p style={{ fontSize: "clamp(15px, 3.2vw, 17px)", color: "rgba(255,255,255,0.7)", lineHeight: 1.65, margin: 0 }}>
              Evalúa ISO 9001 e ISO 27001 por cláusula, con puntuación, comentarios y plan de acción. Versión resumida para leads; informe completo dentro de la plataforma.
            </p>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: "clamp(18px, 4vw, 28px)", border: "1px solid #E5EAF2" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 14 }}>Solicitar evaluación de ejemplo</div>
            {sent ? (
              <p style={{ color: "#2E8B57", fontSize: 15, margin: 0 }}>Gracias. Te enviaremos un ejemplo en menos de un día laborable.</p>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input required value={company} onChange={e => setCompany(e.target.value)} placeholder="Empresa" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", fontSize: 14 }} />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email profesional" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", fontSize: 14 }} />
                <button type="submit" style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
                  Enviar
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
      <section style={{ padding: "clamp(40px, 8vw, 64px) 0", background: "#F7F9FC" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 900 }}>
          <h2 style={{ fontSize: "clamp(20px, 4.5vw, 26px)", fontWeight: 800, color: "#142033", marginBottom: 20, lineHeight: 1.25 }}>Ejemplo de resultado (resumen)</h2>
          <div style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 14, padding: 24 }}>
            {[
              { c: "4 · Contexto", s: 85 },
              { c: "6 · Planificación", s: 60 },
              { c: "9 · Evaluación del desempeño", s: 55 },
            ].map(r => (
              <div key={r.c} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "#142033" }}>{r.c}</span>
                  <span style={{ fontWeight: 800, color: "#123C66" }}>{r.s}%</span>
                </div>
                <div style={{ height: 8, background: "#E5EAF2", borderRadius: 99 }}>
                  <div style={{ width: `${r.s}%`, height: 8, background: r.s >= 75 ? "#2E8B57" : "#D68A1A", borderRadius: 99 }} />
                </div>
              </div>
            ))}
            <p style={{ fontSize: 14, color: "#5E6B7A", margin: "20px 0 0" }}>En NormaFlow verás todas las cláusulas, evidencias adjuntas y acciones sugeridas priorizadas.</p>
          </div>
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/signup" style={{ background: "#2E8B57", color: "#fff", padding: "14px 28px", borderRadius: 10, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
              Probar 14 días gratis
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
