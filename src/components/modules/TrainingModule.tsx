"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace, type TrainingAssignmentRow } from "@/context/WorkspaceStore";
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
  const { trainingCourses, trainingAssignments, auditEvents, documents, demoPeople } = state;
  const [tab, setTab] = useState<"catalog" | "assignments" | "people" | "compliance" | "trail">("catalog");
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState({ courseId: trainingCourses[0]?.id ?? "", personId: demoPeople[0]?.id ?? "", dueDays: 30 });

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
    });
    setAssignOpen(true);
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
      patch: { status: "COMPLETED", completedAt: new Date().toISOString(), evidenceNote: "Finalización registrada (demo)" },
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
      showToast("No hay curso vinculado a ese código en el catálogo demo");
      return;
    }
    const person = demoPeople[0];
    if (!person) return;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const row: TrainingAssignmentRow = {
      id: `${state.session.activeOrgId}-ta-${Date.now()}`,
      courseId: course.id,
      assigneeName: person.name,
      assigneeEmail: person.email,
      siteId: person.siteId,
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
    showToast("Asignaciones generadas por cambio documental (demo)");
  }

  return (
    <div>
      <SectionTitle
        title="Gestión de capacitación"
        sub="Catálogo, asignaciones por sede/equipo/persona, vencimientos y vínculo con documentos controlados"
        action={perm.training.manage ? "+ Nueva asignación" : undefined}
        onAction={perm.training.manage ? openAssign : undefined}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(
          [
            ["catalog", "Catálogo"],
            ["assignments", "Asignaciones"],
            ["people", "Por persona"],
            ["compliance", "Cumplimiento"],
            ["trail", "Trazabilidad"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: `1px solid ${tab === k ? "#123C66" : "#E5EAF2"}`,
              background: tab === k ? "#123C66" : "#fff",
              color: tab === k ? "#fff" : "#5E6B7A",
              fontSize: 13,
              fontWeight: tab === k ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { label: "Cumplimiento global", value: `${compliance.pct}%`, color: "#2E8B57" },
          { label: "Completadas", value: compliance.done, color: "#123C66" },
          { label: "Vencidas / riesgo", value: compliance.overdue, color: "#C93C37" },
          { label: "Reacreditación", value: compliance.retr, color: "#D68A1A" },
        ].map(x => (
          <Card key={x.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: x.color }}>{x.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A" }}>{x.label}</div>
          </Card>
        ))}
      </div>

      {tab === "catalog" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {trainingCourses.map(c => (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#123C66", fontWeight: 700 }}>{c.code}</div>
                  <h3 style={{ margin: "4px 0 8px", fontSize: 16, color: "#142033" }}>{c.title}</h3>
                  <p style={{ fontSize: 13, color: "#5E6B7A", margin: 0, lineHeight: 1.5 }}>{c.description}</p>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.standardTags.map(t => (
                      <span key={t} style={{ fontSize: 11, background: "#f0f4ff", color: "#123C66", padding: "2px 8px", borderRadius: 99 }}>
                        {t}
                      </span>
                    ))}
                    {c.mandatory && <Badge status="OFF_TRACK" label="Obligatorio" />}
                  </div>
                  <p style={{ fontSize: 12, color: "#5E6B7A", marginTop: 10 }}>
                    Documentos:{" "}
                    {c.linkedDocumentCodes.map(code => (
                      <Link key={code} href="/app/documents" style={{ color: "#123C66", fontWeight: 600, marginRight: 8 }}>
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
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #2E8B57",
                        background: "#2E8B5712",
                        color: "#2E8B57",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Simular asignación por cambio doc.
                    </button>
                  )}
                  <Link href="/app/changes" style={{ fontSize: 12, color: "#5E6B7A", textDecoration: "none" }}>
                    Ver cambios que requieren training →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "assignments" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F7F9FC", textAlign: "left", color: "#5E6B7A", fontSize: 12 }}>
                <th style={{ padding: 12 }}>Persona</th>
                <th style={{ padding: 12 }}>Curso</th>
                <th style={{ padding: 12 }}>Estado</th>
                <th style={{ padding: 12 }}>Vence</th>
                <th style={{ padding: 12 }}>Origen</th>
                <th style={{ padding: 12 }} />
              </tr>
            </thead>
            <tbody>
              {trainingAssignments.map(a => {
                const course = trainingCourses.find(c => c.id === a.courseId);
                return (
                  <tr key={a.id} style={{ borderTop: "1px solid #E5EAF2" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, color: "#142033" }}>{a.assigneeName}</div>
                      <div style={{ fontSize: 11, color: "#5E6B7A" }}>{a.assigneeEmail}</div>
                    </td>
                    <td style={{ padding: 12 }}>{course?.code ?? a.courseId}</td>
                    <td style={{ padding: 12 }}>
                      <Badge
                        status={a.status === "COMPLETED" ? "ON_TRACK" : a.status === "OVERDUE" || a.status === "RETRAINING_REQUIRED" ? "OFF_TRACK" : "AT_RISK"}
                        label={STATUS_LABEL[a.status] ?? a.status}
                      />
                    </td>
                    <td style={{ padding: 12 }}>{formatDate(a.dueAt)}</td>
                    <td style={{ padding: 12, fontSize: 12, color: "#5E6B7A" }}>
                      {a.triggeredByDocumentCode ? `Doc ${a.triggeredByDocumentCode} v${a.triggeredByVersion ?? "—"}` : "Manual"}
                    </td>
                    <td style={{ padding: 12 }}>
                      {a.status !== "COMPLETED" && perm.training.manage && (
                        <button type="button" onClick={() => markComplete(a)} style={{ fontSize: 12, color: "#123C66", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                          Completar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "people" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          {demoPeople.map(p => {
            const mine = trainingAssignments.filter(a => a.assigneeEmail === p.email);
            return (
              <Card key={p.id}>
                <div style={{ fontWeight: 700, color: "#142033" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#5E6B7A", marginBottom: 8 }}>{p.roleLabel}</div>
                <div style={{ fontSize: 12, color: "#5E6B7A" }}>{mine.filter(m => m.status === "COMPLETED").length}/{mine.length} completadas</div>
                <Link href="/app/activity" style={{ fontSize: 12, color: "#123C66", marginTop: 8, display: "inline-block" }}>
                  Historial →
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "compliance" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 15, color: "#142033" }}>Resumen para dirección</h3>
          <p style={{ fontSize: 13, color: "#5E6B7A", lineHeight: 1.6 }}>
            El cumplimiento de formación está ligado a versiones aprobadas de políticas y procedimientos. Cuando un documento crítico cambia, NormaFlow puede generar asignaciones de relectura o reacreditación (simulado aquí).
          </p>
          <ul style={{ fontSize: 13, color: "#142033", lineHeight: 1.7 }}>
            <li>Documentos con impacto formativo: {documents.filter(d => d.trainingImpact).length}</li>
            <li>Asignaciones activas: {trainingAssignments.filter(a => a.status !== "COMPLETED").length}</li>
            <li>Recordatorios pendientes (demo): {trainingAssignments.filter(a => !a.reminderSent && a.status === "ASSIGNED").length}</li>
          </ul>
          <Link href="/app/reporting" style={{ fontSize: 13, fontWeight: 600, color: "#123C66" }}>
            Incluir en pack de auditoría →
          </Link>
        </Card>
      )}

      {tab === "trail" && (
        <Card>
          <AuditTimeline events={trainingEvents} emptyText="Aún no hay eventos de capacitación en el registro." />
        </Card>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Nueva asignación" width={480}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Curso</label>
        <select
          value={form.courseId}
          onChange={e => setForm({ ...form, courseId: e.target.value })}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5EAF2", marginBottom: 14 }}
        >
          {trainingCourses.map(c => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Persona</label>
        <select
          value={form.personId}
          onChange={e => setForm({ ...form, personId: e.target.value })}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5EAF2", marginBottom: 14 }}
        >
          {demoPeople.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.roleLabel})
            </option>
          ))}
        </select>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Días hasta vencimiento</label>
        <input
          type="number"
          min={1}
          max={365}
          value={form.dueDays}
          onChange={e => setForm({ ...form, dueDays: parseInt(e.target.value, 10) || 30 })}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E5EAF2", marginBottom: 18 }}
        />
        <button type="button" onClick={submitAssign} style={{ width: "100%", padding: 12, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Crear asignación
        </button>
      </Modal>
    </div>
  );
}
