"use client";

import { useMemo, useState, useTransition } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { NF_INPUT_CLASS, modalInputStyle } from "@/components/ui/ModalForm";
import {
  useAdminMock,
  type ACPMRow,
  type ACPMStage,
  type ACPMType,
  type ACPMPriority,
} from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { formatDate, timeAgo } from "@/lib/utils";

const STAGES: { key: ACPMStage; label: string; sub: string }[] = [
  { key: "REQUEST",           label: "Solicitud",             sub: "Apertura" },
  { key: "REQUEST_APPROVAL",  label: "Aprobación solicitud",  sub: "Validación inicial" },
  { key: "ANALYSIS",          label: "Análisis",              sub: "Causa raíz + solución" },
  { key: "SOLUTION_APPROVAL", label: "Aprobación solución",   sub: "Validación de solución" },
  { key: "IMPLEMENTATION",    label: "Implementación",        sub: "Ejecución" },
  { key: "VERIFICATION",      label: "Verificación",          sub: "Eficacia" },
  { key: "CLOSED",            label: "Cerrada",               sub: "Verificada" },
];

const STAGE_INDEX = new Map(STAGES.map((s, i) => [s.key, i]));
const STAGE_LABEL = new Map(STAGES.map((s) => [s.key, s.label]));

const TYPE_LABEL: Record<ACPMType, string> = {
  CORRECTIVE: "Correctiva",
  PREVENTIVE: "Preventiva",
  IMPROVEMENT: "Mejora",
};
const TYPE_COLOR: Record<ACPMType, string> = {
  CORRECTIVE: "#DC2626",
  PREVENTIVE: "#D97706",
  IMPROVEMENT: "var(--nf-accent)",
};
const PRIORITY_LABEL: Record<ACPMPriority, string> = {
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
};
const PRIORITY_COLOR: Record<ACPMPriority, string> = {
  CRITICAL: "#DC2626", HIGH: "#D97706", MEDIUM: "#5266F6", LOW: "var(--nf-ink-3)",
};

