"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Grid3x3, Scale, Target, BarChart3, Trash2, Siren, LayoutDashboard, Trees, Search, X, Pencil, ClipboardCheck, Plus, FolderPlus, ListChecks } from "lucide-react";
import type { EnvironmentPayload } from "@/lib/environmental/queries";
import {
  createAspect, updateAspect, deleteAspect, createImpact, updateImpact, deleteImpact, recomputeSignificance,
  createObligation, updateObligation, createComplianceEvaluation,
  createObjective, updateObjective, createProgram, updateProgram, deleteProgram, createWasteStream, updateWasteStream, deleteWasteStream, createEmergencyScenario, updateEmergencyScenario, deleteEmergencyScenario, createSignificanceMethod, upsertMetric,
  createBiodiversityRecord, updateBiodiversityRecord, deleteBiodiversityRecord,
} from "@/lib/actions/environment";
import { useModuleSection } from "@/hooks/useModuleSection";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { toneChip } from "@/lib/tone";

type Tab = "panel" | "matrix" | "compliance" | "objectives" | "trends" | "waste" | "emergencies" | "biodiversity";
const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Gestión Ambiental", sub: "ISO 14001:2015 — aspectos, cumplimiento, objetivos, indicadores y emergencias." }, matrix: { title: "Aspectos e impactos", sub: "Matriz de aspectos ambientales, impactos y significancia." }, compliance: { title: "Cumplimiento legal", sub: "Obligaciones ambientales aplicables y evaluación de cumplimiento." }, objectives: { title: "Objetivos", sub: "Objetivos ambientales, metas, programas y seguimiento." }, trends: { title: "Indicadores", sub: "Indicadores ambientales y tendencias de desempeño." }, waste: { title: "Residuos", sub: "Flujos, clasificación y gestión de residuos." }, emergencies: { title: "Emergencias", sub: "Escenarios de emergencia ambiental y preparación." }, biodiversity: { title: "Biodiversidad", sub: "Aspectos, impactos y acciones relacionados con biodiversidad." },
};

