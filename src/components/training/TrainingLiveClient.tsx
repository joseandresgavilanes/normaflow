"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TrainingAssignmentStatus } from "@prisma/client";
import { BookOpen, GraduationCap, PieChart, Plus, ScrollText, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import {
  ModalActions,
  ModalCancelButton,
  ModalError,
  ModalField,
  ModalForm,
  ModalSubmitButton,
} from "@/components/ui/ModalForm";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createTrainingAssignment,
  createTrainingCourse,
  setTrainingCourseActive,
  updateTrainingAssignment,
  updateTrainingCourse,
  type TrainingCourseInput,
} from "@/lib/actions/training";
import type { TrainingAssignmentLive, TrainingCourseLive, TrainingPayload } from "@/lib/server-queries";
import { formatDate } from "@/lib/utils";

type Tab = "catalog" | "assignments" | "people" | "compliance" | "trail";

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  OVERDUE: "Vencida",
  RETRAINING_REQUIRED: "Reacreditación",
  CANCELLED: "Cancelada",
};

function datePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function assignmentBadgeStatus(status: string) {
  if (status === "COMPLETED") return "ON_TRACK";
  if (status === "OVERDUE" || status === "RETRAINING_REQUIRED") return "OFF_TRACK";
  if (status === "CANCELLED") return "OBSOLETE";
  return "AT_RISK";
}

