"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, LayoutDashboard, Boxes, Scale, AlertTriangle, Database, Cpu, UserCheck, Megaphone, Siren, Handshake, GitCompare, Activity, ArrowRight, Check, X, Send } from "lucide-react";
import type { AimsPayload } from "@/lib/aims/queries";
import { decideHumanReview, submitForHumanReview, transitionAIIncident } from "@/lib/actions/aims";

type Tab = "panel" | "systems" | "outputs" | "impact" | "risks" | "datasets" | "models" | "oversight" | "transparency" | "incidents" | "suppliers" | "changes" | "monitoring";

const LEVEL_COLORS: Record<string, string> = { LOW: "#16a34a", MEDIUM: "#d68a1a", MODERATE: "#d68a1a", HIGH: "#ea580c", CRITICAL: "#b91c1c", SEVERE: "#b91c1c" };
const CLASS_COLORS: Record<string, string> = { NOT_CLASSIFIED: "#64748b", MINIMAL: "#16a34a", LIMITED: "#d68a1a", HIGH: "#ea580c", UNACCEPTABLE: "#b91c1c" };
const CLASS_LABEL: Record<string, string> = { NOT_CLASSIFIED: "Sin clasificar", MINIMAL: "Mínimo", LIMITED: "Limitado", HIGH: "Alto", UNACCEPTABLE: "Inaceptable" };
const REVIEW_COLORS: Record<string, string> = { DRAFT: "#64748b", HUMAN_REVIEW: "#d68a1a", APPROVED: "#16a34a", REJECTED: "#b91c1c" };
const REVIEW_LABEL: Record<string, string> = { DRAFT: "Borrador", HUMAN_REVIEW: "En revisión humana", APPROVED: "Aprobado", REJECTED: "Rechazado" };
const STATUS_LABEL: Record<string, string> = { PLANNED: "Planificado", IN_DEVELOPMENT: "En desarrollo", IN_VALIDATION: "En validación", APPROVED: "Aprobado", IN_PRODUCTION: "En producción", SUSPENDED: "Suspendido", RETIRED: "Retirado" };
const INCIDENT_LABEL: Record<string, string> = { REPORTED: "Reportado", TRIAGED: "Triado", INVESTIGATING: "Investigando", ROOT_CAUSE: "Causa raíz", ACTION_PLAN: "Plan de acción", IMPLEMENTED: "Implementado", EFFECTIVENESS_VERIFIED: "Eficacia verificada", CLOSED: "Cerrado" };
const INCIDENT_FLOW = ["REPORTED", "TRIAGED", "INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"];
const ACCEPT_LABEL: Record<string, string> = { ACCEPTABLE: "Aceptable", TOLERABLE: "Tolerable", NOT_ACCEPTABLE: "No aceptable" };
const QUALITY_LABEL: Record<string, string> = { NOT_ASSESSED: "Sin valorar", POOR: "Pobre", ACCEPTABLE: "Aceptable", GOOD: "Buena", EXCELLENT: "Excelente" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #0f7b8a", background: "#ecfeff", color: "#0e7490", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const pct = (v: number | null | undefined) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

export default function AimsClient({ initial, demo = false }: { initial: AimsPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canManage = initial.canManage && !demo;
  const canApprove = initial.canApprove && !demo;
  const s = initial.summary;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";
  const systemCode = (id: string | null | undefined) => initial.systems.find((x) => x.id === id)?.code ?? "—";

  const tabs: { id: Tab; label: string; Icon: typeof BrainCircuit }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "systems", label: "Inventario IA", Icon: Boxes },
    { id: "outputs", label: "Revisión humana", Icon: UserCheck },
    { id: "impact", label: "Evaluación de impacto", Icon: Scale },
    { id: "risks", label: "Riesgos", Icon: AlertTriangle },
    { id: "datasets", label: "Datos", Icon: Database },
    { id: "models", label: "Modelos", Icon: Cpu },
    { id: "oversight", label: "Supervisión", Icon: UserCheck },
    { id: "transparency", label: "Transparencia", Icon: Megaphone },
    { id: "incidents", label: "Incidentes", Icon: Siren },
    { id: "suppliers", label: "Proveedores", Icon: Handshake },
    { id: "changes", label: "Cambios", Icon: GitCompare },
    { id: "monitoring", label: "Monitoreo", Icon: Activity },
  ];

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const assessments = initial.systems.flatMap((system) =>
    system.impactAssessment ? [{ ...system.impactAssessment, systemCode: system.code, systemName: system.name, classification: system.classification, drivers: system.missingSafeguards }] : [],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#cffafe", display: "grid", placeItems: "center" }}><BrainCircuit size={22} color="#0e7490" /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sistema de Gestión de Inteligencia Artificial</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>ISO/IEC 42001:2023 — inventario, impacto, datos, modelos, supervisión humana, transparencia e incidentes.</p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      {s.humanRuleViolations > 0 && (
        <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>
          <b>Regla humana incumplida:</b> {s.humanRuleViolations} salida(s) de IA con decisión sin revisor, sin fecha o promovida sin aprobación. Revísalas en la pestaña de revisión humana.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Sistemas de IA" value={s.systems} />
        <Stat label="En producción" value={s.inProduction} />
        <Stat label="Riesgo alto" value={s.highRisk} accent={s.highRisk ? "#ea580c" : undefined} />
        <Stat label="Sin salvaguardas" value={s.systemsMissingSafeguards} accent={s.systemsMissingSafeguards ? "#b91c1c" : undefined} />
        <Stat label="Pendientes de revisión" value={s.outputsAwaitingReview} accent={s.outputsAwaitingReview ? "#d68a1a" : undefined} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "#ea580c" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#0f7b8a" : "#e5eaf2"), background: tab === id ? "#ecfeff" : "#fff", color: tab === id ? "#0e7490" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Regla humana (§A.9.2)</h3>
            <Row k="Salidas en revisión humana" v={s.outputsAwaitingReview} />
            <Row k="Aprobadas por una persona" v={s.outputsApproved} />
            <Row k="Rechazadas" v={s.outputsRejected} />
            <Row k="Promovidas a registro oficial" v={s.outputsPromoted} />
            <Row k="Incumplimientos detectados" v={s.humanRuleViolations} danger={s.humanRuleViolations > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Ninguna salida de IA se convierte en registro oficial sin pasar por DRAFT → HUMAN_REVIEW → APPROVED.</p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Gobernanza de datos y modelos</h3>
            <Row k="Datasets" v={s.datasets} />
            <Row k="Con datos personales" v={s.datasetsWithPersonalData} />
            <Row k="Sin revisión de sesgo" v={s.datasetsWithoutBiasReview} danger={s.datasetsWithoutBiasReview > 0} />
            <Row k="Modelos registrados" v={s.models} />
            <Row k="Modelos en producción" v={s.modelsInProduction} />
            <Row k="Modelos esperando revisión" v={s.modelsAwaitingReview} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Riesgos, impacto y supervisión</h3>
            <Row k="Riesgos de IA" v={s.risks} />
            <Row k="Riesgo no aceptable" v={s.unacceptableRisks} danger={s.unacceptableRisks > 0} />
            <Row k="Evaluaciones aprobadas" v={s.approvedAssessments} />
            <Row k="Evaluaciones en revisión" v={s.pendingAssessments} />
            <Row k="Controles de supervisión" v={s.controls} />
            <Row k="Registros de transparencia" v={s.transparencyRecords} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Monitoreo continuo (§A.6.2.6)</h3>
            <Row k="Mediciones registradas" v={s.monitoring.measurements} />
            <Row k="Umbrales incumplidos" v={s.monitoring.breached} danger={s.monitoring.breached > 0} />
            <Row k="Con deriva detectada" v={s.monitoring.drifting} danger={s.monitoring.drifting > 0} />
            <Row k="Sistemas afectados" v={s.monitoring.systemsWithBreach} />
            <Row k="En producción sin monitorear" v={s.monitoring.unmonitoredSystems} danger={s.monitoring.unmonitoredSystems > 0} />
            <Row k="Incidentes por notificar" v={s.incidentsRequiringNotification} danger={s.incidentsRequiringNotification > 0} />
          </div>
        </div>
      )}

      {tab === "systems" && (
        <Table head={["Código", "Sistema", "Propietario", "Proveedor", "Criticidad", "Clasificación", "Autonomía", "Estado", "Salvaguardas faltantes"]}>
          {initial.systems.map((system) => (
            <tr key={system.id}>
              <td style={td}>{system.code}</td>
              <td style={td}><b>{system.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{system.purpose}</div></td>
              <td style={td}>{nameOf(system.ownerId)}</td>
              <td style={td}>{system.provider ?? "—"}<div style={{ color: "#94a3b8", fontSize: 11 }}>{system.providerType}</div></td>
              <td style={td}><span style={chip(LEVEL_COLORS[system.criticality] + "22", LEVEL_COLORS[system.criticality])}>{system.criticality}</span></td>
              <td style={td}><span style={chip(CLASS_COLORS[system.classification] + "22", CLASS_COLORS[system.classification])}>{CLASS_LABEL[system.classification]}</span></td>
              <td style={td}>{system.autonomy}</td>
              <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{STATUS_LABEL[system.status] ?? system.status}</span></td>
              <td style={td}>{system.missingSafeguards.length ? <span style={{ color: "#b91c1c" }}>{system.missingSafeguards.join(", ")}</span> : <span style={{ color: "#16a34a" }}>completas</span>}</td>
            </tr>
          ))}
          {initial.systems.length === 0 && <tr><td style={td} colSpan={9}>Sin sistemas de IA registrados.</td></tr>}
        </Table>
      )}

      {tab === "outputs" && (
        <>
          <div style={{ ...card, borderColor: "#a5f3fc", background: "#ecfeff", color: "#0e7490", fontSize: 13 }}>
            Toda salida de IA queda aquí con su prompt, modelo, versión, autor y cambios humanos. Solo una persona con permiso de aprobación puede llevarla a APPROVED, y solo entonces puede promoverse a un registro oficial.
          </div>
          <Table head={["Código", "Sistema", "Modelo", "Versión", "Solicitó", "Fecha", "Editada", "Datos personales", "Estado", "Revisor", "Promovida", canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.outputs.map((output) => (
              <tr key={output.id}>
                <td style={td}>{output.code}</td>
                <td style={td}>{systemCode(output.systemId)}</td>
                <td style={td}>{output.model}</td>
                <td style={td}>{output.modelVersionLabel}</td>
                <td style={td}>{nameOf(output.requestedById)}</td>
                <td style={td}>{fmt(output.generatedAt)}</td>
                <td style={td}>{output.edited ? "Sí" : "No"}</td>
                <td style={td}>{output.containsPersonalData ? <span style={chip("#fef3c7", "#92400e")}>Sí</span> : "No"}</td>
                <td style={td}>
                  <span style={chip(REVIEW_COLORS[output.reviewStatus] + "22", REVIEW_COLORS[output.reviewStatus])}>{REVIEW_LABEL[output.reviewStatus]}</span>
                  {!output.integrity.valid && <div style={{ color: "#b91c1c", fontSize: 11 }}>{output.integrity.problems.join("; ")}</div>}
                </td>
                <td style={td}>{output.reviewerId ? `${nameOf(output.reviewerId)} · ${fmt(output.reviewedAt)}` : "—"}</td>
                <td style={td}>{output.promotedAt ? `${output.promotedEntityType} · ${fmt(output.promotedAt)}` : "—"}</td>
                {(canManage || canApprove) && (
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {canManage && output.reviewStatus === "DRAFT" && (
                        <button disabled={pending} onClick={() => run(() => submitForHumanReview("output", output.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>
                      )}
                      {canApprove && output.reviewStatus === "HUMAN_REVIEW" && (
                        <>
                          <button disabled={pending} onClick={() => run(() => decideHumanReview("output", output.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" }}><Check size={12} /> Aprobar</button>
                          <button disabled={pending} onClick={() => { const note = window.prompt("Motivo del rechazo:") ?? ""; if (note) run(() => decideHumanReview("output", output.id, { to: "REJECTED", note })); }} style={{ ...miniBtn, borderColor: "#b91c1c", background: "#fef2f2", color: "#b91c1c" }}><X size={12} /> Rechazar</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.outputs.length === 0 && <tr><td style={td} colSpan={12}>Sin salidas de IA registradas.</td></tr>}
          </Table>
        </>
      )}

      {tab === "impact" && (
        <Table head={["Sistema", "Evaluación", "Versión", "Severidad agregada", "Clasificación", "Salvaguardas faltantes"]}>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td style={td}>{a.systemCode}<div style={{ color: "#64748b", fontSize: 12 }}>{a.systemName}</div></td>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.version}</td>
              <td style={td}><span style={chip((LEVEL_COLORS[a.severity] ?? "#64748b") + "22", LEVEL_COLORS[a.severity] ?? "#64748b")}>{a.severity}</span></td>
              <td style={td}><span style={chip(CLASS_COLORS[a.classification] + "22", CLASS_COLORS[a.classification])}>{CLASS_LABEL[a.classification]}</span></td>
              <td style={td}>{a.drivers.length ? a.drivers.join(", ") : "—"}</td>
            </tr>
          ))}
          {assessments.length === 0 && <tr><td style={td} colSpan={6}>Sin evaluaciones de impacto aprobadas.</td></tr>}
        </Table>
      )}

      {tab === "risks" && (
        <Table head={["Código", "Sistema", "Riesgo", "Categoría", "P×I", "Inherente", "Residual", "Aceptabilidad", "Tratamiento", "Estado", "Responsable"]}>
          {initial.risks.map((risk) => (
            <tr key={risk.id}>
              <td style={td}>{risk.code}</td>
              <td style={td}>{systemCode(risk.systemId)}</td>
              <td style={td}>{risk.title}</td>
              <td style={td}>{risk.category}</td>
              <td style={td}>{risk.likelihood}×{risk.impact}</td>
              <td style={td}><span style={chip(LEVEL_COLORS[risk.inherentLevel] + "22", LEVEL_COLORS[risk.inherentLevel])}>{risk.inherentScore ?? "—"}</span></td>
              <td style={td}><span style={chip(LEVEL_COLORS[risk.residualLevel] + "22", LEVEL_COLORS[risk.residualLevel])}>{risk.residualScore ?? "—"}</span></td>
              <td style={td}>{risk.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("#fee2e2", "#b91c1c")}>{ACCEPT_LABEL[risk.acceptability]}</span> : ACCEPT_LABEL[risk.acceptability]}</td>
              <td style={td}>{risk.treatment}</td>
              <td style={td}>{risk.status}</td>
              <td style={td}>{nameOf(risk.ownerId)}</td>
            </tr>
          ))}
          {initial.risks.length === 0 && <tr><td style={td} colSpan={11}>Sin riesgos de IA registrados.</td></tr>}
        </Table>
      )}

      {tab === "datasets" && (
        <Table head={["Código", "Dataset", "Clasificación", "Datos personales", "Base legal", "Registros", "Calidad", "Fuentes", "Linaje", "Sesgo", "Apto entrenamiento"]}>
          {initial.datasets.map((dataset) => (
            <tr key={dataset.id}>
              <td style={td}>{dataset.code}</td>
              <td style={td}><b>{dataset.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{dataset.purpose ?? "—"}</div></td>
              <td style={td}>{dataset.classification}</td>
              <td style={td}>{dataset.containsSpecialCategories ? <span style={chip("#fee2e2", "#b91c1c")}>Categorías especiales</span> : dataset.containsPersonalData ? <span style={chip("#fef3c7", "#92400e")}>Sí</span> : "No"}</td>
              <td style={td}>{dataset.legalBasis}</td>
              <td style={td}>{dataset.recordCount ?? "—"}</td>
              <td style={td}>{dataset.qualityScore ?? "—"}<div style={{ color: "#94a3b8", fontSize: 11 }}>{QUALITY_LABEL[dataset.qualityLevel]}</div></td>
              <td style={td}>{dataset.sources}</td>
              <td style={td}>{dataset.lineageSteps}{!dataset.traceable && <div style={{ color: "#b91c1c", fontSize: 11 }}>sin procedencia</div>}</td>
              <td style={td}>{dataset.biasFlags.length ? <span style={{ color: "#b91c1c", fontSize: 12 }}>{dataset.biasFlags.join(", ")}</span> : <span style={{ color: "#16a34a" }}>revisado</span>}</td>
              <td style={td}>{dataset.fitForTraining ? "Sí" : <span style={{ color: "#b91c1c" }}>No</span>}</td>
            </tr>
          ))}
          {initial.datasets.length === 0 && <tr><td style={td} colSpan={11}>Sin datasets registrados.</td></tr>}
        </Table>
      )}

      {tab === "models" && (
        <Table head={["Código", "Sistema", "Modelo", "Versión", "Etapa", "Revisión humana", "Última evaluación", "Exactitud", "Equidad", "Sesgo", "Explicabilidad", canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.models.map((model) => (
            <tr key={model.id}>
              <td style={td}>{model.code}</td>
              <td style={td}>{systemCode(model.systemId)}</td>
              <td style={td}>{model.modelName}<div style={{ color: "#94a3b8", fontSize: 11 }}>{model.algorithm ?? model.provider ?? "—"}</div></td>
              <td style={td}>{model.version}</td>
              <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{model.stage}</span></td>
              <td style={td}><span style={chip(REVIEW_COLORS[model.reviewStatus] + "22", REVIEW_COLORS[model.reviewStatus])}>{REVIEW_LABEL[model.reviewStatus]}</span></td>
              <td style={td}>{model.lastEvaluation ? `${model.lastEvaluation.outcome} · ${fmt(model.lastEvaluation.evaluatedAt)}` : "—"}</td>
              <td style={td}>{pct(model.lastEvaluation?.accuracy)}</td>
              <td style={td}>{pct(model.lastEvaluation?.fairnessScore)}</td>
              <td style={td}>{model.lastEvaluation?.biasDetected ? <span style={chip("#fee2e2", "#b91c1c")}>detectado</span> : "—"}</td>
              <td style={td}>{model.explainabilityMethod ?? <span style={{ color: "#b91c1c" }}>sin técnica</span>}</td>
              {(canManage || canApprove) && (
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canManage && model.reviewStatus === "DRAFT" && <button disabled={pending} onClick={() => run(() => submitForHumanReview("modelVersion", model.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>}
                    {canApprove && model.reviewStatus === "HUMAN_REVIEW" && (
                      <>
                        <button disabled={pending} onClick={() => run(() => decideHumanReview("modelVersion", model.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" }}><Check size={12} /> Aprobar</button>
                        <button disabled={pending} onClick={() => { const note = window.prompt("Motivo del rechazo:") ?? ""; if (note) run(() => decideHumanReview("modelVersion", model.id, { to: "REJECTED", note })); }} style={{ ...miniBtn, borderColor: "#b91c1c", background: "#fef2f2", color: "#b91c1c" }}><X size={12} /> Rechazar</button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {initial.models.length === 0 && <tr><td style={td} colSpan={12}>Sin versiones de modelo registradas.</td></tr>}
        </Table>
      )}

      {tab === "oversight" && (
        <Table head={["Código", "Sistema", "Control", "Tipo", "Responsable", "Puede anular", "Puede detener", "Eficacia", "Última verificación", "Activo"]}>
          {initial.controls.map((control) => (
            <tr key={control.id}>
              <td style={td}>{control.code}</td>
              <td style={td}>{systemCode(control.systemId)}</td>
              <td style={td}>{control.name}</td>
              <td style={td}>{control.type}</td>
              <td style={td}>{nameOf(control.responsibleId)}</td>
              <td style={td}>{control.canOverride ? "Sí" : <span style={{ color: "#b91c1c" }}>No</span>}</td>
              <td style={td}>{control.canStop ? "Sí" : <span style={{ color: "#b91c1c" }}>No</span>}</td>
              <td style={td}>{control.effectiveness ?? "—"}</td>
              <td style={td}>{fmt(control.lastVerifiedAt)}</td>
              <td style={td}>{control.active ? "Sí" : "No"}</td>
            </tr>
          ))}
          {initial.controls.length === 0 && <tr><td style={td} colSpan={10}>Sin controles de supervisión humana.</td></tr>}
        </Table>
      )}

      {tab === "transparency" && (
        <Table head={["Código", "Sistema", "Audiencia", "Declara uso de IA", "Contacto humano", "Canal", "Versión", "Publicado"]}>
          {initial.transparency.map((record) => (
            <tr key={record.id}>
              <td style={td}>{record.code}</td>
              <td style={td}>{systemCode(record.systemId)}</td>
              <td style={td}>{record.audience}</td>
              <td style={td}>{record.aiUseDisclosed ? "Sí" : <span style={{ color: "#b91c1c" }}>No</span>}</td>
              <td style={td}>{record.humanContactOffered ? "Sí" : "No"}</td>
              <td style={td}>{record.channel ?? "—"}</td>
              <td style={td}>{record.version}</td>
              <td style={td}>{fmt(record.publishedAt)}</td>
            </tr>
          ))}
          {initial.transparency.length === 0 && <tr><td style={td} colSpan={8}>Sin registros de transparencia.</td></tr>}
        </Table>
      )}

      {tab === "incidents" && (
        <Table head={["Código", "Sistema", "Tipo", "Severidad", "Título", "Detección", "Afectados", "Notificación", "Estado", canManage ? "Avanzar" : ""].filter(Boolean) as string[]}>
          {initial.incidents.map((incident) => {
            const index = INCIDENT_FLOW.indexOf(incident.status);
            const next = index >= 0 && index < INCIDENT_FLOW.length - 1 ? INCIDENT_FLOW[index + 1] : null;
            return (
              <tr key={incident.id}>
                <td style={td}>{incident.code}</td>
                <td style={td}>{systemCode(incident.systemId)}</td>
                <td style={td}>{incident.type}</td>
                <td style={td}><span style={chip(LEVEL_COLORS[incident.severity] + "22", LEVEL_COLORS[incident.severity])}>{incident.severity}</span></td>
                <td style={td}>{incident.title}</td>
                <td style={td}>{fmt(incident.detectedAt)}</td>
                <td style={td}>{incident.affectedCount ?? "—"}</td>
                <td style={td}>{incident.notificationRequired ? <span style={chip("#fef3c7", "#92400e")}>Requerida</span> : "—"}</td>
                <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{INCIDENT_LABEL[incident.status] ?? incident.status}</span></td>
                {canManage && <td style={td}>{next ? <button disabled={pending} onClick={() => run(() => transitionAIIncident(incident.id, { to: next as never }))} style={miniBtn}><ArrowRight size={12} /> {INCIDENT_LABEL[next]}</button> : <span style={{ color: "#94a3b8" }}>Cerrado</span>}</td>}
              </tr>
            );
          })}
          {initial.incidents.length === 0 && <tr><td style={td} colSpan={10}>Sin incidentes de IA.</td></tr>}
        </Table>
      )}

      {tab === "suppliers" && (
        <Table head={["Código", "Proveedor", "Servicio", "Resultado", "Puntaje", "Usa datos del cliente", "Evaluado", "Próxima revisión"]}>
          {initial.suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td style={td}>{supplier.code}</td>
              <td style={td}>{supplier.supplierName}</td>
              <td style={td}>{supplier.serviceType}</td>
              <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{supplier.outcome}</span></td>
              <td style={td}>{supplier.score ?? "—"}</td>
              <td style={td}>{supplier.usesCustomerDataForTraining ? <span style={chip("#fee2e2", "#b91c1c")}>Sí</span> : "No"}</td>
              <td style={td}>{fmt(supplier.assessedAt)}</td>
              <td style={td}>{fmt(supplier.nextReviewDate)}</td>
            </tr>
          ))}
          {initial.suppliers.length === 0 && <tr><td style={td} colSpan={8}>Sin evaluaciones de proveedores de IA.</td></tr>}
        </Table>
      )}

      {tab === "changes" && (
        <Table head={["Código", "Sistema", "Cambio", "Tipo", "Reevaluación", "Revisión humana", "Revisor", "Implementado", canManage || canApprove ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.changes.map((change) => (
            <tr key={change.id}>
              <td style={td}>{change.code}</td>
              <td style={td}>{systemCode(change.systemId)}</td>
              <td style={td}>{change.title}</td>
              <td style={td}>{change.changeType}</td>
              <td style={td}>{change.requiresReassessment ? <span style={chip("#fef3c7", "#92400e")}>Requerida</span> : "—"}</td>
              <td style={td}><span style={chip(REVIEW_COLORS[change.reviewStatus] + "22", REVIEW_COLORS[change.reviewStatus])}>{REVIEW_LABEL[change.reviewStatus]}</span></td>
              <td style={td}>{change.reviewerId ? `${nameOf(change.reviewerId)} · ${fmt(change.reviewedAt)}` : "—"}</td>
              <td style={td}>{fmt(change.implementedAt)}</td>
              {(canManage || canApprove) && (
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canManage && change.reviewStatus === "DRAFT" && <button disabled={pending} onClick={() => run(() => submitForHumanReview("changeRequest", change.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>}
                    {canApprove && change.reviewStatus === "HUMAN_REVIEW" && (
                      <>
                        <button disabled={pending} onClick={() => run(() => decideHumanReview("changeRequest", change.id, { to: "APPROVED" }))} style={{ ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" }}><Check size={12} /> Aprobar</button>
                        <button disabled={pending} onClick={() => { const note = window.prompt("Motivo del rechazo:") ?? ""; if (note) run(() => decideHumanReview("changeRequest", change.id, { to: "REJECTED", note })); }} style={{ ...miniBtn, borderColor: "#b91c1c", background: "#fef2f2", color: "#b91c1c" }}><X size={12} /> Rechazar</button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {initial.changes.length === 0 && <tr><td style={td} colSpan={9}>Sin solicitudes de cambio.</td></tr>}
        </Table>
      )}

      {tab === "monitoring" && (
        <Table head={["Sistema", "Periodo", "Métrica", "Tipo", "Valor", "Umbral", "Línea base", "Umbral incumplido", "Deriva"]}>
          {initial.metrics.map((metric) => (
            <tr key={metric.id}>
              <td style={td}>{systemCode(metric.systemId)}</td>
              <td style={td}>{metric.period}</td>
              <td style={td}>{metric.name}</td>
              <td style={td}>{metric.kind}</td>
              <td style={td}><b>{metric.value}</b></td>
              <td style={td}>{metric.threshold ?? "—"}</td>
              <td style={td}>{metric.baseline ?? "—"}</td>
              <td style={td}>{metric.breached ? <span style={chip("#fee2e2", "#b91c1c")}>Sí</span> : "No"}</td>
              <td style={td}>{metric.driftDetected ? <span style={chip("#fef3c7", "#92400e")}>Sí</span> : "No"}</td>
            </tr>
          ))}
          {initial.metrics.length === 0 && <tr><td style={td} colSpan={9}>Sin mediciones de monitoreo.</td></tr>}
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (<div style={{ ...card, padding: 14 }}><div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#0f172a" }}>{value}</div><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div></div>);
}
function Row({ k, v, danger }: { k: string; v: number; danger?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}><span>{k}</span><b style={{ color: danger ? "#b91c1c" : "#0f172a" }}>{v}</b></div>);
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
