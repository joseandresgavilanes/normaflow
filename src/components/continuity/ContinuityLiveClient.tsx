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
  const [tab, setTab] = useState<"plans" | "tests" | "bia" | "dependencies" | "strategies" | "crisis" | "gaps">("plans");
  const [creatingBcp, setCreatingBcp] = useState(false); const [creatingDrp, setCreatingDrp] = useState(false);
  const [reportType, setReportType] = useState("continuity-plans"); const [exporting, setExporting] = useState(false);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const r = await exportContinuity({ reportType: reportType as never, format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  return <div>
    <SectionTitle title="Continuidad de negocio" sub="BCP y DRP con RTO/RPO, procesos críticos, escenarios, pruebas, resultados y acciones de mejora." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    <div className="nf-metric-strip">
      <Metric label="Preparación" value={`${initial.bcmSummary.readiness}%`} icon={<LifeBuoy size={19} />} color={initial.bcmSummary.readiness >= 70 ? "#15803D" : "#B45309"} />
      <Metric label="Actividades críticas" value={initial.bcmSummary.criticalActivities} icon={<LifeBuoy size={19} />} color="#5266F6" />
      <Metric label="Brechas" value={initial.bcmSummary.totalGaps} icon={<LifeBuoy size={19} />} color={initial.bcmSummary.totalGaps ? "#B91C1C" : "#15803D"} />
      <Metric label="Planes activados" value={initial.bcmSummary.activePlans} icon={<LifeBuoy size={19} />} color={initial.bcmSummary.activePlans ? "#B91C1C" : undefined} />
      <Metric label="Pruebas" value={initial.summary.tests} icon={<LifeBuoy size={19} />} color="#5266F6" />
      <Metric label="Mejoras abiertas" value={initial.summary.openImprovements} icon={<LifeBuoy size={19} />} color="#B45309" />
    </div>
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["plans", "Planes"], ["bia", "BIA y actividades"], ["dependencies", "Dependencias y recursos"], ["strategies", "Estrategias"], ["crisis", "Equipos de crisis"], ["tests", "Simulacros"], ["gaps", "Brechas"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
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

      {tab === "bia" && <BiaTab p={initial} />}
      {tab === "dependencies" && <DependenciesTab p={initial} />}
      {tab === "strategies" && <StrategiesTab p={initial} />}
      {tab === "crisis" && <CrisisTab p={initial} />}
      {tab === "gaps" && <GapsTab p={initial} />}
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

/* ─── Paquete de continuidad del negocio (ISO 22301) ─── */

const CRITICALITY: Record<string, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  LOW: { label: "Baja", tone: "green" }, MEDIUM: { label: "Media", tone: "blue" },
  HIGH: { label: "Alta", tone: "amber" }, CRITICAL: { label: "Crítica", tone: "red" },
};
const DEP_TYPE: Record<string, string> = {
  PEOPLE: "Personas", FACILITY: "Instalaciones", TECHNOLOGY: "Tecnología", SUPPLIER: "Proveedores",
  DATA: "Datos", EQUIPMENT: "Equipos", UTILITY: "Suministros", PROCESS: "Procesos", OTHER: "Otros",
};
const STRATEGY_TYPE: Record<string, string> = {
  PREVENT: "Prevención", MITIGATE: "Mitigación", REDUNDANCY: "Redundancia", RELOCATION: "Reubicación",
  OUTSOURCING: "Externalización", MANUAL_WORKAROUND: "Alternativa manual", INSURANCE: "Seguro", ACCEPT: "Aceptación",
};
const STRATEGY_STATUS: Record<string, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  PROPOSED: { label: "Propuesta", tone: "blue" }, APPROVED: { label: "Aprobada", tone: "green" },
  IMPLEMENTED: { label: "Implementada", tone: "green" }, REJECTED: { label: "Rechazada", tone: "red" },
  RETIRED: { label: "Retirada", tone: "amber" },
};
const GAP_LABEL: Record<string, string> = {
  NO_RTO: "Sin RTO", NO_MTPD: "Sin MTPD", RTO_EXCEEDS_MTPD: "RTO supera MTPD",
  NO_STRATEGY: "Sin estrategia", NO_PROCEDURE: "Sin procedimiento",
  SPOF: "Punto único de fallo", STRATEGY_RTO_INSUFFICIENT: "Estrategia insuficiente",
  NEVER_TESTED: "Nunca ejercitada",
};
const mins = (v: number | null | undefined) => (typeof v === "number" ? `${v}m` : "—");

function BiaTab({ p }: { p: ContinuityPayload }) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Análisis de Impacto en el Negocio</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 820 }}>
        <thead><tr><th>Código</th><th>BIA</th><th>Versión</th><th>Estado</th><th>Actividades</th><th>Aprobado por</th><th>Próxima revisión</th></tr></thead>
        <tbody>{p.bias.map((b) => <tr key={b.id}>
          <td><strong>{b.code}</strong></td><td>{b.title}</td><td>{b.version}</td>
          <td><Badge value={b.status === "APPROVED" ? "Aprobado" : b.status === "UNDER_REVIEW" ? "En revisión" : b.status === "SUPERSEDED" ? "Sustituido" : "Borrador"} tone={b.status === "APPROVED" ? "green" : "blue"} /></td>
          <td>{b.activityCount}</td><td>{b.approvedBy?.name ?? "—"}</td><td>{b.nextReviewDate ?? "—"}</td>
        </tr>)}</tbody></table>
        {!p.bias.length && <div className="nf-data-table-empty">Sin BIA registrado. Crea el análisis de impacto para priorizar la recuperación.</div>}
      </div>
    </div>

    <div>
      <h4 style={{ margin: "0 0 8px" }}>Actividades críticas priorizadas</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 1000 }}>
        <thead><tr><th>#</th><th>Código</th><th>Actividad</th><th>Impacto</th><th>Criticidad</th><th>MTPD</th><th>RTO</th><th>RPO</th><th>Nivel mínimo</th><th>Brechas</th></tr></thead>
        <tbody>{p.activities.map((a) => <tr key={a.id}>
          <td>{a.priority}</td><td><strong>{a.code}</strong></td><td>{a.name}</td>
          <td>{a.impactScore}</td>
          <td><Badge value={CRITICALITY[a.criticality]?.label ?? a.criticality} tone={CRITICALITY[a.criticality]?.tone ?? "blue"} /></td>
          <td>{mins(a.mtpdMinutes)}</td><td>{mins(a.rtoMinutes)}</td><td>{mins(a.rpoMinutes)}</td>
          <td style={{ fontSize: 12 }}>{a.minimumServiceLevel ?? "—"}</td>
          <td>{a.gaps.length ? <Badge value={String(a.gaps.length)} tone="red" /> : <Badge value="0" tone="green" />}</td>
        </tr>)}</tbody></table>
        {!p.activities.length && <div className="nf-data-table-empty">Sin actividades críticas. Añádelas al BIA para calcular prioridades.</div>}
      </div>
    </div>

    {p.productPriorities.length > 0 && <div>
      <h4 style={{ margin: "0 0 8px" }}>Priorización de productos y servicios</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 820 }}>
        <thead><tr><th>#</th><th>Producto / servicio</th><th>Criticidad</th><th>MTPD</th><th>RTO</th><th>% ingresos</th><th>Clientes</th></tr></thead>
        <tbody>{p.productPriorities.map((x) => <tr key={x.id}>
          <td>{x.priority}</td><td><strong>{x.code}</strong> · {x.name}</td>
          <td><Badge value={CRITICALITY[x.criticality]?.label ?? x.criticality} tone={CRITICALITY[x.criticality]?.tone ?? "blue"} /></td>
          <td>{mins(x.mtpdMinutes)}</td><td>{mins(x.rtoMinutes)}</td>
          <td>{x.revenueShare != null ? `${x.revenueShare}%` : "—"}</td><td>{x.customersAffected ?? "—"}</td>
        </tr>)}</tbody></table></div>
    </div>}
  </div>;
}

