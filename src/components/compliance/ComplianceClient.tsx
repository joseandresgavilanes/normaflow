"use client";

import { useState, useTransition } from "react";
import {
  Scale, LayoutDashboard, BookMarked, Landmark, AlertTriangle, ShieldCheck, ClipboardCheck,
  CalendarClock, RefreshCw, UserX, Megaphone, Search, CircleOff, Wrench, GraduationCap, Gavel,
  Check, X, Send, ArrowRight, BellRing, EyeOff, Lock,
} from "lucide-react";
import type { CompliancePayload } from "@/lib/compliance/queries";
import {
  completeCalendarItem, decideEvaluation, refreshCalendarAlerts, reviewConflictDeclaration,
  setBreachStatus, submitEvaluationForReview, approveRemediationPlan, updateRemediationProgress,
  verifyRemediationEffectiveness, acknowledgeGoverningBodyReport, submitGoverningBodyReport,
} from "@/lib/actions/compliance";
import {
  acknowledgeSpeakUpReport, closeSpeakUpCase, decideAdmissibility, provideCaseFeedback,
  purgeSpeakUpCase, setInvestigationStatus, startSpeakUpTriage,
} from "@/lib/actions/speak-up";

type Tab =
  | "panel" | "obligations" | "sources" | "risks" | "controls" | "evaluations" | "calendar"
  | "changes" | "conflicts" | "channel" | "investigations" | "breaches" | "remediation"
  | "training" | "board";

