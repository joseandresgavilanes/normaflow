"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, ChevronRight, FileText, GitBranch, GitPullRequest, GraduationCap, Layers, Plus, Shield, Target } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import {
  useWorkspace,
  type ProcessRow,
  type DocumentRow,
  type RiskRow,
  type IndicatorRow,
  type ChangeRequestRow,
  type TrainingAssignmentRow,
  type TrainingCourseRow,
} from "@/context/WorkspaceStore";
import {
  changesLinkedToProcess,
  documentsLinkedToProcess,
  indicatorsLinkedToProcess,
  risksLinkedToProcess,
  trainingLinkedToProcess,
} from "@/lib/process-linking";

function processTypeMeta(type: ProcessRow["type"]) {
  if (type === "support") {
    return { label: "Soporte", color: "#D97706", soft: "rgba(214, 138, 26, 0.09)", gradientEnd: "#f4a020" };
  }
  if (type === "strategic") {
    return { label: "Estratégico", color: "#5B3FA6", soft: "rgba(91, 63, 166, 0.09)", gradientEnd: "#7c5cc9" };
  }
  return { label: "Core", color: "#5266F6", soft: "rgba(82, 102, 246, 0.08)", gradientEnd: "#16A34A" };
}

function getProcessLinkStats(
  p: ProcessRow,
  documents: DocumentRow[],
  risks: RiskRow[],
  indicators: IndicatorRow[],
  changeRequests: ChangeRequestRow[],
  trainingAssignments: TrainingAssignmentRow[],
) {
  return {
    docs: documentsLinkedToProcess(p, documents).length,
    risks: risksLinkedToProcess(p, risks).length,
    indicators: indicatorsLinkedToProcess(p, indicators).length,
    changes: changesLinkedToProcess(p, changeRequests).length,
    training: trainingLinkedToProcess(p, trainingAssignments).length,
  };
}

function linkBlock(title: string, href: string, children: ReactNode) {
  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 14,
        border: "1px solid rgba(82, 102, 246, 0.12)",
        background: "#fbfcfe",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          background: "var(--nf-app-surface-2)",
          borderBottom: "1px solid rgba(82, 102, 246, 0.1)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.01em" }}>{title}</span>
        <Link
          href={href}
          style={{
            fontSize: 12,
            color: "#5266F6",
            fontWeight: 700,
            whiteSpace: "nowrap",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Abrir módulo
          <ChevronRight size={15} strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
      <div style={{ padding: "14px 16px 16px", fontSize: 13, lineHeight: 1.55, color: "var(--nf-ink)" }}>{children}</div>
    </div>
  );
}

