"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, BellRing, BookMarked, CalendarClock, Check, ChevronUp, CircleOff, ClipboardCheck, EyeOff, Gavel, GraduationCap, Landmark, LayoutDashboard, Lock, Megaphone, Plus, RefreshCw, Replace, Scale, Search, Send, ShieldCheck, UserRoundCog, UserX, Wrench, X } from "lucide-react";
import type { CompliancePayload } from "@/lib/compliance/queries";
import {
  createJurisdiction, updateJurisdiction, createRegulatorySource, updateRegulatorySource, recordSourceCheck,
  createComplianceObligation, updateComplianceObligation, supersedeObligation, assessObligationApplicability,
  createComplianceRisk, updateComplianceRisk, revalueComplianceRisk, acceptComplianceRisk,
  createComplianceControl, updateComplianceControl, testComplianceControl,
  createComplianceEvaluation, updateComplianceEvaluation,
  completeCalendarItem, updateCalendarItem, cancelCalendarItem, decideEvaluation, refreshCalendarAlerts, createCalendarItem,
  declareConflictOfInterest, reviewConflictDeclaration,
  registerRegulatoryChange, updateRegulatoryChange, assessRegulatoryChange,
  registerComplianceBreach, updateComplianceBreach, setBreachStatus, recordAuthorityNotification,
  createRemediationPlan, updateRemediationPlan, approveRemediationPlan, updateRemediationProgress, verifyRemediationEffectiveness,
  createComplianceTraining, updateComplianceTraining, recordTrainingCompletion,
  prepareGoverningBodyReport, updateGoverningBodyReport, acknowledgeGoverningBodyReport, submitEvaluationForReview, submitGoverningBodyReport,
} from "@/lib/actions/compliance";
import {
  acknowledgeSpeakUpReport, addProtectedEvidence, closeSpeakUpCase, configureSpeakUpChannel,
  decideAdmissibility, grantCaseAccess, openInvestigation, provideCaseFeedback,
  purgeSpeakUpCase, raiseBreachFromCase, recuseInvestigator, revokeCaseAccess,
  setInvestigationStatus, startSpeakUpTriage, submitSpeakUpReport,
} from "@/lib/actions/speak-up";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ActionDialogsProvider, useChoiceAction, usePromptAction, useNoticeAction } from "@/components/ui/ActionDialogs";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";
import { labelForKeyOrRaw } from "@/lib/field-labels";
import { toneChip } from "@/lib/tone";
import Meter from "@/components/charts/Meter";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import DateField from "@/components/ui/DateField";

type Tab =
  | "panel" | "obligations" | "sources" | "risks" | "controls" | "evaluations" | "calendar"
  | "changes" | "conflicts" | "channel" | "investigations" | "breaches" | "remediation"
  | "training" | "board";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Sistema de Gestión de Compliance", sub: "ISO 37301:2021 — visión general de obligaciones, riesgos, controles, canal, incumplimientos y remediación." },
  obligations: { title: "Obligaciones de compliance", sub: "Obligaciones aplicables, estado de cumplimiento, responsables y controles relacionados." },
  sources: { title: "Fuentes regulatorias", sub: "Jurisdicciones, fuentes normativas y verificaciones de vigencia." },
  risks: { title: "Riesgos de compliance", sub: "Riesgos, niveles residuales, aceptabilidad y medidas de tratamiento." },
  controls: { title: "Controles de compliance", sub: "Controles preventivos y detectivos, responsables y pruebas de operación." },
  evaluations: { title: "Evaluaciones de cumplimiento", sub: "Evaluaciones, resultados, revisión y aprobación del cumplimiento." },
  calendar: { title: "Calendario de compliance", sub: "Actividades programadas, vencimientos y seguimiento de alertas." },
  changes: { title: "Cambios regulatorios", sub: "Cambios identificados, impacto y evaluación de aplicabilidad." },
  conflicts: { title: "Conflictos de interés", sub: "Declaraciones, revisión, recusación y seguimiento de conflictos." },
  channel: { title: "Canal de denuncias", sub: "Reportes protegidos, admisibilidad, investigación y cierre." },
  investigations: { title: "Investigaciones", sub: "Investigaciones derivadas del canal y seguimiento de sus resultados." },
  breaches: { title: "Incumplimientos", sub: "Incumplimientos, severidad, notificación a autoridades y estado." },
  remediation: { title: "Planes de remediación", sub: "Acciones correctivas, avance, vencimientos y verificación de eficacia." },
  training: { title: "Formación de compliance", sub: "Programas, población objetivo y cobertura de formación." },
  board: { title: "Informes al órgano de gobierno", sub: "Informes preparados, enviados y reconocidos por el órgano de gobierno." },
};

const LEVEL_COLORS: Record<string, string> = { LOW: "var(--nf-success)", MINOR: "var(--nf-success)", MEDIUM: "var(--nf-warning)", MODERATE: "var(--nf-warning)", HIGH: "var(--nf-warning)", MAJOR: "var(--nf-warning)", CRITICAL: "var(--nf-danger-text)", SEVERE: "var(--nf-danger-text)" };
const STATUS_COLORS: Record<string, string> = { COMPLIANT: "var(--nf-success)", PARTIALLY_COMPLIANT: "var(--nf-warning)", NON_COMPLIANT: "var(--nf-danger-text)", NOT_EVALUATED: "var(--nf-text-secondary)", NOT_APPLICABLE: "var(--nf-text-subtle)" };
const STATUS_LABEL: Record<string, string> = { COMPLIANT: "Cumple", PARTIALLY_COMPLIANT: "Cumple parcialmente", NON_COMPLIANT: "No cumple", NOT_EVALUATED: "Sin evaluar", NOT_APPLICABLE: "No aplicable" };
const APPLICABILITY_LABEL: Record<string, string> = { APPLICABLE: "Aplicable", PARTIALLY_APPLICABLE: "Parcialmente aplicable", NOT_APPLICABLE: "No aplicable", UNDER_ASSESSMENT: "En evaluación" };
const REVIEW_COLORS: Record<string, string> = { DRAFT: "var(--nf-text-secondary)", UNDER_REVIEW: "var(--nf-warning)", APPROVED: "var(--nf-success)", REJECTED: "var(--nf-danger-text)", PENDING: "var(--nf-warning)", ACCEPTED: "var(--nf-success)", MITIGATED: "var(--nf-info)" };
const REVIEW_LABEL: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", REJECTED: "Rechazada", PENDING: "Pendiente", ACCEPTED: "Aceptada", MITIGATED: "Mitigada" };
const CALENDAR_LABEL: Record<string, string> = { SCHEDULED: "Programado", DUE_SOON: "Próximo", OVERDUE: "Vencido", COMPLETED: "Cumplido", CANCELLED: "Cancelado" };
const CALENDAR_COLORS: Record<string, string> = { SCHEDULED: "var(--nf-text-secondary)", DUE_SOON: "var(--nf-warning)", OVERDUE: "var(--nf-danger-text)", COMPLETED: "var(--nf-success)", CANCELLED: "var(--nf-text-subtle)" };
const CASE_LABEL: Record<string, string> = { RECEIVED: "Recibida", ACKNOWLEDGED: "Acuse enviado", UNDER_TRIAGE: "En triaje", ADMISSIBLE: "Admitida", INADMISSIBLE: "Inadmitida", UNDER_INVESTIGATION: "En investigación", RESOLVED: "Resuelta", CLOSED: "Cerrada" };
const MODE_LABEL: Record<string, string> = { IDENTIFIED: "Identificada", CONFIDENTIAL: "Confidencial", ANONYMOUS: "Anónima" };
const OUTCOME_LABEL: Record<string, string> = { SUBSTANTIATED: "Fundada", PARTIALLY_SUBSTANTIATED: "Parcialmente fundada", UNSUBSTANTIATED: "No fundada", INCONCLUSIVE: "Inconcluyente", WITHDRAWN: "Retirada", OUT_OF_SCOPE: "Fuera de ámbito", REFERRED_EXTERNALLY: "Derivada" };
const INVESTIGATION_LABEL: Record<string, string> = { PLANNED: "Planificada", ACTIVE: "Activa", SUSPENDED: "Suspendida", CONCLUDED: "Concluida", CLOSED: "Cerrada" };
const BREACH_LABEL: Record<string, string> = { OPEN: "Abierto", UNDER_ANALYSIS: "En análisis", UNDER_REMEDIATION: "En remediación", REMEDIATED: "Remediado", CLOSED: "Cerrado" };
const BREACH_FLOW = ["OPEN", "UNDER_ANALYSIS", "UNDER_REMEDIATION", "REMEDIATED", "CLOSED"];
const PLAN_LABEL: Record<string, string> = { DRAFT: "Borrador", APPROVED: "Aprobado", IN_PROGRESS: "En ejecución", OVERDUE: "Vencido", COMPLETED: "Completado", CANCELLED: "Cancelado" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line)", borderRadius: 14, padding: 18, background: "var(--nf-surface)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--nf-text-secondary)", borderBottom: "1px solid var(--nf-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const money = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString("es-ES") : "—");
const level = (value: string) => LEVEL_COLORS[value] ?? "var(--nf-text-secondary)";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const toggleBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 10px", minHeight: 28, border: "1px solid var(--nf-line)", borderRadius: 8, background: "var(--nf-surface)", color: "var(--nf-ink)", fontWeight: 600, fontSize: 11, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Members = CompliancePayload["members"];

/** Modal "Nuevo X" form shell shared by every creation form in this module. */
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

type EditKind = "jurisdiction" | "source" | "obligation" | "risk" | "control" | "evaluation" | "calendar" | "change" | "breach" | "plan" | "training" | "board";
type EditRow = Record<string, unknown> & { id: string };

