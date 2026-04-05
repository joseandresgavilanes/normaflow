"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { DEMO_NONCONFORMITIES } from "@/lib/demo-data";
import type { Column } from "@/components/ui/Table";

const SEV_COLORS: Record<string, string> = { CRITICAL: "#C93C37", MAJOR: "#D68A1A", MINOR: "#5E6B7A" };

export default function NonconformitiesModule() {
  const [detail, setDetail] = useState<typeof DEMO_NONCONFORMITIES[0] | null>(null);

  const columns: Column<typeof DEMO_NONCONFORMITIES[0]>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "#5E6B7A", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    { key: "title", label: "No Conformidad", render: v => <span style={{ fontWeight: 500, maxWidth: 260, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span> },
    { key: "source", label: "Origen", render: v => <span style={{ fontSize: 12, color: "#5E6B7A" }}>{v.replace(/_/g, " ")}</span> },
    { key: "severity", label: "Severidad", render: v => <span style={{ background: SEV_COLORS[v] + "18", color: SEV_COLORS[v], padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{v === "CRITICAL" ? "Crítica" : v === "MAJOR" ? "Mayor" : "Menor"}</span> },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    { key: "owner", label: "Responsable", render: v => <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={v} size={22} /><span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span></div> },
    { key: "due", label: "Fecha límite" },
  ];

  return (
    <div>
      <SectionTitle title="No Conformidades y CAPA" sub="Hallazgos, análisis de causa raíz y acciones correctivas" action="+ Registrar NC" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total", value: DEMO_NONCONFORMITIES.length, color: "#123C66" },
          { label: "Abiertas", value: DEMO_NONCONFORMITIES.filter(n => n.status === "OPEN").length, color: "#C93C37" },
          { label: "En Curso", value: DEMO_NONCONFORMITIES.filter(n => n.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Cerradas", value: DEMO_NONCONFORMITIES.filter(n => n.status === "CLOSED").length, color: "#2E8B57" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={DEMO_NONCONFORMITIES} onRow={setDetail} />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail?.code} — No Conformidad`} width={580}>
        {detail && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 16 }}>{detail.title}</div>
            {[["Origen", detail.source.replace(/_/g, " ")], ["Severidad", detail.severity], ["Estado", <Badge status={detail.status} />], ["Responsable", detail.owner], ["Fecha límite", detail.due]].map(([k, v]) => (
              <div key={String(k)} style={{ padding: "9px 0", borderBottom: "1px solid #E5EAF2", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5E6B7A" }}>{k}</span>
                <span style={{ color: "#142033", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#F7F9FC", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Causa Raíz Identificada</div>
              <div style={{ fontSize: 13, color: "#142033", lineHeight: 1.6 }}>{detail.rootCause}</div>
            </div>
            <div style={{ padding: "12px 14px", background: "#e8f5ee40", border: "1px solid #2E8B5730", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#2E8B57", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Acción Correctiva</div>
              <div style={{ fontSize: 13, color: "#142033", lineHeight: 1.6 }}>{detail.correctiveAction}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Crear Acción Correctiva</button>
              <button style={{ flex: 1, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✦ IA: Análisis 5 Porqués</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
