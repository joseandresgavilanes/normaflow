"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldBan, LayoutDashboard, AlertTriangle, Handshake, SearchCheck, Users,
  Gift, HeartHandshake, UserX, Banknote, ShieldCheck, BadgeCheck, ScrollText, Siren,
  ArrowRight, Check, X, Plus,
} from "lucide-react";
import type { AntibriberyPayload } from "@/lib/antibribery/queries";
import {
  approveBriberyRiskAssessment,
  transitionDueDiligence,
  transitionGiftHospitality,
  decideDonationSponsorship,
  reviewAbmsConflict,
  transitionHighRiskApproval,
  reviewFacilitationPayment,
  verifyBeneficialOwner,
  createBriberyRiskAssessment,
  createBusinessAssociate,
  createDueDiligenceCase,
  createBeneficialOwner,
  submitGiftHospitality,
  createDonationSponsorship,
  declareAbmsConflict,
  reportFacilitationPayment,
  recordFinancialControlTest,
  recordNonFinancialControlTest,
  requestHighRiskApproval,
  recordAntiBriberyCommitment,
  linkAntiBriberyInvestigation,
  closeAntiBriberyInvestigation,
} from "@/lib/actions/antibribery";
import type { DueDiligenceStatus, GiftHospitalityStatus, HighRiskApprovalStatus } from "@prisma/client";
import { nextDueDiligenceStatuses } from "@/lib/antibribery/due-diligence";
import { nextGiftStatuses } from "@/lib/antibribery/gifts";
import { nextHighRiskStatuses } from "@/lib/antibribery/approvals";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";

type Tab =
  | "panel" | "risks" | "associates" | "due-diligence" | "owners" | "gifts"
  | "donations" | "conflicts" | "facilitation" | "controls" | "approvals"
  | "commitments" | "investigations";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Sistema de Gestión Antisoborno", sub: "ISO 37001:2016 — visión general de riesgos, terceros, debida diligencia, controles e investigaciones." },
  risks: { title: "Riesgos de soborno", sub: "Evaluaciones de riesgo inherente y residual por proceso, país, sector y tercero." },
  associates: { title: "Socios de negocio", sub: "Terceros, clasificación de riesgo y relación con la organización." },
  "due-diligence": { title: "Debida diligencia", sub: "Revisiones iniciales, reforzadas y periódicas de socios de negocio." },
  owners: { title: "Beneficiarios finales", sub: "Beneficiarios, PEP y trazabilidad de la propiedad de terceros." },
  gifts: { title: "Regalos y hospitalidad", sub: "Solicitudes, revisiones y decisiones sobre regalos y hospitalidad." },
  donations: { title: "Donaciones y patrocinios", sub: "Operaciones, revisión de conflictos y aprobación de donaciones." },
  conflicts: { title: "Conflictos de interés", sub: "Declaraciones, recusaciones y decisiones sobre conflictos." },
  facilitation: { title: "Pagos de facilitación", sub: "Reportes, revisión y cierre de pagos de facilitación." },
  controls: { title: "Controles antisoborno", sub: "Pruebas financieras y no financieras, resultados y evidencias." },
  approvals: { title: "Aprobaciones de alto riesgo", sub: "Solicitudes y decisiones para operaciones de alto riesgo." },
  commitments: { title: "Compromisos antisoborno", sub: "Compromisos, responsables y seguimiento de su vigencia." },
  investigations: { title: "Investigaciones", sub: "Investigaciones enlazadas a señales, terceros y casos antisoborno." },
};