const LEVEL_COLORS: Record<string, string> = {
  LOW: "var(--nf-success)", MODERATE: "#d68a1a", HIGH: "#ea580c", CRITICAL: "var(--nf-danger-text)",
};
const CONDITION_LABEL: Record<string, string> = { NORMAL: "Normal", ABNORMAL: "Anormal", EMERGENCY: "Emergencia" };
const WASTE_LABEL: Record<string, string> = { NON_HAZARDOUS: "No peligroso", HAZARDOUS: "Peligroso", RECYCLABLE: "Reciclable", INERT: "Inerte", SPECIAL: "Especial" };
const BIODIVERSITY_STATUS_LABEL: Record<string, string> = { IDENTIFIED: "Identificado", MONITORING: "En monitoreo", MITIGATED: "Mitigado", CLOSED: "Cerrado" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--nf-text-secondary)", borderBottom: "1px solid var(--nf-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
type EnvironmentConfirm = { title: string; message: string; onConfirm: () => void };

export default function EnvironmentClient({ initial, demo = false }: { initial: EnvironmentPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aspectEditor, setAspectEditor] = useState<EnvironmentPayload["aspects"][number] | "new" | null>(null);
  const [impactEditor, setImpactEditor] = useState<{ aspectId: string; impact?: EnvironmentPayload["aspects"][number]["impacts"][number] } | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [methodCreateOpen, setMethodCreateOpen] = useState(false);
  const [obligationCreateOpen, setObligationCreateOpen] = useState(false);
  const [obligationEditor, setObligationEditor] = useState<EnvironmentPayload["obligations"][number] | null>(null);
  const [evaluationObligation, setEvaluationObligation] = useState<EnvironmentPayload["obligations"][number] | null>(null);
  const [objectiveCreateOpen, setObjectiveCreateOpen] = useState(false);
  const [objectiveEditor, setObjectiveEditor] = useState<EnvironmentPayload["objectives"][number] | null>(null);
  const [programCreateOpen, setProgramCreateOpen] = useState(false);
  const [programObjectiveId, setProgramObjectiveId] = useState<string | undefined>();
  const [programEditor, setProgramEditor] = useState<EnvironmentPayload["objectives"][number]["programs"][number] | null>(null);
  const [metricCreateOpen, setMetricCreateOpen] = useState(false);
  const [wasteCreateOpen, setWasteCreateOpen] = useState(false);
  const [wasteEditor, setWasteEditor] = useState<EnvironmentPayload["waste"][number] | null>(null);
  const [emergencyCreateOpen, setEmergencyCreateOpen] = useState(false);
  const [emergencyEditor, setEmergencyEditor] = useState<EnvironmentPayload["emergencies"][number] | null>(null);
  const [biodiversityCreateOpen, setBiodiversityCreateOpen] = useState(false);
  const [biodiversityEditor, setBiodiversityEditor] = useState<EnvironmentPayload["biodiversity"][number] | null>(null);
  const [confirmAction, setConfirmAction] = useState<EnvironmentConfirm | null>(null);
  const [tableQueries, setTableQueries] = useState<Partial<Record<Tab, string>>>({});
  const [aspectCreateRequested, clearAspectCreate] = useCreateRequest("Nuevo aspecto ambiental");
  const canManage = initial.canManage && !demo;
  const canUpdate = initial.canUpdate && !demo;
  const canDelete = initial.canDelete && !demo;
  const tableQuery = tableQueries[tab] ?? "";
  const setTableQuery = (value: string) => setTableQueries((current) => ({ ...current, [tab]: value }));

  useEffect(() => {
    if (aspectCreateRequested) {
      setAspectEditor("new");
      clearAspectCreate();
    }
  }, [aspectCreateRequested, clearAspectCreate]);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const s = initial.summary;
  const matchesQuery = (values: unknown[]) => {
    const query = tableQuery.trim().toLocaleLowerCase();
    return !query || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
  };

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--nf-success-border)", display: "grid", placeItems: "center" }}>
          <Leaf size={22} color="#16a34a" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{SECTION_META[tab].title}</h1>
          <p style={{ margin: 0, color: "var(--nf-text-secondary)", fontSize: 13 }}>{SECTION_META[tab].sub}</p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Stat label="Aspectos" value={s.aspects} />
        <Stat label="Impactos" value={s.impacts} />
        <Stat label="Significativos" value={s.significant} accent="var(--nf-danger-text)" />
        <Stat label="Obligaciones" value={s.obligations} />
        <Stat label="Vencidas" value={s.overdue} accent={s.overdue ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Objetivos" value={s.objectives} />
        <Stat label="Biodiversidad" value={s.biodiversity} />
      </div> : <IsoSectionMetrics items={tab === "matrix" ? [{ label: "Aspectos", value: s.aspects }, { label: "Impactos", value: s.impacts }, { label: "Significativos", value: s.significant, accent: s.significant ? "var(--nf-danger-text)" : undefined }] : tab === "compliance" ? [{ label: "Obligaciones", value: s.obligations }, { label: "Vencidas", value: s.overdue, accent: s.overdue ? "var(--nf-danger-text)" : undefined }, { label: "No conformes", value: s.nonCompliant, accent: s.nonCompliant ? "var(--nf-danger-text)" : undefined }] : tab === "objectives" ? [{ label: "Objetivos", value: s.objectives }, { label: "Aspectos significativos", value: s.significant }, { label: "Emergencias", value: s.emergencies }] : tab === "trends" ? [{ label: "Indicadores", value: s.metrics }, { label: "Periodos medidos", value: s.measuredPeriods }, { label: "Significativos", value: s.significant }] : tab === "waste" ? [{ label: "Flujos de residuos", value: s.waste }, { label: "Aspectos", value: s.aspects }, { label: "Emergencias", value: s.emergencies }] : tab === "emergencies" ? [{ label: "Emergencias", value: s.emergencies }, { label: "Vencimientos", value: s.overdue, accent: s.overdue ? "var(--nf-danger-text)" : undefined }, { label: "Objetivos", value: s.objectives }] : [{ label: "Biodiversidad", value: s.biodiversity }, { label: "Aspectos", value: s.aspects }, { label: "Significativos", value: s.significant, accent: s.significant ? "var(--nf-danger-text)" : undefined }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen ambiental</strong><span>Acceso directo a la matriz de aspectos e impactos.</span></div><IsoQuickCreate modulePath="/app/environment" items={[{ label: "Nuevo aspecto ambiental", description: "Abrir la matriz ambiental", section: "matrix", Icon: Grid3x3 }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Grid3x3 size={16} aria-hidden />Metodología de significancia</h3>
            {initial.methods.length === 0 && <p style={{ color: "var(--nf-text-secondary)" }}>Sin metodología definida.</p>}
            {initial.methods.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span>{m.name} <span style={{ color: "var(--nf-text-subtle)" }}>v{m.version}</span></span>
                <span>{m.active ? <span style={chip("var(--nf-success-border)", "var(--nf-success-text)")}>activa</span> : <span style={chip("#f1f5f9", "#64748b")}>histórico</span>}</span>
              </div>
            ))}
            {canManage && <>
              <button disabled={pending} style={btn} onClick={() => setMethodCreateOpen(true)}>
                + Nueva versión de metodología
              </button>
              <Modal open={methodCreateOpen} onClose={() => setMethodCreateOpen(false)} title="Nueva versión de metodología" width={560}>
                <div className="nf-modal-form">
                  <p style={{ margin: 0, color: "var(--nf-text-secondary)", fontSize: 13 }}>Se creará una nueva versión de la metodología estándar de significancia ambiental.</p>
                  <div className="nf-modal-actions">
                    <button type="button" className="nf-app-btn-ghost" onClick={() => setMethodCreateOpen(false)}>Cancelar</button>
                    <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => { run(async () => { await createSignificanceMethod({ name: "Método de significancia ambiental", formula: "WEIGHTED_SUM", weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12 }); setMethodCreateOpen(false); }); }}>Crear metodología</button>
                  </div>
                </div>
              </Modal>
            </>}
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Scale size={16} aria-hidden />Cumplimiento</h3>
            <p style={{ margin: "4px 0" }}>Obligaciones vencidas: <b style={{ color: s.overdue ? "var(--nf-danger-text)" : "var(--nf-success-text)" }}>{s.overdue}</b></p>
            <p style={{ margin: "4px 0" }}>No conformes / parciales: <b style={{ color: s.nonCompliant ? "var(--nf-danger-text)" : "var(--nf-success-text)" }}>{s.nonCompliant}</b></p>
            <p style={{ margin: "4px 0", color: "var(--nf-text-secondary)" }}>Residuos: {s.waste} · Escenarios de emergencia: {s.emergencies}</p>
          </div>
          </div>
        </>
      )}

      {tab === "matrix" && (
        <div style={{ ...card, display: "grid", gap: 12 }}>
          <IsoSectionHeader icon={Grid3x3} title="Matriz de aspectos e impactos" description="Relaciona actividades, condiciones operativas, impactos y controles para determinar la significancia ambiental." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setAspectEditor("new")}>Nuevo aspecto ambiental</button>} />
          <EnvironmentTable
            headers={["Código", "Actividad", "Condición", "Ciclo de vida", "Impacto", "S/F/A", "Valor", "Nivel", "Significativo", (canManage || canUpdate || canDelete) ? "Acciones de impacto" : "", (canUpdate || canDelete) ? "Acciones de aspecto" : ""].filter(Boolean) as string[]}
            query={tableQuery}
            onQueryChange={setTableQuery}
            placeholder="Buscar aspecto, actividad o impacto…"
            exportName="aspectos-impactos"
            hideHeading
          >
            <thead><tr>
                <th style={th}>Código</th><th style={th}>Actividad</th><th style={th}>Condición</th><th style={th}>Ciclo de vida</th>
                <th style={th}>Impacto</th><th style={th}>S/F/A</th><th style={th}>Valor</th><th style={th}>Nivel</th><th style={th}>Significativo</th>{(canManage || canUpdate || canDelete) && <th style={th}>Acciones de impacto</th>}{(canUpdate || canDelete) && <th style={th}>Acciones de aspecto</th>}
              </tr></thead>
              <tbody>
                {initial.aspects.filter((a) => matchesQuery([a.code, a.activity, a.condition, a.lifeCycleStage, ...a.impacts.flatMap((impact) => [impact.impactType, impact.level])])).flatMap((a) => (a.impacts.length ? a.impacts : [null]).map((i, k) => (
                  <tr key={a.id + "-" + k}>
                    <td style={td}>{a.code}</td>
                    <td style={td}>{a.activity}</td>
                    <td style={td}>{CONDITION_LABEL[a.condition] ?? a.condition}</td>
                    <td style={td}>{a.lifeCycleStage ?? "—"}</td>
                    <td style={td}>{i?.impactType ?? "—"}</td>
                    <td style={td}>{i ? `${i.severity}/${i.frequency}/${i.scope}` : "—"}</td>
                    <td style={td}>{i?.score ?? "—"}</td>
                    <td style={td}>{i ? <span style={toneChip(LEVEL_COLORS[i.level])}>{i.level}</span> : "—"}</td>
                    <td style={td}>{i?.significant ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Sí</span> : "No"}</td>
                    {(canManage || canUpdate || canDelete) && <td style={td}>{i && canUpdate && <EnvTableAction icon={Pencil} onClick={() => setImpactEditor({ aspectId: a.id, impact: i })}>Editar</EnvTableAction>} {i && canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar impacto ambiental", message: "¿Quieres eliminar este impacto ambiental? Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteImpact(i.id)) })}>Eliminar</EnvTableAction>} {!i && canManage && <EnvTableAction icon={Plus} onClick={() => setImpactEditor({ aspectId: a.id })}>Añadir</EnvTableAction>}</td>}{(canUpdate || canDelete) && k === 0 && <td style={td} rowSpan={a.impacts.length || 1}>{canUpdate && <EnvTableAction icon={Pencil} onClick={() => setAspectEditor(a)}>Editar</EnvTableAction>} {canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar aspecto ambiental", message: "Se eliminará el aspecto y sus impactos asociados. Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteAspect(a.id)) })}>Eliminar</EnvTableAction>}</td>}
                  </tr>
                )))}
                {initial.aspects.length === 0 && <tr><td style={td} colSpan={(canManage || canUpdate || canDelete) ? 11 : 9}>Sin aspectos registrados.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <AspectEditor key={aspectEditor === "new" ? "new" : aspectEditor?.id ?? "none"} value={aspectEditor} onClose={() => setAspectEditor(null)} pending={pending} onSave={(value) => run(async () => {
            const { id, ...payload } = value;
            if (id) await updateAspect(id, payload); else await createAspect(payload);
            setAspectEditor(null);
          })} />
          <ImpactEditor value={impactEditor} pending={pending} onClose={() => setImpactEditor(null)} onSave={(payload) => run(async () => { const { id, ...data } = payload; const normalized = { ...data, severity: Number(data.severity), frequency: Number(data.frequency), scope: Number(data.scope), controlEffectiveness: data.controlEffectiveness ? Number(data.controlEffectiveness) : undefined }; if (id) await updateImpact(id, normalized); else await createImpact(normalized); setImpactEditor(null); })} />
          {canUpdate && <button type="button" style={btn} disabled={pending} onClick={() => run(async () => { setRecomputing(true); try { await recomputeSignificance(); } finally { setRecomputing(false); } })}>{recomputing ? "Recalculando…" : "Recalcular significancia"}</button>}
        </div>
      )}

      {tab === "compliance" && (
        <div style={{ ...card, display: "grid", gap: 14 }}>
          <IsoSectionHeader icon={Scale} title="Obligaciones ambientales" description="Requisitos aplicables, responsables, fechas de revisión y evaluaciones de cumplimiento." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setObligationCreateOpen(true)}>Nueva obligación</button>} />
          <IsoTableCard
            title="Registro legal ambiental"
            description="Busca por código, fuente, obligación o estado. Evalúa cada requisito desde su fila."
            headers={["Código", "Fuente", "Obligación", "Últ. resultado", "Próx. revisión", "Estado", "Acciones"]}
            hideHeading
          >
            {initial.obligations.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.source}</td>
                <td style={td}>{o.obligation}</td>
                <td style={td}>{o.lastResult ?? "Sin evaluar"}</td>
                <td style={td}>{fmt(o.reviewDate)}</td>
                <td style={td}>
                  {o.overdue && <span style={{ ...chip("var(--nf-danger-border)", "var(--nf-danger-text)"), marginRight: 4 }}>Vencido</span>}
                  {o.nonCompliant && <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Incumple</span>}
                  {!o.overdue && !o.nonCompliant && <span style={chip("var(--nf-success-border)", "var(--nf-success-text)")}>Al día</span>}
                </td>
                <td style={td}>{canUpdate && <EnvTableAction icon={Pencil} onClick={() => setObligationEditor(o)}>Editar</EnvTableAction>} {canManage && <EnvTableAction icon={ClipboardCheck} onClick={() => setEvaluationObligation(o)}>Evaluar</EnvTableAction>}</td>
              </tr>
            ))}
            {initial.obligations.length === 0 && <tr><td style={td} colSpan={7}>Sin obligaciones registradas.</td></tr>}
          </IsoTableCard>
          <Modal open={obligationCreateOpen} onClose={() => setObligationCreateOpen(false)} title="Nueva obligación ambiental" width={680}>
            <ObligationForm members={initial.members} pending={pending} onCancel={() => setObligationCreateOpen(false)} onSave={(payload) => run(async () => { await createObligation(payload); setObligationCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(obligationEditor)} onClose={() => setObligationEditor(null)} title={`Editar ${obligationEditor?.code ?? "obligación"}`} width={680}>
            {obligationEditor && <ObligationForm initial={obligationEditor} members={initial.members} pending={pending} onCancel={() => setObligationEditor(null)} onSave={(payload) => run(async () => { await updateObligation(obligationEditor.id, payload); setObligationEditor(null); })} />}
          </Modal>
          <Modal open={Boolean(evaluationObligation)} onClose={() => setEvaluationObligation(null)} title={`Evaluar ${evaluationObligation?.code ?? "obligación"}`} width={620}>
            {evaluationObligation && <EvaluationForm obligation={evaluationObligation} members={initial.members} pending={pending} onCancel={() => setEvaluationObligation(null)} onSave={(payload) => run(async () => { await createComplianceEvaluation(payload); setEvaluationObligation(null); })} />}
          </Modal>
        </div>
      )}

      {tab === "objectives" && (
        <div style={card}>
          <IsoSectionHeader icon={Target} title="Objetivos ambientales" description="Metas, responsables, fechas y avance de los programas ambientales." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setObjectiveCreateOpen(true)}>Nuevo objetivo</button>} />
          <EnvironmentTable headers={["Código", "Objetivo", "Línea base", "Meta", "Estado", "Avance", "Programas", "Acciones"]} query={tableQuery} onQueryChange={setTableQuery} placeholder="Buscar objetivo, meta o responsable…" exportName="objetivos-ambientales">
            <thead><tr>
                <th style={th}>Código</th><th style={th}>Objetivo</th><th style={th}>Línea base</th><th style={th}>Meta</th>
                <th style={th}>Estado</th><th style={th}>Avance</th><th style={th}>Programas</th><th style={th}>Acciones</th>
              </tr></thead>
              <tbody>
                {initial.objectives.filter((o) => matchesQuery([o.code, o.objective, o.baseline, o.target, o.status, o.progress])).map((o) => (
                  <Fragment key={o.id}>
                  <tr>
                    <td style={td}>{o.code}</td>
                    <td style={td}>{o.objective}</td>
                    <td style={td}>{o.baseline ?? "—"}</td>
                    <td style={td}>{o.target ?? "—"}</td>
                    <td style={td}>{o.status}</td>
                    <td style={td}>{o.progress}%</td>
                    <td style={td}><span className={o.programs.length ? "nf-objective-program-count" : "nf-objective-program-count nf-objective-program-count--empty"}>{o.programs.length ? `${o.programs.length} programa${o.programs.length === 1 ? "" : "s"}` : "Sin programas"}</span></td>
                    <td style={td}>{canManage && <EnvTableAction icon={FolderPlus} onClick={() => { setProgramObjectiveId(o.id); setProgramCreateOpen(true); }}>Programa</EnvTableAction>} {canUpdate && <EnvTableAction icon={Pencil} onClick={() => setObjectiveEditor(o)}>Editar</EnvTableAction>}</td>
                  </tr>
                  {o.programs.length > 0 && <tr className="nf-objective-programs-row">
                    <td colSpan={8}>
                      <div className="nf-objective-programs-panel">
                        <div className="nf-objective-programs-heading"><div><ListChecks size={15} aria-hidden /><strong>Programas de este objetivo</strong></div><span>{o.programs.length}</span></div>
                        <div className="nf-objective-programs-list">
                          {o.programs.map((program) => <div className="nf-objective-program-item" key={program.id}>
                            <div className="nf-objective-program-name"><ListChecks size={14} aria-hidden /><span>{program.name}</span></div>
                            <div className="nf-objective-program-item-actions">
                              {canUpdate && <EnvTableAction icon={Pencil} onClick={() => setProgramEditor(program)}>Editar</EnvTableAction>}
                              {canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar programa ambiental", message: "¿Quieres eliminar este programa? Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteProgram(program.id)) })}>Eliminar</EnvTableAction>}
                            </div>
                          </div>)}
                        </div>
                      </div>
                    </td>
                  </tr>}
                  </Fragment>
                ))}
                {initial.objectives.length === 0 && <tr><td style={td} colSpan={7}>Sin objetivos registrados.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <Modal open={objectiveCreateOpen} onClose={() => setObjectiveCreateOpen(false)} title="Nuevo objetivo ambiental" width={680}>
            <ObjectiveForm members={initial.members} pending={pending} onCancel={() => setObjectiveCreateOpen(false)} onSave={(payload) => run(async () => { await createObjective(payload); setObjectiveCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(objectiveEditor)} onClose={() => setObjectiveEditor(null)} title={`Editar ${objectiveEditor?.code ?? "objetivo"}`} width={680}>
            {objectiveEditor && <ObjectiveForm initial={objectiveEditor} members={initial.members} pending={pending} onCancel={() => setObjectiveEditor(null)} onSave={(payload) => run(async () => { await updateObjective(objectiveEditor.id, payload); setObjectiveEditor(null); })} />}
          </Modal>
          <Modal open={programCreateOpen} onClose={() => setProgramCreateOpen(false)} title="Nuevo programa ambiental" width={700}>
            <ProgramForm objectiveId={programObjectiveId} members={initial.members} pending={pending} onCancel={() => setProgramCreateOpen(false)} onSave={(payload) => run(async () => { await createProgram(payload); setProgramCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(programEditor)} onClose={() => setProgramEditor(null)} title={`Editar ${programEditor?.name ?? "programa"}`} width={700}>
            {programEditor && <ProgramForm initial={programEditor} members={initial.members} pending={pending} onCancel={() => setProgramEditor(null)} onSave={(payload) => run(async () => { await updateProgram(programEditor.id, payload); setProgramEditor(null); })} />}
          </Modal>
        </div>
      )}

      {tab === "trends" && (
        <div style={card}>
          <IsoSectionHeader icon={BarChart3} title="Indicadores ambientales" description="Registra los valores del periodo para consultar tendencias agregadas." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setMetricCreateOpen(true)}>Registrar indicador</button>} />
          <EnvironmentTrendOverview trends={initial.trends} />
          <EnvironmentTable headers={["Periodo", "Agua", "Energía", "Combustible", "Emisiones", "Vertidos", "Residuos", "Materias primas"]} query={tableQuery} onQueryChange={setTableQuery} placeholder="Buscar por periodo o indicador…" exportName="indicadores-ambientales">
            <thead><tr>
                <th style={th}>Periodo</th><th style={th}>Agua</th><th style={th}>Energía</th><th style={th}>Combustible</th>
                <th style={th}>Emisiones</th><th style={th}>Vertidos</th><th style={th}>Residuos</th><th style={th}>Materias primas</th>
              </tr></thead>
              <tbody>
                {initial.trends.filter((t) => matchesQuery([t.period, t.water, t.energy, t.fuel, t.emissions, t.discharges, t.waste, t.rawMaterials])).map((t) => (
                  <tr key={t.period}><td style={td}>{t.period}</td><td style={td}>{t.water}</td><td style={td}>{t.energy}</td><td style={td}>{t.fuel}</td><td style={td}>{t.emissions}</td><td style={td}>{t.discharges}</td><td style={td}>{t.waste}</td><td style={td}>{t.rawMaterials}</td></tr>
                ))}
                {initial.trends.length === 0 && <tr><td style={td} colSpan={8}>Sin indicadores registrados.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <Modal open={metricCreateOpen} onClose={() => setMetricCreateOpen(false)} title="Registrar indicador ambiental" width={700}>
            <MetricForm pending={pending} onCancel={() => setMetricCreateOpen(false)} onSave={(payload) => run(async () => { await upsertMetric(payload); setMetricCreateOpen(false); })} />
          </Modal>
        </div>
      )}

      {tab === "waste" && (
        <div style={card}>
          <IsoSectionHeader icon={Trash2} title="Flujos de residuos" description="Clasificación, cantidades, gestor y disposición final." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setWasteCreateOpen(true)}>Nuevo flujo</button>} />
          <EnvironmentTable headers={["Código", "Tipo", "Clasificación", "Cantidad", "Gestor", "Disposición", "Manifiesto", (canUpdate || canDelete) ? "Acciones" : ""].filter(Boolean) as string[]} query={tableQuery} onQueryChange={setTableQuery} placeholder="Buscar residuo, gestor o clasificación…" exportName="flujos-residuos">
            <thead><tr>
                <th style={th}>Código</th><th style={th}>Tipo</th><th style={th}>Clasificación</th><th style={th}>Cantidad</th>
                <th style={th}>Gestor</th><th style={th}>Disposición</th><th style={th}>Manifiesto</th>{(canUpdate || canDelete) && <th style={th}>Acciones</th>}
              </tr></thead>
              <tbody>
                {initial.waste.filter((w) => matchesQuery([w.code, w.wasteType, w.classification, w.managerName, w.disposition, w.manifest])).map((w) => (
                  <tr key={w.id}><td style={td}>{w.code}</td><td style={td}>{w.wasteType}</td><td style={td}>{WASTE_LABEL[w.classification] ?? w.classification}</td><td style={td}>{w.quantity ?? "—"} {w.unit ?? ""}</td><td style={td}>{w.managerName ?? "—"}</td><td style={td}>{w.disposition ?? "—"}</td><td style={td}>{w.manifest ?? "—"}</td>{(canUpdate || canDelete) && <td style={td}>{canUpdate && <EnvTableAction icon={Pencil} onClick={() => setWasteEditor(w)}>Editar</EnvTableAction>} {canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar flujo de residuos", message: "¿Quieres eliminar este flujo de residuos? Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteWasteStream(w.id)) })}>Eliminar</EnvTableAction>}</td>}</tr>
                ))}
                {initial.waste.length === 0 && <tr><td style={td} colSpan={7}>Sin residuos registrados.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <Modal open={wasteCreateOpen} onClose={() => setWasteCreateOpen(false)} title="Nuevo flujo de residuos" width={700}>
            <WasteForm pending={pending} onCancel={() => setWasteCreateOpen(false)} onSave={(payload) => run(async () => { await createWasteStream(payload); setWasteCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(wasteEditor)} onClose={() => setWasteEditor(null)} title={`Editar ${wasteEditor?.code ?? "flujo"}`} width={700}>
            {wasteEditor && <WasteForm initial={wasteEditor} pending={pending} onCancel={() => setWasteEditor(null)} onSave={(payload) => run(async () => { await updateWasteStream(wasteEditor.id, payload); setWasteEditor(null); })} />}
          </Modal>
        </div>
      )}

      {tab === "emergencies" && (
        <div style={card}>
          <IsoSectionHeader icon={Siren} title="Escenarios de emergencia" description="Preparación, controles, responsables y simulacros ambientales." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setEmergencyCreateOpen(true)}>Nuevo escenario</button>} />
          <EnvironmentTable headers={["Código", "Escenario", "Último simulacro", "Próximo simulacro", (canUpdate || canDelete) ? "Acciones" : ""].filter(Boolean) as string[]} query={tableQuery} onQueryChange={setTableQuery} placeholder="Buscar escenario o responsable…" exportName="emergencias-ambientales">
            <thead><tr>
                <th style={th}>Código</th><th style={th}>Escenario</th><th style={th}>Último simulacro</th><th style={th}>Próximo simulacro</th>
                {(canUpdate || canDelete) && <th style={th}>Acciones</th>}
              </tr></thead>
              <tbody>
                {initial.emergencies.filter((e) => matchesQuery([e.code, e.scenario, e.responsibleId])).map((e) => (
                  <tr key={e.id}><td style={td}>{e.code}</td><td style={td}>{e.scenario}</td><td style={td}>{fmt(e.lastDrillAt)}</td><td style={td}>{fmt(e.nextDrillAt)}</td>{(canUpdate || canDelete) && <td style={td}>{canUpdate && <EnvTableAction icon={Pencil} onClick={() => setEmergencyEditor(e)}>Editar</EnvTableAction>} {canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar escenario de emergencia", message: "¿Quieres eliminar este escenario? Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteEmergencyScenario(e.id)) })}>Eliminar</EnvTableAction>}</td>}</tr>
                ))}
                {initial.emergencies.length === 0 && <tr><td style={td} colSpan={4}>Sin escenarios registrados.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <Modal open={emergencyCreateOpen} onClose={() => setEmergencyCreateOpen(false)} title="Nuevo escenario de emergencia" width={700}>
            <EmergencyForm members={initial.members} pending={pending} onCancel={() => setEmergencyCreateOpen(false)} onSave={(payload) => run(async () => { await createEmergencyScenario(payload); setEmergencyCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(emergencyEditor)} onClose={() => setEmergencyEditor(null)} title={`Editar ${emergencyEditor?.code ?? "escenario"}`} width={700}>
            {emergencyEditor && <EmergencyForm initial={emergencyEditor} members={initial.members} pending={pending} onCancel={() => setEmergencyEditor(null)} onSave={(payload) => run(async () => { await updateEmergencyScenario(emergencyEditor.id, payload); setEmergencyEditor(null); })} />}
          </Modal>
        </div>
      )}

      {tab === "biodiversity" && (
        <div style={card}>
          <IsoSectionHeader icon={Trees} title="Biodiversidad" description="Registros configurables por sitio, ecosistema y cadencia de monitoreo." action={canManage && <button type="button" className="nf-app-btn-primary" onClick={() => setBiodiversityCreateOpen(true)}>Nuevo registro</button>} />
          <EnvironmentTable headers={["Código", "Sitio", "Ecosistema", "Área protegida", "Especie/hábitat", "Estado", "Próx. monitoreo", (canUpdate || canDelete) ? "Acciones" : ""].filter(Boolean) as string[]} query={tableQuery} onQueryChange={setTableQuery} placeholder="Buscar sitio, ecosistema o estado…" exportName="biodiversidad">
            <thead><tr>
                <th style={th}>Código</th><th style={th}>Sitio</th><th style={th}>Ecosistema</th><th style={th}>Área protegida</th>
                <th style={th}>Especie/hábitat</th><th style={th}>Estado</th><th style={th}>Próx. monitoreo</th>{(canUpdate || canDelete) && <th style={th}>Acciones</th>}
              </tr></thead>
              <tbody>
                {initial.biodiversity.filter((b) => matchesQuery([b.code, b.site, b.ecosystemType, b.speciesOrHabitat, b.status])).map((b) => (
                  <tr key={b.id}>
                    <td style={td}>{b.code}</td>
                    <td style={td}>{b.site}</td>
                    <td style={td}>{b.ecosystemType ?? "—"}</td>
                    <td style={td}>{b.protectedArea ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>{b.protectedAreaName}</span> : "No"}</td>
                    <td style={td}>{b.speciesOrHabitat ?? "—"}</td>
                    <td style={td}>{BIODIVERSITY_STATUS_LABEL[b.status] ?? b.status}</td>
                    <td style={td}>{fmt(b.nextMonitoringAt)}</td>
                    {(canUpdate || canDelete) && <td style={td}>{canUpdate && <EnvTableAction icon={Pencil} onClick={() => setBiodiversityEditor(b)}>Editar</EnvTableAction>} {canDelete && <EnvTableAction icon={Trash2} danger disabled={pending} onClick={() => setConfirmAction({ title: "Eliminar registro de biodiversidad", message: "¿Quieres eliminar este registro? Esta acción no se puede deshacer.", onConfirm: () => run(() => deleteBiodiversityRecord(b.id)) })}>Eliminar</EnvTableAction>}</td>}
                  </tr>
                ))}
                {initial.biodiversity.length === 0 && <tr><td style={td} colSpan={7}>Sin registros de biodiversidad.</td></tr>}
              </tbody>
          </EnvironmentTable>
          <Modal open={biodiversityCreateOpen} onClose={() => setBiodiversityCreateOpen(false)} title="Nuevo registro de biodiversidad" width={720}>
            <BiodiversityForm members={initial.members} pending={pending} onCancel={() => setBiodiversityCreateOpen(false)} onSave={(payload) => run(async () => { await createBiodiversityRecord(payload); setBiodiversityCreateOpen(false); })} />
          </Modal>
          <Modal open={Boolean(biodiversityEditor)} onClose={() => setBiodiversityEditor(null)} title={`Editar ${biodiversityEditor?.code ?? "registro"}`} width={720}>
            {biodiversityEditor && <BiodiversityForm initial={biodiversityEditor} members={initial.members} pending={pending} onCancel={() => setBiodiversityEditor(null)} onSave={(payload) => run(async () => { await updateBiodiversityRecord(biodiversityEditor.id, payload); setBiodiversityEditor(null); })} />}
          </Modal>
        </div>
      )}
      {confirmAction && <ConfirmActionModal open title={confirmAction.title} pending={pending} danger confirmLabel="Eliminar" onCancel={() => setConfirmAction(null)} onConfirm={() => { const action = confirmAction.onConfirm; setConfirmAction(null); action(); }}>{confirmAction.message}</ConfirmActionModal>}
    </div>
  );
}

