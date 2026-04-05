"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { DEMO_AUDITS } from "@/lib/demo-data";

export default function AuditsModule() {
  const [detail, setDetail] = useState<typeof DEMO_AUDITS[0] | null>(null);

  return (
    <div>
      <SectionTitle title="Auditorías" sub="Plan anual · Auditorías internas y externas" action="+ Nueva Auditoría" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total planificadas", value: DEMO_AUDITS.length, color: "#123C66" },
          { label: "En curso", value: DEMO_AUDITS.filter(a => a.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Completadas", value: DEMO_AUDITS.filter(a => a.status === "COMPLETED").length, color: "#2E8B57" },
          { label: "Hallazgos totales", value: DEMO_AUDITS.reduce((s, a) => s + a.findings, 0), color: "#C93C37" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "18px 12px" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {DEMO_AUDITS.map(audit => (
          <Card key={audit.id} onClick={() => setDetail(audit)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: audit.status !== "PLANNED" ? 14 : 0, flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, background: audit.type === "EXTERNAL" ? "#fff8e6" : "#f0f4ff", color: audit.type === "EXTERNAL" ? "#D68A1A" : "#123C66", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{audit.type === "EXTERNAL" ? "Externa" : "Interna"}</span>
                  <span style={{ fontSize: 11, background: "#F7F9FC", color: "#5E6B7A", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5EAF2" }}>{audit.standard}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 3 }}>{audit.title}</div>
                <div style={{ fontSize: 12, color: "#5E6B7A" }}>Auditor: {audit.auditor} · Fecha: {audit.date}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                {audit.findings > 0 && <span style={{ fontSize: 12, background: "#fff0f0", color: "#C93C37", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>{audit.findings} hallazgos</span>}
                <Badge status={audit.status} />
              </div>
            </div>
            {audit.status !== "PLANNED" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 6 }}>
                  <span>Progreso de ejecución</span>
                  <span style={{ fontWeight: 600 }}>{audit.progress}%</span>
                </div>
                <ProgressBar value={audit.progress} color={audit.status === "COMPLETED" ? "#2E8B57" : "#123C66"} height={6} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ""} width={560}>
        {detail && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[["Tipo", detail.type === "EXTERNAL" ? "Externa" : "Interna"], ["Norma", detail.standard], ["Fecha", detail.date], ["Auditor", detail.auditor], ["Hallazgos", detail.findings], ["Críticos", detail.criticals], ["Progreso", `${detail.progress}%`]].map(([k, v]) => (
                <div key={String(k)} style={{ background: "#F7F9FC", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#142033" }}>{v}</div>
                </div>
              ))}
            </div>
            {detail.scope && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4 }}>ALCANCE</div>
                <div style={{ fontSize: 13, color: "#142033" }}>{detail.scope}</div>
              </div>
            )}
            {detail.objectives && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4 }}>OBJETIVOS</div>
                <div style={{ fontSize: 13, color: "#142033" }}>{detail.objectives}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {detail.status === "PLANNED" ? "Iniciar Auditoría" : "Ver Checklist"}
              </button>
              <button style={{ flex: 1, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✦ IA: Resumir hallazgos</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
