"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import {
  type ApprovalStatus,
  ChangeImpact,
  ChangeRequestStatus,
  IntegrationStatus,
  SupplierCriticality,
  SupplierEvaluationOutcome,
  SupplierStatus,
} from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal, PromptActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  addChangeTask,
  createChangeRequest,
  createIntegration,
  createSupplier,
  decideChangeApproval,
  deleteChangeRequest,
  deleteIntegration,
  deleteSupplier,
  registerSupplierEvaluation,
  toggleChangeTask,
  transitionChangeRequest,
  updateChangeRequest,
  updateIntegration,
  updateSupplier,
  type ChangeRequestInput,
  type IntegrationInput,
  type SupplierInput,
} from "@/lib/actions/governance";
import {
  changeCategoryOptions,
  changeTypeOptions,
  DEFAULT_CHANGE_CATEGORY,
  DEFAULT_CHANGE_TYPE,
} from "@/lib/change-control-catalog";
import { DEFAULT_SUPPLIER_CATEGORY, supplierCategoryOptions } from "@/lib/supplier-catalog";
import type { ChangesPayload, IntegrationsPayload, SuppliersPayload } from "@/lib/server-queries";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import EntityTable from "@/components/ui/EntityTable";
import DateField from "@/components/ui/DateField";
import {
  CellTitle,
  CountCell,
  Field,
  FormModal,
  Meta,
  OperationalHeader,
  OperationalMessages,
  RowActions,
  inputStyle,
} from "./OperationalUi";

type ChangeRow = ChangesPayload["changes"][number];
type SupplierRow = SuppliersPayload["suppliers"][number];
type IntegrationRow = IntegrationsPayload["integrations"][number];
type ApprovalDecisionStatus = Extract<ApprovalStatus, "APPROVED" | "REJECTED">;

function csv(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function selected(fd: FormData, name: string) {
  return fd.getAll(name).map(String).filter(Boolean);
}

function MultiSelect({ name, label, rows, initial }: {
  name: string;
  label: string;
  rows: { id: string; label: string }[];
  initial?: string[];
}) {
  if (!rows.length) return null;
  return <Field label={label}><Picker aria-label={label} name={name} multiple className="nf-app-input" style={{ ...inputStyle, minHeight: 92 }} defaultValue={initial ?? []}>{rows.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Picker><span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 500 }}>⌘/Ctrl + clic para seleccionar varios.</span></Field>;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ border: "1px solid var(--nf-line)", borderRadius: 9, padding: 9 }}><div style={{ fontSize: 10, color: "var(--nf-ink-3)", textTransform: "none", fontWeight: 600 }}>{label}</div><div style={{ marginTop: 3, fontWeight: 600 }}>{children}</div></div>;
}

const NEXT_STATUS: Partial<Record<ChangeRequestStatus, ChangeRequestStatus[]>> = {
  DRAFT: [ChangeRequestStatus.SUBMITTED],
  SUBMITTED: [ChangeRequestStatus.UNDER_REVIEW, ChangeRequestStatus.REJECTED],
  UNDER_REVIEW: [ChangeRequestStatus.APPROVED, ChangeRequestStatus.REJECTED],
  APPROVED: [ChangeRequestStatus.IMPLEMENTED],
  REJECTED: [ChangeRequestStatus.DRAFT],
  IMPLEMENTED: [ChangeRequestStatus.VERIFIED],
  VERIFIED: [ChangeRequestStatus.CLOSED],
};