const btn: React.CSSProperties = { marginTop: 12, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)", fontWeight: 600, fontSize: 13, cursor: "pointer" };

function EnvTableAction({ icon: Icon, children, danger = false, disabled = false, onClick }: {
  icon: typeof Pencil;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button type="button" className={`nf-table-action${danger ? " nf-table-action--danger" : ""}`} disabled={disabled} onClick={onClick}><Icon size={13} strokeWidth={2} aria-hidden /> <span>{children}</span></button>;
}

function EnvironmentTrendOverview({ trends }: { trends: EnvironmentPayload["trends"] }) {
  const series = [
    { key: "water", label: "Agua", color: "#3b82f6" },
    { key: "energy", label: "Energía", color: "#eab308" },
    { key: "fuel", label: "Combustible", color: "#f97316" },
    { key: "emissions", label: "Emisiones", color: "#8b5cf6" },
    { key: "discharges", label: "Vertidos", color: "#06b6d4" },
    { key: "waste", label: "Residuos", color: "var(--nf-success-text)" },
    { key: "rawMaterials", label: "Materias primas", color: "var(--nf-text-secondary)" },
  ] as const;
  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];
  const max = Math.max(1, ...trends.flatMap((trend) => series.map(({ key }) => trend[key])));
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);
  const delta = (key: typeof series[number]["key"]) => {
    if (!latest || !previous || previous[key] === 0) return null;
    return ((latest[key] - previous[key]) / Math.abs(previous[key])) * 100;
  };

  return (
    <div className="nf-environment-trend-overview">
      <div className="nf-environment-trend-chart">
        <div className="nf-environment-trend-heading">
          <div><strong>Evolución por periodo</strong><span>Comparativa de consumos, emisiones y residuos registrados.</span></div>
          <BarChart3 size={18} aria-hidden />
        </div>
        {trends.length === 0 ? (
          <div className="nf-environment-trend-empty">Registra un indicador para comenzar a visualizar el desempeño.</div>
        ) : (
          <>
            <div className="nf-environment-trend-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
            <div className="nf-environment-trend-bars">
              {trends.slice(-6).map((trend) => (
                <div className="nf-environment-trend-period" key={trend.period}>
                  <div className="nf-environment-trend-period-label">{trend.period}</div>
                  <div className="nf-environment-trend-period-bars">
                    {series.map((item) => <div className="nf-environment-trend-bar-track" key={item.key} title={`${item.label}: ${format(trend[item.key])}`}><span style={{ width: `${Math.max(trend[item.key] > 0 ? 4 : 0, (trend[item.key] / max) * 100)}%`, background: item.color }} /></div>)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="nf-environment-trend-latest">
        <div className="nf-environment-trend-heading"><div><strong>Último periodo</strong><span>{latest?.period ?? "Sin datos todavía"}</span></div><span className="nf-environment-trend-latest-badge">{trends.length} periodo{trends.length === 1 ? "" : "s"}</span></div>
        {latest ? series.slice(0, 5).map((item) => {
          const change = delta(item.key);
          return <div className="nf-environment-trend-stat" key={item.key}><span><i style={{ background: item.color }} />{item.label}</span><strong>{format(latest[item.key])}</strong>{change !== null && <small className={change > 0 ? "is-up" : change < 0 ? "is-down" : ""}>{change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(1)}%</small>}</div>;
        }) : <div className="nf-environment-trend-empty">Aún no hay mediciones para resumir.</div>}
      </div>
    </div>
  );
}

type AspectFormValue = {
  id?: string;
  activity: string;
  productService: string;
  condition: "NORMAL" | "ABNORMAL" | "EMERGENCY";
  lifeCycleStage: string;
  responsibleId: string;
  processId: string;
  description: string;
};

function AspectEditor({ value, pending, onClose, onSave }: {
  value: EnvironmentPayload["aspects"][number] | "new" | null;
  pending: boolean;
  onClose: () => void;
  onSave: (value: AspectFormValue) => void;
}) {
  const source = value && value !== "new" ? value : null;
  const [form, setForm] = useState<AspectFormValue>({
    id: source?.id,
    activity: source?.activity ?? "",
    productService: source?.productService ?? "",
    condition: (source?.condition as AspectFormValue["condition"] | undefined) ?? "NORMAL",
    lifeCycleStage: source?.lifeCycleStage ?? "",
    responsibleId: source?.responsibleId ?? "",
    processId: source?.processId ?? "",
    description: source?.description ?? "",
  });
  return (
    <Modal open={Boolean(value)} onClose={onClose} title={source ? `Editar ${source.code}` : "Nuevo aspecto ambiental"} width={620}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Actividad<input className="nf-app-input" value={form.activity} onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value }))} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Producto / servicio<input className="nf-app-input" value={form.productService} onChange={(e) => setForm((p) => ({ ...p, productService: e.target.value }))} /></label>
          <label>Etapa del ciclo de vida<input className="nf-app-input" value={form.lifeCycleStage} onChange={(e) => setForm((p) => ({ ...p, lifeCycleStage: e.target.value }))} /></label>
        </div>
        <label>Condición<select className="nf-app-input" value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value as AspectFormValue["condition"] }))}>
          <option value="NORMAL">Normal</option><option value="ABNORMAL">Anormal</option><option value="EMERGENCY">Emergencia</option>
        </select></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Responsable (ID)<input className="nf-app-input" value={form.responsibleId} onChange={(e) => setForm((p) => ({ ...p, responsibleId: e.target.value }))} placeholder="Opcional" /></label>
          <label>Proceso (ID)<input className="nf-app-input" value={form.processId} onChange={(e) => setForm((p) => ({ ...p, processId: e.target.value }))} placeholder="Opcional" /></label>
        </div>
        <label>Descripción<textarea className="nf-app-input" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" disabled={pending || !form.activity.trim()} onClick={() => onSave(form)}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

