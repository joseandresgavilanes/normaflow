"use client";

import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, Ban, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Download, Eye, FileText, FlaskConical, GitBranch, History, Layers3, LifeBuoy, Lightbulb, Link2, Mail, Pencil, Phone, PlayCircle, Plus, Radio, Search, ShieldCheck, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import {
  addImprovementAction, createBcp, createDrp, createTest, exportContinuity, recordTestResult, type ContinuityPayload,
  createBia, updateBia, approveBia, createCriticalActivity, updateCriticalActivity, createProductPriority, updateProductPriority,
  addDependency, updateDependency, addResourceRequirement, updateResourceRequirement,
  createStrategy, updateStrategy, setStrategyStatus, createRecoveryProcedure, updateRecoveryProcedure,
  createCrisisTeam, updateCrisisTeam, addCrisisContact, updateCrisisContact, addCommunicationNode, updateCommunicationNode,
  updateBcp, updateDrp, addBcpProcess, removeBcpProcess, addScenario,
  createPlanVersion, approvePlan, activatePlan, deactivatePlan,
  setTestStatus, setImprovementStatus,
} from "@/lib/actions/continuity";
import { useModuleSection } from "@/hooks/useModuleSection";
import Modal from "@/components/ui/Modal";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import InfoTip from "@/components/ui/InfoTip";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { CONTINUITY_REPORT_TYPES } from "@/lib/validation/continuity";
import BarChart from "@/components/charts/BarChart";
import Meter from "@/components/charts/Meter";
import { distribution } from "@/components/charts/aggregate";
import { formatDateTime } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import DateField from "@/components/ui/DateField";

const PLAN_STATUS: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobado", RETIRED: "Retirado" };
const TEST_TYPE: Record<string, string> = { TABLETOP: "Tabletop", WALKTHROUGH: "Walkthrough", SIMULATION: "Simulación", FAILOVER: "Failover", FULL: "Completa" };
const TEST_STATUS: Record<string, string> = { PLANNED: "Planificada", IN_PROGRESS: "En curso", COMPLETED: "Completada", CANCELLED: "Cancelada" };
const OUTCOME: Record<string, string> = { PASSED: "Superada", PARTIAL: "Parcial", FAILED: "Fallida" };

const MAX_MINUTES = 1_000_000;

function requiredText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  if (normalized.length > max) throw new Error(`${label} no puede superar ${max} caracteres.`);
  return normalized;
}