export function ChangesLiveClient({ initial }: { initial: ChangesPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ChangeRow | null>(null);
  const [detail, setDetail] = useState<ChangeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChangeRow | null>(null);
  const [rejectTransition, setRejectTransition] = useState<ChangeRow | null>(null);
  const [taskChange, setTaskChange] = useState<ChangeRow | null>(null);
  const [decision, setDecision] = useState<{ row: ChangeRow; status: ApprovalDecisionStatus } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: ChangeRequestInput = {
      code: String(fd.get("code") ?? ""),
      title: String(fd.get("title") ?? ""),
      category: String(fd.get("category") ?? ""),
      changeType: String(fd.get("changeType") ?? ""),
      reason: String(fd.get("reason") ?? ""),
      impact: fd.get("impact") as ChangeImpact,
      affectedAreas: csv(fd.get("affectedAreas")),
      nonconformityId: String(fd.get("nonconformityId") ?? "") || undefined,
      processIds: selected(fd, "processIds"),
      documentIds: selected(fd, "documentIds"),
      riskIds: selected(fd, "riskIds"),
      trainingCourseIds: selected(fd, "trainingCourseIds"),
      approverIds: selected(fd, "approverIds"),
    };
    run(() => editing ? updateChangeRequest(editing.id, input) : createChangeRequest(input), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: editing ? "Cambio actualizado." : "Cambio creado.",
    });
  }

  function remove(row: ChangeRow) {
    setConfirmDelete(row);
  }

  function transition(row: ChangeRow, status: ChangeRequestStatus) {
    if (status === ChangeRequestStatus.REJECTED) {
      setRejectTransition(row);
      return;
    }
    run(() => transitionChangeRequest(row.id, status), { onSuccess: () => setDetail(null), successMessage: `Estado actualizado a ${status}.` });
  }

  function addTask(row: ChangeRow) {
    setTaskChange(row);
  }

  function decide(row: ChangeRow, status: ApprovalDecisionStatus) {
    setDecision({ row, status });
  }

  const row = editing;
  const processRows = initial.processes.map((item) => ({ id: item.id, label: `${item.code ?? "PROC"} · ${item.name}` }));
  const documentRows = initial.documents.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` }));
  const riskRows = initial.risks.map((item) => ({ id: item.id, label: item.title }));
  const courseRows = initial.courses.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` }));
  const memberRows = initial.members.map((item) => ({ id: item.id, label: item.name }));

  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });

  return <div>
    <OperationalHeader title="Gestión de cambios" subtitle="Cambios planificados con impacto, tareas y aprobaciones registradas (cláusula 6.3)." canCreate={initial.access.canCreate} actionLabel="Nuevo cambio" onCreate={() => { setError(""); setCreating(true); }} />
    <OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Control de cambios"
      rows={initial.changes}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="changes"
      searchText={(row) => `${row.code} ${row.title} ${row.category} ${row.changeType}`}
      searchPlaceholder="Buscar por código, título o categoría…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "type", label: "Tipo", value: (row) => row.changeType },
        { id: "impact", label: "Impacto", value: (row) => row.impact },
      ]}
      emptyTitle="Todavía no hay cambios"
      emptyDescription="Un cambio planificado deja constancia de su impacto, sus tareas y quién lo aprueba."
      columns={[
        {
          id: "title", header: "Cambio", primary: true, minWidth: 240, sortValue: (row) => row.title,
          cell: (row) => <CellTitle title={row.title} meta={`${row.code} · ${row.category} · ${row.changeType}`} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        { id: "impact", header: "Impacto", hideable: true, sortValue: (row) => row.impact, cell: (row) => row.impact },
        {
          id: "tasks", header: "Tareas", numeric: true, align: "end", hideable: true,
          sortValue: (row) => row.tasks.filter((task) => task.done).length,
          cell: (row) => `${row.tasks.filter((task) => task.done).length}/${row.tasks.length}`,
        },
        {
          id: "approvals", header: "Aprobaciones", numeric: true, align: "end", hideable: true,
          sortValue: (row) => row.approvers.filter((item) => item.status === "APPROVED").length,
          cell: (row) => `${row.approvers.filter((item) => item.status === "APPROVED").length}/${row.approvers.length}`,
        },
      ]}
      actions={(row) => (
        <RowActions canUpdate={initial.access.canUpdate && !["IMPLEMENTED", "VERIFIED", "CLOSED"].includes(row.status)}
          canDelete={initial.access.canDelete && ["DRAFT", "REJECTED"].includes(row.status)} pending={isPending}
          onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
      )}
    />

    <FormModal open={creating || !!editing} title={editing ? "Editar solicitud" : "Nueva solicitud de cambio"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Código (opcional)"><input aria-label="Código" name="code" className="nf-app-input" style={inputStyle} defaultValue={row?.code ?? ""} /></Field><Field label="Impacto"><Picker aria-label="Impacto" name="impact" className="nf-app-input" style={inputStyle} defaultValue={row?.impact ?? ChangeImpact.MEDIUM}>{Object.values(ChangeImpact).map((value) => <option key={value}>{value}</option>)}</Picker></Field></div>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Categoría">
          <Picker aria-label="Categoría" name="category" required className="nf-app-input" style={inputStyle} defaultValue={row?.category ?? DEFAULT_CHANGE_CATEGORY}>
            {changeCategoryOptions(row?.category).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Picker>
        </Field>
        <Field label="Tipo de cambio">
          <Picker aria-label="Tipo de cambio" name="changeType" required className="nf-app-input" style={inputStyle} defaultValue={row?.changeType ?? DEFAULT_CHANGE_TYPE}>
            {changeTypeOptions(row?.changeType).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Picker>
        </Field>
      </div>
      <Field label="Justificación"><textarea aria-label="Motivo" name="reason" required rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.reason ?? ""} /></Field>
      <Field label="Áreas afectadas (separadas por comas)"><input aria-label="Áreas afectadas" name="affectedAreas" className="nf-app-input" style={inputStyle} defaultValue={row?.affectedAreas.join(", ") ?? ""} /></Field>
      {initial.nonconformities.length > 0 && <Field label="No conformidad origen"><Picker aria-label="No conformidad" name="nonconformityId" className="nf-app-input" style={inputStyle} defaultValue={row?.nonconformityId ?? ""}><option value="">Sin vínculo</option>{initial.nonconformities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Picker></Field>}
      <MultiSelect name="processIds" label="Procesos afectados" rows={processRows} initial={row?.processIds} />
      <MultiSelect name="documentIds" label="Documentos afectados" rows={documentRows} initial={row?.documentIds} />
      <MultiSelect name="riskIds" label="Riesgos afectados" rows={riskRows} initial={row?.riskIds} />
      <MultiSelect name="trainingCourseIds" label="Cursos requeridos" rows={courseRows} initial={row?.trainingCourseIds} />
      <MultiSelect name="approverIds" label="Aprobadores" rows={memberRows} initial={row?.approvers.map((item) => item.userId)} />
    </FormModal>

    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.code} · ${detail.title}` : "Cambio"} width={720}>{detail && <div style={{ display: "grid", gap: 18 }}>
      <div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Impacto" value={detail.impact} /><Meta label="Solicitante" value={detail.requesterName} /><Meta label="Áreas" value={detail.affectedAreas.join(" · ")} /></div>
      <Meta label="Justificación" value={detail.reason} />
      <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>Tareas</strong>{initial.access.canUpdate && detail.status !== "CLOSED" && <button type="button" className="nf-app-btn-ghost" onClick={() => addTask(detail)}>Añadir tarea</button>}</div>{detail.tasks.length ? <div style={{ display: "grid", gap: 7, marginTop: 8 }}>{detail.tasks.map((task) => <label key={task.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={task.done} disabled={!initial.access.canUpdate || isPending} onChange={(event) => run(() => toggleChangeTask(task.id, event.target.checked), { onSuccess: () => setDetail(null), successMessage: "Tarea actualizada." })} />{task.title}</label>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin tareas.</p>}</div>
      <div><strong>Aprobadores</strong>{detail.approvers.length ? <div style={{ display: "grid", gap: 7, marginTop: 8 }}>{detail.approvers.map((approval) => <div key={approval.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8, border: "1px solid var(--nf-line)", borderRadius: 8 }}><span style={{ fontSize: 13 }}>{approval.userName}</span><Badge status={approval.status} /></div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin aprobadores; la aprobación puede avanzar sin firmas asignadas.</p>}{detail.approvers.some((item) => item.userId === initial.access.currentUserId && item.status === "PENDING") && initial.access.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 9 }}><button type="button" className="nf-app-btn-primary" onClick={() => decide(detail, "APPROVED")}>Aprobar</button><button type="button" className="nf-app-btn-outline" onClick={() => decide(detail, "REJECTED")}>Rechazar</button></div>}</div>
      {initial.access.canUpdate && (NEXT_STATUS[detail.status] ?? []).length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--nf-line)" }}>{(NEXT_STATUS[detail.status] ?? []).map((status) => <button key={status} type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => transition(detail, status)}>Mover a {status}</button>)}</div>}
    </div>}</Modal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar cambio"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteChangeRequest(confirmDelete.id), {
          onSuccess: () => {
            setDetail((current) => current?.id === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "Cambio eliminado.",
        });
      }}
    >
      ¿Eliminar el cambio <strong>{confirmDelete?.code}</strong>?
    </ConfirmActionModal>
    <PromptActionModal
      open={!!rejectTransition}
      title="Rechazar cambio"
      label="Motivo del rechazo"
      placeholder="Describe por qué se rechaza la solicitud."
      confirmLabel="Rechazar"
      danger
      pending={isPending}
      onCancel={() => setRejectTransition(null)}
      onConfirm={(reason) => {
        if (!rejectTransition) return;
        run(() => transitionChangeRequest(rejectTransition.id, ChangeRequestStatus.REJECTED, reason), {
          onSuccess: () => {
            setDetail(null);
            setRejectTransition(null);
          },
          successMessage: "Cambio rechazado.",
        });
      }}
    />
    <PromptActionModal
      open={!!taskChange}
      title="Nueva tarea de implementación"
      label="Título de la tarea"
      placeholder="Ej. Actualizar procedimiento y comunicar a producción"
      confirmLabel="Añadir tarea"
      multiline={false}
      pending={isPending}
      onCancel={() => setTaskChange(null)}
      onConfirm={(title) => {
        if (!taskChange) return;
        run(() => addChangeTask(taskChange.id, title), {
          onSuccess: () => {
            setDetail(null);
            setTaskChange(null);
          },
          successMessage: "Tarea añadida.",
        });
      }}
    />
    <PromptActionModal
      open={!!decision}
      title={decision?.status === "APPROVED" ? "Aprobar cambio" : "Rechazar aprobación"}
      label={decision?.status === "APPROVED" ? "Motivo / atestación de aprobación" : "Motivo del rechazo"}
      placeholder={decision?.status === "APPROVED" ? "Deja constancia de la revisión realizada." : "Describe por qué rechazas esta aprobación."}
      confirmLabel={decision?.status === "APPROVED" ? "Aprobar" : "Rechazar"}
      danger={decision?.status === "REJECTED"}
      pending={isPending}
      onCancel={() => setDecision(null)}
      onConfirm={(reason) => {
        if (!decision) return;
        run(() => decideChangeApproval(decision.row.id, decision.status, undefined, reason), {
          onSuccess: () => {
            setDetail(null);
            setDecision(null);
          },
          successMessage: "Decisión registrada.",
        });
      }}
    />
  </div>;
}

export function SuppliersLiveClient({ initial }: { initial: SuppliersPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [detail, setDetail] = useState<SupplierRow | null>(null);
  const [evaluating, setEvaluating] = useState<SupplierRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SupplierRow | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    const input: SupplierInput = { code: String(fd.get("code") ?? ""), name: String(fd.get("name") ?? ""), category: String(fd.get("category") ?? ""), criticality: fd.get("criticality") as SupplierCriticality, ownerId: String(fd.get("ownerId") ?? "") || undefined, status: fd.get("status") as SupplierStatus, contactName: String(fd.get("contactName") ?? ""), contactEmail: String(fd.get("contactEmail") ?? ""), notes: String(fd.get("notes") ?? ""), nextReviewDue: String(fd.get("nextReviewDue") ?? ""), documentIds: selected(fd, "documentIds"), riskIds: selected(fd, "riskIds"), nonconformityIds: selected(fd, "nonconformityIds") };
    run(() => editing ? updateSupplier(editing.id, input) : createSupplier(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Proveedor actualizado." : "Proveedor creado." });
  }
  function evaluate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!evaluating) return; const fd = new FormData(event.currentTarget); const score = String(fd.get("score") ?? ""); run(() => registerSupplierEvaluation(evaluating.id, { score: score ? Number(score) : null, outcome: fd.get("outcome") as SupplierEvaluationOutcome, notes: String(fd.get("notes") ?? ""), evaluatedAt: String(fd.get("evaluatedAt") ?? ""), nextReviewDue: String(fd.get("nextReviewDue") ?? "") }), { onSuccess: () => setEvaluating(null), successMessage: "Evaluación registrada y estado actualizado." }); }
  function remove(row: SupplierRow) { setConfirmDelete(row); }
  const row = editing;
  return <div><OperationalHeader title="Proveedores" subtitle="Proveedores externos con criticidad, evaluaciones periódicas y responsable (cláusula 8.4)." canCreate={initial.access.canCreate} actionLabel="Nuevo proveedor" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Proveedores"
      rows={initial.suppliers}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="suppliers"
      searchText={(row) => `${row.code} ${row.name} ${row.category} ${row.ownerName ?? ""}`}
      searchPlaceholder="Buscar por código, nombre o categoría…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "criticality", label: "Criticidad", value: (row) => row.criticality },
        { id: "category", label: "Categoría", value: (row) => row.category, format: (value) => value },
      ]}
      emptyTitle="Todavía no hay proveedores"
      emptyDescription="Registra los proveedores externos que afectan a la conformidad del producto o servicio."
      columns={[
        {
          id: "name", header: "Proveedor", primary: true, minWidth: 220, sortValue: (row) => row.name,
          cell: (row) => <CellTitle title={row.name} meta={`${row.code} · ${row.category}`} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        { id: "criticality", header: "Criticidad", hideable: true, sortValue: (row) => row.criticality, cell: (row) => row.criticality },
        { id: "owner", header: "Responsable", hideable: true, sortValue: (row) => row.ownerName ?? "", cell: (row) => row.ownerName ?? "Sin responsable" },
        { id: "evaluations", header: "Evaluaciones", numeric: true, align: "end", hideable: true, sortValue: (row) => row.evaluations.length, cell: (row) => <CountCell value={row.evaluations.length} /> },
        {
          id: "review", header: "Próxima revisión", numeric: true, hideable: true, sortValue: (row) => row.nextReviewDue ?? "",
          cell: (row) => row.nextReviewDue ? formatDate(row.nextReviewDue) : "—",
        },
      ]}
      actions={(row) => (
        <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
          onEdit={() => setEditing(row)} onDelete={() => remove(row)}
          extra={initial.access.canUpdate ? (
            <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => setEvaluating(row)}>Evaluar</button>
          ) : undefined} />
      )}
    />
    <FormModal open={creating || !!editing} title={editing ? "Editar proveedor" : "Nuevo proveedor"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Código (opcional)"><input aria-label="Código" name="code" className="nf-app-input" style={inputStyle} defaultValue={row?.code ?? ""} /></Field><Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={row?.name ?? ""} /></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Categoría"><Picker aria-label="Categoría" name="category" required className="nf-app-input" style={inputStyle} defaultValue={row?.category ?? DEFAULT_SUPPLIER_CATEGORY}>{supplierCategoryOptions(row?.category).map((option) => <option key={option} value={option}>{option}</option>)}</Picker></Field><Field label="Criticidad"><Picker aria-label="Criticidad" name="criticality" className="nf-app-input" style={inputStyle} defaultValue={row?.criticality ?? SupplierCriticality.MEDIUM}>{Object.values(SupplierCriticality).map((value) => <option key={value}>{value}</option>)}</Picker></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Estado"><div className="nf-app-input" style={{ ...inputStyle, color: "var(--nf-ink-2)" }}>{row?.status ?? SupplierStatus.UNDER_REVIEW}</div><input type="hidden" name="status" value={row?.status ?? SupplierStatus.UNDER_REVIEW} /></Field><Field label="Responsable"><PersonPicker name="ownerId" people={initial.members} defaultValue={row?.ownerId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Contacto"><input aria-label="Nombre de contacto" name="contactName" className="nf-app-input" style={inputStyle} defaultValue={row?.contactName ?? ""} /></Field><Field label="Email"><input aria-label="Correo de contacto" name="contactEmail" type="email" className="nf-app-input" style={inputStyle} defaultValue={row?.contactEmail ?? ""} /></Field></div><Field label="Próxima revisión"><DateField aria-label="Próxima revisión" name="nextReviewDue" className="nf-app-input" style={inputStyle} defaultValue={row?.nextReviewDue?.slice(0, 10) ?? ""} /></Field><Field label="Notas"><textarea aria-label="Notas" name="notes" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.notes ?? ""} /></Field><MultiSelect name="documentIds" label="Documentos" rows={initial.documents.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` }))} initial={row?.documentIds} /><MultiSelect name="riskIds" label="Riesgos" rows={initial.risks.map((item) => ({ id: item.id, label: item.title }))} initial={row?.riskIds} /><MultiSelect name="nonconformityIds" label="No conformidades" rows={initial.nonconformities.map((item) => ({ id: item.id, label: item.title }))} initial={row?.nonconformityIds} /></FormModal>
    <FormModal open={!!evaluating} title={`Evaluar · ${evaluating?.name ?? ""}`} pending={isPending} error={error} onClose={() => setEvaluating(null)} onSubmit={evaluate}><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Puntuación (0-100)"><input aria-label="Puntuación" name="score" type="number" min="0" max="100" className="nf-app-input" style={inputStyle} /></Field><Field label="Resultado"><Picker aria-label="Resultado" name="outcome" className="nf-app-input" style={inputStyle}>{Object.values(SupplierEvaluationOutcome).map((value) => <option key={value}>{value}</option>)}</Picker></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Fecha"><DateField aria-label="Fecha de evaluación" name="evaluatedAt" className="nf-app-input" style={inputStyle} defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field label="Próxima revisión"><DateField aria-label="Próxima revisión" name="nextReviewDue" className="nf-app-input" style={inputStyle} /></Field></div><Field label="Notas"><textarea aria-label="Notas" name="notes" rows={3} className="nf-app-input" style={inputStyle} /></Field></FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Proveedor"} width={680}>{detail && <div style={{ display: "grid", gap: 17 }}><div className="nf-grid-2"><Meta label="Código" value={detail.code} /><Meta label="Estado" value={detail.status} /><Meta label="Contacto" value={detail.contactName} /><Meta label="Email" value={detail.contactEmail} /></div><Meta label="Notas" value={detail.notes} /><div><strong>Historial de evaluaciones</strong>{detail.evaluations.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.evaluations.map((item) => <div key={item.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 9, padding: 10, fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{item.outcome} · {item.score ?? "Sin puntuación"}</strong><span>{formatDate(item.evaluatedAt)}</span></div>{item.notes && <div style={{ marginTop: 5, color: "var(--nf-ink-3)" }}>{item.notes}</div>}</div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin evaluaciones.</p>}</div></div>}</Modal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar proveedor"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteSupplier(confirmDelete.id), {
          onSuccess: () => {
            setDetail((current) => current?.id === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "Proveedor eliminado.",
        });
      }}
    >
      ¿Eliminar el proveedor <strong>{confirmDelete?.name}</strong> y su historial?
    </ConfirmActionModal>
  </div>;
}

