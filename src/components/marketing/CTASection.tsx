import Link from "next/link";
export default function CTASection() {
  return (
    <section style={{ background: "#fff", padding: "80px 0" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 40, fontWeight: 800, color: "#142033", margin: "0 0 16px", letterSpacing: "-1px" }}>Empieza en menos de una hora</h2>
        <p style={{ fontSize: 18, color: "#5E6B7A", marginBottom: 32, lineHeight: 1.65 }}>Sin integraciones complejas. Sin formación costosa. Tus datos migrados en el día.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup" style={{ padding: "14px 32px", background: "#123C66", borderRadius: 10, fontSize: 16, color: "#fff", fontWeight: 700, textDecoration: "none", display: "inline-block" }}>Solicitar demo gratuita →</Link>
          <Link href="/pricing" style={{ padding: "14px 24px", background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 10, fontSize: 15, color: "#5E6B7A", textDecoration: "none", display: "inline-block" }}>Ver precios</Link>
        </div>
      </div>
    </section>
  );
}