export default function ACPMClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("actions:*") || perm.can("actions:update");
  const canCreate = canEdit || perm.can("actions:create");

  const { acpms, acpmHistory, personnel } = admin.state;
  const personnelLookup = useMemo(
    () => new Map(personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`])),
    [personnel]
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ACPMType>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ACPMPriority>("ALL");
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return acpms.filter((a) => {
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
      if (priorityFilter !== "ALL" && a.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        a.code.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        (a.source ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [acpms, search, typeFilter, priorityFilter]);

  const byStage = useMemo(() => {
    const m = new Map<ACPMStage, ACPMRow[]>();
    STAGES.forEach((s) => m.set(s.key, []));
    filtered.forEach((a) => m.get(a.stage)?.push(a));
    return m;
  }, [filtered]);

  const stats = useMemo(() => {
    const open = acpms.filter((a) => a.stage !== "CLOSED");
    const overdue = open.filter((a) => a.dueDate && new Date(a.dueDate).getTime() < Date.now()).length;
    const inAnalysis = open.filter((a) => a.stage === "ANALYSIS" || a.stage === "REQUEST_APPROVAL").length;
    const inImplementation = open.filter((a) => a.stage === "IMPLEMENTATION" || a.stage === "SOLUTION_APPROVAL").length;
    return { open: open.length, overdue, inAnalysis, inImplementation, closed: acpms.length - open.length };
  }, [acpms]);

  const selected = useMemo(() => acpms.find((a) => a.id === selectedId) ?? null, [acpms, selectedId]);

  useCreateFromQuery(canCreate, () => {
    setCreating(true);
    setCreateError("");
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCreateError("");
    startTransition(async () => {
      try {
        await admin.createACPM({
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || "") || undefined,
          type: String(fd.get("type") || "CORRECTIVE") as ACPMType,
          priority: String(fd.get("priority") || "MEDIUM") as ACPMPriority,
          source: String(fd.get("source") || "") || undefined,
          dueDate: String(fd.get("dueDate") || "") || undefined,
        });
        setCreating(false);
      } catch (err: unknown) {
        setCreateError(err instanceof Error ? err.message : "No se pudo crear la ACPM.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Plan de acción"
        sub="ACPM: correctivas, preventivas y de mejora. Pipeline solicitud → aprobación → análisis → solución → implementación → verificación → cierre."
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {canCreate ? <Plus size={18} strokeWidth={2.5} aria-hidden /> : null}
            Nueva ACPM
          </span>
        }
        onAction={canCreate ? () => { setCreating(true); setCreateError(""); } : undefined}
        actionButtonClass={canCreate ? "nf-app-btn-primary" : undefined}
      />

      <div className="nf-kpi-summary">
        <div className="nf-kpi-summary-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--navy" aria-hidden>
            <ClipboardList size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--navy">{stats.open}</div>
            <div className="nf-activity-kpi-label">Abiertas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--amber" aria-hidden>
            <Search size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--ink">{stats.inAnalysis}</div>
            <div className="nf-activity-kpi-label">En análisis</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--violet" aria-hidden>
            <Wrench size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--violet">{stats.inImplementation}</div>
            <div className="nf-activity-kpi-label">En implementación</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div className={`nf-activity-kpi-icon ${stats.overdue ? "nf-activity-kpi-icon--danger" : "nf-activity-kpi-icon--slate"}`} aria-hidden>
            <AlertTriangle size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className={`nf-activity-kpi-value ${stats.overdue ? "nf-activity-kpi-value--danger" : "nf-activity-kpi-value--slate"}`}>{stats.overdue}</div>
            <div className="nf-activity-kpi-label">Vencidas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--green" aria-hidden>
            <CheckCircle2 size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--green">{stats.closed}</div>
            <div className="nf-activity-kpi-label">Cerradas</div>
          </div>
        </div>
      </div>

      <div className="nf-activity-panel" role="region" aria-label="Tablero y lista de ACPM">
        <div className="nf-acpm-toolbar">
          <div className="nf-activity-toolbar-row" style={{ marginBottom: 0 }}>
            <div className="nf-activity-search-wrap">
              <Search className="nf-activity-search-icon" size={18} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="nf-app-input"
                placeholder="Buscar por código, título, origen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                aria-label="Filtrar ACPMs"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="nf-app-input"
              style={{ minWidth: 148, fontSize: 13, cursor: "pointer" }}
              aria-label="Tipo de acción"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="CORRECTIVE">Correctiva</option>
              <option value="PREVENTIVE">Preventiva</option>
              <option value="IMPROVEMENT">Mejora</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
              className="nf-app-input"
              style={{ minWidth: 168, fontSize: 13, cursor: "pointer" }}
              aria-label="Prioridad"
            >
              <option value="ALL">Todas las prioridades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
            <div className="nf-acpm-view-switch" role="group" aria-label="Vista">
              <button
                type="button"
                className={view === "board" ? "nf-acpm-view-btn nf-acpm-view-btn--on" : "nf-acpm-view-btn"}
                onClick={() => setView("board")}
              >
                <LayoutGrid size={16} strokeWidth={2.25} aria-hidden />
                Kanban
              </button>
              <button
                type="button"
                className={view === "list" ? "nf-acpm-view-btn nf-acpm-view-btn--on" : "nf-acpm-view-btn"}
                onClick={() => setView("list")}
              >
                <List size={16} strokeWidth={2.25} aria-hidden />
                Lista
              </button>
            </div>
            <span className="nf-activity-counter">
              <strong>{filtered.length}</strong>
              <span style={{ fontWeight: 650, opacity: 0.75 }}>de</span>
              <span style={{ fontWeight: 750 }}>{acpms.length}</span>
            </span>
          </div>
        </div>

        <div className="nf-acpm-body">
          {view === "board" ? (
            <div
              className="nf-acpm-board-scroller"
              style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(232px, 1fr))` }}
            >
              {STAGES.map((s, colIdx) => {
                const rows = byStage.get(s.key) ?? [];
                return (
                  <div key={s.key} className="nf-acpm-col">
                    <div className="nf-acpm-col-head">
                      <div style={{ minWidth: 0 }}>
                        <div className="nf-acpm-col-title">{s.label}</div>
                        <div className="nf-acpm-col-sub">{s.sub}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <span className="nf-acpm-col-idx" aria-hidden>
                          {String(colIdx + 1).padStart(2, "0")}
                        </span>
                        <span className="nf-acpm-col-count">{rows.length}</span>
                      </div>
                    </div>

                    <div className="nf-acpm-col-cards">
                      {rows.length === 0 ? (
                        <div className="nf-acpm-col-empty">Sin tarjetas</div>
                      ) : (
                        rows.map((a) => {
                          const typeC = TYPE_COLOR[a.type];
                          const overdueCard = a.dueDate && new Date(a.dueDate).getTime() < Date.now() && a.stage !== "CLOSED";
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setSelectedId(a.id)}
                              className="nf-acpm-card-btn"
                              style={{ borderLeftColor: typeC }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <span className="nf-acpm-card-code">{a.code}</span>
                                <span
                                  className="nf-acpm-card-prio"
                                  style={{
                                    color: PRIORITY_COLOR[a.priority],
                                    background: `${PRIORITY_COLOR[a.priority]}14`,
                                    borderColor: `${PRIORITY_COLOR[a.priority]}44`,
                                  }}
                                >
                                  {PRIORITY_LABEL[a.priority]}
                                </span>
                              </div>
                              <div className="nf-acpm-card-title">{a.title}</div>
                              <div className="nf-acpm-card-meta">
                                <span style={{ color: typeC }}>{TYPE_LABEL[a.type]}</span>
                                {a.dueDate ? (
                                  <span style={{ color: overdueCard ? "#DC2626" : undefined }}>
                                    {overdueCard ? "Vence " : ""}
                                    {formatDate(a.dueDate, "dd MMM")}
                                  </span>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                              {a.progress > 0 && a.stage !== "CLOSED" && (
                                <div className="nf-acpm-progress-rail" aria-hidden>
                                  <div className="nf-acpm-progress-fill" style={{ width: `${a.progress}%`, background: "var(--nf-accent, #16A34A)" }} />
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="nf-acpm-list">
              {filtered.length === 0 ? (
                <div className="nf-acpm-list-empty">
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }} aria-hidden>
                    <span
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--nf-app-accent-soft)",
                        border: "1px solid rgba(82, 102, 246, 0.12)",
                        color: "#5266F6",
                      }}
                    >
                      <Sparkles size={24} strokeWidth={2.25} />
                    </span>
                  </div>
                  <p className="nf-acpm-list-empty-title">Nada que mostrar</p>
                  <p className="nf-acpm-list-empty-sub">Prueba otros filtros o crea una ACPM nueva.</p>
                </div>
              ) : (
                filtered.map((a) => (
                  <button key={a.id} type="button" onClick={() => setSelectedId(a.id)} className="nf-acpm-list-row">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto auto auto",
                        gap: 14,
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <code style={{ fontSize: 11, color: "#5266F6", fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{a.code}</code>
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>{a.title}</div>
                        {a.source && <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4, fontWeight: 500 }}>Origen: {a.source}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[a.type] }}>{TYPE_LABEL[a.type]}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: PRIORITY_COLOR[a.priority],
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: `${PRIORITY_COLOR[a.priority]}14`,
                          border: `1px solid ${PRIORITY_COLOR[a.priority]}40`,
                        }}
                      >
                        {PRIORITY_LABEL[a.priority]}
                      </span>
                      <Badge status={a.stage === "CLOSED" ? "CLOSED" : "IN_PROGRESS"} label={STAGE_LABEL.get(a.stage)} />
                      <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontFamily: "ui-monospace, monospace", minWidth: 88, textAlign: "right", fontWeight: 600 }}>
                        {a.dueDate ? formatDate(a.dueDate) : "—"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ACPMDetailModal
        acpm={selected}
        history={selected ? acpmHistory.filter((h) => h.acpmId === selected.id).sort((a, b) => b.at.localeCompare(a.at)) : []}
        personnelLookup={personnelLookup}
        canEdit={canEdit}
        onClose={() => setSelectedId(null)}
      />

      <Modal open={creating} onClose={() => !isPending && setCreating(false)} title="Nueva ACPM" width={620}>
        <form onSubmit={handleCreate} className="nf-modal-form">
          <Field label="Título *">
            <input name="title" required className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="p.ej. Quejas sobre tiempos de respuesta" />
          </Field>
          <Field label="Descripción">
            <textarea name="description" rows={3} className={NF_INPUT_CLASS} style={modalInputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Tipo">
              <select name="type" defaultValue="CORRECTIVE" className={NF_INPUT_CLASS} style={modalInputStyle}>
                <option value="CORRECTIVE">Correctiva</option>
                <option value="PREVENTIVE">Preventiva</option>
                <option value="IMPROVEMENT">Mejora</option>
              </select>
            </Field>
            <Field label="Prioridad">
              <select name="priority" defaultValue="MEDIUM" className={NF_INPUT_CLASS} style={modalInputStyle}>
                <option value="CRITICAL">Crítica</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </Field>
            <Field label="Fecha objetivo">
              <input type="date" name="dueDate" className={NF_INPUT_CLASS} style={modalInputStyle} />
            </Field>
          </div>
          <Field label="Origen">
            <input name="source" className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="Auditoría interna, Voz del cliente, Reporte, etc." />
          </Field>
          {createError && <div className="nf-modal-error">{createError}</div>}
          <div className="nf-modal-actions">
            <button type="button" onClick={() => setCreating(false)} disabled={isPending} className="nf-app-btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="nf-app-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {isPending ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="nf-icon-spin" aria-hidden />
                  Creando…
                </>
              ) : (
                "Crear ACPM"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Detail modal with stage timeline + transition controls ─────────

function ACPMDetailModal({
  acpm,
  history,
  personnelLookup,
  canEdit,
  onClose,
}: {
  acpm: ACPMRow | null;
  history: ReturnType<typeof useAdminMock>["state"]["acpmHistory"];
  personnelLookup: Map<string, string>;
  canEdit: boolean;
  onClose: () => void;
}) {
  const admin = useAdminMock();
  const [actionError, setActionError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!acpm) return null;

  const stageIdx = STAGE_INDEX.get(acpm.stage) ?? 0;

  function patch(field: keyof ACPMRow, value: unknown) {
    if (!acpm || !canEdit) return;
    setActionError("");
    startTransition(async () => {
      try {
        await admin.updateACPMFields(acpm.id, { [field]: value } as Parameters<typeof admin.updateACPMFields>[1]);
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  function advance(to: ACPMStage) {
    if (!acpm) return;
    setActionError("");
    startTransition(async () => {
      try {
        await admin.transitionACPM(acpm.id, to);
        onClose();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  function handleReject(comment: string) {
    if (!acpm) return;
    setActionError("");
    startTransition(async () => {
      try {
        await admin.rejectACPM(acpm.id, comment);
        setRejectOpen(false);
        onClose();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  function handleComment() {
    if (!acpm || !commentText.trim()) return;
    setActionError("");
    startTransition(async () => {
      try {
        await admin.commentACPM(acpm.id, commentText);
        setCommentText("");
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  const overdue = acpm.dueDate && new Date(acpm.dueDate).getTime() < Date.now() && acpm.stage !== "CLOSED";
  const requester = acpm.requestedById ? personnelLookup.get(acpm.requestedById) : null;
  const owner = acpm.ownerId ? personnelLookup.get(acpm.ownerId) : null;

  return (
    <Modal open onClose={onClose} title={`${acpm.code} — ${acpm.title}`} width={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Stage progress bar */}
        <div className="nf-acpm-stage-rail" aria-label="Etapas del flujo ACPM">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx;
            const barColor = active || done ? "var(--nf-accent, #16A34A)" : "rgba(82, 102, 246, 0.12)";
            return (
              <div key={s.key} className="nf-acpm-stage-node">
                <div className="nf-acpm-stage-bar" style={{ background: barColor }} />
                <div className={`nf-acpm-stage-label ${active ? "nf-acpm-stage-label--active" : ""}`}>
                  {String(i + 1).padStart(2, "0")} · {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top meta */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Meta label="Tipo" value={<span style={{ color: TYPE_COLOR[acpm.type], fontWeight: 600 }}>{TYPE_LABEL[acpm.type]}</span>} />
          <Meta label="Prioridad" value={<span style={{ color: PRIORITY_COLOR[acpm.priority], fontWeight: 600 }}>{PRIORITY_LABEL[acpm.priority]}</span>} />
          <Meta label="Estado" value={<Badge status={acpm.stage === "CLOSED" ? "CLOSED" : "IN_PROGRESS"} label={STAGE_LABEL.get(acpm.stage)} />} />
          <Meta label="Solicitada por" value={requester ?? "—"} />
          <Meta label="Responsable" value={owner ?? <span style={{ color: "var(--nf-ink-4)" }}>Sin asignar</span>} />
          <Meta
            label="Fecha objetivo"
            value={
              acpm.dueDate ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: overdue ? "#DC2626" : "var(--nf-ink)", fontWeight: overdue ? 600 : 400 }}>
                  {formatDate(acpm.dueDate)}
                  {overdue ? <AlertTriangle size={15} strokeWidth={2.5} aria-label="Vencida" /> : null}
                </span>
              ) : (
                <span style={{ color: "var(--nf-ink-4)" }}>—</span>
              )
            }
          />
        </div>

        {acpm.description && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 4 }}>Descripción</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-2)", lineHeight: 1.55 }}>{acpm.description}</p>
          </div>
        )}

        {acpm.source && (
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em" }}>Origen</span>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--nf-ink-2)" }}>{acpm.source}</div>
          </div>
        )}

        {/* Stage-specific editor */}
        <StageEditor acpm={acpm} canEdit={canEdit} onPatch={patch} personnel={admin.state.personnel} />

        {actionError && (
          <div className="nf-modal-error">{actionError}</div>
        )}

        {/* Transition controls */}
        {canEdit && acpm.stage !== "CLOSED" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em" }}>Acciones de etapa:</span>
            <TransitionButtons stage={acpm.stage} disabled={isPending} onAdvance={advance} onReject={() => setRejectOpen(true)} />
          </div>
        )}

        {/* History */}
        <div>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--nf-ink)" }}>Historial</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflow: "auto", paddingRight: 4 }}>
            {history.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--nf-ink-4)", margin: 0 }}>Sin historial.</p>
            ) : history.map((h) => {
              const iconBg =
                h.kind === "transition" ? "var(--nf-accent, #16A34A)" : h.kind === "comment" ? "#5266F6" : "var(--nf-ink-3)";
              return (
                <div key={h.id} className="nf-acpm-history-row">
                  <span className="nf-acpm-history-icon" style={{ background: iconBg }}>
                    {h.kind === "transition" ? (
                      <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
                    ) : h.kind === "comment" ? (
                      <MessageCircle size={14} strokeWidth={2.25} aria-hidden />
                    ) : (
                      <Pencil size={14} strokeWidth={2.25} aria-hidden />
                    )}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--nf-ink)" }}>
                      {h.fromStage && h.toStage && (
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--nf-ink-3)", marginRight: 6 }}>
                          {STAGE_LABEL.get(h.fromStage)} → {STAGE_LABEL.get(h.toStage)}
                        </span>
                      )}
                      {!h.fromStage && h.toStage && (
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--nf-ink-3)", marginRight: 6 }}>
                          Apertura → {STAGE_LABEL.get(h.toStage)}
                        </span>
                      )}
                      {h.message}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--nf-ink-3)", marginTop: 2, fontFamily: "monospace" }}>
                      {h.actorId ? personnelLookup.get(h.actorId) ?? "—" : "Sistema"} · {timeAgo(h.at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Añadir comentario…"
                className={`${NF_INPUT_CLASS} nf-app-input--toolbar`}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="button" disabled={isPending || !commentText.trim()} onClick={handleComment} className="nf-app-btn-primary">
                Comentar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal open={rejectOpen} onClose={() => !isPending && setRejectOpen(false)} title="Rechazar etapa" width={460}>
        <RejectForm onCancel={() => setRejectOpen(false)} onSubmit={handleReject} disabled={isPending} />
      </Modal>
    </Modal>
  );
}

// ─── Stage-specific editor ──────────────────────────────────────────

function StageEditor({
  acpm,
  canEdit,
  onPatch,
  personnel,
}: {
  acpm: ACPMRow;
  canEdit: boolean;
  onPatch: (field: keyof ACPMRow, value: unknown) => void;
  personnel: { id: string; firstName: string; lastName: string; active: boolean }[];
}) {
  const stage = acpm.stage;

  if (stage === "REQUEST" || stage === "REQUEST_APPROVAL") {
    return (
      <Section title="Etapa: Solicitud" hint="Apertura y validación inicial. Cualquier responsable puede aprobar para iniciar el análisis.">
        <p style={{ fontSize: 13, color: "var(--nf-ink-2)", margin: 0 }}>
          {stage === "REQUEST"
            ? "La ACPM ha sido creada. Cuando estés listo, envíala a aprobación inicial."
            : "Solicitud pendiente de aprobación por un responsable de calidad o dirección."}
        </p>
      </Section>
    );
  }

  if (stage === "ANALYSIS") {
    return (
      <Section title="Etapa: Análisis" hint="Documenta la causa raíz (5 porqués, Ishikawa) y propón una solución.">
        <Field label="Causa raíz">
          <textarea
            disabled={!canEdit}
            defaultValue={acpm.rootCause ?? ""}
            onBlur={(e) => onPatch("rootCause", e.target.value)}
            rows={3}
            className={NF_INPUT_CLASS} style={modalInputStyle}
            placeholder="Análisis de causa raíz (p.ej. método 5 porqués)…"
          />
        </Field>
        <Field label="Solución propuesta">
          <textarea
            disabled={!canEdit}
            defaultValue={acpm.proposedSolution ?? ""}
            onBlur={(e) => onPatch("proposedSolution", e.target.value)}
            rows={3}
            className={NF_INPUT_CLASS} style={modalInputStyle}
            placeholder="Acciones concretas, plazos, responsables…"
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Responsable">
            <select
              disabled={!canEdit}
              defaultValue={acpm.ownerId ?? ""}
              onChange={(e) => onPatch("ownerId", e.target.value || null)}
              className={NF_INPUT_CLASS} style={modalInputStyle}
            >
              <option value="">— Sin asignar —</option>
              {personnel.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Fecha objetivo">
            <input
              type="date"
              disabled={!canEdit}
              defaultValue={acpm.dueDate?.slice(0, 10) ?? ""}
              onBlur={(e) => onPatch("dueDate", e.target.value || null)}
              className={NF_INPUT_CLASS} style={modalInputStyle}
            />
          </Field>
        </div>
      </Section>
    );
  }

  if (stage === "SOLUTION_APPROVAL") {
    return (
      <Section title="Etapa: Aprobación de la solución" hint="Revisa la causa raíz y la solución propuesta antes de aprobar la implementación.">
        <Meta label="Causa raíz" value={acpm.rootCause ?? <em style={{ color: "var(--nf-ink-4)" }}>No documentada</em>} />
        <Meta label="Solución propuesta" value={acpm.proposedSolution ?? <em style={{ color: "var(--nf-ink-4)" }}>No documentada</em>} />
      </Section>
    );
  }

  if (stage === "IMPLEMENTATION") {
    return (
      <Section title="Etapa: Implementación" hint="Avanza el progreso a medida que se ejecutan las acciones.">
        <Field label={`Progreso · ${acpm.progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            disabled={!canEdit}
            defaultValue={acpm.progress}
            onMouseUp={(e) => onPatch("progress", Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => onPatch("progress", Number((e.target as HTMLInputElement).value))}
            style={{ width: "100%" }}
          />
          <div style={{ height: 6, background: "var(--nf-line)", borderRadius: 99, marginTop: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${acpm.progress}%`, background: "var(--nf-accent)", transition: "width 0.2s" }} />
          </div>
        </Field>
      </Section>
    );
  }

  if (stage === "VERIFICATION") {
    return (
      <Section title="Etapa: Verificación de eficacia" hint="Documenta cómo se verificó que la solución es eficaz antes de cerrar.">
        <Field label="Verificación de eficacia">
          <textarea
            disabled={!canEdit}
            defaultValue={acpm.effectivenessCheck ?? ""}
            onBlur={(e) => onPatch("effectivenessCheck", e.target.value)}
            rows={3}
            className={NF_INPUT_CLASS} style={modalInputStyle}
            placeholder="p.ej. 30 días sin reincidencia, indicador X dentro de objetivo…"
          />
        </Field>
        <Field label="Fecha de verificación">
          <input
            type="date"
            disabled={!canEdit}
            defaultValue={acpm.effectivenessAt?.slice(0, 10) ?? ""}
            onBlur={(e) => onPatch("effectivenessAt", e.target.value || null)}
            className={NF_INPUT_CLASS} style={modalInputStyle}
          />
        </Field>
      </Section>
    );
  }

  // CLOSED
  return (
    <Section title="ACPM cerrada" hint="Esta ACPM ha sido verificada y cerrada. Los campos son de solo lectura.">
      <Meta label="Causa raíz" value={acpm.rootCause ?? "—"} />
      <Meta label="Solución" value={acpm.proposedSolution ?? "—"} />
      <Meta label="Verificación de eficacia" value={acpm.effectivenessCheck ?? "—"} />
      {acpm.effectivenessAt && <Meta label="Cerrada el" value={formatDate(acpm.effectivenessAt)} />}
    </Section>
  );
}

function TransitionButtons({
  stage,
  disabled,
  onAdvance,
  onReject,
}: {
  stage: ACPMStage;
  disabled: boolean;
  onAdvance: (to: ACPMStage) => void;
  onReject: () => void;
}) {
  switch (stage) {
    case "REQUEST":
      return (
        <button type="button" disabled={disabled} onClick={() => onAdvance("REQUEST_APPROVAL")} className="nf-app-btn-primary">
          Enviar a aprobación →
        </button>
      );
    case "REQUEST_APPROVAL":
      return (
        <>
          <button type="button" disabled={disabled} onClick={() => onAdvance("ANALYSIS")} className="nf-app-btn-primary">
            Aprobar solicitud →
          </button>
          <button type="button" disabled={disabled} onClick={onReject} className="nf-app-btn-danger">
            Rechazar
          </button>
        </>
      );
    case "ANALYSIS":
      return (
        <button type="button" disabled={disabled} onClick={() => onAdvance("SOLUTION_APPROVAL")} className="nf-app-btn-primary">
          Enviar solución a aprobación →
        </button>
      );
    case "SOLUTION_APPROVAL":
      return (
        <>
          <button type="button" disabled={disabled} onClick={() => onAdvance("IMPLEMENTATION")} className="nf-app-btn-primary">
            Aprobar solución →
          </button>
          <button type="button" disabled={disabled} onClick={onReject} className="nf-app-btn-danger">
            Rechazar
          </button>
        </>
      );
    case "IMPLEMENTATION":
      return (
        <button type="button" disabled={disabled} onClick={() => onAdvance("VERIFICATION")} className="nf-app-btn-primary">
          Marcar implementada →
        </button>
      );
    case "VERIFICATION":
      return (
        <button type="button" disabled={disabled} onClick={() => onAdvance("CLOSED")} className="nf-app-btn-primary">
          Cerrar ACPM ✓
        </button>
      );
    default:
      return null;
  }
}

function RejectForm({ onCancel, onSubmit, disabled }: { onCancel: () => void; onSubmit: (msg: string) => void; disabled: boolean }) {
  const [msg, setMsg] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field label="Motivo del rechazo *">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="Indica brevemente por qué se rechaza." />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} disabled={disabled} className="nf-app-btn-outline">
          Cancelar
        </button>
        <button type="button" disabled={disabled || !msg.trim()} onClick={() => onSubmit(msg)} className="nf-app-btn-danger">
          Rechazar
        </button>
      </div>
    </div>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nf-modal-field">
      <span className="nf-modal-field-label">{label}</span>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{value}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--nf-line)", background: "var(--nf-app-surface-1)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 4 }}>{title}</div>
      {hint && <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--nf-ink-3)" }}>{hint}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