export function IntegrationsLiveClient({ initial }: { initial: IntegrationsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<IntegrationRow | null>(null); const [detail, setDetail] = useState<IntegrationRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IntegrationRow | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const input: IntegrationInput = { key: String(fd.get("key") ?? ""), name: String(fd.get("name") ?? ""), provider: String(fd.get("provider") ?? ""), category: String(fd.get("category") ?? ""), description: String(fd.get("description") ?? ""), valueProposition: String(fd.get("valueProposition") ?? ""), status: fd.get("status") as IntegrationStatus, externalAccount: String(fd.get("externalAccount") ?? ""), detailNote: String(fd.get("detailNote") ?? "") }; run(() => editing ? updateIntegration(editing.id, input) : createIntegration(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Integración actualizada." : "Integración registrada." }); }
  function remove(row: IntegrationRow) { setConfirmDelete(row); }
  const row = editing;
  return <div><OperationalHeader title="Integraciones" subtitle="Conectores hacia servicios externos, con su estado y última sincronización." canCreate={initial.access.canManage} actionLabel="Registrar integración" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Integraciones"
      rows={initial.integrations}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="integrations"
      searchText={(row) => `${row.name} ${row.provider} ${row.category} ${row.key} ${row.description ?? ""}`}
      searchPlaceholder="Buscar por nombre, proveedor o clave…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "category", label: "Categoría", value: (row) => row.category, format: (value) => value },
      ]}
      emptyTitle="Todavía no hay integraciones"
      emptyDescription="Conecta servicios externos y deja registrada su última sincronización real."
      columns={[
        {
          id: "name", header: "Integración", primary: true, minWidth: 220, sortValue: (row) => row.name,
          cell: (row) => <CellTitle title={row.name} meta={`${row.category} · ${row.provider}`} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        { id: "key", header: "Clave", hideable: true, sortValue: (row) => row.key, cell: (row) => <code style={{ fontSize: 11 }}>{row.key}</code> },
        {
          id: "sync", header: "Última sincronización", numeric: true, hideable: true, sortValue: (row) => row.lastSyncAt ?? "",
          cell: (row) => row.lastSyncAt ? formatDateTime(row.lastSyncAt) : "Nunca",
        },
      ]}
      actions={(row) => (
        <RowActions canUpdate={initial.access.canManage} canDelete={initial.access.canManage} pending={isPending}
          onEdit={() => setEditing(row)} onDelete={() => remove(row)} />
      )}
    />
    <FormModal open={creating || !!editing} title={editing ? "Editar integración" : "Registrar integración"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><div style={{ padding: 10, borderRadius: 9, background: "var(--nf-warning-subtle)", color: "#7b5310", fontSize: 12 }}>Este registro no establece por sí solo una conexión externa. No introduzcas tokens, contraseñas ni secretos aquí.</div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Clave técnica"><input aria-label="storage_sharepoint" name="key" required className="nf-app-input" style={inputStyle} defaultValue={row?.key ?? ""} placeholder="storage_sharepoint" /></Field><Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={row?.name ?? ""} /></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Proveedor"><input aria-label="Proveedor" name="provider" required className="nf-app-input" style={inputStyle} defaultValue={row?.provider ?? ""} /></Field><Field label="Categoría"><input aria-label="Categoría" name="category" required className="nf-app-input" style={inputStyle} defaultValue={row?.category ?? "Almacenamiento"} /></Field></div><Field label="Estado verificado"><Picker aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? IntegrationStatus.NOT_CONNECTED}>{Object.values(IntegrationStatus).map((value) => <option key={value}>{value}</option>)}</Picker></Field><Field label="Cuenta externa (identificador no secreto)"><input aria-label="Cuenta externa" name="externalAccount" className="nf-app-input" style={inputStyle} defaultValue={row?.externalAccount ?? ""} /></Field><Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field><Field label="Valor para el sistema"><textarea aria-label="Propuesta de valor" name="valueProposition" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.valueProposition ?? ""} /></Field><Field label="Nota técnica"><textarea aria-label="Detalle" name="detailNote" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.detailNote ?? ""} /></Field></FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Integración"} width={680}>{detail && <div style={{ display: "grid", gap: 17 }}><div className="nf-grid-2"><Meta label="Proveedor" value={detail.provider} /><Meta label="Estado" value={detail.status} /><Meta label="Cuenta externa" value={detail.externalAccount} /><Meta label="Conectada desde" value={detail.connectedAt ? formatDateTime(detail.connectedAt) : null} /></div><Meta label="Valor" value={detail.valueProposition} /><Meta label="Nota técnica" value={detail.detailNote} /><div><strong>Ejecuciones de sincronización</strong>{detail.syncRuns.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.syncRuns.map((sync) => <div key={sync.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 9, padding: 10, fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between" }}><Badge status={sync.status} /><span>{formatDateTime(sync.startedAt)}</span></div><div style={{ marginTop: 5, color: "var(--nf-ink-3)" }}>{sync.recordsProcessed} registros · {sync.evidenceCreated} evidencias{sync.errorMessage ? ` · ${sync.errorMessage}` : ""}</div></div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Aún no hay sincronizaciones reportadas por un adaptador.</p>}</div></div>}</Modal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar integración"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteIntegration(confirmDelete.id), {
          onSuccess: () => {
            setDetail((current) => current?.id === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "Integración eliminada.",
        });
      }}
    >
      ¿Eliminar el registro de integración <strong>{confirmDelete?.name}</strong>?
    </ConfirmActionModal>
  </div>;
}
