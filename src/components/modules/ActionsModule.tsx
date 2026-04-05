"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import { DEMO_ACTIONS } from "@/lib/demo-data";

const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#C93C37", HIGH: "#D68A1A", MEDIUM: "#123C66", LOW: "#5E6B7A" };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

export default function ActionsModule() {
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? DEMO_ACTIONS : DEMO_ACTIONS.filter(a => a.status === filter);

  const statusColor: Record<string, string> = { COMPLETED: "#2E8B57", IN_PROGRESS: "#D68A1A", PENDING: "#123C66", IN_REVIEW: "#6B3FB5", CANCELLED: "#5E6B7A" };

  return (
    <div>
      <SectionTitle title="Plan de Acción Global" sub="Acciones originadas en auditorías, riesgos, GAP y no conformidades" action="+ Nueva Acción" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total acciones", value: DEMO_ACTIONS.length, color: "#123C66" },
          { label: "En curso", value: DEMO_ACTIONS.filter(a => a.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Pendientes", value: DEMO_ACTIONS.filter(a => a.status === "PENDING").length, color: "#5E6B7A" },
          { label: "Completadas", value: DEMO_ACTIONS.filter(a => a.status === "COMPLETED").length, color: "#2E8B57" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["ALL", "Todas"], ["PENDING", "Pendiente"], ["IN_PROGRESS", "En curso"], ["IN_REVIEW", "En revisión"], ["COMPLETED", "Completadas"]].map(([s, l]) => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === s ? "#123C66" : "#E5EAF2"}`, background: filter === s ? "#123C6612" : "transparent", color: filter === s ? "#123C66" : "#5E6B7A", fontSize: 13, cursor: "pointer", fontWeight: filter === s ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(action => (
          <Card key={action.id} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "16px 20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                <span style={{ background: PRIORITY_COLOR[action.priority] + "18", color: PRIORITY_COLOR[action.priority], padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                  {PRIORITY_LABEL[action.priority]}
                </span>
                <Badge status={action.status} />
                <span style={{ fontSize: 11, color: "#5E6B7A", background: "#F7F9FC", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5EAF2" }}>
                  {action.type === "CORRECTIVE" ? "Correctiva" : action.type === "PREVENTIVE" ? "Preventiva" : "Mejora"}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#142033", marginBottom: 4 }}>{action.title}</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#5E6B7A" }}>📌 {action.source}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Avatar name={action.owner} size={16} />
                  <span style={{ fontSize: 12, color: "#5E6B7A" }}>{action.owner.split(" ")[0]}</span>
                </div>
                <span style={{ fontSize: 12, color: action.status !== "COMPLETED" && new Date(action.due) < new Date() ? "#C93C37" : "#5E6B7A" }}>
                  📅 {action.due}
                </span>
              </div>
            </div>
            <div style={{ width: 130, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 5 }}>
                <span>Progreso</span><span style={{ fontWeight: 600 }}>{action.progress}%</span>
              </div>
              <ProgressBar value={action.progress} color={action.status === "COMPLETED" ? "#2E8B57" : PRIORITY_COLOR[action.priority] || "#123C66"} height={6} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
