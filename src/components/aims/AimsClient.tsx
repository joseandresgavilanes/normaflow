"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, LayoutDashboard, Boxes, Scale, AlertTriangle, Database, Cpu, UserCheck, Megaphone, Siren, Handshake, GitCompare, Activity, ArrowRight, Check, X, Send, Plus } from "lucide-react";
import type { AimsPayload } from "@/lib/aims/queries";
import {
  decideHumanReview, submitForHumanReview, transitionAIIncident,
  createAISystem, updateAISystem, approveAISystem, setAISystemStatus, createAIUseCase,
  createImpactAssessment, updateImpactAssessment,
  createAIRisk, updateAIRisk, acceptAIRisk,
  createDataset, assessDatasetQuality, reviewDatasetBias, createDataSource, addDataLineageStep,
  createModelVersion, createModelEvaluation, promoteModelToProduction,
  createOversightControl, verifyOversightControl,
  createTransparencyRecord, reportAIIncident,
  createSupplierAssessment,
  createAIChangeRequest, implementAIChangeRequest,
  recordPerformanceMetric,
  recordAIOutput, editAIOutput, reopenForCorrection, promoteAIOutput,
  updateAimsRecord, type AimsRecordKind,
} from "@/lib/actions/aims";
import { nextSystemStatuses } from "@/lib/aims/lifecycle";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ActionDialogsProvider, usePromptAction } from "@/components/ui/ActionDialogs";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";
import { toneChip } from "@/lib/tone";

type Tab = "panel" | "systems" | "outputs" | "impact" | "risks" | "datasets" | "models" | "oversight" | "transparency" | "incidents" | "suppliers" | "changes" | "monitoring";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Sistema de Gestión de Inteligencia Artificial", sub: "ISO/IEC 42001:2023 — visión general de inventario, impacto, datos, modelos, supervisión e incidentes." },
  systems: { title: "Sistemas y casos de uso", sub: "Inventario de sistemas de IA, propósito, clasificación y estado operativo." },
  outputs: { title: "Salidas y revisión humana", sub: "Resultados de IA sujetos a revisión, aprobación y trazabilidad humana." },
  impact: { title: "Evaluaciones de impacto", sub: "Evaluación de impactos, medidas de mitigación y decisión de uso." },
  risks: { title: "Riesgos de inteligencia artificial", sub: "Riesgos, niveles residuales y aceptación por sistema." },
  datasets: { title: "Datasets y calidad de datos", sub: "Conjuntos de datos, procedencia, calidad, privacidad y sesgo." },
  models: { title: "Modelos y versiones", sub: "Versionado, evaluación, validación y promoción a producción." },
  oversight: { title: "Supervisión humana", sub: "Controles, responsables y evidencias de supervisión humana." },
  transparency: { title: "Transparencia", sub: "Registros para explicar sistemas, decisiones y comunicación a las partes interesadas." },
  incidents: { title: "Incidentes de IA", sub: "Incidentes, notificación, investigación y acciones de respuesta." },
  suppliers: { title: "Proveedores de IA", sub: "Evaluación y seguimiento de proveedores que soportan sistemas de IA." },
  changes: { title: "Cambios de IA", sub: "Solicitudes de cambio, impacto, revisión e implementación controlada." },
  monitoring: { title: "Monitoreo y desempeño", sub: "Métricas, umbrales, desviaciones y detección de deriva." },
};

