"use client";

import { useState } from "react";
import { CheckCircle2, Download, FilePlus2, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import {
  acceptResidualRisk,
  approveResidualRisk,
  approveRiskTreatmentPlan,
  assessResidualRisk,
  closeRiskTreatmentItem,
  createRiskTreatmentItem,
  createRiskTreatmentPlan,
  exportRiskTreatment,
  updateRiskTreatmentItem,
  upsertMethodology,
  type RiskTreatmentPayload,
} from "@/lib/actions/risk-treatment";

const ITEM_STATUS_LABEL: Record<string, string> = { OPEN: "Abierto", IN_TREATMENT: "En tratamiento", RESIDUAL_PENDING: "Residual pendiente", ACCEPTED: "Aceptado", CLOSED: "Cerrado" };
const PLAN_STATUS_LABEL: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobado", SUPERSEDED: "Reemplazado" };
const TREATMENT_LABEL: Record<string, string> = { MITIGATE: "Mitigar", ACCEPT: "Aceptar", TRANSFER: "Transferir", AVOID: "Evitar" };
const REPORT_LABEL: Record<string, string> = { "risk-matrix": "Matriz de riesgos", "risk-treatment-plan": "Plan de tratamiento", "residual-risks": "Riesgos residuales" };

type Item = RiskTreatmentPayload["items"][number];

function riskTone(score: number): "green" | "amber" | "red" { return score >= 13 ? "red" : score >= 7 ? "amber" : "green"; }

export default function RiskTreatmentLiveClient({ initial }: { initial: RiskTreatmentPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [selected, setSelected] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [reportType, setReportType] = useState("risk-matrix");
  const [exporting, setExporting] = useState(false);

  const plan = initial.plan;
  const planEditable = plan?.editable ?? false;

  async function exportReport(format: "PDF" | "EXCEL") {
    setExporting(true);
    try {
      const result = await exportRiskTreatment({ reportType: reportType as never, format });
      await downloadQueuedReport(result.id);
    } finally { setExporting(false); }
  }

  return <div>
    <SectionTitle title="Tratamiento de riesgos" sub="Metodología, plan aprobable y registro de riesgos ISO 27001: activo, amenaza, vulnerabilidad, riesgo inherente y residual con aceptación formal." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}

    <MethodologyCard initial={initial} pending={isPending} onRun={run} />

    {!plan && <Card><div style={{ textAlign: "center", padding: 30 }}>
      <ShieldAlert size={34} style={{ color: "#5266F6" }} />
      <h3 style={{ margin: "12px 0 6px" }}>Sin plan de tratamiento de riesgos</h3>
      <p style={{ fontSize: 13, color: "var(--nf-ink-3)", maxWidth: 520, margin: "0 auto 16px" }}>Crea un plan para registrar los riesgos, su tratamiento y la aceptación del riesgo residual.</p>
      {initial.canUpdate && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => run(() => createRiskTreatmentPlan({ title: "Plan de tratamiento de riesgos" }), { successMessage: "Plan creado." })}><FilePlus2 size={15} /> Crear plan v1</button>}
    </div></Card>}

    {plan && <>
      <div className="nf-metric-strip">
        <Metric label="Riesgos" value={initial.summary.total} icon={<ShieldAlert size={19} />} />
        <Metric label="Inherente alto" value={initial.summary.highInherent} icon={<ShieldAlert size={19} />} color="#B91C1C" />
        <Metric label="Residual alto" value={initial.summary.highResidual} icon={<ShieldAlert size={19} />} color="#B45309" />
        <Metric label="Aceptados" value={initial.summary.accepted} icon={<CheckCircle2 size={19} />} color="#15803D" />
        <Metric label="Cerrados" value={initial.summary.closed} icon={<ShieldCheck size={19} />} color="#667085" />
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <strong style={{ fontSize: 15 }}>{plan.title} · v{plan.version}</strong>
            <Badge value={PLAN_STATUS_LABEL[plan.status]} tone={plan.status === "APPROVED" ? "green" : plan.status === "SUPERSEDED" ? "gray" : plan.status === "UNDER_REVIEW" ? "amber" : "blue"} />
            {plan.approvedAt && <span style={{ fontSize: 12, color: "var(--nf-ink-3)", marginLeft: 8 }}>Aprobado {plan.approvedAt.slice(0, 10)} · {plan.approver?.name ?? ""}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {initial.canUpdate && planEditable && <button type="button" className="nf-app-btn-ghost" disabled={isPending} onClick={() => setCreating(true)}><Plus size={14} /> Añadir riesgo</button>}
            {initial.canApprove && planEditable && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => run(() => approveRiskTreatmentPlan({ id: plan.id }), { successMessage: "Plan aprobado." })}><CheckCircle2 size={14} /> Aprobar plan</button>}
            {initial.canExport && <><select className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 180 }}>{Object.entries(REPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
          </div>
        </div>

        <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 980 }}><thead><tr><th>Ref.</th><th>Riesgo</th><th>Activo</th><th>Inherente</th><th>Tratamiento</th><th>Residual</th><th>Propietario</th><th>Estado</th></tr></thead><tbody>{initial.items.map((row) => <tr key={row.id} onClick={() => setSelected(row)} style={{ cursor: "pointer" }}><td><strong>{row.reference}</strong></td><td>{row.title}<div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{row.threat ?? ""}</div></td><td style={{ fontSize: 12 }}>{row.asset ?? "—"}</td><td><Badge value={String(row.inherentRisk)} tone={riskTone(row.inherentRisk)} /></td><td>{TREATMENT_LABEL[row.treatment]}</td><td>{row.residualRisk != null ? <Badge value={String(row.residualRisk)} tone={riskTone(row.residualRisk)} /> : "—"}</td><td>{row.owner?.name ?? "—"}</td><td><Badge value={ITEM_STATUS_LABEL[row.status]} tone={row.status === "CLOSED" ? "gray" : row.status === "ACCEPTED" ? "green" : "blue"} /></td></tr>)}</tbody></table>{!initial.items.length && <div className="nf-data-table-empty">Sin riesgos registrados todavía.</div>}</div>
      </Card>
    </>}

    {creating && plan && <ItemForm planId={plan.id} initial={initial} pending={isPending} onClose={() => setCreating(false)} onRun={run} />}
    {selected && <ItemDetail row={selected} initial={initial} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function MethodologyCard({ initial, pending, onRun }: { initial: RiskTreatmentPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const m = initial.methodology;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(m?.title ?? "Metodología de evaluación de riesgos");
  const [criteria, setCriteria] = useState(m?.acceptanceCriteria ?? "Se aceptan riesgos con nivel residual bajo (≤ 6).");
  const [threshold, setThreshold] = useState(m?.acceptanceThreshold ?? 6);

  return <Card style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div><strong>Metodología</strong> {m ? <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>· {m.title} (v{m.version}) · umbral de aceptación ≤ {m.acceptanceThreshold ?? "—"}</span> : <span style={{ fontSize: 12, color: "#B45309" }}>· sin definir</span>}</div>
      {initial.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => setOpen((v) => !v)}>{open ? "Cerrar" : m ? "Editar" : "Definir"}</button>}
    </div>
    {open && initial.canUpdate && <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <label>Título<input className="nf-app-input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Criterios de aceptación<textarea className="nf-app-input" rows={2} value={criteria} onChange={(e) => setCriteria(e.target.value)} /></label>
      <label style={{ maxWidth: 220 }}>Umbral de aceptación (1-25)<input className="nf-app-input" type="number" min={1} max={25} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label>
      <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => upsertMethodology({ title, acceptanceCriteria: criteria, acceptanceThreshold: threshold }), { onSuccess: () => setOpen(false), successMessage: "Metodología guardada." })}>Guardar metodología</button>
    </div>}
  </Card>;
}

