"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Plus, Tag, Target, Timer, TrendingUp, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ActionRow } from "@/context/WorkspaceStore";

const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#C93C37", HIGH: "#D68A1A", MEDIUM: "#123C66", LOW: "var(--nf-ink-3)" };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function statusAfterProgressSave(current: ActionRow["status"], progress: number): ActionRow["status"] {
  if (progress >= 100) return "COMPLETED";
  if (current === "COMPLETED" && progress < 100) return "IN_PROGRESS";
  if (progress > 0 && current === "PENDING") return "IN_PROGRESS";
  return current;
}

const FILTER_KEYS = [
  ["ALL", "Todas"],
  ["PENDING", "Pendiente"],
  ["IN_PROGRESS", "En curso"],
  ["IN_REVIEW", "En revisión"],
  ["COMPLETED", "Completadas"],
] as const;

export default function ActionsModule() {
  const { state, dispatch, nextActionCode, showToast } = useWorkspace();
  const { actions } = state;
  const [filter, setFilter] = useState("ALL");
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
  }, [selectedId, actions]);

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

  const inProgress = actions.filter(a => a.status === "IN_PROGRESS").length;
  const pending = actions.filter(a => a.status === "PENDING").length;
  const completed = actions.filter(a => a.status === "COMPLETED").length;

  return (
    <div>
      <SectionTitle
        title="Plan de Acción Global"
        sub="Correctivas, preventivas y mejoras — filtra por estado, abre el detalle y actualiza el progreso."
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Nueva acción
          </span>
        }
        onAction={openCreate}
      />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.14) 0%, rgba(18, 60, 102, 0.05) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <ClipboardList size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{actions.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Acciones totales</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.22) 0%, rgba(214, 138, 26, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <Timer size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{inProgress}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En curso</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.1) 0%, rgba(18, 60, 102, 0.04) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#314456",
            }}
          >
            <Target size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--nf-ink-2)", letterSpacing: "-0.03em", lineHeight: 1 }}>{pending}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Pendientes</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <TrendingUp size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{completed}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Completadas</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Estado
        </span>
        {FILTER_KEYS.map(([s, l]) => (
          <button key={s} type="button" className={filter === s ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setFilter(s)}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 14px",
              borderRadius: 16,
              background: "linear-gradient(135deg, #f3f6fa, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <Zap size={26} strokeWidth={2} aria-hidden />
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nf-ink)" }}>Sin acciones en este filtro</p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--nf-ink-3)" }}>Crea una acción nueva o cambia el filtro de estado.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(action => {
            const pc = PRIORITY_COLOR[action.priority] || "#123C66";
            const overdue = action.status !== "COMPLETED" && new Date(action.due) < new Date();
            return (
              <div key={action.id} className="nf-kpi-card" onClick={() => openDetail(action)} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && openDetail(action)}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${pc}, ${pc}88)` }} />
                <div style={{ padding: "16px 18px 18px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <span
                        style={{
                          background: `${pc}22`,
                          color: pc,
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {PRIORITY_LABEL[action.priority]}
                      </span>
                      <Badge status={action.status} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--nf-ink-2)",
                          background: "#f3f6fa",
                          padding: "4px 10px",
                          borderRadius: 99,
                          border: "1px solid rgba(18, 60, 102, 0.1)",
                        }}
                      >
                        {action.type === "CORRECTIVE" ? "Correctiva" : action.type === "PREVENTIVE" ? "Preventiva" : "Mejora"}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: "#123C66" }}>{action.code}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "var(--nf-ink)",
                        marginBottom: 8,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.3,
                        fontFamily: "var(--font-manrope, Manrope), var(--font-inter, Inter), system-ui, sans-serif",
                      }}
                    >
                      {action.title}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "var(--nf-ink-3)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Tag size={14} strokeWidth={2.25} aria-hidden />
                        <span style={{ fontWeight: 600, color: "var(--nf-ink-2)" }}>{action.source}</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Avatar name={action.owner} size={18} />
                        <span style={{ fontWeight: 600 }}>{action.owner.split(" ")[0]}</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: overdue ? "#C93C37" : "var(--nf-ink-3)", fontWeight: overdue ? 700 : 600 }}>
                        <CalendarDays size={14} strokeWidth={2.25} aria-hidden />
                        {action.due}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 6, fontWeight: 600 }}>
                      <span>Progreso</span>
                      <span style={{ color: pc }}>{action.progress}%</span>
                    </div>
                    <ProgressBar value={action.progress} color={action.status === "COMPLETED" ? "#2E8B57" : pc} height={7} railColor="#eef2f9" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={closeDetail} title={selected ? `${selected.code} — Detalle` : ""} width={540}>
        {selected && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", marginBottom: 10, letterSpacing: "-0.02em" }}>{selected.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(18, 60, 102, 0.08)",
                  color: "var(--nf-ink-2)",
                  border: "1px solid rgba(18, 60, 102, 0.1)",
                }}
              >
                Origen: <strong style={{ color: "var(--nf-ink)" }}>{selected.source}</strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#f3f6fa",
                  border: "1px solid var(--nf-line)",
                  color: "var(--nf-ink-2)",
                }}
              >
                {selected.owner}
              </span>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 10, color: "var(--nf-ink)" }}>
              Progreso (%)
              <input
                className="nf-app-input"
                type="number"
                min={0}
                max={100}
                value={Number.isFinite(progressDraft) ? progressDraft : 0}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setProgressDraft(Number.isFinite(v) ? v : 0);
                }}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 16, color: "var(--nf-ink)" }}>
              Estado
              <select
                className="nf-app-input"
                value={selected.status}
                onChange={e => applyStatusChange(e.target.value as ActionRow["status"])}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En curso</option>
                <option value="IN_REVIEW">En revisión</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </label>
            <button
              type="button"
              onClick={saveDetail}
              style={{ width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Guardar progreso
            </button>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva acción" width={500}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Título
            <input
              className="nf-app-input"
              value={newForm.title}
              onChange={e => setNewForm({ ...newForm, title: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Prioridad
              <select
                className="nf-app-input"
                value={newForm.priority}
                onChange={e => setNewForm({ ...newForm, priority: e.target.value as ActionRow["priority"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Tipo
              <select
                className="nf-app-input"
                value={newForm.type}
                onChange={e => setNewForm({ ...newForm, type: e.target.value as ActionRow["type"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="CORRECTIVE">Correctiva</option>
                <option value="PREVENTIVE">Preventiva</option>
                <option value="IMPROVEMENT">Mejora</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Origen / referencia
            <input
              className="nf-app-input"
              value={newForm.source}
              onChange={e => setNewForm({ ...newForm, source: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Vencimiento
              <input
                className="nf-app-input"
                type="date"
                value={newForm.due}
                onChange={e => setNewForm({ ...newForm, due: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Responsable
              <input
                className="nf-app-input"
                value={newForm.owner}
                onChange={e => setNewForm({ ...newForm, owner: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Crear
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "#fff", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