function DependenciesTab({ p }: { p: ContinuityPayload }) {
  const rows = p.activities.flatMap((a) => a.dependencies.map((d) => ({ ...d, activity: a.name })));
  const resources = p.activities.flatMap((a) => a.resources.map((r) => ({ ...r, activity: a.name })));
  return <div style={{ display: "grid", gap: 16 }}>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Dependencias {p.bcmSummary.singlePointsOfFailure > 0 && <Badge value={`${p.bcmSummary.singlePointsOfFailure} punto(s) único(s) de fallo`} tone="red" />}</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 960 }}>
        <thead><tr><th>Actividad</th><th>Tipo</th><th>Dependencia</th><th>Criticidad</th><th>Indisp. máx.</th><th>Recurso alterno</th><th>SPOF</th></tr></thead>
        <tbody>{rows.map((d) => <tr key={d.id}>
          <td>{d.activity}</td><td>{DEP_TYPE[d.type] ?? d.type}</td><td><strong>{d.name}</strong></td>
          <td><Badge value={CRITICALITY[d.criticality]?.label ?? d.criticality} tone={CRITICALITY[d.criticality]?.tone ?? "blue"} /></td>
          <td>{mins(d.maxOutageMinutes)}</td>
          <td style={{ fontSize: 12 }}>{d.alternative ?? <span style={{ color: "#B91C1C" }}>sin alterno</span>}</td>
          <td>{d.singlePointOfFailure ? <Badge value="Sí" tone="red" /> : "—"}</td>
        </tr>)}</tbody></table>
        {!rows.length && <div className="nf-data-table-empty">Sin dependencias registradas.</div>}
      </div>
    </div>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Recursos mínimos</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 900 }}>
        <thead><tr><th>Actividad</th><th>Tipo</th><th>Recurso</th><th>Normal</th><th>Mínimo</th><th>Recurso alterno</th><th>Plazo</th></tr></thead>
        <tbody>{resources.map((r) => <tr key={r.id}>
          <td>{r.activity}</td><td>{DEP_TYPE[r.type] ?? r.type}</td><td><strong>{r.name}</strong></td>
          <td>{r.normalQuantity ?? "—"} {r.unit ?? ""}</td><td>{r.minimumQuantity ?? "—"} {r.unit ?? ""}</td>
          <td style={{ fontSize: 12 }}>{r.alternativeResource ?? "—"}</td><td>{mins(r.leadTimeMinutes)}</td>
        </tr>)}</tbody></table>
        {!resources.length && <div className="nf-data-table-empty">Sin recursos mínimos definidos.</div>}
      </div>
    </div>
  </div>;
}

