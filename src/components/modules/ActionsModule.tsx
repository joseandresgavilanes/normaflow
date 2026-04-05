"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ActionRow } from "@/context/WorkspaceStore";

const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#C93C37", HIGH: "#D68A1A", MEDIUM: "#123C66", LOW: "#5E6B7A" };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

export default function ActionsModule() {
  const { state, dispatch, nextActionCode, showToast } = useWorkspace();
  const { actions } = state;
  const [filter, setFilter] = useState("ALL");
  const [detail, setDetail] = useState<ActionRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProgress, setEditProgress] = useState(0);
  const [newForm, setNewForm] = useState({
    title: "",
    priority: "MEDIUM" as ActionRow["priority"],
    type: "CORRECTIVE" as ActionRow["type"],
    source: "",
    due: new Date().toISOString().slice(0, 10),
    owner: "",
  });

  const filtered = filter === "ALL" ? actions : actions.filter(a => a.status === filter);

  function openCreate() {
    setNewForm({
      title: "",
      priority: "MEDIUM",
      type: "CORRECTIVE",
      source: "Manual",
      due: new Date().toISOString().slice(0, 10),
      owner: state.session.name,
    });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!newForm.title.trim()) {
      showToast("Indica el título de la acción");
      return;
    }
    const code = nextActionCode();
    const action: ActionRow = {
      id: `ac-${Date.now()}`,
      code,
      title: newForm.title.trim(),
      priority: newForm.priority,
      status: "PENDING",
      due: newForm.due,
      owner: newForm.owner.trim() || state.session.name,
      source: newForm.source.trim() || "Manual",
      progress: 0,
      type: newForm.type,
    };
    dispatch({ type: "addAction", action });
    setCreateOpen(false);
    setDetail(action);
    showToast(`Acción ${code} añadida al plan global (demo)`);
  }

  function openDetail(a: ActionRow) {
    setDetail(a);
    setEditProgress(a.progress);
  }

  function saveDetail() {
    if (!detail) return;
    const progress = Math.min(100, Math.max(0, editProgress));
    const status = progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : detail.status === "COMPLETED" ? "COMPLETED" : "PENDING";
    dispatch({
      type: "updateAction",
      id: detail.id,
      patch: { progress, status: status as ActionRow["status"] },
    });
    setDetail({ ...detail, progress, status: status as ActionRow["status"] });
    showToast("Acción actualizada (sesión demo)");
  }

  return (
    <div>
      <SectionTitle
        title="Plan de Acción Global"
        sub="Vista consolidada: filtra por estado, abre el detalle y actualiza el progreso. Las acciones enlazan con NC, riesgos y auditorías."
        action="+ Nueva Acción"
        onAction={openCreate}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total acciones", value: actions.length, color: "#123C66" },
          { label: "En curso", value: actions.filter(a => a.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Pendientes", value: actions.filter(a => a.status === "PENDING").length, color: "#5E6B7A" },
          { label: "Completadas", value: actions.filter(a => a.status === "COMPLETED").length, color: "#2E8B57" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["ALL", "Todas"],
          ["PENDING", "Pendiente"],
          ["IN_PROGRESS", "En curso"],
          ["IN_REVIEW", "En revisión"],
          ["COMPLETED", "Completadas"],
        ].map(([s, l]) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${filter === s ? "#123C66" : "#E5EAF2"}`,
              background: filter === s ? "#123C6612" : "transparent",
              color: filter === s ? "#123C66" : "#5E6B7A",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: filter === s ? 600 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>No hay acciones con este filtro. Crea una con + Nueva Acción.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(action => (
            <Card key={action.id} onClick={() => openDetail(action)} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "16px 20px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                  <span style={{ background: PRIORITY_COLOR[action.priority] + "18", color: PRIORITY_COLOR[action.priority], padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{PRIORITY_LABEL[action.priority]}</span>
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
                  <span style={{ fontSize: 12, color: action.status !== "COMPLETED" && new Date(action.due) < new Date() ? "#C93C37" : "#5E6B7A" }}>📅 {action.due}</span>
                </div>
              </div>
              <div style={{ width: 130, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 5 }}>
                  <span>Progreso</span>
                  <span style={{ fontWeight: 600 }}>{action.progress}%</span>
                </div>
                <ProgressBar value={action.progress} color={action.status === "COMPLETED" ? "#2E8B57" : PRIORITY_COLOR[action.priority] || "#123C66"} height={6} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.code} — Detalle` : ""} width={520}>
        {detail && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 12 }}>{detail.title}</div>
            <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 16 }}>
              Origen: <strong style={{ color: "#142033" }}>{detail.source}</strong> · Responsable: {detail.owner}
            </div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 8 }}>
              Progreso (%)
              <input
                type="number"
                min={0}
                max={100}
                value={editProgress}
                onChange={e => setEditProgress(Number(e.target.value))}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 16 }}>
              Estado
              <select
                value={detail.status}
                onChange={e => {
                  const st = e.target.value as ActionRow["status"];
                  setDetail({ ...detail, status: st });
                  dispatch({ type: "updateAction", id: detail.id, patch: { status: st } });
                }}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En curso</option>
                <option value="IN_REVIEW">En revisión</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </label>
            <button type="button" onClick={saveDetail} style={{ width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Guardar progreso
            </button>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva acción" width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Título
            <input
              value={newForm.title}
              onChange={e => setNewForm({ ...newForm, title: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Prioridad
              <select
                value={newForm.priority}
                onChange={e => setNewForm({ ...newForm, priority: e.target.value as ActionRow["priority"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Tipo
              <select
                value={newForm.type}
                onChange={e => setNewForm({ ...newForm, type: e.target.value as ActionRow["type"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="CORRECTIVE">Correctiva</option>
                <option value="PREVENTIVE">Preventiva</option>
                <option value="IMPROVEMENT">Mejora</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Origen / referencia
            <input
              value={newForm.source}
              onChange={e => setNewForm({ ...newForm, source: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Vencimiento
              <input
                type="date"
                value={newForm.due}
                onChange={e => setNewForm({ ...newForm, due: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Responsable
              <input
                value={newForm.owner}
                onChange={e => setNewForm({ ...newForm, owner: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Crear
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
