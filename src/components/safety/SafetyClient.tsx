"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardHat, Grid3x3, AlertOctagon, BarChart3, ClipboardList, ShieldCheck, FileWarning, Siren, Users, Stethoscope, LayoutDashboard, ArrowRight, Lock, Plus } from "lucide-react";
import type { HealthSurveillancePayload, SafetyPayload } from "@/lib/safety/queries";
import { createHazard, updateHazard, transitionIncident, setPermitStatus, createSafetyRecord, updateSafetyRecord, updateHealthSurveillance, deleteHealthSurveillance, type SafetyRecordKind } from "@/lib/actions/safety";
import { useModuleSection } from "@/hooks/useModuleSection";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { toneChip } from "@/lib/tone";

type Tab = "panel" | "hazards" | "consultations" | "incidents" | "inspections" | "ppe" | "permits" | "drills" | "contractors" | "health";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Seguridad y Salud en el Trabajo", sub: "ISO 45001:2018 — visión general de peligros, riesgos, incidentes, EPP, permisos, emergencias e indicadores." },
  hazards: { title: "Matriz de peligros y riesgos", sub: "Peligros, tareas, personas expuestas, valoración y aceptabilidad del riesgo." },
  consultations: { title: "Consulta y participación", sub: "Participación y consulta de los trabajadores en seguridad y salud." },
  incidents: { title: "Incidentes y casi accidentes", sub: "Registro, investigación, acciones y cierre de incidentes de seguridad y salud." },
  inspections: { title: "Inspecciones", sub: "Inspecciones de áreas, hallazgos y acciones de seguimiento." },
  ppe: { title: "Equipos de protección personal", sub: "Catálogo, estándares, vida útil y asignaciones de EPP." },
  permits: { title: "Permisos de trabajo", sub: "Permisos activos, áreas, trabajos críticos y vencimientos." },
  drills: { title: "Simulacros y emergencias", sub: "Escenarios, tiempos de respuesta, resultados y oportunidades de mejora." },
  contractors: { title: "Contratistas", sub: "Evaluación, desempeño e incidentes de contratistas." },
  health: { title: "Vigilancia de la salud", sub: "Seguimiento ocupacional restringido por permisos de información sensible." },
};

