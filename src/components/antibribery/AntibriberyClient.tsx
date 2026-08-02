"use client";

import { useState, useTransition } from "react";
import {
  ShieldBan, LayoutDashboard, AlertTriangle, Handshake, SearchCheck, Users,
  Gift, HeartHandshake, UserX, Banknote, ShieldCheck, BadgeCheck, ScrollText, Siren,
  ArrowRight, Check, X,
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
} from "@/lib/actions/antibribery";
import type { DueDiligenceStatus, GiftHospitalityStatus, HighRiskApprovalStatus } from "@prisma/client";
import { nextDueDiligenceStatuses } from "@/lib/antibribery/due-diligence";
import { nextGiftStatuses } from "@/lib/antibribery/gifts";
import { nextHighRiskStatuses } from "@/lib/antibribery/approvals";

type Tab =
  | "panel" | "risks" | "associates" | "due-diligence" | "owners" | "gifts"
  | "donations" | "conflicts" | "facilitation" | "controls" | "approvals"
  | "commitments" | "investigations";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#16a34a", MEDIUM: "#d68a1a", MODERATE: "#d68a1a", HIGH: "#ea580c", CRITICAL: "#b91c1c",
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
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #9f1239", background: "#fff1f2", color: "#9f1239", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const okBtn: React.CSSProperties = { ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const money = (v: number | null | undefined, c?: string | null) => (typeof v === "number" ? `${v.toLocaleString("es-ES")}${c ? ` ${c}` : ""}` : "—");
const level = (value: string) => LEVEL_COLORS[value] ?? "#64748b";