const LEVEL_COLORS: Record<string, string> = { LOW: "var(--nf-success)", MEDIUM: "var(--nf-warning)", MODERATE: "var(--nf-warning)", HIGH: "var(--nf-warning)", CRITICAL: "var(--nf-danger-text)", SEVERE: "var(--nf-danger-text)" };
const CLASS_COLORS: Record<string, string> = { NOT_CLASSIFIED: "var(--nf-text-secondary)", MINIMAL: "var(--nf-success)", LIMITED: "var(--nf-warning)", HIGH: "var(--nf-warning)", UNACCEPTABLE: "var(--nf-danger-text)" };
const CLASS_LABEL: Record<string, string> = { NOT_CLASSIFIED: "Sin clasificar", MINIMAL: "Mínimo", LIMITED: "Limitado", HIGH: "Alto", UNACCEPTABLE: "Inaceptable" };
const REVIEW_COLORS: Record<string, string> = { DRAFT: "var(--nf-text-secondary)", HUMAN_REVIEW: "var(--nf-warning)", APPROVED: "var(--nf-success)", REJECTED: "var(--nf-danger-text)" };
const REVIEW_LABEL: Record<string, string> = { DRAFT: "Borrador", HUMAN_REVIEW: "En revisión humana", APPROVED: "Aprobado", REJECTED: "Rechazado" };
const STATUS_LABEL: Record<string, string> = { PLANNED: "Planificado", IN_DEVELOPMENT: "En desarrollo", IN_VALIDATION: "En validación", APPROVED: "Aprobado", IN_PRODUCTION: "En producción", SUSPENDED: "Suspendido", RETIRED: "Retirado" };
const INCIDENT_LABEL: Record<string, string> = { REPORTED: "Reportado", TRIAGED: "Triado", INVESTIGATING: "Investigando", ROOT_CAUSE: "Causa raíz", ACTION_PLAN: "Plan de acción", IMPLEMENTED: "Implementado", EFFECTIVENESS_VERIFIED: "Eficacia verificada", CLOSED: "Cerrado" };
const INCIDENT_FLOW = ["REPORTED", "TRIAGED", "INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"];
const ACCEPT_LABEL: Record<string, string> = { ACCEPTABLE: "Aceptable", TOLERABLE: "Tolerable", NOT_ACCEPTABLE: "No aceptable" };
const QUALITY_LABEL: Record<string, string> = { NOT_ASSESSED: "Sin valorar", POOR: "Pobre", ACCEPTABLE: "Aceptable", GOOD: "Buena", EXCELLENT: "Excelente" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line)", borderRadius: 14, padding: 18, background: "var(--nf-surface)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--nf-text-secondary)", borderBottom: "1px solid var(--nf-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid var(--nf-info-text)", background: "var(--nf-info-subtle)", color: "var(--nf-info-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const pct = (v: number | null | undefined) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

export default function AimsClient(props: { initial: AimsPayload; demo?: boolean }) {
  return <ActionDialogsProvider><AimsClientContent {...props} /></ActionDialogsProvider>;
}

function AimsClientContent({ initial, demo = false }: { initial: AimsPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const requestPrompt = usePromptAction();
  const canManage = initial.canManage && !demo;
  const canUpdate = initial.canUpdate && !demo;
  const canApprove = initial.canApprove && !demo;
  const s = initial.summary;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";
  const systemCode = (id: string | null | undefined) => initial.systems.find((x) => x.id === id)?.code ?? "—";
  const [editor, setEditor] = useState<{ kind: AimsRecordKind; value: Record<string, unknown> } | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); router.refresh(); window.dispatchEvent(new Event("normaflow:server-action-success")); } catch (e) { const message = e instanceof Error ? e.message : "Error inesperado."; setError(message); window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } })); }
    });
  }
  function openEditor(kind: AimsRecordKind, value: Record<string, unknown>) {
    if (canUpdate) setEditor({ kind, value });
  }
  function saveEditor(payload: Record<string, unknown>) {
    if (!editor) return;
    const action = editor.kind === "system" ? () => updateAISystem(String(editor.value.id), payload)
      : editor.kind === "impactAssessment" ? () => updateImpactAssessment(String(editor.value.id), payload as never)
        : editor.kind === "risk" ? () => updateAIRisk(String(editor.value.id), payload as never)
          : () => updateAimsRecord(String(editor.value.id), editor.kind as Exclude<AimsRecordKind, "system" | "impactAssessment" | "risk">, payload);
    run(async () => { await action(); setEditor(null); });
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <IsoSectionHeader headingLevel={1} icon={BrainCircuit} title={SECTION_META[tab].title} description={SECTION_META[tab].sub}
        action={demo ? <span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>Demo</span> : undefined} />

      {error && <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}

      {s.humanRuleViolations > 0 && (
        <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>
          <b>Regla humana incumplida:</b> {s.humanRuleViolations} salida(s) de IA con decisión sin revisor, sin fecha o promovida sin aprobación. Revísalas en la pestaña de revisión humana.
        </div>
      )}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Sistemas de IA" value={s.systems} />
        <Stat label="En producción" value={s.inProduction} />
        <Stat label="Riesgo alto" value={s.highRisk} accent={s.highRisk ? "var(--nf-warning-text)" : undefined} />
        <Stat label="Sin salvaguardas" value={s.systemsMissingSafeguards} accent={s.systemsMissingSafeguards ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Pendientes de revisión" value={s.outputsAwaitingReview} accent={s.outputsAwaitingReview ? "var(--nf-warning-text)" : undefined} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "var(--nf-warning-text)" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "systems" ? [{ label: "Sistemas registrados", value: s.systems }, { label: "En producción", value: s.inProduction }, { label: "Casos de uso", value: s.useCases }] : tab === "outputs" ? [{ label: "Salidas registradas", value: initial.outputs.length }, { label: "Pendientes de revisión", value: s.outputsAwaitingReview, accent: s.outputsAwaitingReview ? "var(--nf-warning-text)" : undefined }, { label: "Aprobadas", value: s.outputsApproved }] : tab === "impact" ? [{ label: "Evaluaciones aprobadas", value: s.approvedAssessments }, { label: "Pendientes", value: s.pendingAssessments, accent: s.pendingAssessments ? "var(--nf-warning-text)" : undefined }, { label: "Sistemas", value: s.systems }] : tab === "risks" ? [{ label: "Riesgos registrados", value: s.risks }, { label: "No aceptables", value: s.unacceptableRisks, accent: s.unacceptableRisks ? "var(--nf-danger-text)" : undefined }, { label: "Riesgo alto", value: s.highRisk, accent: s.highRisk ? "var(--nf-warning-text)" : undefined }] : tab === "datasets" ? [{ label: "Datasets", value: s.datasets }, { label: "Con datos personales", value: s.datasetsWithPersonalData }, { label: "Sin revisión de sesgo", value: s.datasetsWithoutBiasReview, accent: s.datasetsWithoutBiasReview ? "var(--nf-warning-text)" : undefined }] : tab === "models" ? [{ label: "Modelos registrados", value: s.models }, { label: "En producción", value: s.modelsInProduction }, { label: "Esperando revisión", value: s.modelsAwaitingReview, accent: s.modelsAwaitingReview ? "var(--nf-warning-text)" : undefined }] : tab === "oversight" ? [{ label: "Controles humanos", value: s.controls }, { label: "Sistemas sin salvaguardas", value: s.systemsMissingSafeguards, accent: s.systemsMissingSafeguards ? "var(--nf-danger-text)" : undefined }, { label: "Incumplimientos", value: s.humanRuleViolations, accent: s.humanRuleViolations ? "var(--nf-danger-text)" : undefined }] : tab === "transparency" ? [{ label: "Registros de transparencia", value: s.transparencyRecords }, { label: "Sistemas", value: s.systems }, { label: "Salidas aprobadas", value: s.outputsApproved }] : tab === "incidents" ? [{ label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "var(--nf-warning-text)" : undefined }, { label: "Requieren notificación", value: s.incidentsRequiringNotification, accent: s.incidentsRequiringNotification ? "var(--nf-danger-text)" : undefined }, { label: "Sistemas", value: s.systems }] : tab === "suppliers" ? [{ label: "Proveedores evaluados", value: s.suppliers }, { label: "Pendientes", value: s.suppliersPending, accent: s.suppliersPending ? "var(--nf-warning-text)" : undefined }, { label: "Sistemas", value: s.systems }] : tab === "changes" ? [{ label: "Cambios registrados", value: initial.changes.length }, { label: "Esperando revisión", value: s.changesAwaitingReview, accent: s.changesAwaitingReview ? "var(--nf-warning-text)" : undefined }, { label: "Sistemas", value: s.systems }] : [{ label: "Métricas registradas", value: initial.metrics.length }, { label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "var(--nf-warning-text)" : undefined }, { label: "Sistemas en producción", value: s.inProduction }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen de gobernanza de IA</strong><span>Accesos directos a los registros de gobernanza.</span></div><IsoQuickCreate modulePath="/app/aims" items={[{ label: "Nuevo sistema de IA", description: "Registrar un sistema", section: "systems", Icon: Boxes }, { label: "Nuevo caso de uso", description: "Definir un uso previsto", section: "systems", Icon: BrainCircuit }, { label: "Nueva evaluación de impacto", description: "Valorar impactos del sistema", section: "impact", Icon: Scale }, { label: "Nuevo riesgo de IA", description: "Registrar un riesgo", section: "risks", Icon: AlertTriangle }, { label: "Nuevo dataset", description: "Registrar un conjunto de datos", section: "datasets", Icon: Database }, { label: "Nueva versión de modelo", description: "Versionar un modelo", section: "models", Icon: Cpu }, { label: "Nuevo control de supervisión", description: "Configurar control humano", section: "oversight", Icon: UserCheck }, { label: "Reportar incidente de IA", description: "Registrar incidente", section: "incidents", Icon: Siren }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><UserCheck size={16} aria-hidden />Regla humana (§A.9.2)</h3>
            <Row k="Salidas en revisión humana" v={s.outputsAwaitingReview} />
            <Row k="Aprobadas por una persona" v={s.outputsApproved} />
            <Row k="Rechazadas" v={s.outputsRejected} />
            <Row k="Promovidas a registro oficial" v={s.outputsPromoted} />
            <Row k="Incumplimientos detectados" v={s.humanRuleViolations} danger={s.humanRuleViolations > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>Ninguna salida de IA se convierte en registro oficial sin pasar por DRAFT → HUMAN_REVIEW → APPROVED.</p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Database size={16} aria-hidden />Gobernanza de datos y modelos</h3>
            <Row k="Datasets" v={s.datasets} />
            <Row k="Con datos personales" v={s.datasetsWithPersonalData} />
            <Row k="Sin revisión de sesgo" v={s.datasetsWithoutBiasReview} danger={s.datasetsWithoutBiasReview > 0} />
            <Row k="Modelos registrados" v={s.models} />
            <Row k="Modelos en producción" v={s.modelsInProduction} />
            <Row k="Modelos esperando revisión" v={s.modelsAwaitingReview} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Scale size={16} aria-hidden />Riesgos, impacto y supervisión</h3>
            <Row k="Riesgos de IA" v={s.risks} />
            <Row k="Riesgo no aceptable" v={s.unacceptableRisks} danger={s.unacceptableRisks > 0} />
            <Row k="Evaluaciones aprobadas" v={s.approvedAssessments} />
            <Row k="Evaluaciones en revisión" v={s.pendingAssessments} />
            <Row k="Controles de supervisión" v={s.controls} />
            <Row k="Registros de transparencia" v={s.transparencyRecords} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Activity size={16} aria-hidden />Monitoreo continuo (§A.6.2.6)</h3>
            <Row k="Mediciones registradas" v={s.monitoring.measurements} />
            <Row k="Umbrales incumplidos" v={s.monitoring.breached} danger={s.monitoring.breached > 0} />
            <Row k="Con deriva detectada" v={s.monitoring.drifting} danger={s.monitoring.drifting > 0} />
            <Row k="Sistemas afectados" v={s.monitoring.systemsWithBreach} />
            <Row k="En producción sin monitorear" v={s.monitoring.unmonitoredSystems} danger={s.monitoring.unmonitoredSystems > 0} />
            <Row k="Incidentes por notificar" v={s.incidentsRequiringNotification} danger={s.incidentsRequiringNotification > 0} />
          </div>
          </div>
        </>
      )}

      {tab === "systems" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nuevo sistema de IA">
              {(close) => <NewSystemForm members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Propietario", "Proveedor", "Criticidad", "Clasificación", "Autonomía", "Estado", "Salvaguardas faltantes", canUpdate || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.systems.map((system) => (
              <tr key={system.id}>
                <td style={td}>{system.code}</td>
                <td style={td}><b>{system.name}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{system.purpose}</div></td>
                <td style={td}>{nameOf(system.ownerId)}</td>
                <td style={td}>{system.provider ?? "—"}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{system.providerType}</div></td>
                <td style={td}><span style={toneChip(LEVEL_COLORS[system.criticality])}>{system.criticality}</span></td>
                <td style={td}><span style={toneChip(CLASS_COLORS[system.classification])}>{CLASS_LABEL[system.classification]}</span></td>
                <td style={td}>{system.autonomy}</td>
                <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{STATUS_LABEL[system.status] ?? system.status}</span></td>
                <td style={td}>{system.missingSafeguards.length ? <span style={{ color: "var(--nf-danger-text)" }}>{system.missingSafeguards.join(", ")}</span> : <span style={{ color: "var(--nf-success-text)" }}>completas</span>}</td>
                {(canUpdate || canApprove) && (
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 220 }}>
                      {canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("system", system as unknown as Record<string, unknown>)}>Editar</button>}
                      {canApprove && system.status === "IN_VALIDATION" && (
                        <button disabled={pending} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }} onClick={() => run(() => approveAISystem(system.id))}><Check size={12} /> Aprobar</button>
                      )}
                      {canManage && system.status !== "RETIRED" && (
                        <select aria-label="Cambiar estado" style={{ ...input, padding: "3px 6px", fontSize: 11 }} value="" onChange={(e) => {
                          const to = e.target.value;
                          if (!to) return;
                          if (to === "RETIRED") {
                            requestPrompt({ title: "Retirar sistema de IA", label: "Motivo del retiro", placeholder: "Explica por qué se retira el sistema…", onConfirm: (retirementReason) => requestPrompt({ title: "Retirar sistema de IA", label: "Plan de disposición de datos y modelos", placeholder: "Describe cómo se conservarán o eliminarán los datos y modelos…", onConfirm: (retirementPlan) => run(() => setAISystemStatus(system.id, { to: to as never, retirementReason, retirementPlan })) }) });
                          } else {
                            run(() => setAISystemStatus(system.id, { to: to as never }));
                          }
                        }}>
                          <option value="">Cambiar estado…</option>
                          {nextSystemStatuses(system.status).filter((s) => s !== "APPROVED").map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.systems.length === 0 && <tr><td style={td} colSpan={10}>Sin sistemas de IA registrados.</td></tr>}
          </Table>

          <div>
            <IsoSectionHeader icon={BrainCircuit} title="Casos de uso" description="Relaciona cada sistema con su propósito, autonomía y personas potencialmente afectadas." />
            {canManage && (
              <NewFormToggle label="Nuevo caso de uso">
                {(close) => <NewUseCaseForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
              </NewFormToggle>
            )}
            <Table head={["Código", "Sistema", "Caso de uso", "Objetivo", "Autonomía de decisión", "Personas afectadas", canUpdate ? "Acciones" : ""]}>
              {initial.useCases.map((u) => (
                <tr key={u.id}>
                  <td style={td}>{u.code}</td>
                  <td style={td}>{systemCode(u.systemId)}</td>
                  <td style={td}>{u.title}</td>
                  <td style={td}>{u.objective}</td>
                  <td style={td}>{u.decisionAutonomy}</td>
                  <td style={td}>{u.affectedCount ?? "—"}</td>
                  {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("useCase", u as unknown as Record<string, unknown>)}>Editar</button></td>}
                </tr>
              ))}
            {initial.useCases.length === 0 && <tr><td style={td} colSpan={canUpdate ? 7 : 6}>Sin casos de uso registrados.</td></tr>}
            </Table>
          </div>
        </div>
      )}

      {tab === "outputs" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...card, borderColor: "var(--nf-info-border)", background: "var(--nf-info-subtle)", color: "var(--nf-info-text)", fontSize: 13 }}>
            Toda salida de IA queda aquí con su prompt, modelo, versión, autor y cambios humanos. Solo una persona con permiso de aprobación puede llevarla a APPROVED, y solo entonces puede promoverse a un registro oficial.
          </div>
          {canManage && (
            <NewFormToggle label="Registrar salida de IA manualmente">
              {(close) => <NewOutputForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Modelo", "Versión", "Solicitó", "Fecha", "Editada", "Datos personales", "Estado", "Revisor", "Promovida", canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.outputs.map((output) => (
              <OutputRow key={output.id} output={output} systemCode={systemCode} nameOf={nameOf} canManage={canManage} canApprove={canApprove} pending={pending} run={run} />
            ))}
            {initial.outputs.length === 0 && <tr><td style={td} colSpan={12}>Sin salidas de IA registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "impact" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nueva evaluación de impacto">
              {(close) => <NewAssessmentForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Sistema", "Evaluación", "Versión", "Severidad agregada", "Clasificación", "Revisión humana", canUpdate || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.assessments.map((a) => (
              <tr key={a.id}>
                <td style={td}>{systemCode(a.systemId)}</td>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.version}</td>
                <td style={td}><span style={toneChip(LEVEL_COLORS[a.overallSeverity] ?? "var(--nf-text-secondary)")}>{a.overallSeverity}</span></td>
                <td style={td}><span style={toneChip(CLASS_COLORS[a.classification])}>{CLASS_LABEL[a.classification]}</span></td>
                <td style={td}><span style={toneChip(REVIEW_COLORS[a.reviewStatus])}>{REVIEW_LABEL[a.reviewStatus]}</span></td>
                {(canUpdate || canApprove) && (
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {canUpdate && a.reviewStatus === "DRAFT" && <><button type="button" style={miniBtn} onClick={() => openEditor("impactAssessment", a as unknown as Record<string, unknown>)}>Editar</button><button disabled={pending} onClick={() => run(() => submitForHumanReview("impactAssessment", a.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button></>}
                      {canApprove && a.reviewStatus === "HUMAN_REVIEW" && (
                        <>
                          <button disabled={pending} onClick={() => run(() => decideHumanReview("impactAssessment", a.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }}><Check size={12} /> Aprobar</button>
                          <button disabled={pending} onClick={() => requestPrompt({ title: "Rechazar evaluación de impacto", label: "Motivo del rechazo", placeholder: "Describe el motivo de la devolución…", onConfirm: (note) => run(() => decideHumanReview("impactAssessment", a.id, { to: "REJECTED", note })) })} style={{ ...miniBtn, borderColor: "var(--nf-danger)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}><X size={12} /> Rechazar</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.assessments.length === 0 && <tr><td style={td} colSpan={7}>Sin evaluaciones de impacto registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "risks" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nuevo riesgo de IA">
              {(close) => <NewRiskForm systems={initial.systems} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Riesgo", "Categoría", "P×I", "Inherente", "Residual", "Aceptabilidad", "Tratamiento", "Estado", "Responsable", canUpdate || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.risks.map((risk) => (
              <tr key={risk.id}>
                <td style={td}>{risk.code}</td>
                <td style={td}>{systemCode(risk.systemId)}</td>
                <td style={td}>{risk.title}</td>
                <td style={td}>{risk.category}</td>
                <td style={td}>{risk.likelihood}×{risk.impact}</td>
                <td style={td}><span style={toneChip(LEVEL_COLORS[risk.inherentLevel])}>{risk.inherentScore ?? "—"}</span></td>
                <td style={td}><span style={toneChip(LEVEL_COLORS[risk.residualLevel])}>{risk.residualScore ?? "—"}</span></td>
                <td style={td}>{risk.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>{ACCEPT_LABEL[risk.acceptability]}</span> : ACCEPT_LABEL[risk.acceptability]}</td>
                <td style={td}>{risk.treatment}</td>
                <td style={td}>{risk.status}</td>
                <td style={td}>{nameOf(risk.ownerId)}</td>
                {(canUpdate || canApprove) && <td style={td}>{canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("risk", risk as unknown as Record<string, unknown>)}>Editar</button>}{canApprove && risk.status !== "ACCEPTED" && <button disabled={pending} style={miniBtn} onClick={() => requestPrompt({ title: "Aceptar riesgo de IA", label: "Justificación de la aceptación", placeholder: "Explica por qué el riesgo es aceptable…", onConfirm: (rationale) => run(() => acceptAIRisk(risk.id, rationale)) })}>Aceptar riesgo</button>}</td>}
              </tr>
            ))}
            {initial.risks.length === 0 && <tr><td style={td} colSpan={canUpdate || canApprove ? 12 : 11}>Sin riesgos de IA registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "datasets" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nuevo dataset">
              {(close) => <NewDatasetForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Dataset", "Clasificación", "Datos personales", "Base legal", "Registros", "Calidad", "Fuentes", "Linaje", "Sesgo", "Apto entrenamiento", canManage || canUpdate ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.datasets.map((dataset) => (
              <DatasetRow key={dataset.id} dataset={dataset} canManage={canManage} canUpdate={canUpdate} pending={pending} run={run} openEditor={openEditor} />
            ))}
            {initial.datasets.length === 0 && <tr><td style={td} colSpan={canManage || canUpdate ? 12 : 11}>Sin datasets registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "models" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nueva versión de modelo">
              {(close) => <NewModelForm systems={initial.systems} datasets={initial.datasets} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Modelo", "Versión", "Etapa", "Revisión humana", "Última evaluación", "Exactitud", "Equidad", "Sesgo", "Explicabilidad", canUpdate || canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.models.map((model) => (
              <ModelRow key={model.id} model={model} systems={initial.systems} datasets={initial.datasets} canManage={canManage} canUpdate={canUpdate} canApprove={canApprove} pending={pending} run={run} openEditor={openEditor} />
            ))}
            {initial.models.length === 0 && <tr><td style={td} colSpan={12}>Sin versiones de modelo registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "oversight" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nuevo control de supervisión">
              {(close) => <NewOversightForm systems={initial.systems} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Control", "Tipo", "Responsable", "Puede anular", "Puede detener", "Eficacia", "Última verificación", "Activo", canManage || canUpdate ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.controls.map((control) => (
            <tr key={control.id}>
              <td style={td}>{control.code}</td>
              <td style={td}>{systemCode(control.systemId)}</td>
              <td style={td}>{control.name}</td>
              <td style={td}>{control.type}</td>
              <td style={td}>{nameOf(control.responsibleId)}</td>
              <td style={td}>{control.canOverride ? "Sí" : <span style={{ color: "var(--nf-danger-text)" }}>No</span>}</td>
              <td style={td}>{control.canStop ? "Sí" : <span style={{ color: "var(--nf-danger-text)" }}>No</span>}</td>
              <td style={td}>{control.effectiveness ?? "—"}</td>
              <td style={td}>{fmt(control.lastVerifiedAt)}</td>
              <td style={td}>{control.active ? "Sí" : "No"}</td>
              {(canManage || canUpdate) && <td style={td}>{canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("oversight", control as unknown as Record<string, unknown>)}>Editar</button>}{canManage && <button disabled={pending} style={miniBtn} onClick={() => requestPrompt({ title: "Verificar control de supervisión", label: "Eficacia verificada (0–100)", initialValue: String(control.effectiveness ?? ""), placeholder: "Ejemplo: 85", multiline: false, onConfirm: (raw) => { const value = Number(raw); if (Number.isFinite(value) && value >= 0 && value <= 100) run(() => verifyOversightControl(control.id, value)); } })}>Verificar</button>}</td>}
            </tr>
          ))}
          {initial.controls.length === 0 && <tr><td style={td} colSpan={11}>Sin controles de supervisión humana.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "transparency" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nuevo registro de transparencia">
              {(close) => <NewTransparencyForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Audiencia", "Declara uso de IA", "Contacto humano", "Canal", "Versión", "Publicado", canUpdate ? "Acciones" : ""]}>
            {initial.transparency.map((record) => (
              <tr key={record.id}>
                <td style={td}>{record.code}</td>
                <td style={td}>{systemCode(record.systemId)}</td>
                <td style={td}>{record.audience}</td>
                <td style={td}>{record.aiUseDisclosed ? "Sí" : <span style={{ color: "var(--nf-danger-text)" }}>No</span>}</td>
                <td style={td}>{record.humanContactOffered ? "Sí" : "No"}</td>
                <td style={td}>{record.channel ?? "—"}</td>
                <td style={td}>{record.version}</td>
                <td style={td}>{fmt(record.publishedAt)}</td>
                {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("transparency", record as unknown as Record<string, unknown>)}>Editar</button></td>}
              </tr>
            ))}
            {initial.transparency.length === 0 && <tr><td style={td} colSpan={canUpdate ? 9 : 8}>Sin registros de transparencia.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "incidents" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Reportar incidente de IA">
              {(close) => <NewIncidentForm systems={initial.systems} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Tipo", "Severidad", "Título", "Detección", "Afectados", "Notificación", "Estado", canUpdate || canManage ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.incidents.map((incident) => {
            const index = INCIDENT_FLOW.indexOf(incident.status);
            const next = index >= 0 && index < INCIDENT_FLOW.length - 1 ? INCIDENT_FLOW[index + 1] : null;
            return (
              <tr key={incident.id}>
                <td style={td}>{incident.code}</td>
                <td style={td}>{systemCode(incident.systemId)}</td>
                <td style={td}>{incident.type}</td>
                <td style={td}><span style={toneChip(LEVEL_COLORS[incident.severity])}>{incident.severity}</span></td>
                <td style={td}>{incident.title}</td>
                <td style={td}>{fmt(incident.detectedAt)}</td>
                <td style={td}>{incident.affectedCount ?? "—"}</td>
                <td style={td}>{incident.notificationRequired ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Requerida</span> : "—"}</td>
                <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{INCIDENT_LABEL[incident.status] ?? incident.status}</span></td>
                {(canUpdate || canManage) && <td style={td}>{canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("incident", incident as unknown as Record<string, unknown>)}>Editar</button>}{canManage && (next ? <button disabled={pending} onClick={() => run(() => transitionAIIncident(incident.id, { to: next as never }))} style={miniBtn}><ArrowRight size={12} /> {INCIDENT_LABEL[next]}</button> : <span style={{ color: "var(--nf-text-subtle)" }}>Cerrado</span>)}</td>}
              </tr>
            );
          })}
          {initial.incidents.length === 0 && <tr><td style={td} colSpan={10}>Sin incidentes de IA.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "suppliers" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nueva evaluación de proveedor">
              {(close) => <NewSupplierForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Proveedor", "Servicio", "Resultado", "Puntaje", "Usa datos del cliente", "Evaluado", "Próxima revisión", canUpdate ? "Acciones" : ""]}>
            {initial.suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td style={td}>{supplier.code}</td>
                <td style={td}>{supplier.supplierName}</td>
                <td style={td}>{supplier.serviceType}</td>
                <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{supplier.outcome}</span></td>
                <td style={td}>{supplier.score ?? "—"}</td>
                <td style={td}>{supplier.usesCustomerDataForTraining ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Sí</span> : "No"}</td>
                <td style={td}>{fmt(supplier.assessedAt)}</td>
                <td style={td}>{fmt(supplier.nextReviewDate)}</td>
                {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("supplier", supplier as unknown as Record<string, unknown>)}>Editar</button></td>}
              </tr>
            ))}
            {initial.suppliers.length === 0 && <tr><td style={td} colSpan={canUpdate ? 9 : 8}>Sin evaluaciones de proveedores de IA.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "changes" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nueva solicitud de cambio">
              {(close) => <NewChangeForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Sistema", "Cambio", "Tipo", "Reevaluación", "Revisión humana", "Revisor", "Implementado", canUpdate || canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.changes.map((change) => (
            <tr key={change.id}>
              <td style={td}>{change.code}</td>
              <td style={td}>{systemCode(change.systemId)}</td>
              <td style={td}>{change.title}</td>
              <td style={td}>{change.changeType}</td>
              <td style={td}>{change.requiresReassessment ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Requerida</span> : "—"}</td>
              <td style={td}><span style={toneChip(REVIEW_COLORS[change.reviewStatus])}>{REVIEW_LABEL[change.reviewStatus]}</span></td>
              <td style={td}>{change.reviewerId ? `${nameOf(change.reviewerId)} · ${fmt(change.reviewedAt)}` : "—"}</td>
              <td style={td}>{fmt(change.implementedAt)}</td>
              {(canUpdate || canManage || canApprove) && (
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canUpdate && change.reviewStatus === "DRAFT" && <button type="button" style={miniBtn} onClick={() => openEditor("change", change as unknown as Record<string, unknown>)}>Editar</button>}
                    {canManage && change.reviewStatus === "DRAFT" && <button disabled={pending} onClick={() => run(() => submitForHumanReview("changeRequest", change.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>}
                    {canApprove && change.reviewStatus === "HUMAN_REVIEW" && (
                      <>
                        <button disabled={pending} onClick={() => run(() => decideHumanReview("changeRequest", change.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }}><Check size={12} /> Aprobar</button>
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Rechazar solicitud de cambio", label: "Motivo del rechazo", placeholder: "Describe el motivo de la devolución…", onConfirm: (note) => run(() => decideHumanReview("changeRequest", change.id, { to: "REJECTED", note })) })} style={{ ...miniBtn, borderColor: "var(--nf-danger)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}><X size={12} /> Rechazar</button>
                      </>
                    )}
                    {canManage && change.reviewStatus === "APPROVED" && !change.implementedAt && <button disabled={pending} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }} onClick={() => run(() => implementAIChangeRequest(change.id))}>Marcar implementado</button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {initial.changes.length === 0 && <tr><td style={td} colSpan={canUpdate || canManage || canApprove ? 9 : 8}>Sin solicitudes de cambio.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "monitoring" && (
        <div style={{ display: "grid", gap: 14 }}>
          {canManage && (
            <NewFormToggle label="Nueva medición de monitoreo">
              {(close) => <NewMetricForm systems={initial.systems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Sistema", "Periodo", "Métrica", "Tipo", "Valor", "Umbral", "Línea base", "Umbral incumplido", "Deriva", canUpdate ? "Acciones" : ""]}>
          {initial.metrics.map((metric) => (
            <tr key={metric.id}>
              <td style={td}>{systemCode(metric.systemId)}</td>
              <td style={td}>{metric.period}</td>
              <td style={td}>{metric.name}</td>
              <td style={td}>{metric.kind}</td>
              <td style={td}><b>{metric.value}</b></td>
              <td style={td}>{metric.threshold ?? "—"}</td>
              <td style={td}>{metric.baseline ?? "—"}</td>
              <td style={td}>{metric.breached ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Sí</span> : "No"}</td>
              <td style={td}>{metric.driftDetected ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Sí</span> : "No"}</td>
              {canUpdate && <td style={td}><button type="button" style={miniBtn} onClick={() => openEditor("metric", metric as unknown as Record<string, unknown>)}>Editar</button></td>}
            </tr>
          ))}
          {initial.metrics.length === 0 && <tr><td style={td} colSpan={canUpdate ? 10 : 9}>Sin mediciones de monitoreo.</td></tr>}
          </Table>
        </div>
      )}
      <AimsRecordEditor value={editor} pending={pending} systems={initial.systems} datasets={initial.datasets} models={initial.models} members={initial.members} onClose={() => setEditor(null)} onSave={saveEditor} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <IsoMetricCard label={label} value={value} accent={accent} />;
}
function Row({ k, v, danger }: { k: string; v: number; danger?: boolean }) {
  return (<div className="nf-iso-dashboard-row"><span className="nf-iso-dashboard-row-label">{k}</span><b className="nf-iso-dashboard-row-value" style={{ color: danger ? "var(--nf-danger-text)" : undefined }}>{v}</b></div>);
}
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "var(--nf-text-on-primary)", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };

/** Modal "+ Nuevo X" form shell shared by every creation form in this module. */
function NewFormToggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [modalError, setModalError] = useState("");
  const [requested, clearRequest] = useCreateRequest(label);
  useEffect(() => { if (requested) setOpen(true); }, [requested]);
  const close = () => { setOpen(false); setCloseRequested(false); setModalError(""); clearRequest(); };
  const closeAfterSuccess = () => setCloseRequested(true);
  useEffect(() => {
    if (!closeRequested) return;
    const handleSuccess = () => { setOpen(false); setCloseRequested(false); setModalError(""); clearRequest(); };
    window.addEventListener("normaflow:server-action-success", handleSuccess);
    return () => window.removeEventListener("normaflow:server-action-success", handleSuccess);
  }, [closeRequested, clearRequest]);
  useEffect(() => {
    const handleError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (message) setModalError(String(message));
    };
    window.addEventListener("normaflow:server-action-error", handleError);
    return () => window.removeEventListener("normaflow:server-action-error", handleError);
  }, []);
  return (
    <>
      <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => { setModalError(""); setOpen(true); }}><Plus size={13} /> {label}</button>
      <Modal open={open} onClose={close} title={label} width={760}>
        <div className="nf-modal-form nf-iso-create-form">
          {modalError && <div className="nf-modal-error" role="alert">{modalError}</div>}
          <div className="nf-iso-create-fields">
            {children(closeAfterSuccess)}
            <button type="button" className="nf-app-btn-ghost nf-iso-create-cancel" onClick={close}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

type Runner = (action: () => Promise<unknown>) => void;

function NewSystemForm({ members, pending, run, onDone }: { members: AimsPayload["members"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", purpose: "", ownerId: "", providerType: "INTERNAL", criticality: "MEDIUM", autonomy: "HUMAN_IN_THE_LOOP" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <input aria-label="Nombre del sistema" style={input} placeholder="Nombre del sistema" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input aria-label="Propósito" style={input} placeholder="Propósito" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <select aria-label="Propietario" style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Propietario…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select aria-label="Tipo de proveedor" style={input} value={f.providerType} onChange={(e) => set("providerType", e.target.value)}>{["INTERNAL", "THIRD_PARTY_API", "THIRD_PARTY_LICENSED", "OPEN_SOURCE", "EMBEDDED_IN_PRODUCT", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Criticidad" style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Autonomía" style={input} value={f.autonomy} onChange={(e) => set("autonomy", e.target.value)}>{["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "FULLY_AUTOMATED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <button disabled={pending || !f.name.trim() || !f.purpose.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createAISystem({ name: f.name, purpose: f.purpose, ownerId: f.ownerId || undefined, providerType: f.providerType as never, criticality: f.criticality as never, autonomy: f.autonomy as never });
        onDone();
      })}>Crear sistema</button>
    </div>
  );
}

function NewUseCaseForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", title: "", objective: "", decisionAutonomy: "HUMAN_IN_THE_LOOP" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Título del caso de uso" style={input} placeholder="Título del caso de uso" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input aria-label="Objetivo" style={input} placeholder="Objetivo" value={f.objective} onChange={(e) => set("objective", e.target.value)} />
      </div>
      <button disabled={pending || !f.systemId || !f.title.trim() || !f.objective.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createAIUseCase({ systemId: f.systemId, title: f.title, objective: f.objective, decisionAutonomy: f.decisionAutonomy as never });
        onDone();
      })}>Crear caso de uso</button>
    </div>
  );
}

const IMPACT_DIMENSIONS = [
  ["rightsImpact", "Derechos"], ["safetyImpact", "Seguridad"], ["privacyImpact", "Privacidad"], ["biasImpact", "Sesgo"],
  ["transparencyImpact", "Transparencia"], ["explainabilityImpact", "Explicabilidad"], ["oversightImpact", "Supervisión"],
] as const;
const IMPACT_SEVERITY_OPTIONS = ["NOT_ASSESSED", "NONE", "LOW", "MODERATE", "HIGH", "SEVERE"];

function NewAssessmentForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [systemId, setSystemId] = useState("");
  const [dims, setDims] = useState<Record<string, string>>(Object.fromEntries(IMPACT_DIMENSIONS.map(([k]) => [k, "NOT_ASSESSED"])));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select aria-label="Sistema" style={input} value={systemId} onChange={(e) => setSystemId(e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
        {IMPACT_DIMENSIONS.map(([key, label]) => (
          <label key={key} style={{ fontSize: 11.5 }}>{label}
            <select style={{ ...input, width: "100%", marginTop: 3 }} value={dims[key]} onChange={(e) => setDims((p) => ({ ...p, [key]: e.target.value }))}>
              {IMPACT_SEVERITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ))}
      </div>
      <button disabled={pending || !systemId} style={primaryBtn} onClick={() => run(async () => {
        await createImpactAssessment({
          systemId, version: "1",
          rightsImpact: dims.rightsImpact as never, safetyImpact: dims.safetyImpact as never, privacyImpact: dims.privacyImpact as never,
          biasImpact: dims.biasImpact as never, transparencyImpact: dims.transparencyImpact as never,
          explainabilityImpact: dims.explainabilityImpact as never, oversightImpact: dims.oversightImpact as never,
        });
        onDone();
      })}>Crear evaluación</button>
    </div>
  );
}

const RISK_CATEGORIES = ["BIAS_DISCRIMINATION", "PRIVACY", "SECURITY", "SAFETY", "TRANSPARENCY", "EXPLAINABILITY", "ROBUSTNESS", "DATA_QUALITY", "HUMAN_OVERSIGHT", "INTELLECTUAL_PROPERTY", "LEGAL_COMPLIANCE", "ENVIRONMENTAL", "THIRD_PARTY", "MISUSE", "OTHER"];

function NewRiskForm({ systems, members, pending, run, onDone }: { systems: AimsPayload["systems"]; members: AimsPayload["members"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", title: "", category: "OTHER", likelihood: "3", impact: "3", ownerId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Sistema (opcional)" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema (opcional)…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Título del riesgo" style={input} placeholder="Título del riesgo" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <select aria-label="Categoría" style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{RISK_CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Probabilidad" style={input} value={f.likelihood} onChange={(e) => set("likelihood", e.target.value)}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Probabilidad {v}</option>)}</select>
        <select aria-label="Impacto" style={input} value={f.impact} onChange={(e) => set("impact", e.target.value)}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Impacto {v}</option>)}</select>
        <select aria-label="Responsable" style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <button disabled={pending || !f.title.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createAIRisk({ systemId: f.systemId || undefined, title: f.title, category: f.category as never, likelihood: Number(f.likelihood), impact: Number(f.impact), ownerId: f.ownerId || undefined, treatment: "MITIGATE" });
        onDone();
      })}>Crear riesgo</button>
    </div>
  );
}

function NewDatasetForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", purpose: "", classification: "INTERNAL", containsPersonalData: false, legalBasis: "NOT_APPLICABLE" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <input aria-label="Nombre del dataset" style={input} placeholder="Nombre del dataset" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input aria-label="Propósito" style={input} placeholder="Propósito" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, alignItems: "center" }}>
        <select aria-label="Clasificación" style={input} value={f.classification} onChange={(e) => set("classification", e.target.value)}>{["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={f.containsPersonalData} onChange={(e) => set("containsPersonalData", e.target.checked)} /> Contiene datos personales</label>
        {f.containsPersonalData && <select aria-label="Base legal" style={input} value={f.legalBasis} onChange={(e) => set("legalBasis", e.target.value)}>{["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_TASK", "LEGITIMATE_INTEREST", "ANONYMIZED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>}
      </div>
      <button disabled={pending || !f.name.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createDataset({ name: f.name, purpose: f.purpose || undefined, classification: f.classification as never, containsPersonalData: f.containsPersonalData, containsSpecialCategories: false, legalBasis: (f.containsPersonalData ? f.legalBasis : "NOT_APPLICABLE") as never });
        onDone();
      })}>Crear dataset</button>
    </div>
  );
}

function DatasetRow({ dataset, canManage, canUpdate, pending, run, openEditor }: { dataset: AimsPayload["datasets"][number]; canManage: boolean; canUpdate: boolean; pending: boolean; run: Runner; openEditor: (kind: AimsRecordKind, value: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState({ completeness: "", accuracy: "", consistency: "", timeliness: "", representativeness: "" });
  const [bias, setBias] = useState({ biasFindings: "", underrepresentedGroups: "" });
  const [source, setSource] = useState({ name: "", type: "OTHER" });
  const [lineage, setLineage] = useState({ operation: "INGESTION", description: "" });
  const [sourceModal, setSourceModal] = useState(false);
  const [lineageModal, setLineageModal] = useState(false);
  return (
    <Fragment>
      <tr>
        <td style={td}>{dataset.code}</td>
        <td style={td}><b>{dataset.name}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{dataset.purpose ?? "—"}</div></td>
        <td style={td}>{dataset.classification}</td>
        <td style={td}>{dataset.containsSpecialCategories ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Categorías especiales</span> : dataset.containsPersonalData ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Sí</span> : "No"}</td>
        <td style={td}>{dataset.legalBasis}</td>
        <td style={td}>{dataset.recordCount ?? "—"}</td>
        <td style={td}>{dataset.qualityScore ?? "—"}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{QUALITY_LABEL[dataset.qualityLevel]}</div></td>
        <td style={td}>{dataset.sources}</td>
        <td style={td}>{dataset.lineageSteps}{!dataset.traceable && <div style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>sin procedencia</div>}</td>
        <td style={td}>{dataset.biasFlags.length ? <span style={{ color: "var(--nf-danger-text)", fontSize: 12 }}>{dataset.biasFlags.join(", ")}</span> : <span style={{ color: "var(--nf-success-text)" }}>revisado</span>}</td>
        <td style={td}>{dataset.fitForTraining ? "Sí" : <span style={{ color: "var(--nf-danger-text)" }}>No</span>}</td>
        {(canManage || canUpdate) && <td style={td}><button style={miniBtn} onClick={() => setOpen((v) => !v)}>{open ? "Cerrar" : "Gestionar"}</button>{canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("dataset", dataset as unknown as Record<string, unknown>)}>Editar</button>}</td>}
      </tr>
      {open && (canManage || canUpdate) && (
        <tr><td colSpan={12} style={{ ...td, background: "var(--nf-surface-muted)" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <strong style={{ fontSize: 12 }}>Calidad de datos (0-100)</strong>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {(["completeness", "accuracy", "consistency", "timeliness", "representativeness"] as const).map((k) => (
                  <input aria-label={k} key={k} style={{ ...input, maxWidth: 100 }} type="number" min={0} max={100} placeholder={k} value={quality[k]} onChange={(e) => setQuality((p) => ({ ...p, [k]: e.target.value }))} />
                ))}
                <button disabled={pending} style={miniBtn} onClick={() => run(() => assessDatasetQuality(dataset.id, {
                  completeness: quality.completeness ? Number(quality.completeness) : undefined, accuracy: quality.accuracy ? Number(quality.accuracy) : undefined,
                  consistency: quality.consistency ? Number(quality.consistency) : undefined, timeliness: quality.timeliness ? Number(quality.timeliness) : undefined,
                  representativeness: quality.representativeness ? Number(quality.representativeness) : undefined,
                }))}>Guardar calidad</button>
              </div>
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Revisión de sesgo</strong>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                <input aria-label="Hallazgos de sesgo" style={input} placeholder="Hallazgos de sesgo" value={bias.biasFindings} onChange={(e) => setBias((p) => ({ ...p, biasFindings: e.target.value }))} />
                <input aria-label="Grupos subrepresentados" style={input} placeholder="Grupos subrepresentados" value={bias.underrepresentedGroups} onChange={(e) => setBias((p) => ({ ...p, underrepresentedGroups: e.target.value }))} />
                <button disabled={pending} style={miniBtn} onClick={() => run(() => reviewDatasetBias(dataset.id, { biasFindings: bias.biasFindings || undefined, underrepresentedGroups: bias.underrepresentedGroups || undefined }))}>Guardar revisión</button>
              </div>
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Fuente de datos (procedencia)</strong>
              <button type="button" style={miniBtn} onClick={() => setSourceModal(true)}>+ Añadir fuente</button>
              {canUpdate && dataset.dataSources?.map((source) => <button key={source.id} type="button" style={miniBtn} onClick={() => openEditor("dataSource", source as unknown as Record<string, unknown>)}>Editar {source.code}</button>)}
              <Modal open={sourceModal} onClose={() => setSourceModal(false)} title={`Nueva fuente · ${dataset.name}`} width={620}>
                <div className="nf-modal-form nf-iso-create-form">
                  <AimsModalError />
                  <label>Nombre de la fuente<input style={input} value={source.name} onChange={(e) => setSource((p) => ({ ...p, name: e.target.value }))} /></label>
                  <label>Tipo<select style={input} value={source.type} onChange={(e) => setSource((p) => ({ ...p, type: e.target.value }))}>{["INTERNAL_SYSTEM", "PUBLIC_DATASET", "THIRD_PARTY_PROVIDER", "WEB_SCRAPING", "USER_GENERATED", "SYNTHETIC", "SENSOR", "PURCHASED", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
                  <div className="nf-modal-actions nf-iso-create-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setSourceModal(false)}>Cancelar</button><button disabled={pending || !source.name.trim()} className="nf-app-btn-primary" onClick={() => run(async () => { await createDataSource({ datasetId: dataset.id, name: source.name, type: source.type as never, legalBasis: "NOT_APPLICABLE", licenseVerified: false }); setSource({ name: "", type: "OTHER" }); setSourceModal(false); })}>Crear fuente</button></div>
                </div>
              </Modal>
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Paso de linaje</strong>
              <button type="button" style={miniBtn} onClick={() => setLineageModal(true)}>+ Añadir paso</button>
              {canUpdate && dataset.dataLineage?.map((step) => <button key={step.id} type="button" style={miniBtn} onClick={() => openEditor("dataLineage", step as unknown as Record<string, unknown>)}>Editar paso {step.step}</button>)}
              <Modal open={lineageModal} onClose={() => setLineageModal(false)} title={`Nuevo paso de linaje · ${dataset.name}`} width={620}>
                <div className="nf-modal-form nf-iso-create-form">
                  <AimsModalError />
                  <label>Operación<select style={input} value={lineage.operation} onChange={(e) => setLineage((p) => ({ ...p, operation: e.target.value }))}>{["INGESTION", "CLEANING", "TRANSFORMATION", "LABELING", "AUGMENTATION", "ANONYMIZATION", "AGGREGATION", "SPLIT", "MERGE", "DERIVATION", "DELETION"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
                  <label>Descripción<input style={input} value={lineage.description} onChange={(e) => setLineage((p) => ({ ...p, description: e.target.value }))} /></label>
                  <div className="nf-modal-actions nf-iso-create-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setLineageModal(false)}>Cancelar</button><button disabled={pending} className="nf-app-btn-primary" onClick={() => run(async () => { await addDataLineageStep({ datasetId: dataset.id, operation: lineage.operation as never, description: lineage.description || undefined, reversible: false }); setLineage({ operation: "INGESTION", description: "" }); setLineageModal(false); })}>Crear paso</button></div>
                </div>
              </Modal>
            </div>
          </div>
        </td></tr>
      )}
    </Fragment>
  );
}

function NewModelForm({ systems, datasets, pending, run, onDone }: { systems: AimsPayload["systems"]; datasets: AimsPayload["datasets"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", modelName: "", version: "1.0", trainingDatasetId: "", explainabilityMethod: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Nombre del modelo" style={input} placeholder="Nombre del modelo" value={f.modelName} onChange={(e) => set("modelName", e.target.value)} />
        <input aria-label="Versión" style={input} placeholder="Versión" value={f.version} onChange={(e) => set("version", e.target.value)} />
        <input aria-label="Técnica de explicabilidad" style={input} placeholder="Técnica de explicabilidad" value={f.explainabilityMethod} onChange={(e) => set("explainabilityMethod", e.target.value)} />
      </div>
      <select aria-label="Dataset de entrenamiento (opcional)" style={input} value={f.trainingDatasetId} onChange={(e) => set("trainingDatasetId", e.target.value)}><option value="">Dataset de entrenamiento (opcional)…</option>{datasets.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select>
      <button disabled={pending || !f.systemId || !f.modelName.trim() || !f.version.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createModelVersion({ systemId: f.systemId, modelName: f.modelName, version: f.version, trainingDatasetId: f.trainingDatasetId || undefined, explainabilityMethod: f.explainabilityMethod || undefined });
        onDone();
      })}>Crear versión</button>
    </div>
  );
}

function ModelRow({ model, systems, datasets, canManage, canUpdate, canApprove, pending, run, openEditor }: {
  model: AimsPayload["models"][number]; systems: AimsPayload["systems"]; datasets: AimsPayload["datasets"]; canManage: boolean; canUpdate: boolean; canApprove: boolean; pending: boolean; run: Runner; openEditor: (kind: AimsRecordKind, value: Record<string, unknown>) => void;
}) {
  const [showEval, setShowEval] = useState(false);
  const requestPrompt = usePromptAction();
  const [ev, setEv] = useState({ datasetId: "", accuracy: "", fairnessScore: "", biasDetected: false, outcome: "PASSED" });
  const code = systems.find((s) => s.id === model.systemId)?.code ?? "—";
  return (
    <Fragment>
      <tr>
        <td style={td}>{model.code}</td>
        <td style={td}>{code}</td>
        <td style={td}>{model.modelName}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{model.algorithm ?? model.provider ?? "—"}</div></td>
        <td style={td}>{model.version}</td>
        <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{model.stage}</span></td>
        <td style={td}><span style={toneChip(REVIEW_COLORS[model.reviewStatus])}>{REVIEW_LABEL[model.reviewStatus]}</span></td>
        <td style={td}>{model.lastEvaluation ? `${model.lastEvaluation.outcome} · ${fmt(model.lastEvaluation.evaluatedAt)}` : "—"}</td>
        <td style={td}>{pct(model.lastEvaluation?.accuracy)}</td>
        <td style={td}>{pct(model.lastEvaluation?.fairnessScore)}</td>
        <td style={td}>{model.lastEvaluation?.biasDetected ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>detectado</span> : "—"}</td>
        <td style={td}>{model.explainabilityMethod ?? <span style={{ color: "var(--nf-danger-text)" }}>sin técnica</span>}</td>
        {(canManage || canUpdate || canApprove) && (
          <td style={td}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {canUpdate && <button type="button" style={miniBtn} onClick={() => openEditor("modelVersion", model as unknown as Record<string, unknown>)}>Editar</button>}
              {canUpdate && model.evaluations?.[0] && <button type="button" style={miniBtn} onClick={() => openEditor("modelEvaluation", model.evaluations[0] as unknown as Record<string, unknown>)}>Editar evaluación</button>}
              {canUpdate && model.evaluations?.slice(1).map((evaluation) => <button key={evaluation.id} type="button" style={miniBtn} onClick={() => openEditor("modelEvaluation", evaluation as unknown as Record<string, unknown>)}>Editar eval. {evaluation.code}</button>)}
              {canManage && <button disabled={pending} style={miniBtn} onClick={() => setShowEval((v) => !v)}>Evaluar</button>}
              {canManage && model.reviewStatus === "DRAFT" && <button disabled={pending} onClick={() => run(() => submitForHumanReview("modelVersion", model.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>}
              {canApprove && model.reviewStatus === "HUMAN_REVIEW" && (
                <>
                  <button disabled={pending} onClick={() => run(() => decideHumanReview("modelVersion", model.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }}><Check size={12} /> Aprobar</button>
                  <button disabled={pending} onClick={() => requestPrompt({ title: "Rechazar versión de modelo", label: "Motivo del rechazo", placeholder: "Describe el motivo de la devolución…", onConfirm: (note) => run(() => decideHumanReview("modelVersion", model.id, { to: "REJECTED", note })) })} style={{ ...miniBtn, borderColor: "var(--nf-danger)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}><X size={12} /> Rechazar</button>
                </>
              )}
              {canApprove && model.reviewStatus === "APPROVED" && model.stage !== "PRODUCTION" && <button disabled={pending} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }} onClick={() => run(() => promoteModelToProduction(model.id))}>Promover a producción</button>}
            </div>
          </td>
        )}
      </tr>
      <Modal open={showEval} onClose={() => setShowEval(false)} title={`Evaluar modelo · ${model.modelName}`} width={700}>
          <div className="nf-modal-form nf-iso-create-form">
            <AimsModalError />
            <select aria-label="Dataset de evaluación (opcional)" style={input} value={ev.datasetId} onChange={(e) => setEv((p) => ({ ...p, datasetId: e.target.value }))}><option value="">Dataset de evaluación (opcional)…</option>{datasets.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
            <input aria-label="Exactitud (0-1)" style={{ ...input, maxWidth: 110 }} type="number" min={0} max={1} step={0.01} placeholder="Exactitud (0-1)" value={ev.accuracy} onChange={(e) => setEv((p) => ({ ...p, accuracy: e.target.value }))} />
            <input aria-label="Equidad (0-1)" style={{ ...input, maxWidth: 110 }} type="number" min={0} max={1} step={0.01} placeholder="Equidad (0-1)" value={ev.fairnessScore} onChange={(e) => setEv((p) => ({ ...p, fairnessScore: e.target.value }))} />
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={ev.biasDetected} onChange={(e) => setEv((p) => ({ ...p, biasDetected: e.target.checked }))} /> Sesgo detectado</label>
            <select aria-label="Resultado" style={input} value={ev.outcome} onChange={(e) => setEv((p) => ({ ...p, outcome: e.target.value }))}>{["NOT_EVALUATED", "PASSED", "PASSED_WITH_CONDITIONS", "FAILED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <div className="nf-modal-actions nf-iso-create-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={() => setShowEval(false)}>Cancelar</button><button disabled={pending} style={primaryBtn} onClick={() => {
              const save = (conditions?: string) => run(async () => {
                await createModelEvaluation({
                  modelVersionId: model.id, datasetId: ev.datasetId || undefined,
                  accuracy: ev.accuracy ? Number(ev.accuracy) : undefined, fairnessScore: ev.fairnessScore ? Number(ev.fairnessScore) : undefined,
                  biasDetected: ev.biasDetected, adversarialTested: false, explainabilityAssessed: false, outcome: ev.outcome as never,
                  conditions: ev.outcome === "PASSED_WITH_CONDITIONS" ? conditions : undefined,
                });
                setShowEval(false);
              });
              if (ev.outcome === "PASSED_WITH_CONDITIONS") requestPrompt({ title: "Evaluación condicionada", label: "Condiciones de la aprobación", placeholder: "Describe las condiciones que deben cumplirse…", onConfirm: save });
              else save();
            }}>Guardar evaluación</button></div>
          </div>
      </Modal>
    </Fragment>
  );
}

function NewOversightForm({ systems, members, pending, run, onDone }: { systems: AimsPayload["systems"]; members: AimsPayload["members"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", name: "", type: "HUMAN_IN_THE_LOOP", responsibleId: "", canOverride: true, canStop: true });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Nombre del control" style={input} placeholder="Nombre del control" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <select aria-label="Tipo" style={input} value={f.type} onChange={(e) => set("type", e.target.value)}>{["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "DUAL_CONTROL", "SAMPLING_REVIEW", "APPEAL_CHANNEL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={f.canOverride} onChange={(e) => set("canOverride", e.target.checked)} /> Puede anular</label>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={f.canStop} onChange={(e) => set("canStop", e.target.checked)} /> Puede detener</label>
      </div>
      <button disabled={pending || !f.systemId || !f.name.trim() || (!f.canOverride && !f.canStop)} style={primaryBtn} onClick={() => run(async () => {
        await createOversightControl({ systemId: f.systemId, name: f.name, type: f.type as never, responsibleId: f.responsibleId || undefined, canOverride: f.canOverride, canStop: f.canStop });
        onDone();
      })}>Crear control</button>
    </div>
  );
}

function OutputRow({ output, systemCode, nameOf, canManage, canApprove, pending, run }: {
  output: AimsPayload["outputs"][number]; systemCode: (id: string | null | undefined) => string; nameOf: (id: string | null | undefined) => string;
  canManage: boolean; canApprove: boolean; pending: boolean; run: Runner;
}) {
  const [editing, setEditing] = useState(false);
  const requestPrompt = usePromptAction();
  const [edits, setEdits] = useState("");
  return (
    <Fragment>
      <tr>
        <td style={td}>{output.code}</td>
        <td style={td}>{systemCode(output.systemId)}</td>
        <td style={td}>{output.model}</td>
        <td style={td}>{output.modelVersionLabel}</td>
        <td style={td}>{nameOf(output.requestedById)}</td>
        <td style={td}>{fmt(output.generatedAt)}</td>
        <td style={td}>{output.edited ? "Sí" : "No"}</td>
        <td style={td}>{output.containsPersonalData ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Sí</span> : "No"}</td>
        <td style={td}>
          <span style={toneChip(REVIEW_COLORS[output.reviewStatus])}>{REVIEW_LABEL[output.reviewStatus]}</span>
          {!output.integrity.valid && <div style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>{output.integrity.problems.join("; ")}</div>}
        </td>
        <td style={td}>{output.reviewerId ? `${nameOf(output.reviewerId)} · ${fmt(output.reviewedAt)}` : "—"}</td>
        <td style={td}>{output.promotedAt ? `${output.promotedEntityType} · ${fmt(output.promotedAt)}` : "—"}</td>
        {(canManage || canApprove) && (
          <td style={td}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {canManage && output.reviewStatus === "DRAFT" && <button disabled={pending} style={miniBtn} onClick={() => setEditing((v) => !v)}>Editar</button>}
              {canManage && output.reviewStatus === "DRAFT" && (
                <button disabled={pending} onClick={() => run(() => submitForHumanReview("output", output.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>
              )}
              {canApprove && output.reviewStatus === "HUMAN_REVIEW" && (
                <>
                  <button disabled={pending} onClick={() => run(() => decideHumanReview("output", output.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }}><Check size={12} /> Aprobar</button>
                  <button disabled={pending} onClick={() => requestPrompt({ title: "Rechazar salida de IA", label: "Motivo del rechazo", placeholder: "Describe el motivo de la devolución…", onConfirm: (note) => run(() => decideHumanReview("output", output.id, { to: "REJECTED", note })) })} style={{ ...miniBtn, borderColor: "var(--nf-danger)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}><X size={12} /> Rechazar</button>
                </>
              )}
              {canManage && output.reviewStatus === "REJECTED" && <button disabled={pending} style={miniBtn} onClick={() => run(() => reopenForCorrection("output", output.id))}>Reabrir para corregir</button>}
              {canApprove && output.reviewStatus === "APPROVED" && !output.promotedAt && (
                <button disabled={pending} style={{ ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" }} onClick={() => requestPrompt({ title: "Promover salida a registro oficial", label: "Tipo de registro oficial", placeholder: "Ejemplo: Document, Risk o Action…", onConfirm: (entityType) => run(() => promoteAIOutput(output.id, { entityType, entityId: output.id })) })}>Promover a registro oficial</button>
              )}
            </div>
          </td>
        )}
      </tr>
      {editing && (
        <tr><td colSpan={12} style={{ ...td, background: "var(--nf-surface-muted)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input aria-label="Texto editado por una persona" style={{ ...input, flex: 1, minWidth: 280 }} placeholder="Texto editado por una persona" value={edits} onChange={(e) => setEdits(e.target.value)} />
            <button disabled={pending || !edits.trim()} style={primaryBtn} onClick={() => run(async () => { await editAIOutput(output.id, edits); setEditing(false); setEdits(""); })}>Guardar edición humana</button>
          </div>
        </td></tr>
      )}
    </Fragment>
  );
}

function NewOutputForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", prompt: "", model: "", modelVersionLabel: "", output: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Sistema (opcional)" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema (opcional)…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Modelo (p.ej. claude-sonnet-5)" style={input} placeholder="Modelo (p.ej. claude-sonnet-5)" value={f.model} onChange={(e) => set("model", e.target.value)} />
        <input aria-label="Versión del modelo" style={input} placeholder="Versión del modelo" value={f.modelVersionLabel} onChange={(e) => set("modelVersionLabel", e.target.value)} />
      </div>
      <textarea aria-label="Prompt" style={{ ...input, minHeight: 60 }} placeholder="Prompt" value={f.prompt} onChange={(e) => set("prompt", e.target.value)} />
      <textarea aria-label="Salida generada" style={{ ...input, minHeight: 60 }} placeholder="Salida generada" value={f.output} onChange={(e) => set("output", e.target.value)} />
      <button disabled={pending || !f.prompt.trim() || !f.model.trim() || !f.modelVersionLabel.trim() || !f.output.trim()} style={primaryBtn} onClick={() => run(async () => {
        await recordAIOutput({ systemId: f.systemId || undefined, prompt: f.prompt, model: f.model, modelVersionLabel: f.modelVersionLabel, output: f.output, containsPersonalData: false, targetType: "OTHER", redacted: false });
        onDone();
      })}>Registrar salida</button>
    </div>
  );
}

function NewTransparencyForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", audience: "END_USER", disclosure: "", channel: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <select aria-label="Audiencia" style={input} value={f.audience} onChange={(e) => set("audience", e.target.value)}>{["END_USER", "DATA_SUBJECT", "CUSTOMER", "WORKER", "REGULATOR", "PUBLIC", "INTERNAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Canal (p.ej. portal, correo)" style={input} placeholder="Canal (p.ej. portal, correo)" value={f.channel} onChange={(e) => set("channel", e.target.value)} />
      </div>
      <textarea aria-label="Texto de divulgación del uso de IA" style={{ ...input, minHeight: 60 }} placeholder="Texto de divulgación del uso de IA" value={f.disclosure} onChange={(e) => set("disclosure", e.target.value)} />
      <button disabled={pending || !f.systemId || !f.disclosure.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createTransparencyRecord({ systemId: f.systemId, audience: f.audience as never, disclosure: f.disclosure, channel: f.channel || undefined, aiUseDisclosed: true, version: "1", limitationsDisclosed: false, dataUseDisclosed: false, humanContactOffered: false });
        onDone();
      })}>Publicar registro</button>
    </div>
  );
}

const INCIDENT_TYPES = ["HARMFUL_OUTPUT", "BIAS_DISCRIMINATION", "PRIVACY_BREACH", "SECURITY_BREACH", "HALLUCINATION", "PERFORMANCE_DEGRADATION", "DATA_DRIFT", "MISUSE", "UNAVAILABILITY", "UNAPPROVED_AUTOMATION", "OTHER"];

function NewIncidentForm({ systems, members, pending, run, onDone }: { systems: AimsPayload["systems"]; members: AimsPayload["members"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", title: "", type: "OTHER", severity: "MEDIUM", responsibleId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Sistema (opcional)" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema (opcional)…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Título del incidente" style={input} placeholder="Título del incidente" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <select aria-label="Tipo" style={input} value={f.type} onChange={(e) => set("type", e.target.value)}>{INCIDENT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <button disabled={pending || !f.title.trim()} style={primaryBtn} onClick={() => run(async () => {
        await reportAIIncident({ systemId: f.systemId || undefined, title: f.title, type: f.type as never, severity: f.severity as never, responsibleId: f.responsibleId || undefined });
        onDone();
      })}>Reportar incidente</button>
    </div>
  );
}

function NewSupplierForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ supplierName: "", serviceType: "OTHER", systemId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del proveedor" style={input} placeholder="Nombre del proveedor" value={f.supplierName} onChange={(e) => set("supplierName", e.target.value)} />
        <select aria-label="Tipo de servicio" style={input} value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)}>{["FOUNDATION_MODEL", "MODEL_API", "DATASET", "ANNOTATION", "MLOPS_PLATFORM", "EMBEDDED_FEATURE", "CONSULTING", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Sistema (opcional)" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema (opcional)…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
      </div>
      <button disabled={pending || !f.supplierName.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createSupplierAssessment({
          supplierName: f.supplierName, serviceType: f.serviceType as never, systemId: f.systemId || undefined,
          modelDocumentation: false, trainingDataDisclosed: false, evaluationResultsShared: false, biasTestingEvidence: false,
          usesCustomerDataForTraining: false, outcome: "UNDER_REVIEW",
        });
        onDone();
      })}>Crear evaluación</button>
    </div>
  );
}

function NewChangeForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", title: "", changeType: "OTHER" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Título del cambio" style={input} placeholder="Título del cambio" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de cambio" style={input} value={f.changeType} onChange={(e) => set("changeType", e.target.value)}>{["MODEL_UPDATE", "RETRAINING", "DATA_CHANGE", "PROMPT_CHANGE", "SCOPE_CHANGE", "INTEGRATION", "CONFIGURATION", "THRESHOLD_CHANGE", "DECOMMISSION", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <button disabled={pending || !f.systemId || !f.title.trim()} style={primaryBtn} onClick={() => run(async () => {
        await createAIChangeRequest({ systemId: f.systemId, title: f.title, changeType: f.changeType as never, affectsImpactAssessment: false, requiresReassessment: false, requiresRetraining: false, requiresRevalidation: false });
        onDone();
      })}>Crear solicitud</button>
    </div>
  );
}

function NewMetricForm({ systems, pending, run, onDone }: { systems: AimsPayload["systems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ systemId: "", period: "", kind: "ACCURACY", name: "", value: "", threshold: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Sistema" style={input} value={f.systemId} onChange={(e) => set("systemId", e.target.value)}><option value="">Sistema…</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <input aria-label="Periodo (p.ej. 2026-07)" style={input} placeholder="Periodo (p.ej. 2026-07)" value={f.period} onChange={(e) => set("period", e.target.value)} />
        <select aria-label="Tipo" style={input} value={f.kind} onChange={(e) => set("kind", e.target.value)}>{["ACCURACY", "PRECISION", "RECALL", "F1", "ERROR_RATE", "LATENCY", "THROUGHPUT", "DRIFT", "FAIRNESS", "TOXICITY", "HALLUCINATION_RATE", "HUMAN_OVERRIDE_RATE", "REJECTION_RATE", "COST", "AVAILABILITY", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nombre de la métrica" style={input} placeholder="Nombre de la métrica" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input aria-label="Valor" style={input} type="number" placeholder="Valor" value={f.value} onChange={(e) => set("value", e.target.value)} />
        <input aria-label="Umbral (opcional)" style={input} type="number" placeholder="Umbral (opcional)" value={f.threshold} onChange={(e) => set("threshold", e.target.value)} />
      </div>
      <button disabled={pending || !f.systemId || !f.period.trim() || !f.name.trim() || !f.value} style={primaryBtn} onClick={() => run(async () => {
        await recordPerformanceMetric({ systemId: f.systemId, period: f.period, kind: f.kind as never, name: f.name, value: Number(f.value), threshold: f.threshold ? Number(f.threshold) : undefined });
        onDone();
      })}>Registrar medición</button>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <IsoTableCard icon={BrainCircuit} headers={head}>{children}</IsoTableCard>;
}

type AimsEditorValue = { kind: AimsRecordKind; value: Record<string, unknown> } | null;
type AimsField = { key: string; label: string; type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox"; options?: string[]; required?: boolean };

const AIMS_FIELDS: Record<AimsRecordKind, AimsField[]> = {
  system: [{ key: "name", label: "Nombre", required: true }, { key: "purpose", label: "Propósito", type: "textarea", required: true }, { key: "ownerId", label: "Propietario", type: "select" }, { key: "provider", label: "Proveedor" }, { key: "providerType", label: "Tipo de proveedor", type: "select", options: ["INTERNAL", "THIRD_PARTY_API", "THIRD_PARTY_LICENSED", "OPEN_SOURCE", "EMBEDDED_IN_PRODUCT", "OTHER"] }, { key: "criticality", label: "Criticidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "autonomy", label: "Autonomía", type: "select", options: ["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "FULLY_AUTOMATED"] }, { key: "users", label: "Usuarios", type: "textarea" }, { key: "affectedGroups", label: "Colectivos afectados", type: "textarea" }, { key: "context", label: "Contexto y límites", type: "textarea" }, { key: "processId", label: "Proceso ID" }, { key: "documentId", label: "Documento ID" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }],
  useCase: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "title", label: "Título", required: true }, { key: "objective", label: "Objetivo", type: "textarea", required: true }, { key: "supportedDecisions", label: "Decisiones apoyadas", type: "textarea" }, { key: "decisionAutonomy", label: "Autonomía", type: "select", options: ["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "FULLY_AUTOMATED"] }, { key: "affectedPeople", label: "Personas afectadas", type: "textarea" }, { key: "affectedCount", label: "Cantidad afectada", type: "number" }, { key: "impact", label: "Impacto", type: "textarea" }, { key: "constraints", label: "Restricciones", type: "textarea" }, { key: "prohibitedUses", label: "Usos prohibidos", type: "textarea" }, { key: "processId", label: "Proceso ID" }, { key: "active", label: "Activo", type: "checkbox" }],
  impactAssessment: [{ key: "methodology", label: "Metodología" }, { key: "rightsImpact", label: "Derechos", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "rightsNote", label: "Nota de derechos", type: "textarea" }, { key: "safetyImpact", label: "Seguridad", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "safetyNote", label: "Nota de seguridad", type: "textarea" }, { key: "privacyImpact", label: "Privacidad", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "privacyNote", label: "Nota de privacidad", type: "textarea" }, { key: "biasImpact", label: "Sesgo", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "biasNote", label: "Nota de sesgo", type: "textarea" }, { key: "transparencyImpact", label: "Transparencia", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "transparencyNote", label: "Nota de transparencia", type: "textarea" }, { key: "explainabilityImpact", label: "Explicabilidad", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "explainabilityNote", label: "Nota de explicabilidad", type: "textarea" }, { key: "oversightImpact", label: "Supervisión", type: "select", options: IMPACT_SEVERITY_OPTIONS, required: true }, { key: "oversightNote", label: "Nota de supervisión", type: "textarea" }, { key: "safeguards", label: "Salvaguardas", type: "textarea" }, { key: "residualImpact", label: "Impacto residual", type: "textarea" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "documentId", label: "Documento ID" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }],
  risk: [{ key: "systemId", label: "Sistema", type: "select" }, { key: "title", label: "Título", required: true }, { key: "category", label: "Categoría", type: "select", options: RISK_CATEGORIES, required: true }, { key: "source", label: "Fuente" }, { key: "description", label: "Descripción", type: "textarea" }, { key: "affectedParties", label: "Partes afectadas", type: "textarea" }, { key: "likelihood", label: "Probabilidad", type: "number", required: true }, { key: "impact", label: "Impacto", type: "number", required: true }, { key: "existingControls", label: "Controles existentes", type: "textarea" }, { key: "controlEffectiveness", label: "Eficacia (%)", type: "number" }, { key: "treatment", label: "Tratamiento", type: "select", options: ["MITIGATE", "AVOID", "TRANSFER", "ACCEPT"] }, { key: "treatmentPlan", label: "Plan de tratamiento", type: "textarea" }, { key: "ownerId", label: "Responsable", type: "select" }, { key: "dueDate", label: "Fecha objetivo", type: "date" }, { key: "riskId", label: "Riesgo relacionado ID" }, { key: "controlId", label: "Control ID" }, { key: "capaId", label: "CAPA ID" }, { key: "evidenceId", label: "Evidencia ID" }],
  dataset: [{ key: "name", label: "Nombre", required: true }, { key: "purpose", label: "Propósito", type: "textarea" }, { key: "ownerId", label: "Propietario", type: "select" }, { key: "stewardId", label: "Custodio", type: "select" }, { key: "classification", label: "Clasificación", type: "select", options: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] }, { key: "containsPersonalData", label: "Datos personales", type: "checkbox" }, { key: "personalDataCategories", label: "Categorías de datos", type: "textarea" }, { key: "containsSpecialCategories", label: "Categorías especiales", type: "checkbox" }, { key: "legalBasis", label: "Base legal", type: "select", options: ["NOT_APPLICABLE", "CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_TASK", "LEGITIMATE_INTEREST", "ANONYMIZED"] }, { key: "anonymization", label: "Anonimización", type: "textarea" }, { key: "recordCount", label: "Registros", type: "number" }, { key: "featureCount", label: "Variables", type: "number" }, { key: "periodCovered", label: "Periodo cubierto" }, { key: "retentionMonths", label: "Retención (meses)", type: "number" }, { key: "storageLocation", label: "Ubicación de almacenamiento" }, { key: "documentId", label: "Documento ID" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "active", label: "Activo", type: "checkbox" }],
  dataSource: [{ key: "datasetId", label: "Dataset", type: "select", required: true }, { key: "name", label: "Nombre", required: true }, { key: "type", label: "Tipo", type: "select", options: ["INTERNAL_SYSTEM", "PUBLIC_DATASET", "THIRD_PARTY_PROVIDER", "WEB_SCRAPING", "USER_GENERATED", "SYNTHETIC", "SENSOR", "PURCHASED", "OTHER"] }, { key: "origin", label: "Origen", type: "textarea" }, { key: "provider", label: "Proveedor" }, { key: "supplierId", label: "Proveedor ID" }, { key: "license", label: "Licencia", type: "textarea" }, { key: "licenseVerified", label: "Licencia verificada", type: "checkbox" }, { key: "legalBasis", label: "Base legal", type: "select", options: ["NOT_APPLICABLE", "CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_TASK", "LEGITIMATE_INTEREST", "ANONYMIZED"] }, { key: "consentEvidence", label: "Evidencia de consentimiento", type: "textarea" }, { key: "collectedFrom", label: "Recopilado desde", type: "date" }, { key: "collectedTo", label: "Recopilado hasta", type: "date" }, { key: "restrictions", label: "Restricciones", type: "textarea" }, { key: "evidenceId", label: "Evidencia ID" }],
  dataLineage: [{ key: "datasetId", label: "Dataset", type: "select", required: true }, { key: "step", label: "Paso", type: "number", required: true }, { key: "operation", label: "Operación", type: "select", options: ["INGESTION", "CLEANING", "TRANSFORMATION", "LABELING", "AUGMENTATION", "ANONYMIZATION", "AGGREGATION", "SPLIT", "MERGE", "DERIVATION", "DELETION"] }, { key: "description", label: "Descripción", type: "textarea" }, { key: "inputRef", label: "Referencia de entrada" }, { key: "outputRef", label: "Referencia de salida" }, { key: "tool", label: "Herramienta" }, { key: "performedById", label: "Ejecutado por ID" }, { key: "performedAt", label: "Fecha", type: "date" }, { key: "reversible", label: "Reversible", type: "checkbox" }, { key: "evidenceId", label: "Evidencia ID" }],
  modelVersion: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "modelName", label: "Modelo", required: true }, { key: "version", label: "Versión", required: true }, { key: "algorithm", label: "Algoritmo" }, { key: "framework", label: "Framework" }, { key: "baseModel", label: "Modelo base" }, { key: "provider", label: "Proveedor" }, { key: "trainingDatasetId", label: "Dataset de entrenamiento", type: "select" }, { key: "trainingSummary", label: "Resumen de entrenamiento", type: "textarea" }, { key: "explainabilityMethod", label: "Método de explicabilidad" }, { key: "explainabilityNote", label: "Nota de explicabilidad", type: "textarea" }, { key: "limitations", label: "Limitaciones", type: "textarea" }, { key: "intendedUse", label: "Uso previsto", type: "textarea" }, { key: "documentId", label: "Documento ID" }, { key: "evidenceId", label: "Evidencia ID" }],
  modelEvaluation: [{ key: "modelVersionId", label: "Versión de modelo", type: "select", required: true }, { key: "datasetId", label: "Dataset", type: "select" }, { key: "evaluatedAt", label: "Fecha", type: "date" }, { key: "evaluatorId", label: "Evaluador ID" }, { key: "accuracy", label: "Exactitud", type: "number" }, { key: "precision", label: "Precisión", type: "number" }, { key: "recall", label: "Recall", type: "number" }, { key: "f1Score", label: "F1", type: "number" }, { key: "fairnessScore", label: "Equidad", type: "number" }, { key: "biasDetected", label: "Sesgo detectado", type: "checkbox" }, { key: "biasGroups", label: "Grupos de sesgo", type: "textarea" }, { key: "robustness", label: "Robustez", type: "textarea" }, { key: "adversarialTested", label: "Prueba adversarial", type: "checkbox" }, { key: "explainabilityAssessed", label: "Explicabilidad evaluada", type: "checkbox" }, { key: "outcome", label: "Resultado", type: "select", options: ["NOT_EVALUATED", "PASSED", "PASSED_WITH_CONDITIONS", "FAILED"] }, { key: "findings", label: "Hallazgos", type: "textarea" }, { key: "conditions", label: "Condiciones", type: "textarea" }, { key: "capaId", label: "CAPA ID" }, { key: "evidenceId", label: "Evidencia ID" }],
  oversight: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "name", label: "Control", required: true }, { key: "type", label: "Tipo", type: "select", options: ["HUMAN_IN_THE_LOOP", "HUMAN_ON_THE_LOOP", "HUMAN_IN_COMMAND", "DUAL_CONTROL", "SAMPLING_REVIEW", "APPEAL_CHANNEL"] }, { key: "description", label: "Descripción", type: "textarea" }, { key: "responsibleId", label: "Responsable", type: "select" }, { key: "competence", label: "Competencia", type: "textarea" }, { key: "trainingCourseId", label: "Curso ID" }, { key: "canOverride", label: "Puede anular", type: "checkbox" }, { key: "canStop", label: "Puede detener", type: "checkbox" }, { key: "escalationPath", label: "Escalamiento", type: "textarea" }, { key: "frequency", label: "Frecuencia" }, { key: "effectiveness", label: "Eficacia (%)", type: "number" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }, { key: "controlId", label: "Control ID" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "documentId", label: "Documento ID" }, { key: "active", label: "Activo", type: "checkbox" }],
  transparency: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "audience", label: "Audiencia", type: "select", options: ["END_USER", "DATA_SUBJECT", "CUSTOMER", "WORKER", "REGULATOR", "PUBLIC", "INTERNAL"] }, { key: "disclosure", label: "Divulgación", type: "textarea", required: true }, { key: "aiUseDisclosed", label: "Declara uso de IA", type: "checkbox" }, { key: "limitationsDisclosed", label: "Declara limitaciones", type: "checkbox" }, { key: "dataUseDisclosed", label: "Declara uso de datos", type: "checkbox" }, { key: "humanContactOffered", label: "Ofrece contacto humano", type: "checkbox" }, { key: "channel", label: "Canal" }, { key: "language", label: "Idioma" }, { key: "version", label: "Versión" }, { key: "responsibleId", label: "Responsable ID" }, { key: "documentId", label: "Documento ID" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "publishedAt", label: "Publicado", type: "date" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }],
  incident: [{ key: "systemId", label: "Sistema", type: "select" }, { key: "modelVersionId", label: "Versión de modelo", type: "select" }, { key: "type", label: "Tipo", type: "select", options: INCIDENT_TYPES }, { key: "severity", label: "Severidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "title", label: "Título", required: true }, { key: "description", label: "Descripción", type: "textarea" }, { key: "occurredAt", label: "Ocurrió", type: "date" }, { key: "detectedBy", label: "Detectado por" }, { key: "affectedParties", label: "Partes afectadas", type: "textarea" }, { key: "affectedCount", label: "Afectados", type: "number" }, { key: "harmDescription", label: "Daño", type: "textarea" }, { key: "responsibleId", label: "Responsable", type: "select" }, { key: "dueDate", label: "Fecha objetivo", type: "date" }],
  supplier: [{ key: "supplierName", label: "Proveedor", required: true }, { key: "systemId", label: "Sistema", type: "select" }, { key: "serviceType", label: "Servicio", type: "select", options: ["FOUNDATION_MODEL", "MODEL_API", "DATASET", "ANNOTATION", "MLOPS_PLATFORM", "EMBEDDED_FEATURE", "CONSULTING", "OTHER"] }, { key: "modelDocumentation", label: "Documentación de modelo", type: "checkbox" }, { key: "trainingDataDisclosed", label: "Datos de entrenamiento declarados", type: "checkbox" }, { key: "evaluationResultsShared", label: "Comparte evaluaciones", type: "checkbox" }, { key: "biasTestingEvidence", label: "Evidencia de sesgo", type: "checkbox" }, { key: "securityCertification", label: "Certificación de seguridad" }, { key: "dataProcessingTerms", label: "Términos de datos", type: "textarea" }, { key: "subprocessors", label: "Subencargados", type: "textarea" }, { key: "dataResidency", label: "Residencia de datos" }, { key: "usesCustomerDataForTraining", label: "Usa datos del cliente", type: "checkbox" }, { key: "incidentNotificationSla", label: "SLA de incidentes" }, { key: "exitPlan", label: "Plan de salida", type: "textarea" }, { key: "risks", label: "Riesgos", type: "textarea" }, { key: "requirements", label: "Requisitos", type: "textarea" }, { key: "outcome", label: "Resultado", type: "select", options: ["UNDER_REVIEW", "APPROVED", "CONDITIONAL", "REJECTED"] }, { key: "score", label: "Puntaje", type: "number" }, { key: "assessedAt", label: "Evaluado", type: "date" }, { key: "nextReviewDate", label: "Próxima revisión", type: "date" }, { key: "contractExpiry", label: "Vencimiento contrato", type: "date" }, { key: "evidenceId", label: "Evidencia ID" }, { key: "documentId", label: "Documento ID" }],
  change: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "modelVersionId", label: "Versión de modelo", type: "select" }, { key: "title", label: "Título", required: true }, { key: "changeType", label: "Tipo", type: "select", options: ["MODEL_UPDATE", "RETRAINING", "DATA_CHANGE", "PROMPT_CHANGE", "SCOPE_CHANGE", "INTEGRATION", "CONFIGURATION", "THRESHOLD_CHANGE", "DECOMMISSION", "OTHER"] }, { key: "description", label: "Descripción", type: "textarea" }, { key: "justification", label: "Justificación", type: "textarea" }, { key: "impactAnalysis", label: "Análisis de impacto", type: "textarea" }, { key: "affectsImpactAssessment", label: "Afecta evaluación de impacto", type: "checkbox" }, { key: "requiresReassessment", label: "Requiere reevaluación", type: "checkbox" }, { key: "requiresRetraining", label: "Requiere reentrenamiento", type: "checkbox" }, { key: "requiresRevalidation", label: "Requiere revalidación", type: "checkbox" }, { key: "rollbackPlan", label: "Plan de reversión", type: "textarea" }, { key: "changeRequestId", label: "Cambio corporativo ID" }, { key: "evidenceId", label: "Evidencia ID" }],
  metric: [{ key: "systemId", label: "Sistema", type: "select", required: true }, { key: "modelVersionId", label: "Versión de modelo", type: "select" }, { key: "period", label: "Periodo", required: true }, { key: "kind", label: "Tipo", type: "select", options: ["ACCURACY", "PRECISION", "RECALL", "F1", "ERROR_RATE", "LATENCY", "THROUGHPUT", "DRIFT", "FAIRNESS", "TOXICITY", "HALLUCINATION_RATE", "HUMAN_OVERRIDE_RATE", "REJECTION_RATE", "COST", "AVAILABILITY", "OTHER"] }, { key: "name", label: "Métrica", required: true }, { key: "value", label: "Valor", type: "number", required: true }, { key: "unit", label: "Unidad" }, { key: "baseline", label: "Línea base", type: "number" }, { key: "threshold", label: "Umbral", type: "number" }, { key: "higherIsBetter", label: "Mayor es mejor", type: "checkbox" }, { key: "sampleSize", label: "Muestra", type: "number" }, { key: "humanOverrides", label: "Anulaciones humanas", type: "number" }, { key: "note", label: "Nota", type: "textarea" }, { key: "indicatorId", label: "Indicador ID" }, { key: "evidenceId", label: "Evidencia ID" }],
};

function aimsInputValue(value: unknown, field: AimsField) {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "date") return value ? new Date(String(value)).toISOString().slice(0, 10) : "";
  return value == null ? "" : String(value);
}

function AimsRecordEditor({ value, pending, systems, datasets, models, members, onClose, onSave }: { value: AimsEditorValue; pending: boolean; systems: AimsPayload["systems"]; datasets: AimsPayload["datasets"]; models: AimsPayload["models"]; members: AimsPayload["members"]; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const source = value?.value ?? {};
  const fields = value ? AIMS_FIELDS[value.kind] : [];
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  useEffect(() => { if (!value) return; const next: Record<string, string | number | boolean> = {}; for (const field of fields) next[field.key] = aimsInputValue(source[field.key], field) as string | boolean; setForm(next); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value) return null;
  const set = (key: string, next: string | number | boolean) => setForm((current) => ({ ...current, [key]: next }));
  const valid = fields.filter((field) => field.required).every((field) => form[field.key] !== "" && form[field.key] != null);
  const options = (field: AimsField) => field.key === "systemId" ? systems.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })) : field.key === "datasetId" || field.key === "trainingDatasetId" ? datasets.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` })) : field.key === "modelVersionId" ? models.map((m) => ({ value: m.id, label: `${m.code} · ${m.modelName}` })) : field.key === "ownerId" || field.key === "stewardId" || field.key === "responsibleId" ? members.map((m) => ({ value: m.id, label: m.name })) : (field.options ?? []).map((option) => ({ value: option, label: option }));
  const submit = () => { const payload: Record<string, unknown> = {}; for (const field of fields) { const raw = form[field.key]; if (field.type === "checkbox") payload[field.key] = Boolean(raw); else if (field.type === "number") { if (raw !== "") payload[field.key] = Number(raw); } else if (field.type === "date") { if (raw) payload[field.key] = new Date(String(raw)).toISOString(); } else if (raw !== "") payload[field.key] = raw; } onSave(payload); };
  const title = value.kind === "impactAssessment" ? "evaluación de impacto" : value.kind === "useCase" ? "caso de uso" : value.kind === "dataSource" ? "fuente de datos" : value.kind === "dataLineage" ? "paso de linaje" : value.kind === "modelVersion" ? "versión de modelo" : value.kind === "modelEvaluation" ? "evaluación de modelo" : value.kind === "oversight" ? "control de supervisión" : value.kind === "transparency" ? "registro de transparencia" : value.kind === "incident" ? "incidente" : value.kind === "supplier" ? "evaluación de proveedor" : value.kind === "change" ? "solicitud de cambio" : value.kind === "metric" ? "métrica" : value.kind === "system" ? "sistema de IA" : value.kind === "dataset" ? "dataset" : "riesgo de IA";
  return <Modal open title={`Editar ${title}`} onClose={onClose} width={820}><div className="nf-modal-form nf-iso-edit-form"><AimsModalError /><div className="nf-iso-edit-fields" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>{fields.map((field) => field.type === "checkbox" ? <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => set(field.key, e.target.checked)} />{field.label}</label> : <label key={field.key}>{field.label}{field.type === "textarea" ? <textarea className="nf-app-input" rows={3} value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} /> : field.type === "select" ? <select className="nf-app-input" value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)}><option value="">Seleccionar…</option>{options(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="nf-app-input" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(form[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} />}</label>)}</div><div className="nf-modal-actions nf-iso-edit-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !valid} onClick={submit}>Guardar cambios</button></div></div></Modal>;
}

function AimsModalError() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const handleError = (event: Event) => {
      const next = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (next) setMessage(String(next));
    };
    window.addEventListener("normaflow:server-action-error", handleError);
    return () => window.removeEventListener("normaflow:server-action-error", handleError);
  }, []);
  return message ? <div className="nf-modal-error" role="alert">{message}</div> : null;
}
