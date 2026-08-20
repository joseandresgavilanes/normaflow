"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import RiskMatrix from "@/components/charts/RiskMatrix";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ProcessRow, type RiskRow } from "@/context/WorkspaceStore";
import { processesLinkedToRisk } from "@/lib/process-linking";
import { DEFAULT_RISK_CATEGORY, riskCategoryOptions } from "@/lib/risk-catalog";
import type { Column } from "@/components/ui/Table";
import Picker from "@/components/ui/Picker";
import DateField from "@/components/ui/DateField";

function RiskScore({ score }: { score: number }) {
  // El par relleno/fondo daba 2.94-4.36:1. Los tonos de texto sobre su fondo
  // sutil cumplen en los dos temas.
  const color = score >= 15 ? "var(--nf-danger-text)" : score >= 8 ? "var(--nf-warning-text)" : "var(--nf-success-text)";
  const bg = score >= 15 ? "var(--nf-danger-subtle)" : score >= 8 ? "var(--nf-warning-subtle)" : "var(--nf-success-subtle)";
  return <span style={{ background: bg, color, padding: "2px 9px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{score}</span>;
}

function riskTraceBlock(title: string, href: string, children: ReactNode) {
  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 14,
        border: "1px solid rgba(82, 102, 246, 0.12)",
        background: "var(--nf-surface-muted)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          background: "var(--nf-app-surface-2)",
          borderBottom: "1px solid rgba(82, 102, 246, 0.1)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>{title}</span>
        <Link href={href} style={{ fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", whiteSpace: "nowrap" }}>
          Abrir módulo
          <ChevronRight size={15} strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
      <div style={{ padding: "14px 16px 16px", fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

type RiskForm = {
  title: string;
  category: string;
  probability: number;
  impact: number;
  status: RiskRow["status"];
  owner: string;
  due: string;
  control: string;
  treatment: RiskRow["treatment"];
  linkedProcessCode: string;
};

const emptyForm = (owner: string, defaultProcessCode = ""): RiskForm => ({
  title: "",
  category: DEFAULT_RISK_CATEGORY,
  probability: 3,
  impact: 3,
  status: "MONITORED",
  owner,
  due: new Date().toISOString().slice(0, 10),
  control: "",
  treatment: "MITIGATE",
  linkedProcessCode: defaultProcessCode,
});

export default function RisksModule() {
  const { state, dispatch, nextRiskCode, showToast } = useWorkspace();
  const { risks, changeRequests, suppliers, processes, actions } = state;
  const [detail, setDetail] = useState<RiskRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<RiskForm>(() => emptyForm(state.session.name));

  const sortedRisks = useMemo(() => [...risks].sort((a, b) => b.score - a.score), [risks]);

  const riskLinks = useMemo(() => {
    if (!detail) return null;
    const code = detail.code;
    return {
      changes: changeRequests.filter(c => c.riskCodes?.includes(code)),
      suppliers: suppliers.filter(s => s.riskCodes?.includes(code)),
      processes: processesLinkedToRisk(detail, processes),
      actions: actions.filter(a => a.source === code),
    };
  }, [detail, changeRequests, suppliers, processes, actions]);

  const columns: Column<RiskRow>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "var(--nf-ink-3)", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    { key: "title", label: "Riesgo", render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: "category", label: "Categoría" },
    { key: "score", label: "Score", render: v => <RiskScore score={v} /> },
    { key: "probability", label: "Prob.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-warning-text)" }}>{v}/5</span> },
    { key: "impact", label: "Imp.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-warning-text)" }}>{v}/5</span> },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    {
      key: "owner",
      label: "Responsable",
      render: v => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={v} size={22} />
          <span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span>
        </div>
      ),
    },
    { key: "due", label: "Vencimiento" },
  ];

  function openCreate() {
    setForm(emptyForm(state.session.name, processes[0]?.code ?? ""));
    setCreateOpen(true);
  }

  function openEditFromDetail() {
    if (!detail) return;
    setForm({
      title: detail.title,
      category: detail.category,
      probability: detail.probability,
      impact: detail.impact,
      status: detail.status,
      owner: detail.owner,
      due: detail.due,
      control: detail.control,
      treatment: detail.treatment,
      linkedProcessCode: detail.linkedProcessCode ?? "",
    });
    setEditOpen(true);
  }

  function submitCreate() {
    if (!form.title.trim()) {
      showToast("Indica un título para el riesgo");
      return;
    }
    const code = nextRiskCode();
    const p = Math.min(5, Math.max(1, form.probability));
    const i = Math.min(5, Math.max(1, form.impact));
    const risk: RiskRow = {
      id: `r-${Date.now()}`,
      code,
      title: form.title.trim(),
      category: form.category,
      probability: p,
      impact: i,
      score: p * i,
      status: form.status,
      owner: form.owner.trim() || state.session.name,
      due: form.due,
      control: form.control.trim() || "Por definir",
      treatment: form.treatment,
      linkedProcessCode: form.linkedProcessCode.trim(),
    };
    dispatch({ type: "addRisk", risk });
    setCreateOpen(false);
    showToast(`Riesgo ${code} creado (sesión local)`);
  }

  function submitEdit() {
    if (!detail) return;
    if (!form.title.trim()) {
      showToast("Indica un título para el riesgo");
      return;
    }
    const p = Math.min(5, Math.max(1, form.probability));
    const i = Math.min(5, Math.max(1, form.impact));
    dispatch({
      type: "updateRisk",
      id: detail.id,
      patch: {
        title: form.title.trim(),
        category: form.category,
        probability: p,
        impact: i,
        status: form.status,
        owner: form.owner.trim() || state.session.name,
        due: form.due,
        control: form.control.trim() || "Por definir",
        treatment: form.treatment,
        linkedProcessCode: form.linkedProcessCode.trim(),
      },
    });
    setDetail(null);
    setEditOpen(false);
    showToast("Riesgo actualizado (sesión local)");
  }

  return (
    <div>
      <SectionTitle title="Gestión de Riesgos" sub="Registro, evaluación y tratamiento de riesgos" action="Nuevo Riesgo" onAction={openCreate} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20, marginBottom: 20 }}>
        <RiskMatrix
          risks={risks}
          onSelect={(cell) => setDetail(cell[0])}
          title="Mapa de calor 5×5"
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Riesgos Críticos (≥15)", count: risks.filter(r => r.score >= 15).length, color: "var(--nf-danger-text)", bg: "var(--nf-danger-subtle)" },
            { label: "Riesgos Altos (8-14)", count: risks.filter(r => r.score >= 8 && r.score < 15).length, color: "var(--nf-warning-text)", bg: "var(--nf-warning-subtle)" },
            { label: "Riesgos Moderados (<8)", count: risks.filter(r => r.score < 8).length, color: "var(--nf-success-text)", bg: "var(--nf-success-subtle)" },
            { label: "Total registrados", count: risks.length, color: "var(--nf-primary-active)", bg: "var(--nf-primary-subtle)" },
          ].map(s => (
            <Card key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: 30, fontWeight: 600, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 500 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nf-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--nf-ink)" }}>Registro de Riesgos</h3>
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Ordenado por score descendente</span>
        </div>
        <DataTable columns={columns} rows={sortedRisks} onRow={setDetail} emptyText="No hay riesgos. Crea uno con + Nuevo Riesgo." />
      </Card>

      <Modal open={!!detail && !editOpen} onClose={() => setDetail(null)} title={`${detail?.code} — ${detail?.title}`} width={700}>
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div
              style={{
                marginBottom: 20,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid var(--nf-line)",
                background: "linear-gradient(145deg, var(--nf-primary-subtle) 0%, var(--nf-surface) 55%)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 10 }}>Evaluación inherente</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {[
                  ["Score", detail.score, detail.score >= 15 ? "var(--nf-danger-text)" : detail.score >= 8 ? "var(--nf-warning-text)" : "var(--nf-success-text)"],
                  ["Probabilidad", `${detail.probability}/5`, "var(--nf-warning-text)"],
                  ["Impacto", `${detail.impact}/5`, "var(--nf-warning-text)"],
                ].map(([k, v, c]) => (
                  <div
                    key={String(k)}
                    style={{
                      textAlign: "center",
                      padding: "14px 10px",
                      background: "var(--nf-surface)",
                      borderRadius: 12,
                      border: "1px solid rgba(82, 102, 246, 0.1)",
                      boxShadow: "0 1px 0 rgba(82, 102, 246, 0.04)",
                    }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 600, color: String(c), letterSpacing: "-0.03em" }}>{v}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", marginTop: 6, textTransform: "none", letterSpacing: "0.04em" }}>{k}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginBottom: 20,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid var(--nf-line)",
                background: "var(--nf-surface-muted)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 12 }}>Ficha del riesgo</div>
              {[
                ["Categoría", detail.category],
                ["Tratamiento", detail.treatment],
                ["Proceso", detail.linkedProcessCode ? `${detail.linkedProcessCode}` : "—"],
                ["Control actual", detail.control],
                ["Responsable", detail.owner],
                ["Vencimiento revisión", detail.due],
              ].map(([k, v], i, arr) => (
                <div
                  key={String(k)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "12px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(82, 102, 246, 0.1)" : "none",
                    fontSize: 13,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: "var(--nf-ink-3)", fontWeight: 700, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: "var(--nf-ink)", fontWeight: 600, textAlign: "right", maxWidth: "62%", lineHeight: 1.45 }}>{v}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginBottom: 20,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(46, 139, 87, 0.25)",
                background: "linear-gradient(135deg, #f0fdf6 0%, #ffffff 100%)",
                fontSize: 13,
                color: "var(--nf-ink-2)",
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              <strong style={{ color: "var(--nf-ink)" }}>Riesgo residual (estimación):</strong> inherente {detail.score} pts · tras controles documentados se asume reducción operativa ~{" "}
              {Math.max(1, Math.round(detail.score * 0.55))} pts (validar en tratamiento real y evidencias).
            </div>

            {riskLinks && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 6 }}>Trazabilidad</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 14, letterSpacing: "-0.02em" }}>Vínculos operativos</div>

                {riskTraceBlock(
                  "Acciones",
                  "/app/actions",
                  riskLinks.actions.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {riskLinks.actions.map(a => (
                        <li key={a.id} style={{ marginBottom: 8 }}>
                          <span style={{ fontWeight: 700 }}>{a.code}</span> — {a.title}{" "}
                          <Badge status={a.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: "var(--nf-ink-3)", fontStyle: "italic" }}>Sin acciones con origen {detail.code}.</span>
                  )
                )}

                {riskTraceBlock(
                  "Control de cambios",
                  "/app/changes",
                  riskLinks.changes.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {riskLinks.changes.map(c => (
                        <li key={c.id} style={{ marginBottom: 8 }}>
                          <span style={{ fontWeight: 700 }}>{c.code}</span> — {c.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: "var(--nf-ink-3)", fontStyle: "italic" }}>Sin CR vinculadas a este código.</span>
                  )
                )}

                {riskTraceBlock(
                  "Proveedores",
                  "/app/suppliers",
                  riskLinks.suppliers.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {riskLinks.suppliers.map(s => (
                        <li key={s.id} style={{ marginBottom: 8 }}>
                          <span style={{ fontWeight: 700 }}>{s.code}</span> — {s.name}{" "}
                          <span style={{ color: "var(--nf-ink-3)", fontSize: 12 }}>({s.criticality})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: "var(--nf-ink-3)", fontStyle: "italic" }}>Sin proveedores catalogados con este riesgo.</span>
                  )
                )}

                {riskTraceBlock(
                  "Procesos",
                  "/app/processes",
                  riskLinks.processes.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {riskLinks.processes.map(p => (
                        <li key={p.id} style={{ marginBottom: 8 }}>
                          <span style={{ fontWeight: 700 }}>{p.code}</span> — {p.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguno enlazado por código o proceso.</span>
                  )
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={openEditFromDetail}
                style={{
                  flex: 1,
                  minWidth: 160,
                  background: "var(--nf-primary)",
                  color: "var(--nf-text-on-primary)",
                  border: "none",
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                Editar riesgo
              </button>
              <button
                type="button"
                onClick={() => showToast("Sugerencia IA: revisa controles y reduce probabilidad o impacto según el análisis.")}
                style={{
                  flex: 1,
                  minWidth: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#16A34A18",
                  color: "var(--nf-success-text)",
                  border: "1px solid #16A34A40",
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={17} strokeWidth={2} aria-hidden />
                IA: Sugerir tratamiento
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo riesgo" width={600}>
        <div className="nf-modal-form">
          <RiskFormFields form={form} setForm={setForm} processes={processes} />
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitCreate}>Guardar</button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar riesgo" width={600}>
        <div className="nf-modal-form">
          <RiskFormFields form={form} setForm={setForm} processes={processes} />
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setEditOpen(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitEdit}>Guardar cambios</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RiskFormFields({
  form,
  setForm,
  processes,
}: {
  form: RiskForm;
  setForm: (f: RiskForm) => void;
  processes: ProcessRow[];
}) {
  return (
    <div className="nf-modal-form">
      <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
        Título
        <input
          className="nf-app-input"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
        />
      </label>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Categoría
          <Picker aria-label="Categoría"
            className="nf-app-input"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
          >
            {riskCategoryOptions(form.category).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Picker>
        </label>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Responsable
          <input
            className="nf-app-input"
            value={form.owner}
            onChange={e => setForm({ ...form, owner: e.target.value })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
        </label>
      </div>
      <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
        Proceso asociado
        <Picker aria-label="Proceso asociado"
          className="nf-app-input"
          value={form.linkedProcessCode}
          onChange={e => setForm({ ...form, linkedProcessCode: e.target.value })}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Prob. (1–5)
          <input
            className="nf-app-input"
            type="number"
            min={1}
            max={5}
            value={form.probability}
            onChange={e => setForm({ ...form, probability: Number(e.target.value) })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Impacto (1–5)
          <input
            className="nf-app-input"
            type="number"
            min={1}
            max={5}
            value={form.impact}
            onChange={e => setForm({ ...form, impact: Number(e.target.value) })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Vencimiento
          <DateField
            className="nf-app-input"
            value={form.due}
            onChange={e => setForm({ ...form, due: e.target.value })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
        </label>
      </div>
      <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
        Control
        <textarea
          className="nf-app-input"
          value={form.control}
          onChange={e => setForm({ ...form, control: e.target.value })}
          rows={2}
          style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
        />
      </label>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Estado
          <Picker aria-label="Estado"
            className="nf-app-input"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as RiskRow["status"] })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
          >
            <option value="MONITORED">Monitoreado</option>
            <option value="UNDER_TREATMENT">En tratamiento</option>
            <option value="MITIGATED">Mitigado</option>
            <option value="ACCEPTED">Aceptado</option>
          </Picker>
        </label>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Tratamiento
          <Picker aria-label="Tratamiento"
            className="nf-app-input"
            value={form.treatment}
            onChange={e => setForm({ ...form, treatment: e.target.value as RiskRow["treatment"] })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
          >
            <option value="MITIGATE">Mitigar</option>
            <option value="ACCEPT">Aceptar</option>
          </Picker>
        </label>
      </div>
    </div>
  );
}
