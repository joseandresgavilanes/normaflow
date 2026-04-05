import Link from "next/link";
export default function HeroSection() {
  return (
    <section style={{ background: "linear-gradient(160deg, #0D2E4E 0%, #123C66 60%, #1a5490 100%)", padding: "clamp(48px, 12vw, 100px) 0 clamp(40px, 10vw, 80px)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(46,139,87,0.18) 0%, transparent 60%)" }} />
      <div className="nf-mkt-container" style={{ textAlign: "center", position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            background: "rgba(255,255,255,0.09)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 99,
            padding: "6px 16px 6px 10px",
            marginBottom: "clamp(18px, 4vw, 28px)",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <span style={{ background: "#2E8B57", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>NUEVO</span>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(12px, 3vw, 13px)", textAlign: "left" }}>Asistente IA integrado para cumplimiento ISO</span>
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 7vw, 58px)",
            fontWeight: 900,
            color: "#fff",
            margin: "0 0 clamp(14px, 3vw, 20px)",
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
          }}
        >
          Tu sistema de gestión,
          <br />
          <span style={{ color: "#4ade80" }}>digitalizado y bajo control</span>
        </h1>
        <p
          style={{
            fontSize: "clamp(15px, 3.5vw, 20px)",
            color: "rgba(255,255,255,0.72)",
            maxWidth: 600,
            margin: "0 auto clamp(28px, 6vw, 40px)",
            lineHeight: 1.65,
            padding: "0 4px",
          }}
        >
          NormaFlow centraliza cumplimiento, auditorías, riesgos y documentos para ISO 9001 e ISO 27001. Sin hojas de cálculo, sin caos.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/signup"
            style={{
              padding: "clamp(12px, 3vw, 14px) clamp(20px, 6vw, 32px)",
              background: "#2E8B57",
              border: "none",
              borderRadius: 10,
              fontSize: "clamp(14px, 3.5vw, 16px)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            Solicitar demo gratuita →
          </Link>
          <Link
            href="/login"
            style={{
              padding: "clamp(12px, 3vw, 14px) clamp(18px, 5vw, 24px)",
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 10,
              fontSize: "clamp(14px, 3.2vw, 15px)",
              color: "#fff",
              textDecoration: "none",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            Ver la aplicación
          </Link>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "clamp(16px, 5vw, 32px)", marginTop: "clamp(28px, 6vw, 48px)", flexWrap: "wrap" }}>
          {[["ISO 9001", "Calidad"], ["ISO 27001", "Seguridad"], ["14 días", "Trial gratis"], ["Sin tarjeta", "Sin compromiso"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center", minWidth: "min(120px, 42vw)" }}>
              <div style={{ fontSize: "clamp(14px, 3.5vw, 16px)", fontWeight: 700, color: "#4ade80" }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
