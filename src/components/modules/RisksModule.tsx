"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type RiskRow } from "@/context/WorkspaceStore";
import type { Column } from "@/components/ui/Table";

function RiskScore({ score }: { score: number }) {
  const color = score >= 15 ? "#C93C37" : score >= 8 ? "#D68A1A" : "#2E8B57";
  const bg = score >= 15 ? "#fff0f0" : score >= 8 ? "#fff8e6" : "#e8f5ee";
  return <span style={{ background: bg, color, padding: "2px 9px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{score}</span>;
}

function riskTraceBlock(title: string, href: string, children: ReactNode) {
  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 14,
        border: "1px solid rgba(18, 60, 102, 0.12)",
        background: "#fbfcfe",
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
          background: "linear-gradient(180deg, #f0f4fa 0%, #e8eef6 100%)",
          borderBottom: "1px solid rgba(18, 60, 102, 0.1)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--nf-ink)" }}>{title}</span>
        <Link href={href} style={{ fontSize: 12, color: "#123C66", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", whiteSpace: "nowrap" }}>
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
};

const emptyForm = (owner: string): RiskForm => ({
  title: "",
  category: "Operacional",
  probability: 3,
  impact: 3,
  status: "MONITORED",
  owner,
  due: new Date().toISOString().slice(0, 10),
  control: "",
  treatment: "MITIGATE",
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
      processes: processes.filter(p => p.linkedRiskCodes?.includes(code)),
      actions: actions.filter(a => a.source === code),
    };
  }, [detail, changeRequests, suppliers, processes, actions]);

  const columns: Column<RiskRow>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "var(--nf-ink-3)", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    { key: "title", label: "Riesgo", render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: "category", label: "Categoría" },
    { key: "score", label: "Score", render: v => <RiskScore score={v} /> },
    { key: "probability", label: "Prob.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "#D68A1A" }}>{v}/5</span> },
    { key: "impact", label: "Imp.", render: v => <span style={{ fontSize: 13, fontWeight: 600, color: "#D68A1A" }}>{v}/5</span> },
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
    setForm(emptyForm(state.session.name));
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
      },
    });
    const updated = { ...detail, ...form, probability: p, impact: i, score: p * i };
    setDetail(updated);
    setEditOpen(false);
    showToast("Riesgo actualizado (sesión local)");
  }

  return (
    <div>
      <SectionTitle title="Gestión de Riesgos" sub="Registro, evaluación y tratamiento de riesgos" action="+ Nuevo Riesgo" onAction={openCreate} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 14 }}>Mapa de Calor 5×5</div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: 8, minWidth: 260 }}>
              <div style={{ width: 24, display: "flex", flexDirection: "column", justifyContent: "space-around", paddingBottom: 20 }}>
                {[5, 4, 3, 2, 1].map(p => (
                  <span key={p} style={{ fontSize: 11, color: "var(--nf-ink-3)", textAlign: "center" }}>
                    {p}
                  </span>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 6, paddingRight: 4 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} style={{ fontSize: 11, color: "var(--nf-ink-3)", width: 36, textAlign: "center" }}>
                      {i}
                    </span>
                  ))}
                </div>
                {[5, 4, 3, 2, 1].map(p => (
                  <div key={p} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => {
                      const score = p * i;
                      const cellRisks = risks.filter(rk => rk.probability === p && rk.impact === i);
                      const r = cellRisks[0];
                      const bg = score >= 15 ? "#fecaca" : score >= 8 ? "#fef3c7" : "#dcfce7";
                      const textColor = score >= 15 ? "#991b1b" : score >= 8 ? "#92400e" : "#166534";
                      return (
                        <div
                          key={i}
                          onClick={() => r && setDetail(r)}
                          title={cellRisks.map(x => x.title).join(" · ") || undefined}
                          style={{
                            width: 36,
                            height: 30,
                            background: bg,
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: r ? 700 : 400,
                            color: textColor,
                            cursor: r ? "pointer" : "default",
                            border: r ? "2px solid rgba(0,0,0,0.12)" : "none",
                            transition: "transform 0.1s",
                          }}
                        >
                          {r ? (cellRisks.length > 1 ? `${cellRisks.length}` : score) : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", textAlign: "center", marginTop: 6 }}>Impacto →</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14, justifyContent: "center" }}>
            {[
              { label: "Crítico (≥15)", color: "#fecaca", text: "#991b1b" },
              { label: "Alto (8-14)", color: "#fef3c7", text: "#92400e" },
              { label: "Moderado (<8)", color: "#dcfce7", text: "#166534" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: l.color, border: `1px solid ${l.text}40`, borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Riesgos Críticos (≥15)", count: risks.filter(r => r.score >= 15).length, color: "#C93C37", bg: "#fff0f0" },
            { label: "Riesgos Altos (8-14)", count: risks.filter(r => r.score >= 8 && r.score < 15).length, color: "#D68A1A", bg: "#fff8e6" },
            { label: "Riesgos Moderados (<8)", count: risks.filter(r => r.score < 8).length, color: "#2E8B57", bg: "#e8f5ee" },
            { label: "Total registrados", count: risks.length, color: "#123C66", bg: "#f0f4ff" },
          ].map(s => (
            <Card key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.count}</div>
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
                background: "linear-gradient(145deg, rgba(18, 60, 102, 0.06) 0%, #fff 55%)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-ink-3)", marginBottom: 10 }}>Evaluación inherente</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {[
                  ["Score", detail.score, detail.score >= 15 ? "#C93C37" : detail.score >= 8 ? "#D68A1A" : "#2E8B57"],
                  ["Probabilidad", `${detail.probability}/5`, "#D68A1A"],
                  ["Impacto", `${detail.impact}/5`, "#D68A1A"],
                ].map(([k, v, c]) => (
                  <div
                    key={String(k)}
                    style={{
                      textAlign: "center",
                      padding: "14px 10px",
                      background: "#fff",
                      borderRadius: 12,
                      border: "1px solid rgba(18, 60, 102, 0.1)",
                      boxShadow: "0 1px 0 rgba(18, 60, 102, 0.04)",
                    }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 800, color: String(c), letterSpacing: "-0.03em" }}>{v}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
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
                background: "#fafbfd",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-ink-3)", marginBottom: 12 }}>Ficha del riesgo</div>
              {[
                ["Categoría", detail.category],
                ["Tratamiento", detail.treatment],
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
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(18, 60, 102, 0.1)" : "none",
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
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--nf-ink-3)", marginBottom: 6 }}>Trazabilidad</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--nf-ink)", marginBottom: 14, letterSpacing: "-0.02em" }}>Vínculos operativos</div>

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
                    <span style={{ color: "var(--nf-ink-3)", fontStyle: "italic" }}>Sin proceso con mapa de riesgos para este código.</span>
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
                  background: "#123C66",
                  color: "#fff",
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
                  background: "#2E8B5718",
                  color: "#2E8B57",
                  border: "1px solid #2E8B5740",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RiskFormFields form={form} setForm={setForm} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Guardar
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar riesgo" width={600}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RiskFormFields form={form} setForm={setForm} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitEdit} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Guardar cambios
            </button>
            <button type="button" onClick={() => setEditOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RiskFormFields({ form, setForm }: { form: RiskForm; setForm: (f: RiskForm) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          <input
            className="nf-app-input"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
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
          <input
            className="nf-app-input"
            type="date"
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
          <select
            className="nf-app-input"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as RiskRow["status"] })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
          >
            <option value="MONITORED">Monitoreado</option>
            <option value="UNDER_TREATMENT">En tratamiento</option>
            <option value="MITIGATED">Mitigado</option>
            <option value="ACCEPTED">Aceptado</option>
          </select>
        </label>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
          Tratamiento
          <select
            className="nf-app-input"
            value={form.treatment}
            onChange={e => setForm({ ...form, treatment: e.target.value as RiskRow["treatment"] })}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
          >
            <option value="MITIGATE">Mitigar</option>
            <option value="ACCEPT">Aceptar</option>
          </select>
        </label>
      </div>
    </div>
  );
}
