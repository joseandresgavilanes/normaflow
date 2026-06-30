"use client";
import Link from "next/link";
import { useState } from "react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";

export default function GapAssessmentLandingPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSent(true);
  }

  const rows = [
    { c: "4 · Contexto",                       s: 85 },
    { c: "5 · Liderazgo",                      s: 92 },
    { c: "6 · Planificación",                  s: 60 },
    { c: "7 · Soporte",                        s: 78 },
    { c: "8 · Operación",                      s: 70 },
    { c: "9 · Evaluación del desempeño",       s: 55 },
    { c: "10 · Mejora",                        s: 68 },
  ];

  return (
    <MarketingLayout>
      <section className="nf-hero">
        <div className="nf-container" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "start" }}>
          <div>
            <span className="nf-eyebrow"><span className="dot"/> GAP Assessment</span>
            <h1 className="nf-h-display" style={{ fontSize: "clamp(32px, 5.4vw, 56px)", marginTop: 22 }}>
              Evalúa tu cumplimiento <span className="nf-grad-text">por cláusula.</span>
            </h1>
            <p className="nf-lede" style={{ marginTop: 22 }}>
              ISO 9001 e ISO 27001 — con puntuación, comentarios y plan de acción priorizado. Versión resumida gratuita; informe completo dentro de la plataforma.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Plantillas por norma (ISO 9001, 27001, 14001, 45001)",
                "Scoring por cláusula y puntuación global",
                "Plan de acción sugerido automáticamente",
                "Exportación a PDF con resumen ejecutivo",
              ].map((t) => (
                <li key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", color: "var(--nf-ink-2)", fontSize: 15 }}>
                  <span style={{ color: "var(--nf-accent)", marginTop: 4 }}><Ic.check/></span>{t}
                </li>
              ))}
            </ul>
          </div>

          <div className="nf-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              Solicitar evaluación de ejemplo
            </div>
            {sent ? (
              <div style={{ padding: 16, borderRadius: 10, background: "var(--nf-accent-soft)", border: "1px solid rgba(82, 102, 246, 0.25)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>● Enviado</div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--nf-ink)" }}>Te enviaremos un ejemplo en menos de un día laborable.</p>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="nf-label">Empresa</label>
                  <input required value={company} onChange={e => setCompany(e.target.value)} className="nf-input" placeholder="Tecnoserv Industrial" />
                </div>
                <div>
                  <label className="nf-label">Email profesional</label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="nf-input" placeholder="maria@empresa.com" />
                </div>
                <button type="submit" className="nf-btn nf-btn--primary" style={{ justifyContent: "center", marginTop: 4 }}>
                  Enviar <Ic.arrow className="nf-arrow"/>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container" style={{ maxWidth: 920 }}>
          <h2 className="nf-h-3">Ejemplo de resultado <span style={{ color: "var(--nf-ink-3)" }}>(resumen)</span></h2>
          <div className="nf-card" style={{ padding: 28, marginTop: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {rows.map((r) => (
                <div key={r.c}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--nf-ink)" }}>{r.c}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: r.s >= 75 ? "var(--nf-accent)" : r.s >= 60 ? "var(--nf-warn)" : "var(--nf-danger)" }}>{r.s}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--nf-glass-2)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${r.s}%`, height: "100%", background: r.s >= 75 ? "linear-gradient(90deg, var(--nf-accent), var(--nf-accent-2))" : r.s >= 60 ? "var(--nf-warn)" : "var(--nf-danger)", boxShadow: r.s >= 75 ? "0 0 8px var(--nf-accent)" : "none" }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: "24px 0 0", paddingTop: 18, borderTop: "1px solid var(--nf-line)" }}>
              En NormaFlow verás <strong style={{ color: "var(--nf-ink-2)" }}>todas las cláusulas</strong>, evidencias adjuntas y acciones sugeridas priorizadas.
            </p>
          </div>
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/signup" className="nf-btn nf-btn--primary">
              Probar 14 días gratis <Ic.arrow className="nf-arrow"/>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
