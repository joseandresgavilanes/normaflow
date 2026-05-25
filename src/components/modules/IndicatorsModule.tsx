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
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type IndicatorRow } from "@/context/WorkspaceStore";
import { processesLinkedToIndicator } from "@/lib/process-linking";

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
      <circle cx={lastXi} cy={lastYi} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
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
    setDetail({ ...detail, linkedProcessCode: code });
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
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{onTrack}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En objetivo</div>
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
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{atRisk}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En riesgo</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(201, 60, 55, 0.2) 0%, rgba(201, 60, 55, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a32a26",
              flexShrink: 0,
            }}
          >
            <TrendingDown size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#C93C37", letterSpacing: "-0.03em", lineHeight: 1 }}>{offTrack}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Desviados</div>
          </div>
        </div>
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
              flexShrink: 0,
            }}
          >
            <BarChart3 size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{indicators.length}</div>
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
              background: "linear-gradient(135deg, #f3f6fa, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
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
          <Activity size={32} strokeWidth={2} style={{ color: "#123C66", marginBottom: 12 }} aria-hidden />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)" }}>Nada en esta vista</p>
          <p style={{ margin: "8px 0 0", fontSize: 14 }}>Prueba otro filtro o crea un KPI nuevo.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 18 }}>
          {visibleIndicators.map(ind => {
            const color = ind.status === "ON_TRACK" ? "#2E8B57" : ind.status === "AT_RISK" ? "#D68A1A" : "#C93C37";
            const pct = Math.min((ind.value / ind.target) * 100, 100);
            const Icon = statusIcon(ind.status);
            return (
              <div key={ind.id} className="nf-kpi-card" onClick={() => openDetail(ind)} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && openDetail(ind)}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}99, ${color}55)` }} />
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: "var(--nf-ink)",
                          marginBottom: 6,
                          lineHeight: 1.25,
                          letterSpacing: "-0.02em",
                          fontFamily: "var(--font-manrope, Manrope), var(--font-inter, Inter), system-ui, sans-serif",
                        }}
                      >
                        {ind.name}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 12, color: "var(--nf-ink-3)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CalendarClock size={13} strokeWidth={2.25} aria-hidden />
                          {ind.period}
                        </span>
                        <span style={{ opacity: 0.45 }}>·</span>
                        <span>{freqLabel(ind.frequency)}</span>
                        {ind.owner && (
                          <>
                            <span style={{ opacity: 0.45 }}>·</span>
                            <span style={{ color: "#123C66", fontWeight: 700 }}>{ind.owner}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 11,
                          background: `${color}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color,
                        }}
                      >
                        <Icon size={20} strokeWidth={2.25} aria-hidden />
                      </div>
                      <Badge status={ind.status} />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 38, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.04em" }}>
                        {ind.value}
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink-3)", marginLeft: 4 }}>{ind.unit}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>
                          Meta{" "}
                          <strong style={{ color: "var(--nf-ink)" }}>
                            {ind.target}
                            {ind.unit}
                          </strong>
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 700,
                            color: ind.trend === "up" ? "#2E8B57" : "#C93C37",
                          }}
                        >
                          {ind.trend === "up" ? <TrendingUp size={14} strokeWidth={2.5} aria-hidden /> : <TrendingDown size={14} strokeWidth={2.5} aria-hidden />}
                          Tendencia
                        </span>
                      </div>
                    </div>
                    <MiniSpark chartId={ind.id} data={ind.history} color={color} />
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 6, fontWeight: 600 }}>
                      <span>Cumplimiento de meta</span>
                      <span style={{ color }}>{Math.round(pct)}%</span>
                    </div>
                    <ProgressBar value={pct} color={color} height={7} railColor="#eef2f9" />
                  </div>

                  {ind.clause && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>ISO</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          background: "linear-gradient(180deg, #f0f4ff 0%, #e8eef8 100%)",
                          color: "#123C66",
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(18, 60, 102, 0.15)",
                        }}
                      >
                        Cláusula {ind.clause}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo KPI" width={500}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <select
                className="nf-app-input"
                value={newForm.frequency}
                onChange={e => setNewForm({ ...newForm, frequency: e.target.value as IndicatorRow["frequency"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
              </select>
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
            <select
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
            </select>
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Crear KPI
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "#fff", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
              Cancelar
            </button>
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
                  background: "rgba(18, 60, 102, 0.08)",
                  color: "var(--nf-ink-2)",
                  border: "1px solid rgba(18, 60, 102, 0.1)",
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
                  color: "#1f5f3f",
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
                    background: "#f3f6fa",
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
              <p style={{ fontSize: 13, color: "var(--nf-ink-3)", background: "linear-gradient(180deg, #f5f8fc 0%, #eef3f9 100%)", padding: "12px 14px", borderRadius: 12, lineHeight: 1.55, border: "1px solid rgba(18, 60, 102, 0.08)" }}>
                <strong style={{ color: "#123C66" }}>Objetivo:</strong> {detail.objective}
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
                <span style={{ fontSize: 13, fontWeight: 800, color: "#123C66", letterSpacing: "-0.02em" }}>Procesos enlazados</span>
                <Link href="/app/processes" style={{ fontSize: 12, color: "#123C66", fontWeight: 700 }}>
                  Mapa de procesos →
                </Link>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", display: "block", marginBottom: 8 }}>
                Proceso principal
                <select
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
                </select>
              </label>
              <button
                type="button"
                onClick={saveProcessLink}
                style={{
                  marginBottom: 12,
                  background: "#f0f4fa",
                  color: "#123C66",
                  border: "1px solid rgba(18, 60, 102, 0.15)",
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
                style={{ flex: "1 1 200px", background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
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
                  color: "#123C66",
                  textDecoration: "none",
                  background: "#fff",
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