function StrategiesTab({ p }: { p: ContinuityPayload }) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Estrategias de continuidad</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 960 }}>
        <thead><tr><th>Código</th><th>Estrategia</th><th>Tipo</th><th>Actividad</th><th>RTO que logra</th><th>Coste</th><th>Estado</th></tr></thead>
        <tbody>{p.strategies.map((s) => <tr key={s.id}>
          <td><strong>{s.code}</strong></td><td>{s.title}</td><td>{STRATEGY_TYPE[s.type] ?? s.type}</td>
          <td>{s.activity ? `${s.activity.code} · ${s.activity.name}` : "—"}</td>
          <td>{mins(s.achievesRtoMinutes)}</td><td>{s.cost != null ? s.cost.toLocaleString() : "—"}</td>
          <td><Badge value={STRATEGY_STATUS[s.status]?.label ?? s.status} tone={STRATEGY_STATUS[s.status]?.tone ?? "blue"} /></td>
        </tr>)}</tbody></table>
        {!p.strategies.length && <div className="nf-data-table-empty">Sin estrategias definidas.</div>}
      </div>
    </div>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Procedimientos de recuperación</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 860 }}>
        <thead><tr><th>#</th><th>Código</th><th>Procedimiento</th><th>Actividad</th><th>Responsable</th><th>Duración</th><th>Versión</th></tr></thead>
        <tbody>{p.recoveryProcedures.map((r) => <tr key={r.id}>
          <td>{r.order}</td><td><strong>{r.code}</strong></td><td>{r.title}</td>
          <td>{r.activity ? r.activity.name : "—"}</td><td>{r.responsible?.name ?? "—"}</td>
          <td>{mins(r.estimatedMinutes)}</td><td>{r.version}</td>
        </tr>)}</tbody></table>
        {!p.recoveryProcedures.length && <div className="nf-data-table-empty">Sin procedimientos de recuperación.</div>}
      </div>
    </div>
    <div>
      <h4 style={{ margin: "0 0 8px" }}>Versiones y activaciones del plan</h4>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 820 }}>
        <thead><tr><th>Plan</th><th>Versión</th><th>Cambios</th><th>Aprobada por</th><th>Fecha</th></tr></thead>
        <tbody>{p.planVersions.map((v) => <tr key={v.id}>
          <td>{p.planStatus.find((x) => x.id === v.planId)?.code ?? "—"}</td><td><strong>{v.version}</strong></td>
          <td style={{ fontSize: 12 }}>{v.changeSummary ?? "—"}</td><td>{v.approvedBy?.name ?? "—"}</td><td>{v.approvedAt ?? v.createdAt ?? "—"}</td>
        </tr>)}</tbody></table>
        {!p.planVersions.length && <div className="nf-data-table-empty">Sin versiones registradas.</div>}
      </div>
      {p.activations.length > 0 && <div style={{ marginTop: 10 }}>
        {p.activations.map((a) => <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>
          <Badge value={a.deactivatedAt ? "Cerrada" : "ACTIVA"} tone={a.deactivatedAt ? "green" : "red"} />{" "}
          <strong>{p.planStatus.find((x) => x.id === a.planId)?.code ?? ""}</strong> · {a.reason}
          <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>
            Activado {new Date(a.activatedAt).toLocaleString()} por {a.activatedBy?.name ?? "—"}
            {a.deactivatedAt && ` · cerrado ${new Date(a.deactivatedAt).toLocaleString()}`}
            {a.lessonsLearned && ` · Lecciones: ${a.lessonsLearned}`}
          </div>
        </div>)}
      </div>}
    </div>
  </div>;
}

