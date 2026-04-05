import Link from "next/link";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { MARKETING_CASES } from "@/lib/marketing-cases";

export const metadata = { title: "Casos de éxito — NormaFlow" };

export default function CasesPage() {
  const cases = MARKETING_CASES;
  return (
    <MarketingLayout>
      <section style={{ background: "#F7F9FC", padding: "80px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Casos de éxito</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, color: "#142033", margin: "0 0 14px", letterSpacing: "-0.5px" }}>Empresas que ya gestionan su cumplimiento con NormaFlow</h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {cases.map(c => (
              <div
                key={c.company}
                style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ background: c.color + "18", color: c.color, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{c.industry}</span>
                    <span style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", color: "#5E6B7A", padding: "3px 10px", borderRadius: 99, fontSize: 12 }}>{c.normas}</span>
                    <span style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", color: "#5E6B7A", padding: "3px 10px", borderRadius: 99, fontSize: 12 }}>{c.employees}</span>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: "#142033", margin: "0 0 10px" }}>{c.company}</h3>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#2E8B57", marginBottom: 12 }}>↑ {c.result}</div>
                  <p style={{ fontSize: 15, color: "#5E6B7A", fontStyle: "italic", lineHeight: 1.7, margin: "0 0 16px" }}>&ldquo;{c.quote}&rdquo;</p>
                  <Link href={`/cases/${c.slug}`} style={{ fontSize: 14, fontWeight: 600, color: "#123C66", textDecoration: "none" }}>
                    Ver caso completo →
                  </Link>
                </div>
                <div style={{ background: c.color + "08", borderRadius: 14, padding: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: c.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {c.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#142033" }}>{c.person}</div>
                      <div style={{ fontSize: 12, color: "#5E6B7A" }}>
                        {c.role} · {c.company}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      ["ISO certificadas", String(c.normas.split(" + ").length)],
                      ["Empleados", c.employees.split(" ")[0]],
                      ["Implementación", "< 6 meses"],
                      ["Auditorías/año", "4+"],
                    ].map(([k, v]) => (
                      <div key={String(k)} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #E5EAF2" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{v}</div>
                        <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 2 }}>{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
