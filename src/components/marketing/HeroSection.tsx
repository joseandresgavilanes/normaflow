import Link from "next/link";
export default function HeroSection() {
  return (
    <section style={{ background: "linear-gradient(160deg, #0D2E4E 0%, #123C66 60%, #1a5490 100%)", padding: "100px 0 80px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(46,139,87,0.18) 0%, transparent 60%)" }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 99, padding: "5px 16px 5px 10px", marginBottom: 28 }}>
          <span style={{ background: "#2E8B57", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>NUEVO</span>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>Asistente IA integrado para cumplimiento ISO</span>
        </div>
        <h1 style={{ fontSize: 58, fontWeight: 900, color: "#fff", margin: "0 0 20px", letterSpacing: "-1.5px", lineHeight: 1.05 }}>
          Tu sistema de gestión,<br /><span style={{ color: "#4ade80" }}>digitalizado y bajo control</span>
        </h1>
        <p style={{ fontSize: 20, color: "rgba(255,255,255,0.72)", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.65 }}>
          NormaFlow centraliza cumplimiento, auditorías, riesgos y documentos para ISO 9001 e ISO 27001. Sin hojas de cálculo, sin caos.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup" style={{ padding: "14px 32px", background: "#2E8B57", border: "none", borderRadius: 10, fontSize: 16, color: "#fff", fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
            Solicitar demo gratuita →
          </Link>
          <Link href="/login" style={{ padding: "14px 24px", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 10, fontSize: 15, color: "#fff", textDecoration: "none", display: "inline-block" }}>
            Ver la aplicación
          </Link>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 48, flexWrap: "wrap" }}>
          {[["ISO 9001", "Calidad"], ["ISO 27001", "Seguridad"], ["14 días", "Trial gratis"], ["Sin tarjeta", "Sin compromiso"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80" }}>{v}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