export default function TrainingLiveClient({ initial, canManage }: { initial: TrainingPayload; canManage: boolean }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const { courses, assignments, personnel, processes, documents, auditEvents } = initial;
  const [tab, setTab] = useState<Tab>("catalog");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourseLive | null>(null);
  const [archivingCourse, setArchivingCourse] = useState<TrainingCourseLive | null>(null);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [completingAssignment, setCompletingAssignment] = useState<TrainingAssignmentLive | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<TrainingAssignmentLive | null>(null);

  const activeCourses = useMemo(() => courses.filter((course) => course.active), [courses]);
  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status !== "COMPLETED" && assignment.status !== "CANCELLED"),
    [assignments],
  );
  const completed = assignments.filter((assignment) => assignment.status === "COMPLETED").length;
  const overdue = assignments.filter((assignment) => assignment.status === "OVERDUE").length;
  const retraining = assignments.filter((assignment) => assignment.status === "RETRAINING_REQUIRED").length;
  const compliancePct = assignments.length ? Math.round((completed / assignments.length) * 100) : 0;

  function closeCourseModal() {
    setCreatingCourse(false);
    setEditingCourse(null);
    setError("");
  }

  function submitCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: TrainingCourseInput = {
      code: String(form.get("code") || ""),
      title: String(form.get("title") || ""),
      description: String(form.get("description") || "") || undefined,
      standardTags: String(form.get("standardTags") || "").split(","),
      defaultValidityMonths: Number(form.get("defaultValidityMonths") || 12),
      defaultDueDays: Number(form.get("defaultDueDays") || 30),
      mandatory: form.get("mandatory") === "on",
      autoAssignOnDocApproval: form.get("autoAssignOnDocApproval") === "on",
      documentIds: form.getAll("documentIds").map(String),
      audiencePersonnelIds: form.getAll("audiencePersonnelIds").map(String),
    };
    run(
      () => (editingCourse ? updateTrainingCourse(editingCourse.id, payload) : createTrainingCourse(payload)),
      {
        onSuccess: closeCourseModal,
        successMessage: editingCourse ? "Curso actualizado." : "Curso creado.",
      },
    );
  }

  function submitAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(
      () =>
        createTrainingAssignment({
          courseId: String(form.get("courseId") || ""),
          personnelId: String(form.get("personnelId") || ""),
          processId: String(form.get("processId") || "") || undefined,
          dueAt: String(form.get("dueAt") || ""),
          triggeredByDocumentId: String(form.get("triggeredByDocumentId") || "") || undefined,
          triggeredByVersion: String(form.get("triggeredByVersion") || "") || undefined,
        }),
      {
        onSuccess: () => setCreatingAssignment(false),
        successMessage: "Asignación creada y registrada en trazabilidad.",
      },
    );
  }

  function submitCompletion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completingAssignment) return;
    const form = new FormData(event.currentTarget);
    run(
      () =>
        updateTrainingAssignment(completingAssignment.id, {
          status: TrainingAssignmentStatus.COMPLETED,
          evidenceNote: String(form.get("evidenceNote") || ""),
          evidenceUrl: String(form.get("evidenceUrl") || ""),
        }),
      {
        onSuccess: () => setCompletingAssignment(null),
        successMessage: "Formación completada con evidencia.",
      },
    );
  }

  function submitAssignmentEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAssignment) return;
    const form = new FormData(event.currentTarget);
    run(
      () =>
        updateTrainingAssignment(editingAssignment.id, {
          processId: String(form.get("processId") || ""),
          dueAt: String(form.get("dueAt") || ""),
        }),
      {
        onSuccess: () => setEditingAssignment(null),
        successMessage: "Asignación actualizada.",
      },
    );
  }

  const blockers = [
    !activeCourses.length ? { text: "Crea al menos un curso antes de asignar formación.", href: null } : null,
    !personnel.length ? { text: "Registra personal activo para poder crear asignaciones.", href: "/app/info/personnel" } : null,
  ].filter(Boolean) as { text: string; href: string | null }[];

  return (
    <div>
      <SectionTitle
        title="Gestión de capacitación"
        sub="Cursos, destinatarios, asignaciones, evidencias, vencimientos y automatización documental"
        action={canManage && blockers.length === 0 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Plus size={17} /> Nueva asignación</span>
        ) : undefined}
        onAction={canManage && blockers.length === 0 ? () => { setCreatingAssignment(true); setError(""); } : undefined}
      />

      {(error || success) && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 9, fontSize: 13, background: error ? "#fff0f0" : "#edf8f1", color: error ? "#C93C37" : "#1f6f45" }}>
          {error || success}
        </div>
      )}

      {blockers.length > 0 && canManage && (
        <Card style={{ marginBottom: 16, border: "1px solid #f1d29d", background: "#fffaf0" }}>
          <div style={{ fontWeight: 800, color: "#875710", marginBottom: 6 }}>Antes de crear una asignación</div>
          {blockers.map((blocker) => (
            <div key={blocker.text} style={{ fontSize: 13, color: "#6f521e", marginTop: 4 }}>
              {blocker.text} {blocker.href && <Link href={blocker.href} style={{ color: "#123C66", fontWeight: 700 }}>Abrir Personal →</Link>}
            </div>
          ))}
        </Card>
      )}

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <Kpi icon={<PieChart size={22} />} value={`${compliancePct}%`} label="Cumplimiento global" color="#2E8B57" />
        <Kpi icon={<BookOpen size={22} />} value={String(completed)} label="Completadas" color="#123C66" />
        <Kpi icon={<GraduationCap size={22} />} value={String(overdue)} label="Vencidas" color="#C93C37" />
        <Kpi icon={<ScrollText size={22} />} value={String(retraining)} label="Reacreditación" color="#D68A1A" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>Vista</span>
        {([[
          "catalog", "Catálogo",
        ], ["assignments", "Asignaciones"], ["people", "Por persona"], ["compliance", "Cumplimiento"], ["trail", "Trazabilidad"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "catalog" && (
        <div>
          {canManage && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button type="button" onClick={() => { setCreatingCourse(true); setError(""); }} className="nf-app-btn-primary">+ Nuevo curso</button>
            </div>
          )}
          {!courses.length ? (
            <EmptyState title="Todavía no hay cursos" text="Crea el primer curso para definir contenido, vigencia, documentos y destinatarios." action={canManage ? () => setCreatingCourse(true) : undefined} actionLabel="Crear primer curso" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {courses.map((course, idx) => {
                const linkedDocs = documents.filter((document) => course.documentIds.includes(document.id));
                const accent = ["#123C66", "#2E8B57", "#D68A1A", "#6B3FB5"][idx % 4];
                return (
                  <Card key={course.id} style={{ padding: 0, overflow: "hidden", opacity: course.active ? 1 : 0.68 }}>
                    <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
                    <div style={{ padding: "18px 20px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 360px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: accent }}>{course.code}</span>
                          {course.mandatory && <Badge status="OFF_TRACK" label="Obligatorio" />}
                          {!course.active && <Badge status="OBSOLETE" label="Archivado" />}
                          {course.autoAssignOnDocApproval && <Badge status="ON_TRACK" label="Autoasignación" />}
                        </div>
                        <h3 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>{course.title}</h3>
                        <p style={{ margin: 0, color: "var(--nf-ink-2, #223648)", fontSize: 13, lineHeight: 1.55 }}>{course.description || "Sin descripción."}</p>
                        <div style={{ marginTop: 10, fontSize: 12, color: "var(--nf-ink-2, #223648)", fontWeight: 500 }}>
                          Plazo: {course.defaultDueDays} días · Vigencia: {course.defaultValidityMonths} meses · Destinatarios: {course.audiencePersonnelIds.length}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "var(--nf-ink-2, #223648)", fontWeight: 500 }}>
                          Documentos: {linkedDocs.length ? linkedDocs.map((document) => document.code).join(", ") : "ninguno"}
                        </div>
                      </div>
                      {canManage && (
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <button type="button" className="nf-app-btn-ghost" onClick={() => { setEditingCourse(course); setError(""); }}>Editar</button>
                          <button type="button" className={course.active ? "nf-app-btn-danger" : "nf-app-btn-ghost"} onClick={() => setArchivingCourse(course)}>{course.active ? "Archivar" : "Reactivar"}</button>
                        </div>
                      )}
                    </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "assignments" && (
        !assignments.length ? (
          <EmptyState title="No hay asignaciones" text="Las asignaciones aparecerán aquí cuando vincules un curso con una persona." action={canManage && !blockers.length ? () => setCreatingAssignment(true) : undefined} actionLabel="Crear asignación" />
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div className="nf-data-table-wrap" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
              <table className="nf-data-table" style={{ fontSize: 13 }}>
                <thead><tr><th>Persona</th><th>Curso</th><th>Estado</th><th>Vence</th><th>Proceso</th><th>Origen</th><th /></tr></thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{assignment.assigneeName}</strong><div style={{ fontSize: 11, color: "var(--nf-ink-3, #314456)" }}>{assignment.assigneeRole || assignment.assigneeEmail || "—"}</div></td>
                      <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "var(--nf-ink, #0f1b2d)" }}>{assignment.courseCode}</span><div style={{ fontSize: 11, color: "var(--nf-ink-3, #314456)" }}>{assignment.courseTitle}</div></td>
                      <td><Badge status={assignmentBadgeStatus(assignment.status)} label={STATUS_LABEL[assignment.status] ?? assignment.status} /></td>
                      <td>{formatDate(assignment.dueAt)}</td>
                      <td>{assignment.processCode || assignment.processName || "—"}</td>
                      <td>{assignment.triggeredByDocumentCode ? `${assignment.triggeredByDocumentCode} v${assignment.triggeredByVersion || "—"}` : "Manual"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {canManage && assignment.status !== "COMPLETED" && assignment.status !== "CANCELLED" && (
                          <>
                            {["ASSIGNED", "OVERDUE", "RETRAINING_REQUIRED"].includes(assignment.status) && <button type="button" disabled={isPending} onClick={() => run(() => updateTrainingAssignment(assignment.id, { status: TrainingAssignmentStatus.IN_PROGRESS }), { successMessage: "Formación iniciada." })} style={linkBtn}>Iniciar</button>}
                            <button type="button" onClick={() => setEditingAssignment(assignment)} style={linkBtn}>Editar</button>
                            <button type="button" onClick={() => { setCompletingAssignment(assignment); setError(""); }} style={linkBtn}>Completar</button>
                            <button type="button" disabled={isPending} onClick={() => run(() => updateTrainingAssignment(assignment.id, { status: TrainingAssignmentStatus.CANCELLED }), { successMessage: "Asignación cancelada." })} style={{ ...linkBtn, color: "#C93C37" }}>Cancelar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === "people" && (
        !personnel.length ? <EmptyState title="No hay personal activo" text="Registra personas antes de gestionar su formación." href="/app/info/personnel" actionLabel="Abrir Personal" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
            {personnel.map((person) => {
              const rows = assignments.filter((assignment) => assignment.personnelId === person.id);
              const done = rows.filter((assignment) => assignment.status === "COMPLETED").length;
              return <Card key={person.id}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><Users size={20} color="#123C66" /><div><strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{person.name}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3, #314456)", fontWeight: 600 }}>{person.role || person.email || "Sin cargo"}</div></div></div><div style={{ marginTop: 12, fontWeight: 700, color: "var(--nf-ink-2, #223648)" }}>{done}/{rows.length} completadas</div></Card>;
            })}
          </div>
        )
      )}

      {tab === "compliance" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 17, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>Resumen para dirección</h3>
          <p style={{ color: "var(--nf-ink-2, #223648)", fontSize: 13, lineHeight: 1.6 }}>Los indicadores se calculan con asignaciones persistidas y vencimientos reales.</p>
          <ul style={{ fontSize: 13, lineHeight: 1.8, color: "var(--nf-ink, #0f1b2d)", fontWeight: 500, paddingLeft: 20 }}>
            <li>Cursos activos: {activeCourses.length}</li>
            <li>Cursos obligatorios: {activeCourses.filter((course) => course.mandatory).length}</li>
            <li>Asignaciones activas: {activeAssignments.length}</li>
            <li>Vencidas: {overdue}</li>
            <li>Cursos con automatización documental: {activeCourses.filter((course) => course.autoAssignOnDocApproval).length}</li>
          </ul>
        </Card>
      )}

      {tab === "trail" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 17, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>Eventos de capacitación</h3>
          {!auditEvents.length ? <p style={{ color: "var(--nf-ink-2, #223648)", fontSize: 13 }}>Todavía no hay eventos.</p> : auditEvents.map((event) => (
            <div key={event.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--nf-line, #b8c8d9)", fontSize: 13, color: "var(--nf-ink-2, #223648)" }}>
              <strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{event.actorName}</strong> · {event.action.replaceAll("_", " ")} · {event.module === "training_course" ? "curso" : "asignación"}
              <div style={{ fontSize: 11, color: "var(--nf-ink-3, #314456)", marginTop: 3 }}>{formatDate(event.createdAt)}</div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={creatingCourse || editingCourse != null} onClose={() => !isPending && closeCourseModal()} title={creatingCourse ? "Nuevo curso" : "Editar curso"} width={720}>
        <CourseForm key={editingCourse?.id ?? "new"} course={editingCourse} payload={initial} isPending={isPending} error={error} onSubmit={submitCourse} onCancel={closeCourseModal} />
      </Modal>

      <Modal open={archivingCourse != null} onClose={() => !isPending && setArchivingCourse(null)} title={archivingCourse?.active ? "Archivar curso" : "Reactivar curso"} width={430}>
        <p style={{ marginTop: 0, color: "var(--nf-ink-2, #223648)" }}>Las asignaciones históricas se conservarán. {archivingCourse?.active ? "El curso dejará de estar disponible para nuevas asignaciones." : "El curso volverá a estar disponible."}</p>
        <div className="nf-modal-actions">
          <ModalCancelButton onClick={() => setArchivingCourse(null)} disabled={isPending} />
          <button
            type="button"
            className={archivingCourse?.active ? "nf-app-btn-danger" : "nf-app-btn-primary"}
            disabled={isPending}
            onClick={() => archivingCourse && run(() => setTrainingCourseActive(archivingCourse.id, !archivingCourse.active), { onSuccess: () => setArchivingCourse(null), successMessage: archivingCourse.active ? "Curso archivado." : "Curso reactivado." })}
          >
            {isPending ? "Guardando…" : archivingCourse?.active ? "Archivar" : "Reactivar"}
          </button>
        </div>
      </Modal>

      <Modal open={creatingAssignment} onClose={() => !isPending && setCreatingAssignment(false)} title="Nueva asignación" width={560}>
        <ModalForm onSubmit={submitAssignment}>
          {!activeCourses.length || !personnel.length ? <p style={{ color: "#C93C37", marginTop: 0 }}>Necesitas al menos un curso activo y una persona activa.</p> : <>
            <ModalField label="Curso *"><select name="courseId" required className="nf-app-input">{activeCourses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></ModalField>
            <ModalField label="Persona *"><select name="personnelId" required className="nf-app-input">{personnel.map((person) => <option key={person.id} value={person.id}>{person.name}{person.role ? ` · ${person.role}` : ""}</option>)}</select></ModalField>
            <ModalField label="Proceso"><select name="processId" className="nf-app-input"><option value="">Sin proceso</option>{processes.map((process) => <option key={process.id} value={process.id}>{process.code ? `${process.code} — ` : ""}{process.name}</option>)}</select></ModalField>
            <ModalField label="Fecha de vencimiento *"><input type="date" name="dueAt" required defaultValue={datePlusDays(activeCourses[0]?.defaultDueDays ?? 30)} className="nf-app-input" /></ModalField>
            <ModalField label="Documento de origen"><select name="triggeredByDocumentId" className="nf-app-input"><option value="">Asignación manual</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.code} — {document.title}</option>)}</select></ModalField>
            <ModalField label="Versión del documento"><input name="triggeredByVersion" placeholder="Ej. 2.0" className="nf-app-input" /></ModalField>
          </>}
          {error && <ModalError>{error}</ModalError>}
          <FormFooter isPending={isPending} onCancel={() => setCreatingAssignment(false)} disabled={!activeCourses.length || !personnel.length} />
        </ModalForm>
      </Modal>

      <Modal open={completingAssignment != null} onClose={() => !isPending && setCompletingAssignment(null)} title="Completar formación" width={520}>
        <ModalForm onSubmit={submitCompletion}>
          <p style={{ marginTop: 0, fontSize: 13, color: "var(--nf-ink-2, #223648)", fontWeight: 600 }}>{completingAssignment?.assigneeName} · {completingAssignment?.courseCode}</p>
          <ModalField label="Nota de evidencia"><textarea name="evidenceNote" rows={4} placeholder="Resultado, evaluación, responsable…" className="nf-app-input" /></ModalField>
          <ModalField label="Enlace a evidencia"><input type="url" name="evidenceUrl" placeholder="https://…" className="nf-app-input" /></ModalField>
          <div className="nf-modal-field-hint">Es obligatorio indicar una nota o un enlace.</div>
          {error && <ModalError>{error}</ModalError>}
          <FormFooter isPending={isPending} onCancel={() => setCompletingAssignment(null)} />
        </ModalForm>
      </Modal>

      <Modal open={editingAssignment != null} onClose={() => !isPending && setEditingAssignment(null)} title="Editar asignación" width={500}>
        <ModalForm onSubmit={submitAssignmentEdit}>
          <ModalField label="Proceso"><select name="processId" defaultValue={editingAssignment?.processId ?? ""} className="nf-app-input"><option value="">Sin proceso</option>{processes.map((process) => <option key={process.id} value={process.id}>{process.code ? `${process.code} — ` : ""}{process.name}</option>)}</select></ModalField>
          <ModalField label="Fecha de vencimiento"><input type="date" name="dueAt" required defaultValue={editingAssignment?.dueAt.slice(0, 10)} className="nf-app-input" /></ModalField>
          {error && <ModalError>{error}</ModalError>}
          <FormFooter isPending={isPending} onCancel={() => setEditingAssignment(null)} />
        </ModalForm>
      </Modal>
    </div>
  );
}

function CourseForm({ course, payload, isPending, error, onSubmit, onCancel }: { course: TrainingCourseLive | null; payload: TrainingPayload; isPending: boolean; error: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <ModalForm onSubmit={onSubmit}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}><ModalField label="Código *"><input name="code" required defaultValue={course?.code ?? ""} placeholder="TR-SGC-01" className="nf-app-input" /></ModalField><ModalField label="Nombre *"><input name="title" required defaultValue={course?.title ?? ""} className="nf-app-input" /></ModalField></div>
    <ModalField label="Descripción"><textarea name="description" rows={3} defaultValue={course?.description ?? ""} className="nf-app-input" /></ModalField>
    <ModalField label="Normas / etiquetas"><input name="standardTags" defaultValue={course?.standardTags.join(", ") ?? ""} placeholder="ISO 9001, ISO 27001" className="nf-app-input" /></ModalField>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><ModalField label="Plazo para completar (días) *"><input type="number" min={1} max={365} name="defaultDueDays" required defaultValue={course?.defaultDueDays ?? 30} className="nf-app-input" /></ModalField><ModalField label="Vigencia (meses) *"><input type="number" min={1} max={120} name="defaultValidityMonths" required defaultValue={course?.defaultValidityMonths ?? 12} className="nf-app-input" /></ModalField></div>
    <ChoiceList title="Documentos vinculados" emptyText="No hay documentos disponibles. Puedes crear el curso igualmente y vincularlos después." items={payload.documents.map((document) => ({ id: document.id, label: `${document.code} — ${document.title}` }))} name="documentIds" selected={course?.documentIds ?? []} />
    <ChoiceList title="Destinatarios para autoasignación" emptyText="No hay personal activo. Regístralo en Personal." items={payload.personnel.map((person) => ({ id: person.id, label: `${person.name}${person.role ? ` · ${person.role}` : ""}` }))} name="audiencePersonnelIds" selected={course?.audiencePersonnelIds ?? []} />
    <label style={checkLabel}><input type="checkbox" name="mandatory" defaultChecked={course?.mandatory ?? false} /> Curso obligatorio</label>
    <label style={checkLabel}><input type="checkbox" name="autoAssignOnDocApproval" defaultChecked={course?.autoAssignOnDocApproval ?? false} /> Crear asignaciones al aprobar un documento vinculado</label>
    {error && <ModalError>{error}</ModalError>}
    <FormFooter isPending={isPending} onCancel={onCancel} />
  </ModalForm>;
}

function ChoiceList({ title, emptyText, items, name, selected }: { title: string; emptyText: string; items: { id: string; label: string }[]; name: string; selected: string[] }) {
  return <fieldset style={{ border: "1px solid var(--nf-line, #b8c8d9)", borderRadius: 8, padding: 12 }}><legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700, color: "var(--nf-ink-2, #223648)" }}>{title}</legend>{items.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, maxHeight: 150, overflow: "auto" }}>{items.map((item) => <label key={item.id} style={checkLabel}><input type="checkbox" name={name} value={item.id} defaultChecked={selected.includes(item.id)} /> {item.label}</label>)}</div> : <div style={{ fontSize: 12, color: "var(--nf-ink-2, #223648)" }}>{emptyText}</div>}</fieldset>;
}

function Kpi({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return <div className="nf-kpi-summary-cell"><div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</div><div><div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-2, #223648)", marginTop: 3 }}>{label}</div></div></div>;
}

function EmptyState({ title, text, action, actionLabel, href }: { title: string; text: string; action?: () => void; actionLabel: string; href?: string }) {
  return <Card style={{ textAlign: "center", padding: 36 }}><GraduationCap size={34} color="#123C66" /><h3 style={{ margin: "12px 0 6px", fontSize: 17, fontWeight: 800, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>{title}</h3><p style={{ color: "var(--nf-ink-2, #223648)", fontSize: 13, lineHeight: 1.55 }}>{text}</p>{action && <button type="button" className="nf-app-btn-primary" onClick={action}>{actionLabel}</button>}{href && <Link href={href} className="nf-app-btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>{actionLabel}</Link>}</Card>;
}

function FormFooter({ isPending, onCancel, disabled }: { isPending: boolean; onCancel: () => void; disabled?: boolean }) {
  return (
    <ModalActions>
      <ModalCancelButton onClick={onCancel} disabled={isPending} />
      <ModalSubmitButton disabled={isPending || disabled}>{isPending ? "Guardando…" : "Guardar"}</ModalSubmitButton>
    </ModalActions>
  );
}

const linkBtn: React.CSSProperties = { border: "none", background: "none", color: "#123C66", fontWeight: 700, cursor: "pointer", fontSize: 12, padding: "3px 5px" };
const checkLabel: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "var(--nf-ink, #0f1b2d)", lineHeight: 1.4, fontWeight: 500 };
