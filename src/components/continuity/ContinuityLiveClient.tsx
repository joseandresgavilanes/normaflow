"use client";

import { useState } from "react";
import { Download, LifeBuoy, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { addImprovementAction, createBcp, createDrp, createTest, exportContinuity, recordTestResult, type ContinuityPayload } from "@/lib/actions/continuity";

const PLAN_STATUS: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobado", RETIRED: "Retirado" };
const TEST_TYPE: Record<string, string> = { TABLETOP: "Tabletop", WALKTHROUGH: "Walkthrough", SIMULATION: "Simulación", FAILOVER: "Failover", FULL: "Completa" };
const TEST_STATUS: Record<string, string> = { PLANNED: "Planificada", IN_PROGRESS: "En curso", COMPLETED: "Completada", CANCELLED: "Cancelada" };
const OUTCOME: Record<string, string> = { PASSED: "Superada", PARTIAL: "Parcial", FAILED: "Fallida" };

type Bcp = ContinuityPayload["bcps"][number];

export default function ContinuityLiveClient({ initial }: { initial: ContinuityPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [tab, setTab] = useState<"plans" | "tests">("plans");
  const [creatingBcp, setCreatingBcp] = useState(false); const [creatingDrp, setCreatingDrp] = useState(false);
  const [reportType, setReportType] = useState("continuity-plans"); const [exporting, setExporting] = useState(false);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const r = await exportContinuity({ reportType: reportType as never, format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  return <div>
    <SectionTitle title="Continuidad de negocio" sub="BCP y DRP con RTO/RPO, procesos críticos, escenarios, pruebas, resultados y acciones de mejora." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    <div className="nf-metric-strip">
      <Metric label="Planes BCP" value={initial.summary.bcps} icon={<LifeBuoy size={19} />} />
      <Metric label="Planes DRP" value={initial.summary.drps} icon={<LifeBuoy size={19} />} color="#15803D" />
      <Metric label="Pruebas" value={initial.summary.tests} icon={<LifeBuoy size={19} />} color="#5266F6" />
      <Metric label="Mejoras abiertas" value={initial.summary.openImprovements} icon={<LifeBuoy size={19} />} color="#B45309" />
    </div>
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}><button type="button" className={tab === "plans" ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => setTab("plans")}>Planes</button><button type="button" className={tab === "tests" ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => setTab("tests")}>Pruebas BCP/DR</button></div>
        <div style={{ flex: 1 }} />
        {initial.canCreate && tab === "plans" && <><button type="button" className="nf-app-btn-ghost" onClick={() => setCreatingBcp(true)}><Plus size={14} /> Nuevo BCP</button><button type="button" className="nf-app-btn-ghost" onClick={() => setCreatingDrp(true)}><Plus size={14} /> Nuevo DRP</button></>}
        {initial.canExport && <><select className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 160 }}><option value="continuity-plans">Planes</option><option value="bcp-dr-tests">Pruebas</option></select><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
      </div>

      {tab === "plans" && <div style={{ display: "grid", gap: 12 }}>
        {initial.bcps.map((b) => <PlanCard key={b.id} bcp={b} initial={initial} pending={isPending} onRun={run} />)}
        {!initial.bcps.length && <div className="nf-data-table-empty">Sin planes de continuidad. Crea el primer BCP.</div>}
        {initial.drps.length > 0 && <div><h4 style={{ marginTop: 8 }}>Planes de recuperación (DRP)</h4>{initial.drps.map((d) => <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13, display: "flex", justifyContent: "space-between" }}><span><strong>{d.code}</strong> · {d.title}{d.bcp ? ` · BCP ${d.bcp.code}` : ""}</span><span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>RTO {d.rtoMinutes ?? "—"}m · RPO {d.rpoMinutes ?? "—"}m · {PLAN_STATUS[d.status]}</span></div>)}</div>}
      </div>}

      {tab === "tests" && <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 940 }}><thead><tr><th>Plan</th><th>Prueba</th><th>Tipo</th><th>Estado</th><th>Fecha</th><th>Resultado</th><th>RTO/RPO logrado</th></tr></thead><tbody>{initial.bcps.flatMap((b) => b.tests.map((t) => { const r = t.results[0]; return <tr key={t.id}><td>{b.code}</td><td>{t.title}</td><td>{TEST_TYPE[t.type]}</td><td><Badge value={TEST_STATUS[t.status]} tone={t.status === "COMPLETED" ? "green" : "blue"} /></td><td>{t.executedDate ?? t.plannedDate ?? "—"}</td><td>{r ? <Badge value={OUTCOME[r.outcome]} tone={r.outcome === "PASSED" ? "green" : r.outcome === "FAILED" ? "red" : "amber"} /> : "—"}</td><td style={{ fontSize: 12 }}>{r ? `${r.rtoAchievedMinutes ?? "—"}m / ${r.rpoAchievedMinutes ?? "—"}m` : "—"}</td></tr>; }))}</tbody></table>{!initial.bcps.some((b) => b.tests.length) && <div className="nf-data-table-empty">Sin pruebas registradas.</div>}</div>}
    </Card>
    {creatingBcp && <PlanForm kind="BCP" initial={initial} pending={isPending} onClose={() => setCreatingBcp(false)} onRun={run} />}
    {creatingDrp && <PlanForm kind="DRP" initial={initial} pending={isPending} onClose={() => setCreatingDrp(false)} onRun={run} />}
  </div>;
}