type ImpactFormValue = { id?: string; aspectId: string; impactType: string; description: string; severity: string; frequency: string; scope: string; existingControl: string; controlEffectiveness: string; methodId?: string; riskId?: string; controlId?: string };

function ImpactEditor({ value, pending, onClose, onSave }: { value: { aspectId: string; impact?: EnvironmentPayload["aspects"][number]["impacts"][number] } | null; pending: boolean; onClose: () => void; onSave: (value: ImpactFormValue) => void }) {
  const source = value?.impact;
  const [form, setForm] = useState<ImpactFormValue>({ id: source?.id, aspectId: value?.aspectId ?? "", impactType: source?.impactType ?? "", description: source?.description ?? "", severity: source?.severity != null ? String(source.severity) : "1", frequency: source?.frequency != null ? String(source.frequency) : "1", scope: source?.scope != null ? String(source.scope) : "1", existingControl: source?.existingControl ?? "", controlEffectiveness: source?.controlEffectiveness != null ? String(source.controlEffectiveness) : "", methodId: "", riskId: source?.riskId ?? "", controlId: source?.controlId ?? "" });
  useEffect(() => { const next = value?.impact; setForm({ id: next?.id, aspectId: value?.aspectId ?? "", impactType: next?.impactType ?? "", description: next?.description ?? "", severity: next?.severity != null ? String(next.severity) : "1", frequency: next?.frequency != null ? String(next.frequency) : "1", scope: next?.scope != null ? String(next.scope) : "1", existingControl: next?.existingControl ?? "", controlEffectiveness: next?.controlEffectiveness != null ? String(next.controlEffectiveness) : "", methodId: "", riskId: next?.riskId ?? "", controlId: next?.controlId ?? "" }); }, [value]);
  return <Modal open={Boolean(value)} onClose={onClose} title={source ? "Editar impacto ambiental" : "Nuevo impacto ambiental"} width={700}>
    <div className="nf-modal-form"><label>Tipo de impacto<input className="nf-app-input" value={form.impactType} onChange={(e) => setForm((f) => ({ ...f, impactType: e.target.value }))} /></label><label>Descripción<textarea className="nf-app-input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label><div className="nf-form-grid-3"><label>Severidad<input className="nf-app-input" type="number" min={0} max={10} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))} /></label><label>Frecuencia<input className="nf-app-input" type="number" min={0} max={10} value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} /></label><label>Alcance<input className="nf-app-input" type="number" min={0} max={10} value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} /></label></div><label>Control existente<textarea className="nf-app-input" rows={2} value={form.existingControl} onChange={(e) => setForm((f) => ({ ...f, existingControl: e.target.value }))} /></label><label>Efectividad del control (%)<input className="nf-app-input" type="number" min={0} max={100} value={form.controlEffectiveness} onChange={(e) => setForm((f) => ({ ...f, controlEffectiveness: e.target.value }))} /></label><div className="nf-form-grid-3"><label>Método (ID)<input className="nf-app-input" value={form.methodId} onChange={(e) => setForm((f) => ({ ...f, methodId: e.target.value }))} placeholder="Opcional" /></label><label>Riesgo (ID)<input className="nf-app-input" value={form.riskId} onChange={(e) => setForm((f) => ({ ...f, riskId: e.target.value }))} placeholder="Opcional" /></label><label>Control (ID)<input className="nf-app-input" value={form.controlId} onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))} placeholder="Opcional" /></label></div><div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.impactType.trim()} onClick={() => onSave({ ...form, severity: form.severity || "1", frequency: form.frequency || "1", scope: form.scope || "1", methodId: form.methodId || undefined, riskId: form.riskId || undefined, controlId: form.controlId || undefined })}>Guardar impacto</button></div></div>
  </Modal>;
}