export default function AntibriberyClient({ initial, demo = false }: { initial: AntibriberyPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;
  const nameOf = (id: string | null | undefined) => initial.members.find((m) => m.id === id)?.name ?? "—";

  const tabs: { id: Tab; label: string; Icon: typeof ShieldBan; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "risks", label: "Riesgo de soborno", Icon: AlertTriangle, badge: s.highResidual },
    { id: "associates", label: "Socios de negocio", Icon: Handshake, badge: s.highRiskAssociates },
    { id: "due-diligence", label: "Debida diligencia", Icon: SearchCheck, badge: s.dueDiligenceOpen },
    { id: "owners", label: "Beneficiarios", Icon: Users, badge: s.pepOwners },
    { id: "gifts", label: "Regalos", Icon: Gift, badge: s.giftsPending },
    { id: "donations", label: "Donaciones", Icon: HeartHandshake },
    { id: "conflicts", label: "Conflictos", Icon: UserX },
    { id: "facilitation", label: "Facilitación", Icon: Banknote, badge: s.facilitationOpen },
    { id: "controls", label: "Controles", Icon: ShieldCheck, badge: s.controlFailures },
    { id: "approvals", label: "Aprobaciones", Icon: BadgeCheck, badge: s.highRiskPending },
    { id: "commitments", label: "Compromisos", Icon: ScrollText },
    { id: "investigations", label: "Investigaciones", Icon: Siren, badge: s.investigationsOpen },
  ];

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ffe4e6", display: "grid", placeItems: "center" }}>
          <ShieldBan size={22} color="#9f1239" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sistema de Gestión Antisoborno</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            ISO 37001:2016 — extensión del SGC: riesgo de soborno, terceros, debida diligencia, regalos, controles e investigaciones enlazadas.
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Evaluaciones" value={s.assessments} />
        <Stat label="Riesgo residual alto" value={s.highResidual} accent={s.highResidual ? "#b91c1c" : undefined} />
        <Stat label="Terceros" value={s.associates} />
        <Stat label="DD abiertas" value={s.dueDiligenceOpen} accent={s.dueDiligenceOpen ? "#d68a1a" : undefined} />
        <Stat label="Regalos pendientes" value={s.giftsPending} accent={s.giftsPending ? "#d68a1a" : undefined} />
        <Stat label="Investigaciones abiertas" value={s.investigationsOpen} accent={s.investigationsOpen ? "#ea580c" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#9f1239" : "#e5eaf2"), background: tab === id ? "#fff1f2" : "#fff", color: tab === id ? "#9f1239" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#ffe4e6", "#b91c1c")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Riesgo de soborno (§4.5)</h3>
            <Row k="Evaluaciones" v={s.assessments} />
            <Row k="Aprobadas" v={s.assessmentsApproved} />
            <Row k="Residual alto/crítico" v={s.highResidual} danger={s.highResidual > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Reutiliza la mecánica de ComplianceRisk; añade uplift de país, sector, funcionario y terceros.</p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Terceros y UBO (§8.2)</h3>
            <Row k="Socios de negocio" v={s.associates} />
            <Row k="Riesgo alto/crítico" v={s.highRiskAssociates} danger={s.highRiskAssociates > 0} />
            <Row k="Debidas diligencias abiertas" v={s.dueDiligenceOpen} danger={s.dueDiligenceOpen > 0} />
            <Row k="Revisiones periódicas vencidas" v={s.dueDiligenceOverdue} danger={s.dueDiligenceOverdue > 0} />
            <Row k="Beneficiarios PEP" v={s.pepOwners} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Regalos, donaciones y conflictos (§8.7)</h3>
            <Row k="Regalos pendientes" v={s.giftsPending} danger={s.giftsPending > 0} />
            <Row k="Donaciones políticas" v={s.donationsPolitical} />
            <Row k="Pagos de facilitación abiertos" v={s.facilitationOpen} danger={s.facilitationOpen > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>SUBMITTED → MANAGER_REVIEW → COMPLIANCE_REVIEW → APPROVED|REJECTED.</p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Controles, aprobaciones e investigación</h3>
            <Row k="Fallos de control" v={s.controlFailures} danger={s.controlFailures > 0} />
            <Row k="Operaciones pendientes" v={s.highRiskPending} danger={s.highRiskPending > 0} />
            <Row k="Compromisos" v={s.commitments} />
            <Row k="Investigaciones abiertas" v={s.investigationsOpen} danger={s.investigationsOpen > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Las investigaciones son un puente a Investigation del SGC; el canal de denuncias no se duplica.</p>
          </div>
        </div>
      )}

      {tab === "risks" && (
        <Table head={["Código", "Evaluación", "Inherente", "Residual", "País", "Sector", "Funcionario", "Estado", "Acciones"]}>
          {initial.assessments.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.scope ?? ""}</div></td>
              <td style={td}><span style={chip("#f1f5f9", level(row.inherentLevel))}>{row.inherentScore} · {row.inherentLevel}</span></td>
              <td style={td}><span style={chip("#f1f5f9", level(row.residualLevel ?? "MEDIUM"))}>{row.residualScore ?? "—"} · {row.residualLevel ?? "—"}</span></td>
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
      )}

      {tab === "associates" && (
        <Table head={["Código", "Nombre", "Tipo", "País", "Riesgo", "PEP", "Screening", "UBO", "DD", "Estado"]}>
          {initial.associates.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.name}</b></td>
              <td style={td}>{row.associateType}</td>
              <td style={td}>{row.country ?? "—"}</td>
              <td style={td}><span style={chip("#f1f5f9", level(row.riskTier))}>{row.riskTier}</span></td>
              <td style={td}>{row.isPublicOfficial || row.interactsWithPEPs ? "Sí" : "No"}</td>
              <td style={td}>{row.sanctionedScreen}</td>
              <td style={td}>{row._count.beneficialOwners}</td>
              <td style={td}>{row._count.dueDiligence}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "due-diligence" && (
        <Table head={["Código", "Socio", "Nivel", "Estado", "Screening", "Reforzada", "Próxima revisión", "Acciones"]}>
          {initial.dueDiligence.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.associate.code}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.associate.name}</div></td>
              <td style={td}>{row.level}</td>
              <td style={td}><span style={chip("#f1f5f9", "#334155")}>{DD_LABEL[row.status] ?? row.status}</span></td>
              <td style={td}>{row.screeningResult}</td>
              <td style={td}>{row.enhancedRequired ? "Obligatoria" : "No"}</td>
              <td style={td}>{fmt(row.nextReviewDate)}</td>
              <td style={td}>
                {live && (can.update || can.approve) && nextDueDiligenceStatuses(row.status).map((to) => (
                  <button
                    key={to}
                    disabled={pending}
                    style={to === "APPROVED" ? okBtn : to === "REJECTED" ? miniBtn : { ...miniBtn, borderColor: "#64748b", background: "#f8fafc", color: "#334155", marginRight: 4 }}
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
      )}

      {tab === "owners" && (
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
                {live && can.update && !row.verifiedAt && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => verifyBeneficialOwner(row.id))}>
                    <Check size={12} /> Verificar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "gifts" && (
        <Table head={["Código", "Tipo", "Descripción", "Valor", "Funcionario", "Estado", "Compliance", "Acciones"]}>
          {initial.gifts.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.recordType} · {row.direction}</td>
              <td style={td}><b>{row.description}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.counterpartyName ?? row.associate?.name ?? ""}</div></td>
              <td style={td}>{money(row.estimatedValue, row.currency)}{row.requiresCompliance ? <div style={{ color: "#9f1239", fontSize: 11 }}>Exige compliance</div> : null}</td>
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
                      style={to === "APPROVED" ? okBtn : to === "REJECTED" ? miniBtn : { ...miniBtn, borderColor: "#64748b", background: "#f8fafc", color: "#334155", marginRight: 4 }}
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
      )}

      {tab === "donations" && (
        <Table head={["Código", "Tipo", "Beneficiario", "Importe", "Política", "Estado", "Acciones"]}>
          {initial.donations.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.recordType}</td>
              <td style={td}><b>{row.beneficiaryName}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.purpose ?? ""}</div></td>
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
      )}

      {tab === "conflicts" && (
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
      )}

      {tab === "facilitation" && (
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
      )}

      {tab === "controls" && (
        <Table head={["Ámbito", "Código", "Control", "Periodo", "Diseño", "Operación", "Excepciones", "Estado"]}>
          {[
            ...initial.financialTests.map((row) => ({ ...row, ambito: "Financiero", area: "FINANCIAL" })),
            ...initial.nonFinancialTests.map((row) => ({ ...row, ambito: "No financiero", area: row.controlArea })),
          ].map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.ambito}</td>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.area}</div></td>
              <td style={td}>{row.period}</td>
              <td style={td}>{row.designAdequate === null ? "—" : row.designAdequate ? "OK" : "Falla"}</td>
              <td style={td}>{row.operatingEffective === null ? "—" : row.operatingEffective ? "OK" : "Falla"}</td>
              <td style={td}>{row.exceptionsFound}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "approvals" && (
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
      )}

      {tab === "commitments" && (
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
      )}

      {tab === "investigations" && (
        <Table head={["Código", "Investigation", "Alegación", "Funcionario", "Estado", "Resultado", "CAPA"]}>
          {initial.investigations.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{row.investigationId}</td>
              <td style={td}>{row.allegationType}</td>
              <td style={td}>{row.involvesPublicOfficial ? "Sí" : "No"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>{row.outcome ?? "—"}</td>
              <td style={td}>{row.capaId ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {!initial.conflictsComplete && tab === "conflicts" && (
        <p style={{ color: "#94a3b8", fontSize: 12 }}>Solo ves tus propias declaraciones ABMS. Quien aprueba compliance ve el registro completo.</p>
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent ?? "#0f172a" }}>{value}{suffix ?? ""}</div>
    </div>
  );
}

function Row({ k, v, suffix, danger }: { k: string; v: string | number; suffix?: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13, borderBottom: "1px solid #f8fafc" }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <b style={{ color: danger ? "#b91c1c" : "#0f172a" }}>{v}{suffix ?? ""}</b>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