function ItemForm({ planId, initial, pending, onClose, onRun }: { planId: string; initial: RiskTreatmentPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({ title: "", asset: "", threat: "", vulnerability: "", impact: 3, probability: 3, treatment: "MITIGATE", existingControls: "", proposedControls: "", ownerId: "", targetDate: "" });
  const set = (k: string, v: string | number) => setF((prev) => ({ ...prev, [k]: v }));
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 680, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><h3>Nuevo riesgo</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <label>Riesgo<input className="nf-app-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Descripción breve del riesgo" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>Activo<input className="nf-app-input" value={f.asset} onChange={(e) => set("asset", e.target.value)} /></label>
        <label>Amenaza<input className="nf-app-input" value={f.threat} onChange={(e) => set("threat", e.target.value)} /></label>
      </div>
      <label>Vulnerabilidad<input className="nf-app-input" value={f.vulnerability} onChange={(e) => set("vulnerability", e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>Impacto (1-5)<input className="nf-app-input" type="number" min={1} max={5} value={f.impact} onChange={(e) => set("impact", Number(e.target.value))} /></label>
        <label>Probabilidad (1-5)<input className="nf-app-input" type="number" min={1} max={5} value={f.probability} onChange={(e) => set("probability", Number(e.target.value))} /></label>
        <label>Tratamiento<select className="nf-app-input" value={f.treatment} onChange={(e) => set("treatment", e.target.value)}>{Object.entries(TREATMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <label>Controles existentes<textarea className="nf-app-input" rows={2} value={f.existingControls} onChange={(e) => set("existingControls", e.target.value)} /></label>
      <label>Controles propuestos<textarea className="nf-app-input" rows={2} value={f.proposedControls} onChange={(e) => set("proposedControls", e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>Propietario<select className="nf-app-input" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Sin asignar</option>{initial.members.map((mm) => <option key={mm.id} value={mm.id}>{mm.name}</option>)}</select></label>
        <label>Fecha objetivo<input className="nf-app-input" type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} /></label>
      </div>
      <button type="button" className="nf-app-btn-primary" disabled={pending || !f.title.trim()} onClick={() => onRun(() => createRiskTreatmentItem({ planId, title: f.title, asset: f.asset || undefined, threat: f.threat || undefined, vulnerability: f.vulnerability || undefined, impact: f.impact, probability: f.probability, treatment: f.treatment as never, existingControls: f.existingControls || undefined, proposedControls: f.proposedControls || undefined, ownerId: f.ownerId || null, targetDate: f.targetDate || null }), { onSuccess: onClose, successMessage: "Riesgo añadido." })}>Registrar riesgo</button>
    </div>
  </div></div>;
}

function ItemDetail({ row, initial, pending, onClose, onRun }: { row: Item; initial: RiskTreatmentPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [resImpact, setResImpact] = useState(row.residualImpact ?? row.impact);
  const [resProb, setResProb] = useState(row.residualProbability ?? row.probability);
  const [rationale, setRationale] = useState("");
  const [justification, setJustification] = useState("");
  const approvedResidual = row.residualAssessments.find((r) => r.approved);
  const canClose = !!approvedResidual && row.acceptances.length > 0 && row.status !== "CLOSED";

  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 720, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><div><h3>{row.reference} · {row.title}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>Inherente {row.inherentRisk} ({row.impact}×{row.probability}) · {TREATMENT_LABEL[row.treatment]} · {ITEM_STATUS_LABEL[row.status]}</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 16, padding: 20 }}>
      <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
        {row.asset && <div><strong>Activo:</strong> {row.asset}</div>}
        {row.threat && <div><strong>Amenaza:</strong> {row.threat}</div>}
        {row.vulnerability && <div><strong>Vulnerabilidad:</strong> {row.vulnerability}</div>}
        {row.existingControls && <div><strong>Controles existentes:</strong> {row.existingControls}</div>}
        {row.proposedControls && <div><strong>Controles propuestos:</strong> {row.proposedControls}</div>}
      </div>

      {initial.canUpdate && row.status !== "CLOSED" && <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Evaluar riesgo residual</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 11 }}>Impacto residual<input className="nf-app-input" type="number" min={1} max={5} value={resImpact} onChange={(e) => setResImpact(Number(e.target.value))} style={{ width: 90 }} /></label>
          <label style={{ fontSize: 11 }}>Prob. residual<input className="nf-app-input" type="number" min={1} max={5} value={resProb} onChange={(e) => setResProb(Number(e.target.value))} style={{ width: 90 }} /></label>
          <label style={{ fontSize: 11, flex: 1, minWidth: 160 }}>Justificación<input className="nf-app-input" value={rationale} onChange={(e) => setRationale(e.target.value)} /></label>
          <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => assessResidualRisk({ itemId: row.id, residualImpact: resImpact, residualProbability: resProb, rationale: rationale || undefined }), { successMessage: "Evaluación registrada." })}>Registrar residual</button>
        </div>
      </div>}

      <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Evaluaciones residuales</h4>
        {row.residualAssessments.length ? row.residualAssessments.map((r) => <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 12 }}><span>{r.assessedAt.slice(0, 10)} · residual {r.residualRisk} · {r.assessedBy.name} {r.approved ? "· ✓ aprobada" : ""}</span>{initial.canApprove && !r.approved && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => approveResidualRisk({ id: r.id }), { successMessage: "Residual aprobada." })}>Aprobar</button>}</div>) : <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Sin evaluaciones.</span>}
      </div>

      {initial.canApprove && approvedResidual && row.status !== "CLOSED" && <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Aceptación formal del riesgo residual</h4>
        <label style={{ fontSize: 12 }}>Justificación<textarea className="nf-app-input" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} /></label>
        <button type="button" className="nf-app-btn-primary" style={{ marginTop: 8 }} disabled={pending || !justification.trim()} onClick={() => onRun(() => acceptResidualRisk({ itemId: row.id, justification }), { successMessage: "Riesgo residual aceptado." })}><CheckCircle2 size={14} /> Aceptar riesgo residual</button>
      </div>}

      {row.acceptances.length > 0 && <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Aceptado por {row.acceptances[0].acceptedBy?.name} el {row.acceptances[0].acceptedAt.slice(0, 10)}.</div>}

      {initial.canUpdate && <button type="button" className="nf-app-btn-ghost" disabled={pending || !canClose} title={canClose ? "" : "Requiere evaluación residual aprobada y aceptación formal"} onClick={() => onRun(() => closeRiskTreatmentItem({ id: row.id }), { onSuccess: onClose, successMessage: "Riesgo cerrado." })}><ShieldCheck size={14} /> Cerrar riesgo</button>}
    </div>
  </div></div>;
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 8 }}>{value}</span>; }