function ObligationForm({ initial, members, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["obligations"][number];
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createObligation>[0]) => void;
}) {
  const [form, setForm] = useState({ source: initial?.source ?? "", obligation: initial?.obligation ?? "", jurisdiction: initial?.jurisdiction ?? "", applicability: initial?.applicability ?? "", responsibleId: initial?.responsibleId ?? "", reviewDate: initial?.reviewDate ? fmt(initial.reviewDate) : "", reviewFrequencyMonths: initial?.reviewFrequencyMonths != null ? String(initial.reviewFrequencyMonths) : "", evidenceId: initial?.evidenceId ?? "", documentId: initial?.documentId ?? "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="nf-modal-form">
      <div className="nf-form-grid-2">
        <label>Fuente normativa<input className="nf-app-input" value={form.source} onChange={(event) => set("source", event.target.value)} placeholder="Ley, permiso, resolución…" /></label>
        <label>Jurisdicción<input className="nf-app-input" value={form.jurisdiction} onChange={(event) => set("jurisdiction", event.target.value)} placeholder="País, ciudad o autoridad" /></label>
      </div>
      <label>Obligación<textarea className="nf-app-input" rows={3} value={form.obligation} onChange={(event) => set("obligation", event.target.value)} placeholder="Describe el requisito aplicable…" /></label>
      <label>Aplicabilidad<input className="nf-app-input" value={form.applicability} onChange={(event) => set("applicability", event.target.value)} placeholder="Procesos, sedes o actividades alcanzadas" /></label>
      <div className="nf-form-grid-2">
        <label>Responsable<select className="nf-app-input" value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label>Frecuencia de revisión (meses)<input className="nf-app-input" type="number" min={1} value={form.reviewFrequencyMonths} onChange={(event) => set("reviewFrequencyMonths", event.target.value)} placeholder="Ej. 12" /></label>
      </div>
      <label>Próxima revisión<input className="nf-app-input" type="date" value={form.reviewDate} onChange={(event) => set("reviewDate", event.target.value)} /></label>
      <div className="nf-form-grid-2"><label>Evidencia (ID)<input className="nf-app-input" value={form.evidenceId} onChange={(event) => set("evidenceId", event.target.value)} placeholder="Opcional" /></label><label>Documento (ID)<input className="nf-app-input" value={form.documentId} onChange={(event) => set("documentId", event.target.value)} placeholder="Opcional" /></label></div>
      <div className="nf-modal-actions">
        <button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="nf-app-btn-primary" disabled={pending || !form.source.trim() || !form.obligation.trim()} onClick={() => onSave({
          source: form.source, obligation: form.obligation, jurisdiction: form.jurisdiction || undefined, applicability: form.applicability || undefined,
          responsibleId: form.responsibleId || undefined, reviewFrequencyMonths: form.reviewFrequencyMonths ? Number(form.reviewFrequencyMonths) : undefined,
          reviewDate: form.reviewDate ? new Date(`${form.reviewDate}T00:00:00.000Z`).toISOString() : undefined, evidenceId: form.evidenceId || undefined, documentId: form.documentId || undefined,
        })}>{initial ? "Guardar cambios" : "Crear obligación"}</button>
      </div>
    </div>
  );
}

function EvaluationForm({ obligation, members, pending, onCancel, onSave }: {
  obligation: EnvironmentPayload["obligations"][number];
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createComplianceEvaluation>[0]) => void;
}) {
  const [form, setForm] = useState({ result: "COMPLIANT", evaluatorId: "", findings: "" });
  return (
    <div className="nf-modal-form">
      <div className="nf-modal-help">{obligation.source} · {obligation.obligation}</div>
      <label>Resultado<select className="nf-app-input" value={form.result} onChange={(event) => setForm((current) => ({ ...current, result: event.target.value }))}>
        <option value="COMPLIANT">Conforme</option><option value="PARTIAL">Parcial</option><option value="NON_COMPLIANT">No conforme</option><option value="NOT_EVALUATED">Sin evaluar</option>
      </select></label>
      <label>Evaluador<select className="nf-app-input" value={form.evaluatorId} onChange={(event) => setForm((current) => ({ ...current, evaluatorId: event.target.value }))}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label>Hallazgos y observaciones<textarea className="nf-app-input" rows={4} value={form.findings} onChange={(event) => setForm((current) => ({ ...current, findings: event.target.value }))} placeholder="Evidencia revisada, desviaciones o notas…" /></label>
      <div className="nf-modal-actions">
        <button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onSave({ obligationId: obligation.id, result: form.result as Parameters<typeof createComplianceEvaluation>[0]["result"], evaluatorId: form.evaluatorId || undefined, findings: form.findings || undefined, advanceReview: true })}>Guardar evaluación</button>
      </div>
    </div>
  );
}

