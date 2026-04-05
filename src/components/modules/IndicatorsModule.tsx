"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type IndicatorRow } from "@/context/WorkspaceStore";

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80,
    h = 30;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const lastX = ((data.length - 1) / (data.length - 1)) * w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

export default function IndicatorsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { indicators } = state;
  const [detail, setDetail] = useState<IndicatorRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [newForm, setNewForm] = useState({
    name: "",
    target: 80,
    unit: "%",
    frequency: "monthly" as IndicatorRow["frequency"],
    clause: "",
    period: "Jun 2026",
  });

  function openCreate() {
    setNewForm({ name: "", target: 80, unit: "%", frequency: "monthly", clause: "", period: "Jun 2026" });
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
    };
    dispatch({ type: "addIndicator", ind });
    setCreateOpen(false);
    setDetail(ind);
    showToast("KPI creado (sesión demo)");
  }

  function openDetail(ind: IndicatorRow) {
    setDetail(ind);
    setEditValue(String(ind.value));
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
      patch: { value: v, status, trend, history: nextHistory },
    });
    setDetail({ ...detail, value: v, status, trend, history: nextHistory });
    showToast("KPI actualizado (sesión demo)");
  }

  return (
    <div>
      <SectionTitle title="Indicadores y KPIs" sub="Monitoreo de desempeño del sistema de gestión" action="+ Nuevo KPI" onAction={openCreate} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "En objetivo", value: indicators.filter(i => i.status === "ON_TRACK").length, color: "#2E8B57" },
          { label: "En riesgo", value: indicators.filter(i => i.status === "AT_RISK").length, color: "#D68A1A" },
          { label: "Desviados", value: indicators.filter(i => i.status === "OFF_TRACK").length, color: "#C93C37" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "14px 12px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {indicators.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>No hay KPIs. Usa + Nuevo KPI para añadir el primero.</Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {indicators.map(ind => {
            const color = ind.status === "ON_TRACK" ? "#2E8B57" : ind.status === "AT_RISK" ? "#D68A1A" : "#C93C37";
            const pct = Math.min((ind.value / ind.target) * 100, 100);
            return (
              <Card key={ind.id} onClick={() => openDetail(ind)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#142033", marginBottom: 2, lineHeight: 1.3 }}>{ind.name}</div>
                    <div style={{ fontSize: 11, color: "#5E6B7A" }}>
                      {ind.period} · {ind.frequency === "monthly" ? "Mensual" : "Trimestral"}
                    </div>
                  </div>
                  <Badge status={ind.status} />
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>
                      {ind.value}
                      <span style={{ fontSize: 14, fontWeight: 400, color: "#5E6B7A", marginLeft: 2 }}>{ind.unit}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 3 }}>
                      Meta:{" "}
                      <strong style={{ color: "#142033" }}>
                        {ind.target}
                        {ind.unit}
                      </strong>
                      {" · "}
                      <span style={{ color: ind.trend === "up" ? "#2E8B57" : "#C93C37" }}>{ind.trend === "up" ? "↑" : "↓"} Tendencia</span>
                    </div>
                  </div>
                  <MiniChart data={ind.history} color={color} />
                </div>

                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 5 }}>
                    <span>Cumplimiento de meta</span>
                    <span style={{ fontWeight: 600, color }}>{Math.round(pct)}%</span>
                  </div>
                  <ProgressBar value={pct} color={color} height={6} />
                </div>

                {ind.clause && (
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 8, display: "flex", gap: 4 }}>
                    <span>Cláusula ISO:</span>
                    <span style={{ background: "#f0f4ff", color: "#123C66", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{ind.clause}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo KPI" width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Nombre
            <input
              value={newForm.name}
              onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Meta
              <input
                type="number"
                value={newForm.target}
                onChange={e => setNewForm({ ...newForm, target: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Unidad
              <input
                value={newForm.unit}
                onChange={e => setNewForm({ ...newForm, unit: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Frecuencia
              <select
                value={newForm.frequency}
                onChange={e => setNewForm({ ...newForm, frequency: e.target.value as IndicatorRow["frequency"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Periodo (etiqueta)
              <input
                value={newForm.period}
                onChange={e => setNewForm({ ...newForm, period: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Cláusula (opcional)
            <input
              value={newForm.clause}
              onChange={e => setNewForm({ ...newForm, clause: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Crear KPI
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={480}>
        {detail && (
          <div>
            <p style={{ fontSize: 13, color: "#5E6B7A", marginTop: 0 }}>Meta: {detail.target}</p>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 16 }}>
              Valor actual
              <input
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                type="number"
                step="any"
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <button type="button" onClick={saveDetailValue} style={{ width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Guardar valor
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
