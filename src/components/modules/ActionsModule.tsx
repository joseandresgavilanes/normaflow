"use client";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ActionRow } from "@/context/WorkspaceStore";

const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#C93C37", HIGH: "#D68A1A", MEDIUM: "#123C66", LOW: "#5E6B7A" };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Derive status after a progress save without clobbering explicit workflow states. */
function statusAfterProgressSave(current: ActionRow["status"], progress: number): ActionRow["status"] {
  if (progress >= 100) return "COMPLETED";
  if (current === "COMPLETED" && progress < 100) return "IN_PROGRESS";
  if (progress > 0 && current === "PENDING") return "IN_PROGRESS";
  return current;
}

export default function ActionsModule() {
  const { state, dispatch, nextActionCode, showToast } = useWorkspace();
  const { actions } = state;
  const [filter, setFilter] = useState("ALL");
  /** Detail modal: track id only so list + modal always read the same store row. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => (selectedId ? actions.find(a => a.id === selectedId) ?? null : null), [actions, selectedId]);
  const [createOpen, setCreateOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState(0);
  const [newForm, setNewForm] = useState({
    title: "",
    priority: "MEDIUM" as ActionRow["priority"],
    type: "CORRECTIVE" as ActionRow["type"],
    source: "",
    due: new Date().toISOString().slice(0, 10),
    owner: "",
  });

  const filtered = filter === "ALL" ? actions : actions.filter(a => a.status === filter);

  useEffect(() => {
    if (!selectedId) return;
    const row = actions.find(a => a.id === selectedId);
    if (row) setProgressDraft(row.progress);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && !actions.some(a => a.id === selectedId)) setSelectedId(null);
  }, [actions, selectedId]);

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
    showToast(`Acción ${code} añadida al plan global (demo)`);
  }

  function openDetail(a: ActionRow) {
    setSelectedId(a.id);
  }

  function closeDetail() {
    setSelectedId(null);
  }

  function saveDetail() {
    if (!selected) return;
    const progress = clampProgress(progressDraft);
    const status = statusAfterProgressSave(selected.status, progress);
    dispatch({
      type: "updateAction",
      id: selected.id,
      patch: { progress, status },
    });
    closeDetail();
    showToast("Acción actualizada (sesión demo)");
  }

  function applyStatusChange(st: ActionRow["status"]) {
    if (!selected) return;
    const patch: Partial<ActionRow> = { status: st };
    if (st === "COMPLETED") {
      patch.progress = 100;
      setProgressDraft(100);
    }
    dispatch({ type: "updateAction", id: selected.id, patch });
  }

  return (
    <div>
      <SectionTitle
        title="Plan de Acción Global"
        sub="Vista consolidada: filtra por estado, abre el detalle y actualiza el progreso. Las acciones enlazan con NC, riesgos y auditorías."
        action="+ Nueva Acción"
        onAction={openCreate}
      />

      <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 16 }}>
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

      <Modal open={!!selected} onClose={closeDetail} title={selected ? `${selected.code} — Detalle` : ""} width={520}>
        {selected && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 12 }}>{selected.title}</div>
            <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 16 }}>
              Origen: <strong style={{ color: "#142033" }}>{selected.source}</strong> · Responsable: {selected.owner}
            </div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 8 }}>
              Progreso (%)
              <input
                type="number"
                min={0}
                max={100}
                value={Number.isFinite(progressDraft) ? progressDraft : 0}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setProgressDraft(Number.isFinite(v) ? v : 0);
                }}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 16 }}>
              Estado
              <select
                value={selected.status}
                onChange={e => applyStatusChange(e.target.value as ActionRow["status"])}
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
          <div className="nf-grid-2" style={{ gap: 10 }}>
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
          <div className="nf-grid-2" style={{ gap: 10 }}>
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
