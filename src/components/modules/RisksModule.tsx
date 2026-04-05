"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { DEMO_RISKS } from "@/lib/demo-data";
import type { Column } from "@/components/ui/Table";

function RiskScore({ score }: { score: number }) {
  const color = score >= 15 ? "#C93C37" : score >= 8 ? "#D68A1A" : "#2E8B57";
  const bg = score >= 15 ? "#fff0f0" : score >= 8 ? "#fff8e6" : "#e8f5ee";
  return <span style={{ background: bg, color, padding: "2px 9px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{score}</span>;
}

export default function RisksModule() {
  const [detail, setDetail] = useState<typeof DEMO_RISKS[0] | null>(null);

  const columns: Column<typeof DEMO_RISKS[0]>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "#5E6B7A", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    { key: "title", label: "Riesgo", render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: "category", label: "Categoría" },
    { key: "score", label: "Score", render: v => <RiskScore score={v} /> },
    { key: "probability", label: "Prob.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "#D68A1A" }}>{v}/5</span> },
    { key: "impact", label: "Imp.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "#D68A1A" }}>{v}/5</span> },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    { key: "owner", label: "Responsable", render: v => <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={v} size={22} /><span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span></div> },
    { key: "due", label: "Vencimiento" },
  ];

  return (
    <div>
      <SectionTitle title="Gestión de Riesgos" sub="Registro, evaluación y tratamiento de riesgos" action="+ Nuevo Riesgo" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Heatmap */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 14 }}>Mapa de Calor 5×5</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 24, display: "flex", flexDirection: "column", justifyContent: "space-around", paddingBottom: 20 }}>
              {[5, 4, 3, 2, 1].map(p => <span key={p} style={{ fontSize: 11, color: "#5E6B7A", textAlign: "center" }}>{p}</span>)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 6, paddingRight: 4 }}>
                {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: 11, color: "#5E6B7A", width: 36, textAlign: "center" }}>{i}</span>)}
              </div>
              {[5, 4, 3, 2, 1].map(p => (
                <div key={p} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(i => {
                    const score = p * i;
                    const r = DEMO_RISKS.find(rk => rk.probability === p && rk.impact === i);
                    const bg = score >= 15 ? "#fecaca" : score >= 8 ? "#fef3c7" : "#dcfce7";
                    const textColor = score >= 15 ? "#991b1b" : score >= 8 ? "#92400e" : "#166534";
                    return (
                      <div key={i} onClick={() => r && setDetail(r)} title={r?.title}
                        style={{ width: 36, height: 30, background: bg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: r ? 700 : 400, color: textColor, cursor: r ? "pointer" : "default", border: r ? "2px solid rgba(0,0,0,0.12)" : "none", transition: "transform 0.1s" }}>
                        {r ? score : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#5E6B7A", textAlign: "center", marginTop: 6 }}>Impacto →</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14, justifyContent: "center" }}>
            {[{ label: "Crítico (≥15)", color: "#fecaca", text: "#991b1b" }, { label: "Alto (8-14)", color: "#fef3c7", text: "#92400e" }, { label: "Moderado (<8)", color: "#dcfce7", text: "#166534" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: l.color, border: `1px solid ${l.text}40`, borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#5E6B7A" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Riesgos Críticos (≥15)", count: DEMO_RISKS.filter(r => r.score >= 15).length, color: "#C93C37", bg: "#fff0f0" },
            { label: "Riesgos Altos (8-14)", count: DEMO_RISKS.filter(r => r.score >= 8 && r.score < 15).length, color: "#D68A1A", bg: "#fff8e6" },
            { label: "Riesgos Moderados (<8)", count: DEMO_RISKS.filter(r => r.score < 8).length, color: "#2E8B57", bg: "#e8f5ee" },
            { label: "Total registrados", count: DEMO_RISKS.length, color: "#123C66", bg: "#f0f4ff" },
          ].map(s => (
            <Card key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 13, color: "#142033", fontWeight: 500 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5EAF2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#142033" }}>Registro de Riesgos</h3>
          <span style={{ fontSize: 12, color: "#5E6B7A" }}>Ordenado por score descendente</span>
        </div>
        <DataTable columns={columns} rows={[...DEMO_RISKS].sort((a, b) => b.score - a.score)} onRow={setDetail} />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail?.code} — ${detail?.title}`} width={560}>
        {detail && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[["Score", detail.score, detail.score >= 15 ? "#C93C37" : detail.score >= 8 ? "#D68A1A" : "#2E8B57"], ["Probabilidad", `${detail.probability}/5`, "#D68A1A"], ["Impacto", `${detail.impact}/5`, "#D68A1A"]].map(([k, v, c]) => (
                <div key={String(k)} style={{ textAlign: "center", padding: 12, background: "#F7F9FC", borderRadius: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: String(c) }}>{v}</div>
                  <div style={{ fontSize: 12, color: "#5E6B7A" }}>{k}</div>
                </div>
              ))}
            </div>
            {[["Categoría", detail.category], ["Tratamiento", detail.treatment], ["Control actual", detail.control], ["Responsable", detail.owner], ["Vencimiento", detail.due]].map(([k, v]) => (
              <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #E5EAF2", fontSize: 13 }}>
                <span style={{ color: "#5E6B7A" }}>{k}</span>
                <span style={{ color: "#142033", fontWeight: 500, maxWidth: "60%", textAlign: "right" }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Editar Riesgo</button>
              <button style={{ flex: 1, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✦ IA: Sugerir tratamiento</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