const LEVEL_COLORS: Record<string, string> = {
  LOW: "var(--nf-success)", MEDIUM: "var(--nf-warning)", MODERATE: "var(--nf-warning)", HIGH: "var(--nf-warning)", CRITICAL: "var(--nf-danger-text)",
};
const DD_LABEL: Record<string, string> = {
  DRAFT: "Borrador", SCREENING: "Screening", REVIEW: "Revisión", ENHANCED_REVIEW: "Revisión reforzada",
  APPROVED: "Aprobada", REJECTED: "Rechazada", PERIODIC_REVIEW: "Revisión periódica",
};
const GIFT_LABEL: Record<string, string> = {
  SUBMITTED: "Enviada", MANAGER_REVIEW: "Revisión manager", COMPLIANCE_REVIEW: "Revisión compliance",
  APPROVED: "Aprobada", REJECTED: "Rechazada",
};
const HR_LABEL: Record<string, string> = {
  REQUESTED: "Solicitada", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELLED: "Cancelada",
};

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--nf-text-secondary)", borderBottom: "1px solid var(--nf-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #9f1239", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const okBtn: React.CSSProperties = { ...miniBtn, borderColor: "var(--nf-success)", background: "var(--nf-success-subtle)", color: "var(--nf-success-text)" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const money = (v: number | null | undefined, c?: string | null) => (typeof v === "number" ? `${v.toLocaleString("es-ES")}${c ? ` ${c}` : ""}` : "—");
const level = (value: string) => LEVEL_COLORS[value] ?? "var(--nf-text-secondary)";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "var(--nf-text-on-primary)", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Associates = AntibriberyPayload["associates"];

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
          <div className="nf-iso-create-fields">{children(closeAfterSuccess)}</div>
          <div className="nf-modal-actions nf-iso-create-form-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={close}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function AntibriberyClient({ initial, demo = false }: { initial: AntibriberyPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); router.refresh(); window.dispatchEvent(new Event("normaflow:server-action-success")); } catch (e) { const message = e instanceof Error ? e.message : "Error inesperado."; setError(message); window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } })); }
    });
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--nf-danger-subtle)", display: "grid", placeItems: "center" }}>
          <ShieldBan size={22} color="#9f1239" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{SECTION_META[tab].title}</h1>
          <p style={{ margin: 0, color: "var(--nf-text-secondary)", fontSize: 13 }}>
            {SECTION_META[tab].sub}
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "var(--nf-danger-border)", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Evaluaciones" value={s.assessments} />
        <Stat label="Riesgo residual alto" value={s.highResidual} accent={s.highResidual ? "var(--nf-danger-text)" : undefined} />
        <Stat label="Terceros" value={s.associates} />
        <Stat label="DD abiertas" value={s.dueDiligenceOpen} accent={s.dueDiligenceOpen ? "#d68a1a" : undefined} />
        <Stat label="Regalos pendientes" value={s.giftsPending} accent={s.giftsPending ? "#d68a1a" : undefined} />
        <Stat label="Investigaciones abiertas" value={s.investigationsOpen} accent={s.investigationsOpen ? "#ea580c" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "risks" ? [{ label: "Evaluaciones", value: s.assessments }, { label: "Riesgo residual alto", value: s.highResidual, accent: s.highResidual ? "var(--nf-danger-text)" : undefined }, { label: "Aprobadas", value: s.assessmentsApproved }] : tab === "associates" ? [{ label: "Socios de negocio", value: s.associates }, { label: "Riesgo alto/crítico", value: s.highRiskAssociates, accent: s.highRiskAssociates ? "#ea580c" : undefined }, { label: "Debida diligencia abierta", value: s.dueDiligenceOpen, accent: s.dueDiligenceOpen ? "#d68a1a" : undefined }] : tab === "due-diligence" ? [{ label: "Casos abiertos", value: s.dueDiligenceOpen, accent: s.dueDiligenceOpen ? "#d68a1a" : undefined }, { label: "Vencidos", value: s.dueDiligenceOverdue, accent: s.dueDiligenceOverdue ? "var(--nf-danger-text)" : undefined }, { label: "Socios evaluados", value: s.associates }] : tab === "owners" ? [{ label: "Beneficiarios finales", value: initial.owners.length }, { label: "PEP", value: s.pepOwners, accent: s.pepOwners ? "#ea580c" : undefined }, { label: "Socios de negocio", value: s.associates }] : tab === "gifts" ? [{ label: "Regalos pendientes", value: s.giftsPending, accent: s.giftsPending ? "#d68a1a" : undefined }, { label: "Regalos registrados", value: initial.gifts.length }, { label: "Socios relacionados", value: s.associates }] : tab === "donations" ? [{ label: "Donaciones", value: initial.donations.length }, { label: "Políticas", value: s.donationsPolitical, accent: s.donationsPolitical ? "#d68a1a" : undefined }, { label: "Pendientes", value: initial.donations.filter((row) => !["APPROVED", "REJECTED"].includes(row.status)).length, accent: "var(--nf-warning)" }] : tab === "conflicts" ? [{ label: "Declaraciones", value: initial.conflicts.length }, { label: "Pendientes", value: initial.conflicts.filter((row) => row.reviewStatus === "PENDING").length, accent: "var(--nf-warning)" }, { label: "Socios relacionados", value: s.associates }] : tab === "facilitation" ? [{ label: "Pagos abiertos", value: s.facilitationOpen, accent: s.facilitationOpen ? "var(--nf-danger-text)" : undefined }, { label: "Reportes", value: initial.facilitation.length }, { label: "Investigaciones", value: s.investigationsOpen, accent: s.investigationsOpen ? "#ea580c" : undefined }] : tab === "controls" ? [{ label: "Pruebas financieras", value: initial.financialTests.length }, { label: "Pruebas no financieras", value: initial.nonFinancialTests.length }, { label: "Fallos de control", value: s.controlFailures, accent: s.controlFailures ? "var(--nf-danger-text)" : undefined }] : tab === "approvals" ? [{ label: "Aprobaciones pendientes", value: s.highRiskPending, accent: s.highRiskPending ? "#d68a1a" : undefined }, { label: "Operaciones alto riesgo", value: initial.highRisk.length }, { label: "Socios", value: s.associates }] : tab === "commitments" ? [{ label: "Compromisos", value: s.commitments }, { label: "Socios relacionados", value: s.associates }, { label: "Investigaciones", value: s.investigationsOpen, accent: s.investigationsOpen ? "#ea580c" : undefined }] : [{ label: "Investigaciones", value: initial.investigations.length }, { label: "Abiertas", value: s.investigationsOpen, accent: s.investigationsOpen ? "#ea580c" : undefined }, { label: "Socios relacionados", value: s.associates }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen antisoborno</strong><span>Accesos directos para gestionar controles y terceros.</span></div><IsoQuickCreate modulePath="/app/antibribery" items={[{ label: "Nueva evaluación de riesgo", description: "Evaluar riesgo de soborno", section: "risks", Icon: AlertTriangle }, { label: "Nuevo socio de negocio", description: "Registrar un tercero", section: "associates", Icon: Handshake }, { label: "Nueva debida diligencia", description: "Abrir una revisión", section: "due-diligence", Icon: SearchCheck }, { label: "Nuevo regalo / hospitalidad", description: "Registrar una operación", section: "gifts", Icon: Gift }, { label: "Nueva donación / patrocinio", description: "Registrar donación", section: "donations", Icon: HeartHandshake }, { label: "Nueva declaración de conflicto", description: "Declarar conflicto", section: "conflicts", Icon: UserX }, { label: "Nueva prueba financiera", description: "Registrar prueba de control", section: "controls", Icon: ShieldCheck }, { label: "Nuevo compromiso antisoborno", description: "Registrar compromiso", section: "commitments", Icon: ScrollText }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><AlertTriangle size={16} aria-hidden />Riesgo de soborno (§4.5)</h3>
            <Row k="Evaluaciones" v={s.assessments} />
            <Row k="Aprobadas" v={s.assessmentsApproved} />
            <Row k="Residual alto/crítico" v={s.highResidual} danger={s.highResidual > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>Reutiliza la mecánica de ComplianceRisk; añade uplift de país, sector, funcionario y terceros.</p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Handshake size={16} aria-hidden />Terceros y UBO (§8.2)</h3>
            <Row k="Socios de negocio" v={s.associates} />
            <Row k="Riesgo alto/crítico" v={s.highRiskAssociates} danger={s.highRiskAssociates > 0} />
            <Row k="Debidas diligencias abiertas" v={s.dueDiligenceOpen} danger={s.dueDiligenceOpen > 0} />
            <Row k="Revisiones periódicas vencidas" v={s.dueDiligenceOverdue} danger={s.dueDiligenceOverdue > 0} />
            <Row k="Beneficiarios PEP" v={s.pepOwners} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Gift size={16} aria-hidden />Regalos, donaciones y conflictos (§8.7)</h3>
            <Row k="Regalos pendientes" v={s.giftsPending} danger={s.giftsPending > 0} />
            <Row k="Donaciones políticas" v={s.donationsPolitical} />
            <Row k="Pagos de facilitación abiertos" v={s.facilitationOpen} danger={s.facilitationOpen > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>SUBMITTED → MANAGER_REVIEW → COMPLIANCE_REVIEW → APPROVED|REJECTED.</p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><ShieldCheck size={16} aria-hidden />Controles, aprobaciones e investigación</h3>
            <Row k="Fallos de control" v={s.controlFailures} danger={s.controlFailures > 0} />
            <Row k="Operaciones pendientes" v={s.highRiskPending} danger={s.highRiskPending > 0} />
            <Row k="Compromisos" v={s.commitments} />
            <Row k="Investigaciones abiertas" v={s.investigationsOpen} danger={s.investigationsOpen > 0} />
            <p style={{ margin: "8px 0 0", color: "var(--nf-text-subtle)", fontSize: 12 }}>Las investigaciones son un puente a Investigation del SGC; el canal de denuncias no se duplica.</p>
          </div>
          </div>
        </>
      )}

      {tab === "risks" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nueva evaluación de riesgo">{(close) => <NewAssessmentForm pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Evaluación", "Inherente", "Residual", "País", "Sector", "Funcionario", "Estado", "Acciones"]}>
          {initial.assessments.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.scope ?? ""}</div></td>
              <td style={td}><span style={chip("var(--nf-surface-muted)", level(row.inherentLevel))}>{row.inherentScore} · {row.inherentLevel}</span></td>
              <td style={td}><span style={chip("var(--nf-surface-muted)", level(row.residualLevel ?? "MEDIUM"))}>{row.residualScore ?? "—"} · {row.residualLevel ?? "—"}</span></td>
              <td style={td}>{row.countryRisk}</td>
              <td style={td}>{row.sectorRisk}</td>
              <td style={td}>{row.publicOfficialRisk ? "Sí" : "No"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>
                {live && can.approve && row.status !== "APPROVED" && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => approveBriberyRiskAssessment(row.id))}>
                    <Check size={12} /> Aprobar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "associates" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nuevo socio de negocio">{(close) => <NewAssociateForm pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Nombre", "Tipo", "País", "Riesgo", "PEP", "Screening", "UBO", "DD", "Estado"]}>
          {initial.associates.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.name}</b></td>
              <td style={td}>{row.associateType}</td>
              <td style={td}>{row.country ?? "—"}</td>
              <td style={td}><span style={chip("var(--nf-surface-muted)", level(row.riskTier))}>{row.riskTier}</span></td>
              <td style={td}>{row.isPublicOfficial || row.interactsWithPEPs ? "Sí" : "No"}</td>
              <td style={td}>{row.sanctionedScreen}</td>
              <td style={td}>{row._count.beneficialOwners}</td>
              <td style={td}>{row._count.dueDiligence}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "due-diligence" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nueva debida diligencia">{(close) => <NewDueDiligenceForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Socio", "Nivel", "Estado", "Screening", "Reforzada", "Próxima revisión", "Acciones"]}>
          {initial.dueDiligence.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.associate.code}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.associate.name}</div></td>
              <td style={td}>{row.level}</td>
              <td style={td}><span style={chip("var(--nf-surface-muted)", "#334155")}>{DD_LABEL[row.status] ?? row.status}</span></td>
              <td style={td}>{row.screeningResult}</td>
              <td style={td}>{row.enhancedRequired ? "Obligatoria" : "No"}</td>
              <td style={td}>{fmt(row.nextReviewDate)}</td>
              <td style={td}>
                {live && (can.update || can.approve) && nextDueDiligenceStatuses(row.status).map((to) => (
                  <button
                    key={to}
                    disabled={pending}
                    style={to === "APPROVED" ? okBtn : to === "REJECTED" ? miniBtn : { ...miniBtn, borderColor: "var(--nf-text-secondary)", background: "var(--nf-surface-muted)", color: "var(--nf-text-secondary)", marginRight: 4 }}
                    onClick={() => run(() => transitionDueDiligence(row.id, {
                      to: to as DueDiligenceStatus,
                      rejectionReason: to === "REJECTED" ? "Riesgo residual inaceptable / screening adverso" : undefined,
                      nextReviewDate: to === "APPROVED" ? new Date(Date.now() + 365 * 86400000).toISOString() : undefined,
                    }))}
                  >
                    <ArrowRight size={12} /> {DD_LABEL[to] ?? to}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "owners" && (
        s.sensitiveLocked ? (
          <div style={{ ...card, borderColor: "var(--nf-warning-border)", background: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)" }}>
            Beneficiarios finales bloqueado: se requiere <strong>antibribery-sensitive:read</strong> para ver UBO y condición PEP de terceros.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
          {live && can.sensitiveCreate && <NewFormToggle label="Nuevo beneficiario final">{(close) => <NewOwnerForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
          <Table head={["Código", "Socio", "Beneficiario", "%", "Control", "PEP", "Verificado", "Acciones"]}>
            {initial.owners.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.associate.code}</td>
                <td style={td}><b>{row.fullName}</b></td>
                <td style={td}>{row.ownershipPercent ?? "—"}</td>
                <td style={td}>{row.controlType}</td>
                <td style={td}>{row.isPep ? row.pepRole ?? "Sí" : "No"}</td>
                <td style={td}>{fmt(row.verifiedAt)}</td>
                <td style={td}>
                  {live && can.sensitiveUpdate && !row.verifiedAt && (
                    <button disabled={pending} style={okBtn} onClick={() => run(() => verifyBeneficialOwner(row.id))}>
                      <Check size={12} /> Verificar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          </div>
        )
      )}

      {tab === "gifts" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nuevo regalo / hospitalidad">{(close) => <NewGiftForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Tipo", "Descripción", "Valor", "Funcionario", "Estado", "Compliance", "Acciones"]}>
          {initial.gifts.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.recordType} · {row.direction}</td>
              <td style={td}><b>{row.description}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.counterpartyName ?? row.associate?.name ?? ""}</div></td>
              <td style={td}>{money(row.estimatedValue, row.currency)}{row.requiresCompliance ? <div style={{ color: "var(--nf-danger-text)", fontSize: 11 }}>Exige compliance</div> : null}</td>
              <td style={td}>{row.involvesPublicOfficial ? "Sí" : "No"}</td>
              <td style={td}>{GIFT_LABEL[row.status] ?? row.status}</td>
              <td style={td}>{nameOf(row.complianceReviewerId)}</td>
              <td style={td}>
                {live && nextGiftStatuses(row.status).map((to) => {
                  const needsApprove = to === "APPROVED" || to === "REJECTED" || to === "COMPLIANCE_REVIEW";
                  if (needsApprove && !can.approve) return null;
                  if (!needsApprove && !can.update) return null;
                  return (
                    <button
                      key={to}
                      disabled={pending}
                      style={to === "APPROVED" ? okBtn : to === "REJECTED" ? miniBtn : { ...miniBtn, borderColor: "var(--nf-text-secondary)", background: "var(--nf-surface-muted)", color: "var(--nf-text-secondary)", marginRight: 4 }}
                      onClick={() => run(() => transitionGiftHospitality(row.id, {
                        to: to as GiftHospitalityStatus,
                        rejectionReason: to === "REJECTED" ? "Fuera de política / riesgo de soborno" : undefined,
                        note: `Transición a ${to}`,
                      }))}
                    >
                      <ArrowRight size={12} /> {GIFT_LABEL[to] ?? to}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "donations" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nueva donación / patrocinio">{(close) => <NewDonationForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Tipo", "Beneficiario", "Importe", "Política", "Estado", "Acciones"]}>
          {initial.donations.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.recordType}</td>
              <td style={td}><b>{row.beneficiaryName}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.purpose ?? ""}</div></td>
              <td style={td}>{money(row.amount, row.currency)}</td>
              <td style={td}>{row.politicalDonation ? "Sí" : "No"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>
                {live && can.approve && (row.status === "PROPOSED" || row.status === "UNDER_REVIEW") && (
                  <>
                    <button disabled={pending} style={okBtn} onClick={() => run(() => decideDonationSponsorship(row.id, { decision: "APPROVED" }))}><Check size={12} /> Aprobar</button>{" "}
                    <button disabled={pending} style={miniBtn} onClick={() => run(() => decideDonationSponsorship(row.id, { decision: "REJECTED", rejectionReason: "No alineada con política antisoborno" }))}><X size={12} /> Rechazar</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "conflicts" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nueva declaración de conflicto">{(close) => <NewConflictForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Declarante", "Periodo", "Conflicto", "Naturaleza", "Abstención", "Revisión", "Acciones"]}>
          {initial.conflicts.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{nameOf(row.declarantId)}</td>
              <td style={td}>{row.period}</td>
              <td style={td}>{row.hasConflict ? "Sí" : "No"}</td>
              <td style={td}>{row.conflictNature}</td>
              <td style={td}>{row.recusalRequired ? "Sí" : "No"}</td>
              <td style={td}>{row.reviewStatus}</td>
              <td style={td}>
                {live && can.approve && row.reviewStatus === "PENDING" && row.hasConflict && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => reviewAbmsConflict(row.id, { decision: "MITIGATED", mitigationMeasures: "Abstención en decisiones del tercero", recusalRequired: true }))}>
                    Mitigar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "facilitation" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nuevo pago de facilitación">{(close) => <NewFacilitationForm pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Descripción", "Importe", "País", "Coaccionado", "Estado", "Acciones"]}>
          {initial.facilitation.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.description}</td>
              <td style={td}>{money(row.amount, row.currency)}</td>
              <td style={td}>{row.country ?? "—"}</td>
              <td style={td}>{row.coerced ? "Sí" : "No"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>
                {live && can.update && row.status === "REPORTED" && (
                  <button disabled={pending} style={miniBtn} onClick={() => run(() => reviewFacilitationPayment(row.id, { status: "UNDER_REVIEW" }))}>Revisar</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "controls" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <NewFormToggle label="Nueva prueba financiera">{(close) => <NewControlTestForm kind="financial" pending={pending} run={run} onDone={close} />}</NewFormToggle>
            <NewFormToggle label="Nueva prueba no financiera">{(close) => <NewControlTestForm kind="nonFinancial" pending={pending} run={run} onDone={close} />}</NewFormToggle>
          </div>
        )}
        <Table head={["Ámbito", "Código", "Control", "Periodo", "Diseño", "Operación", "Excepciones", "Estado"]}>
          {[
            ...initial.financialTests.map((row) => ({ ...row, ambito: "Financiero", area: "FINANCIAL" })),
            ...initial.nonFinancialTests.map((row) => ({ ...row, ambito: "No financiero", area: row.controlArea })),
          ].map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.ambito}</td>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{row.area}</div></td>
              <td style={td}>{row.period}</td>
              <td style={td}>{row.designAdequate === null ? "—" : row.designAdequate ? "OK" : "Falla"}</td>
              <td style={td}>{row.operatingEffective === null ? "—" : row.operatingEffective ? "OK" : "Falla"}</td>
              <td style={td}>{row.exceptionsFound}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "approvals" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nueva operación de alto riesgo">{(close) => <NewHighRiskForm associates={initial.associates} dueDiligence={initial.dueDiligence} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Operación", "Tipo", "Importe", "Funcionario", "Estado", "Acciones"]}>
          {initial.highRisk.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b></td>
              <td style={td}>{row.transactionType}</td>
              <td style={td}>{money(row.amount, row.currency)}</td>
              <td style={td}>{row.involvesPublicOfficial ? "Sí" : "No"}</td>
              <td style={td}>{HR_LABEL[row.status] ?? row.status}</td>
              <td style={td}>
                {live && nextHighRiskStatuses(row.status).map((to) => {
                  if ((to === "APPROVED" || to === "REJECTED") && !can.approve) return null;
                  if (!(to === "APPROVED" || to === "REJECTED") && !can.update) return null;
                  return (
                    <button
                      key={to}
                      disabled={pending}
                      style={to === "APPROVED" ? okBtn : miniBtn}
                      onClick={() => run(() => transitionHighRiskApproval(row.id, {
                        to: to as HighRiskApprovalStatus,
                        rejectionReason: to === "REJECTED" ? "Riesgo de soborno inaceptable" : undefined,
                      }))}
                    >
                      {HR_LABEL[to] ?? to}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "commitments" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nuevo compromiso antisoborno">{(close) => <NewCommitmentForm associates={initial.associates} members={initial.members} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Tipo", "Sujeto", "Fecha", "Versión", "Vence"]}>
          {initial.commitments.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.commitmentType}</td>
              <td style={td}>{row.subjectName || (row.subjectUserId ? nameOf(row.subjectUserId) : null) || row.associate?.name || "—"}</td>
              <td style={td}>{fmt(row.committedAt)}</td>
              <td style={td}>{row.version}</td>
              <td style={td}>{fmt(row.expiresAt)}</td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {tab === "investigations" && (
        <div style={{ display: "grid", gap: 14 }}>
        {live && can.create && <NewFormToggle label="Nuevo puente a investigación">{(close) => <NewInvestigationForm associates={initial.associates} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
        <Table head={["Código", "Investigation", "Alegación", "Funcionario", "Estado", "Resultado", "CAPA", "Acciones"]}>
          {initial.investigations.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{row.investigationId}</td>
              <td style={td}>{row.allegationType}</td>
              <td style={td}>{row.involvesPublicOfficial ? "Sí" : "No"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>{row.outcome ?? "—"}</td>
              <td style={td}>{row.capaId ?? "—"}</td>
              <td style={td}>
                {live && can.approve && (row.status === "OPEN" || row.status === "ACTIVE") && (
                  <CloseInvestigationControl id={row.id} pending={pending} run={run} />
                )}
              </td>
            </tr>
          ))}
        </Table>
        </div>
      )}

      {!initial.conflictsComplete && tab === "conflicts" && (
        <p style={{ color: "var(--nf-text-subtle)", fontSize: 12 }}>Solo ves tus propias declaraciones ABMS. Quien aprueba compliance ve el registro completo.</p>
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return <IsoMetricCard label={label} value={value} suffix={suffix} accent={accent} />;
}

function Row({ k, v, suffix, danger }: { k: string; v: string | number; suffix?: string; danger?: boolean }) {
  return (
    <div className="nf-iso-dashboard-row">
      <span className="nf-iso-dashboard-row-label">{k}</span>
      <b className="nf-iso-dashboard-row-value" style={{ color: danger ? "var(--nf-danger-text)" : undefined }}>{v}{suffix ?? ""}</b>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <IsoTableCard headers={head}>{children}</IsoTableCard>;
}

// ─── Forms ────────────────────────────────────────────

function NewAssessmentForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    title: "", scope: "", inherentLikelihood: "3", inherentImpact: "3",
    countryRisk: "MODERATE" as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    sectorRisk: "MODERATE" as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    publicOfficialRisk: false, thirdPartyRisk: false,
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título de la evaluación" style={input} placeholder="Título de la evaluación" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input aria-label="Alcance" style={input} placeholder="Alcance" value={f.scope} onChange={(e) => set("scope", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Probabilidad" style={input} type="number" min={1} max={5} placeholder="Probabilidad" value={f.inherentLikelihood} onChange={(e) => set("inherentLikelihood", e.target.value)} />
        <input aria-label="Impacto" style={input} type="number" min={1} max={5} placeholder="Impacto" value={f.inherentImpact} onChange={(e) => set("inherentImpact", e.target.value)} />
        <select aria-label="Riesgo país" style={input} value={f.countryRisk} onChange={(e) => set("countryRisk", e.target.value)}><option value="LOW">País: bajo</option><option value="MODERATE">País: moderado</option><option value="HIGH">País: alto</option><option value="CRITICAL">País: crítico</option></select>
        <select aria-label="Riesgo sectorial" style={input} value={f.sectorRisk} onChange={(e) => set("sectorRisk", e.target.value)}><option value="LOW">Sector: bajo</option><option value="MODERATE">Sector: moderado</option><option value="HIGH">Sector: alto</option><option value="CRITICAL">Sector: crítico</option></select>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.publicOfficialRisk} onChange={(e) => set("publicOfficialRisk", e.target.checked)} /> Involucra funcionario público</label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.thirdPartyRisk} onChange={(e) => set("thirdPartyRisk", e.target.checked)} /> Involucra terceros</label>
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createBriberyRiskAssessment({ title: f.title, scope: f.scope || undefined, inherentLikelihood: Number(f.inherentLikelihood), inherentImpact: Number(f.inherentImpact), countryRisk: f.countryRisk, sectorRisk: f.sectorRisk, publicOfficialRisk: f.publicOfficialRisk, thirdPartyRisk: f.thirdPartyRisk, treatment: "MITIGATE" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewAssociateForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    name: "", associateType: "SUPPLIER" as "SUPPLIER" | "AGENT" | "INTERMEDIARY" | "DISTRIBUTOR" | "JOINT_VENTURE" | "CONSULTANT" | "CUSTOMER" | "PUBLIC_BODY" | "NGO" | "OTHER",
    country: "", riskTier: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", isPublicOfficial: false, interactsWithPEPs: false,
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del socio" style={input} placeholder="Nombre del socio" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Tipo de asociado" style={input} value={f.associateType} onChange={(e) => set("associateType", e.target.value)}>
          <option value="SUPPLIER">Proveedor</option><option value="AGENT">Agente</option><option value="INTERMEDIARY">Intermediario</option>
          <option value="DISTRIBUTOR">Distribuidor</option><option value="JOINT_VENTURE">Joint venture</option><option value="CONSULTANT">Consultor</option>
          <option value="CUSTOMER">Cliente</option><option value="PUBLIC_BODY">Entidad pública</option><option value="NGO">ONG</option><option value="OTHER">Otro</option>
        </select>
        <input aria-label="País" style={input} placeholder="País" value={f.country} onChange={(e) => set("country", e.target.value)} />
      </div>
      <select aria-label="Nivel de riesgo" style={input} value={f.riskTier} onChange={(e) => set("riskTier", e.target.value)}><option value="LOW">Riesgo bajo</option><option value="MEDIUM">Riesgo medio</option><option value="HIGH">Riesgo alto</option><option value="CRITICAL">Riesgo crítico</option></select>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.isPublicOfficial} onChange={(e) => set("isPublicOfficial", e.target.checked)} /> Es funcionario público</label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.interactsWithPEPs} onChange={(e) => set("interactsWithPEPs", e.target.checked)} /> Interactúa con PEP</label>
      </div>
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createBusinessAssociate({ name: f.name, associateType: f.associateType, country: f.country || undefined, riskTier: f.riskTier, isPublicOfficial: f.isPublicOfficial, interactsWithPEPs: f.interactsWithPEPs, ownershipKnown: false })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDueDiligenceForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ associateId: "", level: "STANDARD" as "SIMPLIFIED" | "STANDARD" | "ENHANCED", purpose: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <select aria-label="Socio" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
        <select aria-label="Nivel" style={input} value={f.level} onChange={(e) => set("level", e.target.value)}><option value="SIMPLIFIED">Simplificada</option><option value="STANDARD">Estándar</option><option value="ENHANCED">Reforzada</option></select>
      </div>
      <input aria-label="Propósito" style={input} placeholder="Propósito" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
      <button disabled={pending || !f.associateId} style={primaryBtn} onClick={() => { run(() => createDueDiligenceCase({ associateId: f.associateId, level: f.level, purpose: f.purpose || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewOwnerForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ associateId: "", fullName: "", nationality: "", ownershipPercent: "", controlType: "OWNERSHIP" as "OWNERSHIP" | "VOTING_RIGHTS" | "OTHER_MEANS" | "SENIOR_MANAGING_OFFICIAL", isPep: false, pepRole: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Socio" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
        <input aria-label="Nombre completo del beneficiario" style={input} placeholder="Nombre completo del beneficiario" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nacionalidad" style={input} placeholder="Nacionalidad" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
        <input aria-label="% propiedad" style={input} type="number" min={0} max={100} placeholder="% propiedad" value={f.ownershipPercent} onChange={(e) => set("ownershipPercent", e.target.value)} />
        <select aria-label="Tipo de control" style={input} value={f.controlType} onChange={(e) => set("controlType", e.target.value)}><option value="OWNERSHIP">Propiedad</option><option value="VOTING_RIGHTS">Derechos de voto</option><option value="OTHER_MEANS">Otros medios</option><option value="SENIOR_MANAGING_OFFICIAL">Alto directivo</option></select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.isPep} onChange={(e) => set("isPep", e.target.checked)} /> Es persona expuesta políticamente (PEP)</label>
      {f.isPep && <input aria-label="Cargo PEP" style={input} placeholder="Cargo PEP" value={f.pepRole} onChange={(e) => set("pepRole", e.target.value)} />}
      <button disabled={pending || !f.associateId || !f.fullName} style={primaryBtn} onClick={() => { run(() => createBeneficialOwner({ associateId: f.associateId, fullName: f.fullName, nationality: f.nationality || undefined, ownershipPercent: f.ownershipPercent ? Number(f.ownershipPercent) : undefined, controlType: f.controlType, isPep: f.isPep, pepRole: f.pepRole || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewGiftForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    recordType: "GIFT" as "GIFT" | "HOSPITALITY" | "TRAVEL" | "ENTERTAINMENT" | "OTHER", direction: "GIVEN" as "GIVEN" | "RECEIVED",
    description: "", estimatedValue: "", currency: "EUR", counterpartyName: "", associateId: "",
    involvesPublicOfficial: false, policyThreshold: "100",
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Tipo de registro" style={input} value={f.recordType} onChange={(e) => set("recordType", e.target.value)}><option value="GIFT">Regalo</option><option value="HOSPITALITY">Hospitalidad</option><option value="TRAVEL">Viaje</option><option value="ENTERTAINMENT">Entretenimiento</option><option value="OTHER">Otro</option></select>
        <select aria-label="Sentido" style={input} value={f.direction} onChange={(e) => set("direction", e.target.value)}><option value="GIVEN">Dado</option><option value="RECEIVED">Recibido</option></select>
        <select aria-label="Socio (opcional)" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio (opcional)…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
      </div>
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Valor estimado" style={input} type="number" min={0} placeholder="Valor estimado" value={f.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} />
        <input aria-label="Moneda" style={input} placeholder="Moneda" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        <input aria-label="Contraparte" style={input} placeholder="Contraparte" value={f.counterpartyName} onChange={(e) => set("counterpartyName", e.target.value)} />
        <input aria-label="Umbral de política" style={input} type="number" min={0} placeholder="Umbral de política" value={f.policyThreshold} onChange={(e) => set("policyThreshold", e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.involvesPublicOfficial} onChange={(e) => set("involvesPublicOfficial", e.target.checked)} /> Involucra funcionario público</label>
      <button disabled={pending || !f.description} style={primaryBtn} onClick={() => { run(() => submitGiftHospitality({ recordType: f.recordType, direction: f.direction, description: f.description, estimatedValue: f.estimatedValue ? Number(f.estimatedValue) : undefined, currency: f.currency || undefined, counterpartyName: f.counterpartyName || undefined, associateId: f.associateId || undefined, involvesPublicOfficial: f.involvesPublicOfficial, policyThreshold: f.policyThreshold ? Number(f.policyThreshold) : undefined })); onDone(); }}><Plus size={12} /> Enviar</button>
    </div>
  );
}

function NewDonationForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    recordType: "DONATION" as "DONATION" | "SPONSORSHIP" | "COMMUNITY_INVESTMENT" | "POLITICAL_CONTRIBUTION",
    beneficiaryName: "", associateId: "", purpose: "", amount: "", currency: "EUR", involvesPublicOfficial: false,
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Tipo de registro" style={input} value={f.recordType} onChange={(e) => set("recordType", e.target.value)}><option value="DONATION">Donación</option><option value="SPONSORSHIP">Patrocinio</option><option value="COMMUNITY_INVESTMENT">Inversión comunitaria</option><option value="POLITICAL_CONTRIBUTION">Contribución política</option></select>
        <input aria-label="Beneficiario" style={input} placeholder="Beneficiario" value={f.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} />
      </div>
      <input aria-label="Propósito" style={input} placeholder="Propósito" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Importe" style={input} type="number" min={0} placeholder="Importe" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        <input aria-label="Moneda" style={input} placeholder="Moneda" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        <select aria-label="Socio (opcional)" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio (opcional)…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.involvesPublicOfficial} onChange={(e) => set("involvesPublicOfficial", e.target.checked)} /> Involucra funcionario público</label>
      <button disabled={pending || !f.beneficiaryName} style={primaryBtn} onClick={() => { run(() => createDonationSponsorship({ recordType: f.recordType, beneficiaryName: f.beneficiaryName, associateId: f.associateId || undefined, purpose: f.purpose || undefined, amount: f.amount ? Number(f.amount) : undefined, currency: f.currency || undefined, involvesPublicOfficial: f.involvesPublicOfficial, politicalDonation: f.recordType === "POLITICAL_CONTRIBUTION" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewConflictForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    period: new Date().getFullYear().toString(), hasConflict: false,
    conflictNature: "OTHER" as "PUBLIC_OFFICIAL_RELATIONSHIP" | "BUSINESS_ASSOCIATE" | "FAMILY_IN_COUNTERPARTY" | "FINANCIAL_INTEREST" | "OUTSIDE_EMPLOYMENT" | "GIFT_HOSPITALITY" | "OTHER",
    description: "", relatedAssociateId: "", recusalRequired: false,
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Periodo (p. ej. 2026)" style={input} placeholder="Periodo (p. ej. 2026)" value={f.period} onChange={(e) => set("period", e.target.value)} />
        <select aria-label="Naturaleza del conflicto" style={input} value={f.conflictNature} onChange={(e) => set("conflictNature", e.target.value)}>
          <option value="PUBLIC_OFFICIAL_RELATIONSHIP">Relación con funcionario</option><option value="BUSINESS_ASSOCIATE">Socio de negocio</option>
          <option value="FAMILY_IN_COUNTERPARTY">Familiar en contraparte</option><option value="FINANCIAL_INTEREST">Interés financiero</option>
          <option value="OUTSIDE_EMPLOYMENT">Empleo externo</option><option value="GIFT_HOSPITALITY">Regalo/hospitalidad</option><option value="OTHER">Otro</option>
        </select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.hasConflict} onChange={(e) => set("hasConflict", e.target.checked)} /> Declara un conflicto real</label>
      {f.hasConflict && <input aria-label="Descripción del conflicto (obligatoria)" style={input} placeholder="Descripción del conflicto (obligatoria)" value={f.description} onChange={(e) => set("description", e.target.value)} />}
      <select aria-label="Socio relacionado (opcional)" style={input} value={f.relatedAssociateId} onChange={(e) => set("relatedAssociateId", e.target.value)}><option value="">Socio relacionado (opcional)…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
      <button disabled={pending || !f.period || (f.hasConflict && !f.description)} style={primaryBtn} onClick={() => { run(() => declareAbmsConflict({ period: f.period, hasConflict: f.hasConflict, conflictNature: f.conflictNature, description: f.description || undefined, relatedAssociateId: f.relatedAssociateId || undefined, recusalRequired: f.recusalRequired })); onDone(); }}><Plus size={12} /> Declarar</button>
    </div>
  );
}

function NewFacilitationForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ description: "", amount: "", currency: "USD", country: "", publicOfficialRole: "", coerced: false });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Importe" style={input} type="number" min={0} placeholder="Importe" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        <input aria-label="Moneda" style={input} placeholder="Moneda" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        <input aria-label="País" style={input} placeholder="País" value={f.country} onChange={(e) => set("country", e.target.value)} />
        <input aria-label="Cargo del funcionario" style={input} placeholder="Cargo del funcionario" value={f.publicOfficialRole} onChange={(e) => set("publicOfficialRole", e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.coerced} onChange={(e) => set("coerced", e.target.checked)} /> Fue coaccionado (bajo amenaza)</label>
      <button disabled={pending || !f.description} style={primaryBtn} onClick={() => { run(() => reportFacilitationPayment({ description: f.description, amount: f.amount ? Number(f.amount) : undefined, currency: f.currency || undefined, country: f.country || undefined, publicOfficialRole: f.publicOfficialRole || undefined, coerced: f.coerced })); onDone(); }}><Plus size={12} /> Reportar</button>
    </div>
  );
}

function NewControlTestForm({ kind, pending, run, onDone }: { kind: "financial" | "nonFinancial"; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    title: "", controlDescription: "", period: "", designAdequate: "true", operatingEffective: "true",
    exceptionsFound: "0", findings: "",
    controlArea: "OTHER" as "PROCUREMENT" | "HR_HIRING" | "SALES_TENDERS" | "TRAVEL_EXPENSES" | "TRAINING_AWARENESS" | "THIRD_PARTY_ONBOARDING" | "WHISTLEBLOWING" | "OTHER",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título del control" style={input} placeholder="Título del control" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input aria-label="Periodo (p. ej. 2026-Q3)" style={input} placeholder="Periodo (p. ej. 2026-Q3)" value={f.period} onChange={(e) => set("period", e.target.value)} />
      </div>
      <input aria-label="Descripción del control" style={input} placeholder="Descripción del control" value={f.controlDescription} onChange={(e) => set("controlDescription", e.target.value)} />
      {kind === "nonFinancial" && (
        <select aria-label="Área de control" style={input} value={f.controlArea} onChange={(e) => set("controlArea", e.target.value)}>
          <option value="PROCUREMENT">Compras</option><option value="HR_HIRING">Contratación</option><option value="SALES_TENDERS">Ventas/licitaciones</option>
          <option value="TRAVEL_EXPENSES">Viajes/gastos</option><option value="TRAINING_AWARENESS">Formación</option><option value="THIRD_PARTY_ONBOARDING">Alta de terceros</option>
          <option value="WHISTLEBLOWING">Canal de denuncias</option><option value="OTHER">Otro</option>
        </select>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Diseño adecuado" style={input} value={f.designAdequate} onChange={(e) => set("designAdequate", e.target.value)}><option value="true">Diseño adecuado</option><option value="false">Diseño inadecuado</option></select>
        <select aria-label="Operación eficaz" style={input} value={f.operatingEffective} onChange={(e) => set("operatingEffective", e.target.value)}><option value="true">Operación eficaz</option><option value="false">Operación no eficaz</option></select>
        <input aria-label="Excepciones" style={input} type="number" min={0} placeholder="Excepciones" value={f.exceptionsFound} onChange={(e) => set("exceptionsFound", e.target.value)} />
      </div>
      <input aria-label="Hallazgos" style={input} placeholder="Hallazgos" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      <button disabled={pending || !f.title || !f.period} style={primaryBtn} onClick={() => {
        const payload = { title: f.title, controlDescription: f.controlDescription || undefined, period: f.period, designAdequate: f.designAdequate === "true", operatingEffective: f.operatingEffective === "true", exceptionsFound: Number(f.exceptionsFound), findings: f.findings || undefined };
        run(() => kind === "financial" ? recordFinancialControlTest(payload) : recordNonFinancialControlTest({ ...payload, controlArea: f.controlArea }));
        onDone();
      }}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function NewHighRiskForm({ associates, dueDiligence, pending, run, onDone }: {
  associates: Associates; dueDiligence: AntibriberyPayload["dueDiligence"]; pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({
    title: "", transactionType: "OTHER" as "AGENT_COMMISSION" | "SUCCESS_FEE" | "CASH_PAYMENT" | "CROSS_BORDER_TRANSFER" | "PUBLIC_TENDER" | "CUSTOMS_CLEARANCE" | "LICENSE_PERMIT" | "OTHER",
    description: "", amount: "", currency: "EUR", associateId: "", involvesPublicOfficial: false, riskRationale: "", dueDiligenceCaseId: "",
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título de la operación" style={input} placeholder="Título de la operación" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de transacción" style={input} value={f.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
          <option value="AGENT_COMMISSION">Comisión de agente</option><option value="SUCCESS_FEE">Éxito/success fee</option><option value="CASH_PAYMENT">Pago en efectivo</option>
          <option value="CROSS_BORDER_TRANSFER">Transferencia internacional</option><option value="PUBLIC_TENDER">Licitación pública</option><option value="CUSTOMS_CLEARANCE">Despacho aduanero</option>
          <option value="LICENSE_PERMIT">Licencia/permiso</option><option value="OTHER">Otro</option>
        </select>
      </div>
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Importe" style={input} type="number" min={0} placeholder="Importe" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        <input aria-label="Moneda" style={input} placeholder="Moneda" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        <select aria-label="Socio (opcional)" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio (opcional)…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
        <select aria-label="DD (opcional)" style={input} value={f.dueDiligenceCaseId} onChange={(e) => set("dueDiligenceCaseId", e.target.value)}><option value="">DD (opcional)…</option>{dueDiligence.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
      </div>
      <input aria-label="Justificación del riesgo" style={input} placeholder="Justificación del riesgo" value={f.riskRationale} onChange={(e) => set("riskRationale", e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.involvesPublicOfficial} onChange={(e) => set("involvesPublicOfficial", e.target.checked)} /> Involucra funcionario público</label>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => requestHighRiskApproval({ title: f.title, transactionType: f.transactionType, description: f.description || undefined, amount: f.amount ? Number(f.amount) : undefined, currency: f.currency || undefined, associateId: f.associateId || undefined, involvesPublicOfficial: f.involvesPublicOfficial, riskRationale: f.riskRationale || undefined, dueDiligenceCaseId: f.dueDiligenceCaseId || undefined })); onDone(); }}><Plus size={12} /> Solicitar</button>
    </div>
  );
}

function NewCommitmentForm({ associates, members, pending, run, onDone }: {
  associates: Associates; members: AntibriberyPayload["members"]; pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({
    commitmentType: "EMPLOYEE" as "EMPLOYEE" | "BUSINESS_ASSOCIATE" | "BOARD" | "SENIOR_MANAGEMENT",
    subjectUserId: "", associateId: "", subjectName: "", version: "1",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="Tipo de compromiso" style={input} value={f.commitmentType} onChange={(e) => set("commitmentType", e.target.value)}><option value="EMPLOYEE">Empleado</option><option value="BUSINESS_ASSOCIATE">Socio de negocio</option><option value="BOARD">Consejo</option><option value="SENIOR_MANAGEMENT">Alta dirección</option></select>
        <input aria-label="Versión" style={input} placeholder="Versión" value={f.version} onChange={(e) => set("version", e.target.value)} />
      </div>
      {f.commitmentType === "BUSINESS_ASSOCIATE" ? (
        <select aria-label="Socio" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
      ) : (
        <select aria-label="Persona" style={input} value={f.subjectUserId} onChange={(e) => set("subjectUserId", e.target.value)}><option value="">Persona…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      )}
      <button disabled={pending || !f.version.trim() || (f.commitmentType === "BUSINESS_ASSOCIATE" ? !f.associateId : !f.subjectUserId)} style={primaryBtn} onClick={() => { run(() => recordAntiBriberyCommitment({ commitmentType: f.commitmentType, subjectUserId: f.subjectUserId || undefined, associateId: f.associateId || undefined, subjectName: f.subjectName || undefined, version: f.version })); onDone(); }}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function NewInvestigationForm({ associates, pending, run, onDone }: { associates: Associates; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({
    investigationId: "", allegationType: "OTHER" as "BRIBE_OFFER" | "BRIBE_ACCEPTANCE" | "FACILITATION_PAYMENT" | "KICKBACK" | "INFLUENCE_PEDDLING" | "EMBEZZLEMENT_RELATED" | "OTHER",
    involvesPublicOfficial: false, associateId: "",
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--nf-text-secondary)" }}>Puente a una Investigation ya abierta en el SGC — no crea una investigación nueva.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="ID de la Investigation del SGC" style={input} placeholder="ID de la Investigation del SGC" value={f.investigationId} onChange={(e) => set("investigationId", e.target.value)} />
        <select aria-label="Tipo de denuncia" style={input} value={f.allegationType} onChange={(e) => set("allegationType", e.target.value)}>
          <option value="BRIBE_OFFER">Oferta de soborno</option><option value="BRIBE_ACCEPTANCE">Aceptación de soborno</option><option value="FACILITATION_PAYMENT">Pago de facilitación</option>
          <option value="KICKBACK">Comisión ilícita</option><option value="INFLUENCE_PEDDLING">Tráfico de influencias</option><option value="EMBEZZLEMENT_RELATED">Relacionado con malversación</option><option value="OTHER">Otro</option>
        </select>
      </div>
      <select aria-label="Socio relacionado (opcional)" style={input} value={f.associateId} onChange={(e) => set("associateId", e.target.value)}><option value="">Socio relacionado (opcional)…</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.involvesPublicOfficial} onChange={(e) => set("involvesPublicOfficial", e.target.checked)} /> Involucra funcionario público</label>
      <button disabled={pending || !f.investigationId} style={primaryBtn} onClick={() => { run(() => linkAntiBriberyInvestigation({ investigationId: f.investigationId, allegationType: f.allegationType, involvesPublicOfficial: f.involvesPublicOfficial, associateId: f.associateId || undefined })); onDone(); }}><Plus size={12} /> Vincular</button>
    </div>
  );
}

function CloseInvestigationControl({ id, pending, run }: { id: string; pending: boolean; run: Runner }) {
  const [outcome, setOutcome] = useState<"SUBSTANTIATED" | "PARTIALLY_SUBSTANTIATED" | "UNSUBSTANTIATED" | "INCONCLUSIVE" | "REFERRED_EXTERNALLY">("UNSUBSTANTIATED");
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <select aria-label="Resultado" style={{ ...input, padding: "4px 6px", fontSize: 11.5 }} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
        <option value="SUBSTANTIATED">Fundada</option><option value="PARTIALLY_SUBSTANTIATED">Parcialmente fundada</option>
        <option value="UNSUBSTANTIATED">No fundada</option><option value="INCONCLUSIVE">Inconclusa</option><option value="REFERRED_EXTERNALLY">Derivada externamente</option>
      </select>
      <button disabled={pending} style={miniBtn} onClick={() => run(() => closeAntiBriberyInvestigation(id, { outcome, status: "CLOSED" }))}><Check size={12} /> Cerrar</button>
    </div>
  );
}