const LEVEL_COLORS: Record<string, string> = { LOW: "#16a34a", MINOR: "#16a34a", MEDIUM: "#d68a1a", MODERATE: "#d68a1a", HIGH: "#ea580c", MAJOR: "#ea580c", CRITICAL: "#b91c1c", SEVERE: "#b91c1c" };
const STATUS_COLORS: Record<string, string> = { COMPLIANT: "#16a34a", PARTIALLY_COMPLIANT: "#d68a1a", NON_COMPLIANT: "#b91c1c", NOT_EVALUATED: "#64748b", NOT_APPLICABLE: "#94a3b8" };
const STATUS_LABEL: Record<string, string> = { COMPLIANT: "Cumple", PARTIALLY_COMPLIANT: "Cumple parcialmente", NON_COMPLIANT: "No cumple", NOT_EVALUATED: "Sin evaluar", NOT_APPLICABLE: "No aplicable" };
const APPLICABILITY_LABEL: Record<string, string> = { APPLICABLE: "Aplicable", PARTIALLY_APPLICABLE: "Parcialmente aplicable", NOT_APPLICABLE: "No aplicable", UNDER_ASSESSMENT: "En evaluación" };
const REVIEW_COLORS: Record<string, string> = { DRAFT: "#64748b", UNDER_REVIEW: "#d68a1a", APPROVED: "#16a34a", REJECTED: "#b91c1c", PENDING: "#d68a1a", ACCEPTED: "#16a34a", MITIGATED: "#0e7490" };
const REVIEW_LABEL: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", REJECTED: "Rechazada", PENDING: "Pendiente", ACCEPTED: "Aceptada", MITIGATED: "Mitigada" };
const CALENDAR_LABEL: Record<string, string> = { SCHEDULED: "Programado", DUE_SOON: "Próximo", OVERDUE: "Vencido", COMPLETED: "Cumplido", CANCELLED: "Cancelado" };
const CALENDAR_COLORS: Record<string, string> = { SCHEDULED: "#64748b", DUE_SOON: "#d68a1a", OVERDUE: "#b91c1c", COMPLETED: "#16a34a", CANCELLED: "#94a3b8" };
const CASE_LABEL: Record<string, string> = { RECEIVED: "Recibida", ACKNOWLEDGED: "Acuse enviado", UNDER_TRIAGE: "En triaje", ADMISSIBLE: "Admitida", INADMISSIBLE: "Inadmitida", UNDER_INVESTIGATION: "En investigación", RESOLVED: "Resuelta", CLOSED: "Cerrada" };
const MODE_LABEL: Record<string, string> = { IDENTIFIED: "Identificada", CONFIDENTIAL: "Confidencial", ANONYMOUS: "Anónima" };
const OUTCOME_LABEL: Record<string, string> = { SUBSTANTIATED: "Fundada", PARTIALLY_SUBSTANTIATED: "Parcialmente fundada", UNSUBSTANTIATED: "No fundada", INCONCLUSIVE: "Inconcluyente", WITHDRAWN: "Retirada", OUT_OF_SCOPE: "Fuera de ámbito", REFERRED_EXTERNALLY: "Derivada" };
const INVESTIGATION_LABEL: Record<string, string> = { PLANNED: "Planificada", ACTIVE: "Activa", SUSPENDED: "Suspendida", CONCLUDED: "Concluida", CLOSED: "Cerrada" };
const BREACH_LABEL: Record<string, string> = { OPEN: "Abierto", UNDER_ANALYSIS: "En análisis", UNDER_REMEDIATION: "En remediación", REMEDIATED: "Remediado", CLOSED: "Cerrado" };
const BREACH_FLOW = ["OPEN", "UNDER_ANALYSIS", "UNDER_REMEDIATION", "REMEDIATED", "CLOSED"];
const PLAN_LABEL: Record<string, string> = { DRAFT: "Borrador", APPROVED: "Aprobado", IN_PROGRESS: "En ejecución", OVERDUE: "Vencido", COMPLETED: "Completado", CANCELLED: "Cancelado" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #8c2f39", background: "#fef2f2", color: "#8c2f39", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const okBtn: React.CSSProperties = { ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const money = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString("es-ES") : "—");
const level = (value: string) => LEVEL_COLORS[value] ?? "#64748b";

export default function ComplianceClient({ initial, demo = false }: { initial: CompliancePayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const d = initial.digest;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";

  const tabs: { id: Tab; label: string; Icon: typeof Scale; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "obligations", label: "Obligaciones", Icon: BookMarked },
    { id: "sources", label: "Fuentes y jurisdicciones", Icon: Landmark },
    { id: "risks", label: "Riesgos", Icon: AlertTriangle },
    { id: "controls", label: "Controles", Icon: ShieldCheck },
    { id: "evaluations", label: "Evaluaciones", Icon: ClipboardCheck },
    { id: "calendar", label: "Calendario", Icon: CalendarClock, badge: initial.calendarSummary.overdue },
    { id: "changes", label: "Cambios regulatorios", Icon: RefreshCw },
    { id: "conflicts", label: "Conflictos de interés", Icon: UserX },
    { id: "channel", label: "Canal de denuncias", Icon: Megaphone },
    { id: "investigations", label: "Investigaciones", Icon: Search },
    { id: "breaches", label: "Incumplimientos", Icon: CircleOff, badge: initial.breachSummary.open },
    { id: "remediation", label: "Remediación", Icon: Wrench },
    { id: "training", label: "Formación", Icon: GraduationCap },
    { id: "board", label: "Órgano de gobierno", Icon: Gavel },
  ];

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const investigations = initial.channel.cases.flatMap((row) =>
    row.investigations.map((investigation) => ({ ...investigation, caseCode: row.code })),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fee2e2", display: "grid", placeItems: "center" }}><Scale size={22} color="#8c2f39" /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sistema de Gestión de Compliance</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>ISO 37301:2021 — obligaciones, riesgos, controles, calendario, canal de denuncias, incumplimientos y remediación.</p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      {d.escalations.length > 0 && (
        <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>
          <b>Para decisión del órgano de gobierno:</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.escalations.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Obligaciones aplicables" value={initial.programme.applicable} />
        <Stat label="Cumplimiento" value={initial.programme.complianceRate ?? 0} suffix="%" />
        <Stat label="Sin evaluar" value={initial.programme.notEvaluated} accent={initial.programme.notEvaluated ? "#d68a1a" : undefined} />
        <Stat label="Vencimientos fuera de plazo" value={initial.calendarSummary.overdue} accent={initial.calendarSummary.overdue ? "#b91c1c" : undefined} />
        <Stat label="Riesgo no aceptable" value={d.risks.notAcceptable} accent={d.risks.notAcceptable ? "#b91c1c" : undefined} />
        <Stat label="Incumplimientos abiertos" value={initial.breachSummary.open} accent={initial.breachSummary.open ? "#ea580c" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#8c2f39" : "#e5eaf2"), background: tab === id ? "#fef2f2" : "#fff", color: tab === id ? "#8c2f39" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#fee2e2", "#b91c1c")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Programa de obligaciones (§4.6, §9.1.4)</h3>
            <Row k="Obligaciones aplicables" v={initial.programme.applicable} />
            <Row k="Cumplen" v={initial.programme.compliant} />
            <Row k="Cumplen parcialmente" v={initial.programme.partiallyCompliant} />
            <Row k="No cumplen" v={initial.programme.nonCompliant} danger={initial.programme.nonCompliant > 0} />
            <Row k="Sin evaluar" v={initial.programme.notEvaluated} danger={initial.programme.notEvaluated > 0} />
            <Row k="Cobertura de evaluación" v={initial.programme.coverageRate ?? 0} suffix="%" />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Canal de denuncias (§8.3)</h3>
            <Row k="Casos recibidos" v={d.speakUp.total} />
            <Row k="Abiertos" v={d.speakUp.open} />
            <Row k="Anónimos" v={d.speakUp.anonymous} />
            <Row k="Fundados" v={d.speakUp.substantiated} />
            <Row k="Acuses fuera de plazo" v={d.speakUp.overdueAcknowledgement} danger={d.speakUp.overdueAcknowledgement > 0} />
            <Row k="Respuestas fuera de plazo" v={d.speakUp.overdueFeedback} danger={d.speakUp.overdueFeedback > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Cifras agregadas. Ningún dato del informante llega a este panel.</p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Riesgos y controles (§6.1, §8.2)</h3>
            <Row k="Riesgos de compliance" v={d.risks.total} />
            <Row k="Nivel residual alto o crítico" v={d.risks.highOrCritical} danger={d.risks.highOrCritical > 0} />
            <Row k="No aceptables" v={d.risks.notAcceptable} danger={d.risks.notAcceptable > 0} />
            <Row k="Controles activos" v={initial.controls.filter((row) => row.active).length} />
            <Row k="Controles sin probar" v={initial.controls.filter((row) => !row.lastTestedAt).length} danger={initial.controls.some((row) => !row.lastTestedAt)} />
            <Row k="Obligaciones sin control" v={initial.obligations.filter((row) => row.uncontrolled).length} danger={initial.obligations.some((row) => row.uncontrolled)} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Incumplimientos y remediación (§10.2)</h3>
            <Row k="Incumplimientos abiertos" v={initial.breachSummary.open} danger={initial.breachSummary.open > 0} />
            <Row k="Graves" v={initial.breachSummary.severe} danger={initial.breachSummary.severe > 0} />
            <Row k="Recurrentes" v={initial.breachSummary.recurrent} danger={initial.breachSummary.recurrent > 0} />
            <Row k="Notificación pendiente" v={initial.breachSummary.pendingNotification} danger={initial.breachSummary.pendingNotification > 0} />
            <Row k="Notificación fuera de plazo" v={initial.breachSummary.overdueNotification} danger={initial.breachSummary.overdueNotification > 0} />
            <Row k="Planes completados sin verificar" v={initial.remediationSummary.completedNotVerified} danger={initial.remediationSummary.completedNotVerified > 0} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Conflictos de interés (§7.2.2)</h3>
            <Row k="Declaraciones" v={initial.declarationSummary.total} />
            <Row k="Con conflicto declarado" v={initial.declarationSummary.withConflict} />
            <Row k="Pendientes de revisión" v={initial.declarationSummary.pending} danger={initial.declarationSummary.pending > 0} />
            <Row k="Obligan a abstenerse" v={initial.declarationSummary.recusalRequired} />
            {!initial.declarationsComplete && (
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Solo ves el contenido de tus propias declaraciones.</p>
            )}
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Vigilancia regulatoria (§8.1, §6.3)</h3>
            <Row k="Fuentes vigiladas" v={initial.sources.filter((row) => row.monitored).length} />
            <Row k="Revisión de fuente vencida" v={initial.sources.filter((row) => row.monitored && row.nextCheckDate && row.nextCheckDate < new Date()).length} danger={initial.sources.some((row) => row.monitored && row.nextCheckDate && row.nextCheckDate < new Date())} />
            <Row k="Cambios detectados" v={initial.changes.length} />
            <Row k="Sin analizar" v={initial.changes.filter((row) => row.impactStatus === "PENDING_ASSESSMENT").length} danger={initial.changes.some((row) => row.impactStatus === "PENDING_ASSESSMENT")} />
            <Row k="Formación obligatoria" v={d.training.mandatory} />
            <Row k="Cobertura de formación" v={d.training.coverageRate ?? 0} suffix="%" />
          </div>
        </div>
      )}

      {tab === "obligations" && (
        <Table head={["Código", "Obligación", "Tipo", "Jurisdicción", "Fuente", "Aplicabilidad", "Estado", "Criticidad", "Responsable", "Próxima evaluación", "Controles"]}>
          {initial.obligations.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.articleReference ?? row.requirementText?.slice(0, 90) ?? ""}</div></td>
              <td style={td}>{row.obligationType}</td>
              <td style={td}>{row.jurisdiction?.code ?? "—"}</td>
              <td style={td}>{row.source?.code ?? "—"}</td>
              <td style={td}>
                {APPLICABILITY_LABEL[row.applicability] ?? row.applicability}
                {row.applicabilityRollup.incomplete && <div style={{ color: "#d68a1a", fontSize: 11 }}>{row.applicabilityRollup.pending} jurisdicción(es) sin decidir</div>}
              </td>
              <td style={td}><span style={chip((STATUS_COLORS[row.complianceStatus] ?? "#64748b") + "22", STATUS_COLORS[row.complianceStatus] ?? "#64748b")}>{STATUS_LABEL[row.complianceStatus] ?? row.complianceStatus}</span></td>
              <td style={td}><span style={chip(level(row.criticality) + "22", level(row.criticality))}>{row.criticality}</span></td>
              <td style={td}>{nameOf(row.ownerId)}</td>
              <td style={td}>{fmt(row.nextEvaluationDate)}</td>
              <td style={td}>{row.counts.controls}{row.uncontrolled && <div style={{ color: "#b91c1c", fontSize: 11 }}>sin control</div>}</td>
            </tr>
          ))}
          {initial.obligations.length === 0 && <tr><td style={td} colSpan={11}>Sin obligaciones registradas.</td></tr>}
        </Table>
      )}

      {tab === "sources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Table head={["Código", "Fuente", "Tipo", "Emisor", "Jurisdicción", "Vigencia", "Vigilada", "Última revisión", "Próxima revisión", "Obligaciones"]}>
            {initial.sources.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.reference ?? "—"}</div></td>
                <td style={td}>{row.sourceType}</td>
                <td style={td}>{row.issuer ?? "—"}</td>
                <td style={td}>{row.jurisdiction?.code ?? "—"}</td>
                <td style={td}>{row.status}</td>
                <td style={td}>{row.monitored ? `${row.monitoringFrequency}` : <span style={{ color: "#b91c1c" }}>No</span>}</td>
                <td style={td}>{fmt(row.lastCheckedAt)}</td>
                <td style={td}>{fmt(row.nextCheckDate)}</td>
                <td style={td}>{row._count.obligations} · {row._count.changes} cambio(s)</td>
              </tr>
            ))}
            {initial.sources.length === 0 && <tr><td style={td} colSpan={10}>Sin fuentes regulatorias registradas.</td></tr>}
          </Table>
          <Table head={["Código", "Jurisdicción", "Nivel", "País", "Autoridad", "Aplicable", "Motivo"]}>
            {initial.jurisdictions.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.name}</td>
                <td style={td}>{row.level}</td>
                <td style={td}>{row.country ?? "—"}</td>
                <td style={td}>{row.authority ?? "—"}</td>
                <td style={td}>{row.applicable ? "Sí" : "No"}</td>
                <td style={td}>{row.rationale ?? <span style={{ color: "#d68a1a" }}>sin motivo</span>}</td>
              </tr>
            ))}
            {initial.jurisdictions.length === 0 && <tr><td style={td} colSpan={7}>Sin jurisdicciones registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "risks" && (
        <Table head={["Código", "Riesgo", "Obligación", "Categoría", "P×I", "Inherente", "Eficacia controles", "Residual", "Aceptabilidad", "Exposición", "Tratamiento", "Responsable"]}>
          {initial.risks.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b></td>
              <td style={td}>{row.obligation?.code ?? "—"}</td>
              <td style={td}>{row.category}</td>
              <td style={td}>{row.likelihood}×{row.impact}</td>
              <td style={td}><span style={chip(level(row.inherentLevel) + "22", level(row.inherentLevel))}>{row.inherentScore}</span></td>
              <td style={td}>{row.controlEffectiveness ?? "—"}{row._count.controls ? ` (${row._count.controls})` : ""}</td>
              <td style={td}><span style={chip(level(row.residualLevel) + "22", level(row.residualLevel))}>{row.residualScore}</span></td>
              <td style={td}>{row.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("#fee2e2", "#b91c1c")}>No aceptable</span> : row.acceptability === "ACCEPTABLE" ? "Aceptable" : "Tolerable"}</td>
              <td style={td}>{money(row.sanctionExposure)}</td>
              <td style={td}>{row.treatment}{row.acceptedAt && <div style={{ color: "#64748b", fontSize: 11 }}>aceptado por {nameOf(row.acceptedById)}</div>}</td>
              <td style={td}>{nameOf(row.ownerId)}</td>
            </tr>
          ))}
          {initial.risks.length === 0 && <tr><td style={td} colSpan={12}>Sin riesgos de compliance registrados.</td></tr>}
        </Table>
      )}

      {tab === "controls" && (
        <Table head={["Código", "Control", "Obligación", "Riesgo", "Tipo", "Naturaleza", "Frecuencia", "Diseño", "Operación", "Eficacia", "Última prueba", "Próxima prueba"]}>
          {initial.controls.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.name}</b>{row.organizationControlId && <div style={{ color: "#0e7490", fontSize: 11 }}>reutiliza control ISO 27001</div>}</td>
              <td style={td}>{row.obligation?.code ?? "—"}</td>
              <td style={td}>{row.risk?.code ?? "—"}</td>
              <td style={td}>{row.controlType}</td>
              <td style={td}>{row.nature}</td>
              <td style={td}>{row.frequency}</td>
              <td style={td}>{row.designAdequate === null ? "—" : row.designAdequate ? "Adecuado" : <span style={{ color: "#b91c1c" }}>Inadecuado</span>}</td>
              <td style={td}>{row.operatingEffective === null ? "—" : row.operatingEffective ? "Eficaz" : <span style={{ color: "#b91c1c" }}>Ineficaz</span>}</td>
              <td style={td}>{row.effectiveness ?? "—"}</td>
              <td style={td}>{fmt(row.lastTestedAt)}</td>
              <td style={td}>{fmt(row.nextTestDate)}</td>
            </tr>
          ))}
          {initial.controls.length === 0 && <tr><td style={td} colSpan={12}>Sin controles de compliance registrados.</td></tr>}
        </Table>
      )}

      {tab === "evaluations" && (
        <>
          <div style={{ ...card, borderColor: "#fecdd3", background: "#fff1f2", color: "#8c2f39", fontSize: 13 }}>
            Solo una evaluación aprobada mueve el estado de cumplimiento de la obligación, y la decisión queda con nombre y fecha.
          </div>
          <Table head={["Código", "Obligación", "Periodo", "Método", "Resultado", "Puntaje", "Evaluó", "Revisión", "Revisor", can.update || can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.evaluations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.obligation?.code ?? row.control?.code ?? "—"}<div style={{ color: "#64748b", fontSize: 12 }}>{row.obligation?.title ?? ""}</div></td>
                <td style={td}>{row.period}</td>
                <td style={td}>{row.method}</td>
                <td style={td}><span style={chip((STATUS_COLORS[row.result] ?? "#64748b") + "22", STATUS_COLORS[row.result] ?? "#64748b")}>{STATUS_LABEL[row.result] ?? row.result}</span></td>
                <td style={td}>{row.score ?? "—"}</td>
                <td style={td}>{nameOf(row.evaluatedById)}<div style={{ color: "#94a3b8", fontSize: 11 }}>{fmt(row.evaluatedAt)}</div></td>
                <td style={td}><span style={chip((REVIEW_COLORS[row.reviewStatus] ?? "#64748b") + "22", REVIEW_COLORS[row.reviewStatus] ?? "#64748b")}>{REVIEW_LABEL[row.reviewStatus] ?? row.reviewStatus}</span></td>
                <td style={td}>{row.reviewerId ? `${nameOf(row.reviewerId)} · ${fmt(row.reviewedAt)}` : "—"}</td>
                {(can.update || can.approve) && (
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {live && can.update && row.reviewStatus === "DRAFT" && (
                        <button disabled={pending} onClick={() => run(() => submitEvaluationForReview(row.id))} style={miniBtn}><Send size={12} /> Enviar a revisión</button>
                      )}
                      {live && can.approve && row.reviewStatus === "UNDER_REVIEW" && (
                        <>
                          <button disabled={pending} onClick={() => run(() => decideEvaluation(row.id, { decision: "APPROVED" }))} style={okBtn}><Check size={12} /> Aprobar</button>
                          <button disabled={pending} onClick={() => { const note = window.prompt("Motivo del rechazo:") ?? ""; if (note) run(() => decideEvaluation(row.id, { decision: "REJECTED", note })); }} style={miniBtn}><X size={12} /> Rechazar</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.evaluations.length === 0 && <tr><td style={td} colSpan={10}>Sin evaluaciones de cumplimiento.</td></tr>}
          </Table>
        </>
      )}

      {tab === "calendar" && (
        <>
          {initial.alerts.length > 0 && (
            <div style={{ ...card, borderColor: "#fed7aa", background: "#fff7ed" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <BellRing size={16} color="#c2410c" />
                <b style={{ color: "#c2410c" }}>{initial.alerts.length} alerta(s) de vencimiento</b>
                {live && can.update && (
                  <button disabled={pending} onClick={() => run(() => refreshCalendarAlerts())} style={{ ...miniBtn, marginLeft: "auto" }}><RefreshCw size={12} /> Notificar responsables</button>
                )}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {initial.alerts.slice(0, 8).map((alert) => (
                  <li key={alert.id}>
                    <b>{alert.code}</b> {alert.title} — {alert.daysRemaining < 0 ? `${Math.abs(alert.daysRemaining)} día(s) de retraso` : `vence en ${alert.daysRemaining} día(s)`} · {nameOf(alert.responsibleId)}
                    {alert.alreadyAlerted && <span style={{ color: "#94a3b8" }}> (ya notificado)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Table head={["Código", "Vencimiento", "Obligación", "Autoridad", "Fecha", "Recurrencia", "Aviso previo", "Estado", "Responsable", can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.calendar.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{row.obligationCode ?? "—"}</td>
                <td style={td}>{row.authority ?? "—"}</td>
                <td style={td}>{fmt(row.dueDate)}</td>
                <td style={td}>{row.recurrence}</td>
                <td style={td}>{row.leadTimeDays} d</td>
                <td style={td}>
                  <span style={chip(CALENDAR_COLORS[row.state.status] + "22", CALENDAR_COLORS[row.state.status])}>{CALENDAR_LABEL[row.state.status]}</span>
                  {row.state.status === "OVERDUE" && <div style={{ color: "#b91c1c", fontSize: 11 }}>{row.state.overdueDays} día(s)</div>}
                </td>
                <td style={td}>{nameOf(row.responsibleId)}</td>
                {can.update && (
                  <td style={td}>
                    {live && !row.completedAt && row.state.status !== "CANCELLED" && (
                      <button disabled={pending} onClick={() => { const reference = window.prompt("Referencia de la presentación (opcional):") ?? undefined; run(() => completeCalendarItem(row.id, { submissionReference: reference })); }} style={okBtn}><Check size={12} /> Marcar cumplido</button>
                    )}
                    {row.completedAt && <span style={{ color: "#64748b" }}>{fmt(row.completedAt)}</span>}
                  </td>
                )}
              </tr>
            ))}
            {initial.calendar.length === 0 && <tr><td style={td} colSpan={10}>Sin vencimientos en el calendario.</td></tr>}
          </Table>
        </>
      )}

      {tab === "changes" && (
        <Table head={["Código", "Cambio", "Fuente", "Tipo", "Detectado", "Obliga desde", "Impacto", "Estado", "Responsable", "Vence", "Implementado"]}>
          {initial.changes.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.summary ?? "—"}</div></td>
              <td style={td}>{row.source?.code ?? "—"}</td>
              <td style={td}>{row.changeType}</td>
              <td style={td}>{fmt(row.detectedAt)}</td>
              <td style={td}>{fmt(row.effectiveFrom)}</td>
              <td style={td}><span style={chip(level(row.impactLevel) + "22", level(row.impactLevel))}>{row.impactLevel}</span></td>
              <td style={td}>{row.impactStatus === "PENDING_ASSESSMENT" ? <span style={chip("#fef3c7", "#92400e")}>Sin analizar</span> : row.impactStatus}</td>
              <td style={td}>{nameOf(row.responsibleId)}</td>
              <td style={td}>{fmt(row.dueDate)}</td>
              <td style={td}>{fmt(row.implementedAt)}</td>
            </tr>
          ))}
          {initial.changes.length === 0 && <tr><td style={td} colSpan={11}>Sin cambios regulatorios registrados.</td></tr>}
        </Table>
      )}

      {tab === "conflicts" && (
        <>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, borderColor: "#fecdd3", background: "#fff1f2", color: "#8c2f39", fontSize: 13 }}>
            <Lock size={16} />
            {initial.declarationsComplete
              ? "Declaraciones confidenciales. Se muestran porque revisas el registro de conflictos; su contenido no sale de aquí."
              : "Solo ves tus propias declaraciones. El resto se cuenta en el panel, pero no se muestra."}
          </div>
          <Table head={["Código", "Declarante", "Periodo", "Conflicto", "Tipo", "Parte relacionada", "Valor", "Abstención", "Revisión", "Revisor", can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.declarations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{nameOf(row.declarantId)}</td>
                <td style={td}>{row.period}</td>
                <td style={td}>{row.hasConflict ? <span style={chip("#fef3c7", "#92400e")}>Sí</span> : "No"}</td>
                <td style={td}>{row.conflictType ?? "—"}</td>
                <td style={td}>{row.relatedParty ?? "—"}</td>
                <td style={td}>{money(row.estimatedValue)}{row.currency ? ` ${row.currency}` : ""}</td>
                <td style={td}>{row.recusalRequired ? <span style={chip("#fee2e2", "#b91c1c")}>Obligada</span> : "—"}</td>
                <td style={td}><span style={chip((REVIEW_COLORS[row.reviewStatus] ?? "#64748b") + "22", REVIEW_COLORS[row.reviewStatus] ?? "#64748b")}>{REVIEW_LABEL[row.reviewStatus] ?? row.reviewStatus}</span></td>
                <td style={td}>{row.reviewerId ? `${nameOf(row.reviewerId)} · ${fmt(row.reviewedAt)}` : "—"}</td>
                {can.approve && (
                  <td style={td}>
                    {live && row.reviewStatus === "PENDING" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button disabled={pending} onClick={() => run(() => reviewConflictDeclaration(row.id, { decision: "ACCEPTED" }))} style={okBtn}><Check size={12} /> Aceptar</button>
                        <button disabled={pending} onClick={() => { const measures = window.prompt("Medidas de mitigación:") ?? ""; if (measures) run(() => reviewConflictDeclaration(row.id, { decision: "MITIGATED", mitigationMeasures: measures, recusalRequired: true })); }} style={miniBtn}><ArrowRight size={12} /> Mitigar</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {initial.declarations.length === 0 && <tr><td style={td} colSpan={11}>Sin declaraciones visibles.</td></tr>}
          </Table>
        </>
      )}

      {tab === "channel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Configuración del canal</h3>
              <Row k="Denuncia anónima" text={initial.channel.config.allowAnonymous ? "Permitida" : "No permitida"} />
              <Row k="Denuncia confidencial" text={initial.channel.config.allowConfidential ? "Permitida" : "No permitida"} />
              <Row k="Plazo de acuse" v={initial.channel.config.acknowledgementDays} suffix=" d" />
              <Row k="Plazo de respuesta" v={initial.channel.config.feedbackDays} suffix=" d" />
              <Row k="Retención del expediente" v={initial.channel.config.retentionMonths} suffix=" meses" />
              {!initial.channel.configured && <p style={{ margin: "8px 0 0", color: "#d68a1a", fontSize: 12 }}>Sin configurar: se aplican los valores por defecto.</p>}
            </div>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Acceso restringido</h3>
              <Row k="Casos que puedes gestionar" v={initial.channel.cases.length} />
              <Row k="Casos sin autorización" v={initial.channel.restrictedCount} />
              <Row k="Retención vencida" v={initial.channel.retentionDue} danger={initial.channel.retentionDue > 0} />
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
                Un expediente se abre con una autorización explícita por caso. Tener permisos del módulo no basta.
              </p>
            </div>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Patrón por categoría</h3>
              {d.speakUp.byCategory.length === 0 && <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Sin casos registrados.</p>}
              {d.speakUp.byCategory.map((row) => <Row key={row.category} k={row.category} v={row.count} />)}
            </div>
          </div>

          {initial.channel.myReports.length > 0 && (
            <Table head={["Mi denuncia", "Modo", "Categoría", "Presentada", "Estado", "Acuse", "Respuesta", "Resultado", "Medidas de protección"]}>
              {initial.channel.myReports.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.code}</td>
                  <td style={td}>{MODE_LABEL[row.identificationMode]}</td>
                  <td style={td}>{row.category}</td>
                  <td style={td}>{fmt(row.receivedAt)}</td>
                  <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{CASE_LABEL[row.status] ?? row.status}</span></td>
                  <td style={td}>{fmt(row.acknowledgedAt)}</td>
                  <td style={td}>{fmt(row.feedbackProvidedAt)}</td>
                  <td style={td}>{row.outcome ? OUTCOME_LABEL[row.outcome] : "—"}</td>
                  <td style={td}>{row.protectionMeasures ?? (row.retaliationRisk ? <span style={{ color: "#d68a1a" }}>riesgo señalado, sin medidas</span> : "—")}</td>
                </tr>
              ))}
            </Table>
          )}

          {initial.channel.cases.length === 0 ? (
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 10, color: "#64748b" }}>
              <EyeOff size={18} />
              {initial.channel.restrictedCount > 0
                ? `Hay ${initial.channel.restrictedCount} caso(s) en el canal para los que no tienes autorización.`
                : "No tienes ningún expediente asignado."}
            </div>
          ) : (
            <Table head={["Caso", "Modo", "Categoría", "Severidad", "Recibida", "Estado", "Plazos", "Mi rol", "Accesos", "Evidencia", "Retención", "Acciones"]}>
              {initial.channel.cases.map((row) => (
                <tr key={row.id}>
                  <td style={td}>
                    <b>{row.code}</b>
                    {!row.integrity.valid && <div style={{ color: "#b91c1c", fontSize: 11 }}>{row.integrity.problems.join("; ")}</div>}
                  </td>
                  <td style={td}>{MODE_LABEL[row.identificationMode]}</td>
                  <td style={td}>{row.category}</td>
                  <td style={td}><span style={chip(level(row.severity) + "22", level(row.severity))}>{row.severity}</span></td>
                  <td style={td}>{fmt(row.receivedAt)}</td>
                  <td style={td}>
                    <span style={chip("#eef2ff", "#4338ca")}>{CASE_LABEL[row.status] ?? row.status}</span>
                    {row.outcome && <div style={{ color: "#64748b", fontSize: 11 }}>{OUTCOME_LABEL[row.outcome]}</div>}
                  </td>
                  <td style={td}>
                    {row.deadlines.acknowledgementOverdue && <div style={{ color: "#b91c1c", fontSize: 11 }}>acuse vencido</div>}
                    {row.deadlines.feedbackOverdue && <div style={{ color: "#b91c1c", fontSize: 11 }}>respuesta vencida</div>}
                    {!row.deadlines.acknowledgementOverdue && !row.deadlines.feedbackOverdue && <span style={{ color: "#16a34a" }}>en plazo</span>}
                  </td>
                  <td style={td}>{row.myCaseRole ?? "—"}</td>
                  <td style={td}>{row.access.length}</td>
                  <td style={td}>{row.evidence.length}</td>
                  <td style={td}>{row.purgedAt ? <span style={chip("#e2e8f0", "#475569")}>purgado</span> : fmt(row.retentionUntil)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {live && can.channelHandle && row.status === "RECEIVED" && (
                        <button disabled={pending} onClick={() => run(() => acknowledgeSpeakUpReport(row.id))} style={miniBtn}><Send size={12} /> Acusar recibo</button>
                      )}
                      {live && can.channelHandle && row.status === "ACKNOWLEDGED" && (
                        <button disabled={pending} onClick={() => run(() => startSpeakUpTriage(row.id))} style={miniBtn}><ArrowRight size={12} /> Triar</button>
                      )}
                      {live && can.channelDecide && row.status === "UNDER_TRIAGE" && (
                        <>
                          <button disabled={pending} onClick={() => { const rationale = window.prompt("Motivo de la admisión:") ?? ""; if (rationale) run(() => decideAdmissibility(row.id, { admissible: true, rationale })); }} style={okBtn}><Check size={12} /> Admitir</button>
                          <button disabled={pending} onClick={() => { const rationale = window.prompt("Motivo de la inadmisión:") ?? ""; if (rationale) run(() => decideAdmissibility(row.id, { admissible: false, rationale })); }} style={miniBtn}><X size={12} /> Inadmitir</button>
                        </>
                      )}
                      {live && can.channelHandle && !row.feedbackProvidedAt && row.status !== "RECEIVED" && (
                        <button disabled={pending} onClick={() => { const summary = window.prompt("Respuesta al informante:") ?? ""; if (summary) run(() => provideCaseFeedback(row.id, { summary })); }} style={miniBtn}><Megaphone size={12} /> Responder</button>
                      )}
                      {live && can.channelDecide && row.status !== "CLOSED" && (
                        <button disabled={pending} onClick={() => {
                          const outcome = window.prompt("Resultado (SUBSTANTIATED, PARTIALLY_SUBSTANTIATED, UNSUBSTANTIATED, INCONCLUSIVE, WITHDRAWN, OUT_OF_SCOPE, REFERRED_EXTERNALLY):") ?? "";
                          const closureSummary = outcome ? window.prompt("Resumen del cierre:") ?? "" : "";
                          if (outcome && closureSummary) run(() => closeSpeakUpCase(row.id, { outcome: outcome as never, closureSummary }));
                        }} style={miniBtn}><CircleOff size={12} /> Cerrar</button>
                      )}
                      {live && can.channelDecide && row.status === "CLOSED" && !row.purgedAt && row.retentionUntil && new Date(row.retentionUntil) <= new Date() && (
                        <button disabled={pending} onClick={() => run(() => purgeSpeakUpCase(row.id, {}))} style={miniBtn}><EyeOff size={12} /> Purgar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}

      {tab === "investigations" && (
        <>
          <div style={{ ...card, borderColor: "#fecdd3", background: "#fff1f2", color: "#8c2f39", fontSize: 13 }}>
            Solo aparecen las investigaciones de los casos que puedes gestionar. Quien está señalado no investiga, y un conflicto declarado obliga a abstenerse.
          </div>
          <Table head={["Código", "Caso", "Investigación", "Instructor", "Independencia", "Conflicto", "Estado", "Inicio", "Vence", "Conclusión", can.channelHandle ? "Acciones" : ""].filter(Boolean) as string[]}>
            {investigations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.caseCode}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{nameOf(row.leadInvestigatorId)}{row.reassignedToId && <div style={{ color: "#0e7490", fontSize: 11 }}>reasignada a {nameOf(row.reassignedToId)}</div>}</td>
                <td style={td}>{row.independenceConfirmed ? <span style={{ color: "#16a34a" }}>confirmada</span> : <span style={{ color: "#b91c1c" }}>sin confirmar</span>}</td>
                <td style={td}>{row.conflictDetected ? <span style={chip("#fee2e2", "#b91c1c")}>detectado</span> : row.conflictChecked ? "comprobado" : <span style={{ color: "#d68a1a" }}>sin comprobar</span>}</td>
                <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{INVESTIGATION_LABEL[row.status] ?? row.status}</span></td>
                <td style={td}>{fmt(row.startedAt)}</td>
                <td style={td}>{fmt(row.dueDate)}</td>
                <td style={td}>{row.concludedAt ? fmt(row.concludedAt) : "—"}</td>
                {can.channelHandle && (
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {live && row.status === "PLANNED" && (
                        <button disabled={pending} onClick={() => run(() => setInvestigationStatus(row.id, { to: "ACTIVE" }))} style={miniBtn}><ArrowRight size={12} /> Iniciar</button>
                      )}
                      {live && row.status === "ACTIVE" && (
                        <button disabled={pending} onClick={() => {
                          const findings = window.prompt("Hallazgos:") ?? "";
                          const conclusion = findings ? window.prompt("Conclusión:") ?? "" : "";
                          if (findings && conclusion) run(() => setInvestigationStatus(row.id, { to: "CONCLUDED", findings, conclusion }));
                        }} style={okBtn}><Check size={12} /> Concluir</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {investigations.length === 0 && <tr><td style={td} colSpan={11}>Sin investigaciones visibles.</td></tr>}
          </Table>
        </>
      )}

      {tab === "breaches" && (
        <Table head={["Código", "Incumplimiento", "Obligación", "Detección", "Severidad", "Estado", "Causa raíz", "Recurrente", "Notificación", "Exposición", "Sanción", can.update ? "Avanzar" : ""].filter(Boolean) as string[]}>
          {initial.breaches.map((row) => {
            const index = BREACH_FLOW.indexOf(row.status);
            const next = index >= 0 && index < BREACH_FLOW.length - 1 ? BREACH_FLOW[index + 1] : null;
            return (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{row.obligation?.code ?? "—"}</td>
                <td style={td}>{row.detectionSource}<div style={{ color: "#94a3b8", fontSize: 11 }}>{fmt(row.detectedAt)}</div></td>
                <td style={td}><span style={chip(level(row.severity) + "22", level(row.severity))}>{row.severity}</span></td>
                <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{BREACH_LABEL[row.status] ?? row.status}</span></td>
                <td style={td}>{row.rootCause ? "Sí" : <span style={{ color: "#d68a1a" }}>pendiente</span>}</td>
                <td style={td}>{row.recurrence ? <span style={chip("#fee2e2", "#b91c1c")}>Sí</span> : "No"}</td>
                <td style={td}>
                  {row.notificationRequired
                    ? row.authorityNotifiedAt
                      ? fmt(row.authorityNotifiedAt)
                      : <span style={chip(row.notificationOverdue ? "#fee2e2" : "#fef3c7", row.notificationOverdue ? "#b91c1c" : "#92400e")}>{row.notificationOverdue ? "fuera de plazo" : `hasta ${fmt(row.notificationDeadline)}`}</span>
                    : "—"}
                </td>
                <td style={td}>{money(row.financialExposure)}</td>
                <td style={td}>{row.sanctionImposed ? money(row.sanctionAmount) : "—"}</td>
                {can.update && (
                  <td style={td}>
                    {live && next
                      ? <button disabled={pending} onClick={() => run(() => setBreachStatus(row.id, { to: next as never }))} style={miniBtn}><ArrowRight size={12} /> {BREACH_LABEL[next]}</button>
                      : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                )}
              </tr>
            );
          })}
          {initial.breaches.length === 0 && <tr><td style={td} colSpan={12}>Sin incumplimientos registrados.</td></tr>}
        </Table>
      )}

      {tab === "remediation" && (
        <Table head={["Código", "Plan", "Incumplimiento", "Responsable", "Inicio", "Vence", "Avance", "Estado", "Aprobado", "Eficacia verificada", "Coste", can.update || can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.plans.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b></td>
              <td style={td}>{row.breach?.code ?? "—"}</td>
              <td style={td}>{nameOf(row.ownerId)}</td>
              <td style={td}>{fmt(row.startDate)}</td>
              <td style={td}>{fmt(row.dueDate)}</td>
              <td style={td}>{row.progressPercent}%</td>
              <td style={td}><span style={chip(row.effectiveStatus === "OVERDUE" ? "#fee2e2" : "#eef2ff", row.effectiveStatus === "OVERDUE" ? "#b91c1c" : "#4338ca")}>{PLAN_LABEL[row.effectiveStatus] ?? row.effectiveStatus}</span></td>
              <td style={td}>{row.approvedAt ? `${nameOf(row.approvedById)} · ${fmt(row.approvedAt)}` : "—"}</td>
              <td style={td}>{row.effectivenessVerified ? `${nameOf(row.effectivenessVerifiedById)}` : row.completedAt ? <span style={{ color: "#b91c1c" }}>sin verificar</span> : "—"}</td>
              <td style={td}>{money(row.cost)}</td>
              {(can.update || can.approve) && (
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {live && can.approve && row.status === "DRAFT" && (
                      <button disabled={pending} onClick={() => run(() => approveRemediationPlan(row.id))} style={okBtn}><Check size={12} /> Aprobar</button>
                    )}
                    {live && can.update && row.status !== "DRAFT" && !row.completedAt && (
                      <button disabled={pending} onClick={() => { const value = window.prompt("Avance (0-100):") ?? ""; const progressPercent = Number(value); if (value && Number.isFinite(progressPercent)) run(() => updateRemediationProgress(row.id, { progressPercent })); }} style={miniBtn}><ArrowRight size={12} /> Avance</button>
                    )}
                    {live && can.approve && row.completedAt && !row.effectivenessVerified && (
                      <button disabled={pending} onClick={() => { const note = window.prompt("Constancia de la verificación de eficacia:") ?? ""; if (note) run(() => verifyRemediationEffectiveness(row.id, { note })); }} style={okBtn}><ShieldCheck size={12} /> Verificar eficacia</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {initial.plans.length === 0 && <tr><td style={td} colSpan={12}>Sin planes de remediación.</td></tr>}
        </Table>
      )}

      {tab === "training" && (
        <Table head={["Código", "Formación", "Tema", "Obligación", "Audiencia", "Obligatoria", "Modalidad", "Programada", "Cobertura", "Aprobados", "Eficacia", "Próxima"]}>
          {initial.trainings.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b></td>
              <td style={td}>{row.topic}</td>
              <td style={td}>{row.obligationCode ?? "—"}</td>
              <td style={td}>{row.audience ?? "—"}</td>
              <td style={td}>{row.mandatory ? "Sí" : "No"}</td>
              <td style={td}>{row.deliveryMode}</td>
              <td style={td}>{fmt(row.scheduledFor)}</td>
              <td style={td}>{row.coverage === null ? "—" : `${row.coverage}%`}<div style={{ color: "#94a3b8", fontSize: 11 }}>{row.completedCount ?? 0}/{row.targetCount ?? 0}</div></td>
              <td style={td}>{row.passRate === null ? "—" : `${row.passRate}%`}</td>
              <td style={td}>{row.effectivenessEvaluated ? "Evaluada" : <span style={{ color: "#d68a1a" }}>sin evaluar</span>}</td>
              <td style={td}>{fmt(row.nextDueDate)}</td>
            </tr>
          ))}
          {initial.trainings.length === 0 && <tr><td style={td} colSpan={12}>Sin formación en compliance registrada.</td></tr>}
        </Table>
      )}

      {tab === "board" && (
        <Table head={["Código", "Informe", "Periodo", "Presentado a", "Preparó", "Estado", "Enviado", "Presentado", "Acuse", can.update || can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
          {initial.governingBodyReports.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.executiveSummary?.slice(0, 120) ?? "—"}</div></td>
              <td style={td}>{row.period}</td>
              <td style={td}>{row.presentedTo}</td>
              <td style={td}>{nameOf(row.preparedById)}</td>
              <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{row.reviewStatus}</span></td>
              <td style={td}>{fmt(row.submittedAt)}</td>
              <td style={td}>{fmt(row.presentedAt)}</td>
              <td style={td}>{row.acknowledgedAt ? `${nameOf(row.acknowledgedById)} · ${fmt(row.acknowledgedAt)}` : "—"}</td>
              {(can.update || can.approve) && (
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {live && can.update && row.reviewStatus === "DRAFT" && (
                      <button disabled={pending} onClick={() => run(() => submitGoverningBodyReport(row.id))} style={miniBtn}><Send size={12} /> Enviar</button>
                    )}
                    {live && can.approve && !row.acknowledgedAt && row.reviewStatus !== "DRAFT" && (
                      <button disabled={pending} onClick={() => { const decisionsTaken = window.prompt("Decisiones tomadas por el órgano de gobierno:") ?? undefined; run(() => acknowledgeGoverningBodyReport(row.id, { decisionsTaken })); }} style={okBtn}><Gavel size={12} /> Registrar acuse</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {initial.governingBodyReports.length === 0 && <tr><td style={td} colSpan={10}>Sin informes al órgano de gobierno.</td></tr>}
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (<div style={{ ...card, padding: 14 }}><div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#0f172a" }}>{value}{suffix}</div><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div></div>);
}
function Row({ k, v, text, danger, suffix }: { k: string; v?: number; text?: string; danger?: boolean; suffix?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span>{k}</span>
      <b style={{ color: danger ? "#b91c1c" : "#0f172a" }}>{text ?? `${v}${suffix ?? ""}`}</b>
    </div>
  );
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