function ObjectiveForm({ initial, members, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["objectives"][number];
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createObjective>[0]) => void;
}) {
  const [form, setForm] = useState({ code: initial?.code ?? "", objective: initial?.objective ?? "", baseline: initial?.baseline ?? "", target: initial?.target ?? "", indicatorId: initial?.indicatorId ?? "", responsibleId: initial?.responsibleId ?? "", resources: initial?.resources ?? "", dueDate: initial?.dueDate ? fmt(initial.dueDate) : "", status: initial?.status ?? "PLANNED", progress: initial?.progress != null ? String(initial.progress) : "0" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="nf-modal-form">
    <div className="nf-form-grid-2"><label>Código<input className="nf-app-input" value={form.code} onChange={(event) => set("code", event.target.value)} placeholder="OBJ-0001 (opcional)" /></label><label>Responsable<select className="nf-app-input" value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div>
    <label>Objetivo<textarea className="nf-app-input" rows={2} value={form.objective} onChange={(event) => set("objective", event.target.value)} placeholder="Resultado ambiental que se desea alcanzar…" /></label>
    <div className="nf-form-grid-2"><label>Línea base<input className="nf-app-input" value={form.baseline} onChange={(event) => set("baseline", event.target.value)} /></label><label>Meta<input className="nf-app-input" value={form.target} onChange={(event) => set("target", event.target.value)} /></label></div>
    <div className="nf-form-grid-2"><label>Indicador (ID)<input className="nf-app-input" value={form.indicatorId} onChange={(event) => set("indicatorId", event.target.value)} placeholder="Opcional" /></label><label>Fecha objetivo<input className="nf-app-input" type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></div>
    <label>Recursos<textarea className="nf-app-input" rows={2} value={form.resources} onChange={(event) => set("resources", event.target.value)} placeholder="Personas, presupuesto, equipos…" /></label>
    <div className="nf-form-grid-2"><label>Estado<select className="nf-app-input" value={form.status} onChange={(event) => set("status", event.target.value)}><option value="PLANNED">Planificado</option><option value="IN_PROGRESS">En curso</option><option value="ACHIEVED">Logrado</option><option value="DELAYED">Retrasado</option><option value="CANCELLED">Cancelado</option></select></label><label>Avance (%)<input className="nf-app-input" type="number" min={0} max={100} value={form.progress} onChange={(event) => set("progress", event.target.value)} /></label></div>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.objective.trim()} onClick={() => onSave({ code: form.code || undefined, objective: form.objective, baseline: form.baseline || undefined, target: form.target || undefined, indicatorId: form.indicatorId || undefined, responsibleId: form.responsibleId || undefined, resources: form.resources || undefined, dueDate: form.dueDate ? new Date(`${form.dueDate}T00:00:00.000Z`).toISOString() : undefined, status: form.status as Parameters<typeof createObjective>[0]["status"], progress: Math.min(100, Math.max(0, Number(form.progress) || 0)) })}>{initial ? "Guardar cambios" : "Crear objetivo"}</button></div>
  </div>;
}

function ProgramForm({ initial, objectiveId, members, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["objectives"][number]["programs"][number];
  objectiveId?: string;
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createProgram>[0]) => void;
}) {
  const [form, setForm] = useState({ name: initial?.name ?? "", activities: initial?.activities ?? "", responsibleId: initial?.responsibleId ?? "", budget: initial?.budget != null ? String(initial.budget) : "", progress: initial?.progress != null ? String(initial.progress) : "0", status: initial?.status ?? "NOT_STARTED", startDate: initial?.startDate ? fmt(initial.startDate) : "", dueDate: initial?.dueDate ? fmt(initial.dueDate) : "", evidenceId: initial?.evidenceId ?? "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="nf-modal-form">
    <label>Nombre del programa<input className="nf-app-input" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Programa de reducción de consumo…" /></label>
    <label>Actividades<textarea className="nf-app-input" rows={3} value={form.activities} onChange={(event) => set("activities", event.target.value)} /></label>
    <div className="nf-form-grid-2"><label>Responsable<select className="nf-app-input" value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Presupuesto<input className="nf-app-input" type="number" min={0} step="any" value={form.budget} onChange={(event) => set("budget", event.target.value)} /></label></div>
    <div className="nf-form-grid-2"><label>Inicio<input className="nf-app-input" type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} /></label><label>Fecha objetivo<input className="nf-app-input" type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></div>
    <div className="nf-form-grid-2"><label>Estado<select className="nf-app-input" value={form.status} onChange={(event) => set("status", event.target.value)}><option value="NOT_STARTED">No iniciado</option><option value="IN_PROGRESS">En curso</option><option value="COMPLETED">Completado</option><option value="ON_HOLD">En pausa</option><option value="CANCELLED">Cancelado</option></select></label><label>Avance (%)<input className="nf-app-input" type="number" min={0} max={100} value={form.progress} onChange={(event) => set("progress", event.target.value)} /></label></div>
    <label>Evidencia (ID)<input className="nf-app-input" value={form.evidenceId} onChange={(event) => set("evidenceId", event.target.value)} placeholder="Opcional" /></label>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.name.trim()} onClick={() => onSave({ objectiveId: initial?.objectiveId ?? objectiveId, name: form.name, activities: form.activities || undefined, responsibleId: form.responsibleId || undefined, budget: form.budget ? Number(form.budget) : undefined, progress: Math.min(100, Math.max(0, Number(form.progress) || 0)), status: form.status as Parameters<typeof createProgram>[0]["status"], startDate: form.startDate ? new Date(`${form.startDate}T00:00:00.000Z`).toISOString() : undefined, dueDate: form.dueDate ? new Date(`${form.dueDate}T00:00:00.000Z`).toISOString() : undefined, evidenceId: form.evidenceId || undefined })}>{initial ? "Guardar cambios" : "Crear programa"}</button></div>
  </div>;
}