function CrisisTab({ p }: { p: ContinuityPayload }) {
  if (!p.crisisTeams.length) return <div className="nf-data-table-empty">Sin equipos de crisis definidos.</div>;
  return <div style={{ display: "grid", gap: 14 }}>
    {p.crisisTeams.map((t) => <div key={t.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 10, padding: 14 }}>
      <div><strong>{t.code} · {t.name}</strong>
        <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>
          Líder: {t.leader?.name ?? "—"} · Suplente: {t.deputy?.name ?? "—"}
          {t.activationRule && ` · Se convoca: ${t.activationRule}`}
          {t.meetingPoint && ` · Punto de encuentro: ${t.meetingPoint}`}
        </div>
      </div>
      <div className="nf-data-table-wrap" style={{ marginTop: 10 }}><table className="nf-data-table" style={{ minWidth: 780 }}>
        <thead><tr><th>Orden</th><th>Contacto</th><th>Rol</th><th>Tipo</th><th>Teléfono</th><th>Alternativo</th><th>Email</th></tr></thead>
        <tbody>{t.contacts.map((c) => <tr key={c.id}>
          <td>{c.escalationOrder}</td><td><strong>{c.name}</strong>{c.isDeputy && " (suplente)"}</td>
          <td>{c.role ?? "—"}</td><td>{c.type}</td>
          <td>{c.primaryPhone ?? "—"}</td><td>{c.altPhone ?? "—"}</td><td>{c.email ?? "—"}</td>
        </tr>)}</tbody></table>
        {!t.contacts.length && <div className="nf-data-table-empty">Sin contactos.</div>}
      </div>
      {t.communicationTree.length > 0 && <div style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>Árbol de comunicación</strong>
        {t.communicationTree.filter((n) => !n.parentId).map((root) => <CommNode key={root.id} node={root} all={t.communicationTree} depth={0} />)}
      </div>}
    </div>)}
  </div>;
}

function CommNode({ node, all, depth }: { node: ContinuityPayload["crisisTeams"][number]["communicationTree"][number]; all: ContinuityPayload["crisisTeams"][number]["communicationTree"]; depth: number }) {
  const children = all.filter((n) => n.parentId === node.id);
  return <div style={{ paddingLeft: depth * 18, fontSize: 12.5, marginTop: 5 }}>
    <span style={{ color: "var(--nf-ink-3)" }}>{depth > 0 ? "└ " : ""}</span>
    <strong>{node.label}</strong>
    {node.audience && <span style={{ color: "var(--nf-ink-3)" }}> → {node.audience}</span>}
    {node.channel && <span style={{ color: "var(--nf-ink-3)" }}> · {node.channel}</span>}
    {node.maxDelayMinutes != null && <span style={{ color: "var(--nf-ink-3)" }}> · ≤{node.maxDelayMinutes}m</span>}
    {children.map((c) => <CommNode key={c.id} node={c} all={all} depth={depth + 1} />)}
  </div>;
}

function GapsTab({ p }: { p: ContinuityPayload }) {
  if (!p.gaps.length) return <div className="nf-data-table-empty">Sin brechas de continuidad detectadas. Preparación {p.bcmSummary.readiness}%.</div>;
  return <div>
    <div style={{ marginBottom: 10, fontSize: 13, color: "var(--nf-ink-2)" }}>
      Grado de preparación <strong>{p.bcmSummary.readiness}%</strong> · {p.gaps.length} brecha(s) detectada(s) sobre {p.bcmSummary.activities} actividad(es).
    </div>
    <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 780 }}>
      <thead><tr><th>Actividad</th><th>Brecha</th><th>Detalle</th></tr></thead>
      <tbody>{p.gaps.map((g, i) => <tr key={`${g.activityId}-${g.kind}-${i}`}>
        <td>{g.activityName}</td>
        <td><Badge value={GAP_LABEL[g.kind] ?? g.kind} tone={g.kind === "SPOF" || g.kind === "RTO_EXCEEDS_MTPD" ? "red" : "amber"} /></td>
        <td style={{ fontSize: 12 }}>{g.detail}</td>
      </tr>)}</tbody></table></div>
  </div>;
}