function optionalText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} no puede superar ${max} caracteres.`);
  return normalized || undefined;
}

function optionalNumber(value: string, label: string, max = MAX_MINUTES) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new Error(`${label} debe ser un entero entre 0 y ${max}.`);
  return parsed;
}

function optionalDecimal(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) throw new Error(`${label} debe estar entre 0 y ${max}.`);
  return parsed;
}

function optionalEmail(value: string, label: string) {
  const normalized = optionalText(value, label, 254);
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error(`${label} no es válido.`);
  return normalized;
}

function assertRecoveryWindow(rto: number | null, rpo: number | null) {
  if (rto !== null && rpo !== null && rpo > rto) throw new Error("El RPO no puede superar el RTO.");
}

function optionalDate(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(new Date(`${normalized}T12:00:00.000Z`).getTime())) {
    throw new Error(`${label} no es válida.`);
  }
  return normalized;
}

function assertDateOrder(start: string, end: string) {
  const startValue = optionalDate(start, "La fecha realizada");
  const endValue = optionalDate(end, "La fecha de revisión");
  if (startValue && endValue && startValue > endValue) throw new Error("La fecha de revisión debe ser posterior o igual a la fecha realizada.");
}

function assertOptions(value: string, options: readonly string[], label: string) {
  if (value && !options.includes(value)) throw new Error(`${label} no es válido.`);
  return value;
}

function matchesFilter(query: string, ...values: unknown[]) {
  const normalized = query.trim().toLocaleLowerCase();
  return !normalized || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized));
}

function ContinuityFilterBar({ query, onQueryChange, placeholder, children }: { query: string; onQueryChange: (value: string) => void; placeholder: string; children?: React.ReactNode }) {
  return <div className="nf-continuity-filter-bar">
    <label className="nf-continuity-filter-search">
      <Search size={15} aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input className="nf-app-input" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} />
      {query && <button type="button" className="nf-continuity-filter-clear" onClick={() => onQueryChange("")} aria-label="Limpiar filtro"><X size={14} aria-hidden /></button>}
    </label>
    {children}
  </div>;
}

const REPORT_OPTIONS_BY_TAB: Record<string, { value: string; label: string }[]> = {
  plans: [{ value: "bcm-plans", label: "Planes de continuidad" }, { value: "bcm-plan-versions", label: "Versiones de planes" }, { value: "continuity-plans", label: "Planes (legado)" }],
  bia: [{ value: "bcm-bia", label: "BIA" }, { value: "bcm-critical-processes", label: "Procesos críticos" }, { value: "bcm-priority-products", label: "Productos prioritarios" }, { value: "bcm-rto-rpo", label: "MTPD/RTO/RPO" }],
  dependencies: [{ value: "bcm-dependencies", label: "Dependencias y recursos" }],
  strategies: [{ value: "bcm-strategies", label: "Estrategias" }],
  crisis: [{ value: "bcm-crisis-teams", label: "Equipos de crisis" }],
  tests: [{ value: "bcm-exercises", label: "Simulacros" }, { value: "bcp-dr-tests", label: "Pruebas (legado)" }],
  gaps: [{ value: "bcm-gaps", label: "Brechas" }],
  panel: [{ value: "bcm-audit-package", label: "Auditoría completa" }],
};
const SECTION_META: Record<string, { title: string; sub: string }> = {
  panel: { title: "Continuidad de negocio", sub: "BCP y DRP con RTO/RPO, procesos críticos, escenarios, pruebas, resultados y acciones de mejora." },
  plans: { title: "Planes de continuidad", sub: "BCP y DRP con alcance, objetivos de recuperación, procesos críticos y activaciones." },
  bia: { title: "BIA y actividades", sub: "Análisis de impacto, actividades críticas, MTPD, RTO y RPO." },
  dependencies: { title: "Dependencias y recursos", sub: "Dependencias, recursos necesarios y puntos únicos de fallo." },
  strategies: { title: "Estrategias", sub: "Estrategias de continuidad, mitigación y recuperación por actividad crítica." },
  crisis: { title: "Equipos de crisis", sub: "Equipos, contactos y canales para coordinar la respuesta ante una interrupción." },
  tests: { title: "Simulacros", sub: "Pruebas de continuidad, resultados, objetivos RTO/RPO y acciones de mejora." },
  gaps: { title: "Brechas", sub: "Brechas de preparación, criticidad, responsables y seguimiento de cierre." },
};

type Bcp = ContinuityPayload["bcps"][number];

export default function ContinuityLiveClient({ initial }: { initial: ContinuityPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [tab, setTab] = useModuleSection<"panel" | "plans" | "tests" | "bia" | "dependencies" | "strategies" | "crisis" | "gaps">("panel");
  const [creatingBcp, setCreatingBcp] = useState(false); const [creatingDrp, setCreatingDrp] = useState(false);
  const [bcpCreateRequested, clearBcpCreate] = useCreateRequest("Nuevo BCP");
  const [drpCreateRequested, clearDrpCreate] = useCreateRequest("Nuevo DRP");
  const [reportTypeByTab, setReportTypeByTab] = useState<Record<string, string>>({ panel: "bcm-audit-package", plans: "bcm-plans", bia: "bcm-bia", dependencies: "bcm-dependencies", strategies: "bcm-strategies", crisis: "bcm-crisis-teams", tests: "bcm-exercises", gaps: "bcm-gaps" });
  const [exporting, setExporting] = useState(false);
  const [planQuery, setPlanQuery] = useState(""); const [planStatus, setPlanStatus] = useState("ALL"); const [planKind, setPlanKind] = useState("ALL");
  const [testQuery, setTestQuery] = useState(""); const [testStatus, setTestStatusFilter] = useState("ALL"); const [testTypeFilter, setTestTypeFilter] = useState("ALL");

  useEffect(() => { if (bcpCreateRequested) { setCreatingBcp(true); clearBcpCreate(); } }, [bcpCreateRequested, clearBcpCreate]);
  useEffect(() => { if (drpCreateRequested) { setCreatingDrp(true); clearDrpCreate(); } }, [drpCreateRequested, clearDrpCreate]);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const reportType = reportTypeByTab[tab] ?? REPORT_OPTIONS_BY_TAB[tab][0]?.value; const r = await exportContinuity({ reportType: assertOptions(reportType, CONTINUITY_REPORT_TYPES, "El tipo de informe") as never, format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  const visibleBcps = initial.bcps.filter((b) => (planStatus === "ALL" || b.status === planStatus) && (planKind === "ALL" || planKind === "BCP") && matchesFilter(planQuery, b.code, b.title, b.scope));
  const visibleDrps = initial.drps.filter((d) => (planStatus === "ALL" || d.status === planStatus) && (planKind === "ALL" || planKind === "DRP") && matchesFilter(planQuery, d.code, d.title));
  const allTests = initial.bcps.flatMap((b) => b.tests.map((test) => ({ plan: b, test })));
  const visibleTests = allTests.filter(({ plan, test }) => (testStatus === "ALL" || test.status === testStatus) && (testTypeFilter === "ALL" || test.type === testTypeFilter) && matchesFilter(testQuery, plan.code, plan.title, test.title, TEST_TYPE[test.type], TEST_STATUS[test.status]));
  const reportOptions = REPORT_OPTIONS_BY_TAB[tab] ?? REPORT_OPTIONS_BY_TAB.panel;

  return <div className="nf-iso-module">
    <SectionTitle title={SECTION_META[tab]?.title ?? SECTION_META.panel.title} sub={SECTION_META[tab]?.sub ?? SECTION_META.panel.sub} />
    {error && <div className="nf-alert nf-alert--error nf-alert--dismissible" role="alert"><span>{error}</span><button type="button" className="nf-alert-close" onClick={() => setError("")} aria-label="Cerrar mensaje de error"><X size={15} aria-hidden /></button></div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    {tab === "panel" && <div className="nf-metric-strip">
      <Metric label="Preparación" value={`${initial.bcmSummary.readiness}%`} icon={<LifeBuoy size={19} />} color={initial.bcmSummary.readiness >= 70 ? "var(--nf-success-text)" : "var(--nf-warning-text)"} />
      <Metric label="Actividades críticas" value={initial.bcmSummary.criticalActivities} icon={<ClipboardCheck size={19} />} color="var(--nf-primary-active)" />
      <Metric label="Brechas" value={initial.bcmSummary.totalGaps} icon={<AlertTriangle size={19} />} color={initial.bcmSummary.totalGaps ? "var(--nf-danger-text)" : "var(--nf-success-text)"} />
      <Metric label="Planes activados" value={initial.bcmSummary.activePlans} icon={<FileText size={19} />} color={initial.bcmSummary.activePlans ? "var(--nf-danger-text)" : undefined} />
      <Metric label="Pruebas" value={initial.summary.tests} icon={<ClipboardCheck size={19} />} color="var(--nf-primary-active)" />
      <Metric label="Mejoras abiertas" value={initial.summary.openImprovements} icon={<Lightbulb size={19} />} color="var(--nf-warning-text)" />
    </div>}
    {tab === "panel" && <div className="nf-chart-grid-2">
      <BarChart
        title="Planes de continuidad por estado"
        subtitle="En qué punto de su ciclo está cada BCP registrado."
        data={distribution(initial.bcps, (row) => row.status)}
        action={{ label: "Abrir planes", href: "/app/continuity?section=plans" }}
      />
      <Meter
        title="Actividades críticas"
        subtitle="Cuántas actividades del BIA están clasificadas como críticas."
        label="críticas"
        restLabel="Resto de actividades"
        value={initial.bcmSummary.criticalActivities}
        total={initial.activities.length}
        tone="alert"
        empty="Aún no hay actividades analizadas en el BIA."
        action={{ label: "Abrir BIA y actividades", href: "/app/continuity?section=bia" }}
      />
    </div>}
    {tab !== "panel" && <IsoSectionMetrics items={tab === "plans" ? [
      { label: "BCP registrados", value: initial.bcps.length }, { label: "DRP registrados", value: initial.drps.length }, { label: "Planes activados", value: initial.bcmSummary.activePlans, accent: initial.bcmSummary.activePlans ? "var(--nf-danger-text)" : undefined },
    ] : tab === "bia" ? [
      { label: "BIA registrados", value: initial.bias.length }, { label: "Actividades críticas", value: initial.bcmSummary.criticalActivities }, { label: "Brechas", value: initial.bcmSummary.totalGaps, accent: initial.bcmSummary.totalGaps ? "var(--nf-danger-text)" : undefined },
    ] : tab === "dependencies" ? [
      { label: "Dependencias", value: initial.bcmSummary.dependencies }, { label: "Puntos únicos de fallo", value: initial.bcmSummary.singlePointsOfFailure, accent: initial.bcmSummary.singlePointsOfFailure ? "var(--nf-danger-text)" : undefined }, { label: "Actividades críticas", value: initial.bcmSummary.criticalActivities },
    ] : tab === "strategies" ? [
      { label: "Estrategias", value: initial.strategies.length }, { label: "Aprobadas / implementadas", value: initial.bcmSummary.approvedStrategies, accent: "var(--nf-success-text)" }, { label: "Procedimientos", value: initial.recoveryProcedures.length },
    ] : tab === "crisis" ? [
      { label: "Equipos de crisis", value: initial.crisisTeams.length }, { label: "Contactos", value: initial.bcmSummary.crisisContacts }, { label: "Canales de comunicación", value: initial.crisisTeams.reduce((n, team) => n + team.communicationTree.length, 0) },
    ] : tab === "tests" ? [
      { label: "Simulacros", value: initial.summary.tests }, { label: "Completados", value: initial.bcps.flatMap((plan) => plan.tests).filter((test) => test.status === "COMPLETED").length, accent: "var(--nf-success-text)" }, { label: "Mejoras abiertas", value: initial.summary.openImprovements, accent: initial.summary.openImprovements ? "var(--nf-warning-text)" : undefined },
    ] : [
      { label: "Brechas detectadas", value: initial.gaps.length, accent: initial.gaps.length ? "var(--nf-danger-text)" : "var(--nf-success-text)" }, { label: "Preparación", value: `${initial.bcmSummary.readiness}%` }, { label: "Actividades evaluadas", value: initial.bcmSummary.activities },
    ]} />}
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1 }} />
        {tab === "panel" && <IsoQuickCreate modulePath="/app/continuity" items={[{ label: "Nuevo BCP", description: "Crear plan de continuidad", section: "plans", Icon: FileText }, { label: "Nuevo DRP", description: "Crear plan de recuperación", section: "plans", Icon: LifeBuoy }]} />}
        {initial.canCreate && tab === "plans" && <><button type="button" className="nf-app-btn-primary" onClick={() => setCreatingBcp(true)}><Plus size={14} /> Nuevo BCP</button><button type="button" className="nf-app-btn-primary" onClick={() => setCreatingDrp(true)}><Plus size={14} /> Nuevo DRP</button></>}
        {initial.canExport && <><Picker className="nf-app-input" aria-label="Informe de esta sección" value={reportTypeByTab[tab] ?? reportOptions[0]?.value} onChange={(e) => setReportTypeByTab((current) => ({ ...current, [tab]: e.target.value }))} style={{ maxWidth: 220 }}>{reportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Picker><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
      </div>

      {tab === "panel" && <div className="nf-iso-dashboard-grid" style={{ display: "grid", gap: 16 }}>
        <div className="nf-iso-dashboard-card" style={{ gridColumn: "span 1" }}>
          <div className="nf-iso-dashboard-card-head"><div className="nf-heading-row"><h3 className="nf-iso-dashboard-card-title"><LifeBuoy size={16} aria-hidden />Preparación de continuidad</h3><InfoTip label="Preparación de continuidad" text="Lectura ejecutiva de la capacidad de respuesta y recuperación." /></div><Badge value={`${initial.bcmSummary.readiness}%`} tone={initial.bcmSummary.readiness >= 70 ? "green" : "amber"} /></div>
          <div className="nf-iso-dashboard-card-body">
            <div style={{ height: 10, overflow: "hidden", borderRadius: 99, background: "var(--nf-surface-sunken)" }}><div style={{ width: `${Math.min(100, Math.max(0, initial.bcmSummary.readiness))}%`, height: "100%", borderRadius: 99, background: initial.bcmSummary.readiness >= 70 ? "var(--nf-success-text)" : "var(--nf-warning-text)" }} /></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Actividades críticas</span><strong className="nf-iso-dashboard-row-value">{initial.bcmSummary.criticalActivities}</strong></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Puntos únicos de fallo</span><strong className="nf-iso-dashboard-row-value" style={{ color: initial.bcmSummary.singlePointsOfFailure ? "var(--nf-danger-text)" : undefined }}>{initial.bcmSummary.singlePointsOfFailure}</strong></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Brechas abiertas</span><strong className="nf-iso-dashboard-row-value" style={{ color: initial.bcmSummary.totalGaps ? "var(--nf-danger-text)" : undefined }}>{initial.bcmSummary.totalGaps}</strong></div>
          </div>
        </div>
        <div className="nf-iso-dashboard-card">
          <div className="nf-iso-dashboard-card-head"><div className="nf-heading-row"><h3 className="nf-iso-dashboard-card-title"><ClipboardCheck size={16} aria-hidden />Seguimiento de pruebas</h3><InfoTip label="Seguimiento de pruebas" text="Señales para priorizar la próxima revisión." /></div></div>
          <div className="nf-iso-dashboard-card-body">
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Pruebas registradas</span><strong className="nf-iso-dashboard-row-value">{initial.summary.tests}</strong></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Mejoras abiertas</span><strong className="nf-iso-dashboard-row-value" style={{ color: initial.summary.openImprovements ? "var(--nf-warning-text)" : undefined }}>{initial.summary.openImprovements}</strong></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Planes activados</span><strong className="nf-iso-dashboard-row-value" style={{ color: initial.bcmSummary.activePlans ? "var(--nf-danger-text)" : undefined }}>{initial.bcmSummary.activePlans}</strong></div>
            <div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">Actividades evaluadas</span><strong className="nf-iso-dashboard-row-value">{initial.bcmSummary.activities}</strong></div>
          </div>
        </div>
        <div className="nf-iso-dashboard-card nf-iso-dashboard-card--wide">
          <div className="nf-iso-dashboard-card-head"><div className="nf-heading-row"><h3 className="nf-iso-dashboard-card-title"><FileText size={16} aria-hidden />Planes de continuidad</h3><InfoTip label="Planes de continuidad" text="Estado, objetivos de recuperación y cobertura de procesos críticos." /></div></div>
          <div className="nf-iso-dashboard-card-body"><IsoTableCard searchable={false} headers={["Código", "Plan", "Estado", "Versión", "RTO / RPO", "Procesos", "Pruebas"]}>{initial.bcps.map((b) => <tr key={b.id}><td><strong>{b.code}</strong></td><td>{b.title}</td><td><Badge value={PLAN_STATUS[b.status] ?? b.status} tone={b.status === "APPROVED" ? "green" : "blue"} /></td><td>{b.version ?? "1.0"}</td><td>{b.rtoMinutes ?? "—"}m / {b.rpoMinutes ?? "—"}m</td><td>{b.criticalProcesses.length}</td><td>{b.tests.length}</td></tr>)}</IsoTableCard></div>
        </div>
      </div>}

      {tab === "plans" && <div style={{ display: "grid", gap: 12 }}>
        <ContinuityFilterBar query={planQuery} onQueryChange={setPlanQuery} placeholder="Buscar por código, título o alcance…"><Picker className="nf-app-input" aria-label="Estado del plan" value={planStatus} onChange={(e) => setPlanStatus(e.target.value)}><option value="ALL">Todos los estados</option>{Object.entries(PLAN_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Picker><Picker className="nf-app-input" aria-label="Tipo de plan" value={planKind} onChange={(e) => setPlanKind(e.target.value)}><option value="ALL">BCP y DRP</option><option value="BCP">Solo BCP</option><option value="DRP">Solo DRP</option></Picker></ContinuityFilterBar>
        {visibleBcps.map((b) => <PlanCard key={b.id} bcp={b} initial={initial} pending={isPending} onRun={run} />)}
        {!visibleBcps.length && !visibleDrps.length && <div className="nf-data-table-empty">{initial.bcps.length || initial.drps.length ? "No hay planes que coincidan con los filtros." : "Sin planes de continuidad. Crea el primer BCP."}</div>}
        {visibleDrps.length > 0 && <div><h4 style={{ marginTop: 8 }}>Planes de recuperación (DRP)</h4>{visibleDrps.map((d) => <DrpRow key={d.id} drp={d} initial={initial} pending={isPending} onRun={run} />)}</div>}
      </div>}

      {tab === "tests" && <div style={{ display: "grid", gap: 12 }}><ContinuityFilterBar query={testQuery} onQueryChange={setTestQuery} placeholder="Buscar plan o prueba…"><Picker className="nf-app-input" aria-label="Estado de la prueba" value={testStatus} onChange={(e) => setTestStatusFilter(e.target.value)}><option value="ALL">Todos los estados</option>{Object.entries(TEST_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Picker><Picker className="nf-app-input" aria-label="Tipo de prueba" value={testTypeFilter} onChange={(e) => setTestTypeFilter(e.target.value)}><option value="ALL">Todos los tipos</option>{Object.entries(TEST_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Picker></ContinuityFilterBar><IsoTableCard searchable={false} title="Simulacros de continuidad" description="Pruebas, resultados y objetivos RTO/RPO logrados." headers={["Plan", "Prueba", "Tipo", "Estado", "Fecha", "Resultado", "RTO/RPO logrado"]}>{visibleTests.map(({ plan, test }) => { const r = test.results[0]; return <tr key={test.id}><td>{plan.code}</td><td>{test.title}</td><td>{TEST_TYPE[test.type]}</td><td><Badge value={TEST_STATUS[test.status]} tone={test.status === "COMPLETED" ? "green" : "blue"} /></td><td>{test.executedDate ?? test.plannedDate ?? "—"}</td><td>{r ? <Badge value={OUTCOME[r.outcome]} tone={r.outcome === "PASSED" ? "green" : r.outcome === "FAILED" ? "red" : "amber"} /> : "—"}</td><td style={{ fontSize: 12 }}>{r ? `${r.rtoAchievedMinutes ?? "—"}m / ${r.rpoAchievedMinutes ?? "—"}m` : "—"}</td></tr>; })}{!visibleTests.length && <tr><td colSpan={7}>{allTests.length ? "No hay pruebas que coincidan con los filtros." : "Sin pruebas registradas."}</td></tr>}</IsoTableCard></div>}

      {tab === "bia" && <BiaTab p={initial} pending={isPending} onRun={run} />}
      {tab === "dependencies" && <DependenciesTab p={initial} pending={isPending} onRun={run} />}
      {tab === "strategies" && <StrategiesTab p={initial} pending={isPending} onRun={run} />}
      {tab === "crisis" && <CrisisTab p={initial} pending={isPending} onRun={run} />}
      {tab === "gaps" && <GapsTab p={initial} />}
    </Card>
    {creatingBcp && <PlanForm kind="BCP" initial={initial} pending={isPending} onClose={() => setCreatingBcp(false)} onRun={run} />}
    {creatingDrp && <PlanForm kind="DRP" initial={initial} pending={isPending} onClose={() => setCreatingDrp(false)} onRun={run} />}
  </div>;
}

function DrpRow({ drp: d, initial, pending, onRun }: { drp: ContinuityPayload["drps"][number]; initial: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: d.title, rtoMinutes: d.rtoMinutes != null ? String(d.rtoMinutes) : "", rpoMinutes: d.rpoMinutes != null ? String(d.rpoMinutes) : "" });
  return <div style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <span><strong>{d.code}</strong> · {d.title}{d.bcp ? ` · BCP ${d.bcp.code}` : ""}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>RTO {d.rtoMinutes ?? "—"}m · RPO {d.rpoMinutes ?? "—"}m · {PLAN_STATUS[d.status]}</span>
        {initial.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => setEditing((v) => !v)}>Editar</button>}
      </span>
    </div>
    <Modal open={editing} onClose={() => setEditing(false)} title={`Editar ${d.code}`} width={560}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Título<input className="nf-app-input" value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>RTO (min)<input className="nf-app-input" type="number" min={0} value={f.rtoMinutes} onChange={(e) => setF((p) => ({ ...p, rtoMinutes: e.target.value }))} /></label>
          <label>RPO (min)<input className="nf-app-input" type="number" min={0} value={f.rpoMinutes} onChange={(e) => setF((p) => ({ ...p, rpoMinutes: e.target.value }))} /></label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="nf-app-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => {
            const title = requiredText(f.title, "El título", 200);
            const rtoMinutes = optionalNumber(f.rtoMinutes, "El RTO");
            const rpoMinutes = optionalNumber(f.rpoMinutes, "El RPO");
            assertRecoveryWindow(rtoMinutes, rpoMinutes);
            return updateDrp({ id: d.id, code: requiredText(d.code, "El código", 60), title, status: d.status, bcpId: d.bcp?.id ?? null, rtoMinutes, rpoMinutes });
          }, { onSuccess: () => setEditing(false), successMessage: "DRP actualizado." })}>Guardar</button>
        </div>
      </div>
    </Modal>
  </div>;
}

function PlanCard({ bcp, initial, pending, onRun }: { bcp: Bcp; initial: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [testTitle, setTestTitle] = useState("");
  const [testType, setTestType] = useState("TABLETOP");
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editForm, setEditForm] = useState({ title: bcp.title, scope: bcp.scope ?? "", rtoMinutes: bcp.rtoMinutes != null ? String(bcp.rtoMinutes) : "", rpoMinutes: bcp.rpoMinutes != null ? String(bcp.rpoMinutes) : "" });
  const [processId, setProcessId] = useState("");
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [newVersion, setNewVersion] = useState({ version: "", changeSummary: "", content: "", evidenceId: "" });
  const [showScenario, setShowScenario] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [activationReason, setActivationReason] = useState("");
  const [activationScenarioId, setActivationScenarioId] = useState("");
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivation, setDeactivation] = useState({ outcome: "", lessonsLearned: "", evidenceId: "" });
  const activeActivation = initial.activations.find((a) => a.planId === bcp.id && !a.deactivatedAt);
  const canUpdate = initial.canUpdate;
  const canApprove = initial.canApprove;

  return <div className="nf-continuity-plan-card">
    <div className="nf-continuity-plan-card-head">
      <div>
        <div className="nf-continuity-plan-card-title"><FileText size={15} aria-hidden /><strong>{bcp.code} · {bcp.title}</strong><Badge value={PLAN_STATUS[bcp.status]} tone={bcp.status === "APPROVED" ? "green" : "blue"} />{activeActivation && <Badge value="ACTIVADO" tone="red" />}</div>
        <div className="nf-continuity-plan-card-meta">v{bcp.version ?? "1.0"} · RTO {bcp.rtoMinutes ?? "—"}m · RPO {bcp.rpoMinutes ?? "—"}m · {bcp.criticalProcesses.length} procesos críticos · {bcp.tests.length} pruebas</div>
      </div>
      <div className="nf-continuity-plan-card-actions">
        {canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => setEditingPlan((v) => !v)}><Pencil size={13} aria-hidden />Editar</button>}
        <button type="button" className="nf-app-btn-primary" onClick={() => setOpen(true)}><Eye size={13} aria-hidden />Ver detalle</button>
      </div>
    </div>

    <Modal open={editingPlan} onClose={() => setEditingPlan(false)} title={`Editar plan · ${bcp.code}`} width={680}>
      <div className="nf-continuity-detail-form-stack">
        <label>Título<input className="nf-app-input" maxLength={200} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></label>
        <label>Alcance<textarea className="nf-app-input" rows={3} maxLength={8000} value={editForm.scope} onChange={(e) => setEditForm((f) => ({ ...f, scope: e.target.value }))} /></label>
        <div className="nf-form-grid-2">
          <label>RTO (min)<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} value={editForm.rtoMinutes} onChange={(e) => setEditForm((f) => ({ ...f, rtoMinutes: e.target.value }))} /></label>
          <label>RPO (min)<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} value={editForm.rpoMinutes} onChange={(e) => setEditForm((f) => ({ ...f, rpoMinutes: e.target.value }))} /></label>
        </div>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={() => setEditingPlan(false)}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => {
            const title = requiredText(editForm.title, "El título", 200);
            const scope = optionalText(editForm.scope, "El alcance", 8000);
            const rtoMinutes = optionalNumber(editForm.rtoMinutes, "El RTO");
            const rpoMinutes = optionalNumber(editForm.rpoMinutes, "El RPO");
            assertRecoveryWindow(rtoMinutes, rpoMinutes);
            return updateBcp({ id: bcp.id, code: requiredText(bcp.code, "El código", 60), title, scope, status: bcp.status, rtoMinutes, rpoMinutes });
          }, { onSuccess: () => setEditingPlan(false), successMessage: "Plan actualizado." })}>Guardar cambios</button>
        </div>
      </div>
    </Modal>

    <Modal open={open} onClose={() => setOpen(false)} title={`Plan ${bcp.code}`} width={1040}>
      <div className="nf-continuity-detail">
        <div className="nf-continuity-detail-hero">
          <span className="nf-continuity-detail-hero-icon" aria-hidden><FileText size={21} strokeWidth={1.8} /></span>
          <div className="nf-continuity-detail-hero-copy">
            <div className="nf-continuity-detail-eyebrow">Plan de continuidad del negocio</div>
            <h2 className="nf-continuity-detail-hero-title">{bcp.title}</h2>
            <p className="nf-continuity-detail-hero-subtitle">{bcp.code} · versión {bcp.version ?? "1.0"}</p>
          </div>
          <div className="nf-continuity-detail-hero-status"><Badge value={PLAN_STATUS[bcp.status] ?? bcp.status} tone={bcp.status === "APPROVED" ? "green" : "blue"} />{activeActivation && <Badge value="ACTIVADO" tone="red" />}</div>
        </div>

        <div className="nf-continuity-detail-grid">
          <div className="nf-continuity-detail-column">
            <ContinuityDetailSection icon={FileText} title="Resumen del plan" description="Objetivos de recuperación y cobertura operativa.">
              {bcp.scope && <p className="nf-continuity-detail-copy">{bcp.scope}</p>}
              <div className="nf-continuity-detail-metrics">
                <DetailMetric label="Versión" value={`v${bcp.version ?? "1.0"}`} />
                <DetailMetric label="RTO objetivo" value={mins(bcp.rtoMinutes)} />
                <DetailMetric label="RPO objetivo" value={mins(bcp.rpoMinutes)} />
                <DetailMetric label="Cobertura" value={`${bcp.criticalProcesses.length} procesos · ${bcp.tests.length} pruebas`} />
              </div>
            </ContinuityDetailSection>

            <ContinuityDetailSection icon={ClipboardCheck} title="Procesos críticos" description="Actividades vinculadas al plan y su objetivo de recuperación.">
              {bcp.criticalProcesses.length > 0 ? <div className="nf-continuity-detail-list">
                {bcp.criticalProcesses.map((p) => <div key={p.id} className="nf-continuity-detail-list-item"><span><strong>{p.process.name}</strong><span style={{ color: "var(--nf-ink-3)", marginLeft: 8 }}>RTO {p.rtoMinutes ?? "—"}m</span></span>{canUpdate && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={pending} onClick={() => onRun(() => removeBcpProcess(p.id), { successMessage: "Proceso desvinculado." })}>Quitar</button>}</div>)}
              </div> : <div className="nf-continuity-detail-empty">No hay procesos críticos vinculados.</div>}
              {canUpdate && <div className="nf-continuity-detail-actions">
                <Picker aria-label="Vincular proceso crítico" className="nf-app-input" value={processId} onChange={(e) => setProcessId(e.target.value)} style={{ maxWidth: 260 }}>
                  <option value="">Vincular proceso crítico…</option>
                  {initial.processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Picker>
                <button type="button" className="nf-app-btn-ghost" disabled={pending || !processId} onClick={() => onRun(() => addBcpProcess({ planId: bcp.id, processId: assertOptions(processId, initial.processOptions.map((p) => p.id), "El proceso") }), { onSuccess: () => setProcessId(""), successMessage: "Proceso vinculado." })}><Link2 size={13} aria-hidden />Vincular</button>
              </div>}
            </ContinuityDetailSection>

            <ContinuityDetailSection icon={Layers3} title="Escenarios y versiones" description="Contextos de interrupción y trazabilidad de cambios.">
              {bcp.scenarios.length > 0 ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{bcp.scenarios.map((s) => <Badge key={s.id} value={s.title} tone="blue" />)}</div> : <div className="nf-continuity-detail-empty">No hay escenarios registrados.</div>}
              {canUpdate && <div className="nf-continuity-detail-actions"><button type="button" className="nf-app-btn-primary" onClick={() => setShowScenario(true)}><Plus size={13} aria-hidden />Nuevo escenario</button><button type="button" className="nf-app-btn-ghost" onClick={() => setShowVersion(true)}><History size={13} aria-hidden />Nueva versión</button></div>}
            </ContinuityDetailSection>

            <ContinuityDetailSection icon={FlaskConical} title="Pruebas y seguimiento" description="Simulacros, resultados y acciones de mejora.">
              {bcp.tests.length > 0 ? bcp.tests.map((t) => <TestRow key={t.id} test={t} canUpdate={initial.canUpdate} pending={pending} onRun={onRun} />) : <div className="nf-continuity-detail-empty">No hay pruebas registradas.</div>}
              {initial.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => setShowTest(true)}><Plus size={13} aria-hidden />Nueva prueba</button>}
            </ContinuityDetailSection>
          </div>

          <div className="nf-continuity-detail-column">
            <ContinuityDetailSection icon={ShieldCheck} title="Gobierno y activación" description="Aprobación, activación y control operativo del plan.">
              <div className="nf-continuity-detail-actions">
                {canApprove && bcp.status !== "APPROVED" && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => approvePlan({ id: bcp.id }), { successMessage: "Plan aprobado." })}><CheckCircle2 size={13} aria-hidden />Aprobar plan</button>}
                {canUpdate && bcp.status === "APPROVED" && !activeActivation && <button type="button" className="nf-app-btn-primary" disabled={pending || !activationReason.trim()} onClick={() => onRun(() => activatePlan({ planId: bcp.id, reason: requiredText(activationReason, "El motivo de activación", 2000), scenarioId: assertOptions(activationScenarioId, bcp.scenarios.map((s) => s.id), "El escenario") || null }), { onSuccess: () => { setActivationReason(""); setActivationScenarioId(""); }, successMessage: "Plan activado." })}><PlayCircle size={13} aria-hidden />Activar plan</button>}
                {canUpdate && activeActivation && <button type="button" className="nf-app-btn-danger" disabled={pending} onClick={() => setShowDeactivate(true)}><AlertTriangle size={13} aria-hidden />Desactivar plan</button>}
              </div>
              {canUpdate && bcp.status === "APPROVED" && !activeActivation && <div className="nf-continuity-detail-form-stack"><label>Motivo de activación<input className="nf-app-input" maxLength={2000} placeholder="Interrupción real o ejercicio…" value={activationReason} onChange={(e) => setActivationReason(e.target.value)} /></label><label>Escenario<Picker aria-label="Escenario" className="nf-app-input" value={activationScenarioId} onChange={(e) => setActivationScenarioId(e.target.value)}><option value="">Sin escenario</option>{bcp.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Picker></label></div>}
              {activeActivation && <div style={{ fontSize: 12, color: "var(--nf-danger-text)", padding: "10px 12px", borderRadius: 8, background: "var(--nf-danger-subtle)" }}>Activado {formatDateTime(activeActivation.activatedAt)} · {activeActivation.reason}</div>}
            </ContinuityDetailSection>
          </div>
        </div>
      </div>
    </Modal>

    <Modal open={showDeactivate} onClose={() => setShowDeactivate(false)} title="Cerrar activación" width={620}>
      <div className="nf-continuity-detail-form-stack"><label>Resultado<textarea className="nf-app-input" rows={2} maxLength={4000} value={deactivation.outcome} onChange={(e) => setDeactivation((f) => ({ ...f, outcome: e.target.value }))} /></label><label>Lecciones aprendidas<textarea className="nf-app-input" rows={3} maxLength={8000} value={deactivation.lessonsLearned} onChange={(e) => setDeactivation((f) => ({ ...f, lessonsLearned: e.target.value }))} /></label><label>Evidencia<Picker aria-label="Evidencia" className="nf-app-input" value={deactivation.evidenceId} onChange={(e) => setDeactivation((f) => ({ ...f, evidenceId: e.target.value }))}><option value="">Sin evidencia</option>{initial.evidenceOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</Picker></label><div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setShowDeactivate(false)}>Cancelar</button><button type="button" className="nf-app-btn-danger" disabled={pending || !activeActivation} onClick={() => activeActivation && onRun(() => deactivatePlan({ id: activeActivation.id, outcome: optionalText(deactivation.outcome, "El resultado", 4000) ?? null, lessonsLearned: optionalText(deactivation.lessonsLearned, "Las lecciones aprendidas", 8000) ?? null, evidenceId: assertOptions(deactivation.evidenceId, initial.evidenceOptions.map((ev) => ev.id), "La evidencia") || null }), { onSuccess: () => { setDeactivation({ outcome: "", lessonsLearned: "", evidenceId: "" }); setShowDeactivate(false); }, successMessage: "Plan desactivado." })}>Cerrar activación</button></div></div>
    </Modal>
    <Modal open={showScenario} onClose={() => setShowScenario(false)} title="Nuevo escenario de interrupción" width={560}>
      <div className="nf-continuity-detail-form-stack"><label>Título del escenario<input className="nf-app-input" maxLength={200} value={scenarioTitle} onChange={(e) => setScenarioTitle(e.target.value)} /></label><div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setShowScenario(false)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !scenarioTitle.trim()} onClick={() => onRun(() => addScenario({ planId: bcp.id, title: requiredText(scenarioTitle, "El título del escenario", 200) }), { onSuccess: () => { setScenarioTitle(""); setShowScenario(false); }, successMessage: "Escenario añadido." })}>Crear escenario</button></div></div>
    </Modal>
    <Modal open={showVersion} onClose={() => setShowVersion(false)} title="Nueva versión del plan" width={560}>
      <div className="nf-continuity-detail-form-stack"><label>Versión<input className="nf-app-input" maxLength={20} placeholder="Ej. 1.1" value={newVersion.version} onChange={(e) => setNewVersion((f) => ({ ...f, version: e.target.value }))} /></label><label>Resumen de cambios<textarea className="nf-app-input" rows={2} maxLength={4000} value={newVersion.changeSummary} onChange={(e) => setNewVersion((f) => ({ ...f, changeSummary: e.target.value }))} /></label><label>Contenido de la versión<textarea className="nf-app-input" rows={4} maxLength={50000} value={newVersion.content} onChange={(e) => setNewVersion((f) => ({ ...f, content: e.target.value }))} /></label><label>Evidencia<Picker aria-label="Evidencia" className="nf-app-input" value={newVersion.evidenceId} onChange={(e) => setNewVersion((f) => ({ ...f, evidenceId: e.target.value }))}><option value="">Sin evidencia</option>{initial.evidenceOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</Picker></label><div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setShowVersion(false)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !newVersion.version.trim()} onClick={() => onRun(() => createPlanVersion({ planId: bcp.id, version: requiredText(newVersion.version, "La versión", 20), changeSummary: optionalText(newVersion.changeSummary, "El resumen de cambios", 4000) ?? null, content: optionalText(newVersion.content, "El contenido", 50000) ?? null, evidenceId: assertOptions(newVersion.evidenceId, initial.evidenceOptions.map((ev) => ev.id), "La evidencia") || null }), { onSuccess: () => { setNewVersion({ version: "", changeSummary: "", content: "", evidenceId: "" }); setShowVersion(false); }, successMessage: "Nueva versión creada (el plan vuelve a borrador)." })}>Crear versión</button></div></div>
    </Modal>
    <Modal open={showTest} onClose={() => setShowTest(false)} title="Nueva prueba de continuidad" width={560}>
      <div className="nf-continuity-detail-form-stack"><label>Título de la prueba<input className="nf-app-input" maxLength={200} value={testTitle} onChange={(e) => setTestTitle(e.target.value)} /></label><label>Tipo<Picker aria-label="Tipo" className="nf-app-input" value={testType} onChange={(e) => setTestType(e.target.value)}>{Object.entries(TEST_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Picker></label><div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setShowTest(false)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !testTitle.trim()} onClick={() => onRun(() => createTest({ planId: bcp.id, title: requiredText(testTitle, "El título de la prueba", 200), type: assertOptions(testType, Object.keys(TEST_TYPE), "El tipo de prueba") as never }), { onSuccess: () => { setTestTitle(""); setShowTest(false); }, successMessage: "Prueba creada." })}>Crear prueba</button></div></div>
    </Modal>
  </div>;
}

function TestRow({ test, canUpdate, pending, onRun }: { test: Bcp["tests"][number]; canUpdate: boolean; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const r = test.results[0];
  return <div style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{test.title} · {TEST_TYPE[test.type]}</span><Badge value={TEST_STATUS[test.status]} tone={test.status === "COMPLETED" ? "green" : "blue"} /></div>
    {r && <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>Resultado: {OUTCOME[r.outcome]} · RTO {r.rtoAchievedMinutes ?? "—"}m / RPO {r.rpoAchievedMinutes ?? "—"}m · {r.improvementActions.length} mejoras</div>}
    {canUpdate && test.status === "PLANNED" && <button type="button" className="nf-app-btn-ghost" style={{ marginTop: 6, marginRight: 6 }} disabled={pending} onClick={() => onRun(() => setTestStatus({ id: test.id, status: "IN_PROGRESS" }), { successMessage: "Prueba en curso." })}>Iniciar</button>}
    {canUpdate && !r && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "PASSED", summary: "Prueba superada." }), { successMessage: "Resultado registrado." })}>Resultado: superada</button>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "PARTIAL", summary: "Prueba parcial." }), { successMessage: "Resultado registrado." })}>parcial</button>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => recordTestResult({ testId: test.id, outcome: "FAILED", summary: "Prueba fallida." }), { successMessage: "Resultado registrado." })}>fallida</button>
    </div>}
    {canUpdate && r && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => addImprovementAction({ testResultId: r.id, description: "Acción de mejora derivada de la prueba." }), { successMessage: "Acción de mejora añadida." })}>Acción de mejora</button>
      {r.improvementActions.filter((a) => a.status !== "DONE").map((a) => (
        <button key={a.id} type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => setImprovementStatus({ id: a.id, status: a.status === "OPEN" ? "IN_PROGRESS" : "DONE" }), { successMessage: "Estado de mejora actualizado." })}>
          {a.description.slice(0, 24)}{a.description.length > 24 ? "…" : ""} · {a.status === "OPEN" ? "iniciar" : "cerrar"}
        </button>
      ))}
    </div>}
  </div>;
}

function PlanForm({ kind, initial, pending, onClose, onRun }: { kind: "BCP" | "DRP"; initial: ContinuityPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({ code: "", title: "", scope: "", ownerId: "", rtoMinutes: "", rpoMinutes: "", bcpId: "" });
  const [formError, setFormError] = useState("");
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return <Modal open onClose={onClose} title={`Nuevo ${kind}`} width={600}>
    <form className="nf-modal-form" onSubmit={(e) => {
      e.preventDefault();
      try {
        const code = requiredText(f.code, "El código", 60);
        const title = requiredText(f.title, "El título", 200);
        const scope = optionalText(f.scope, "El alcance", 8000);
        const rtoMinutes = optionalNumber(f.rtoMinutes, "El RTO");
        const rpoMinutes = optionalNumber(f.rpoMinutes, "El RPO");
        assertRecoveryWindow(rtoMinutes, rpoMinutes);
        const ownerId = assertOptions(f.ownerId, initial.members.map((m) => m.id), "El propietario") || null;
        const bcpId = assertOptions(f.bcpId, initial.bcps.map((b) => b.id), "El BCP") || null;
        const base = { code, title, ownerId, rtoMinutes, rpoMinutes };
        setFormError("");
        onRun(() => kind === "BCP" ? createBcp({ ...base, scope }) : createDrp({ ...base, bcpId }), { onSuccess: onClose, successMessage: `${kind} creado.` });
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Revisa los datos del formulario.");
      }
    }}>
      <div className="nf-form-grid-2"><label>Código<input className="nf-app-input" required maxLength={60} value={f.code} onChange={(e) => set("code", e.target.value)} /></label><label>Título<input className="nf-app-input" required maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)} /></label></div>
      {kind === "BCP" && <label>Alcance<textarea className="nf-app-input" rows={2} maxLength={8000} value={f.scope} onChange={(e) => set("scope", e.target.value)} /></label>}
      {kind === "DRP" && <label>BCP relacionado<Picker aria-label="BCP relacionado" className="nf-app-input" value={f.bcpId} onChange={(e) => set("bcpId", e.target.value)}><option value="">Ninguno</option>{initial.bcps.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.title}</option>)}</Picker></label>}
      <div className="nf-form-grid-3">
        <label>RTO (min)<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} inputMode="numeric" value={f.rtoMinutes} onChange={(e) => set("rtoMinutes", e.target.value)} /></label>
        <label>RPO (min)<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} inputMode="numeric" value={f.rpoMinutes} onChange={(e) => set("rpoMinutes", e.target.value)} /></label>
        <label>Propietario<PersonPicker people={initial.members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Sin asignar" ariaLabel="Propietario" /></label>
      </div>
      {formError && <div className="nf-modal-error" role="alert">{formError}</div>}
      <div className="nf-modal-actions">
        <button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="nf-app-btn-primary" disabled={pending || !f.code.trim() || !f.title.trim()}>Crear {kind}</button>
      </div>
    </form>
  </Modal>;
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="nf-continuity-detail-metric"><div className="nf-continuity-detail-metric-label">{label}</div><strong className="nf-continuity-detail-metric-value">{value}</strong></div>;
}
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["var(--nf-success-text)", "var(--nf-success-subtle)"], gray: ["var(--nf-text-secondary)", "var(--nf-surface-muted)"], amber: ["var(--nf-warning-text)", "var(--nf-warning-subtle)"], red: ["var(--nf-danger-text)", "var(--nf-danger-subtle)"], blue: ["var(--nf-primary-active)", "var(--nf-primary-subtle)"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 6 }}>{value}</span>; }

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
function ContinuityDetailSection({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children: React.ReactNode }) {
  return <section className="nf-continuity-detail-section">
    <div className="nf-continuity-detail-section-head">
      <span className="nf-continuity-detail-section-icon" aria-hidden><Icon size={16} strokeWidth={1.9} /></span>
      <div>
        <h3 className="nf-continuity-detail-section-title">{title}</h3>
        {description && <p className="nf-continuity-detail-section-description">{description}</p>}
      </div>
    </div>
    <div className="nf-continuity-detail-section-body">{children}</div>
  </section>;
}

function BiaTab({ p, pending, onRun }: { p: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [showBiaForm, setShowBiaForm] = useState(false);
  const [bia, setBia] = useState({ code: "", title: "", scope: "", methodology: "", version: "1.0", ownerId: "", performedAt: "", nextReviewDate: "", evidenceId: "" });
  const [editingBia, setEditingBia] = useState<string | null>(null);
  const [biaEdit, setBiaEdit] = useState({ title: "", scope: "", methodology: "", version: "", performedAt: "", nextReviewDate: "", ownerId: "", evidenceId: "" });
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activity, setActivity] = useState({ biaId: "", code: "", name: "", processId: "", mtpdMinutes: "", rtoMinutes: "", rpoMinutes: "", minimumServiceLevel: "" });
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ mtpdMinutes: "", rtoMinutes: "", rpoMinutes: "", minimumServiceLevel: "" });
  const [showPriorityForm, setShowPriorityForm] = useState(false);
  const [priority, setPriority] = useState({ biaId: "", code: "", name: "", criticality: "MEDIUM", mtpdMinutes: "", rtoMinutes: "", minimumServiceLevel: "", revenueShare: "", customersAffected: "", description: "", notes: "" });
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [priorityEdit, setPriorityEdit] = useState({ name: "", criticality: "MEDIUM", mtpdMinutes: "", rtoMinutes: "", minimumServiceLevel: "", revenueShare: "", customersAffected: "", description: "", notes: "" });
  const [filterQuery, setFilterQuery] = useState("");
  const editingActivityRow = p.activities.find((row) => row.id === editingActivity);
  const editingBiaRow = p.bias.find((row) => row.id === editingBia);
  const editingPriorityRow = p.productPriorities.find((row) => row.id === editingPriority);
  const visibleBias = p.bias.filter((row) => matchesFilter(filterQuery, row.code, row.title, row.status));
  const visibleActivities = p.activities.filter((row) => matchesFilter(filterQuery, row.code, row.name, row.criticality));
  const visiblePriorities = p.productPriorities.filter((row) => matchesFilter(filterQuery, row.code, row.name, row.criticality));

  return <div style={{ display: "grid", gap: 16 }}>
    <ContinuityFilterBar query={filterQuery} onQueryChange={setFilterQuery} placeholder="Buscar BIA, actividad o producto…" />
    <div>
      <IsoSectionHeader
        icon={FileText}
        title="Análisis de impacto en el negocio"
        description="Evalúa el impacto de una interrupción y ordena la recuperación de los procesos críticos."
        action={p.canCreate && <button type="button" className="nf-app-btn-ghost" onClick={() => setShowBiaForm((v) => !v)}><Plus size={14} /> Nueva BIA</button>}
      />
      <Modal open={showBiaForm} onClose={() => setShowBiaForm(false)} title="Nueva BIA" width={680}>
        <div style={{ display: "grid", gap: 12 }}>
        <input aria-label="Código" className="nf-app-input" placeholder="Código" maxLength={60} required value={bia.code} onChange={(e) => setBia((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 120 }} />
        <input aria-label="Título" className="nf-app-input" placeholder="Título" maxLength={200} required value={bia.title} onChange={(e) => setBia((f) => ({ ...f, title: e.target.value }))} style={{ maxWidth: 220 }} />
        <input aria-label="Alcance" className="nf-app-input" placeholder="Alcance" maxLength={8000} value={bia.scope} onChange={(e) => setBia((f) => ({ ...f, scope: e.target.value }))} style={{ maxWidth: 220 }} />
        <input aria-label="Metodología" className="nf-app-input" placeholder="Metodología" maxLength={8000} value={bia.methodology} onChange={(e) => setBia((f) => ({ ...f, methodology: e.target.value }))} style={{ maxWidth: 220 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}><input aria-label="Versión" className="nf-app-input" placeholder="Versión" maxLength={20} required value={bia.version} onChange={(e) => setBia((f) => ({ ...f, version: e.target.value }))} /><DateField aria-label="Fecha de realización" className="nf-app-input" value={bia.performedAt} onChange={(e) => setBia((f) => ({ ...f, performedAt: e.target.value }))} /><DateField aria-label="Próxima revisión" className="nf-app-input" value={bia.nextReviewDate} onChange={(e) => setBia((f) => ({ ...f, nextReviewDate: e.target.value }))} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><PersonPicker people={p.members} value={bia.ownerId} onValueChange={(personId) => setBia((f) => ({ ...f, ownerId: personId }))} placeholder="Sin propietario" ariaLabel="Responsable" /><Picker aria-label="Evidencia" className="nf-app-input" value={bia.evidenceId} onChange={(e) => setBia((f) => ({ ...f, evidenceId: e.target.value }))}><option value="">Sin evidencia</option>{p.evidenceOptions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Picker></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowBiaForm(false)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !bia.code.trim() || !bia.title.trim()} onClick={() => onRun(() => { assertDateOrder(bia.performedAt, bia.nextReviewDate); return createBia({ code: requiredText(bia.code, "El código", 60), title: requiredText(bia.title, "El título", 200), scope: optionalText(bia.scope, "El alcance", 8000), methodology: optionalText(bia.methodology, "La metodología", 8000), version: requiredText(bia.version, "La versión", 20), ownerId: assertOptions(bia.ownerId, p.members.map((m) => m.id), "El propietario") || null, performedAt: optionalDate(bia.performedAt, "La fecha realizada"), nextReviewDate: optionalDate(bia.nextReviewDate, "La fecha de revisión"), evidenceId: assertOptions(bia.evidenceId, p.evidenceOptions.map((e) => e.id), "La evidencia") || null }); }, { onSuccess: () => { setBia({ code: "", title: "", scope: "", methodology: "", version: "1.0", ownerId: "", performedAt: "", nextReviewDate: "", evidenceId: "" }); setShowBiaForm(false); }, successMessage: "BIA creado." })}>Crear BIA</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 820 }}>
        <thead><tr><th>Código</th><th>BIA</th><th>Versión</th><th>Estado</th><th>Actividades</th><th>Aprobado por</th><th>Próxima revisión</th><th>Acciones</th></tr></thead>
        <tbody>{visibleBias.map((b) => <tr key={b.id}>
          <td><strong>{b.code}</strong></td><td>{b.title}</td><td>{b.version}</td>
          <td><Badge value={b.status === "APPROVED" ? "Aprobado" : b.status === "UNDER_REVIEW" ? "En revisión" : b.status === "SUPERSEDED" ? "Sustituido" : "Borrador"} tone={b.status === "APPROVED" ? "green" : "blue"} /></td>
          <td>{b.activityCount}</td><td>{b.approvedBy?.name ?? "—"}</td><td>{b.nextReviewDate ?? "—"}</td>
          <td>{p.canUpdate && b.status !== "APPROVED" && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingBia(editingBia === b.id ? null : b.id); setBiaEdit({ title: b.title, scope: b.scope ?? "", methodology: b.methodology ?? "", version: b.version, performedAt: b.performedAt ?? "", nextReviewDate: b.nextReviewDate ?? "", ownerId: b.owner?.id ?? "", evidenceId: b.evidenceId ?? "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>} {p.canApprove && b.status !== "APPROVED" && <button type="button" className="nf-row-action" data-tone="success" data-nf-no-action-icon disabled={pending} onClick={() => onRun(() => approveBia({ id: b.id }), { successMessage: "BIA aprobado." })}><Check size={14} strokeWidth={2} aria-hidden />Aprobar</button>}</td>
        </tr>)}</tbody></table>
        {!visibleBias.length && <div className="nf-data-table-empty">{p.bias.length ? "No hay BIA que coincida con el filtro." : "Sin BIA registrado. Crea el análisis de impacto para priorizar la recuperación."}</div>}
      </div>
      <Modal open={Boolean(editingBiaRow)} onClose={() => setEditingBia(null)} title={`Editar BIA · ${editingBiaRow?.code ?? ""}`} width={700}>
        <div style={{ display: "grid", gap: 12 }}>
          <label>Título<input className="nf-app-input" value={biaEdit.title} onChange={(e) => setBiaEdit((f) => ({ ...f, title: e.target.value }))} /></label>
          <label>Alcance<textarea className="nf-app-input" rows={2} value={biaEdit.scope} onChange={(e) => setBiaEdit((f) => ({ ...f, scope: e.target.value }))} /></label>
          <label>Metodología<textarea className="nf-app-input" rows={2} value={biaEdit.methodology} onChange={(e) => setBiaEdit((f) => ({ ...f, methodology: e.target.value }))} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <label>Versión<input className="nf-app-input" value={biaEdit.version} onChange={(e) => setBiaEdit((f) => ({ ...f, version: e.target.value }))} /></label>
            <label>Realizado<DateField className="nf-app-input" value={biaEdit.performedAt} onChange={(e) => setBiaEdit((f) => ({ ...f, performedAt: e.target.value }))} /></label>
            <label>Próxima revisión<DateField className="nf-app-input" value={biaEdit.nextReviewDate} onChange={(e) => setBiaEdit((f) => ({ ...f, nextReviewDate: e.target.value }))} /></label>
          </div>
          <label>Propietario<PersonPicker people={p.members} value={biaEdit.ownerId} onValueChange={(personId) => setBiaEdit((f) => ({ ...f, ownerId: personId }))} placeholder="Sin asignar" ariaLabel="Propietario" /></label>
          <label>Evidencia<Picker aria-label="Evidencia" className="nf-app-input" value={biaEdit.evidenceId} onChange={(e) => setBiaEdit((f) => ({ ...f, evidenceId: e.target.value }))}><option value="">Sin evidencia</option>{p.evidenceOptions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Picker></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingBia(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingBiaRow || !biaEdit.title.trim()} onClick={() => editingBiaRow && onRun(() => { assertDateOrder(biaEdit.performedAt, biaEdit.nextReviewDate); return updateBia({ id: editingBiaRow.id, title: requiredText(biaEdit.title, "El título", 200), scope: optionalText(biaEdit.scope, "El alcance", 8000) ?? null, methodology: optionalText(biaEdit.methodology, "La metodología", 8000) ?? null, version: requiredText(biaEdit.version, "La versión", 20), performedAt: optionalDate(biaEdit.performedAt, "La fecha realizada"), nextReviewDate: optionalDate(biaEdit.nextReviewDate, "La fecha de revisión"), ownerId: assertOptions(biaEdit.ownerId, p.members.map((m) => m.id), "El propietario") || null, evidenceId: assertOptions(biaEdit.evidenceId, p.evidenceOptions.map((e) => e.id), "La evidencia") || null }); }, { onSuccess: () => setEditingBia(null), successMessage: "BIA actualizado." })}>Guardar cambios</button></div>
        </div>
      </Modal>
    </div>

    <div>
      <IsoSectionHeader
        icon={ClipboardCheck}
        title="Actividades críticas priorizadas"
        description="Define los objetivos de recuperación, los tiempos máximos y el nivel mínimo de servicio."
        action={p.canCreate && p.bias.length > 0 && <button type="button" className="nf-app-btn-ghost" onClick={() => setShowActivityForm((v) => !v)}><Plus size={14} /> Nueva actividad</button>}
      />
      <Modal open={showActivityForm} onClose={() => setShowActivityForm(false)} title="Nueva actividad crítica" width={760}>
        <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Picker aria-label="BIA" className="nf-app-input" value={activity.biaId} onChange={(e) => setActivity((f) => ({ ...f, biaId: e.target.value }))} style={{ maxWidth: 200 }}>
            <option value="">BIA…</option>{p.bias.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </Picker>
          <input aria-label="Código" className="nf-app-input" placeholder="Código" value={activity.code} onChange={(e) => setActivity((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 120 }} />
          <input aria-label="Nombre de la actividad" className="nf-app-input" placeholder="Nombre de la actividad" value={activity.name} onChange={(e) => setActivity((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 220 }} />
          <Picker aria-label="Proceso (opcional)" className="nf-app-input" value={activity.processId} onChange={(e) => setActivity((f) => ({ ...f, processId: e.target.value }))} style={{ maxWidth: 200 }}>
            <option value="">Proceso (opcional)…</option>{p.processOptions.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
          </Picker>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input aria-label="MTPD (min)" className="nf-app-input" type="number" min={0} placeholder="MTPD (min)" value={activity.mtpdMinutes} onChange={(e) => setActivity((f) => ({ ...f, mtpdMinutes: e.target.value }))} style={{ maxWidth: 130 }} />
          <input aria-label="RTO (min)" className="nf-app-input" type="number" min={0} placeholder="RTO (min)" value={activity.rtoMinutes} onChange={(e) => setActivity((f) => ({ ...f, rtoMinutes: e.target.value }))} style={{ maxWidth: 130 }} />
          <input aria-label="RPO (min)" className="nf-app-input" type="number" min={0} placeholder="RPO (min)" value={activity.rpoMinutes} onChange={(e) => setActivity((f) => ({ ...f, rpoMinutes: e.target.value }))} style={{ maxWidth: 130 }} />
          <input aria-label="Nivel mínimo aceptable (MBCO)" className="nf-app-input" placeholder="Nivel mínimo aceptable (MBCO)" value={activity.minimumServiceLevel} onChange={(e) => setActivity((f) => ({ ...f, minimumServiceLevel: e.target.value }))} style={{ maxWidth: 240 }} />
          <button type="button" className="nf-app-btn-primary" disabled={pending || !activity.biaId || !activity.code.trim() || !activity.name.trim()} onClick={() => onRun(() => {
            const mtpdMinutes = optionalNumber(activity.mtpdMinutes, "El MTPD");
            const rtoMinutes = optionalNumber(activity.rtoMinutes, "El RTO");
            const rpoMinutes = optionalNumber(activity.rpoMinutes, "El RPO");
            if (mtpdMinutes !== null && rtoMinutes !== null && rtoMinutes > mtpdMinutes) throw new Error("El RTO no puede superar el MTPD.");
            assertRecoveryWindow(rtoMinutes, rpoMinutes);
            return createCriticalActivity({
            biaId: assertOptions(activity.biaId, p.bias.map((b) => b.id), "El BIA"), code: requiredText(activity.code, "El código", 60), name: requiredText(activity.name, "El nombre", 200), processId: assertOptions(activity.processId, p.processOptions.map((pr) => pr.id), "El proceso") || null,
            mtpdMinutes, rtoMinutes,
            rpoMinutes, minimumServiceLevel: optionalText(activity.minimumServiceLevel, "El nivel mínimo", 2000),
          }); }, { onSuccess: () => { setActivity({ biaId: "", code: "", name: "", processId: "", mtpdMinutes: "", rtoMinutes: "", rpoMinutes: "", minimumServiceLevel: "" }); setShowActivityForm(false); }, successMessage: "Actividad crítica creada." })}>Crear actividad</button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowActivityForm(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 1000 }}>
        <thead><tr><th>#</th><th>Código</th><th>Actividad</th><th>Impacto</th><th>Criticidad</th><th>MTPD</th><th>RTO</th><th>RPO</th><th>Nivel mínimo</th><th>Brechas</th><th>Acciones</th></tr></thead>
        <tbody>{visibleActivities.map((a) => <Fragment key={a.id}>
          <tr>
            <td>{a.priority}</td><td><strong>{a.code}</strong></td><td>{a.name}</td>
            <td>{a.impactScore}</td>
            <td><Badge value={CRITICALITY[a.criticality]?.label ?? a.criticality} tone={CRITICALITY[a.criticality]?.tone ?? "blue"} /></td>
            <td>{mins(a.mtpdMinutes)}</td><td>{mins(a.rtoMinutes)}</td><td>{mins(a.rpoMinutes)}</td>
            <td style={{ fontSize: 12 }}>{a.minimumServiceLevel ?? "—"}</td>
            <td>{a.gaps.length ? <Badge value={String(a.gaps.length)} tone="red" /> : <Badge value="0" tone="green" />}</td>
            <td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingActivity(editingActivity === a.id ? null : a.id); setEditValues({ mtpdMinutes: a.mtpdMinutes != null ? String(a.mtpdMinutes) : "", rtoMinutes: a.rtoMinutes != null ? String(a.rtoMinutes) : "", rpoMinutes: a.rpoMinutes != null ? String(a.rpoMinutes) : "", minimumServiceLevel: a.minimumServiceLevel ?? "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
          </tr>
        </Fragment>)}</tbody></table>
        <Modal open={Boolean(editingActivityRow)} onClose={() => setEditingActivity(null)} title={`Editar actividad · ${editingActivityRow?.code ?? ""}`} width={640}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <label>MTPD (min)<input className="nf-app-input" type="number" min={0} value={editValues.mtpdMinutes} onChange={(e) => setEditValues((f) => ({ ...f, mtpdMinutes: e.target.value }))} /></label>
              <label>RTO (min)<input className="nf-app-input" type="number" min={0} value={editValues.rtoMinutes} onChange={(e) => setEditValues((f) => ({ ...f, rtoMinutes: e.target.value }))} /></label>
              <label>RPO (min)<input className="nf-app-input" type="number" min={0} value={editValues.rpoMinutes} onChange={(e) => setEditValues((f) => ({ ...f, rpoMinutes: e.target.value }))} /></label>
            </div>
            <label>Nivel mínimo (MBCO)<input className="nf-app-input" value={editValues.minimumServiceLevel} onChange={(e) => setEditValues((f) => ({ ...f, minimumServiceLevel: e.target.value }))} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="nf-app-btn-ghost" onClick={() => setEditingActivity(null)}>Cancelar</button>
              <button type="button" className="nf-app-btn-primary" disabled={pending || !editingActivityRow} onClick={() => editingActivityRow && onRun(() => {
                const mtpdMinutes = optionalNumber(editValues.mtpdMinutes, "El MTPD");
                const rtoMinutes = optionalNumber(editValues.rtoMinutes, "El RTO");
                const rpoMinutes = optionalNumber(editValues.rpoMinutes, "El RPO");
                if (mtpdMinutes !== null && rtoMinutes !== null && rtoMinutes > mtpdMinutes) throw new Error("El RTO no puede superar el MTPD.");
                assertRecoveryWindow(rtoMinutes, rpoMinutes);
                return updateCriticalActivity({ id: editingActivityRow.id, mtpdMinutes, rtoMinutes, rpoMinutes, minimumServiceLevel: optionalText(editValues.minimumServiceLevel, "El nivel mínimo", 2000) ?? null });
              }, { onSuccess: () => setEditingActivity(null), successMessage: "Actividad actualizada." })}>Guardar cambios</button>
            </div>
          </div>
        </Modal>
        {!visibleActivities.length && <div className="nf-data-table-empty">{p.activities.length ? "No hay actividades que coincidan con el filtro." : "Sin actividades críticas. Añádelas al BIA para calcular prioridades."}</div>}
      </div>
    </div>

    <div>
      <IsoSectionHeader
        icon={Layers3}
        title="Priorización de productos y servicios"
        description="Ordena el impacto sobre ingresos, clientes y objetivos de recuperación para cada servicio."
        action={p.canCreate && p.bias.length > 0 && <button type="button" className="nf-app-btn-primary" onClick={() => setShowPriorityForm((v) => !v)}><Plus size={14} /> Nuevo</button>}
      />
      <Modal open={showPriorityForm} onClose={() => setShowPriorityForm(false)} title="Nueva prioridad de producto o servicio" width={760}>
        <div style={{ display: "grid", gap: 12 }}>
        <Picker aria-label="BIA" className="nf-app-input" value={priority.biaId} onChange={(e) => setPriority((f) => ({ ...f, biaId: e.target.value }))} style={{ maxWidth: 160 }}>
          <option value="">BIA…</option>{p.bias.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </Picker>
        <input aria-label="Código" className="nf-app-input" placeholder="Código" value={priority.code} onChange={(e) => setPriority((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 110 }} />
        <input aria-label="Producto/servicio" className="nf-app-input" placeholder="Producto/servicio" value={priority.name} onChange={(e) => setPriority((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 200 }} />
        <Picker aria-label="Criticidad" className="nf-app-input" value={priority.criticality} onChange={(e) => setPriority((f) => ({ ...f, criticality: e.target.value }))} style={{ maxWidth: 140 }}>
          {Object.entries(CRITICALITY).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </Picker>
        <input aria-label="MTPD" className="nf-app-input" type="number" min={0} placeholder="MTPD" value={priority.mtpdMinutes} onChange={(e) => setPriority((f) => ({ ...f, mtpdMinutes: e.target.value }))} style={{ maxWidth: 100 }} />
        <input aria-label="RTO" className="nf-app-input" type="number" min={0} placeholder="RTO" value={priority.rtoMinutes} onChange={(e) => setPriority((f) => ({ ...f, rtoMinutes: e.target.value }))} style={{ maxWidth: 100 }} />
        <input aria-label="Nivel mínimo" className="nf-app-input" placeholder="Nivel mínimo" value={priority.minimumServiceLevel} onChange={(e) => setPriority((f) => ({ ...f, minimumServiceLevel: e.target.value }))} />
        <input aria-label="% ingresos" className="nf-app-input" type="number" min={0} max={100} placeholder="% ingresos" value={priority.revenueShare} onChange={(e) => setPriority((f) => ({ ...f, revenueShare: e.target.value }))} style={{ maxWidth: 110 }} />
        <input aria-label="Clientes afectados" className="nf-app-input" type="number" min={0} placeholder="Clientes afectados" value={priority.customersAffected} onChange={(e) => setPriority((f) => ({ ...f, customersAffected: e.target.value }))} style={{ maxWidth: 140 }} />
        <textarea aria-label="Descripción" className="nf-app-input" rows={2} placeholder="Descripción" value={priority.description} onChange={(e) => setPriority((f) => ({ ...f, description: e.target.value }))} />
        <textarea aria-label="Notas" className="nf-app-input" rows={2} placeholder="Notas" value={priority.notes} onChange={(e) => setPriority((f) => ({ ...f, notes: e.target.value }))} />
        <button type="button" className="nf-app-btn-primary" disabled={pending || !priority.biaId || !priority.code.trim() || !priority.name.trim()} onClick={() => onRun(() => {
          const mtpdMinutes = optionalNumber(priority.mtpdMinutes, "El MTPD");
          const rtoMinutes = optionalNumber(priority.rtoMinutes, "El RTO");
          if (mtpdMinutes !== null && rtoMinutes !== null && rtoMinutes > mtpdMinutes) throw new Error("El RTO no puede superar el MTPD.");
          return createProductPriority({
          biaId: assertOptions(priority.biaId, p.bias.map((b) => b.id), "El BIA"), code: requiredText(priority.code, "El código", 60), name: requiredText(priority.name, "El nombre", 200), criticality: assertOptions(priority.criticality, Object.keys(CRITICALITY), "La criticidad") as never,
          mtpdMinutes, rtoMinutes, minimumServiceLevel: optionalText(priority.minimumServiceLevel, "El nivel mínimo", 2000) ?? null,
          revenueShare: optionalDecimal(priority.revenueShare, "El porcentaje de ingresos", 100), customersAffected: optionalNumber(priority.customersAffected, "Los clientes afectados"), description: optionalText(priority.description, "La descripción", 4000) ?? null, notes: optionalText(priority.notes, "Las notas", 4000) ?? null,
        }); }, { onSuccess: () => { setPriority({ biaId: "", code: "", name: "", criticality: "MEDIUM", mtpdMinutes: "", rtoMinutes: "", minimumServiceLevel: "", revenueShare: "", customersAffected: "", description: "", notes: "" }); setShowPriorityForm(false); }, successMessage: "Prioridad creada." })}>Crear prioridad</button>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowPriorityForm(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 820 }}>
        <thead><tr><th>#</th><th>Producto / servicio</th><th>Criticidad</th><th>MTPD</th><th>RTO</th><th>% ingresos</th><th>Clientes</th><th>Acciones</th></tr></thead>
        <tbody>{visiblePriorities.map((x) => <tr key={x.id}>
          <td>{x.priority}</td><td><strong>{x.code}</strong> · {x.name}</td>
          <td><Badge value={CRITICALITY[x.criticality]?.label ?? x.criticality} tone={CRITICALITY[x.criticality]?.tone ?? "blue"} /></td>
          <td>{mins(x.mtpdMinutes)}</td><td>{mins(x.rtoMinutes)}</td>
          <td>{x.revenueShare != null ? `${x.revenueShare}%` : "—"}</td><td>{x.customersAffected ?? "—"}</td><td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingPriority(editingPriority === x.id ? null : x.id); setPriorityEdit({ name: x.name, criticality: x.criticality, mtpdMinutes: x.mtpdMinutes != null ? String(x.mtpdMinutes) : "", rtoMinutes: x.rtoMinutes != null ? String(x.rtoMinutes) : "", minimumServiceLevel: x.minimumServiceLevel ?? "", revenueShare: x.revenueShare != null ? String(x.revenueShare) : "", customersAffected: x.customersAffected != null ? String(x.customersAffected) : "", description: x.description ?? "", notes: x.notes ?? "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
        </tr>)}</tbody></table>
        <Modal open={Boolean(editingPriorityRow)} onClose={() => setEditingPriority(null)} title={`Editar prioridad · ${editingPriorityRow?.code ?? ""}`} width={680}>
          <div style={{ display: "grid", gap: 12 }}>
            <label>Producto/servicio<input className="nf-app-input" value={priorityEdit.name} onChange={(e) => setPriorityEdit((f) => ({ ...f, name: e.target.value }))} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Criticidad<Picker aria-label="Criticidad" className="nf-app-input" value={priorityEdit.criticality} onChange={(e) => setPriorityEdit((f) => ({ ...f, criticality: e.target.value }))}>{Object.entries(CRITICALITY).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}</Picker></label><label>Nivel mínimo<input className="nf-app-input" value={priorityEdit.minimumServiceLevel} onChange={(e) => setPriorityEdit((f) => ({ ...f, minimumServiceLevel: e.target.value }))} /></label></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}><label>MTPD<input className="nf-app-input" type="number" min={0} value={priorityEdit.mtpdMinutes} onChange={(e) => setPriorityEdit((f) => ({ ...f, mtpdMinutes: e.target.value }))} /></label><label>RTO<input className="nf-app-input" type="number" min={0} value={priorityEdit.rtoMinutes} onChange={(e) => setPriorityEdit((f) => ({ ...f, rtoMinutes: e.target.value }))} /></label><label>% ingresos<input className="nf-app-input" type="number" min={0} max={100} value={priorityEdit.revenueShare} onChange={(e) => setPriorityEdit((f) => ({ ...f, revenueShare: e.target.value }))} /></label><label>Clientes<input className="nf-app-input" type="number" min={0} value={priorityEdit.customersAffected} onChange={(e) => setPriorityEdit((f) => ({ ...f, customersAffected: e.target.value }))} /></label></div><label>Descripción<textarea className="nf-app-input" rows={2} value={priorityEdit.description} onChange={(e) => setPriorityEdit((f) => ({ ...f, description: e.target.value }))} /></label><label>Notas<textarea className="nf-app-input" rows={2} value={priorityEdit.notes} onChange={(e) => setPriorityEdit((f) => ({ ...f, notes: e.target.value }))} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingPriority(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingPriorityRow || !priorityEdit.name.trim()} onClick={() => editingPriorityRow && onRun(() => { const mtpdMinutes = optionalNumber(priorityEdit.mtpdMinutes, "El MTPD"); const rtoMinutes = optionalNumber(priorityEdit.rtoMinutes, "El RTO"); if (mtpdMinutes !== null && rtoMinutes !== null && rtoMinutes > mtpdMinutes) throw new Error("El RTO no puede superar el MTPD."); return updateProductPriority({ id: editingPriorityRow.id, name: requiredText(priorityEdit.name, "El nombre", 200), criticality: assertOptions(priorityEdit.criticality, Object.keys(CRITICALITY), "La criticidad") as never, mtpdMinutes, rtoMinutes, minimumServiceLevel: optionalText(priorityEdit.minimumServiceLevel, "El nivel mínimo", 2000) ?? null, revenueShare: optionalDecimal(priorityEdit.revenueShare, "El porcentaje de ingresos", 100), customersAffected: optionalNumber(priorityEdit.customersAffected, "Los clientes afectados"), description: optionalText(priorityEdit.description, "La descripción", 4000) ?? null, notes: optionalText(priorityEdit.notes, "Las notas", 4000) ?? null }); }, { onSuccess: () => setEditingPriority(null), successMessage: "Prioridad actualizada." })}>Guardar cambios</button></div>
          </div>
        </Modal>
        {!visiblePriorities.length && <div className="nf-data-table-empty">{p.productPriorities.length ? "No hay productos o servicios que coincidan con el filtro." : "Sin productos/servicios priorizados."}</div>}
      </div>
    </div>
  </div>;
}

const DEP_TYPE_OPTIONS = ["PEOPLE", "FACILITY", "TECHNOLOGY", "SUPPLIER", "DATA", "EQUIPMENT", "UTILITY", "PROCESS", "OTHER"] as const;
const RES_TYPE_OPTIONS = ["PEOPLE", "FACILITY", "TECHNOLOGY", "EQUIPMENT", "DATA", "SUPPLIER", "FINANCIAL", "TRANSPORT", "OTHER"] as const;

function DependenciesTab({ p, pending, onRun }: { p: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const rows = p.activities.flatMap((a) => a.dependencies.map((d) => ({ ...d, activity: a.name, activityId: a.id })));
  const resources = p.activities.flatMap((a) => a.resources.map((r) => ({ ...r, activity: a.name, activityId: a.id })));
  const [showDep, setShowDep] = useState(false);
  const [dep, setDep] = useState({ activityId: "", type: "TECHNOLOGY", name: "", criticality: "MEDIUM", maxOutageMinutes: "", alternative: "", singlePointOfFailure: false, description: "", notes: "" });
  const [editingDependency, setEditingDependency] = useState<string | null>(null);
  const [dependencyEdit, setDependencyEdit] = useState({ type: "TECHNOLOGY", name: "", criticality: "MEDIUM", maxOutageMinutes: "", alternative: "", singlePointOfFailure: false });
  const [showRes, setShowRes] = useState(false);
  const [res, setRes] = useState({ activityId: "", type: "PEOPLE", name: "", normalQuantity: "", minimumQuantity: "", unit: "", description: "", availableAt: "", alternativeResource: "", leadTimeMinutes: "", notes: "" });
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [resourceEdit, setResourceEdit] = useState({ type: "PEOPLE", name: "", normalQuantity: "", minimumQuantity: "", unit: "", alternativeResource: "", leadTimeMinutes: "" });
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const editingDependencyRow = rows.find((row) => row.id === editingDependency);
  const editingResourceRow = resources.find((row) => row.id === editingResource);
  const visibleRows = rows.filter((row) => (filterType === "ALL" || row.type === filterType) && (filterRisk === "ALL" || (filterRisk === "SPOF" ? row.singlePointOfFailure : !row.singlePointOfFailure)) && matchesFilter(filterQuery, row.activity, row.name, DEP_TYPE[row.type], row.criticality));
  const visibleResources = resources.filter((row) => (filterType === "ALL" || row.type === filterType) && matchesFilter(filterQuery, row.activity, row.name, DEP_TYPE[row.type]));

  return <div style={{ display: "grid", gap: 16 }}>
    <ContinuityFilterBar query={filterQuery} onQueryChange={setFilterQuery} placeholder="Buscar dependencia o recurso…"><Picker className="nf-app-input" aria-label="Tipo de dependencia o recurso" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="ALL">Todos los tipos</option>{Array.from(new Set([...DEP_TYPE_OPTIONS, ...RES_TYPE_OPTIONS])).map((value) => <option key={value} value={value}>{DEP_TYPE[value] ?? value}</option>)}</Picker><Picker className="nf-app-input" aria-label="Puntos únicos de fallo" value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}><option value="ALL">Todos los riesgos</option><option value="SPOF">Solo puntos únicos de fallo</option><option value="NO_SPOF">Sin punto único de fallo</option></Picker></ContinuityFilterBar>
    <div>
      <IsoSectionHeader
        icon={Link2}
        title={<>Dependencias {p.bcmSummary.singlePointsOfFailure > 0 && <Badge value={`${p.bcmSummary.singlePointsOfFailure} punto(s) único(s) de fallo`} tone="red" />}</>}
        description="Identifica recursos, proveedores y puntos únicos de fallo que pueden bloquear una actividad crítica."
        action={p.canUpdate && p.activities.length > 0 && <button type="button" className="nf-app-btn-ghost" onClick={() => setShowDep((v) => !v)}><Plus size={14} /> Nueva dependencia</button>}
      />
      <Modal open={showDep} onClose={() => setShowDep(false)} title="Nueva dependencia" width={760}>
        <div style={{ display: "grid", gap: 12 }}>
        <Picker aria-label="Actividad" className="nf-app-input" value={dep.activityId} onChange={(e) => setDep((f) => ({ ...f, activityId: e.target.value }))} style={{ maxWidth: 200 }}>
          <option value="">Actividad…</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </Picker>
        <Picker aria-label="Tipo" className="nf-app-input" value={dep.type} onChange={(e) => setDep((f) => ({ ...f, type: e.target.value }))} style={{ maxWidth: 150 }}>
          {DEP_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{DEP_TYPE[t]}</option>)}
        </Picker>
        <input aria-label="Nombre" className="nf-app-input" placeholder="Nombre" value={dep.name} onChange={(e) => setDep((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 180 }} />
        <Picker aria-label="Criticidad" className="nf-app-input" value={dep.criticality} onChange={(e) => setDep((f) => ({ ...f, criticality: e.target.value }))} style={{ maxWidth: 130 }}>
          {Object.entries(CRITICALITY).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </Picker>
        <input aria-label="Indisp. máx. (min)" className="nf-app-input" type="number" min={0} placeholder="Indisp. máx. (min)" value={dep.maxOutageMinutes} onChange={(e) => setDep((f) => ({ ...f, maxOutageMinutes: e.target.value }))} style={{ maxWidth: 150 }} />
        <input aria-label="Alternativa" className="nf-app-input" placeholder="Alternativa" value={dep.alternative} onChange={(e) => setDep((f) => ({ ...f, alternative: e.target.value }))} style={{ maxWidth: 180 }} />
        <textarea aria-label="Descripción" className="nf-app-input" rows={2} placeholder="Descripción" value={dep.description} onChange={(e) => setDep((f) => ({ ...f, description: e.target.value }))} />
        <textarea aria-label="Notas" className="nf-app-input" rows={2} placeholder="Notas" value={dep.notes} onChange={(e) => setDep((f) => ({ ...f, notes: e.target.value }))} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={dep.singlePointOfFailure} onChange={(e) => setDep((f) => ({ ...f, singlePointOfFailure: e.target.checked }))} /> Punto único de fallo</label>
        <button type="button" className="nf-app-btn-primary" disabled={pending || !dep.activityId || !dep.name.trim()} onClick={() => onRun(() => addDependency({
          activityId: assertOptions(dep.activityId, p.activities.map((a) => a.id), "La actividad"), type: assertOptions(dep.type, DEP_TYPE_OPTIONS, "El tipo") as never, name: requiredText(dep.name, "El nombre", 200), criticality: assertOptions(dep.criticality, Object.keys(CRITICALITY), "La criticidad") as never,
          maxOutageMinutes: optionalNumber(dep.maxOutageMinutes, "La indisponibilidad máxima"), alternative: optionalText(dep.alternative, "La alternativa", 4000),
          singlePointOfFailure: dep.singlePointOfFailure, description: optionalText(dep.description, "La descripción", 4000) ?? null, notes: optionalText(dep.notes, "Las notas", 4000) ?? null,
        }), { onSuccess: () => { setDep({ activityId: "", type: "TECHNOLOGY", name: "", criticality: "MEDIUM", maxOutageMinutes: "", alternative: "", singlePointOfFailure: false, description: "", notes: "" }); setShowDep(false); }, successMessage: "Dependencia añadida." })}>Crear dependencia</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowDep(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 960 }}>
        <thead><tr><th>Actividad</th><th>Tipo</th><th>Dependencia</th><th>Criticidad</th><th>Indisp. máx.</th><th>Recurso alterno</th><th>SPOF</th><th>Acciones</th></tr></thead>
        <tbody>{visibleRows.map((d) => <tr key={d.id}>
          <td>{d.activity}</td><td>{DEP_TYPE[d.type] ?? d.type}</td><td><strong>{d.name}</strong></td>
          <td><Badge value={CRITICALITY[d.criticality]?.label ?? d.criticality} tone={CRITICALITY[d.criticality]?.tone ?? "blue"} /></td>
          <td>{mins(d.maxOutageMinutes)}</td>
          <td style={{ fontSize: 12 }}>{d.alternative ?? <span style={{ color: "var(--nf-danger-text)" }}>sin alterno</span>}</td>
          <td>{d.singlePointOfFailure ? <Badge value="Sí" tone="red" /> : "—"}</td>
          <td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingDependency(editingDependency === d.id ? null : d.id); setDependencyEdit({ type: d.type, name: d.name, criticality: d.criticality, maxOutageMinutes: d.maxOutageMinutes != null ? String(d.maxOutageMinutes) : "", alternative: d.alternative ?? "", singlePointOfFailure: d.singlePointOfFailure }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
        </tr>)}</tbody></table>
        <Modal open={Boolean(editingDependencyRow)} onClose={() => setEditingDependency(null)} title={`Editar dependencia · ${editingDependencyRow?.name ?? ""}`} width={680}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Tipo<Picker aria-label="Tipo" className="nf-app-input" value={dependencyEdit.type} onChange={(e) => setDependencyEdit((f) => ({ ...f, type: e.target.value }))}>{DEP_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{DEP_TYPE[v] ?? v}</option>)}</Picker></label><label>Criticidad<Picker aria-label="Criticidad" className="nf-app-input" value={dependencyEdit.criticality} onChange={(e) => setDependencyEdit((f) => ({ ...f, criticality: e.target.value }))}>{Object.entries(CRITICALITY).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}</Picker></label></div>
            <label>Nombre<input className="nf-app-input" value={dependencyEdit.name} onChange={(e) => setDependencyEdit((f) => ({ ...f, name: e.target.value }))} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Indisponibilidad máxima<input className="nf-app-input" type="number" min={0} value={dependencyEdit.maxOutageMinutes} onChange={(e) => setDependencyEdit((f) => ({ ...f, maxOutageMinutes: e.target.value }))} /></label><label>Alternativa<input className="nf-app-input" value={dependencyEdit.alternative} onChange={(e) => setDependencyEdit((f) => ({ ...f, alternative: e.target.value }))} /></label></div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={dependencyEdit.singlePointOfFailure} onChange={(e) => setDependencyEdit((f) => ({ ...f, singlePointOfFailure: e.target.checked }))} /> Punto único de fallo</label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingDependency(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingDependencyRow || !dependencyEdit.name.trim()} onClick={() => editingDependencyRow && onRun(() => updateDependency({ id: editingDependencyRow.id, type: assertOptions(dependencyEdit.type, DEP_TYPE_OPTIONS, "El tipo") as never, name: requiredText(dependencyEdit.name, "El nombre", 200), criticality: assertOptions(dependencyEdit.criticality, Object.keys(CRITICALITY), "La criticidad") as never, maxOutageMinutes: optionalNumber(dependencyEdit.maxOutageMinutes, "La indisponibilidad máxima"), alternative: optionalText(dependencyEdit.alternative, "La alternativa", 4000) ?? null, singlePointOfFailure: dependencyEdit.singlePointOfFailure }), { onSuccess: () => setEditingDependency(null), successMessage: "Dependencia actualizada." })}>Guardar cambios</button></div>
          </div>
        </Modal>
        {!visibleRows.length && <div className="nf-data-table-empty">{rows.length ? "No hay dependencias que coincidan con el filtro." : "Sin dependencias registradas."}</div>}
      </div>
    </div>
    <div>
      <IsoSectionHeader
        icon={Layers3}
        title="Recursos mínimos"
        description="Documenta las personas, tecnologías, instalaciones y suministros necesarios para sostener cada actividad."
        action={p.canUpdate && p.activities.length > 0 && <button type="button" className="nf-app-btn-primary" onClick={() => setShowRes((v) => !v)}><Plus size={14} /> Nuevo recurso</button>}
      />
      <Modal open={showRes} onClose={() => setShowRes(false)} title="Nuevo recurso mínimo" width={720}>
        <div style={{ display: "grid", gap: 12 }}>
        <Picker aria-label="Actividad" className="nf-app-input" value={res.activityId} onChange={(e) => setRes((f) => ({ ...f, activityId: e.target.value }))} style={{ maxWidth: 200 }}>
          <option value="">Actividad…</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </Picker>
        <Picker aria-label="Tipo" className="nf-app-input" value={res.type} onChange={(e) => setRes((f) => ({ ...f, type: e.target.value }))} style={{ maxWidth: 150 }}>
          {RES_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{DEP_TYPE[t] ?? t}</option>)}
        </Picker>
        <input aria-label="Recurso" className="nf-app-input" placeholder="Recurso" value={res.name} onChange={(e) => setRes((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 180 }} />
        <input aria-label="Cantidad normal" className="nf-app-input" type="number" min={0} placeholder="Cantidad normal" value={res.normalQuantity} onChange={(e) => setRes((f) => ({ ...f, normalQuantity: e.target.value }))} style={{ maxWidth: 140 }} />
        <input aria-label="Cantidad mínima" className="nf-app-input" type="number" min={0} placeholder="Cantidad mínima" value={res.minimumQuantity} onChange={(e) => setRes((f) => ({ ...f, minimumQuantity: e.target.value }))} style={{ maxWidth: 140 }} />
        <input aria-label="Unidad" className="nf-app-input" placeholder="Unidad" value={res.unit} onChange={(e) => setRes((f) => ({ ...f, unit: e.target.value }))} style={{ maxWidth: 100 }} />
        <textarea aria-label="Descripción" className="nf-app-input" rows={2} placeholder="Descripción" value={res.description} onChange={(e) => setRes((f) => ({ ...f, description: e.target.value }))} />
        <input aria-label="Disponible en" className="nf-app-input" placeholder="Disponible en" value={res.availableAt} onChange={(e) => setRes((f) => ({ ...f, availableAt: e.target.value }))} />
        <input aria-label="Recurso alterno" className="nf-app-input" placeholder="Recurso alterno" value={res.alternativeResource} onChange={(e) => setRes((f) => ({ ...f, alternativeResource: e.target.value }))} />
        <input aria-label="Plazo (min)" className="nf-app-input" type="number" min={0} placeholder="Plazo (min)" value={res.leadTimeMinutes} onChange={(e) => setRes((f) => ({ ...f, leadTimeMinutes: e.target.value }))} />
        <button type="button" className="nf-app-btn-primary" disabled={pending || !res.activityId || !res.name.trim()} onClick={() => onRun(() => {
          const normalQuantity = optionalNumber(res.normalQuantity, "La cantidad normal");
          const minimumQuantity = optionalNumber(res.minimumQuantity, "La cantidad mínima");
          if (normalQuantity !== null && minimumQuantity !== null && minimumQuantity > normalQuantity) throw new Error("La cantidad mínima no puede superar la cantidad normal.");
          return addResourceRequirement({
          activityId: assertOptions(res.activityId, p.activities.map((a) => a.id), "La actividad"), type: assertOptions(res.type, RES_TYPE_OPTIONS, "El tipo") as never, name: requiredText(res.name, "El nombre", 200),
          normalQuantity, minimumQuantity,
          unit: optionalText(res.unit, "La unidad", 40), description: optionalText(res.description, "La descripción", 4000) ?? null, availableAt: optionalText(res.availableAt, "La disponibilidad", 400), alternativeResource: optionalText(res.alternativeResource, "El recurso alterno", 4000) ?? null, leadTimeMinutes: optionalNumber(res.leadTimeMinutes, "El plazo"), notes: optionalText(res.notes, "Las notas", 4000) ?? null,
        }); }, { onSuccess: () => { setRes({ activityId: "", type: "PEOPLE", name: "", normalQuantity: "", minimumQuantity: "", unit: "", description: "", availableAt: "", alternativeResource: "", leadTimeMinutes: "", notes: "" }); setShowRes(false); }, successMessage: "Recurso añadido." })}>Crear recurso</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowRes(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 900 }}>
        <thead><tr><th>Actividad</th><th>Tipo</th><th>Recurso</th><th>Normal</th><th>Mínimo</th><th>Recurso alterno</th><th>Plazo</th><th>Acciones</th></tr></thead>
        <tbody>{visibleResources.map((r) => <tr key={r.id}>
          <td>{r.activity}</td><td>{DEP_TYPE[r.type] ?? r.type}</td><td><strong>{r.name}</strong></td>
          <td>{r.normalQuantity ?? "—"} {r.unit ?? ""}</td><td>{r.minimumQuantity ?? "—"} {r.unit ?? ""}</td>
          <td style={{ fontSize: 12 }}>{r.alternativeResource ?? "—"}</td><td>{mins(r.leadTimeMinutes)}</td>
          <td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingResource(editingResource === r.id ? null : r.id); setResourceEdit({ type: r.type, name: r.name, normalQuantity: r.normalQuantity != null ? String(r.normalQuantity) : "", minimumQuantity: r.minimumQuantity != null ? String(r.minimumQuantity) : "", unit: r.unit ?? "", alternativeResource: r.alternativeResource ?? "", leadTimeMinutes: r.leadTimeMinutes != null ? String(r.leadTimeMinutes) : "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
        </tr>)}</tbody></table>
        <Modal open={Boolean(editingResourceRow)} onClose={() => setEditingResource(null)} title={`Editar recurso · ${editingResourceRow?.name ?? ""}`} width={680}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Tipo<Picker aria-label="Tipo" className="nf-app-input" value={resourceEdit.type} onChange={(e) => setResourceEdit((f) => ({ ...f, type: e.target.value }))}>{RES_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{DEP_TYPE[v] ?? v}</option>)}</Picker></label><label>Unidad<input className="nf-app-input" value={resourceEdit.unit} onChange={(e) => setResourceEdit((f) => ({ ...f, unit: e.target.value }))} /></label></div>
            <label>Recurso<input className="nf-app-input" value={resourceEdit.name} onChange={(e) => setResourceEdit((f) => ({ ...f, name: e.target.value }))} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>Normal<input className="nf-app-input" type="number" min={0} value={resourceEdit.normalQuantity} onChange={(e) => setResourceEdit((f) => ({ ...f, normalQuantity: e.target.value }))} /></label><label>Mínimo<input className="nf-app-input" type="number" min={0} value={resourceEdit.minimumQuantity} onChange={(e) => setResourceEdit((f) => ({ ...f, minimumQuantity: e.target.value }))} /></label><label>Plazo (min)<input className="nf-app-input" type="number" min={0} value={resourceEdit.leadTimeMinutes} onChange={(e) => setResourceEdit((f) => ({ ...f, leadTimeMinutes: e.target.value }))} /></label></div>
            <label>Recurso alterno<input className="nf-app-input" value={resourceEdit.alternativeResource} onChange={(e) => setResourceEdit((f) => ({ ...f, alternativeResource: e.target.value }))} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingResource(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingResourceRow || !resourceEdit.name.trim()} onClick={() => editingResourceRow && onRun(() => { const normalQuantity = optionalNumber(resourceEdit.normalQuantity, "La cantidad normal"); const minimumQuantity = optionalNumber(resourceEdit.minimumQuantity, "La cantidad mínima"); if (normalQuantity !== null && minimumQuantity !== null && minimumQuantity > normalQuantity) throw new Error("La cantidad mínima no puede superar la cantidad normal."); return updateResourceRequirement({ id: editingResourceRow.id, type: assertOptions(resourceEdit.type, RES_TYPE_OPTIONS, "El tipo") as never, name: requiredText(resourceEdit.name, "El nombre", 200), normalQuantity, minimumQuantity, unit: optionalText(resourceEdit.unit, "La unidad", 40) ?? null, alternativeResource: optionalText(resourceEdit.alternativeResource, "El recurso alterno", 4000) ?? null, leadTimeMinutes: optionalNumber(resourceEdit.leadTimeMinutes, "El plazo") }); }, { onSuccess: () => setEditingResource(null), successMessage: "Recurso actualizado." })}>Guardar cambios</button></div>
          </div>
        </Modal>
        {!visibleResources.length && <div className="nf-data-table-empty">{resources.length ? "No hay recursos que coincidan con el filtro." : "Sin recursos mínimos definidos."}</div>}
      </div>
    </div>
  </div>;
}

const STRATEGY_TYPE_OPTIONS = ["PREVENT", "MITIGATE", "REDUNDANCY", "RELOCATION", "OUTSOURCING", "MANUAL_WORKAROUND", "INSURANCE", "ACCEPT"] as const;
const STRATEGY_NEXT: Record<string, string | null> = { PROPOSED: "APPROVED", APPROVED: "IMPLEMENTED", IMPLEMENTED: null, REJECTED: null, RETIRED: null };
const STRATEGY_NEXT_LABEL: Record<string, string> = { APPROVED: "aprobar", IMPLEMENTED: "marcar implementada" };

function StrategiesTab({ p, pending, onRun }: { p: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [showStrategy, setShowStrategy] = useState(false);
  const [strategy, setStrategy] = useState({ code: "", title: "", activityId: "", type: "MITIGATE", achievesRtoMinutes: "", achievesRpoMinutes: "", cost: "", description: "", ownerId: "", resourcesNeeded: "", notes: "" });
  const [editingStrategy, setEditingStrategy] = useState<string | null>(null);
  const [strategyEdit, setStrategyEdit] = useState({ title: "", activityId: "", type: "MITIGATE", achievesRtoMinutes: "", achievesRpoMinutes: "", cost: "", description: "", ownerId: "", resourcesNeeded: "", notes: "" });
  const [showProcedure, setShowProcedure] = useState(false);
  const [procedure, setProcedure] = useState({ code: "", title: "", activityId: "", estimatedMinutes: "", objective: "", steps: "", prerequisites: "", responsibleId: "", order: "0", version: "1.0" });
  const [editingProcedure, setEditingProcedure] = useState<string | null>(null);
  const [procedureEdit, setProcedureEdit] = useState({ title: "", activityId: "", estimatedMinutes: "", objective: "", steps: "", prerequisites: "", order: "", version: "" });
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const editingStrategyRow = p.strategies.find((row) => row.id === editingStrategy);
  const editingProcedureRow = p.recoveryProcedures.find((row) => row.id === editingProcedure);
  const visibleStrategies = p.strategies.filter((row) => (filterType === "ALL" || row.type === filterType) && (filterStatus === "ALL" || row.status === filterStatus) && matchesFilter(filterQuery, row.code, row.title, row.type, row.status, row.activity?.name));
  const visibleProcedures = p.recoveryProcedures.filter((row) => matchesFilter(filterQuery, row.code, row.title, row.activity?.name, row.responsible?.name));

  return <div style={{ display: "grid", gap: 16 }}>
    <ContinuityFilterBar query={filterQuery} onQueryChange={setFilterQuery} placeholder="Buscar estrategia o procedimiento…"><Picker className="nf-app-input" aria-label="Tipo de estrategia" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="ALL">Todos los tipos</option>{STRATEGY_TYPE_OPTIONS.map((value) => <option key={value} value={value}>{STRATEGY_TYPE[value]}</option>)}</Picker><Picker className="nf-app-input" aria-label="Estado de estrategia" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="ALL">Todos los estados</option>{Object.entries(STRATEGY_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</Picker></ContinuityFilterBar>
    <div>
      <IsoSectionHeader
        icon={ShieldCheck}
        title="Estrategias de continuidad"
        description="Selecciona y sigue las medidas que permiten alcanzar los objetivos de recuperación definidos."
        action={p.canCreate && <button type="button" className="nf-app-btn-ghost" onClick={() => setShowStrategy((v) => !v)}><Plus size={14} /> Nueva estrategia</button>}
      />
      <Modal open={showStrategy} onClose={() => setShowStrategy(false)} title="Nueva estrategia de continuidad" width={760}>
        <div style={{ display: "grid", gap: 12 }}>
        <input aria-label="Código" className="nf-app-input" placeholder="Código" value={strategy.code} onChange={(e) => setStrategy((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 110 }} />
        <input aria-label="Estrategia" className="nf-app-input" placeholder="Estrategia" value={strategy.title} onChange={(e) => setStrategy((f) => ({ ...f, title: e.target.value }))} style={{ maxWidth: 200 }} />
        <Picker aria-label="Actividad (opcional)" className="nf-app-input" value={strategy.activityId} onChange={(e) => setStrategy((f) => ({ ...f, activityId: e.target.value }))} style={{ maxWidth: 200 }}>
          <option value="">Actividad (opcional)…</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </Picker>
        <Picker aria-label="Tipo" className="nf-app-input" value={strategy.type} onChange={(e) => setStrategy((f) => ({ ...f, type: e.target.value }))} style={{ maxWidth: 160 }}>
          {STRATEGY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{STRATEGY_TYPE[t]}</option>)}
        </Picker>
        <input aria-label="RTO que logra" className="nf-app-input" type="number" min={0} placeholder="RTO que logra" value={strategy.achievesRtoMinutes} onChange={(e) => setStrategy((f) => ({ ...f, achievesRtoMinutes: e.target.value }))} style={{ maxWidth: 140 }} />
        <input aria-label="Coste" className="nf-app-input" type="number" min={0} placeholder="Coste" value={strategy.cost} onChange={(e) => setStrategy((f) => ({ ...f, cost: e.target.value }))} style={{ maxWidth: 110 }} />
        <textarea aria-label="Descripción" className="nf-app-input" rows={2} placeholder="Descripción" value={strategy.description} onChange={(e) => setStrategy((f) => ({ ...f, description: e.target.value }))} />
        <PersonPicker people={p.members} value={strategy.ownerId} onValueChange={(personId) => setStrategy((f) => ({ ...f, ownerId: personId }))} placeholder="Sin propietario" ariaLabel="Responsable" />
        <textarea aria-label="Recursos necesarios" className="nf-app-input" rows={2} placeholder="Recursos necesarios" value={strategy.resourcesNeeded} onChange={(e) => setStrategy((f) => ({ ...f, resourcesNeeded: e.target.value }))} />
        <textarea aria-label="Notas" className="nf-app-input" rows={2} placeholder="Notas" value={strategy.notes} onChange={(e) => setStrategy((f) => ({ ...f, notes: e.target.value }))} />
        <button type="button" className="nf-app-btn-primary" disabled={pending || !strategy.code.trim() || !strategy.title.trim()} onClick={() => onRun(() => createStrategy({
          code: requiredText(strategy.code, "El código", 60), title: requiredText(strategy.title, "El título", 200), activityId: assertOptions(strategy.activityId, p.activities.map((a) => a.id), "La actividad") || null, type: assertOptions(strategy.type, STRATEGY_TYPE_OPTIONS, "El tipo") as never,
          achievesRtoMinutes: optionalNumber(strategy.achievesRtoMinutes, "El RTO que logra"),
          achievesRpoMinutes: optionalNumber(strategy.achievesRpoMinutes, "El RPO que logra"),
          cost: optionalDecimal(strategy.cost, "El coste", Number.MAX_SAFE_INTEGER), description: optionalText(strategy.description, "La descripción", 8000) ?? null, ownerId: assertOptions(strategy.ownerId, p.members.map((m) => m.id), "El propietario") || null, resourcesNeeded: optionalText(strategy.resourcesNeeded, "Los recursos necesarios", 4000) ?? null, notes: optionalText(strategy.notes, "Las notas", 4000) ?? null,
        }), { onSuccess: () => { setStrategy({ code: "", title: "", activityId: "", type: "MITIGATE", achievesRtoMinutes: "", achievesRpoMinutes: "", cost: "", description: "", ownerId: "", resourcesNeeded: "", notes: "" }); setShowStrategy(false); }, successMessage: "Estrategia creada." })}>Crear estrategia</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowStrategy(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 960 }}>
        <thead><tr><th>Código</th><th>Estrategia</th><th>Tipo</th><th>Actividad</th><th>RTO que logra</th><th>Coste</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{visibleStrategies.map((s) => { const next = STRATEGY_NEXT[s.status]; return <tr key={s.id}>
          <td><strong>{s.code}</strong></td><td>{s.title}</td><td>{STRATEGY_TYPE[s.type] ?? s.type}</td>
          <td>{s.activity ? `${s.activity.code} · ${s.activity.name}` : "—"}</td>
          <td>{mins(s.achievesRtoMinutes)}</td><td>{s.cost != null ? s.cost.toLocaleString() : "—"}</td>
          <td><Badge value={STRATEGY_STATUS[s.status]?.label ?? s.status} tone={STRATEGY_STATUS[s.status]?.tone ?? "blue"} /></td>
          <td>{p.canUpdate && <><button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingStrategy(editingStrategy === s.id ? null : s.id); setStrategyEdit({ title: s.title, activityId: s.activity?.id ?? "", type: s.type, achievesRtoMinutes: s.achievesRtoMinutes != null ? String(s.achievesRtoMinutes) : "", achievesRpoMinutes: s.achievesRpoMinutes != null ? String(s.achievesRpoMinutes) : "", cost: s.cost != null ? String(s.cost) : "", description: s.description ?? "", ownerId: s.owner?.id ?? "", resourcesNeeded: "", notes: "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button> {next && <button type="button" className="nf-row-action" disabled={pending} onClick={() => onRun(() => setStrategyStatus({ id: s.id, status: next as never }), { successMessage: "Estado actualizado." })} data-nf-no-action-icon><ChevronRight size={14} strokeWidth={2} aria-hidden />{STRATEGY_NEXT_LABEL[next] ?? next}</button>} {s.status === "PROPOSED" && <button type="button" className="nf-row-action" data-tone="danger" disabled={pending} onClick={() => onRun(() => setStrategyStatus({ id: s.id, status: "REJECTED" }), { successMessage: "Estrategia rechazada." })} data-nf-no-action-icon><X size={14} strokeWidth={2} aria-hidden />Rechazar</button>} {s.status === "IMPLEMENTED" && <button type="button" className="nf-row-action" data-tone="danger" disabled={pending} onClick={() => onRun(() => setStrategyStatus({ id: s.id, status: "RETIRED" }), { successMessage: "Estrategia retirada." })} data-nf-no-action-icon><Ban size={14} strokeWidth={2} aria-hidden />Retirar</button>}</>}</td>
        </tr>; })}</tbody></table>
        <Modal open={Boolean(editingStrategyRow)} onClose={() => setEditingStrategy(null)} title={`Editar estrategia · ${editingStrategyRow?.code ?? ""}`} width={760}>
          <div style={{ display: "grid", gap: 12 }}><label>Título<input className="nf-app-input" maxLength={200} value={strategyEdit.title} onChange={(e) => setStrategyEdit((f) => ({ ...f, title: e.target.value }))} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>Actividad<Picker aria-label="Actividad" className="nf-app-input" value={strategyEdit.activityId} onChange={(e) => setStrategyEdit((f) => ({ ...f, activityId: e.target.value }))}><option value="">Sin actividad</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Picker></label><label>Tipo<Picker aria-label="Tipo" className="nf-app-input" value={strategyEdit.type} onChange={(e) => setStrategyEdit((f) => ({ ...f, type: e.target.value }))}>{STRATEGY_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{STRATEGY_TYPE[v]}</option>)}</Picker></label><label>Propietario<PersonPicker people={p.members} value={strategyEdit.ownerId} onValueChange={(personId) => setStrategyEdit((f) => ({ ...f, ownerId: personId }))} placeholder="Sin asignar" ariaLabel="Propietario" /></label></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>RTO que logra<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} value={strategyEdit.achievesRtoMinutes} onChange={(e) => setStrategyEdit((f) => ({ ...f, achievesRtoMinutes: e.target.value }))} /></label><label>RPO que logra<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} value={strategyEdit.achievesRpoMinutes} onChange={(e) => setStrategyEdit((f) => ({ ...f, achievesRpoMinutes: e.target.value }))} /></label><label>Coste<input className="nf-app-input" type="number" min={0} value={strategyEdit.cost} onChange={(e) => setStrategyEdit((f) => ({ ...f, cost: e.target.value }))} /></label></div><label>Descripción<textarea className="nf-app-input" maxLength={8000} rows={2} value={strategyEdit.description} onChange={(e) => setStrategyEdit((f) => ({ ...f, description: e.target.value }))} /></label><label>Recursos necesarios<textarea className="nf-app-input" maxLength={4000} rows={2} value={strategyEdit.resourcesNeeded} onChange={(e) => setStrategyEdit((f) => ({ ...f, resourcesNeeded: e.target.value }))} /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingStrategy(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingStrategyRow || !strategyEdit.title.trim()} onClick={() => editingStrategyRow && onRun(() => updateStrategy({ id: editingStrategyRow.id, title: requiredText(strategyEdit.title, "El título", 200), activityId: assertOptions(strategyEdit.activityId, p.activities.map((a) => a.id), "La actividad") || null, type: assertOptions(strategyEdit.type, STRATEGY_TYPE_OPTIONS, "El tipo") as never, achievesRtoMinutes: optionalNumber(strategyEdit.achievesRtoMinutes, "El RTO que logra"), achievesRpoMinutes: optionalNumber(strategyEdit.achievesRpoMinutes, "El RPO que logra"), cost: optionalDecimal(strategyEdit.cost, "El coste", Number.MAX_SAFE_INTEGER), description: optionalText(strategyEdit.description, "La descripción", 8000) ?? null, ownerId: assertOptions(strategyEdit.ownerId, p.members.map((m) => m.id), "El propietario") || null, resourcesNeeded: optionalText(strategyEdit.resourcesNeeded, "Los recursos necesarios", 4000) ?? null }), { onSuccess: () => setEditingStrategy(null), successMessage: "Estrategia actualizada." })}>Guardar cambios</button></div></div>
        </Modal>
        {!visibleStrategies.length && <div className="nf-data-table-empty">{p.strategies.length ? "No hay estrategias que coincidan con el filtro." : "Sin estrategias definidas."}</div>}
      </div>
    </div>
    <div>
      <IsoSectionHeader
        icon={PlayCircle}
        title="Procedimientos de recuperación"
        description="Mantén instrucciones ejecutables, responsables, prerrequisitos y versiones listas para una interrupción."
        action={p.canCreate && <button type="button" className="nf-app-btn-primary" onClick={() => setShowProcedure((v) => !v)}><Plus size={14} /> Nuevo procedimiento</button>}
      />
      <Modal open={showProcedure} onClose={() => setShowProcedure(false)} title="Nuevo procedimiento de recuperación" width={700}>
        <div style={{ display: "grid", gap: 12 }}>
        <input aria-label="Código" className="nf-app-input" placeholder="Código" value={procedure.code} onChange={(e) => setProcedure((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 110 }} />
        <input aria-label="Procedimiento" className="nf-app-input" placeholder="Procedimiento" value={procedure.title} onChange={(e) => setProcedure((f) => ({ ...f, title: e.target.value }))} style={{ maxWidth: 220 }} />
        <Picker aria-label="Actividad (opcional)" className="nf-app-input" value={procedure.activityId} onChange={(e) => setProcedure((f) => ({ ...f, activityId: e.target.value }))} style={{ maxWidth: 200 }}>
          <option value="">Actividad (opcional)…</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </Picker>
        <input aria-label="Duración estimada (min)" className="nf-app-input" type="number" min={0} placeholder="Duración estimada (min)" value={procedure.estimatedMinutes} onChange={(e) => setProcedure((f) => ({ ...f, estimatedMinutes: e.target.value }))} style={{ maxWidth: 180 }} />
        <textarea aria-label="Objetivo" className="nf-app-input" rows={2} placeholder="Objetivo" value={procedure.objective} onChange={(e) => setProcedure((f) => ({ ...f, objective: e.target.value }))} />
        <textarea aria-label="Pasos" className="nf-app-input" rows={3} placeholder="Pasos" value={procedure.steps} onChange={(e) => setProcedure((f) => ({ ...f, steps: e.target.value }))} />
        <textarea aria-label="Prerrequisitos" className="nf-app-input" rows={2} placeholder="Prerrequisitos" value={procedure.prerequisites} onChange={(e) => setProcedure((f) => ({ ...f, prerequisites: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}><PersonPicker people={p.members} value={procedure.responsibleId} onValueChange={(personId) => setProcedure((f) => ({ ...f, responsibleId: personId }))} placeholder="Sin responsable" ariaLabel="Responsable" /><input aria-label="Orden" className="nf-app-input" type="number" min={0} placeholder="Orden" value={procedure.order} onChange={(e) => setProcedure((f) => ({ ...f, order: e.target.value }))} /><input aria-label="Versión" className="nf-app-input" placeholder="Versión" value={procedure.version} onChange={(e) => setProcedure((f) => ({ ...f, version: e.target.value }))} /></div>
        <button type="button" className="nf-app-btn-primary" disabled={pending || !procedure.code.trim() || !procedure.title.trim()} onClick={() => onRun(() => createRecoveryProcedure({
          code: requiredText(procedure.code, "El código", 60), title: requiredText(procedure.title, "El título", 200), activityId: assertOptions(procedure.activityId, p.activities.map((a) => a.id), "La actividad") || null,
          estimatedMinutes: optionalNumber(procedure.estimatedMinutes, "La duración"), objective: optionalText(procedure.objective, "El objetivo", 4000) ?? null, steps: optionalText(procedure.steps, "Los pasos", 20000) ?? null, prerequisites: optionalText(procedure.prerequisites, "Los prerrequisitos", 4000) ?? null, responsibleId: assertOptions(procedure.responsibleId, p.members.map((m) => m.id), "El responsable") || null, order: optionalNumber(procedure.order, "El orden") ?? 0, version: requiredText(procedure.version, "La versión", 20),
        }), { onSuccess: () => { setProcedure({ code: "", title: "", activityId: "", estimatedMinutes: "", objective: "", steps: "", prerequisites: "", responsibleId: "", order: "0", version: "1.0" }); setShowProcedure(false); }, successMessage: "Procedimiento creado." })}>Crear procedimiento</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowProcedure(false)}>Cancelar</button></div>
        </div>
      </Modal>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 860 }}>
        <thead><tr><th>#</th><th>Código</th><th>Procedimiento</th><th>Actividad</th><th>Responsable</th><th>Duración</th><th>Versión</th><th>Acciones</th></tr></thead>
        <tbody>{visibleProcedures.map((r) => <tr key={r.id}>
          <td>{r.order}</td><td><strong>{r.code}</strong></td><td>{r.title}</td>
          <td>{r.activity ? r.activity.name : "—"}</td><td>{r.responsible?.name ?? "—"}</td>
          <td>{mins(r.estimatedMinutes)}</td><td>{r.version}</td><td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingProcedure(editingProcedure === r.id ? null : r.id); setProcedureEdit({ title: r.title, activityId: r.activity?.id ?? "", estimatedMinutes: r.estimatedMinutes != null ? String(r.estimatedMinutes) : "", objective: r.objective ?? "", steps: "", prerequisites: "", order: String(r.order), version: r.version }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
        </tr>)}</tbody></table>
        <Modal open={Boolean(editingProcedureRow)} onClose={() => setEditingProcedure(null)} title={`Editar procedimiento · ${editingProcedureRow?.code ?? ""}`} width={760}>
          <div style={{ display: "grid", gap: 12 }}><label>Título<input className="nf-app-input" maxLength={200} value={procedureEdit.title} onChange={(e) => setProcedureEdit((f) => ({ ...f, title: e.target.value }))} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>Actividad<Picker aria-label="Actividad" className="nf-app-input" value={procedureEdit.activityId} onChange={(e) => setProcedureEdit((f) => ({ ...f, activityId: e.target.value }))}><option value="">Sin actividad</option>{p.activities.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Picker></label><label>Duración<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} value={procedureEdit.estimatedMinutes} onChange={(e) => setProcedureEdit((f) => ({ ...f, estimatedMinutes: e.target.value }))} /></label><label>Versión<input className="nf-app-input" maxLength={20} value={procedureEdit.version} onChange={(e) => setProcedureEdit((f) => ({ ...f, version: e.target.value }))} /></label></div><label>Objetivo<textarea className="nf-app-input" maxLength={4000} rows={2} value={procedureEdit.objective} onChange={(e) => setProcedureEdit((f) => ({ ...f, objective: e.target.value }))} /></label><label>Pasos<textarea className="nf-app-input" maxLength={20000} rows={3} value={procedureEdit.steps} onChange={(e) => setProcedureEdit((f) => ({ ...f, steps: e.target.value }))} /></label><label>Prerrequisitos<textarea className="nf-app-input" maxLength={4000} rows={2} value={procedureEdit.prerequisites} onChange={(e) => setProcedureEdit((f) => ({ ...f, prerequisites: e.target.value }))} /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingProcedure(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingProcedureRow || !procedureEdit.title.trim()} onClick={() => editingProcedureRow && onRun(() => updateRecoveryProcedure({ id: editingProcedureRow.id, title: requiredText(procedureEdit.title, "El título", 200), activityId: assertOptions(procedureEdit.activityId, p.activities.map((a) => a.id), "La actividad") || null, estimatedMinutes: optionalNumber(procedureEdit.estimatedMinutes, "La duración"), objective: optionalText(procedureEdit.objective, "El objetivo", 4000) ?? null, steps: optionalText(procedureEdit.steps, "Los pasos", 20000) ?? null, prerequisites: optionalText(procedureEdit.prerequisites, "Los prerrequisitos", 4000) ?? null, order: optionalNumber(procedureEdit.order, "El orden") ?? 0, version: requiredText(procedureEdit.version, "La versión", 20) }), { onSuccess: () => setEditingProcedure(null), successMessage: "Procedimiento actualizado." })}>Guardar cambios</button></div></div>
        </Modal>
        {!visibleProcedures.length && <div className="nf-data-table-empty">{p.recoveryProcedures.length ? "No hay procedimientos que coincidan con el filtro." : "Sin procedimientos de recuperación."}</div>}
      </div>
    </div>
    <div>
      <IsoSectionHeader
        icon={History}
        title="Versiones y activaciones del plan"
        description="Conserva la trazabilidad de aprobaciones, cambios y activaciones operativas."
      />
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
            Activado {formatDateTime(a.activatedAt)} por {a.activatedBy?.name ?? "—"}
            {a.deactivatedAt && ` · cerrado ${formatDateTime(a.deactivatedAt)}`}
            {a.lessonsLearned && ` · Lecciones: ${a.lessonsLearned}`}
          </div>
        </div>)}
      </div>}
    </div>
  </div>;
}

const CONTACT_TYPE_OPTIONS = ["INTERNAL", "EXTERNAL", "SUPPLIER", "AUTHORITY", "CUSTOMER"] as const;

function CrisisTab({ p, pending, onRun }: { p: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [showTeam, setShowTeam] = useState(false);
  const [team, setTeam] = useState({ code: "", name: "", purpose: "", planId: "", leaderId: "", deputyId: "", activationRule: "", meetingPoint: "" });
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamEdit, setTeamEdit] = useState({ name: "", purpose: "", planId: "", leaderId: "", deputyId: "", activationRule: "", meetingPoint: "" });
  const [filterQuery, setFilterQuery] = useState("");
  const editingTeamRow = p.crisisTeams.find((row) => row.id === editingTeam);
  const visibleTeams = p.crisisTeams.filter((row) => matchesFilter(filterQuery, row.code, row.name, row.purpose, row.leader?.name, row.deputy?.name));

  return <div style={{ display: "grid", gap: 14 }}>
    <ContinuityFilterBar query={filterQuery} onQueryChange={setFilterQuery} placeholder="Buscar equipo, líder o propósito…" />
    <IsoSectionHeader
      icon={LifeBuoy}
      title="Equipos de crisis"
      description="Define roles, suplencias, reglas de activación y puntos de encuentro para responder coordinadamente."
      action={p.canCreate && <button type="button" className="nf-app-btn-primary" onClick={() => setShowTeam((v) => !v)}><Plus size={14} /> Nuevo equipo</button>}
    />
    <Modal open={showTeam} onClose={() => setShowTeam(false)} title="Nuevo equipo de crisis" width={700}>
      <div style={{ display: "grid", gap: 12 }}>
      <input aria-label="Código" className="nf-app-input" placeholder="Código" value={team.code} onChange={(e) => setTeam((f) => ({ ...f, code: e.target.value }))} style={{ maxWidth: 110 }} />
      <input aria-label="Nombre del equipo" className="nf-app-input" placeholder="Nombre del equipo" value={team.name} onChange={(e) => setTeam((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 200 }} />
      <input aria-label="Propósito" className="nf-app-input" placeholder="Propósito" value={team.purpose} onChange={(e) => setTeam((f) => ({ ...f, purpose: e.target.value }))} style={{ maxWidth: 220 }} />
      <Picker aria-label="Plan (opcional)" className="nf-app-input" value={team.planId} onChange={(e) => setTeam((f) => ({ ...f, planId: e.target.value }))} style={{ maxWidth: 200 }}>
        <option value="">Plan (opcional)…</option>{p.planStatus.map((pl) => <option key={pl.id} value={pl.id}>{pl.code}</option>)}
      </Picker>
      <PersonPicker people={p.members} value={team.leaderId} onValueChange={(personId) => setTeam((f) => ({ ...f, leaderId: personId }))} placeholder="Líder (opcional)…" ariaLabel="Líder (opcional)" style={{ maxWidth: 180 }} />
      <PersonPicker people={p.members} value={team.deputyId} onValueChange={(personId) => setTeam((f) => ({ ...f, deputyId: personId }))} placeholder="Suplente (opcional)…" ariaLabel="Suplente (opcional)" style={{ maxWidth: 180 }} />
      <input aria-label="Regla de activación" className="nf-app-input" placeholder="Regla de activación" value={team.activationRule} onChange={(e) => setTeam((f) => ({ ...f, activationRule: e.target.value }))} />
      <input aria-label="Punto de encuentro" className="nf-app-input" placeholder="Punto de encuentro" value={team.meetingPoint} onChange={(e) => setTeam((f) => ({ ...f, meetingPoint: e.target.value }))} />
      <button type="button" className="nf-app-btn-primary" disabled={pending || !team.code.trim() || !team.name.trim()} onClick={() => onRun(() => createCrisisTeam({
        code: requiredText(team.code, "El código", 60), name: requiredText(team.name, "El nombre", 200), purpose: optionalText(team.purpose, "El propósito", 4000), planId: assertOptions(team.planId, p.planStatus.map((pl) => pl.id), "El plan") || null, leaderId: assertOptions(team.leaderId, p.members.map((m) => m.id), "El líder") || null, deputyId: assertOptions(team.deputyId, p.members.map((m) => m.id), "El suplente") || null, activationRule: optionalText(team.activationRule, "La regla de activación", 4000) ?? null, meetingPoint: optionalText(team.meetingPoint, "El punto de encuentro", 400) ?? null,
      }), { onSuccess: () => { setTeam({ code: "", name: "", purpose: "", planId: "", leaderId: "", deputyId: "", activationRule: "", meetingPoint: "" }); setShowTeam(false); }, successMessage: "Equipo de crisis creado." })}>Crear equipo</button>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowTeam(false)}>Cancelar</button></div>
      </div>
    </Modal>

    {!visibleTeams.length && <div className="nf-data-table-empty">{p.crisisTeams.length ? "No hay equipos que coincidan con el filtro." : "Sin equipos de crisis definidos."}</div>}
    {visibleTeams.map((t) => <CrisisTeamCard key={t.id} team={t} p={p} pending={pending} onRun={onRun} onEdit={() => { setEditingTeam(t.id); setTeamEdit({ name: t.name, purpose: t.purpose ?? "", planId: t.planId ?? "", leaderId: t.leader?.id ?? "", deputyId: t.deputy?.id ?? "", activationRule: t.activationRule ?? "", meetingPoint: t.meetingPoint ?? "" }); }} />)}
    <Modal open={Boolean(editingTeamRow)} onClose={() => setEditingTeam(null)} title={`Editar equipo · ${editingTeamRow?.code ?? ""}`} width={720}>
      <div style={{ display: "grid", gap: 12 }}><label>Nombre<input className="nf-app-input" maxLength={200} value={teamEdit.name} onChange={(e) => setTeamEdit((f) => ({ ...f, name: e.target.value }))} /></label><label>Propósito<textarea className="nf-app-input" maxLength={4000} rows={2} value={teamEdit.purpose} onChange={(e) => setTeamEdit((f) => ({ ...f, purpose: e.target.value }))} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Plan<Picker aria-label="Plan" className="nf-app-input" value={teamEdit.planId} onChange={(e) => setTeamEdit((f) => ({ ...f, planId: e.target.value }))}><option value="">Sin plan</option>{p.planStatus.map((pl) => <option key={pl.id} value={pl.id}>{pl.code}</option>)}</Picker></label><label>Líder<PersonPicker people={p.members} value={teamEdit.leaderId} onValueChange={(personId) => setTeamEdit((f) => ({ ...f, leaderId: personId }))} placeholder="Sin asignar" ariaLabel="Líder" /></label><label>Suplente<PersonPicker people={p.members} value={teamEdit.deputyId} onValueChange={(personId) => setTeamEdit((f) => ({ ...f, deputyId: personId }))} placeholder="Sin asignar" ariaLabel="Suplente" /></label><label>Regla de activación<input className="nf-app-input" maxLength={4000} value={teamEdit.activationRule} onChange={(e) => setTeamEdit((f) => ({ ...f, activationRule: e.target.value }))} /></label></div><label>Punto de encuentro<input className="nf-app-input" maxLength={400} value={teamEdit.meetingPoint} onChange={(e) => setTeamEdit((f) => ({ ...f, meetingPoint: e.target.value }))} /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingTeam(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingTeamRow || !teamEdit.name.trim()} onClick={() => editingTeamRow && onRun(() => updateCrisisTeam({ id: editingTeamRow.id, name: requiredText(teamEdit.name, "El nombre", 200), purpose: optionalText(teamEdit.purpose, "El propósito", 4000) ?? null, planId: assertOptions(teamEdit.planId, p.planStatus.map((pl) => pl.id), "El plan") || null, leaderId: assertOptions(teamEdit.leaderId, p.members.map((m) => m.id), "El líder") || null, deputyId: assertOptions(teamEdit.deputyId, p.members.map((m) => m.id), "El suplente") || null, activationRule: optionalText(teamEdit.activationRule, "La regla de activación", 4000) ?? null, meetingPoint: optionalText(teamEdit.meetingPoint, "El punto de encuentro", 400) ?? null }), { onSuccess: () => setEditingTeam(null), successMessage: "Equipo actualizado." })}>Guardar cambios</button></div></div>
    </Modal>
  </div>;
}

function CrisisTeamCard({ team: t, p, pending, onRun, onEdit }: { team: ContinuityPayload["crisisTeams"][number]; p: ContinuityPayload; pending: boolean; onRun: ReturnType<typeof useServerAction>["run"]; onEdit: () => void }) {
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState({ name: "", role: "", type: "INTERNAL", primaryPhone: "", altPhone: "", email: "", escalationOrder: "0", isDeputy: false, availability: "", notes: "" });
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactEdit, setContactEdit] = useState({ name: "", role: "", type: "INTERNAL", primaryPhone: "", altPhone: "", email: "", escalationOrder: "0", isDeputy: false, availability: "", notes: "" });
  const [showNode, setShowNode] = useState(false);
  const [node, setNode] = useState({ contactId: "", parentId: "", label: "", audience: "", channel: "", messageTemplate: "", order: "0", maxDelayMinutes: "" });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [nodeEdit, setNodeEdit] = useState({ contactId: "", parentId: "", label: "", audience: "", channel: "", maxDelayMinutes: "" });
  const editingContactRow = t.contacts.find((row) => row.id === editingContact);
  const editingNodeRow = t.communicationTree.find((row) => row.id === editingNode);

  return <div style={{ border: "1px solid var(--nf-line)", borderRadius: 10, padding: 14 }}>
    <div><strong>{t.code} · {t.name}</strong>{p.canUpdate && <button type="button" className="nf-app-btn-ghost" style={{ marginLeft: 8 }} onClick={onEdit}>Editar equipo</button>}
      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>
        Líder: {t.leader?.name ?? "—"} · Suplente: {t.deputy?.name ?? "—"}
        {t.activationRule && ` · Se convoca: ${t.activationRule}`}
        {t.meetingPoint && ` · Punto de encuentro: ${t.meetingPoint}`}
      </div>
    </div>
    <div className="nf-data-table-wrap" style={{ marginTop: 10 }}><table className="nf-data-table" style={{ minWidth: 780 }}>
      <thead><tr><th>Orden</th><th>Contacto</th><th>Rol</th><th>Tipo</th><th>Teléfono</th><th>Alternativo</th><th>Email</th><th>Acciones</th></tr></thead>
      <tbody>{t.contacts.map((c) => <tr key={c.id}>
        <td>{c.escalationOrder}</td><td><strong>{c.name}</strong>{c.isDeputy && " (suplente)"}</td>
        <td>{c.role ?? "—"}</td><td>{c.type}</td>
        <td>{c.primaryPhone ?? "—"}</td><td>{c.altPhone ?? "—"}</td><td>{c.email ?? "—"}</td><td>{p.canUpdate && <button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => { setEditingContact(editingContact === c.id ? null : c.id); setContactEdit({ name: c.name, role: c.role ?? "", type: c.type, primaryPhone: c.primaryPhone ?? "", altPhone: c.altPhone ?? "", email: c.email ?? "", escalationOrder: String(c.escalationOrder), isDeputy: c.isDeputy, availability: "", notes: "" }); }}><Pencil size={14} strokeWidth={2} aria-hidden />Editar</button>}</td>
      </tr>)}</tbody></table>
      {!t.contacts.length && <div className="nf-data-table-empty">Sin contactos.</div>}
    </div>
    <Modal open={Boolean(editingContactRow)} onClose={() => setEditingContact(null)} title={`Editar contacto · ${editingContactRow?.name ?? ""}`} width={720}>
      <div style={{ display: "grid", gap: 12 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>Nombre<input className="nf-app-input" maxLength={200} value={contactEdit.name} onChange={(e) => setContactEdit((f) => ({ ...f, name: e.target.value }))} /></label><label>Rol<input className="nf-app-input" maxLength={160} value={contactEdit.role} onChange={(e) => setContactEdit((f) => ({ ...f, role: e.target.value }))} /></label><label>Tipo<Picker aria-label="Tipo" className="nf-app-input" value={contactEdit.type} onChange={(e) => setContactEdit((f) => ({ ...f, type: e.target.value }))}>{CONTACT_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</Picker></label></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><label>Teléfono<input className="nf-app-input" maxLength={60} value={contactEdit.primaryPhone} onChange={(e) => setContactEdit((f) => ({ ...f, primaryPhone: e.target.value }))} /></label><label>Alternativo<input className="nf-app-input" maxLength={60} value={contactEdit.altPhone} onChange={(e) => setContactEdit((f) => ({ ...f, altPhone: e.target.value }))} /></label><label>Email<input className="nf-app-input" type="email" maxLength={254} value={contactEdit.email} onChange={(e) => setContactEdit((f) => ({ ...f, email: e.target.value }))} /></label></div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Orden<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} value={contactEdit.escalationOrder} onChange={(e) => setContactEdit((f) => ({ ...f, escalationOrder: e.target.value }))} /></label><label>Disponibilidad<input className="nf-app-input" maxLength={400} value={contactEdit.availability} onChange={(e) => setContactEdit((f) => ({ ...f, availability: e.target.value }))} /></label></div><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={contactEdit.isDeputy} onChange={(e) => setContactEdit((f) => ({ ...f, isDeputy: e.target.checked }))} /> Suplente</label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingContact(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingContactRow || !contactEdit.name.trim()} onClick={() => editingContactRow && onRun(() => updateCrisisContact({ id: editingContactRow.id, name: requiredText(contactEdit.name, "El nombre", 200), role: optionalText(contactEdit.role, "El rol", 160) ?? null, type: assertOptions(contactEdit.type, CONTACT_TYPE_OPTIONS, "El tipo") as never, primaryPhone: optionalText(contactEdit.primaryPhone, "El teléfono", 60) ?? null, altPhone: optionalText(contactEdit.altPhone, "El teléfono alternativo", 60) ?? null, email: optionalEmail(contactEdit.email, "El email") ?? null, escalationOrder: optionalNumber(contactEdit.escalationOrder, "El orden") ?? 0, isDeputy: contactEdit.isDeputy, availability: optionalText(contactEdit.availability, "La disponibilidad", 400) ?? null }), { onSuccess: () => setEditingContact(null), successMessage: "Contacto actualizado." })}>Guardar cambios</button></div></div>
    </Modal>
    {p.canUpdate && <div style={{ marginTop: 8 }}>
      <button type="button" className="nf-app-btn-primary" onClick={() => setShowContact((v) => !v)}><Plus size={14} /> Nuevo contacto</button>
      <Modal open={showContact} onClose={() => setShowContact(false)} title={`Nuevo contacto · ${t.name}`} width={700}>
        <div style={{ display: "grid", gap: 12 }}>
        <input aria-label="Nombre" className="nf-app-input" placeholder="Nombre" maxLength={200} value={contact.name} onChange={(e) => setContact((f) => ({ ...f, name: e.target.value }))} style={{ maxWidth: 160 }} />
        <input aria-label="Rol" className="nf-app-input" placeholder="Rol" maxLength={160} value={contact.role} onChange={(e) => setContact((f) => ({ ...f, role: e.target.value }))} style={{ maxWidth: 140 }} />
        <Picker aria-label="Tipo" className="nf-app-input" value={contact.type} onChange={(e) => setContact((f) => ({ ...f, type: e.target.value }))} style={{ maxWidth: 130 }}>
          {CONTACT_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </Picker>
        <input aria-label="Teléfono" className="nf-app-input" placeholder="Teléfono" maxLength={60} value={contact.primaryPhone} onChange={(e) => setContact((f) => ({ ...f, primaryPhone: e.target.value }))} style={{ maxWidth: 140 }} />
        <input aria-label="Teléfono alternativo" className="nf-app-input" placeholder="Teléfono alternativo" maxLength={60} value={contact.altPhone} onChange={(e) => setContact((f) => ({ ...f, altPhone: e.target.value }))} style={{ maxWidth: 140 }} />
        <input aria-label="Email" className="nf-app-input" type="email" maxLength={254} placeholder="Email" value={contact.email} onChange={(e) => setContact((f) => ({ ...f, email: e.target.value }))} style={{ maxWidth: 180 }} />
        <input aria-label="Orden" className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} placeholder="Orden" value={contact.escalationOrder} onChange={(e) => setContact((f) => ({ ...f, escalationOrder: e.target.value }))} style={{ maxWidth: 90 }} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={contact.isDeputy} onChange={(e) => setContact((f) => ({ ...f, isDeputy: e.target.checked }))} /> Suplente</label>
        <input aria-label="Disponibilidad" className="nf-app-input" placeholder="Disponibilidad" maxLength={400} value={contact.availability} onChange={(e) => setContact((f) => ({ ...f, availability: e.target.value }))} />
        <button type="button" className="nf-app-btn-primary" disabled={pending || !contact.name.trim()} onClick={() => onRun(() => addCrisisContact({
          teamId: t.id, name: requiredText(contact.name, "El nombre", 200), role: optionalText(contact.role, "El rol", 160), type: assertOptions(contact.type, CONTACT_TYPE_OPTIONS, "El tipo") as never,
          primaryPhone: optionalText(contact.primaryPhone, "El teléfono", 60), altPhone: optionalText(contact.altPhone, "El teléfono alternativo", 60), email: optionalEmail(contact.email, "El email"), escalationOrder: optionalNumber(contact.escalationOrder, "El orden") ?? 0, isDeputy: contact.isDeputy, availability: optionalText(contact.availability, "La disponibilidad", 400), notes: optionalText(contact.notes, "Las notas", 2000),
        }), { onSuccess: () => { setContact({ name: "", role: "", type: "INTERNAL", primaryPhone: "", altPhone: "", email: "", escalationOrder: "0", isDeputy: false, availability: "", notes: "" }); setShowContact(false); }, successMessage: "Contacto añadido." })}>Crear contacto</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowContact(false)}>Cancelar</button></div>
        </div>
      </Modal>
    </div>}
    {(t.communicationTree.length > 0 || (p.canUpdate && t.contacts.length > 0)) && <section className="nf-communication-tree">
      <div className="nf-communication-tree-header">
        <div className="nf-communication-tree-heading">
          <div className="nf-communication-tree-icon"><GitBranch size={17} aria-hidden /></div>
          <div>
            <div className="nf-communication-tree-title">Árbol de comunicación</div>
            <div className="nf-communication-tree-subtitle">Visualiza la cascada de avisos y el orden de escalamiento.</div>
          </div>
        </div>
        <div className="nf-communication-tree-header-actions">
          <span className="nf-communication-tree-count"><UsersRound size={13} aria-hidden /> {t.communicationTree.length} {t.communicationTree.length === 1 ? "nodo" : "nodos"}</span>
          {p.canUpdate && t.contacts.length > 0 && <button type="button" className="nf-app-btn-primary nf-app-btn-sm" onClick={() => setShowNode((v) => !v)}><Plus size={14} /> Nuevo nodo</button>}
        </div>
      </div>
      {t.communicationTree.length > 0 ? <div className="nf-communication-tree-canvas">
        <div className="nf-communication-tree-caption"><span>SECUENCIA DE ESCALAMIENTO</span><span>{t.communicationTree.filter((n) => !n.parentId).length} raíz{t.communicationTree.filter((n) => !n.parentId).length === 1 ? "" : "ces"}</span></div>
        <div className="nf-communication-tree-roots">
          {t.communicationTree.filter((n) => !n.parentId).map((root) => <CommNode key={root.id} node={root} all={t.communicationTree} contacts={t.contacts} depth={0} canUpdate={p.canUpdate} onEdit={(n) => { setEditingNode(n.id); setNodeEdit({ contactId: n.contactId ?? "", parentId: n.parentId ?? "", label: n.label, audience: n.audience ?? "", channel: n.channel ?? "", maxDelayMinutes: n.maxDelayMinutes != null ? String(n.maxDelayMinutes) : "" }); }} />)}
        </div>
      </div> : <div className="nf-communication-tree-empty"><div className="nf-communication-tree-empty-icon"><GitBranch size={18} aria-hidden /></div><div><strong>El árbol aún está vacío</strong><span>Añade un nodo raíz para comenzar la cascada de comunicación.</span></div></div>}
    </section>}
    <Modal open={Boolean(editingNodeRow)} onClose={() => setEditingNode(null)} title={`Editar nodo · ${editingNodeRow?.label ?? ""}`} width={700}>
      <div style={{ display: "grid", gap: 12 }}><label>Etiqueta<input className="nf-app-input" maxLength={200} value={nodeEdit.label} onChange={(e) => setNodeEdit((f) => ({ ...f, label: e.target.value }))} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><label>Contacto<Picker aria-label="Contacto" className="nf-app-input" value={nodeEdit.contactId} onChange={(e) => setNodeEdit((f) => ({ ...f, contactId: e.target.value }))}><option value="">Sin contacto</option>{t.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Picker></label><label>Canal<input className="nf-app-input" maxLength={120} value={nodeEdit.channel} onChange={(e) => setNodeEdit((f) => ({ ...f, channel: e.target.value }))} /></label></div><label>Audiencia<input className="nf-app-input" maxLength={400} value={nodeEdit.audience} onChange={(e) => setNodeEdit((f) => ({ ...f, audience: e.target.value }))} /></label><label>Demora máxima (min)<input className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} value={nodeEdit.maxDelayMinutes} onChange={(e) => setNodeEdit((f) => ({ ...f, maxDelayMinutes: e.target.value }))} /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setEditingNode(null)}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !editingNodeRow || !nodeEdit.label.trim()} onClick={() => editingNodeRow && onRun(() => updateCommunicationNode({ id: editingNodeRow.id, contactId: assertOptions(nodeEdit.contactId, t.contacts.map((c) => c.id), "El contacto") || null, parentId: nodeEdit.parentId || null, label: requiredText(nodeEdit.label, "La etiqueta", 200), audience: optionalText(nodeEdit.audience, "La audiencia", 400) ?? null, channel: optionalText(nodeEdit.channel, "El canal", 120) ?? null, maxDelayMinutes: optionalNumber(nodeEdit.maxDelayMinutes, "La demora máxima") }), { onSuccess: () => setEditingNode(null), successMessage: "Nodo actualizado." })}>Guardar cambios</button></div></div>
    </Modal>
    {p.canUpdate && t.contacts.length > 0 && <div>
      <Modal open={showNode} onClose={() => setShowNode(false)} title={`Nuevo nodo de comunicación · ${t.name}`} width={700}>
        <div style={{ display: "grid", gap: 12 }}>
        <input aria-label="Etiqueta" className="nf-app-input" placeholder="Etiqueta" maxLength={200} value={node.label} onChange={(e) => setNode((f) => ({ ...f, label: e.target.value }))} style={{ maxWidth: 180 }} />
        <Picker aria-label="Contacto (opcional)" className="nf-app-input" value={node.contactId} onChange={(e) => setNode((f) => ({ ...f, contactId: e.target.value }))} style={{ maxWidth: 160 }}>
          <option value="">Contacto (opcional)…</option>{t.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Picker>
        <Picker aria-label="Nodo padre (raíz si vacío)" className="nf-app-input" value={node.parentId} onChange={(e) => setNode((f) => ({ ...f, parentId: e.target.value }))} style={{ maxWidth: 180 }}>
          <option value="">Nodo padre (raíz si vacío)…</option>{t.communicationTree.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </Picker>
        <input aria-label="Canal (teléfono, email…)" className="nf-app-input" placeholder="Canal (teléfono, email…)" maxLength={120} value={node.channel} onChange={(e) => setNode((f) => ({ ...f, channel: e.target.value }))} style={{ maxWidth: 180 }} />
        <input aria-label="Audiencia" className="nf-app-input" placeholder="Audiencia" maxLength={400} value={node.audience} onChange={(e) => setNode((f) => ({ ...f, audience: e.target.value }))} />
        <textarea aria-label="Plantilla del mensaje" className="nf-app-input" maxLength={8000} rows={2} placeholder="Plantilla del mensaje" value={node.messageTemplate} onChange={(e) => setNode((f) => ({ ...f, messageTemplate: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Orden" className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} placeholder="Orden" value={node.order} onChange={(e) => setNode((f) => ({ ...f, order: e.target.value }))} /><input aria-label="Demora máxima (min)" className="nf-app-input" type="number" min={0} max={MAX_MINUTES} step={1} placeholder="Demora máxima (min)" value={node.maxDelayMinutes} onChange={(e) => setNode((f) => ({ ...f, maxDelayMinutes: e.target.value }))} /></div>
        <button type="button" className="nf-app-btn-primary" disabled={pending || !node.label.trim()} onClick={() => onRun(() => addCommunicationNode({
          teamId: t.id, contactId: assertOptions(node.contactId, t.contacts.map((c) => c.id), "El contacto") || null, parentId: assertOptions(node.parentId, t.communicationTree.map((n) => n.id), "El nodo padre") || null, label: requiredText(node.label, "La etiqueta", 200), audience: optionalText(node.audience, "La audiencia", 400) ?? null, channel: optionalText(node.channel, "El canal", 120), messageTemplate: optionalText(node.messageTemplate, "La plantilla del mensaje", 8000) ?? null, order: optionalNumber(node.order, "El orden") ?? 0, maxDelayMinutes: optionalNumber(node.maxDelayMinutes, "La demora máxima"),
        }), { onSuccess: () => { setNode({ contactId: "", parentId: "", label: "", audience: "", channel: "", messageTemplate: "", order: "0", maxDelayMinutes: "" }); setShowNode(false); }, successMessage: "Nodo añadido." })}>Crear nodo</button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="nf-app-btn-ghost" onClick={() => setShowNode(false)}>Cancelar</button></div>
        </div>
      </Modal>
    </div>}
  </div>;
}

function CommNode({ node, all, contacts, depth, canUpdate, onEdit }: { node: ContinuityPayload["crisisTeams"][number]["communicationTree"][number]; all: ContinuityPayload["crisisTeams"][number]["communicationTree"]; contacts: ContinuityPayload["crisisTeams"][number]["contacts"]; depth: number; canUpdate: boolean; onEdit: (node: ContinuityPayload["crisisTeams"][number]["communicationTree"][number]) => void }) {
  const children = all.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);
  const contact = node.contactId ? contacts.find((candidate) => candidate.id === node.contactId) : undefined;
  const channel = node.channel?.toLocaleLowerCase() ?? "";
  const ChannelIcon = channel.includes("mail") || channel.includes("email") ? Mail : channel.includes("radio") || channel.includes("whatsapp") ? Radio : Phone;
  return <div className={`nf-communication-node nf-communication-node--depth-${Math.min(depth, 4)}`}>
    <article className="nf-communication-node-card">
      <div className="nf-communication-node-topline">
        <span className="nf-communication-node-level">Nivel {depth + 1}</span>
        {node.maxDelayMinutes != null && <span className="nf-communication-node-delay"><Clock3 size={12} aria-hidden /> ≤{node.maxDelayMinutes} min</span>}
      </div>
      <div className="nf-communication-node-main">
        <div className="nf-communication-node-avatar"><UserRound size={17} aria-hidden /></div>
        <div className="nf-communication-node-copy">
          <strong className="nf-communication-node-label">{node.label}</strong>
          {contact ? <span className="nf-communication-node-contact">{contact.name}{contact.role ? ` · ${contact.role}` : ""}</span> : <span className="nf-communication-node-contact">Contacto pendiente de asignar</span>}
        </div>
        {canUpdate && <button type="button" className="nf-communication-node-edit" onClick={() => onEdit(node)}>Editar</button>}
      </div>
      {(node.audience || node.channel) && <div className="nf-communication-node-meta">
        {node.channel && <span><ChannelIcon size={13} aria-hidden /> {node.channel}</span>}
        {node.audience && <span><UsersRound size={13} aria-hidden /> {node.audience}</span>}
      </div>}
    </article>
    {children.length > 0 && <div className="nf-communication-node-children">
      {children.map((child) => <CommNode key={child.id} node={child} all={all} contacts={contacts} depth={depth + 1} canUpdate={canUpdate} onEdit={onEdit} />)}
    </div>}
  </div>;
}

function GapsTab({ p }: { p: ContinuityPayload }) {
  const [filterQuery, setFilterQuery] = useState("");
  const [filterKind, setFilterKind] = useState("ALL");
  const visibleGaps = p.gaps.filter((gap) => (filterKind === "ALL" || gap.kind === filterKind) && matchesFilter(filterQuery, gap.activityName, GAP_LABEL[gap.kind], gap.detail));
  if (!p.gaps.length) return <div className="nf-data-table-empty">Sin brechas de continuidad detectadas. Preparación {p.bcmSummary.readiness}%.</div>;
  return <div>
    <ContinuityFilterBar query={filterQuery} onQueryChange={setFilterQuery} placeholder="Buscar actividad o detalle…"><Picker className="nf-app-input" aria-label="Tipo de brecha" value={filterKind} onChange={(e) => setFilterKind(e.target.value)}><option value="ALL">Todas las brechas</option>{Object.entries(GAP_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Picker></ContinuityFilterBar>
    <div style={{ marginBottom: 10, fontSize: 13, color: "var(--nf-ink-2)" }}>
      Grado de preparación <strong>{p.bcmSummary.readiness}%</strong> · {visibleGaps.length} brecha(s) visible(s) de {p.gaps.length} detectada(s) sobre {p.bcmSummary.activities} actividad(es).
    </div>
    <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 780 }}>
      <thead><tr><th>Actividad</th><th>Brecha</th><th>Detalle</th></tr></thead>
      <tbody>{visibleGaps.map((g, i) => <tr key={`${g.activityId}-${g.kind}-${i}`}>
        <td>{g.activityName}</td>
        <td><Badge value={GAP_LABEL[g.kind] ?? g.kind} tone={g.kind === "SPOF" || g.kind === "RTO_EXCEEDS_MTPD" ? "red" : "amber"} /></td>
        <td style={{ fontSize: 12 }}>{g.detail}</td>
      </tr>)}</tbody></table>{!visibleGaps.length && <div className="nf-data-table-empty">No hay brechas que coincidan con el filtro.</div>}</div>
  </div>;
}