function PlanCard({ bcp, initial, pending, onRun }: { bcp: Bcp; initial: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [testTitle, setTestTitle] = useState(""); const [testType, setTestType] = useState("TABLETOP");
  const [open, setOpen] = useState(false);
  return <div style={{ border: "1px solid var(--nf-line)", borderRadius: 10, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div><strong>{bcp.code} · {bcp.title}</strong> <Badge value={PLAN_STATUS[bcp.status]} tone={bcp.status === "APPROVED" ? "green" : "blue"} /><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>RTO {bcp.rtoMinutes ?? "—"}m · RPO {bcp.rpoMinutes ?? "—"}m · {bcp.criticalProcesses.length} procesos críticos · {bcp.tests.length} pruebas</div></div>
      <button type="button" className="nf-app-btn-ghost" onClick={() => setOpen((v) => !v)}>{open ? "Cerrar" : "Detalle"}</button>
    </div>
    {open && <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {bcp.scope && <div style={{ fontSize: 13 }}>{bcp.scope}</div>}
      {bcp.criticalProcesses.length > 0 && <div style={{ fontSize: 12 }}><strong>Procesos críticos:</strong> {bcp.criticalProcesses.map((p) => p.process.name).join(", ")}</div>}
      <div>
        <h4 style={{ margin: "6px 0" }}>Pruebas</h4>
        {bcp.tests.map((t) => <TestRow key={t.id} test={t} canUpdate={initial.canUpdate} pending={pending} onRun={onRun} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}><input className="nf-app-input" placeholder="Título de la prueba…" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} /><select className="nf-app-input" value={testType} onChange={(e) => setTestType(e.target.value)} style={{ maxWidth: 140 }}>{Object.entries(TEST_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={pending || !testTitle.trim()} onClick={() => onRun(() => createTest({ planId: bcp.id, title: testTitle, type: testType as never }), { onSuccess: () => setTestTitle(""), successMessage: "Prueba creada." })}>Añadir prueba</button></div>}
      </div>
    </div>}
  </div>;
}

function TestRow({ test, canUpdate, pending, onRun }: { test: Bcp["tests"][number]; canUpdate: boolean; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const r = test.results[0];
  return <div style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{test.title} · {TEST_TYPE[test.type]}</span><Badge value={TEST_STATUS[test.status]} tone={test.status === "COMPLETED" ? "green" : "blue"} /></div>
    {r && <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>Resultado: {OUTCOME[r.outcome]} · RTO {r.rtoAchievedMinutes ?? "—"}m / RPO {r.rpoAchievedMinutes ?? "—"}m · {r.improvementActions.length} mejoras</div>}
    {canUpdate && !r && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "PASSED", summary: "Prueba superada." }), { successMessage: "Resultado registrado." })}>Resultado: superada</button>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "PARTIAL", summary: "Prueba parcial." }), { successMessage: "Resultado registrado." })}>parcial</button>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "FAILED", summary: "Prueba fallida." }), { successMessage: "Resultado registrado." })}>fallida</button>
    </div>}
    {canUpdate && r && <button type="button" className="nf-app-btn-ghost" style={{ marginTop: 6 }} disabled={pending} onClick={() => onRun(() => addImprovementAction({ testResultId: r.id, description: "Acción de mejora derivada de la prueba." }), { successMessage: "Acción de mejora añadida." })}>+ Acción de mejora</button>}
  </div>;
}

function PlanForm({ kind, initial, pending, onClose, onRun }: { kind: "BCP" | "DRP"; initial: ContinuityPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({ code: "", title: "", scope: "", ownerId: "", rtoMinutes: "", rpoMinutes: "", bcpId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 600, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><h3>Nuevo {kind}</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}><label>Código<input className="nf-app-input" value={f.code} onChange={(e) => set("code", e.target.value)} /></label><label>Título<input className="nf-app-input" value={f.title} onChange={(e) => set("title", e.target.value)} /></label></div>
      {kind === "BCP" && <label>Alcance<textarea className="nf-app-input" rows={2} value={f.scope} onChange={(e) => set("scope", e.target.value)} /></label>}
      {kind === "DRP" && <label>BCP relacionado<select className="nf-app-input" value={f.bcpId} onChange={(e) => set("bcpId", e.target.value)}><option value="">Ninguno</option>{initial.bcps.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.title}</option>)}</select></label>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>RTO (min)<input className="nf-app-input" type="number" min={0} value={f.rtoMinutes} onChange={(e) => set("rtoMinutes", e.target.value)} /></label>
        <label>RPO (min)<input className="nf-app-input" type="number" min={0} value={f.rpoMinutes} onChange={(e) => set("rpoMinutes", e.target.value)} /></label>
        <label>Propietario<select className="nf-app-input" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Sin asignar</option>{initial.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      </div>
      <button type="button" className="nf-app-btn-primary" disabled={pending || !f.code.trim() || !f.title.trim()} onClick={() => {
        const base = { code: f.code, title: f.title, ownerId: f.ownerId || null, rtoMinutes: f.rtoMinutes ? Number(f.rtoMinutes) : null, rpoMinutes: f.rpoMinutes ? Number(f.rpoMinutes) : null };
        onRun(() => kind === "BCP" ? createBcp({ ...base, scope: f.scope || undefined }) : createDrp({ ...base, bcpId: f.bcpId || null }), { onSuccess: onClose, successMessage: `${kind} creado.` });
      }}>Crear {kind}</button>
    </div>
  </div></div>;
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 6 }}>{value}</span>; }