const LEVEL_COLORS: Record<string, string> = { LOW: "var(--nf-success)", MEDIUM: "var(--nf-warning)", MODERATE: "var(--nf-warning)", HIGH: "var(--nf-warning)", CRITICAL: "var(--nf-danger-text)" };
const SEV_COLORS: Record<string, string> = { LOW: "var(--nf-success)", MEDIUM: "var(--nf-warning)", HIGH: "var(--nf-warning)", CRITICAL: "var(--nf-danger-text)" };
const ACCEPT_LABEL: Record<string, string> = { ACCEPTABLE: "Aceptable", TOLERABLE: "Tolerable", NOT_ACCEPTABLE: "No aceptable" };
const STATUS_LABEL: Record<string, string> = { REPORTED: "Reportado", CLASSIFIED: "Clasificado", INVESTIGATING: "Investigando", ROOT_CAUSE: "Causa raíz", ACTION_PLAN: "Plan de acción", IMPLEMENTED: "Implementado", EFFECTIVENESS_VERIFIED: "Eficacia verificada", CLOSED: "Cerrado" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--nf-text-secondary)", borderBottom: "1px solid var(--nf-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function SafetyClient({ initial, sensitive, demo = false }: { initial: SafetyPayload; sensitive?: HealthSurveillancePayload | null; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hazardEditor, setHazardEditor] = useState<SafetyPayload["hazards"][number] | "new" | null>(null);
  const [editor, setEditor] = useState<{ kind: SafetyRecordKind; value: Record<string, unknown>; isNew: boolean } | null>(null);
  const [healthRecordToDelete, setHealthRecordToDelete] = useState<HealthSurveillancePayload["records"][number] | null>(null);
  const [hazardCreateRequested, clearHazardCreate] = useCreateRequest("Nuevo peligro");
  const canManage = initial.canManage && !demo;
  const canUpdate = initial.canUpdate && !demo;
  const s = initial.summary;
  const ind = initial.indicators;

  useEffect(() => {
    if (hazardCreateRequested) {
      setHazardEditor("new");
      clearHazardCreate();
    }
  }, [hazardCreateRequested, clearHazardCreate]);

  function nextOf(status: string): string | null {
    const i = initial.incidentFlow.indexOf(status as never);
    return i >= 0 && i < initial.incidentFlow.length - 1 ? initial.incidentFlow[i + 1] : null;
  }
  function permitNextStatuses(status: string): Array<"ACTIVE" | "SUSPENDED" | "CLOSED" | "EXPIRED"> {
    if (status === "DRAFT") return ["ACTIVE"];
    if (status === "ACTIVE") return ["SUSPENDED", "CLOSED", "EXPIRED"];
    if (status === "SUSPENDED") return ["ACTIVE", "CLOSED"];
    return [];
  }
  function advance(id: string, to: string) {
    setError(null);
    startTransition(async () => {
      try {
        await transitionIncident(id, { to: to as never });
        router.refresh();
        window.dispatchEvent(new Event("normaflow:server-action-success"));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error inesperado.";
        setError(message);
        window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } }));
      }
    });
  }

  function runHazardAction(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
        setHazardEditor(null);
        window.dispatchEvent(new Event("normaflow:server-action-success"));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error inesperado.";
        setError(message);
        window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } }));
      }
    });
  }

  function canCreateKind(kind: SafetyRecordKind) {
    return !demo && (kind === "health" ? Boolean(sensitive?.canManage) : initial.canManage);
  }
  function canEditKind(kind: SafetyRecordKind) {
    return !demo && (kind === "health" ? Boolean(sensitive?.canUpdate) : canUpdate);
  }
  function openEditor(kind: SafetyRecordKind, value: Record<string, unknown> = {}, isNew = true) {
    if (isNew ? canCreateKind(kind) : canEditKind(kind)) setEditor({ kind, value, isNew });
  }
  function saveEditor(payload: Record<string, unknown>) {
    if (!editor) return;
    const action = editor.isNew
      ? () => createSafetyRecord(editor.kind, payload)
      : editor.kind === "health"
        ? () => updateHealthSurveillance(String(editor.value.id), payload)
        : () => updateSafetyRecord(String(editor.value.id), editor.kind as Exclude<SafetyRecordKind, "health">, payload);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setEditor(null);
        router.refresh();
        window.dispatchEvent(new Event("normaflow:server-action-success"));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error inesperado.";
        setError(message);
        window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } }));
      }
    });
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <IsoSectionHeader headingLevel={1} icon={HardHat} title={SECTION_META[tab].title} description={SECTION_META[tab].sub}
        action={demo ? <span style={chip("#eef2ff", "#4f46e5")}>Demo</span> : undefined} />

      {error && <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Peligros" value={s.hazards} />
        <Stat label="Riesgos críticos" value={s.criticalRisks} accent={s.criticalRisks ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "#ea580c" : undefined} />
        <Stat label="Casi accidentes" value={s.nearMisses} />
        <Stat label="Permisos activos" value={s.permits} />
        <Stat label="Acciones vencidas" value={s.overdueActions} accent={s.overdueActions ? "var(--nf-danger-text)" : undefined} />
        {s.surveillance != null && <Stat label="Vigilancia salud" value={s.surveillance} />}
      </div> : <IsoSectionMetrics items={tab === "hazards" ? [{ label: "Peligros", value: s.hazards }, { label: "Riesgos críticos", value: s.criticalRisks, accent: s.criticalRisks ? "var(--nf-danger-text)" : undefined }, { label: "Acciones vencidas", value: s.overdueActions, accent: s.overdueActions ? "var(--nf-danger-text)" : undefined }] : tab === "incidents" ? [{ label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "#ea580c" : undefined }, { label: "Casi accidentes", value: s.nearMisses }, { label: "Acciones vencidas", value: s.overdueActions, accent: s.overdueActions ? "var(--nf-danger-text)" : undefined }] : tab === "inspections" ? [{ label: "Inspecciones", value: initial.inspections.length }, { label: "Hallazgos", value: initial.inspections.filter((row) => Boolean(row.findings)).length, accent: initial.inspections.some((row) => Boolean(row.findings)) ? "var(--nf-warning-text)" : undefined }, { label: "Peligros", value: s.hazards }] : tab === "ppe" ? [{ label: "EPP registrados", value: initial.ppeItems.length }, { label: "Asignaciones", value: initial.ppeItems.reduce((sum, row) => sum + row.assignments, 0) }, { label: "Peligros", value: s.hazards }] : tab === "permits" ? [{ label: "Permisos activos", value: s.permits }, { label: "Permisos registrados", value: initial.permits.length }, { label: "Acciones vencidas", value: s.overdueActions, accent: s.overdueActions ? "var(--nf-danger-text)" : undefined }] : tab === "drills" ? [{ label: "Simulacros", value: initial.drills.length }, { label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "#ea580c" : undefined }, { label: "Acciones vencidas", value: s.overdueActions, accent: s.overdueActions ? "var(--nf-danger-text)" : undefined }] : tab === "contractors" ? [{ label: "Contratistas", value: initial.contractors.length }, { label: "Incidentes", value: initial.contractors.reduce((sum, row) => sum + row.incidents, 0), accent: initial.contractors.some((row) => row.incidents > 0) ? "#ea580c" : undefined }, { label: "Peligros", value: s.hazards }] : [{ label: "Vigilancia registrada", value: s.surveillance ?? 0 }, { label: "Peligros", value: s.hazards }, { label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "#ea580c" : undefined }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen de seguridad y salud</strong><span>Acceso directo a la matriz de peligros.</span></div><IsoQuickCreate modulePath="/app/safety" items={[{ label: "Nuevo peligro", description: "Abrir la matriz de riesgos", section: "hazards", Icon: AlertOctagon }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><BarChart3 size={16} aria-hidden />Indicadores de seguridad (año en curso)</h3>
            <Row k="Índice de frecuencia (IF)" v={ind.frequencyIndex} />
            <Row k="Índice de gravedad (IG)" v={ind.severityIndex} />
            <Row k="Índice de accidentabilidad" v={ind.accidentRate} />
            <Row k="Días perdidos" v={ind.lostDays} />
            <Row k="Casi accidentes" v={ind.nearMisses} />
            <Row k="Inspecciones" v={ind.inspections} />
            <Row k="Acciones vencidas" v={ind.overdueActions} danger={ind.overdueActions > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>IF/IG requieren horas-hombre; configúralas al exportar el informe de indicadores.</p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Siren size={16} aria-hidden />Incidentes por etapa</h3>
            {initial.incidentFlow.map((st) => (
              <div key={st} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                <span>{STATUS_LABEL[st] ?? st}</span><b>{initial.incidentsByStatus[st] ?? 0}</b>
              </div>
            ))}
          </div>
          </div>
        </>
      )}

      {tab === "hazards" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => setHazardEditor("new")}><Plus size={13} /> Nuevo peligro</button>}
          <Table head={["Código", "Actividad", "Tarea", "Peligro", "Categoría", "Expuestos", "N. inherente", "N. residual", "Aceptabilidad", canUpdate ? "Acciones" : ""]}>
          {initial.hazards.map((h) => (
            <tr key={h.id}>
              <td style={td}>{h.code}</td><td style={td}>{h.activity}</td><td style={td}>{h.task ?? "—"}</td><td style={td}>{h.hazard}</td><td style={td}>{h.category}</td><td style={td}>{h.exposedWorkers ?? "—"}</td>
              <td style={td}>{h.inherentLevel ? <span style={toneChip(LEVEL_COLORS[h.inherentLevel])}>{h.inherentLevel}</span> : "—"}</td>
              <td style={td}>{h.residualLevel ? <span style={toneChip(LEVEL_COLORS[h.residualLevel])}>{h.residualLevel}</span> : "—"}</td>
              <td style={td}>{h.acceptability ? (h.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>{ACCEPT_LABEL[h.acceptability]}</span> : ACCEPT_LABEL[h.acceptability]) : "—"}</td>
              {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => setHazardEditor(h)}>Editar</button>{h.assessment && <button type="button" style={miniBtn} onClick={() => openEditor("riskAssessment", h.assessment as unknown as Record<string, unknown>, false)}>Evaluación</button>}<button type="button" style={{ ...miniBtn, color: h.active === false ? "var(--nf-success-text)" : "var(--nf-warning-text)", borderColor: h.active === false ? "var(--nf-success-border)" : "var(--nf-warning-border)", background: h.active === false ? "var(--nf-success-subtle)" : "var(--nf-warning-subtle)" }} disabled={pending} onClick={() => runHazardAction(() => updateHazard(h.id, { active: h.active === false }))}>{h.active === false ? "Activar" : "Archivar"}</button></td>}
            </tr>
          ))}
          {initial.hazards.length === 0 && <tr><td style={td} colSpan={canUpdate ? 10 : 9}>Sin peligros registrados.</td></tr>}
          </Table>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("riskAssessment")}><Plus size={13} /> Nueva evaluación de riesgo</button>}
          {initial.assessments.length > 0 && <Table head={["Peligro", "Probabilidad", "Consecuencia", "Exposición", "Nivel residual", "Aceptabilidad", canUpdate ? "Acciones" : ""]}>
            {initial.assessments.map((a) => <tr key={a.id}><td style={td}>{a.hazard.code} — {a.hazard.hazard}</td><td style={td}>{a.probability}</td><td style={td}>{a.consequence}</td><td style={td}>{a.exposure}</td><td style={td}><span style={toneChip(LEVEL_COLORS[a.residualLevel])}>{a.residualLevel}</span></td><td style={td}>{ACCEPT_LABEL[a.acceptability] ?? a.acceptability}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("riskAssessment", a as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>)}
          </Table>}
          <HazardEditor key={hazardEditor === "new" ? "new" : hazardEditor?.id ?? "none"} value={hazardEditor} pending={pending} error={error} onClose={() => setHazardEditor(null)} onSave={(value) => {
            const { id, exposedWorkers, processId, existingControls, responsibleId, ...fields } = value;
            const payload = { ...fields, ...(exposedWorkers ? { exposedWorkers: Number(exposedWorkers) } : {}), ...(processId ? { processId } : {}), ...(existingControls ? { existingControls } : {}), ...(responsibleId ? { responsibleId } : {}) };
            if (id) runHazardAction(() => updateHazard(id, payload));
            else runHazardAction(() => createHazard(payload));
          }} />
        </div>
      )}

      {tab === "consultations" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("consultation")}><Plus size={13} /> Nueva consulta</button>}
          <Table head={["Código", "Tema", "Método", "Participantes", "Fecha", "Conclusiones", canUpdate ? "Acciones" : ""]}>
            {initial.consultations.map((c) => <tr key={c.id}><td style={td}>{c.code}</td><td style={td}>{c.topic}</td><td style={td}>{c.method}</td><td style={td}>{c.participants ?? "—"}</td><td style={td}>{fmt(c.heldAt)}</td><td style={td}>{c.conclusions ?? "—"}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("consultation", c as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>)}
            {initial.consultations.length === 0 && <tr><td style={td} colSpan={canUpdate ? 7 : 6}>Sin consultas registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "incidents" && (
        <div style={{ display: "grid", gap: 12 }}>
        {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("incident")}><Plus size={13} /> Nuevo incidente</button>}
        <Table head={["Código", "Tipo", "Severidad", "Título", "Fecha", "Días perd.", "Estado", canUpdate ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.incidents.map((i) => {
            const next = nextOf(i.status);
            return (
              <tr key={i.id}>
                <td style={td}>{i.code}</td><td style={td}>{i.type}</td>
                <td style={td}><span style={toneChip(SEV_COLORS[i.severity])}>{i.severity}</span></td>
                <td style={td}>{i.title}</td><td style={td}>{fmt(i.occurredAt)}</td><td style={td}>{i.lostDays}</td>
                <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{STATUS_LABEL[i.status] ?? i.status}</span></td>
                {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("incident", i as unknown as Record<string, unknown>, false)}>Editar</button>{canManage && (next ? <button disabled={pending} onClick={() => advance(i.id, next)} style={miniBtn}><ArrowRight size={12} /> {STATUS_LABEL[next]}</button> : <span style={{ color: "var(--nf-text-subtle)" }}>Cerrado</span>)}</td>}
              </tr>
            );
          })}
          {initial.incidents.length === 0 && <tr><td style={td} colSpan={canUpdate ? 8 : 7}>Sin incidentes registrados.</td></tr>}
        </Table>
        </div>
      )}

      {tab === "inspections" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("inspection")}><Plus size={13} /> Nueva inspección</button>}
          <Table head={["Código", "Tipo", "Área", "Fecha", "Hallazgos", canUpdate ? "Acciones" : ""]}>
            {initial.inspections.map((i) => (<tr key={i.id}><td style={td}>{i.code}</td><td style={td}>{i.type}</td><td style={td}>{i.area ?? "—"}</td><td style={td}>{fmt(i.inspectedAt)}</td><td style={td}>{i.findings ?? "—"}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("inspection", i as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>))}
            {initial.inspections.length === 0 && <tr><td style={td} colSpan={canUpdate ? 6 : 5}>Sin inspecciones.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "ppe" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <div style={{ display: "flex", gap: 8 }}><button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("ppeItem")}><Plus size={13} /> Nuevo EPP</button><button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("ppeAssignment")}><Plus size={13} /> Nueva asignación</button></div>}
          <Table head={["Código", "EPP", "Tipo", "Norma técnica", "Vida útil (m)", "Asignaciones", canUpdate ? "Acciones" : ""]}>
            {initial.ppeItems.map((p) => (<tr key={p.id}><td style={td}>{p.code}</td><td style={td}>{p.name}</td><td style={td}>{p.ppeType}</td><td style={td}>{p.technicalStandard ?? "—"}</td><td style={td}>{p.lifespanMonths ?? "—"}</td><td style={td}>{p.assignments}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("ppeItem", p as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>))}
            {initial.ppeItems.length === 0 && <tr><td style={td} colSpan={canUpdate ? 7 : 6}>Sin EPP registrado.</td></tr>}
          </Table>
          <Table head={["EPP", "Trabajador", "Entrega", "Cantidad", "Capacitación", "Reposición", canUpdate ? "Acciones" : ""]}>
            {initial.ppeAssignments.map((a) => (<tr key={a.id}><td style={td}>{a.ppeItem.code} — {a.ppeItem.name}</td><td style={td}>{a.workerName ?? a.personnelId ?? "—"}</td><td style={td}>{fmt(a.deliveredAt)}</td><td style={td}>{a.quantity}</td><td style={td}>{a.trainingProvided ? "Sí" : "No"}</td><td style={td}>{fmt(a.replacementDate)}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("ppeAssignment", a as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>))}
            {initial.ppeAssignments.length === 0 && <tr><td style={td} colSpan={canUpdate ? 7 : 6}>Sin asignaciones de EPP.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "permits" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("permit")}><Plus size={13} /> Nuevo permiso</button>}
          <Table head={["Código", "Tipo de trabajo", "Área", "Estado", "Vigencia hasta", canUpdate ? "Acciones" : ""]}>
            {initial.permits.map((p) => { const nextStatuses = permitNextStatuses(p.status); return <tr key={p.id}><td style={td}>{p.code}</td><td style={td}>{p.workType}</td><td style={td}>{p.area ?? "—"}</td><td style={td}><span style={chip("#eef2ff", "#4338ca")}>{p.status}</span></td><td style={td}>{fmt(p.validTo)}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("permit", p as unknown as Record<string, unknown>, false)}>Editar</button>{nextStatuses.map((next) => <button key={next} type="button" disabled={pending} style={miniBtn} onClick={() => startTransition(async () => { try { await setPermitStatus(p.id, next); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); } })}>{next === "ACTIVE" ? "Reactivar" : next === "SUSPENDED" ? "Suspender" : next === "CLOSED" ? "Cerrar" : "Expirar"}</button>)}</td>}</tr>; })}
            {initial.permits.length === 0 && <tr><td style={td} colSpan={canUpdate ? 6 : 5}>Sin permisos.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "drills" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("drill")}><Plus size={13} /> Nuevo simulacro</button>}
          <Table head={["Código", "Escenario", "Resultado", "T. respuesta (min)", "Fecha", canUpdate ? "Acciones" : ""]}>
            {initial.drills.map((d) => (<tr key={d.id}><td style={td}>{d.code}</td><td style={td}>{d.scenario}</td><td style={td}>{d.outcome ?? "—"}</td><td style={td}>{d.responseTimeMinutes ?? "—"}</td><td style={td}>{fmt(d.drillDate)}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("drill", d as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>))}
            {initial.drills.length === 0 && <tr><td style={td} colSpan={canUpdate ? 6 : 5}>Sin simulacros.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "contractors" && (
        <div style={{ display: "grid", gap: 12 }}>
          {canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("contractor")}><Plus size={13} /> Nueva evaluación</button>}
          <Table head={["Código", "Contratista", "Evaluación", "Incidentes", "Próxima revisión", canUpdate ? "Acciones" : ""]}>
            {initial.contractors.map((c) => (<tr key={c.id}><td style={td}>{c.code}</td><td style={td}>{c.contractorName ?? "—"}</td><td style={td}>{c.outcome}</td><td style={td}>{c.incidents}</td><td style={td}>{fmt(c.nextReviewDate)}</td>{canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("contractor", c as unknown as Record<string, unknown>, false)}>Editar</button></td>}</tr>))}
            {initial.contractors.length === 0 && <tr><td style={td} colSpan={canUpdate ? 6 : 5}>Sin evaluaciones de contratistas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "health" && (
        sensitive ? (
          <div style={{ display: "grid", gap: 12 }}>
            {sensitive.canManage && <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => openEditor("health")}><Plus size={13} /> Nuevo registro</button>}
            <Table head={["Código", "Trabajador", "Exposición", "Aptitud", "Restricciones", "Próxima revisión", sensitive.canUpdate || sensitive.canDelete ? "Acciones" : ""]}>
              {sensitive.records.map((h) => (<tr key={h.id}><td style={td}>{h.code}</td><td style={td}>{h.workerName ?? "—"}</td><td style={td}>{h.exposure ?? "—"}</td><td style={td}>{h.fitness}</td><td style={td}>{h.restrictions ?? "—"}</td><td style={td}>{fmt(h.nextReviewDate)}</td>{(sensitive.canUpdate || sensitive.canDelete) && <td style={td}>{sensitive.canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("health", h as unknown as Record<string, unknown>, false)}>Editar</button>}{sensitive.canDelete && <button type="button" style={{ ...miniBtn, color: "var(--nf-danger-text)", borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)" }} disabled={pending} onClick={() => setHealthRecordToDelete(h)}>Eliminar</button>}</td>}</tr>))}
              {sensitive.records.length === 0 && <tr><td style={td} colSpan={sensitive.canUpdate || sensitive.canDelete ? 7 : 6}>Sin vigilancia de salud.</td></tr>}
            </Table>
          </div>
        ) : (
          <div style={{ ...card, textAlign: "center", padding: 36, color: "var(--nf-text-secondary)" }}>
            <Lock size={22} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Acceso restringido</p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>La vigilancia de la salud es información médica sensible. Solo roles de gestión (Manager, Compliance Manager, Admin) y Auditor (solo lectura) pueden verla.</p>
          </div>
        )
      )}
      <SafetyRecordEditor
        value={editor}
        pending={pending}
        error={error}
        hazards={initial.hazards}
        ppeItems={initial.ppeItems}
        onClose={() => setEditor(null)}
        onSave={saveEditor}
      />
      {healthRecordToDelete && <ConfirmActionModal open title="Eliminar registro de vigilancia de salud" confirmLabel="Eliminar definitivamente" danger pending={pending} onCancel={() => setHealthRecordToDelete(null)} onConfirm={() => startTransition(async () => {
        try {
          await deleteHealthSurveillance(healthRecordToDelete.id);
          setHealthRecordToDelete(null);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error inesperado.");
        }
      })}>
        Se eliminará el registro {healthRecordToDelete.code}. La vigilancia de salud contiene información sensible y esta acción no se puede deshacer.
      </ConfirmActionModal>}
    </div>
  );
}

const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid var(--nf-warning-text)", background: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" };

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <IsoMetricCard label={label} value={value} accent={accent} />;
}
function Row({ k, v, danger }: { k: string; v: number; danger?: boolean }) {
  return (<div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">{k}</span><b className="nf-iso-dashboard-row-value" style={{ color: danger ? "var(--nf-danger-text)" : undefined }}>{v}</b></div>);
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <IsoTableCard icon={HardHat} headers={head}>{children}</IsoTableCard>;
}

type HazardFormValue = {
  id?: string;
  activity: string;
  task: string;
  hazard: string;
  category: "PHYSICAL" | "CHEMICAL" | "BIOLOGICAL" | "ERGONOMIC" | "PSYCHOSOCIAL" | "MECHANICAL" | "ELECTRICAL" | "FIRE_EXPLOSION" | "LOCATIVE" | "OTHER";
  exposedWorkers: string;
  processId: string;
  existingControls: string;
  responsibleId: string;
};

function HazardEditor({ value, pending, error, onClose, onSave }: {
  value: SafetyPayload["hazards"][number] | "new" | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (value: HazardFormValue) => void;
}) {
  const source = value && value !== "new" ? value : null;
  const [form, setForm] = useState<HazardFormValue>({
    id: source?.id, activity: source?.activity ?? "", task: source?.task ?? "", hazard: source?.hazard ?? "",
    category: (source?.category as HazardFormValue["category"] | undefined) ?? "OTHER",
    exposedWorkers: source?.exposedWorkers != null ? String(source.exposedWorkers) : "",
    processId: source?.processId ?? "", existingControls: source?.existingControls ?? "", responsibleId: source?.responsibleId ?? "",
  });
  const set = <K extends keyof HazardFormValue>(key: K, next: HazardFormValue[K]) => setForm((current) => ({ ...current, [key]: next }));
  return (
    <Modal open={Boolean(value)} onClose={onClose} title={source ? `Editar ${source.code}` : "Nuevo peligro"} width={640}>
      <div className="nf-modal-form nf-iso-create-form">
        {error && <div className="nf-modal-error" role="alert">{error}</div>}
        <div className="nf-iso-create-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Actividad<input className="nf-app-input" value={form.activity} onChange={(e) => set("activity", e.target.value)} /></label>
          <label>Tarea<input className="nf-app-input" value={form.task} onChange={(e) => set("task", e.target.value)} /></label>
        </div>
        <label>Peligro<input className="nf-app-input" value={form.hazard} onChange={(e) => set("hazard", e.target.value)} /></label>
        <label>Controles existentes<textarea className="nf-app-input" rows={2} value={form.existingControls} onChange={(e) => set("existingControls", e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Categoría<select className="nf-app-input" value={form.category} onChange={(e) => set("category", e.target.value as HazardFormValue["category"])}>
            {Object.keys(LEVEL_COLORS).length > 0 && ["PHYSICAL", "CHEMICAL", "BIOLOGICAL", "ERGONOMIC", "PSYCHOSOCIAL", "MECHANICAL", "ELECTRICAL", "FIRE_EXPLOSION", "LOCATIVE", "OTHER"].map((category) => <option key={category} value={category}>{category}</option>)}
          </select></label>
          <label>Trabajadores expuestos<input className="nf-app-input" type="number" min={0} value={form.exposedWorkers} onChange={(e) => set("exposedWorkers", e.target.value)} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Proceso ID<input className="nf-app-input" value={form.processId} onChange={(e) => set("processId", e.target.value)} /></label><label>Responsable ID<input className="nf-app-input" value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)} /></label></div>
        <div className="nf-modal-actions nf-iso-create-form-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" disabled={pending || !form.activity.trim() || !form.hazard.trim()} onClick={() => onSave({ ...form, exposedWorkers: form.exposedWorkers ? form.exposedWorkers : "" })}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

type SafetyEditorValue = { kind: SafetyRecordKind; value: Record<string, unknown>; isNew: boolean } | null;
type SafetyField = { key: string; label: string; type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox"; options?: string[]; required?: boolean };

const SAFETY_FIELDS: Record<SafetyRecordKind, SafetyField[]> = {
  riskAssessment: [
    { key: "hazardId", label: "Peligro", type: "select", required: true }, { key: "probability", label: "Probabilidad", type: "number", required: true },
    { key: "consequence", label: "Consecuencia", type: "number", required: true }, { key: "exposure", label: "Exposición", type: "number", required: true },
    { key: "controls", label: "Controles", type: "textarea" }, { key: "controlEffectiveness", label: "Eficacia de controles (%)", type: "number" }, { key: "assessorId", label: "Evaluador ID" }, { key: "riskId", label: "Riesgo relacionado ID" },
  ],
  consultation: [
    { key: "topic", label: "Tema", required: true }, { key: "method", label: "Método", type: "select", options: ["MEETING", "SURVEY", "COMMITTEE", "SUGGESTION", "TRAINING", "OTHER"], required: true },
    { key: "participants", label: "Participantes", type: "number" }, { key: "participantsNote", label: "Detalle de participantes", type: "textarea" }, { key: "heldAt", label: "Fecha", type: "date" }, { key: "conclusions", label: "Conclusiones", type: "textarea" }, { key: "decisions", label: "Decisiones", type: "textarea" }, { key: "documentId", label: "Documento relacionado ID" },
  ],
  inspection: [
    { key: "locationId", label: "Ubicación ID" }, { key: "area", label: "Área" }, { key: "type", label: "Tipo", type: "select", options: ["PLANNED", "UNPLANNED", "BEHAVIORAL", "CONDITION", "LEGAL", "OTHER"], required: true }, { key: "inspectorId", label: "Inspector ID" }, { key: "findings", label: "Hallazgos", type: "textarea" }, { key: "actions", label: "Acciones", type: "textarea" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "capaId", label: "CAPA ID" }, { key: "inspectedAt", label: "Fecha", type: "date" },
  ],
  ppeItem: [
    { key: "name", label: "Nombre", required: true }, { key: "ppeType", label: "Tipo", required: true }, { key: "technicalStandard", label: "Norma técnica" }, { key: "lifespanMonths", label: "Vida útil (meses)", type: "number" }, { key: "maintenance", label: "Mantenimiento", type: "textarea" }, { key: "active", label: "Activo", type: "checkbox" },
  ],
  ppeAssignment: [
    { key: "ppeItemId", label: "EPP", type: "select", required: true }, { key: "personnelId", label: "Trabajador ID" }, { key: "workerName", label: "Nombre del trabajador" }, { key: "deliveredAt", label: "Fecha de entrega", type: "date" }, { key: "quantity", label: "Cantidad", type: "number", required: true }, { key: "trainingProvided", label: "Capacitación proporcionada", type: "checkbox" }, { key: "trainingCourseId", label: "Curso relacionado ID" }, { key: "replacementDate", label: "Fecha de reposición", type: "date" }, { key: "evidenceId", label: "Evidencia/firma ID" }, { key: "signatureNote", label: "Nota de firma", type: "textarea" },
  ],
  permit: [
    { key: "workType", label: "Tipo de trabajo", type: "select", options: ["HOT_WORK", "CONFINED_SPACE", "WORK_AT_HEIGHT", "ELECTRICAL", "EXCAVATION", "LOCKOUT_TAGOUT", "LIFTING", "OTHER"], required: true }, { key: "locationId", label: "Ubicación ID" }, { key: "area", label: "Área" }, { key: "hazards", label: "Peligros", type: "textarea" }, { key: "controls", label: "Controles", type: "textarea" }, { key: "authorizerId", label: "Autorizador ID" }, { key: "validFrom", label: "Válido desde", type: "date" }, { key: "validTo", label: "Válido hasta", type: "date" },
  ],
  incident: [
    { key: "type", label: "Tipo", type: "select", options: ["ACCIDENT", "INCIDENT", "NEAR_MISS", "OCCUPATIONAL_ILLNESS"], required: true }, { key: "severity", label: "Severidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true }, { key: "title", label: "Título", required: true }, { key: "description", label: "Descripción", type: "textarea" }, { key: "injury", label: "Lesión", type: "textarea" }, { key: "illness", label: "Enfermedad", type: "textarea" }, { key: "occurredAt", label: "Fecha", type: "date" }, { key: "locationId", label: "Ubicación ID" }, { key: "area", label: "Área" }, { key: "personnelId", label: "Trabajador ID" }, { key: "workerName", label: "Nombre del trabajador" }, { key: "lostDays", label: "Días perdidos", type: "number", required: true }, { key: "responsibleId", label: "Responsable ID" },
  ],
  drill: [
    { key: "scenario", label: "Escenario", required: true }, { key: "participants", label: "Participantes", type: "number" }, { key: "participantsNote", label: "Detalle de participantes", type: "textarea" }, { key: "responseTimeMinutes", label: "Tiempo de respuesta (minutos)", type: "number" }, { key: "outcome", label: "Resultado", type: "select", options: ["PASSED", "PARTIAL", "FAILED"] }, { key: "failures", label: "Fallos", type: "textarea" }, { key: "actions", label: "Acciones", type: "textarea" }, { key: "drillDate", label: "Fecha", type: "date" }, { key: "evidenceId", label: "Evidencia ID" },
  ],
  contractor: [
    { key: "supplierId", label: "Proveedor ID" }, { key: "contractorName", label: "Contratista" }, { key: "risks", label: "Riesgos", type: "textarea" }, { key: "requirements", label: "Requisitos", type: "textarea" }, { key: "documentation", label: "Documentación", type: "textarea" }, { key: "outcome", label: "Evaluación", type: "select", options: ["APPROVED", "CONDITIONAL", "REJECTED", "UNDER_REVIEW"], required: true }, { key: "score", label: "Puntuación", type: "number" }, { key: "incidents", label: "Incidentes", type: "number", required: true }, { key: "assessedAt", label: "Fecha de evaluación", type: "date" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }, { key: "evidenceId", label: "Evidencia ID" },
  ],
  health: [
    { key: "workerName", label: "Nombre del trabajador" }, { key: "personnelId", label: "Trabajador ID" }, { key: "positionId", label: "Puesto ID" }, { key: "exposure", label: "Exposición", type: "textarea" }, { key: "protocol", label: "Protocolo", type: "textarea" }, { key: "fitness", label: "Aptitud", type: "select", options: ["FIT", "FIT_WITH_RESTRICTIONS", "TEMPORARILY_UNFIT", "UNFIT", "PENDING"], required: true }, { key: "restrictions", label: "Restricciones", type: "textarea" }, { key: "examinedAt", label: "Fecha de examen", type: "date" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }, { key: "evidenceId", label: "Evidencia ID" },
  ],
};

function inputValue(value: unknown, field: SafetyField) {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "date") return value ? new Date(String(value)).toISOString().slice(0, 10) : "";
  return value == null ? "" : String(value);
}

function SafetyRecordEditor({ value, pending, error, hazards, ppeItems, onClose, onSave }: { value: SafetyEditorValue; pending: boolean; error?: string | null; hazards: SafetyPayload["hazards"]; ppeItems: SafetyPayload["ppeItems"]; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const source = value?.value ?? {};
  const fields = value ? SAFETY_FIELDS[value.kind] : [];
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    if (!value) return;
    const next: Record<string, string | number | boolean> = {};
    for (const field of fields) next[field.key] = inputValue(source[field.key], field) as string | boolean;
    if (value.isNew) {
      if (value.kind === "riskAssessment") Object.assign(next, { probability: 1, consequence: 1, exposure: 1 });
      if (value.kind === "ppeItem") next.active = true;
      if (value.kind === "ppeAssignment") Object.assign(next, { quantity: 1, trainingProvided: false });
      if (value.kind === "incident") next.lostDays = 0;
      if (value.kind === "contractor") Object.assign(next, { incidents: 0, outcome: "UNDER_REVIEW" });
    }
    setForm(next);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!value) return null;
  const set = (key: string, next: string | number | boolean) => setForm((current) => ({ ...current, [key]: next }));
  const valid = fields.filter((field) => field.required).every((field) => form[field.key] !== "" && form[field.key] != null);
  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = form[field.key];
      if (field.type === "checkbox") payload[field.key] = Boolean(raw);
      else if (field.type === "number") { if (raw !== "" && raw != null) payload[field.key] = Number(raw); }
      else if (field.type === "date") { if (raw) payload[field.key] = new Date(String(raw)).toISOString(); }
      else if (raw !== "") payload[field.key] = raw;
    }
    onSave(payload);
  };
  const options = (field: SafetyField) => field.key === "hazardId" ? hazards.map((h) => ({ value: h.id, label: `${h.code} — ${h.hazard}` })) : field.key === "ppeItemId" ? ppeItems.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })) : (field.options ?? []).map((option) => ({ value: option, label: option }));
  return <Modal open title={`${value.isNew ? "Nuevo" : "Editar"} ${SECTION_META[value.kind === "health" ? "health" : value.kind === "riskAssessment" ? "hazards" : value.kind === "consultation" ? "consultations" : "panel"].title.toLowerCase()}`} onClose={onClose} width={760}>
    <div className="nf-modal-form nf-iso-create-form" style={{ display: "grid", gap: 10 }}>
      {error && <div className="nf-modal-error" role="alert">{error}</div>}
      <div className="nf-iso-create-fields" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {fields.map((field) => field.type === "checkbox" ? <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => set(field.key, e.target.checked)} />{field.label}</label> : <label key={field.key}>{field.label}{field.type === "textarea" ? <textarea className="nf-app-input" rows={3} value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} /> : field.type === "select" ? <select className="nf-app-input" value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)}><option value="">Seleccionar…</option>{options(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="nf-app-input" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} />}</label>)}
      </div>
      <div className="nf-modal-actions nf-iso-create-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !valid} onClick={submit}>Guardar</button></div>
    </div>
  </Modal>;
}