function ProcessDetailBody({
  detail,
  documents,
  risks,
  indicators,
  changeRequests,
  trainingAssignments,
  trainingCourses,
}: {
  detail: ProcessRow;
  documents: DocumentRow[];
  risks: RiskRow[];
  indicators: IndicatorRow[];
  changeRequests: ChangeRequestRow[];
  trainingAssignments: TrainingAssignmentRow[];
  trainingCourses: TrainingCourseRow[];
}) {
  const linkedDocs = useMemo(() => documentsLinkedToProcess(detail, documents), [detail, documents]);

  const linkedRisks = useMemo(() => risksLinkedToProcess(detail, risks), [detail, risks]);
  const linkedIndicators = useMemo(() => indicatorsLinkedToProcess(detail, indicators), [detail, indicators]);
  const linkedChanges = useMemo(() => changesLinkedToProcess(detail, changeRequests), [detail, changeRequests]);
  const processTraining = useMemo(() => trainingLinkedToProcess(detail, trainingAssignments), [detail, trainingAssignments]);

  function courseTitle(id: string) {
    return trainingCourses.find(c => c.id === id)?.title ?? id;
  }

  function trainStatusLabel(s: TrainingAssignmentRow["status"]) {
    const map: Record<string, string> = {
      ASSIGNED: "Asignado",
      IN_PROGRESS: "En progreso",
      COMPLETED: "Completado",
      OVERDUE: "Vencido",
      RETRAINING_REQUIRED: "Reentrenamiento",
    };
    return map[s] ?? s;
  }

  function changeStatusLabel(s: ChangeRequestRow["status"]) {
    const map: Record<string, string> = {
      DRAFT: "Borrador",
      SUBMITTED: "Enviado",
      UNDER_REVIEW: "En revisión",
      APPROVED: "Aprobado",
      REJECTED: "Rechazado",
      IMPLEMENTED: "Implementado",
      VERIFIED: "Verificado",
      CLOSED: "Cerrado",
    };
    return map[s] ?? s;
  }

  const { label: typeLabel, color: typeColor } = processTypeMeta(detail.type);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Identidad del proceso */}
      <div
        style={{
          marginBottom: 20,
          padding: "18px 18px 18px",
          borderRadius: 14,
          border: "1px solid var(--nf-line)",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: typeColor,
                  background: "#fff",
                  border: `1.5px solid ${typeColor}40`,
                  padding: "5px 11px",
                  borderRadius: 10,
                }}
              >
                {detail.code}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  textTransform: "none",
                  background: `${typeColor}1a`,
                  color: typeColor,
                  padding: "5px 11px",
                  borderRadius: 99,
                }}
              >
                {typeLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Avatar name={detail.owner} size={36} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 2 }}>Responsable</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)" }}>{detail.owner}</div>
              </div>
            </div>
          </div>
        </div>
        {detail.description ? (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(82, 102, 246, 0.1)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--nf-ink)",
              fontWeight: 500,
            }}
          >
            {detail.description}
          </div>
        ) : null}
      </div>

      {/* Entradas / salidas */}
      <div
        style={{
          marginBottom: 22,
          padding: "18px 18px 20px",
          borderRadius: 14,
          border: "1px solid var(--nf-line)",
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 4 }}>Flujo</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 16, letterSpacing: "-0.02em" }}>Entradas y salidas</div>
        <div className="nf-grid-2" style={{ gap: 16 }}>
          <div
            style={{
              padding: "14px 16px 16px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(82, 102, 246, 0.12)",
            }}
          >
            <div style={{ fontWeight: 600, color: "#5266F6", fontSize: 11, letterSpacing: "-0.01em", textTransform: "none", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowDownToLine size={16} strokeWidth={2.25} aria-hidden />
              Entradas
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.65 }}>
              {detail.inputs.map((i, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div
            style={{
              padding: "14px 16px 16px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(46, 139, 87, 0.2)",
            }}
          >
            <div style={{ fontWeight: 600, color: "#16A34A", fontSize: 11, letterSpacing: "-0.01em", textTransform: "none", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowUpFromLine size={16} strokeWidth={2.25} aria-hidden />
              Salidas
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.65 }}>
              {detail.outputs.map((o, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Vínculos */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 4 }}>Trazabilidad</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 10, letterSpacing: "-0.02em" }}>Cumplimiento y vínculos</div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.6, fontWeight: 500 }}>
          Documentos controlados, riesgos, indicadores, cambios y formación asociados a este código de proceso. Cada bloque es independiente.
        </p>
      </div>

      {linkBlock(
        "Documentos",
        "/app/documents",
        linkedDocs.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {linkedDocs.map(d => (
              <li key={d.id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{d.code}</span> — {d.title}{" "}
                <span style={{ color: "var(--nf-ink-3)", fontSize: 12 }}>({d.status})</span>
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguno enlazado por código o proceso.</span>
        )
      )}

      {linkBlock(
        "Riesgos",
        "/app/risks",
        linkedRisks.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {linkedRisks.map(r => (
              <li key={r.id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{r.code}</span> — {r.title}{" "}
                <span style={{ color: "var(--nf-ink-3)", fontSize: 12 }}>· {r.owner}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguno enlazado por código o proceso.</span>
        )
      )}

      {linkBlock(
        "Indicadores",
        "/app/indicators",
        linkedIndicators.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {linkedIndicators.map(ind => (
              <li key={ind.id} style={{ marginBottom: 8 }}>
                {ind.name} — <span style={{ color: "var(--nf-ink-2)", fontWeight: 600 }}>{ind.value}</span> / objetivo {ind.target} {ind.unit}
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguno enlazado por nombre o proceso.</span>
        )
      )}

      {linkBlock(
        "Control de cambios",
        "/app/changes",
        linkedChanges.length ? (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
            {linkedChanges.map((c, i) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: i < linkedChanges.length - 1 ? 10 : 0,
                  paddingBottom: i < linkedChanges.length - 1 ? 10 : 0,
                  borderBottom: i < linkedChanges.length - 1 ? "1px solid rgba(82, 102, 246, 0.08)" : "none",
                }}
              >
                <span style={{ fontWeight: 700 }}>{c.code}</span>
                <span style={{ flex: "1 1 120px", minWidth: 0 }}>{c.title}</span>
                <Badge
                  status={
                    c.status === "CLOSED" || c.status === "VERIFIED"
                      ? "ON_TRACK"
                      : c.status === "REJECTED"
                        ? "OFF_TRACK"
                        : "AT_RISK"
                  }
                  label={changeStatusLabel(c.status)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguno enlazado por código o proceso.</span>
        )
      )}

      {linkBlock(
        "Formación",
        "/app/training",
        processTraining.length ? (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
            {processTraining.map((t, i) => (
              <li
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: i < processTraining.length - 1 ? 10 : 0,
                  paddingBottom: i < processTraining.length - 1 ? 10 : 0,
                  borderBottom: i < processTraining.length - 1 ? "1px solid rgba(82, 102, 246, 0.08)" : "none",
                }}
              >
                <span style={{ fontWeight: 700 }}>{t.assigneeName}</span>
                <span style={{ color: "var(--nf-ink-3)", flex: "1 1 140px", minWidth: 0 }}>· {courseTitle(t.courseId)}</span>
                <Badge
                  status={
                    t.status === "COMPLETED"
                      ? "COMPLETED"
                      : t.status === "OVERDUE" || t.status === "RETRAINING_REQUIRED"
                        ? "OPEN"
                        : "IN_PROGRESS"
                  }
                  label={trainStatusLabel(t.status)}
                />
                {t.triggeredByDocumentCode && (
                  <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 600 }}>Doc {t.triggeredByDocumentCode}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontStyle: "italic" }}>Ninguna enlazada por código o proceso.</span>
        )
      )}
    </div>
  );
}

export default function ProcessesModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { processes, documents, risks, indicators, changeRequests, trainingAssignments, trainingCourses } = state;
  const [detail, setDetail] = useState<ProcessRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "core", description: "", owner: "", inputs: "", outputs: "" });

  function openCreate() {
    setForm({ name: "", code: "", type: "core", description: "", owner: state.session.name, inputs: "", outputs: "" });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!form.name.trim()) {
      showToast("Indica el nombre del proceso");
      return;
    }
    const p: ProcessRow = {
      id: `p-${Date.now()}`,
      name: form.name.trim(),
      code: form.code.trim() || `P-${String(processes.length + 1).padStart(2, "0")}`,
      type: form.type as ProcessRow["type"],
      description: form.description.trim() || "",
      owner: form.owner.trim() || state.session.name,
      inputs: form.inputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      outputs: form.outputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      siteId: `${state.session.activeOrgId}-s1`,
      linkedRiskCodes: [],
      linkedDocCodes: [],
      linkedIndicatorNames: [],
      linkedChangeCodes: [],
      linkedTrainingAssignmentIds: [],
    };
    dispatch({ type: "addProcess", p });
    setCreateOpen(false);
    showToast("Proceso añadido (sesión local)");
  }

  return (
    <div>
      <SectionTitle
        title="Mapa de procesos"
        sub={`${processes.length} procesos en el espacio de trabajo`}
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Nuevo proceso
          </span>
        }
        onAction={openCreate}
      />

      {processes.length > 0 && (
        <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
          <div className="nf-kpi-summary-cell">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--nf-app-accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#5266F6",
              }}
            >
              <GitBranch size={22} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#5266F6", letterSpacing: "-0.03em", lineHeight: 1 }}>{processes.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Procesos definidos</div>
            </div>
          </div>
          <div className="nf-kpi-summary-cell">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#F0FDF4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1f6f45",
              }}
            >
              <Layers size={22} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#16A34A", letterSpacing: "-0.03em", lineHeight: 1 }}>{processes.filter(p => p.type === "core").length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Tipo core</div>
            </div>
          </div>
          <div className="nf-kpi-summary-cell">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#FFFBEB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9a6510",
              }}
            >
              <Layers size={22} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#D97706", letterSpacing: "-0.03em", lineHeight: 1 }}>{processes.filter(p => p.type === "support").length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Soporte</div>
            </div>
          </div>
          <div className="nf-kpi-summary-cell">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#F5F3FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#5B3FA6",
              }}
            >
              <Target size={22} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#5B3FA6", letterSpacing: "-0.03em", lineHeight: 1 }}>{processes.filter(p => p.type === "strategic").length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Estratégico</div>
            </div>
          </div>
        </div>
      )}
      {processes.length === 0 ? (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 14px",
              borderRadius: 16,
              background: "var(--nf-app-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5266F6",
            }}
          >
            <GitBranch size={28} strokeWidth={2} aria-hidden />
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nf-ink)" }}>Aún no hay procesos</p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--nf-ink-3)" }}>Crea el primero para enlazar documentos, riesgos e indicadores.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
          {processes.map(p => {
            const { label: typeLabel, color: accent, soft: accentSoft, gradientEnd } = processTypeMeta(p.type);
            const stats = getProcessLinkStats(p, documents, risks, indicators, changeRequests, trainingAssignments);
            const maxIo = 4;
            const inShown = p.inputs.slice(0, maxIo);
            const outShown = p.outputs.slice(0, maxIo);
            const inMore = Math.max(0, p.inputs.length - inShown.length);
            const outMore = Math.max(0, p.outputs.length - outShown.length);

            const metricCell = (Icon: LucideIcon, label: string, value: number, color: string) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  padding: "10px 6px",
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px solid rgba(82, 102, 246, 0.08)",
                  minWidth: 0,
                }}
              >
                <Icon size={17} strokeWidth={2.25} aria-hidden style={{ color, display: "block", margin: "0 auto 6px" }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginTop: 4 }}>{label}</div>
              </div>
            );

            return (
              <div
                key={p.id}
                className="nf-kpi-card"
                onClick={() => setDetail(p)}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && setDetail(p)}
                style={{ overflow: "hidden", borderRadius: 16 }}
              >
                
                <div style={{ padding: 0 }}>
                  <div
                    style={{
                      padding: "20px 20px 18px",
                      background: "#fff",
                      borderBottom: "1px solid rgba(82, 102, 246, 0.07)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                          <span
                            style={{
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              fontSize: 12,
                              fontWeight: 600,
                              color: accent,
                              background: "#fff",
                              border: `1.5px solid ${accent}35`,
                              padding: "5px 11px",
                              borderRadius: 10,
                              letterSpacing: "0.02em",
                              boxShadow: "0 1px 0 rgba(82, 102, 246, 0.06)",
                            }}
                          >
                            {p.code || "—"}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: "-0.01em",
                              textTransform: "none",
                              background: `${accent}22`,
                              color: accent,
                              padding: "5px 11px",
                              borderRadius: 99,
                            }}
                          >
                            {typeLabel}
                          </span>
                        </div>
                        <h3
                          style={{
                            fontSize: 19,
                            fontWeight: 600,
                            color: "var(--nf-ink)",
                            margin: "0 0 10px",
                            letterSpacing: "-0.03em",
                            lineHeight: 1.25,
                            fontFamily: "var(--font-inter, Inter), system-ui, sans-serif",
                          }}
                        >
                          {p.name}
                        </h3>
                        {p.description ? (
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--nf-ink-2)",
                              margin: 0,
                              lineHeight: 1.55,
                              fontWeight: 500,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {p.description}
                          </p>
                        ) : (
                          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: 0, fontStyle: "italic", fontWeight: 500 }}>Sin descripción breve.</p>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "center", width: 72 }}>
                        <Avatar name={p.owner} size={52} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink)", marginTop: 8, lineHeight: 1.2 }}>{p.owner.split(" ")[0]}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginTop: 2 }}>Responsable</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
                      gap: 8,
                      padding: "14px 16px",
                      background: "var(--nf-app-surface-2)",
                      borderBottom: "1px solid rgba(82, 102, 246, 0.07)",
                    }}
                  >
                    {metricCell(FileText, "Docs", stats.docs, "#5266F6")}
                    {metricCell(Shield, "Riesgos", stats.risks, "#DC2626")}
                    {metricCell(BarChart3, "KPIs", stats.indicators, "#16A34A")}
                    {metricCell(GitPullRequest, "Cambios", stats.changes, "#D97706")}
                    {metricCell(GraduationCap, "Formación", stats.training, "#6B3FB5")}
                  </div>

                  <div style={{ padding: "16px 18px 6px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#5266F6",
                          letterSpacing: "-0.01em",
                          textTransform: "none",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: "rgba(82, 102, 246, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ArrowDownToLine size={15} strokeWidth={2.25} aria-hidden />
                        </span>
                        Entradas
                      </div>
                      {p.inputs.length === 0 ? (
                        <span style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 500 }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {inShown.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--nf-ink)",
                                background: "#fff",
                                border: "1px solid rgba(82, 102, 246, 0.12)",
                                padding: "5px 10px",
                                borderRadius: 8,
                                maxWidth: "100%",
                                lineHeight: 1.35,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                          {inMore > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", alignSelf: "center" }}>+{inMore}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#16A34A",
                          letterSpacing: "-0.01em",
                          textTransform: "none",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: "rgba(46, 139, 87, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ArrowUpFromLine size={15} strokeWidth={2.25} aria-hidden />
                        </span>
                        Salidas
                      </div>
                      {p.outputs.length === 0 ? (
                        <span style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 500 }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {outShown.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--nf-ink)",
                                background: "#fff",
                                border: "1px solid rgba(46, 139, 87, 0.22)",
                                padding: "5px 10px",
                                borderRadius: 8,
                                maxWidth: "100%",
                                lineHeight: 1.35,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                          {outMore > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", alignSelf: "center" }}>+{outMore}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px 18px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      background: "#fafbfd",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 600 }}>Vínculos con documentos, riesgos y más — vista detallada en el modal.</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#5266F6",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      Abrir ficha
                      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={700}>
        {detail && (
          <ProcessDetailBody
            detail={detail}
            documents={documents}
            risks={risks}
            indicators={indicators}
            changeRequests={changeRequests}
            trainingAssignments={trainingAssignments}
            trainingCourses={trainingCourses}
          />
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo proceso" width={520}>
        <div className="nf-modal-form">
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Nombre
            <input
              className="nf-app-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Código
              <input
                className="nf-app-input"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Tipo
              <select
                className="nf-app-input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="core">Core</option>
                <option value="support">Soporte</option>
                <option value="strategic">Estratégico</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Responsable
            <input
              className="nf-app-input"
              value={form.owner}
              onChange={e => setForm({ ...form, owner: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Descripción
            <textarea
              className="nf-app-input"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Entradas (separadas por coma)
            <input
              className="nf-app-input"
              value={form.inputs}
              onChange={e => setForm({ ...form, inputs: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Salidas (separadas por coma)
            <input
              className="nf-app-input"
              value={form.outputs}
              onChange={e => setForm({ ...form, outputs: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitCreate}>Crear</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
