"use client";
import Link from "next/link";
import { BookOpen, GraduationCap, PieChart, Plus, ScrollText, Users } from "lucide-react";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace, type TrainingAssignmentRow } from "@/context/WorkspaceStore";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  OVERDUE: "Vencido",
  RETRAINING_REQUIRED: "Reacreditación",
};

export default function TrainingModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { trainingCourses, trainingAssignments, auditEvents, documents, demoPeople, processes } = state;
  const [tab, setTab] = useState<"catalog" | "assignments" | "people" | "compliance" | "trail">("catalog");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editAssign, setEditAssign] = useState<TrainingAssignmentRow | null>(null);
  const [processLinkDraft, setProcessLinkDraft] = useState("");
  const [form, setForm] = useState({
    courseId: trainingCourses[0]?.id ?? "",
    personId: demoPeople[0]?.id ?? "",
    dueDays: 30,
    processCode: processes[0]?.code ?? "",
  });

  const today = new Date().toISOString().slice(0, 10);

  const compliance = useMemo(() => {
    const total = trainingAssignments.length;
    const done = trainingAssignments.filter(a => a.status === "COMPLETED").length;
    const overdue = trainingAssignments.filter(a => a.status === "OVERDUE" || (a.dueAt < today && a.status !== "COMPLETED")).length;
    const retr = trainingAssignments.filter(a => a.status === "RETRAINING_REQUIRED").length;
    return { total, done, overdue, retr, pct: total ? Math.round((done / total) * 100) : 100 };
  }, [trainingAssignments, today]);

  const trainingEvents = useMemo(() => auditEvents.filter(e => e.action.includes("TRAINING")), [auditEvents]);

  function openAssign() {
    setForm({
      courseId: trainingCourses[0]?.id ?? "",
      personId: demoPeople[0]?.id ?? "",
      dueDays: 30,
      processCode: processes[0]?.code ?? "",
    });
    setAssignOpen(true);
  }

  useCreateFromQuery(perm.training.manage, openAssign);

  function openEditProcess(a: TrainingAssignmentRow) {
    setEditAssign(a);
    setProcessLinkDraft(a.processCode ?? "");
  }

  function saveAssignmentProcessLink() {
    if (!editAssign) return;
    const code = processLinkDraft.trim();
    dispatch({ type: "updateTrainingAssignment", id: editAssign.id, patch: { processCode: code } });
    showToast(code ? `Asignación enlazada a ${code}` : "Enlace de proceso quitado");
    setEditAssign(null);
  }

  function submitAssign() {
    if (!perm.training.manage) {
      showToast("Sin permiso para asignar formaciones");
      return;
    }
    const person = demoPeople.find(p => p.id === form.personId);
    const course = trainingCourses.find(c => c.id === form.courseId);
    if (!person || !course) {
      showToast("Seleccione curso y persona");
      return;
    }
    const due = new Date();
    due.setDate(due.getDate() + form.dueDays);
    const row: TrainingAssignmentRow = {
      id: `${state.session.activeOrgId}-ta-${Date.now()}`,
      courseId: course.id,
      assigneeName: person.name,
      assigneeEmail: person.email,
      assigneeRole: person.roleLabel,
      siteId: person.siteId,
      teamId: person.teamId,
      processCode: form.processCode.trim() || undefined,
      status: "ASSIGNED",
      assignedAt: new Date().toISOString(),
      dueAt: due.toISOString().slice(0, 10),
    };
    dispatch({ type: "addTrainingAssignment", row });
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.TRAINING_ASSIGNED,
        entityType: "TRAINING_ASSIGNMENT",
        entityId: row.id,
        entityLabel: `${course.code} → ${person.name}`,
        reason: "Asignación manual desde módulo de capacitación",
      }),
    });
    setAssignOpen(false);
    showToast("Asignación creada y registrada en trazabilidad");
  }

  function markComplete(a: TrainingAssignmentRow) {
    if (!perm.training.manage) return;
    dispatch({
      type: "updateTrainingAssignment",
      id: a.id,
      patch: { status: "COMPLETED", completedAt: new Date().toISOString(), evidenceNote: "Finalización registrada" },
    });
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.TRAINING_COMPLETED,
        entityType: "TRAINING_ASSIGNMENT",
        entityId: a.id,
        entityLabel: a.assigneeName,
        newValue: "COMPLETED",
      }),
    });
    showToast("Formación marcada como completada");
  }

  function triggerFromDocument(docCode: string, version: string) {
    if (!perm.training.manage) return;
    const course = trainingCourses.find(c => c.linkedDocumentCodes.includes(docCode));
    if (!course) {
      showToast("No hay curso vinculado a ese código en el catálogo");
      return;
    }
    const person = demoPeople[0];
    if (!person) return;
    const doc = documents.find(d => d.code === docCode);
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const row: TrainingAssignmentRow = {
      id: `${state.session.activeOrgId}-ta-${Date.now()}`,
      courseId: course.id,
      assigneeName: person.name,
      assigneeEmail: person.email,
      siteId: person.siteId,
      processCode: doc?.linkedProcessCode,
      status: "ASSIGNED",
      assignedAt: new Date().toISOString(),
      dueAt: due.toISOString().slice(0, 10),
      triggeredByDocumentCode: docCode,
      triggeredByVersion: version,
    };
    dispatch({ type: "addTrainingAssignment", row });
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.TRAINING_ASSIGNED,
        entityType: "DOCUMENT_VERSION",
        entityId: docCode,
        entityLabel: `Relectura tras v${version}`,
        reason: "Política/documento controlado actualizado — asignación automática simulada",
      }),
    });
    showToast("Asignaciones generadas por cambio documental");
  }


  type AssignmentRow = (typeof trainingAssignments)[number];
  const assignmentColumns = useMemo<DataTableColumn<AssignmentRow>[]>(() => [
    { id: "person", header: "Persona", primary: true, minWidth: 190, hideable: false, sortValue: (a) => a.assigneeName,
      cell: (a) => <><div style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{a.assigneeName}</div><div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{a.assigneeEmail}</div></> },
    { id: "course", header: "Curso", minWidth: 130, sortValue: (a) => a.courseId,
      cell: (a) => trainingCourses.find((c) => c.id === a.courseId)?.code ?? a.courseId },
    { id: "status", header: "Estado", minWidth: 140, sortValue: (a) => a.status,
      cell: (a) => <Badge status={a.status === "COMPLETED" ? "ON_TRACK" : a.status === "OVERDUE" || a.status === "RETRAINING_REQUIRED" ? "OFF_TRACK" : "AT_RISK"} label={STATUS_LABEL[a.status] ?? a.status} /> },
    { id: "due", header: "Vence", minWidth: 120, numeric: true, sortValue: (a) => String(a.dueAt ?? ""), cell: (a) => formatDate(a.dueAt) },
    { id: "process", header: "Proceso", minWidth: 120, sortValue: (a) => a.processCode ?? "",
      cell: (a) => a.processCode
        ? <Link href="/app/processes" style={{ fontSize: 12, fontWeight: 700, color: "#5266F6", textDecoration: "none" }}>{a.processCode}</Link>
        : <span style={{ fontSize: 12, color: "var(--nf-ink-4)" }}>—</span> },
    { id: "origin", header: "Origen", minWidth: 150, sortValue: (a) => a.triggeredByDocumentCode ?? "",
      cell: (a) => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{a.triggeredByDocumentCode ? `Doc ${a.triggeredByDocumentCode} v${a.triggeredByVersion ?? "—"}` : "Manual"}</span> },
    { id: "actions", header: "Acciones", minWidth: 150, hideable: false,
      cell: (a) => <span style={{ whiteSpace: "nowrap" }}>
        {perm.training.manage && <button type="button" onClick={() => openEditProcess(a)} className="nf-text-action" style={{ marginRight: 10 }}>Proceso</button>}
        {a.status !== "COMPLETED" && perm.training.manage && <button type="button" onClick={() => markComplete(a)} className="nf-text-action">Completar</button>}
      </span> },
  ], [perm.training.manage, trainingCourses, openEditProcess, markComplete]);

  return (
    <div>
      <SectionTitle
        title="Gestión de capacitación"
        sub="Catálogo, asignaciones por sede/equipo/persona, vencimientos y vínculo con documentos controlados"
        action={
          perm.training.manage ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Plus size={17} strokeWidth={2.25} aria-hidden />
              Nueva asignación
            </span>
          ) : undefined
        }
        onAction={perm.training.manage ? openAssign : undefined}
      />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
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
            <PieChart size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#16A34A", letterSpacing: "-0.03em", lineHeight: 1 }}>{compliance.pct}%</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Cumplimiento global</div>
          </div>
        </div>
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
            <BookOpen size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#5266F6", letterSpacing: "-0.03em", lineHeight: 1 }}>{compliance.done}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Completadas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#DC2626",
            }}
          >
            <GraduationCap size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#DC2626", letterSpacing: "-0.03em", lineHeight: 1 }}>{compliance.overdue}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Vencidas / riesgo</div>
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
            <ScrollText size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#D97706", letterSpacing: "-0.03em", lineHeight: 1 }}>{compliance.retr}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Reacreditación</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Vista
        </span>
        {(
          [
            ["catalog", "Catálogo"],
            ["assignments", "Asignaciones"],
            ["people", "Por persona"],
            ["compliance", "Cumplimiento"],
            ["trail", "Trazabilidad"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {trainingCourses.map((c, idx) => {
            const accent = ["#5266F6", "#16A34A", "#D97706", "#6B3FB5"][idx % 4];
            return (
              <Card key={c.id} style={{ padding: 0, overflow: "hidden", borderRadius: 14, border: "1px solid var(--nf-line)", boxShadow: "0 12px 36px -24px rgba(82, 102, 246, 0.18)" }}>
                
                <div style={{ padding: "18px 20px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, color: accent, marginBottom: 6 }}>{c.code}</div>
                      <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>{c.title}</h3>
                      <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{c.description}</p>
                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.standardTags.map(t => (
                          <span key={t} style={{ fontSize: 11, fontWeight: 700, background: "#f0f4ff", color: "#5266F6", padding: "4px 10px", borderRadius: 99 }}>
                            {t}
                          </span>
                        ))}
                        {c.mandatory && <Badge status="OFF_TRACK" label="Obligatorio" />}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 12, fontWeight: 500 }}>
                        Documentos:{" "}
                        {c.linkedDocumentCodes.map(code => (
                          <Link key={code} href="/app/documents" style={{ color: "#5266F6", fontWeight: 700, marginRight: 8 }}>
                            {code}
                          </Link>
                        ))}
                        · Vigencia sugerida: {c.defaultValidityMonths} meses
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
                      {c.linkedDocumentCodes[0] && perm.training.manage && (
                        <button
                          type="button"
                          onClick={() => triggerFromDocument(c.linkedDocumentCodes[0], "simulada")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #16A34A",
                            background: "#16A34A12",
                            color: "#1f6f45",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Simular asignación por cambio doc.
                        </button>
                      )}
                      <Link href="/app/changes" style={{ fontSize: 12, color: "var(--nf-ink-3)", textDecoration: "none", fontWeight: 600 }}>
                        Ver cambios que requieren training →
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "assignments" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <DataTable
            columns={assignmentColumns}
            rows={trainingAssignments}
            rowKey={(a) => a.id}
            caption="Asignaciones de formación: persona, curso, estado, vencimiento, proceso asociado y origen de la asignación."
            storageKey="training-assignments"
            empty={<EmptyState kind="empty" title="No hay asignaciones de formación." description="Las asignaciones enlazan a cada persona con los cursos que debe completar y su fecha límite." />}
          />
        </Card>
      )}

      {tab === "people" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
          {demoPeople.map((p, i) => {
            const mine = trainingAssignments.filter(a => a.assigneeEmail === p.email);
            const accent = ["#5266F6", "#16A34A", "#D97706"][i % 3];
            return (
              <Card key={p.id} style={{ padding: 0, overflow: "hidden", borderRadius: 14 }}>
                
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `${accent}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: accent,
                      }}
                    >
                      <Users size={20} strokeWidth={2.25} aria-hidden />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--nf-ink)", fontSize: 15, letterSpacing: "-0.02em" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 600, marginTop: 2 }}>{p.roleLabel}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink-2)", marginBottom: 10 }}>
                    {mine.filter(m => m.status === "COMPLETED").length}/{mine.length} completadas
                  </div>
                  <Link href="/app/activity" style={{ fontSize: 12, color: "#5266F6", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    Historial →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "compliance" && (
        <Card style={{ padding: 0, overflow: "hidden", borderRadius: 14 }}>
          
          <div style={{ padding: "20px 22px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: "rgba(82, 102, 246, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#5266F6",
                }}
              >
                <PieChart size={22} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Resumen para dirección</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.6, fontWeight: 500, margin: "0 0 14px" }}>
              El cumplimiento de formación está ligado a versiones aprobadas de políticas y procedimientos. Cuando un documento crítico cambia, NormaFlow puede generar asignaciones de relectura o reacreditación (simulado aquí).
            </p>
            <ul style={{ fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.75, margin: "0 0 16px", paddingLeft: 20, fontWeight: 500 }}>
              <li>Documentos con impacto formativo: {documents.filter(d => d.trainingImpact).length}</li>
              <li>Asignaciones activas: {trainingAssignments.filter(a => a.status !== "COMPLETED").length}</li>
              <li>Recordatorios pendientes: {trainingAssignments.filter(a => !a.reminderSent && a.status === "ASSIGNED").length}</li>
            </ul>
            <Link href="/app/reporting" style={{ fontSize: 13, fontWeight: 700, color: "#5266F6", textDecoration: "none" }}>
              Incluir en pack de auditoría →
            </Link>
          </div>
        </Card>
      )}

      {tab === "trail" && (
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginBottom: 14, letterSpacing: "0.04em" }}>EVENTOS DE CAPACITACIÓN</div>
          <AuditTimeline events={trainingEvents} emptyText="Aún no hay eventos de capacitación en el registro." />
        </Card>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Nueva asignación" width={480}>
        <div className="nf-modal-form">
        <label>Curso
        <select
          className="nf-app-input"
          value={form.courseId}
          onChange={e => setForm({ ...form, courseId: e.target.value })}
          style={{ cursor: "pointer" }}
        >
          {trainingCourses.map(c => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
        </label>
        <label>Persona
        <select
          className="nf-app-input"
          value={form.personId}
          onChange={e => setForm({ ...form, personId: e.target.value })}
          style={{ cursor: "pointer" }}
        >
          {demoPeople.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.roleLabel})
            </option>
          ))}
        </select>
        </label>
        <label>Proceso asociado
        <select
          className="nf-app-input"
          value={form.processCode}
          onChange={e => setForm({ ...form, processCode: e.target.value })}
          style={{ cursor: "pointer" }}
        >
          <option value="">Sin proceso</option>
          {processes.map(p => (
            <option key={p.id} value={p.code}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        </label>
        <label>Días hasta vencimiento
        <input
          className="nf-app-input"
          type="number"
          min={1}
          max={365}
          value={form.dueDays}
          onChange={e => setForm({ ...form, dueDays: parseInt(e.target.value, 10) || 30 })}
        />
        </label>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={() => setAssignOpen(false)}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" onClick={submitAssign}>Crear asignación</button>
        </div>
        </div>
      </Modal>

      <Modal open={!!editAssign} onClose={() => setEditAssign(null)} title="Enlace con proceso" width={420}>
        {editAssign && (
          <div className="nf-modal-form">
            <p style={{ fontSize: 13, color: "var(--nf-ink-2, #223648)", margin: 0 }}>
              {editAssign.assigneeName} · {trainingCourses.find(c => c.id === editAssign.courseId)?.code}
            </p>
            <label>Proceso
            <select
              className="nf-app-input"
              value={processLinkDraft}
              onChange={e => setProcessLinkDraft(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              <option value="">Sin proceso</option>
              {processes.map(p => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            </label>
            <div className="nf-modal-actions">
              <button type="button" className="nf-app-btn-ghost" onClick={() => setEditAssign(null)}>Cancelar</button>
              <button type="button" className="nf-app-btn-primary" onClick={saveAssignmentProcessLink}>Guardar enlace</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