function MetricForm({ pending, onCancel, onSave }: {
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof upsertMetric>[0]) => void;
}) {
  const [form, setForm] = useState({ period: "", water: "", energy: "", fuel: "", emissions: "", discharges: "", waste: "", rawMaterials: "", unitNote: "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const number = (value: string) => value ? Number(value) : undefined;
  return <div className="nf-modal-form">
    <div className="nf-form-grid-2"><label>Periodo<input className="nf-app-input" placeholder="YYYY-MM" value={form.period} onChange={(event) => set("period", event.target.value)} /></label><label>Nota de unidad<input className="nf-app-input" value={form.unitNote} onChange={(event) => set("unitNote", event.target.value)} placeholder="m³, kWh, tCO₂e…" /></label></div>
    <div className="nf-form-grid-3"><label>Agua<input className="nf-app-input" type="number" step="any" value={form.water} onChange={(event) => set("water", event.target.value)} /></label><label>Energía<input className="nf-app-input" type="number" step="any" value={form.energy} onChange={(event) => set("energy", event.target.value)} /></label><label>Combustible<input className="nf-app-input" type="number" step="any" value={form.fuel} onChange={(event) => set("fuel", event.target.value)} /></label><label>Emisiones<input className="nf-app-input" type="number" step="any" value={form.emissions} onChange={(event) => set("emissions", event.target.value)} /></label><label>Vertidos<input className="nf-app-input" type="number" step="any" value={form.discharges} onChange={(event) => set("discharges", event.target.value)} /></label><label>Residuos<input className="nf-app-input" type="number" step="any" value={form.waste} onChange={(event) => set("waste", event.target.value)} /></label></div>
    <label>Materias primas<input className="nf-app-input" type="number" step="any" value={form.rawMaterials} onChange={(event) => set("rawMaterials", event.target.value)} /></label>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.period.trim()} onClick={() => onSave({ period: form.period, water: number(form.water), energy: number(form.energy), fuel: number(form.fuel), emissions: number(form.emissions), discharges: number(form.discharges), waste: number(form.waste), rawMaterials: number(form.rawMaterials), unitNote: form.unitNote || undefined })}>Registrar indicador</button></div>
  </div>;
}

function WasteForm({ initial, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["waste"][number];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createWasteStream>[0]) => void;
}) {
  const [form, setForm] = useState({ wasteType: initial?.wasteType ?? "", classification: initial?.classification ?? "NON_HAZARDOUS", quantity: initial?.quantity != null ? String(initial.quantity) : "", unit: initial?.unit ?? "", period: initial?.period ?? "", storage: initial?.storage ?? "", managerName: initial?.managerName ?? "", disposition: initial?.disposition ?? "", manifest: initial?.manifest ?? "", processId: initial?.processId ?? "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="nf-modal-form">
    <div className="nf-form-grid-2"><label>Tipo de residuo<input className="nf-app-input" value={form.wasteType} onChange={(event) => set("wasteType", event.target.value)} placeholder="Cartón, aceite usado…" /></label><label>Clasificación<select className="nf-app-input" value={form.classification} onChange={(event) => set("classification", event.target.value)}>{Object.entries(WASTE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="nf-form-grid-3"><label>Cantidad<input className="nf-app-input" type="number" step="any" min={0} value={form.quantity} onChange={(event) => set("quantity", event.target.value)} /></label><label>Unidad<input className="nf-app-input" value={form.unit} onChange={(event) => set("unit", event.target.value)} placeholder="kg, t, m³" /></label><label>Periodo<input className="nf-app-input" value={form.period} onChange={(event) => set("period", event.target.value)} placeholder="YYYY-MM" /></label></div>
    <div className="nf-form-grid-2"><label>Almacenamiento<input className="nf-app-input" value={form.storage} onChange={(event) => set("storage", event.target.value)} /></label><label>Proceso (ID)<input className="nf-app-input" value={form.processId} onChange={(event) => set("processId", event.target.value)} placeholder="Opcional" /></label></div>
    <div className="nf-form-grid-2"><label>Gestor<input className="nf-app-input" value={form.managerName} onChange={(event) => set("managerName", event.target.value)} /></label><label>Manifiesto<input className="nf-app-input" value={form.manifest} onChange={(event) => set("manifest", event.target.value)} /></label></div>
    <label>Disposición final<input className="nf-app-input" value={form.disposition} onChange={(event) => set("disposition", event.target.value)} /></label>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.wasteType.trim()} onClick={() => onSave({ wasteType: form.wasteType, classification: form.classification as Parameters<typeof createWasteStream>[0]["classification"], quantity: form.quantity ? Number(form.quantity) : undefined, unit: form.unit || undefined, period: form.period || undefined, storage: form.storage || undefined, managerName: form.managerName || undefined, disposition: form.disposition || undefined, manifest: form.manifest || undefined, processId: form.processId || undefined })}>{initial ? "Guardar cambios" : "Crear flujo"}</button></div>
  </div>;
}

function EmergencyForm({ initial, members, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["emergencies"][number];
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createEmergencyScenario>[0]) => void;
}) {
  const [form, setForm] = useState({ scenario: initial?.scenario ?? "", impact: initial?.impact ?? "", controls: initial?.controls ?? "", responsePlan: initial?.responsePlan ?? "", responsibleId: initial?.responsibleId ?? "", lastDrillAt: initial?.lastDrillAt ? fmt(initial.lastDrillAt) : "", nextDrillAt: initial?.nextDrillAt ? fmt(initial.nextDrillAt) : "", drillResults: initial?.drillResults ?? "", documentId: initial?.documentId ?? "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="nf-modal-form">
    <label>Escenario<input className="nf-app-input" value={form.scenario} onChange={(event) => set("scenario", event.target.value)} placeholder="Derrame, incendio, emisión accidental…" /></label>
    <label>Impacto esperado<textarea className="nf-app-input" rows={2} value={form.impact} onChange={(event) => set("impact", event.target.value)} /></label>
    <label>Controles preventivos<textarea className="nf-app-input" rows={2} value={form.controls} onChange={(event) => set("controls", event.target.value)} /></label>
    <label>Plan de respuesta<textarea className="nf-app-input" rows={3} value={form.responsePlan} onChange={(event) => set("responsePlan", event.target.value)} /></label>
    <div className="nf-form-grid-2"><label>Responsable<select className="nf-app-input" value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Último simulacro<input className="nf-app-input" type="date" value={form.lastDrillAt} onChange={(event) => set("lastDrillAt", event.target.value)} /></label></div>
    <div className="nf-form-grid-2"><label>Próximo simulacro<input className="nf-app-input" type="date" value={form.nextDrillAt} onChange={(event) => set("nextDrillAt", event.target.value)} /></label><label>Documento (ID)<input className="nf-app-input" value={form.documentId} onChange={(event) => set("documentId", event.target.value)} placeholder="Opcional" /></label></div>
    <label>Resultados del simulacro<textarea className="nf-app-input" rows={2} value={form.drillResults} onChange={(event) => set("drillResults", event.target.value)} /></label>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.scenario.trim()} onClick={() => onSave({ scenario: form.scenario, impact: form.impact || undefined, controls: form.controls || undefined, responsePlan: form.responsePlan || undefined, responsibleId: form.responsibleId || undefined, lastDrillAt: form.lastDrillAt ? new Date(`${form.lastDrillAt}T00:00:00.000Z`).toISOString() : undefined, nextDrillAt: form.nextDrillAt ? new Date(`${form.nextDrillAt}T00:00:00.000Z`).toISOString() : undefined, drillResults: form.drillResults || undefined, documentId: form.documentId || undefined })}>{initial ? "Guardar cambios" : "Crear escenario"}</button></div>
  </div>;
}

function BiodiversityForm({ initial, members, pending, onCancel, onSave }: {
  initial?: EnvironmentPayload["biodiversity"][number];
  members: EnvironmentPayload["members"];
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof createBiodiversityRecord>[0]) => void;
}) {
  const [form, setForm] = useState({ site: initial?.site ?? "", ecosystemType: initial?.ecosystemType ?? "", protectedArea: initial?.protectedArea ?? false, protectedAreaName: initial?.protectedAreaName ?? "", speciesOrHabitat: initial?.speciesOrHabitat ?? "", impactDescription: initial?.impactDescription ?? "", mitigationMeasures: initial?.mitigationMeasures ?? "", monitoringFrequency: initial?.monitoringFrequency ?? "", status: initial?.status ?? "IDENTIFIED", responsibleId: initial?.responsibleId ?? "", processId: initial?.processId ?? "", evidenceId: initial?.evidenceId ?? "", lastMonitoredAt: initial?.lastMonitoredAt ? fmt(initial.lastMonitoredAt) : "", nextMonitoringAt: initial?.nextMonitoringAt ? fmt(initial.nextMonitoringAt) : "" });
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="nf-modal-form">
    <div className="nf-form-grid-2"><label>Sitio<input className="nf-app-input" value={form.site} onChange={(event) => set("site", event.target.value)} /></label><label>Tipo de ecosistema<input className="nf-app-input" value={form.ecosystemType} onChange={(event) => set("ecosystemType", event.target.value)} /></label></div>
    <label className="nf-modal-checkbox"><input type="checkbox" checked={form.protectedArea} onChange={(event) => set("protectedArea", event.target.checked)} /> Área protegida</label>
    {form.protectedArea && <label>Nombre del área protegida<input className="nf-app-input" value={form.protectedAreaName} onChange={(event) => set("protectedAreaName", event.target.value)} /></label>}
    <label>Especie o hábitat<textarea className="nf-app-input" rows={2} value={form.speciesOrHabitat} onChange={(event) => set("speciesOrHabitat", event.target.value)} /></label>
    <div className="nf-form-grid-2"><label>Descripción del impacto<textarea className="nf-app-input" rows={2} value={form.impactDescription} onChange={(event) => set("impactDescription", event.target.value)} /></label><label>Medidas de mitigación<textarea className="nf-app-input" rows={2} value={form.mitigationMeasures} onChange={(event) => set("mitigationMeasures", event.target.value)} /></label></div>
    <div className="nf-form-grid-2"><label>Frecuencia de monitoreo<input className="nf-app-input" value={form.monitoringFrequency} onChange={(event) => set("monitoringFrequency", event.target.value)} placeholder="Mensual, trimestral…" /></label><label>Estado<select className="nf-app-input" value={form.status} onChange={(event) => set("status", event.target.value)}>{Object.entries(BIODIVERSITY_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="nf-form-grid-2"><label>Último monitoreo<input className="nf-app-input" type="date" value={form.lastMonitoredAt} onChange={(event) => set("lastMonitoredAt", event.target.value)} /></label><label>Próximo monitoreo<input className="nf-app-input" type="date" value={form.nextMonitoringAt} onChange={(event) => set("nextMonitoringAt", event.target.value)} /></label></div>
    <label>Responsable<select className="nf-app-input" value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <div className="nf-form-grid-2"><label>Proceso (ID)<input className="nf-app-input" value={form.processId} onChange={(event) => set("processId", event.target.value)} placeholder="Opcional" /></label><label>Evidencia (ID)<input className="nf-app-input" value={form.evidenceId} onChange={(event) => set("evidenceId", event.target.value)} placeholder="Opcional" /></label></div>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !form.site.trim() || (form.protectedArea && !form.protectedAreaName.trim())} onClick={() => onSave({ site: form.site, ecosystemType: form.ecosystemType || undefined, protectedArea: form.protectedArea, protectedAreaName: form.protectedAreaName || undefined, speciesOrHabitat: form.speciesOrHabitat || undefined, impactDescription: form.impactDescription || undefined, mitigationMeasures: form.mitigationMeasures || undefined, monitoringFrequency: form.monitoringFrequency || undefined, status: form.status as Parameters<typeof createBiodiversityRecord>[0]["status"], responsibleId: form.responsibleId || undefined, processId: form.processId || undefined, evidenceId: form.evidenceId || undefined, lastMonitoredAt: form.lastMonitoredAt ? new Date(`${form.lastMonitoredAt}T00:00:00.000Z`).toISOString() : undefined, nextMonitoringAt: form.nextMonitoringAt ? new Date(`${form.nextMonitoringAt}T00:00:00.000Z`).toISOString() : undefined })}>{initial ? "Guardar cambios" : "Crear registro"}</button></div>
  </div>;
}

function TableFilter({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="nf-iso-inline-filter">
      <label className="nf-iso-inline-filter-search">
        <Search size={15} aria-hidden />
        <span className="sr-only">{placeholder}</span>
        <input type="search" className="nf-app-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        {value && <button type="button" className="nf-iso-inline-filter-clear" onClick={() => onChange("")} aria-label="Limpiar búsqueda"><X size={14} aria-hidden /></button>}
      </label>
    </div>
  );
}

function EnvironmentTable({
  headers,
  query,
  onQueryChange,
  placeholder,
  exportName,
  hideHeading = true,
  children,
}: {
  headers: string[];
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  exportName: string;
  hideHeading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <IsoTableCard
      headers={headers}
      searchable={false}
      filters={<TableFilter value={query} onChange={onQueryChange} placeholder={placeholder} />}
      hideHeading={hideHeading}
      exportName={exportName}
    >
      {children}
    </IsoTableCard>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <IsoMetricCard label={label} value={value} accent={accent} />;
}
