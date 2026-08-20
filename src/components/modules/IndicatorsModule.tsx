"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";
import EntityTable from "@/components/ui/EntityTable";
import { CellTitle, ProgressCell } from "@/components/operations/OperationalUi";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type IndicatorRow } from "@/context/WorkspaceStore";
import { processesLinkedToIndicator } from "@/lib/process-linking";
import Picker from "@/components/ui/Picker";

type StatusFilter = "ALL" | IndicatorRow["status"];

function freqLabel(f: IndicatorRow["frequency"]) {
  return f === "monthly" ? "Mensual" : "Trimestral";
}

function MiniSpark({ chartId, data, color }: { chartId: string; data: number[]; color: string }) {
  const gid = `kpi-spark-${chartId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  if (data.length < 2) {
    return (
      <div style={{ width: 88, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--nf-ink-4)" }}>
        —
      </div>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 88;
  const h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`).join(" ");
  const linePts = pts;
  const firstX = 0;
  const lastX = w;
  const baseY = h;
  const areaPts = `${firstX},${baseY} ${linePts} ${lastX},${baseY}`;
  const lastXi = ((data.length - 1) / (data.length - 1)) * w;
  const lastYi = h - ((data[data.length - 1] - min) / range) * (h - 6) - 3;

  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gid})`} stroke="none" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastXi} cy={lastYi} r="3.5" fill="var(--nf-surface)" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function statusIcon(status: IndicatorRow["status"]) {
  switch (status) {
    case "ON_TRACK":
      return TrendingUp;
    case "AT_RISK":
      return AlertTriangle;
    default:
      return TrendingDown;
  }
}

export default function IndicatorsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { indicators, processes } = state;
  const [detail, setDetail] = useState<IndicatorRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [statusTab, setStatusTab] = useState<StatusFilter>("ALL");
  const [newForm, setNewForm] = useState({
    name: "",
    target: 80,
    unit: "%",
    frequency: "monthly" as IndicatorRow["frequency"],
    clause: "",
    period: "Jun 2026",
    linkedProcessCode: "",
  });
  const [processLinkDraft, setProcessLinkDraft] = useState("");

  const visibleIndicators = useMemo(() => {
    if (statusTab === "ALL") return indicators;
    return indicators.filter(i => i.status === statusTab);
  }, [indicators, statusTab]);

  const indicatorProcesses = useMemo(() => {
    if (!detail) return [];
    return processesLinkedToIndicator(detail, processes);
  }, [detail, processes]);

  const onTrack = indicators.filter(i => i.status === "ON_TRACK").length;
  const atRisk = indicators.filter(i => i.status === "AT_RISK").length;
  const offTrack = indicators.filter(i => i.status === "OFF_TRACK").length;

  function openCreate() {
    setNewForm({ name: "", target: 80, unit: "%", frequency: "monthly", clause: "", period: "Jun 2026", linkedProcessCode: processes[0]?.code ?? "" });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!newForm.name.trim()) {
      showToast("Indica el nombre del KPI");
      return;
    }
    const target = Number(newForm.target) || 1;
    const value = Math.round(target * 0.92 * 10) / 10;
    const history = Array.from({ length: 6 }, (_, i) => Math.round(value * (0.85 + i * 0.03)));
    const nextRev = new Date();
    nextRev.setDate(nextRev.getDate() + 30);
    const ind: IndicatorRow = {
      id: `i-${Date.now()}`,
      name: newForm.name.trim(),
      value,
      target,
      unit: newForm.unit.trim() || "—",
      trend: value >= target ? "up" : "down",
      status: value >= target ? "ON_TRACK" : "AT_RISK",
      period: newForm.period,
      frequency: newForm.frequency,
      history,
      clause: newForm.clause.trim() || "—",
      owner: state.session.name,
      objective: `Seguimiento del indicador para revisión por la dirección y evidencia de cláusula ${newForm.clause.trim() || "—"}.`,
      nextReviewDue: nextRev.toISOString().slice(0, 10),
      managementComment: "",
      alertThresholdPct: 90,
      linkedProcessCode: newForm.linkedProcessCode.trim(),
    };
    dispatch({ type: "addIndicator", ind });
    setCreateOpen(false);
    showToast("KPI creado (sesión local)");
  }

  function openDetail(ind: IndicatorRow) {
    setDetail(ind);
    setEditValue(String(ind.value));
    setCommentDraft(ind.managementComment ?? "");
    setProcessLinkDraft(ind.linkedProcessCode ?? "");
  }

  function saveProcessLink() {
    if (!detail) return;
    const code = processLinkDraft.trim();
    dispatch({ type: "updateIndicator", id: detail.id, patch: { linkedProcessCode: code } });
    setDetail(null);
    showToast(code ? `KPI enlazado al proceso ${code}` : "Enlace de proceso quitado");
  }

  function saveDetailValue() {
    if (!detail) return;
    const v = Number(editValue);
    if (Number.isNaN(v)) {
      showToast("Valor numérico no válido");
      return;
    }
    const pct = (v / detail.target) * 100;
    const status = v >= detail.target ? "ON_TRACK" : pct >= 85 ? "AT_RISK" : "OFF_TRACK";
    const trend = v >= detail.value ? "up" : "down";
    const nextHistory = [...detail.history.slice(-5), v];
    dispatch({
      type: "updateIndicator",
      id: detail.id,
      patch: { value: v, status, trend, history: nextHistory, managementComment: commentDraft.trim() },
    });
    setDetail(null);
    showToast("KPI y notas de dirección guardados (sesión local)");
  }

  return (
    <div>
      <SectionTitle
        title="Indicadores y KPIs"
        sub="Seguimiento de desempeño, tendencia y vínculo a cláusulas ISO — listo para revisión por la dirección"
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Nuevo KPI
          </span>
        }
        onAction={openCreate}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Vista
        </span>
        {(
          [
            { key: "ALL" as const, label: "Todos" },
            { key: "ON_TRACK" as const, label: "En objetivo" },
            { key: "AT_RISK" as const, label: "En riesgo" },
            { key: "OFF_TRACK" as const, label: "Desviados" },
          ] as const
        ).map(t => (
          <button key={t.key} type="button" className={statusTab === t.key ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setStatusTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="nf-kpi-summary">
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-success-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-success-text)",
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-success-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{onTrack}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En objetivo</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-warning-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-warning-text)",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-warning-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{atRisk}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En riesgo</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-danger-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-danger-text)",
              flexShrink: 0,
            }}
          >
            <TrendingDown size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-danger-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{offTrack}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Desviados</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-primary-active)",
              flexShrink: 0,
            }}
          >
            <BarChart3 size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{indicators.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>KPIs en el tablero</div>
          </div>
        </div>
      </div>

      {indicators.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 16,
              background: "var(--nf-app-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-primary-active)",
            }}
          >
            <Target size={28} strokeWidth={2} aria-hidden />
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nf-ink)" }}>Aún no hay KPIs</p>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--nf-ink-3)", lineHeight: 1.55, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
            Crea el primero para seguir metas, umbrales y evidencia hacia la revisión por la dirección.
          </p>
        </Card>
      ) : visibleIndicators.length === 0 ? (
        <Card style={{ padding: 36, textAlign: "center", color: "var(--nf-ink-3)" }}>
          <Activity size={32} strokeWidth={2} style={{ color: "var(--nf-primary-active)", marginBottom: 12 }} aria-hidden />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)" }}>Nada en esta vista</p>
          <p style={{ margin: "8px 0 0", fontSize: 14 }}>Prueba otro filtro o crea un KPI nuevo.</p>
        </Card>
      ) : (
        <EntityTable
          caption="Indicadores"
          rows={visibleIndicators}
          rowKey={(row) => row.id}
          rowAction={(row) => openDetail(row)}
          storageKey="demo-indicators"
          searchText={(row) => `${row.name} ${row.owner ?? ""} ${row.period}`}
          searchPlaceholder="Buscar por nombre o responsable…"
          filters={[
            { id: "status", label: "Estado", value: (row) => row.status },
            { id: "frequency", label: "Frecuencia", value: (row) => row.frequency, format: (value) => freqLabel(value as typeof visibleIndicators[number]["frequency"]) },
          ]}
          emptyTitle="Todavía no hay indicadores"
          emptyDescription="Un indicador necesita meta, unidad y frecuencia para poder seguirse."
          columns={[
            {
              id: "name", header: "Indicador", primary: true, minWidth: 240, sortValue: (row) => row.name,
              cell: (row) => <CellTitle title={row.name} meta={`${row.period} · ${freqLabel(row.frequency)}`} />,
            },
            { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
            { id: "value", header: "Valor", numeric: true, align: "end", sortValue: (row) => row.value, cell: (row) => `${row.value}${row.unit ?? ""}` },
            { id: "target", header: "Meta", numeric: true, align: "end", hideable: true, sortValue: (row) => row.target, cell: (row) => `${row.target}${row.unit ?? ""}` },
            {
              id: "progress", header: "Cumplimiento", numeric: true, sortValue: (row) => (row.target ? row.value / row.target : 0),
              cell: (row) => <ProgressCell value={Math.round(Math.min((row.value / row.target) * 100, 100))} />,
            },
            { id: "owner", header: "Responsable", hideable: true, sortValue: (row) => row.owner ?? "", cell: (row) => row.owner || "Sin responsable" },
          ]}
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo KPI" width={500}>
        <div className="nf-modal-form">
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
            Nombre
            <input
              className="nf-app-input"
              value={newForm.name}
              onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
              Meta
              <input
                className="nf-app-input"
                type="number"
                value={newForm.target}
                onChange={e => setNewForm({ ...newForm, target: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
              Unidad
              <input
                className="nf-app-input"
                value={newForm.unit}
                onChange={e => setNewForm({ ...newForm, unit: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
              Frecuencia
              <Picker aria-label="Frecuencia"
                className="nf-app-input"
                value={newForm.frequency}
                onChange={e => setNewForm({ ...newForm, frequency: e.target.value as IndicatorRow["frequency"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
              </Picker>
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
              Periodo (etiqueta)
              <input
                className="nf-app-input"
                value={newForm.period}
                onChange={e => setNewForm({ ...newForm, period: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
            Cláusula (opcional)
            <input
              className="nf-app-input"
              value={newForm.clause}
              onChange={e => setNewForm({ ...newForm, clause: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
            Proceso asociado
            <Picker aria-label="Proceso asociado"
              className="nf-app-input"
              value={newForm.linkedProcessCode}
              onChange={e => setNewForm({ ...newForm, linkedProcessCode: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
            >
              <option value="">Sin proceso</option>
              {processes.map(p => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Picker>
          </label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitCreate}>Crear KPI</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={580}>
        {detail && (
          <div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(82, 102, 246, 0.08)",
                  color: "var(--nf-ink-2)",
                  border: "1px solid rgba(82, 102, 246, 0.1)",
                }}
              >
                Meta {detail.target}
                {detail.unit}
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
                  background: "rgba(46, 139, 87, 0.1)",
                  color: "var(--nf-text-secondary)",
                  border: "1px solid rgba(46, 139, 87, 0.2)",
                }}
              >
                {detail.owner ?? "—"}
              </span>
              {detail.nextReviewDue && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "var(--nf-surface-muted)",
                    color: "var(--nf-ink-2)",
                    border: "1px solid var(--nf-line)",
                  }}
                >
                  <CalendarClock size={14} strokeWidth={2.25} aria-hidden />
                  Rev. {detail.nextReviewDue}
                </span>
              )}
            </div>
            {detail.objective && (
              <p style={{ fontSize: 13, color: "var(--nf-ink-3)", background: "var(--nf-app-surface-2)", padding: "12px 14px", borderRadius: 12, lineHeight: 1.55, border: "1px solid rgba(82, 102, 246, 0.08)" }}>
                <strong style={{ color: "var(--nf-primary-active)" }}>Objetivo:</strong> {detail.objective}
              </p>
            )}
            <p style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 12 }}>
              Umbral de alerta para revisión: &lt; {detail.alertThresholdPct ?? 90}% de la meta (configurable en implementación).
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginTop: 14, marginBottom: 12, color: "var(--nf-ink)" }}>
              Valor actual
              <input
                className="nf-app-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                type="number"
                step="any"
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 12, color: "var(--nf-ink)" }}>
              Comentario para revisión por la dirección
              <textarea
                className="nf-app-input"
                value={commentDraft}
                onChange={e => setCommentDraft(e.target.value)}
                rows={3}
                placeholder="Decisiones, causas, acuerdos del comité…"
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical", minHeight: 88 }}
              />
            </label>
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: "1px solid var(--nf-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-primary-active)", letterSpacing: "-0.02em" }}>Procesos enlazados</span>
                <Link href="/app/processes" style={{ fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700 }}>
                  Mapa de procesos →
                </Link>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", display: "block", marginBottom: 8 }}>
                Proceso principal
                <Picker aria-label="Proceso principal"
                  className="nf-app-input"
                  value={processLinkDraft}
                  onChange={e => setProcessLinkDraft(e.target.value)}
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
                >
                  <option value="">Sin proceso</option>
                  {processes.map(p => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </Picker>
              </label>
              <button
                type="button"
                onClick={saveProcessLink}
                style={{
                  marginBottom: 12,
                  background: "var(--nf-surface-selected)",
                  color: "var(--nf-primary-active)",
                  border: "1px solid rgba(82, 102, 246, 0.15)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Guardar enlace de proceso
              </button>
              {indicatorProcesses.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.65 }}>
                  {indicatorProcesses.map(p => (
                    <li key={p.id}>
                      <span style={{ fontWeight: 700 }}>{p.code}</span> — {p.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: 13, color: "var(--nf-ink-4)" }}>Ninguno enlazado por nombre o proceso.</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={saveDetailValue}
                className="nf-app-btn-primary" style={{ flex: "1 1 200px" }}
              >
                Guardar valor y comentario
              </button>
              <Link
                href="/app/reporting"
                style={{
                  flex: "0 1 auto",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "11px 18px",
                  border: "1px solid var(--nf-line)",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--nf-primary-active)",
                  textDecoration: "none",
                  background: "var(--nf-surface)",
                }}
              >
                Informes
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