function EditRecordButton({ title, children }: { title: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [modalError, setModalError] = useState("");
  const close = () => { setOpen(false); setCloseRequested(false); setModalError(""); };
  const closeAfterSuccess = () => setCloseRequested(true);
  useEffect(() => {
    if (!closeRequested) return;
    const handleSuccess = () => { setOpen(false); setCloseRequested(false); setModalError(""); };
    window.addEventListener("normaflow:server-action-success", handleSuccess);
    return () => window.removeEventListener("normaflow:server-action-success", handleSuccess);
  }, [closeRequested]);
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
      <button type="button" style={toggleBtn} onClick={() => { setCloseRequested(false); setModalError(""); setOpen(true); }}>Editar</button>
      <Modal open={open} onClose={close} title={title} width={760}>
        <div className="nf-modal-form nf-iso-edit-form">
          {modalError && <div className="nf-modal-error" role="alert">{modalError}</div>}
          <div className="nf-iso-edit-fields">{children(closeAfterSuccess)}</div>
          <div className="nf-modal-actions nf-iso-edit-form-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={close}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EditRecordForm({ kind, row, members, pending, run, onDone }: { kind: EditKind; row: EditRow; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const dateValue = (key: string) => { const value = row[key]; return value ? new Date(String(value)).toISOString().slice(0, 10) : ""; };
  const initial: Record<string, string | boolean | number> = {
    title: String(row.title ?? row.name ?? ""), name: String(row.name ?? ""), description: String(row.description ?? ""),
    code: String(row.code ?? ""), category: String(row.category ?? "OTHER"), criticality: String(row.criticality ?? "MEDIUM"),
    ownerId: String(row.ownerId ?? ""), accountableId: String(row.accountableId ?? ""), issuer: String(row.issuer ?? ""), reference: String(row.reference ?? ""),
    authority: String(row.authority ?? ""), country: String(row.country ?? ""), rationale: String(row.rationale ?? ""), applicable: row.applicable !== false, monitored: Boolean(row.monitored),
    monitoringFrequency: String(row.monitoringFrequency ?? "QUARTERLY"), likelihood: Number(row.likelihood ?? 3), impact: Number(row.impact ?? 3),
    treatment: String(row.treatment ?? "MITIGATE"), controlType: String(row.controlType ?? "PREVENTIVE"), nature: String(row.nature ?? "MANUAL"),
    frequency: String(row.frequency ?? "MONTHLY"), active: row.active !== false, period: String(row.period ?? ""), result: String(row.result ?? "NOT_EVALUATED"),
    findings: String(row.findings ?? ""), score: Number(row.score ?? 0), dueDate: dateValue("dueDate"), leadTimeDays: Number(row.leadTimeDays ?? 30),
    changeType: String(row.changeType ?? "AMENDMENT"), summary: String(row.summary ?? ""), severity: String(row.severity ?? "MODERATE"),
    financialExposure: Number(row.financialExposure ?? 0), recurrence: Boolean(row.recurrence), objective: String(row.objective ?? ""),
    topic: String(row.topic ?? "CODE_OF_CONDUCT"), audience: String(row.audience ?? ""), mandatory: Boolean(row.mandatory),
    deliveryMode: String(row.deliveryMode ?? "ONLINE"), targetCount: Number(row.targetCount ?? 0), scheduledFor: dateValue("scheduledFor"),
    executiveSummary: String(row.executiveSummary ?? ""), resourcesRequested: String(row.resourcesRequested ?? ""), decisionsRequested: String(row.decisionsRequested ?? ""),
  };
  const [f, setF] = useState(initial);
  const set = (key: string, value: string | boolean | number) => setF((current) => ({ ...current, [key]: value }));
  const s = (key: string) => String(f[key] ?? "");
  const n = (key: string) => Number(f[key] ?? 0);
  const memberSelect = (key: string, label: string) => <PersonPicker people={members} value={s(key)} onValueChange={(personId) => set(key, personId)} placeholder="{label}" ariaLabel={label.replace(/…$/, "")} style={input} />;
  const select = (key: string, values: string[]) => <Picker aria-label={labelForKeyOrRaw(key)} style={input} value={s(key)} onChange={(e) => set(key, e.target.value)}>{values.map((v) => <option key={v} value={v}>{v}</option>)}</Picker>;
  function save() {
    const id = row.id;
    const date = (key: string) => s(key) ? new Date(s(key)).toISOString() : undefined;
    const action: Record<EditKind, () => Promise<unknown>> = {
      jurisdiction: () => updateJurisdiction(id, { name: s("name"), country: s("country") || undefined, authority: s("authority") || undefined, applicable: Boolean(f.applicable), rationale: s("rationale") || undefined }),
      source: () => updateRegulatorySource(id, { name: s("name"), issuer: s("issuer") || undefined, reference: s("reference") || undefined, monitored: Boolean(f.monitored), monitoringFrequency: s("monitoringFrequency") as never, ownerId: s("ownerId") || undefined }),
      obligation: () => updateComplianceObligation(id, { title: s("title"), category: s("category") as never, criticality: s("criticality") as never, ownerId: s("ownerId") || undefined, accountableId: s("accountableId") || undefined, evaluationFrequency: s("frequency") as never, requirementText: s("description") || undefined }),
      risk: () => updateComplianceRisk(id, { title: s("title"), category: s("category") as never, likelihood: n("likelihood"), impact: n("impact"), treatment: s("treatment") as never, ownerId: s("ownerId") || undefined }),
      control: () => updateComplianceControl(id, { name: s("name"), controlType: s("controlType") as never, nature: s("nature") as never, frequency: s("frequency") as never, ownerId: s("ownerId") || undefined, active: Boolean(f.active) }),
      evaluation: () => updateComplianceEvaluation(id, { period: s("period"), result: s("result") as never, findings: s("findings") || undefined, score: n("score") || undefined }),
      calendar: () => updateCalendarItem(id, { title: s("title"), dueDate: date("dueDate")!, leadTimeDays: n("leadTimeDays"), responsibleId: s("ownerId") || undefined, authority: s("authority") || undefined }),
      change: () => updateRegulatoryChange(id, { title: s("title"), changeType: s("changeType") as never, summary: s("summary") || undefined }),
      breach: () => updateComplianceBreach(id, { title: s("title"), description: s("description") || undefined, severity: s("severity") as never, rootCause: s("rationale") || undefined, financialExposure: n("financialExposure") || undefined, recurrence: Boolean(f.recurrence) }),
      plan: () => updateRemediationPlan(id, { title: s("title"), objective: s("objective") || undefined, ownerId: s("ownerId") || undefined, dueDate: date("dueDate") }),
      training: () => updateComplianceTraining(id, { title: s("title"), topic: s("topic") as never, audience: s("audience") || undefined, mandatory: Boolean(f.mandatory), deliveryMode: s("deliveryMode") as never, targetCount: n("targetCount") || undefined, scheduledFor: date("scheduledFor") }),
      board: () => updateGoverningBodyReport(id, { title: s("title"), period: s("period"), executiveSummary: s("executiveSummary") || undefined, resourcesRequested: s("resourcesRequested") || undefined, decisionsRequested: s("decisionsRequested") || undefined }),
    };
    run(action[kind]);
    onDone();
  }
  const titleOnly = ["obligation", "risk", "change", "breach", "plan", "training", "board"].includes(kind);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {kind === "jurisdiction" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Nombre" style={input} placeholder="Nombre" value={s("name")} onChange={(e) => set("name", e.target.value)} />{select("country", [s("country") || "País", "ES", "EC", "MX", "CO", "US"])}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Autoridad" style={input} placeholder="Autoridad" value={s("authority")} onChange={(e) => set("authority", e.target.value)} /><input aria-label="Motivo de aplicabilidad" style={input} placeholder="Motivo de aplicabilidad" value={s("rationale")} onChange={(e) => set("rationale", e.target.value)} /></div><label><input type="checkbox" checked={Boolean(f.applicable)} onChange={(e) => set("applicable", e.target.checked)} /> Aplicable</label></>}
      {kind === "source" && <><input aria-label="Nombre" style={input} placeholder="Nombre" value={s("name")} onChange={(e) => set("name", e.target.value)} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Emisor" style={input} placeholder="Emisor" value={s("issuer")} onChange={(e) => set("issuer", e.target.value)} /><input aria-label="Referencia" style={input} placeholder="Referencia" value={s("reference")} onChange={(e) => set("reference", e.target.value)} /></div>{select("monitoringFrequency", ["CONTINUOUS", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL", "ON_EVENT"])}{memberSelect("ownerId", "Responsable de vigilancia…")}<label><input type="checkbox" checked={Boolean(f.monitored)} onChange={(e) => set("monitored", e.target.checked)} /> Vigilancia activa</label></>}
      {titleOnly && <input aria-label="Título" style={input} placeholder="Título" value={s("title")} onChange={(e) => set("title", e.target.value)} />}
      {kind === "obligation" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{select("category", ["ANTIBRIBERY", "DATA_PROTECTION", "LABOR", "ENVIRONMENTAL", "CORPORATE_GOVERNANCE", "OTHER"])}{select("criticality", ["LOW", "MEDIUM", "HIGH", "CRITICAL"])}{select("frequency", ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL"])} </div>{memberSelect("ownerId", "Propietario…")}{memberSelect("accountableId", "Accountable…")}<input aria-label="Texto de requisito" style={input} placeholder="Texto de requisito" value={s("description")} onChange={(e) => set("description", e.target.value)} /></>}
      {kind === "risk" && <><div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>{select("category", ["ANTIBRIBERY", "DATA_PROTECTION", "LABOR", "ENVIRONMENTAL", "CORPORATE_GOVERNANCE", "OTHER"])}{select("likelihood", ["1", "2", "3", "4", "5"])}{select("impact", ["1", "2", "3", "4", "5"])}{select("treatment", ["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"])}</div>{memberSelect("ownerId", "Propietario…")}</>}
      {kind === "control" && <><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>{select("controlType", ["PREVENTIVE", "DETECTIVE", "CORRECTIVE", "DIRECTIVE"])}{select("nature", ["MANUAL", "AUTOMATED", "HYBRID"])}{select("frequency", ["CONTINUOUS", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"])} </div>{memberSelect("ownerId", "Propietario…")}<label><input type="checkbox" checked={Boolean(f.active)} onChange={(e) => set("active", e.target.checked)} /> Control activo</label></>}
      {kind === "evaluation" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><input aria-label="Periodo" style={input} placeholder="Periodo" value={s("period")} onChange={(e) => set("period", e.target.value)} />{select("result", ["NOT_EVALUATED", "COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"])}<input aria-label="Puntaje" style={input} type="number" min={0} max={100} placeholder="Puntaje" value={n("score")} onChange={(e) => set("score", Number(e.target.value))} /></div><input aria-label="Hallazgos" style={input} placeholder="Hallazgos" value={s("findings")} onChange={(e) => set("findings", e.target.value)} /></>}
      {kind === "calendar" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}><input aria-label="Título" style={input} placeholder="Título" value={s("title")} onChange={(e) => set("title", e.target.value)} /><DateField aria-label="Fecha de vencimiento" style={input} value={s("dueDate")} onChange={(e) => set("dueDate", e.target.value)} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Aviso previo" style={input} type="number" min={0} max={365} placeholder="Aviso previo" value={n("leadTimeDays")} onChange={(e) => set("leadTimeDays", Number(e.target.value))} />{memberSelect("ownerId", "Responsable…")}</div><input aria-label="Autoridad" style={input} placeholder="Autoridad" value={s("authority")} onChange={(e) => set("authority", e.target.value)} /></>}
      {kind === "change" && <><Picker aria-label="Tipo de cambio" style={input} value={s("changeType")} onChange={(e) => set("changeType", e.target.value)}>{["NEW_REQUIREMENT", "AMENDMENT", "REPEAL", "INTERPRETATION", "GUIDANCE", "CASE_LAW", "ENFORCEMENT_TREND"].map((v) => <option key={v}>{v}</option>)}</Picker><input aria-label="Resumen" style={input} placeholder="Resumen" value={s("summary")} onChange={(e) => set("summary", e.target.value)} /></>}
      {kind === "breach" && <><input aria-label="Descripción" style={input} placeholder="Descripción" value={s("description")} onChange={(e) => set("description", e.target.value)} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{select("severity", ["MINOR", "MODERATE", "MAJOR", "SEVERE"])}<input aria-label="Exposición financiera" style={input} type="number" min={0} placeholder="Exposición financiera" value={n("financialExposure")} onChange={(e) => set("financialExposure", Number(e.target.value))} /></div><input aria-label="Causa raíz" style={input} placeholder="Causa raíz" value={s("rationale")} onChange={(e) => set("rationale", e.target.value)} /><label><input type="checkbox" checked={Boolean(f.recurrence)} onChange={(e) => set("recurrence", e.target.checked)} /> Recurrente</label></>}
      {kind === "plan" && <><input aria-label="Objetivo" style={input} placeholder="Objetivo" value={s("objective")} onChange={(e) => set("objective", e.target.value)} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{memberSelect("ownerId", "Responsable…")}<DateField aria-label="Fecha de vencimiento" style={input} value={s("dueDate")} onChange={(e) => set("dueDate", e.target.value)} /></div></>}
      {kind === "training" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{select("topic", ["CODE_OF_CONDUCT", "ANTIBRIBERY", "CONFLICT_OF_INTEREST", "SPEAK_UP_CHANNEL", "DATA_PROTECTION", "OTHER"])}{select("deliveryMode", ["ONLINE", "CLASSROOM", "BLENDED", "ON_THE_JOB", "SELF_STUDY"])}</div><input aria-label="Audiencia" style={input} placeholder="Audiencia" value={s("audience")} onChange={(e) => set("audience", e.target.value)} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input aria-label="Audiencia prevista" style={input} type="number" min={0} placeholder="Audiencia prevista" value={n("targetCount")} onChange={(e) => set("targetCount", Number(e.target.value))} /><DateField aria-label="Fecha prevista" style={input} value={s("scheduledFor")} onChange={(e) => set("scheduledFor", e.target.value)} /></div><label><input type="checkbox" checked={Boolean(f.mandatory)} onChange={(e) => set("mandatory", e.target.checked)} /> Obligatoria</label></>}
      {kind === "board" && <><input aria-label="Periodo" style={input} placeholder="Periodo" value={s("period")} onChange={(e) => set("period", e.target.value)} /><textarea aria-label="Resumen ejecutivo" style={{ ...input, minHeight: 80 }} placeholder="Resumen ejecutivo" value={s("executiveSummary")} onChange={(e) => set("executiveSummary", e.target.value)} /><textarea aria-label="Recursos solicitados" style={{ ...input, minHeight: 60 }} placeholder="Recursos solicitados" value={s("resourcesRequested")} onChange={(e) => set("resourcesRequested", e.target.value)} /><textarea aria-label="Decisiones solicitadas" style={{ ...input, minHeight: 60 }} placeholder="Decisiones solicitadas" value={s("decisionsRequested")} onChange={(e) => set("decisionsRequested", e.target.value)} /></>}
      <button disabled={pending || (kind === "calendar" && !s("dueDate"))} className="nf-app-btn-primary nf-app-btn-sm" onClick={save}><Check size={13} /> Guardar cambios</button>
    </div>
  );
}

export default function ComplianceClient(props: { initial: CompliancePayload; demo?: boolean }) {
  return <ActionDialogsProvider><ComplianceClientContent {...props} /></ActionDialogsProvider>;
}

function ComplianceClientContent({ initial, demo = false }: { initial: CompliancePayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const requestChoice = useChoiceAction();
  const requestPrompt = usePromptAction();
  const requestNotice = useNoticeAction();
  const can = initial.can;
  const live = !demo;
  const d = initial.digest;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); router.refresh(); window.dispatchEvent(new Event("normaflow:server-action-success")); } catch (e) { const message = e instanceof Error ? e.message : "Error inesperado."; setError(message); window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } })); }
    });
  }

  const investigations = initial.channel.cases.flatMap((row) =>
    row.investigations.map((investigation) => ({ ...investigation, caseCode: row.code })),
  );

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <IsoSectionHeader headingLevel={1} icon={Scale} title={SECTION_META[tab].title} description={SECTION_META[tab].sub}
        action={demo ? <span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>Demo</span> : undefined} />

      {error && <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}

      {d.escalations.length > 0 && (
        <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>
          <b>Para decisión del órgano de gobierno:</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.escalations.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Obligaciones aplicables" value={initial.programme.applicable} />
        <Stat label="Cumplimiento" value={initial.programme.complianceRate ?? 0} suffix="%" />
        <Stat label="Sin evaluar" value={initial.programme.notEvaluated} accent={initial.programme.notEvaluated ? "var(--nf-warning-text)" : undefined} />
        <Stat label="Vencimientos fuera de plazo" value={initial.calendarSummary.overdue} accent={initial.calendarSummary.overdue ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Riesgo no aceptable" value={d.risks.notAcceptable} accent={d.risks.notAcceptable ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Incumplimientos abiertos" value={initial.breachSummary.open} accent={initial.breachSummary.open ? "var(--nf-warning-text)" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "obligations" ? [{ label: "Obligaciones aplicables", value: initial.programme.applicable }, { label: "Cumplimiento", value: initial.programme.complianceRate ?? 0, suffix: "%" }, { label: "Sin evaluar", value: initial.programme.notEvaluated, accent: initial.programme.notEvaluated ? "var(--nf-warning-text)" : undefined }] : tab === "sources" ? [{ label: "Fuentes regulatorias", value: initial.sources.length }, { label: "Jurisdicciones", value: initial.jurisdictions.length }, { label: "Obligaciones", value: initial.obligations.length }] : tab === "risks" ? [{ label: "Riesgos", value: d.risks.total }, { label: "Alto o crítico", value: d.risks.highOrCritical, accent: d.risks.highOrCritical ? "var(--nf-warning-text)" : undefined }, { label: "No aceptables", value: d.risks.notAcceptable, accent: d.risks.notAcceptable ? "var(--nf-danger-text)" : undefined }] : tab === "controls" ? [{ label: "Controles activos", value: initial.controls.filter((row) => row.active).length }, { label: "Sin probar", value: initial.controls.filter((row) => !row.lastTestedAt).length, accent: initial.controls.some((row) => !row.lastTestedAt) ? "var(--nf-warning-text)" : undefined }, { label: "Obligaciones sin control", value: initial.obligations.filter((row) => row.uncontrolled).length, accent: initial.obligations.some((row) => row.uncontrolled) ? "var(--nf-danger-text)" : undefined }] : tab === "evaluations" ? [{ label: "Evaluaciones", value: initial.evaluations.length }, { label: "Sin evaluar", value: initial.programme.notEvaluated, accent: initial.programme.notEvaluated ? "var(--nf-warning-text)" : undefined }, { label: "Cumplimiento", value: initial.programme.complianceRate ?? 0, suffix: "%" }] : tab === "calendar" ? [{ label: "Vencidas", value: initial.calendarSummary.overdue, accent: initial.calendarSummary.overdue ? "var(--nf-danger-text)" : undefined }, { label: "Próximas", value: initial.calendarSummary.dueSoon, accent: initial.calendarSummary.dueSoon ? "var(--nf-warning-text)" : undefined }, { label: "A tiempo", value: initial.calendarSummary.onTimeRate ?? 0, suffix: "%" }] : tab === "changes" ? [{ label: "Cambios regulatorios", value: initial.changes.length }, { label: "Obligaciones", value: initial.obligations.length }, { label: "Fuentes", value: initial.sources.length }] : tab === "conflicts" ? [{ label: "Declaraciones", value: initial.declarations.length }, { label: "Con conflicto", value: initial.declarationSummary.withConflict, accent: initial.declarationSummary.withConflict ? "var(--nf-warning-text)" : undefined }, { label: "Pendientes", value: initial.declarationSummary.pending, accent: initial.declarationSummary.pending ? "var(--nf-warning-text)" : undefined }] : tab === "channel" ? [{ label: "Casos recibidos", value: d.speakUp.total }, { label: "Abiertos", value: d.speakUp.open, accent: d.speakUp.open ? "var(--nf-warning-text)" : undefined }, { label: "Fuera de plazo", value: d.speakUp.overdueFeedback + d.speakUp.overdueAcknowledgement, accent: d.speakUp.overdueFeedback + d.speakUp.overdueAcknowledgement ? "var(--nf-danger-text)" : undefined }] : tab === "investigations" ? [{ label: "Investigaciones", value: investigations.length }, { label: "Activas", value: d.investigations.active, accent: d.investigations.active ? "var(--nf-warning-text)" : undefined }, { label: "Casos del canal", value: d.speakUp.total }] : tab === "breaches" ? [{ label: "Incumplimientos abiertos", value: initial.breachSummary.open, accent: initial.breachSummary.open ? "var(--nf-warning-text)" : undefined }, { label: "Incumplimientos", value: initial.breaches.length }, { label: "Vencidos", value: initial.breachSummary.overdueNotification, accent: initial.breachSummary.overdueNotification ? "var(--nf-danger-text)" : undefined }] : tab === "remediation" ? [{ label: "Planes", value: initial.plans.length }, { label: "Vencidos", value: initial.remediationSummary.overdue, accent: initial.remediationSummary.overdue ? "var(--nf-danger-text)" : undefined }, { label: "Por verificar", value: initial.remediationSummary.completedNotVerified, accent: initial.remediationSummary.completedNotVerified ? "var(--nf-warning-text)" : undefined }] : tab === "training" ? [{ label: "Programas", value: initial.trainings.length }, { label: "Cobertura", value: initial.trainings.reduce((sum, row) => sum + (row.targetCount ? (row.completedCount ?? 0) / row.targetCount : 0), 0), suffix: "" }, { label: "Obligaciones", value: initial.programme.applicable }] : [{ label: "Informes", value: initial.governingBodyReports.length }, { label: "Incumplimientos abiertos", value: initial.breachSummary.open, accent: initial.breachSummary.open ? "var(--nf-warning-text)" : undefined }, { label: "Riesgos no aceptables", value: d.risks.notAcceptable, accent: d.risks.notAcceptable ? "var(--nf-danger-text)" : undefined }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-chart-grid-2">
            <Meter
              title="Obligaciones evaluadas"
              subtitle="Cuánto del marco aplicable sigue sin evaluación de cumplimiento."
              label="sin evaluar"
              restLabel="Evaluadas"
              value={initial.programme.notEvaluated}
              total={initial.programme.applicable}
              tone="alert"
              empty="Aún no hay obligaciones aplicables registradas."
              action={{ label: "Abrir obligaciones", href: "/app/compliance?section=obligations" }}
            />
          </div>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen de compliance</strong></div><IsoQuickCreate modulePath="/app/compliance" items={[{ label: "Nueva obligación", description: "Registrar obligación aplicable", section: "obligations", Icon: BookMarked }, { label: "Nueva fuente regulatoria", description: "Agregar fuente normativa", section: "sources", Icon: Landmark }, { label: "Nuevo riesgo de compliance", description: "Evaluar riesgo", section: "risks", Icon: AlertTriangle }, { label: "Nuevo control de compliance", description: "Crear control", section: "controls", Icon: ShieldCheck }, { label: "Nueva evaluación de cumplimiento", description: "Registrar evaluación", section: "evaluations", Icon: ClipboardCheck }, { label: "Nuevo cambio regulatorio", description: "Registrar cambio", section: "changes", Icon: RefreshCw }, { label: "Declarar conflicto de interés", description: "Registrar declaración", section: "conflicts", Icon: UserX }, { label: "Registrar incumplimiento", description: "Abrir incumplimiento", section: "breaches", Icon: CircleOff }, { label: "Nuevo plan de remediación", description: "Crear plan correctivo", section: "remediation", Icon: Wrench }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><BookMarked size={16} aria-hidden />Programa de obligaciones (§4.6, §9.1.4)</h3>
            <Row k="Obligaciones aplicables" v={initial.programme.applicable} />
            <Row k="Cumplen" v={initial.programme.compliant} />
            <Row k="Cumplen parcialmente" v={initial.programme.partiallyCompliant} />
            <Row k="No cumplen" v={initial.programme.nonCompliant} danger={initial.programme.nonCompliant > 0} />
            <Row k="Sin evaluar" v={initial.programme.notEvaluated} danger={initial.programme.notEvaluated > 0} />
            <Row k="Cobertura de evaluación" v={initial.programme.coverageRate ?? 0} suffix="%" />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Megaphone size={16} aria-hidden />Canal de denuncias (§8.3)</h3>
            <Row k="Casos recibidos" v={d.speakUp.total} />
            <Row k="Abiertos" v={d.speakUp.open} />
            <Row k="Anónimos" v={d.speakUp.anonymous} />
            <Row k="Fundados" v={d.speakUp.substantiated} />
            <Row k="Acuses fuera de plazo" v={d.speakUp.overdueAcknowledgement} danger={d.speakUp.overdueAcknowledgement > 0} />
            <Row k="Respuestas fuera de plazo" v={d.speakUp.overdueFeedback} danger={d.speakUp.overdueFeedback > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>Cifras agregadas. Ningún dato del informante llega a este panel.</p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><AlertTriangle size={16} aria-hidden />Riesgos y controles (§6.1, §8.2)</h3>
            <Row k="Riesgos de compliance" v={d.risks.total} />
            <Row k="Nivel residual alto o crítico" v={d.risks.highOrCritical} danger={d.risks.highOrCritical > 0} />
            <Row k="No aceptables" v={d.risks.notAcceptable} danger={d.risks.notAcceptable > 0} />
            <Row k="Controles activos" v={initial.controls.filter((row) => row.active).length} />
            <Row k="Controles sin probar" v={initial.controls.filter((row) => !row.lastTestedAt).length} danger={initial.controls.some((row) => !row.lastTestedAt)} />
            <Row k="Obligaciones sin control" v={initial.obligations.filter((row) => row.uncontrolled).length} danger={initial.obligations.some((row) => row.uncontrolled)} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><CircleOff size={16} aria-hidden />Incumplimientos y remediación (§10.2)</h3>
            <Row k="Incumplimientos abiertos" v={initial.breachSummary.open} danger={initial.breachSummary.open > 0} />
            <Row k="Graves" v={initial.breachSummary.severe} danger={initial.breachSummary.severe > 0} />
            <Row k="Recurrentes" v={initial.breachSummary.recurrent} danger={initial.breachSummary.recurrent > 0} />
            <Row k="Notificación pendiente" v={initial.breachSummary.pendingNotification} danger={initial.breachSummary.pendingNotification > 0} />
            <Row k="Notificación fuera de plazo" v={initial.breachSummary.overdueNotification} danger={initial.breachSummary.overdueNotification > 0} />
            <Row k="Planes completados sin verificar" v={initial.remediationSummary.completedNotVerified} danger={initial.remediationSummary.completedNotVerified > 0} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><UserX size={16} aria-hidden />Conflictos de interés (§7.2.2)</h3>
            <Row k="Declaraciones" v={initial.declarationSummary.total} />
            <Row k="Con conflicto declarado" v={initial.declarationSummary.withConflict} />
            <Row k="Pendientes de revisión" v={initial.declarationSummary.pending} danger={initial.declarationSummary.pending > 0} />
            <Row k="Obligan a abstenerse" v={initial.declarationSummary.recusalRequired} />
            {!initial.declarationsComplete && (
              <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>Solo ves el contenido de tus propias declaraciones.</p>
            )}
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Search size={16} aria-hidden />Vigilancia regulatoria (§8.1, §6.3)</h3>
            <Row k="Fuentes vigiladas" v={initial.sources.filter((row) => row.monitored).length} />
            <Row k="Revisión de fuente vencida" v={initial.sources.filter((row) => row.monitored && row.nextCheckDate && row.nextCheckDate < new Date()).length} danger={initial.sources.some((row) => row.monitored && row.nextCheckDate && row.nextCheckDate < new Date())} />
            <Row k="Cambios detectados" v={initial.changes.length} />
            <Row k="Sin analizar" v={initial.changes.filter((row) => row.impactStatus === "PENDING_ASSESSMENT").length} danger={initial.changes.some((row) => row.impactStatus === "PENDING_ASSESSMENT")} />
            <Row k="Formación obligatoria" v={d.training.mandatory} />
            <Row k="Cobertura de formación" v={d.training.coverageRate ?? 0} suffix="%" />
          </div>
          </div>
        </>
      )}

      {tab === "obligations" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva obligación">
              {(close) => <NewObligationForm members={initial.members} sources={initial.sources} jurisdictions={initial.jurisdictions} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Obligación", "Tipo", "Jurisdicción", "Fuente", "Aplicabilidad", "Estado", "Criticidad", "Responsable", "Próxima evaluación", "Controles", live && (can.update || can.create) ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.obligations.map((row) => (
              <ObligationRow key={row.id} row={row} nameOf={nameOf} jurisdictions={initial.jurisdictions} members={initial.members} can={can} live={live} pending={pending} run={run} />
            ))}
            {initial.obligations.length === 0 && <tr><td style={td} colSpan={12}>Sin obligaciones registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "sources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva jurisdicción">
              {(close) => <NewJurisdictionForm jurisdictions={initial.jurisdictions} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          {live && can.create && (
            <NewFormToggle label="Nueva fuente regulatoria">
              {(close) => <NewSourceForm jurisdictions={initial.jurisdictions} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Fuente", "Tipo", "Emisor", "Jurisdicción", "Vigencia", "Vigilada", "Última revisión", "Próxima revisión", "Obligaciones", live && can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.sources.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.reference ?? "—"}</div></td>
                <td style={td}>{row.sourceType}</td>
                <td style={td}>{row.issuer ?? "—"}</td>
                <td style={td}>{row.jurisdiction?.code ?? "—"}</td>
                <td style={td}>{row.status}</td>
                <td style={td}>{row.monitored ? `${row.monitoringFrequency}` : <span style={{ color: "var(--nf-danger-text)" }}>No</span>}</td>
                <td style={td}>{fmt(row.lastCheckedAt)}</td>
                <td style={td}>{fmt(row.nextCheckDate)}</td>
                <td style={td}>{row._count.obligations} · {row._count.changes} cambio(s)</td>
                {live && can.update && (
                  <td style={td}>
                    <div className="nf-row-actions"><EditRecordButton title={`Editar fuente ${row.code}`}>{(close) => <EditRecordForm kind="source" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton><button disabled={pending} onClick={() => requestChoice({ title: "Revisar fuente regulatoria", message: "¿La revisión detectó un cambio regulatorio?", confirmLabel: "Sí, hay un cambio", cancelLabel: "No, sin cambio", onConfirm: () => run(() => recordSourceCheck(row.id, { changeDetected: true })), onCancel: () => run(() => recordSourceCheck(row.id, { changeDetected: false })) })} className="nf-row-action"><RefreshCw size={12} /> Revisar</button></div>
                  </td>
                )}
              </tr>
            ))}
            {initial.sources.length === 0 && <tr><td style={td} colSpan={11}>Sin fuentes regulatorias registradas.</td></tr>}
          </Table>
          <Table head={["Código", "Jurisdicción", "Nivel", "País", "Autoridad", "Aplicable", "Motivo", live && can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.jurisdictions.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.name}</td>
                <td style={td}>{row.level}</td>
                <td style={td}>{row.country ?? "—"}</td>
                <td style={td}>{row.authority ?? "—"}</td>
                <td style={td}>{row.applicable ? "Sí" : "No"}</td>
                <td style={td}>{row.rationale ?? <span style={{ color: "var(--nf-warning-text)" }}>sin motivo</span>}</td>
                {live && can.update && <td style={td}><EditRecordButton title={`Editar jurisdicción ${row.code}`}>{(close) => <EditRecordForm kind="jurisdiction" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton></td>}
              </tr>
            ))}
            {initial.jurisdictions.length === 0 && <tr><td style={td} colSpan={8}>Sin jurisdicciones registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "risks" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo riesgo de compliance">
              {(close) => <NewRiskForm obligations={initial.obligations} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Riesgo", "Obligación", "Categoría", "P×I", "Inherente", "Eficacia controles", "Residual", "Aceptabilidad", "Exposición", "Tratamiento", "Responsable", live && (can.update || can.approve) ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.risks.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{row.obligation?.code ?? "—"}</td>
                <td style={td}>{row.category}</td>
                <td style={td}>{row.likelihood}×{row.impact}</td>
                <td style={td}><span style={toneChip(level(row.inherentLevel))}>{row.inherentScore}</span></td>
                <td style={td}>{row.controlEffectiveness ?? "—"}{row._count.controls ? ` (${row._count.controls})` : ""}</td>
                <td style={td}><span style={toneChip(level(row.residualLevel))}>{row.residualScore}</span></td>
                <td style={td}>{row.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>No aceptable</span> : row.acceptability === "ACCEPTABLE" ? "Aceptable" : "Tolerable"}</td>
                <td style={td}>{money(row.sanctionExposure)}</td>
                <td style={td}>{row.treatment}{row.acceptedAt && <div style={{ color: "var(--nf-text-secondary)", fontSize: 11 }}>aceptado por {nameOf(row.acceptedById)}</div>}</td>
                <td style={td}>{nameOf(row.ownerId)}</td>
                {live && (can.update || can.approve) && (
                  <td style={td}>
                    <div className="nf-row-actions">
                      {can.update && <EditRecordButton title={`Editar riesgo ${row.code}`}>{(close) => <EditRecordForm kind="risk" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton>}
                      {can.update && <button disabled={pending} onClick={() => run(() => revalueComplianceRisk(row.id))} className="nf-row-action"><RefreshCw size={12} /> Revalorar</button>}
                      {can.approve && row.status !== "ACCEPTED" && (
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Aceptar riesgo de compliance", label: "Motivo de la aceptación", placeholder: "Explica por qué el riesgo es aceptable…", message: "Registra la justificación que quedará asociada a la decisión.", onConfirm: (rationale) => run(() => acceptComplianceRisk(row.id, { rationale })) })} className="nf-row-action" data-tone="success"><Check size={12} /> Aceptar</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.risks.length === 0 && <tr><td style={td} colSpan={13}>Sin riesgos de compliance registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "controls" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo control de compliance">
              {(close) => <NewControlForm obligations={initial.obligations} risks={initial.risks} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Control", "Obligación", "Riesgo", "Tipo", "Naturaleza", "Frecuencia", "Diseño", "Operación", "Eficacia", "Última prueba", "Próxima prueba", live && can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.controls.map((row) => (
              <ControlRow key={row.id} row={row} members={initial.members} can={can} live={live} pending={pending} run={run} />
            ))}
            {initial.controls.length === 0 && <tr><td style={td} colSpan={13}>Sin controles de compliance registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "evaluations" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", fontSize: 13 }}>
            Solo una evaluación aprobada mueve el estado de cumplimiento de la obligación, y la decisión queda con nombre y fecha.
          </div>
          {live && can.create && (
            <NewFormToggle label="Nueva evaluación de cumplimiento">
              {(close) => <NewEvaluationForm obligations={initial.obligations} controls={initial.controls} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Obligación", "Periodo", "Método", "Resultado", "Puntaje", "Evaluó", "Revisión", "Revisor", can.update || can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.evaluations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.obligation?.code ?? row.control?.code ?? "—"}<div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.obligation?.title ?? ""}</div></td>
                <td style={td}>{row.period}</td>
                <td style={td}>{row.method}</td>
                <td style={td}><span style={toneChip(STATUS_COLORS[row.result] ?? "var(--nf-text-secondary)")}>{STATUS_LABEL[row.result] ?? row.result}</span></td>
                <td style={td}>{row.score ?? "—"}</td>
                <td style={td}>{nameOf(row.evaluatedById)}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{fmt(row.evaluatedAt)}</div></td>
                <td style={td}><span style={toneChip(REVIEW_COLORS[row.reviewStatus] ?? "var(--nf-text-secondary)")}>{REVIEW_LABEL[row.reviewStatus] ?? row.reviewStatus}</span></td>
                <td style={td}>{row.reviewerId ? `${nameOf(row.reviewerId)} · ${fmt(row.reviewedAt)}` : "—"}</td>
                {(can.update || can.approve) && (
                  <td style={td}>
                    <div className="nf-row-actions">
                      {live && can.update && (row.reviewStatus === "DRAFT" || row.reviewStatus === "REJECTED") && <EditRecordButton title={`Editar evaluación ${row.code}`}>{(close) => <EditRecordForm kind="evaluation" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton>}
                      {live && can.update && row.reviewStatus === "DRAFT" && (
                        <button disabled={pending} onClick={() => run(() => submitEvaluationForReview(row.id))} className="nf-row-action"><Send size={12} /> Enviar a revisión</button>
                      )}
                      {live && can.approve && row.reviewStatus === "UNDER_REVIEW" && (
                        <>
                          <button disabled={pending} onClick={() => run(() => decideEvaluation(row.id, { decision: "APPROVED" }))} className="nf-row-action" data-tone="success"><Check size={12} /> Aprobar</button>
                          <button disabled={pending} onClick={() => requestPrompt({ title: "Rechazar evaluación", label: "Motivo del rechazo", placeholder: "Describe el motivo de la devolución…", onConfirm: (note) => run(() => decideEvaluation(row.id, { decision: "REJECTED", note })) })} className="nf-row-action" data-nf-no-action-icon><X size={14} strokeWidth={2} aria-hidden /><X size={12} /> Rechazar</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.evaluations.length === 0 && <tr><td style={td} colSpan={10}>Sin evaluaciones de cumplimiento.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "calendar" && (
        <div style={{ display: "grid", gap: 14 }}>
          {initial.alerts.length > 0 && (
            <div style={{ ...card, borderColor: "var(--nf-warning-border)", background: "var(--nf-warning-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <BellRing size={16} color="#c2410c" />
                <b style={{ color: "var(--nf-warning-text)" }}>{initial.alerts.length} alerta(s) de vencimiento</b>
                {live && can.update && (
                  <button disabled={pending} onClick={() => run(() => refreshCalendarAlerts())} className="nf-row-action" style={{ marginLeft: "auto" }}><RefreshCw size={12} /> Notificar responsables</button>
                )}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {initial.alerts.slice(0, 8).map((alert) => (
                  <li key={alert.id}>
                    <b>{alert.code}</b> {alert.title} — {alert.daysRemaining < 0 ? `${Math.abs(alert.daysRemaining)} día(s) de retraso` : `vence en ${alert.daysRemaining} día(s)`} · {nameOf(alert.responsibleId)}
                    {alert.alreadyAlerted && <span style={{ color: "var(--nf-text-subtle)" }}> (ya notificado)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {live && can.create && (
            <NewFormToggle label="Nuevo vencimiento">
              {(close) => <NewCalendarForm obligations={initial.obligations} jurisdictions={initial.jurisdictions} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
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
                  <span style={toneChip(CALENDAR_COLORS[row.state.status])}>{CALENDAR_LABEL[row.state.status]}</span>
                  {row.state.status === "OVERDUE" && <div style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>{row.state.overdueDays} día(s)</div>}
                </td>
                <td style={td}>{nameOf(row.responsibleId)}</td>
                {can.update && (
                  <td style={td}>
                    {live && !row.completedAt && row.state.status !== "CANCELLED" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}><EditRecordButton title={`Editar vencimiento ${row.code}`}>{(close) => <EditRecordForm kind="calendar" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton><button disabled={pending} onClick={() => requestPrompt({ title: "Cancelar vencimiento", label: "Motivo de cancelación", placeholder: "Explica por qué se cancela…", onConfirm: (note) => run(() => cancelCalendarItem(row.id, note)) })} className="nf-row-action" data-nf-no-action-icon><X size={14} strokeWidth={2} aria-hidden />Cancelar</button></div>}
                    {live && !row.completedAt && row.state.status !== "CANCELLED" && (
                      <button disabled={pending} onClick={() => requestPrompt({ title: "Marcar vencimiento como cumplido", label: "Referencia de la presentación", placeholder: "Referencia opcional…", required: false, onConfirm: (reference) => run(() => completeCalendarItem(row.id, { submissionReference: reference || undefined })) })} className="nf-row-action" data-tone="success"><Check size={12} /> Marcar cumplido</button>
                    )}
                    {row.completedAt && <span style={{ color: "var(--nf-text-secondary)" }}>{fmt(row.completedAt)}</span>}
                  </td>
                )}
              </tr>
            ))}
            {initial.calendar.length === 0 && <tr><td style={td} colSpan={10}>Sin vencimientos en el calendario.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "changes" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo cambio regulatorio">
              {(close) => <NewChangeForm sources={initial.sources} jurisdictions={initial.jurisdictions} obligations={initial.obligations} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Cambio", "Fuente", "Tipo", "Detectado", "Obliga desde", "Impacto", "Estado", "Responsable", "Vence", "Implementado", live && can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.changes.map((row) => (
              <ChangeRow key={row.id} row={row} members={initial.members} nameOf={nameOf} can={can} live={live} pending={pending} run={run} />
            ))}
            {initial.changes.length === 0 && <tr><td style={td} colSpan={12}>Sin cambios regulatorios registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "conflicts" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", fontSize: 13 }}>
            <Lock size={16} />
            {initial.declarationsComplete
              ? "Declaraciones confidenciales. Se muestran porque revisas el registro de conflictos; su contenido no sale de aquí."
              : "Solo ves tus propias declaraciones. El resto se cuenta en el panel, pero no se muestra."}
          </div>
          {live && can.create && (
            <NewFormToggle label="Declarar conflicto de interés">
              {(close) => <NewDeclarationForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Declarante", "Periodo", "Conflicto", "Tipo", "Parte relacionada", "Valor", "Abstención", "Revisión", "Revisor", can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.declarations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{nameOf(row.declarantId)}</td>
                <td style={td}>{row.period}</td>
                <td style={td}>{row.hasConflict ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Sí</span> : "No"}</td>
                <td style={td}>{row.conflictType ?? "—"}</td>
                <td style={td}>{row.relatedParty ?? "—"}</td>
                <td style={td}>{money(row.estimatedValue)}{row.currency ? ` ${row.currency}` : ""}</td>
                <td style={td}>{row.recusalRequired ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Obligada</span> : "—"}</td>
                <td style={td}><span style={toneChip(REVIEW_COLORS[row.reviewStatus] ?? "var(--nf-text-secondary)")}>{REVIEW_LABEL[row.reviewStatus] ?? row.reviewStatus}</span></td>
                <td style={td}>{row.reviewerId ? `${nameOf(row.reviewerId)} · ${fmt(row.reviewedAt)}` : "—"}</td>
                {can.approve && (
                  <td style={td}>
                    {live && row.reviewStatus === "PENDING" && (
                      <div className="nf-row-actions">
                        <button disabled={pending} onClick={() => run(() => reviewConflictDeclaration(row.id, { decision: "ACCEPTED" }))} className="nf-row-action" data-tone="success"><Check size={12} /> Aceptar</button>
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Mitigar conflicto de interés", label: "Medidas de mitigación", placeholder: "Describe las medidas aplicadas…", onConfirm: (measures) => run(() => reviewConflictDeclaration(row.id, { decision: "MITIGATED", mitigationMeasures: measures, recusalRequired: true })) })} className="nf-row-action"><ArrowRight size={12} /> Mitigar</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {initial.declarations.length === 0 && <tr><td style={td} colSpan={11}>Sin declaraciones visibles.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "channel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {live && can.channelReport && (
            <NewFormToggle label="Presentar una denuncia">
              {(close) => <NewReportForm members={initial.members} allowAnonymous={initial.channel.config.allowAnonymous} allowConfidential={initial.channel.config.allowConfidential} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Configuración del canal</h3>
              <Row k="Denuncia anónima" text={initial.channel.config.allowAnonymous ? "Permitida" : "No permitida"} />
              <Row k="Denuncia confidencial" text={initial.channel.config.allowConfidential ? "Permitida" : "No permitida"} />
              <Row k="Plazo de acuse" v={initial.channel.config.acknowledgementDays} suffix=" d" />
              <Row k="Plazo de respuesta" v={initial.channel.config.feedbackDays} suffix=" d" />
              <Row k="Retención del expediente" v={initial.channel.config.retentionMonths} suffix=" meses" />
              {!initial.channel.configured && <p style={{ margin: "8px 0 0", color: "var(--nf-warning-text)", fontSize: 12 }}>Sin configurar: se aplican los valores por defecto.</p>}
              {live && can.channelDecide && (
                <div style={{ marginTop: 10 }}>
                  <NewFormToggle label="Configurar canal">
                    {(close) => <ChannelConfigForm current={initial.channel.config} members={initial.members} pending={pending} run={run} onDone={close} />}
                  </NewFormToggle>
                </div>
              )}
            </div>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Acceso restringido</h3>
              <Row k="Casos que puedes gestionar" v={initial.channel.cases.length} />
              <Row k="Casos sin autorización" v={initial.channel.restrictedCount} />
              <Row k="Retención vencida" v={initial.channel.retentionDue} danger={initial.channel.retentionDue > 0} />
              <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>
                Un expediente se abre con una autorización explícita por caso. Tener permisos del módulo no basta.
              </p>
            </div>
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Patrón por categoría</h3>
              {d.speakUp.byCategory.length === 0 && <p style={{ color: "var(--nf-text-secondary)", fontSize: 13, margin: 0 }}>Sin casos registrados.</p>}
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
                  <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{CASE_LABEL[row.status] ?? row.status}</span></td>
                  <td style={td}>{fmt(row.acknowledgedAt)}</td>
                  <td style={td}>{fmt(row.feedbackProvidedAt)}</td>
                  <td style={td}>{row.outcome ? OUTCOME_LABEL[row.outcome] : "—"}</td>
                  <td style={td}>{row.protectionMeasures ?? (row.retaliationRisk ? <span style={{ color: "var(--nf-warning-text)" }}>riesgo señalado, sin medidas</span> : "—")}</td>
                </tr>
              ))}
            </Table>
          )}

          {initial.channel.cases.length === 0 ? (
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 10, color: "var(--nf-text-secondary)" }}>
              <EyeOff size={18} />
              {initial.channel.restrictedCount > 0
                ? `Hay ${initial.channel.restrictedCount} caso(s) en el canal para los que no tienes autorización.`
                : "No tienes ningún expediente asignado."}
            </div>
          ) : (
            initial.channel.cases.map((row) => (
              <CaseCard key={row.id} row={row} members={initial.members} can={can} live={live} pending={pending} run={run} />
            ))
          )}
        </div>
      )}

      {tab === "investigations" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", fontSize: 13 }}>
            Solo aparecen las investigaciones de los casos que puedes gestionar. Quien está señalado no investiga, y un conflicto declarado obliga a abstenerse.
          </div>
          {live && can.update && (
            <NewFormToggle label="Abrir investigación de un incumplimiento">
              {(close) => <NewInvestigationForm breaches={initial.breaches} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Caso", "Investigación", "Instructor", "Independencia", "Conflicto", "Estado", "Inicio", "Vence", "Conclusión", can.channelHandle ? "Acciones" : ""].filter(Boolean) as string[]}>
            {investigations.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.caseCode}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{nameOf(row.leadInvestigatorId)}{row.reassignedToId && <div style={{ color: "var(--nf-info-text)", fontSize: 11 }}>reasignada a {nameOf(row.reassignedToId)}</div>}</td>
                <td style={td}>{row.independenceConfirmed ? <span style={{ color: "var(--nf-success-text)" }}>confirmada</span> : <span style={{ color: "var(--nf-danger-text)" }}>sin confirmar</span>}</td>
                <td style={td}>{row.conflictDetected ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>detectado</span> : row.conflictChecked ? "comprobado" : <span style={{ color: "var(--nf-warning-text)" }}>sin comprobar</span>}</td>
                <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{INVESTIGATION_LABEL[row.status] ?? row.status}</span></td>
                <td style={td}>{fmt(row.startedAt)}</td>
                <td style={td}>{fmt(row.dueDate)}</td>
                <td style={td}>{row.concludedAt ? fmt(row.concludedAt) : "—"}</td>
                {can.channelHandle && (
                  <td style={td}>
                    <div className="nf-row-actions">
                      {live && row.status === "PLANNED" && (
                        <button disabled={pending} onClick={() => run(() => setInvestigationStatus(row.id, { to: "ACTIVE" }))} className="nf-row-action"><ArrowRight size={12} /> Iniciar</button>
                      )}
                      {live && row.status === "ACTIVE" && (
                        <button disabled={pending} onClick={() => {
                          requestPrompt({ title: "Concluir investigación", label: "Hallazgos", placeholder: "Describe los hallazgos…", onConfirm: (findings) => requestPrompt({ title: "Concluir investigación", label: "Conclusión", placeholder: "Registra la conclusión…", onConfirm: (conclusion) => run(() => setInvestigationStatus(row.id, { to: "CONCLUDED", findings, conclusion })) }) });
                        }} className="nf-row-action" data-tone="success"><Check size={12} /> Concluir</button>
                      )}
                      {live && can.channelDecide && (row.status === "PLANNED" || row.status === "ACTIVE") && (
                        <button disabled={pending} onClick={() => {
                          requestPrompt({ title: "Recusar investigador", label: "Motivo de la recusación", placeholder: "Explica el conflicto de interés…", onConfirm: (reason) => requestPrompt({ title: "Recusar investigador", label: "ID del miembro al que se reasigna", placeholder: "Introduce el ID del miembro…", onConfirm: (reassignedToId) => run(() => recuseInvestigator(row.id, { reason, reassignedToId })) }) });
                        }} className="nf-row-action"><UserX size={12} /> Recusar</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {investigations.length === 0 && <tr><td style={td} colSpan={11}>Sin investigaciones visibles.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "breaches" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Registrar incumplimiento">
              {(close) => <NewBreachForm obligations={initial.obligations} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Incumplimiento", "Obligación", "Detección", "Severidad", "Estado", "Causa raíz", "Recurrente", "Notificación", "Exposición", "Sanción", can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.breaches.map((row) => {
              const index = BREACH_FLOW.indexOf(row.status);
              const next = index >= 0 && index < BREACH_FLOW.length - 1 ? BREACH_FLOW[index + 1] : null;
              return (
                <tr key={row.id}>
                  <td style={td}>{row.code}</td>
                  <td style={td}><b>{row.title}</b></td>
                  <td style={td}>{row.obligation?.code ?? "—"}</td>
                  <td style={td}>{row.detectionSource}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{fmt(row.detectedAt)}</div></td>
                  <td style={td}><span style={toneChip(level(row.severity))}>{row.severity}</span></td>
                  <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{BREACH_LABEL[row.status] ?? row.status}</span></td>
                  <td style={td}>{row.rootCause ? "Sí" : <span style={{ color: "var(--nf-warning-text)" }}>pendiente</span>}</td>
                  <td style={td}>{row.recurrence ? <span style={chip("var(--nf-danger-border)", "var(--nf-danger-text)")}>Sí</span> : "No"}</td>
                  <td style={td}>
                    {row.notificationRequired
                      ? row.authorityNotifiedAt
                        ? fmt(row.authorityNotifiedAt)
                        : <span style={chip(row.notificationOverdue ? "var(--nf-danger-border)" : "var(--nf-warning-border)", row.notificationOverdue ? "var(--nf-danger-text)" : "var(--nf-warning-text)")}>{row.notificationOverdue ? "fuera de plazo" : `hasta ${fmt(row.notificationDeadline)}`}</span>
                      : "—"}
                  </td>
                  <td style={td}>{money(row.financialExposure)}</td>
                  <td style={td}>{row.sanctionImposed ? money(row.sanctionAmount) : "—"}</td>
                  {can.update && (
                    <td style={td}>
                      <div className="nf-row-actions">
                        {live && row.status !== "CLOSED" && row.status !== "REMEDIATED" && <EditRecordButton title={`Editar incumplimiento ${row.code}`}>{(close) => <EditRecordForm kind="breach" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton>}
                        {live && next && (
                          <button disabled={pending} onClick={() => run(() => setBreachStatus(row.id, { to: next as never }))} className="nf-row-action"><ArrowRight size={12} /> {BREACH_LABEL[next]}</button>
                        )}
                        {live && row.notificationRequired && !row.authorityNotifiedAt && (
                          <button disabled={pending} onClick={() => requestPrompt({ title: "Notificar a la autoridad", label: "Referencia de la notificación", placeholder: "Referencia opcional…", required: false, onConfirm: (authorityReference) => run(() => recordAuthorityNotification(row.id, { authorityReference: authorityReference || undefined })) })} className="nf-row-action" data-tone="success"><Send size={12} /> Notificar autoridad</button>
                        )}
                        {!next && (!row.notificationRequired || row.authorityNotifiedAt) && <span style={{ color: "var(--nf-text-subtle)" }}>—</span>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {initial.breaches.length === 0 && <tr><td style={td} colSpan={12}>Sin incumplimientos registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "remediation" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de remediación">
              {(close) => <NewPlanForm breaches={initial.breaches} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
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
                <td style={td}><span style={chip(row.effectiveStatus === "OVERDUE" ? "var(--nf-danger-border)" : "var(--nf-primary-subtle)", row.effectiveStatus === "OVERDUE" ? "var(--nf-danger-text)" : "var(--nf-primary-active)")}>{PLAN_LABEL[row.effectiveStatus] ?? row.effectiveStatus}</span></td>
                <td style={td}>{row.approvedAt ? `${nameOf(row.approvedById)} · ${fmt(row.approvedAt)}` : "—"}</td>
                <td style={td}>{row.effectivenessVerified ? `${nameOf(row.effectivenessVerifiedById)}` : row.completedAt ? <span style={{ color: "var(--nf-danger-text)" }}>sin verificar</span> : "—"}</td>
                <td style={td}>{money(row.cost)}</td>
                {(can.update || can.approve) && (
                  <td style={td}>
                    <div className="nf-row-actions">
                      {live && can.update && row.status === "DRAFT" && <EditRecordButton title={`Editar plan ${row.code}`}>{(close) => <EditRecordForm kind="plan" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton>}
                      {live && can.approve && row.status === "DRAFT" && (
                        <button disabled={pending} onClick={() => run(() => approveRemediationPlan(row.id))} className="nf-row-action" data-tone="success"><Check size={12} /> Aprobar</button>
                      )}
                      {live && can.update && row.status !== "DRAFT" && !row.completedAt && (
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Actualizar avance del plan", label: "Avance (0–100)", placeholder: "Ejemplo: 75", multiline: false, onConfirm: (value) => { const progressPercent = Number(value); if (Number.isFinite(progressPercent) && progressPercent >= 0 && progressPercent <= 100) run(() => updateRemediationProgress(row.id, { progressPercent })); } })} className="nf-row-action"><ArrowRight size={12} /> Avance</button>
                      )}
                      {live && can.approve && row.completedAt && !row.effectivenessVerified && (
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Verificar eficacia del plan", label: "Constancia de la verificación", placeholder: "Describe la evidencia de eficacia…", onConfirm: (note) => run(() => verifyRemediationEffectiveness(row.id, { note })) })} className="nf-row-action" data-tone="success"><ShieldCheck size={12} /> Verificar eficacia</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.plans.length === 0 && <tr><td style={td} colSpan={12}>Sin planes de remediación.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "training" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva formación de compliance">
              {(close) => <NewTrainingForm obligations={initial.obligations} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Formación", "Tema", "Obligación", "Audiencia", "Obligatoria", "Modalidad", "Programada", "Cobertura", "Aprobados", "Eficacia", "Próxima", live && can.update ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.trainings.map((row) => (
              <TrainingRow key={row.id} row={row} members={initial.members} can={can} live={live} pending={pending} run={run} />
            ))}
            {initial.trainings.length === 0 && <tr><td style={td} colSpan={13}>Sin formación en compliance registrada.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "board" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Preparar informe al órgano de gobierno">
              {(close) => <NewGoverningReportForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Informe", "Periodo", "Presentado a", "Preparó", "Estado", "Enviado", "Presentado", "Acuse", can.update || can.approve ? "Acciones" : ""].filter(Boolean) as string[]}>
            {initial.governingBodyReports.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.executiveSummary?.slice(0, 120) ?? "—"}</div></td>
                <td style={td}>{row.period}</td>
                <td style={td}>{row.presentedTo}</td>
                <td style={td}>{nameOf(row.preparedById)}</td>
                <td style={td}><span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{row.reviewStatus}</span></td>
                <td style={td}>{fmt(row.submittedAt)}</td>
                <td style={td}>{fmt(row.presentedAt)}</td>
                <td style={td}>{row.acknowledgedAt ? `${nameOf(row.acknowledgedById)} · ${fmt(row.acknowledgedAt)}` : "—"}</td>
                {(can.update || can.approve) && (
                  <td style={td}>
                    <div className="nf-row-actions">
                      {live && can.update && row.reviewStatus === "DRAFT" && <EditRecordButton title={`Editar informe ${row.code}`}>{(close) => <EditRecordForm kind="board" row={row as unknown as EditRow} members={initial.members} pending={pending} run={run} onDone={close} />}</EditRecordButton>}
                      {live && can.update && row.reviewStatus === "DRAFT" && (
                        <button disabled={pending} onClick={() => run(() => submitGoverningBodyReport(row.id))} className="nf-row-action"><Send size={12} /> Enviar</button>
                      )}
                      {live && can.approve && !row.acknowledgedAt && row.reviewStatus !== "DRAFT" && (
                        <button disabled={pending} onClick={() => requestPrompt({ title: "Registrar acuse del órgano de gobierno", label: "Decisiones tomadas", placeholder: "Describe las decisiones tomadas (opcional)…", required: false, onConfirm: (decisionsTaken) => run(() => acknowledgeGoverningBodyReport(row.id, { decisionsTaken: decisionsTaken || undefined })) })} className="nf-row-action" data-tone="success"><Gavel size={12} /> Registrar acuse</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {initial.governingBodyReports.length === 0 && <tr><td style={td} colSpan={10}>Sin informes al órgano de gobierno.</td></tr>}
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return <IsoMetricCard label={label} value={value} suffix={suffix} accent={accent} />;
}
function Row({ k, v, text, danger, suffix }: { k: string; v?: number; text?: string; danger?: boolean; suffix?: string }) {
  return (
    <div className="nf-iso-dashboard-row">
      <span className="nf-iso-dashboard-row-label">{k}</span>
      <b className="nf-iso-dashboard-row-value" style={{ color: danger ? "var(--nf-danger-text)" : undefined }}>{text ?? `${v}${suffix ?? ""}`}</b>
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <IsoTableCard icon={Scale} headers={head}>{children}</IsoTableCard>;
}

// ─────────────────────────────────────────────────────
// Formularios de creación
// ─────────────────────────────────────────────────────

function NewJurisdictionForm({ jurisdictions, pending, run, onDone }: { jurisdictions: CompliancePayload["jurisdictions"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ code: "", name: "", level: "NATIONAL", country: "", authority: "", applicable: true, rationale: "", parentId: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
        <input aria-label="Código (EU, ES, ES-MD…)" style={input} placeholder="Código (EU, ES, ES-MD…)" value={f.code} onChange={(e) => set("code", e.target.value)} />
        <Picker aria-label="Nivel" style={input} value={f.level} onChange={(e) => set("level", e.target.value)}>{["SUPRANATIONAL", "NATIONAL", "REGIONAL", "LOCAL", "SECTORAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <input aria-label="Nombre" style={input} placeholder="Nombre" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="País" style={input} placeholder="País" value={f.country} onChange={(e) => set("country", e.target.value)} />
        <input aria-label="Autoridad competente" style={input} placeholder="Autoridad competente" value={f.authority} onChange={(e) => set("authority", e.target.value)} />
        <Picker aria-label="Elemento superior" style={input} value={f.parentId} onChange={(e) => set("parentId", e.target.value)}><option value="">Sin jurisdicción superior</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.applicable} onChange={(e) => set("applicable", e.target.checked)} /> Aplicable a la organización</label>
      <input aria-label="Motivo (por qué aplica)" style={input} placeholder="Motivo (por qué aplica)" value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
      <button disabled={pending || !f.code || !f.name} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createJurisdiction({ code: f.code, name: f.name, level: f.level as never, country: f.country || undefined, authority: f.authority || undefined, applicable: f.applicable, rationale: f.rationale || undefined, parentId: f.parentId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewSourceForm({ jurisdictions, members, pending, run, onDone }: { jurisdictions: CompliancePayload["jurisdictions"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", sourceType: "LAW", issuer: "", reference: "", jurisdictionId: "", monitoringFrequency: "QUARTERLY", ownerId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Nombre de la fuente" style={input} placeholder="Nombre de la fuente" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <Picker aria-label="Tipo de fuente" style={input} value={f.sourceType} onChange={(e) => set("sourceType", e.target.value)}>{["LAW", "DECREE", "REGULATION", "DIRECTIVE", "RESOLUTION", "ORDINANCE", "CASE_LAW", "STANDARD", "CODE_OF_CONDUCT", "CONTRACT", "LICENSE", "INTERNAL_POLICY", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Emisor" style={input} placeholder="Emisor" value={f.issuer} onChange={(e) => set("issuer", e.target.value)} />
        <input aria-label="Referencia" style={input} placeholder="Referencia" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
        <Picker aria-label="Jurisdicción" style={input} value={f.jurisdictionId} onChange={(e) => set("jurisdictionId", e.target.value)}><option value="">Jurisdicción…</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
        <Picker aria-label="Frecuencia de vigilancia" style={input} value={f.monitoringFrequency} onChange={(e) => set("monitoringFrequency", e.target.value)}>{["CONTINUOUS", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL", "ON_EVENT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <PersonPicker people={members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Responsable de la vigilancia…" ariaLabel="Responsable de la vigilancia" style={input} />
      <button disabled={pending || !f.name} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createRegulatorySource({ name: f.name, sourceType: f.sourceType as never, issuer: f.issuer || undefined, reference: f.reference || undefined, jurisdictionId: f.jurisdictionId || undefined, monitored: true, monitoringFrequency: f.monitoringFrequency as never, ownerId: f.ownerId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewObligationForm({ members, sources, jurisdictions, pending, run, onDone }: { members: Members; sources: CompliancePayload["sources"]; jurisdictions: CompliancePayload["jurisdictions"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", category: "OTHER", obligationType: "LEGAL", criticality: "MEDIUM", sourceId: "", jurisdictionId: "", ownerId: "", accountableId: "", evaluationFrequency: "ANNUAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título de la obligación" style={input} placeholder="Título de la obligación" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <Picker aria-label="Categoría" style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{["ANTIBRIBERY", "ANTI_MONEY_LAUNDERING", "DATA_PROTECTION", "COMPETITION", "LABOR", "OCCUPATIONAL_SAFETY", "ENVIRONMENTAL", "TAX", "FINANCIAL_REPORTING", "CONSUMER_PROTECTION", "TRADE_SANCTIONS", "INFORMATION_SECURITY", "SECTOR_SPECIFIC", "CORPORATE_GOVERNANCE", "HUMAN_RIGHTS", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Tipo de obligación" style={input} value={f.obligationType} onChange={(e) => set("obligationType", e.target.value)}>{["LEGAL", "REGULATORY", "CONTRACTUAL", "VOLUNTARY_COMMITMENT", "STANDARD", "INTERNAL_POLICY", "LICENSE_CONDITION", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Criticidad" style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Frecuencia de evaluación" style={input} value={f.evaluationFrequency} onChange={(e) => set("evaluationFrequency", e.target.value)}>{["CONTINUOUS", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL", "ON_EVENT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <Picker aria-label="Fuente" style={input} value={f.sourceId} onChange={(e) => set("sourceId", e.target.value)}><option value="">Fuente…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</Picker>
        <Picker aria-label="Jurisdicción" style={input} value={f.jurisdictionId} onChange={(e) => set("jurisdictionId", e.target.value)}><option value="">Jurisdicción…</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Propietario…" ariaLabel="Propietario" style={input} />
        <PersonPicker people={members} value={f.accountableId} onValueChange={(personId) => set("accountableId", personId)} placeholder="Accountable…" ariaLabel="Accountable" style={input} />
      </div>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createComplianceObligation({ title: f.title, category: f.category as never, obligationType: f.obligationType as never, criticality: f.criticality as never, evaluationFrequency: f.evaluationFrequency as never, sourceId: f.sourceId || undefined, jurisdictionId: f.jurisdictionId || undefined, ownerId: f.ownerId || undefined, accountableId: f.accountableId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function ObligationRow({ row, nameOf, jurisdictions, members, can, live, pending, run }: {
  row: CompliancePayload["obligations"][number]; nameOf: (id: string | null | undefined) => string;
  jurisdictions: CompliancePayload["jurisdictions"]; members: Members;
  can: CompliancePayload["can"]; live: boolean; pending: boolean; run: Runner;
}) {
  const [open, setOpen] = useState(false);
  const requestPrompt = usePromptAction();
  const requestChoice = useChoiceAction();
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [decision, setDecision] = useState("APPLICABLE");
  const [rationale, setRationale] = useState("");
  return (
    <>
      <tr>
        <td style={td}>{row.code}</td>
        <td style={td}><b>{row.title}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.articleReference ?? row.requirementText?.slice(0, 90) ?? ""}</div></td>
        <td style={td}>{row.obligationType}</td>
        <td style={td}>{row.jurisdiction?.code ?? "—"}</td>
        <td style={td}>{row.source?.code ?? "—"}</td>
        <td style={td}>
          {APPLICABILITY_LABEL[row.applicability] ?? row.applicability}
          {row.applicabilityRollup.incomplete && <div style={{ color: "var(--nf-warning-text)", fontSize: 11 }}>{row.applicabilityRollup.pending} jurisdicción(es) sin decidir</div>}
        </td>
        <td style={td}><span style={toneChip(STATUS_COLORS[row.complianceStatus] ?? "var(--nf-text-secondary)")}>{STATUS_LABEL[row.complianceStatus] ?? row.complianceStatus}</span></td>
        <td style={td}><span style={toneChip(level(row.criticality))}>{row.criticality}</span></td>
        <td style={td}>{nameOf(row.ownerId)}</td>
        <td style={td}>{fmt(row.nextEvaluationDate)}</td>
        <td style={td}>{row.counts.controls}{row.uncontrolled && <div style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>sin control</div>}</td>
        {live && (can.update || can.create) && <td style={td}><button type="button" className="nf-row-action" data-nf-no-action-icon onClick={() => setOpen((v) => !v)}><Wrench size={13} aria-hidden />{open ? "Ocultar" : "Gestionar"}</button></td>}
      </tr>
      {open && (
        <tr>
          <td className="nf-compliance-obligation-detail-cell" colSpan={12}>
            <div className="nf-compliance-obligation-detail">
              {can.update && (
                <div className="nf-compliance-obligation-evaluation">
                  <div className="nf-compliance-obligation-detail-title"><ShieldCheck size={15} aria-hidden /> Evaluar aplicabilidad por jurisdicción</div>
                  <div className="nf-compliance-obligation-form-grid">
                    <Picker aria-label="Jurisdicción" style={input} value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)}><option value="">Jurisdicción…</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
                    <Picker aria-label="Decisión" style={input} value={decision} onChange={(e) => setDecision(e.target.value)}>{["APPLICABLE", "PARTIALLY_APPLICABLE", "NOT_APPLICABLE", "UNDER_ASSESSMENT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
                    <input aria-label="Motivo de la decisión" style={input} placeholder="Motivo de la decisión" value={rationale} onChange={(e) => setRationale(e.target.value)} />
                    <button type="button" disabled={pending || !jurisdictionId} className="nf-compliance-obligation-save" onClick={() => run(() => assessObligationApplicability({ obligationId: row.id, jurisdictionId, decision: decision as never, rationale: rationale || undefined }))}><Check size={13} aria-hidden /> Guardar</button>
                  </div>
                </div>
              )}
              {can.update && (
                <div className="nf-compliance-obligation-actions">
                  <EditRecordButton title={`Editar obligación ${row.code}`}>{(close) => <EditRecordForm kind="obligation" row={row as unknown as EditRow} members={members} pending={pending} run={run} onDone={close} />}</EditRecordButton>
                  <button disabled={pending} onClick={() => requestPrompt({ title: "Sustituir obligación", label: "ID de la obligación sustituta", placeholder: "Introduce el ID de la obligación vigente…", message: "El ID se obtiene de la exportación o del registro correspondiente.", onConfirm: (supersededById) => run(() => supersedeObligation(row.id, { supersededById })) })} className="nf-row-action" data-nf-no-action-icon><Replace size={14} strokeWidth={2} aria-hidden />Sustituir por versión vigente</button>
                  <button disabled={pending} onClick={() => requestPrompt({ title: "Reasignar propietario", label: "ID del nuevo propietario", placeholder: "Introduce el ID del miembro…", required: false, onConfirm: (ownerId) => { if (ownerId) run(() => updateComplianceObligation(row.id, { ownerId })); } })} className="nf-row-action" data-nf-no-action-icon><UserRoundCog size={14} strokeWidth={2} aria-hidden />Reasignar propietario</button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NewRiskForm({ obligations, members, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", category: "OTHER", obligationId: "", likelihood: 3, impact: 3, reputationalImpact: "MODERATE", treatment: "MITIGATE", ownerId: "" });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título del riesgo" style={input} placeholder="Título del riesgo" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
        <Picker aria-label="Categoría" style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{["ANTIBRIBERY", "ANTI_MONEY_LAUNDERING", "DATA_PROTECTION", "COMPETITION", "LABOR", "OCCUPATIONAL_SAFETY", "ENVIRONMENTAL", "TAX", "FINANCIAL_REPORTING", "CONSUMER_PROTECTION", "TRADE_SANCTIONS", "INFORMATION_SECURITY", "SECTOR_SPECIFIC", "CORPORATE_GOVERNANCE", "HUMAN_RIGHTS", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Probabilidad" style={input} value={f.likelihood} onChange={(e) => set("likelihood", Number(e.target.value))}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Prob. {v}</option>)}</Picker>
        <Picker aria-label="Impacto" style={input} value={f.impact} onChange={(e) => set("impact", Number(e.target.value))}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Impacto {v}</option>)}</Picker>
        <Picker aria-label="Impacto reputacional" style={input} value={f.reputationalImpact} onChange={(e) => set("reputationalImpact", e.target.value)}>{["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "SEVERE"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Tratamiento" style={input} value={f.treatment} onChange={(e) => set("treatment", e.target.value)}>{["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Picker aria-label="Obligación asociada" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación asociada…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Propietario…" ariaLabel="Propietario" style={input} />
      </div>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createComplianceRisk({ title: f.title, category: f.category as never, likelihood: f.likelihood, impact: f.impact, reputationalImpact: f.reputationalImpact as never, treatment: f.treatment as never, obligationId: f.obligationId || undefined, ownerId: f.ownerId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewControlForm({ obligations, risks, members, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; risks: CompliancePayload["risks"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", controlType: "PREVENTIVE", nature: "MANUAL", frequency: "MONTHLY", obligationId: "", riskId: "", ownerId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Nombre del control" style={input} placeholder="Nombre del control" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <Picker aria-label="Tipo de control" style={input} value={f.controlType} onChange={(e) => set("controlType", e.target.value)}>{["PREVENTIVE", "DETECTIVE", "CORRECTIVE", "DIRECTIVE"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Naturaleza" style={input} value={f.nature} onChange={(e) => set("nature", e.target.value)}>{["MANUAL", "AUTOMATED", "HYBRID"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Frecuencia" style={input} value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>{["CONTINUOUS", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL", "ON_EVENT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <Picker aria-label="Obligación" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <Picker aria-label="Riesgo" style={input} value={f.riskId} onChange={(e) => set("riskId", e.target.value)}><option value="">Riesgo…</option>{risks.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Propietario…" ariaLabel="Propietario" style={input} />
      </div>
      <button disabled={pending || !f.name} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createComplianceControl({ name: f.name, controlType: f.controlType as never, nature: f.nature as never, frequency: f.frequency as never, obligationId: f.obligationId || undefined, riskId: f.riskId || undefined, ownerId: f.ownerId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function ControlRow({ row, members, can, live, pending, run }: { row: CompliancePayload["controls"][number]; members: Members; can: CompliancePayload["can"]; live: boolean; pending: boolean; run: Runner }) {
  const [open, setOpen] = useState(false);
  const [designAdequate, setDesignAdequate] = useState(true);
  const [operatingEffective, setOperatingEffective] = useState(true);
  const [effectiveness, setEffectiveness] = useState(80);
  return (
    <>
      <tr>
        <td style={td}>{row.code}</td>
        <td style={td}><b>{row.name}</b>{row.organizationControlId && <div style={{ color: "var(--nf-info-text)", fontSize: 11 }}>reutiliza control ISO 27001</div>}</td>
        <td style={td}>{row.obligation?.code ?? "—"}</td>
        <td style={td}>{row.risk?.code ?? "—"}</td>
        <td style={td}>{row.controlType}</td>
        <td style={td}>{row.nature}</td>
        <td style={td}>{row.frequency}</td>
        <td style={td}>{row.designAdequate === null ? "—" : row.designAdequate ? "Adecuado" : <span style={{ color: "var(--nf-danger-text)" }}>Inadecuado</span>}</td>
        <td style={td}>{row.operatingEffective === null ? "—" : row.operatingEffective ? "Eficaz" : <span style={{ color: "var(--nf-danger-text)" }}>Ineficaz</span>}</td>
        <td style={td}>{row.effectiveness ?? "—"}</td>
        <td style={td}>{fmt(row.lastTestedAt)}</td>
        <td style={td}>{fmt(row.nextTestDate)}</td>
        {live && can.update && <td style={td}><button type="button" className="nf-row-action" onClick={() => setOpen((v) => !v)} data-nf-no-action-icon><ChevronUp size={14} strokeWidth={2} aria-hidden />{open ? "Ocultar" : "Probar"}</button></td>}
      </tr>
      {open && (
        <tr>
          <td style={{ ...td, background: "var(--nf-surface-muted)" }} colSpan={13}>
            <div style={{ display: "grid", gap: 8 }}>
              <EditRecordButton title={`Editar control ${row.code}`}>{(close) => <EditRecordForm kind="control" row={row as unknown as EditRow} members={members} pending={pending} run={run} onDone={close} />}</EditRecordButton>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={designAdequate} onChange={(e) => setDesignAdequate(e.target.checked)} /> Diseño adecuado</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={operatingEffective} onChange={(e) => setOperatingEffective(e.target.checked)} /> Operación eficaz</label>
              <input aria-label="Eficacia 0-100" style={input} type="number" min={0} max={100} value={effectiveness} onChange={(e) => setEffectiveness(Number(e.target.value))} placeholder="Eficacia 0-100" />
              <button disabled={pending} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => run(() => testComplianceControl(row.id, { designAdequate, operatingEffective, effectiveness }))}>Guardar prueba</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NewEvaluationForm({ obligations, controls, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; controls: CompliancePayload["controls"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ obligationId: "", controlId: "", scope: "OBLIGATION", method: "SELF_ASSESSMENT", period: "", result: "NOT_EVALUATED", findings: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Picker aria-label="Obligación" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <Picker aria-label="Control" style={input} value={f.controlId} onChange={(e) => set("controlId", e.target.value)}><option value="">Control…</option>{controls.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Picker>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <Picker aria-label="Alcance" style={input} value={f.scope} onChange={(e) => set("scope", e.target.value)}>{["OBLIGATION", "CONTROL", "PROCESS", "PROGRAM", "THIRD_PARTY"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Método" style={input} value={f.method} onChange={(e) => set("method", e.target.value)}>{["SELF_ASSESSMENT", "MONITORING", "CONTROL_TESTING", "INTERNAL_AUDIT", "EXTERNAL_AUDIT", "AUTHORITY_INSPECTION", "DUE_DILIGENCE"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <input aria-label="Periodo (2026-Q1)" style={input} placeholder="Periodo (2026-Q1)" value={f.period} onChange={(e) => set("period", e.target.value)} />
        <Picker aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}>{["NOT_EVALUATED", "COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <input aria-label="Hallazgos (obligatorio si no cumple)" style={input} placeholder="Hallazgos (obligatorio si no cumple)" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      <button disabled={pending || !f.period} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createComplianceEvaluation({ obligationId: f.obligationId || undefined, controlId: f.controlId || undefined, scope: f.scope as never, method: f.method as never, period: f.period, result: f.result as never, findings: f.findings || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCalendarForm({ obligations, jurisdictions, members, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; jurisdictions: CompliancePayload["jurisdictions"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", dueDate: "", recurrence: "ANNUAL", leadTimeDays: 30, criticality: "MEDIUM", obligationId: "", jurisdictionId: "", responsibleId: "", authority: "" });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título del vencimiento" style={input} placeholder="Título del vencimiento" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <DateField aria-label="Fecha de vencimiento" style={input} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <Picker aria-label="Recurrencia" style={input} value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)}>{["ONCE", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <input aria-label="Aviso previo (días)" style={input} type="number" min={0} max={365} value={f.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} placeholder="Aviso previo (días)" />
        <Picker aria-label="Criticidad" style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <input aria-label="Autoridad" style={input} placeholder="Autoridad" value={f.authority} onChange={(e) => set("authority", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Obligación" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <Picker aria-label="Jurisdicción" style={input} value={f.jurisdictionId} onChange={(e) => set("jurisdictionId", e.target.value)}><option value="">Jurisdicción…</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.responsibleId} onValueChange={(personId) => set("responsibleId", personId)} placeholder="Responsable…" ariaLabel="Responsable" style={input} />
      </div>
      <button disabled={pending || !f.title || !f.dueDate} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createCalendarItem({ title: f.title, dueDate: new Date(f.dueDate).toISOString(), recurrence: f.recurrence as never, leadTimeDays: f.leadTimeDays, criticality: f.criticality as never, obligationId: f.obligationId || undefined, jurisdictionId: f.jurisdictionId || undefined, responsibleId: f.responsibleId || undefined, authority: f.authority || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewChangeForm({ sources, jurisdictions, obligations, pending, run, onDone }: { sources: CompliancePayload["sources"]; jurisdictions: CompliancePayload["jurisdictions"]; obligations: CompliancePayload["obligations"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", changeType: "AMENDMENT", summary: "", sourceId: "", jurisdictionId: "", obligationId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título del cambio" style={input} placeholder="Título del cambio" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <Picker aria-label="Tipo de cambio" style={input} value={f.changeType} onChange={(e) => set("changeType", e.target.value)}>{["NEW_REQUIREMENT", "AMENDMENT", "REPEAL", "INTERPRETATION", "GUIDANCE", "CASE_LAW", "ENFORCEMENT_TREND"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <input aria-label="Resumen" style={input} placeholder="Resumen" value={f.summary} onChange={(e) => set("summary", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Fuente" style={input} value={f.sourceId} onChange={(e) => set("sourceId", e.target.value)}><option value="">Fuente…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</Picker>
        <Picker aria-label="Jurisdicción" style={input} value={f.jurisdictionId} onChange={(e) => set("jurisdictionId", e.target.value)}><option value="">Jurisdicción…</option>{jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}</Picker>
        <Picker aria-label="Obligación afectada" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación afectada…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
      </div>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => registerRegulatoryChange({ title: f.title, changeType: f.changeType as never, summary: f.summary || undefined, sourceId: f.sourceId || undefined, jurisdictionId: f.jurisdictionId || undefined, obligationId: f.obligationId || undefined })); onDone(); }}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function ChangeRow({ row, members, nameOf, can, live, pending, run }: {
  row: CompliancePayload["changes"][number]; members: Members; nameOf: (id: string | null | undefined) => string;
  can: CompliancePayload["can"]; live: boolean; pending: boolean; run: Runner;
}) {
  const [open, setOpen] = useState(false);
  const [impactStatus, setImpactStatus] = useState("ASSESSED");
  const [impactAnalysis, setImpactAnalysis] = useState("");
  const [actionsRequired, setActionsRequired] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  return (
    <>
      <tr>
        <td style={td}>{row.code}</td>
        <td style={td}><b>{row.title}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.summary ?? "—"}</div></td>
        <td style={td}>{row.source?.code ?? "—"}</td>
        <td style={td}>{row.changeType}</td>
        <td style={td}>{fmt(row.detectedAt)}</td>
        <td style={td}>{fmt(row.effectiveFrom)}</td>
        <td style={td}><span style={toneChip(level(row.impactLevel))}>{row.impactLevel}</span></td>
        <td style={td}>{row.impactStatus === "PENDING_ASSESSMENT" ? <span style={chip("var(--nf-warning-border)", "var(--nf-warning-text)")}>Sin analizar</span> : row.impactStatus}</td>
        <td style={td}>{nameOf(row.responsibleId)}</td>
        <td style={td}>{fmt(row.dueDate)}</td>
        <td style={td}>{fmt(row.implementedAt)}</td>
        {live && can.update && <td style={td}><div className="nf-row-actions"><EditRecordButton title={`Editar cambio ${row.code}`}>{(close) => <EditRecordForm kind="change" row={row as unknown as EditRow} members={members} pending={pending} run={run} onDone={close} />}</EditRecordButton><button type="button" className="nf-row-action" onClick={() => setOpen((v) => !v)} data-nf-no-action-icon><ChevronUp size={14} strokeWidth={2} aria-hidden />{open ? "Ocultar" : "Evaluar"}</button></div></td>}
      </tr>
      {open && (
        <tr>
          <td style={{ ...td, background: "var(--nf-surface-muted)" }} colSpan={12}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Picker aria-label="Estado del impacto" style={input} value={impactStatus} onChange={(e) => setImpactStatus(e.target.value)}>{["UNDER_ASSESSMENT", "ASSESSED", "NO_IMPACT", "IMPLEMENTED"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
                <PersonPicker people={members} value={responsibleId} onValueChange={(personId) => setResponsibleId(personId)} placeholder="Responsable…" ariaLabel="Responsable" style={input} />
              </div>
              <input aria-label="Análisis de impacto" style={input} placeholder="Análisis de impacto" value={impactAnalysis} onChange={(e) => setImpactAnalysis(e.target.value)} />
              <input aria-label="Acciones requeridas" style={input} placeholder="Acciones requeridas" value={actionsRequired} onChange={(e) => setActionsRequired(e.target.value)} />
              <button disabled={pending} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => run(() => assessRegulatoryChange(row.id, { impactStatus: impactStatus as never, impactAnalysis: impactAnalysis || undefined, actionsRequired: actionsRequired || undefined, responsibleId: responsibleId || undefined }))}>Guardar evaluación</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NewDeclarationForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ period: "", hasConflict: false, conflictType: "OTHER", description: "", relatedParty: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Periodo (2026)" style={input} placeholder="Periodo (2026)" value={f.period} onChange={(e) => set("period", e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.hasConflict} onChange={(e) => set("hasConflict", e.target.checked)} /> Declaro tener un conflicto de interés</label>
      {f.hasConflict && (
        <>
          <Picker aria-label="Tipo de conflicto" style={input} value={f.conflictType} onChange={(e) => set("conflictType", e.target.value)}>{["FINANCIAL_INTEREST", "FAMILY_RELATIONSHIP", "GIFT_HOSPITALITY", "OUTSIDE_ACTIVITY", "SUPPLIER_RELATIONSHIP", "CUSTOMER_RELATIONSHIP", "PUBLIC_OFFICIAL", "POLITICAL_ACTIVITY", "FORMER_EMPLOYMENT", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
          <input aria-label="Descripción del conflicto" style={input} placeholder="Descripción del conflicto" value={f.description} onChange={(e) => set("description", e.target.value)} />
          <input aria-label="Parte relacionada" style={input} placeholder="Parte relacionada" value={f.relatedParty} onChange={(e) => set("relatedParty", e.target.value)} />
        </>
      )}
      <button disabled={pending || !f.period} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => declareConflictOfInterest({ period: f.period, hasConflict: f.hasConflict, conflictType: f.hasConflict ? (f.conflictType as never) : undefined, description: f.hasConflict ? f.description : undefined, relatedParty: f.relatedParty || undefined, recusalRequired: false })); onDone(); }}><Plus size={12} /> Declarar</button>
    </div>
  );
}

function NewBreachForm({ obligations, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", obligationId: "", detectionSource: "SELF_DETECTED", severity: "MODERATE" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título del incumplimiento" style={input} placeholder="Título del incumplimiento" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Obligación" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <Picker aria-label="Origen de la detección" style={input} value={f.detectionSource} onChange={(e) => set("detectionSource", e.target.value)}>{["SELF_DETECTED", "COMPLIANCE_EVALUATION", "INTERNAL_AUDIT", "EXTERNAL_AUDIT", "SPEAK_UP_REPORT", "INVESTIGATION", "AUTHORITY_INSPECTION", "CUSTOMER_COMPLAINT", "THIRD_PARTY", "MEDIA"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", e.target.value)}>{["MINOR", "MODERATE", "MAJOR", "SEVERE"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => registerComplianceBreach({ title: f.title, description: f.description || undefined, obligationId: f.obligationId || undefined, detectionSource: f.detectionSource as never, severity: f.severity as never, recurrence: false })); onDone(); }}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function NewPlanForm({ breaches, members, pending, run, onDone }: { breaches: CompliancePayload["breaches"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", breachId: "", ownerId: "", dueDate: "", objective: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título del plan" style={input} placeholder="Título del plan" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input aria-label="Objetivo" style={input} placeholder="Objetivo" value={f.objective} onChange={(e) => set("objective", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Incumplimiento" style={input} value={f.breachId} onChange={(e) => set("breachId", e.target.value)}><option value="">Incumplimiento…</option>{breaches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.ownerId} onValueChange={(personId) => set("ownerId", personId)} placeholder="Responsable…" ariaLabel="Responsable" style={input} />
        <DateField aria-label="Fecha de vencimiento" style={input} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
      </div>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createRemediationPlan({ title: f.title, objective: f.objective || undefined, breachId: f.breachId || undefined, ownerId: f.ownerId || undefined, dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewTrainingForm({ obligations, pending, run, onDone }: { obligations: CompliancePayload["obligations"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", topic: "CODE_OF_CONDUCT", obligationId: "", mandatory: true, deliveryMode: "ONLINE", targetCount: 0 });
  const set = (k: string, v: string | boolean | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título de la formación" style={input} placeholder="Título de la formación" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <Picker aria-label="Tema" style={input} value={f.topic} onChange={(e) => set("topic", e.target.value)}>{["CODE_OF_CONDUCT", "ANTIBRIBERY", "ANTI_MONEY_LAUNDERING", "DATA_PROTECTION", "COMPETITION", "CONFLICT_OF_INTEREST", "SPEAK_UP_CHANNEL", "TRADE_SANCTIONS", "INFORMATION_SECURITY", "HUMAN_RIGHTS", "SECTOR_REGULATION", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Modalidad" style={input} value={f.deliveryMode} onChange={(e) => set("deliveryMode", e.target.value)}>{["ONLINE", "CLASSROOM", "BLENDED", "ON_THE_JOB", "SELF_STUDY"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Obligación" style={input} value={f.obligationId} onChange={(e) => set("obligationId", e.target.value)}><option value="">Obligación…</option>{obligations.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</Picker>
        <input aria-label="Audiencia prevista" style={input} type="number" min={0} value={f.targetCount} onChange={(e) => set("targetCount", Number(e.target.value))} placeholder="Audiencia prevista" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.mandatory} onChange={(e) => set("mandatory", e.target.checked)} /> Obligatoria</label>
      <button disabled={pending || !f.title} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => createComplianceTraining({ title: f.title, topic: f.topic as never, deliveryMode: f.deliveryMode as never, mandatory: f.mandatory, obligationId: f.obligationId || undefined, targetCount: f.targetCount || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function TrainingRow({ row, members, can, live, pending, run }: { row: CompliancePayload["trainings"][number]; members: Members; can: CompliancePayload["can"]; live: boolean; pending: boolean; run: Runner }) {
  const [open, setOpen] = useState(false);
  const [completedCount, setCompletedCount] = useState(row.completedCount ?? 0);
  const [passRate, setPassRate] = useState(row.passRate ?? 0);
  return (
    <>
      <tr>
        <td style={td}>{row.code}</td>
        <td style={td}><b>{row.title}</b></td>
        <td style={td}>{row.topic}</td>
        <td style={td}>{row.obligationCode ?? "—"}</td>
        <td style={td}>{row.audience ?? "—"}</td>
        <td style={td}>{row.mandatory ? "Sí" : "No"}</td>
        <td style={td}>{row.deliveryMode}</td>
        <td style={td}>{fmt(row.scheduledFor)}</td>
        <td style={td}>{row.coverage === null ? "—" : `${row.coverage}%`}<div style={{ color: "var(--nf-text-subtle)", fontSize: 11 }}>{row.completedCount ?? 0}/{row.targetCount ?? 0}</div></td>
        <td style={td}>{row.passRate === null ? "—" : `${row.passRate}%`}</td>
        <td style={td}>{row.effectivenessEvaluated ? "Evaluada" : <span style={{ color: "var(--nf-warning-text)" }}>sin evaluar</span>}</td>
        <td style={td}>{fmt(row.nextDueDate)}</td>
        {live && can.update && <td style={td}><button type="button" className="nf-row-action" onClick={() => setOpen((v) => !v)} data-nf-no-action-icon><ChevronUp size={14} strokeWidth={2} aria-hidden />{open ? "Ocultar" : "Registrar"}</button></td>}
      </tr>
      {open && (
        <tr>
          <td style={{ ...td, background: "var(--nf-surface-muted)" }} colSpan={13}>
            <div style={{ display: "grid", gap: 8 }}>
              <EditRecordButton title={`Editar formación ${row.code}`}>{(close) => <EditRecordForm kind="training" row={row as unknown as EditRow} members={members} pending={pending} run={run} onDone={close} />}</EditRecordButton>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input aria-label="Personas formadas" style={input} type="number" min={0} value={completedCount} onChange={(e) => setCompletedCount(Number(e.target.value))} placeholder="Personas formadas" />
              <input aria-label="Aprobados %" style={input} type="number" min={0} max={100} value={passRate} onChange={(e) => setPassRate(Number(e.target.value))} placeholder="Aprobados %" />
              <button disabled={pending} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => run(() => recordTrainingCompletion(row.id, { completedCount, passRate }))}>Guardar</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NewInvestigationForm({ breaches, members, pending, run, onDone }: { breaches: CompliancePayload["breaches"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", breachId: "", leadInvestigatorId: "", confidentiality: "RESTRICTED" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título de la investigación" style={input} placeholder="Título de la investigación" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Incumplimiento" style={input} value={f.breachId} onChange={(e) => set("breachId", e.target.value)}><option value="">Incumplimiento…</option>{breaches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</Picker>
        <PersonPicker people={members} value={f.leadInvestigatorId} onValueChange={(personId) => set("leadInvestigatorId", personId)} placeholder="Investigador principal…" ariaLabel="Investigador principal" style={input} />
        <Picker aria-label="Confidencialidad" style={input} value={f.confidentiality} onChange={(e) => set("confidentiality", e.target.value)}>{["INTERNAL", "RESTRICTED", "CONFIDENTIAL", "STRICTLY_CONFIDENTIAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <button disabled={pending || !f.title || !f.breachId || !f.leadInvestigatorId} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => openInvestigation({ title: f.title, breachId: f.breachId, leadInvestigatorId: f.leadInvestigatorId, confidentiality: f.confidentiality as never })); onDone(); }}><Plus size={12} /> Abrir</button>
    </div>
  );
}

function NewGoverningReportForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", period: "", presentedTo: "BOARD", executiveSummary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Título del informe" style={input} placeholder="Título del informe" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input aria-label="Periodo (2026-Q1)" style={input} placeholder="Periodo (2026-Q1)" value={f.period} onChange={(e) => set("period", e.target.value)} />
        <Picker aria-label="Presentado a" style={input} value={f.presentedTo} onChange={(e) => set("presentedTo", e.target.value)}>{["BOARD", "AUDIT_COMMITTEE", "ETHICS_COMMITTEE", "COMPLIANCE_COMMITTEE", "CEO", "EXECUTIVE_MANAGEMENT"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <input aria-label="Resumen ejecutivo (opcional)" style={input} placeholder="Resumen ejecutivo (opcional)" value={f.executiveSummary} onChange={(e) => set("executiveSummary", e.target.value)} />
      <p style={{ margin: 0, color: "var(--nf-text-subtle)", fontSize: 11 }}>Las secciones de obligaciones, riesgos, canal, investigaciones, formación y remediación se completan automáticamente con el agregado del periodo.</p>
      <button disabled={pending || !f.title || !f.period} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => prepareGoverningBodyReport({ title: f.title, period: f.period, presentedTo: f.presentedTo as never, executiveSummary: f.executiveSummary || undefined })); onDone(); }}><Plus size={12} /> Preparar</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Canal de denuncias
// ─────────────────────────────────────────────────────

function ChannelConfigForm({ current, members, pending, run, onDone }: {
  current: CompliancePayload["channel"]["config"]; members: Members; pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({
    allowAnonymous: current.allowAnonymous, allowConfidential: current.allowConfidential,
    acknowledgementDays: current.acknowledgementDays, feedbackDays: current.feedbackDays, retentionMonths: current.retentionMonths,
    defaultHandlerId: "", alternateHandlerId: "", externalChannelUrl: "",
  });
  const set = (k: string, v: string | number | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.allowAnonymous} onChange={(e) => set("allowAnonymous", e.target.checked)} /> Permitir denuncia anónima</label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.allowConfidential} onChange={(e) => set("allowConfidential", e.target.checked)} /> Permitir denuncia confidencial</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <input aria-label="Plazo de acuse (días)" style={input} type="number" min={1} max={30} value={f.acknowledgementDays} onChange={(e) => set("acknowledgementDays", Number(e.target.value))} placeholder="Plazo de acuse (días)" />
        <input aria-label="Plazo de respuesta (días)" style={input} type="number" min={1} max={365} value={f.feedbackDays} onChange={(e) => set("feedbackDays", Number(e.target.value))} placeholder="Plazo de respuesta (días)" />
        <input aria-label="Retención (meses)" style={input} type="number" min={1} max={240} value={f.retentionMonths} onChange={(e) => set("retentionMonths", Number(e.target.value))} placeholder="Retención (meses)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <PersonPicker people={members} value={f.defaultHandlerId} onValueChange={(personId) => set("defaultHandlerId", personId)} placeholder="Receptor titular…" ariaLabel="Receptor titular" style={input} />
        <PersonPicker people={members} value={f.alternateHandlerId} onValueChange={(personId) => set("alternateHandlerId", personId)} placeholder="Receptor suplente…" ariaLabel="Receptor suplente" style={input} />
      </div>
      <input aria-label="URL del canal externo (opcional)" style={input} placeholder="URL del canal externo (opcional)" value={f.externalChannelUrl} onChange={(e) => set("externalChannelUrl", e.target.value)} />
      <button disabled={pending} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => { run(() => configureSpeakUpChannel({ allowAnonymous: f.allowAnonymous, allowConfidential: f.allowConfidential, acknowledgementDays: f.acknowledgementDays, feedbackDays: f.feedbackDays, retentionMonths: f.retentionMonths, defaultHandlerId: f.defaultHandlerId || undefined, alternateHandlerId: f.alternateHandlerId || undefined, externalChannelUrl: f.externalChannelUrl || undefined })); onDone(); }}>Guardar configuración</button>
    </div>
  );
}

function NewReportForm({ members, allowAnonymous, allowConfidential, pending, run, onDone }: {
  members: Members; allowAnonymous: boolean; allowConfidential: boolean; pending: boolean; run: Runner; onDone: () => void;
}) {
  const requestNotice = useNoticeAction();
  const [f, setF] = useState({
    identificationMode: "IDENTIFIED", category: "OTHER", severity: "MEDIUM", description: "",
    subjectUserId: "", reporterName: "", reporterEmail: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ ...card, background: "var(--nf-surface)", borderColor: "var(--nf-danger-border)", padding: 10, fontSize: 12, color: "var(--nf-danger-text)" }}>
        Su relato y el hecho denunciado quedan protegidos: solo lo ve quien reciba una autorización explícita del caso.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Picker aria-label="Modo de identificación" style={input} value={f.identificationMode} onChange={(e) => set("identificationMode", e.target.value)}>
          <option value="IDENTIFIED">Identificada</option>
          {allowConfidential && <option value="CONFIDENTIAL">Confidencial</option>}
          {allowAnonymous && <option value="ANONYMOUS">Anónima</option>}
        </Picker>
        <Picker aria-label="Categoría" style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{["BRIBERY_CORRUPTION", "FRAUD", "THEFT", "HARASSMENT", "DISCRIMINATION", "RETALIATION", "OCCUPATIONAL_SAFETY", "ENVIRONMENTAL", "DATA_PRIVACY", "INFORMATION_SECURITY", "CONFLICT_OF_INTEREST", "ACCOUNTING_IRREGULARITY", "COMPETITION", "HUMAN_RIGHTS", "POLICY_VIOLATION", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
        <Picker aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
      </div>
      <textarea aria-label="Describa los hechos (mínimo 20 caracteres)" style={{ ...input, minHeight: 70 }} placeholder="Describa los hechos (mínimo 20 caracteres)" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <PersonPicker people={members} value={f.subjectUserId} onValueChange={(personId) => set("subjectUserId", personId)} placeholder="Persona señalada (si aplica)…" ariaLabel="Persona señalada (si aplica)" style={input} />
      {f.identificationMode === "CONFIDENTIAL" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input aria-label="Nombre de contacto" style={input} placeholder="Nombre de contacto" value={f.reporterName} onChange={(e) => set("reporterName", e.target.value)} />
          <input aria-label="Correo de contacto" style={input} placeholder="Correo de contacto" value={f.reporterEmail} onChange={(e) => set("reporterEmail", e.target.value)} />
        </div>
      )}
      <button disabled={pending || f.description.trim().length < 20} className="nf-app-btn-primary nf-app-btn-sm" onClick={() => {
        run(async () => {
          const result = await submitSpeakUpReport({
            identificationMode: f.identificationMode as never, intakeChannel: "WEB_FORM", category: f.category as never,
            severity: f.severity as never, description: f.description, subjectUserId: f.subjectUserId || undefined,
            reporterName: f.reporterName || undefined, reporterEmail: f.reporterEmail || undefined, retaliationRisk: false,
          });
          requestNotice({ title: "Denuncia registrada", message: <>Código de denuncia: <strong>{result.code}</strong><br />Guarde este código de seguimiento; no volverá a mostrarse: <strong>{result.followUpCode}</strong></> });
        });
        onDone();
      }}><Send size={12} /> Presentar denuncia</button>
    </div>
  );
}

function CaseCard({ row, members, can, live, pending, run }: {
  row: CompliancePayload["channel"]["cases"][number]; members: Members; can: CompliancePayload["can"]; live: boolean; pending: boolean; run: Runner;
}) {
  const [open, setOpen] = useState(false);
  const requestPrompt = usePromptAction();
  const requestChoice = useChoiceAction();
  const [accessUserId, setAccessUserId] = useState("");
  const [accessRole, setAccessRole] = useState("INVESTIGATOR");
  const [accessReason, setAccessReason] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b>{row.code}</b> {!row.integrity.valid && <span style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>{row.integrity.problems.join("; ")}</span>}
          <div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>
            {MODE_LABEL[row.identificationMode]} · {row.category} · <span style={toneChip(level(row.severity))}>{row.severity}</span> · recibida {fmt(row.receivedAt)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={chip("var(--nf-primary-subtle)", "var(--nf-primary-active)")}>{CASE_LABEL[row.status] ?? row.status}</span>
          {row.outcome && <span style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{OUTCOME_LABEL[row.outcome]}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--nf-text-secondary)", margin: "8px 0" }}>
        <span>Mi rol: {row.myCaseRole ?? "—"}</span>
        <span>Accesos: {row.access.length}</span>
        <span>Evidencia: {row.evidence.length}</span>
        <span>{row.purgedAt ? "Purgado" : `Retención hasta ${fmt(row.retentionUntil)}`}</span>
        {row.deadlines.acknowledgementOverdue && <span style={{ color: "var(--nf-danger-text)" }}>acuse vencido</span>}
        {row.deadlines.feedbackOverdue && <span style={{ color: "var(--nf-danger-text)" }}>respuesta vencida</span>}
      </div>
      <div className="nf-row-actions">
        {live && can.channelHandle && row.status === "RECEIVED" && (
          <button disabled={pending} onClick={() => run(() => acknowledgeSpeakUpReport(row.id))} className="nf-row-action"><Send size={12} /> Acusar recibo</button>
        )}
        {live && can.channelHandle && row.status === "ACKNOWLEDGED" && (
          <button disabled={pending} onClick={() => run(() => startSpeakUpTriage(row.id))} className="nf-row-action"><ArrowRight size={12} /> Triar</button>
        )}
        {live && can.channelDecide && row.status === "UNDER_TRIAGE" && (
          <>
            <button disabled={pending} onClick={() => requestPrompt({ title: "Admitir denuncia", label: "Motivo de la admisión", placeholder: "Explica por qué se admite…", onConfirm: (rationale) => run(() => decideAdmissibility(row.id, { admissible: true, rationale })) })} className="nf-row-action" data-tone="success"><Check size={12} /> Admitir</button>
            <button disabled={pending} onClick={() => requestPrompt({ title: "Inadmitir denuncia", label: "Motivo de la inadmisión", placeholder: "Explica por qué no procede…", onConfirm: (rationale) => run(() => decideAdmissibility(row.id, { admissible: false, rationale })) })} className="nf-row-action" data-nf-no-action-icon><X size={14} strokeWidth={2} aria-hidden /><X size={12} /> Inadmitir</button>
          </>
        )}
        {live && can.channelHandle && !row.feedbackProvidedAt && row.status !== "RECEIVED" && (
          <button disabled={pending} onClick={() => requestPrompt({ title: "Responder al informante", label: "Respuesta", placeholder: "Escribe la respuesta que recibirá el informante…", onConfirm: (summary) => run(() => provideCaseFeedback(row.id, { summary })) })} className="nf-row-action"><Megaphone size={12} /> Responder</button>
        )}
        {live && (row.status === "ADMISSIBLE" || row.status === "UNDER_INVESTIGATION") && can.channelHandle && (
          <button disabled={pending} onClick={() => requestPrompt({ title: "Abrir investigación", label: "ID del investigador principal", placeholder: "Introduce el ID del investigador…", onConfirm: (leadInvestigatorId) => run(() => openInvestigation({ reportId: row.id, title: `Investigación de ${row.code}`, leadInvestigatorId, confidentiality: "RESTRICTED" })) })} className="nf-row-action"><Search size={12} /> Abrir investigación</button>
        )}
        {live && can.channelDecide && row.status !== "CLOSED" && (
          <button disabled={pending} onClick={() => requestPrompt({ title: "Cerrar caso", label: "Resultado", placeholder: "SUBSTANTIATED, INCONCLUSIVE…", onConfirm: (outcome) => requestPrompt({ title: "Cerrar caso", label: "Resumen del cierre", placeholder: "Resume el resultado de la investigación…", onConfirm: (closureSummary) => run(() => closeSpeakUpCase(row.id, { outcome: outcome as never, closureSummary })) }) })} className="nf-row-action"><CircleOff size={12} /> Cerrar</button>
        )}
        {live && can.channelDecide && (row.outcome === "SUBSTANTIATED" || row.outcome === "PARTIALLY_SUBSTANTIATED") && (
          <button disabled={pending} onClick={() => requestPrompt({ title: "Elevar a incumplimiento", label: "Título del incumplimiento", placeholder: "Describe el incumplimiento…", onConfirm: (title) => requestPrompt({ title: "Elevar a incumplimiento", label: "Descripción del incumplimiento", placeholder: "Detalla los hechos…", onConfirm: (description) => run(() => raiseBreachFromCase(row.id, { title, description, severity: "MAJOR" })) }) })} className="nf-row-action"><AlertTriangle size={12} /> Elevar a incumplimiento</button>
        )}
        {live && can.channelDecide && row.status === "CLOSED" && !row.purgedAt && row.retentionUntil && new Date(row.retentionUntil) <= new Date() && (
          <button disabled={pending} onClick={() => requestChoice({ title: "Purgar denuncia protegida", message: <>Vas a purgar definitivamente el caso <strong>{row.code}</strong>. La retención ya venció; esta acción no se puede deshacer.</>, confirmLabel: "Purgar definitivamente", danger: true, onCancel: () => {}, onConfirm: () => run(() => purgeSpeakUpCase(row.id, {})) })} className="nf-row-action"><EyeOff size={12} /> Purgar</button>
        )}
        {can.channelDecide && <button type="button" className="nf-row-action" onClick={() => setOpen((v) => !v)} data-nf-no-action-icon><ChevronUp size={14} strokeWidth={2} aria-hidden />{open ? "Ocultar accesos/evidencia" : "Accesos y evidencia"}</button>}
      </div>
      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
          <div>
            <b style={{ fontSize: 12.5 }}>Autorizar acceso al caso</b>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 8, marginTop: 6 }}>
              <PersonPicker people={members} value={accessUserId} onValueChange={(personId) => setAccessUserId(personId)} placeholder="Persona…" ariaLabel="Persona" style={input} />
              <Picker aria-label="Rol de acceso" style={input} value={accessRole} onChange={(e) => setAccessRole(e.target.value)}>{["TRIAGE", "INVESTIGATOR", "REVIEWER", "LEGAL_COUNSEL", "DECISION_MAKER", "OBSERVER"].map((v) => <option key={v} value={v}>{v}</option>)}</Picker>
              <input aria-label="Motivo (necesidad de conocer)" style={input} placeholder="Motivo (necesidad de conocer)" value={accessReason} onChange={(e) => setAccessReason(e.target.value)} />
              <button disabled={pending || !accessUserId || !accessReason} className="nf-row-action" onClick={() => run(() => grantCaseAccess({ reportId: row.id, userId: accessUserId, caseRole: accessRole as never, reason: accessReason }))} data-nf-no-action-icon><Check size={14} strokeWidth={2} aria-hidden />Autorizar</button>
            </div>
            {row.access.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "var(--nf-text-secondary)" }}>
                <span>{members.find((m) => m.id === a.userId)?.name ?? a.userId} · {a.caseRole}</span>
                <button disabled={pending} onClick={() => requestPrompt({ title: "Revocar acceso al caso", label: "Motivo de la revocación", placeholder: "Explica por qué se revoca el acceso…", onConfirm: (reason) => run(() => revokeCaseAccess(a.id, { reason })) })} className="nf-row-action" style={{ padding: "2px 6px", fontSize: 11 }} data-nf-no-action-icon><Ban size={14} strokeWidth={2} aria-hidden />Revocar</button>
              </div>
            ))}
          </div>
          <div>
            <b style={{ fontSize: 12.5 }}>Añadir evidencia protegida</b>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr auto", gap: 8, marginTop: 6 }}>
              <input aria-label="Título de la evidencia" style={input} placeholder="Título de la evidencia" value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} />
              <input aria-label="URL del archivo (opcional)" style={input} placeholder="URL del archivo (opcional)" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
              <button disabled={pending || !evidenceTitle} className="nf-row-action" onClick={() => run(() => addProtectedEvidence({ reportId: row.id, title: evidenceTitle, fileUrl: evidenceUrl || undefined }))} data-nf-no-action-icon><Plus size={14} strokeWidth={2} aria-hidden />Añadir</button>
            </div>
            {row.evidence.map((e) => <div key={e.id} style={{ fontSize: 12, color: "var(--nf-text-secondary)", padding: "3px 0" }}>{e.code} · {e.title}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
