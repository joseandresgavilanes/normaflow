"use client";

import { useState, type FormEvent } from "react";
import { ManagementReviewStatus, ManagementReviewTopic, Priority } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createManagementReview,
  updateManagementReview,
  deleteManagementReview,
  addReviewInput,
  deleteReviewInput,
  addReviewDecision,
  deleteReviewDecision,
  createReviewAction,
  linkReviewEvidence,
  exportManagementReview,
} from "@/lib/actions/management-review";
import type { ManagementReviewPayload } from "@/lib/server-queries";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { formatDate } from "@/lib/format/datetime";
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

type ReviewRow = ManagementReviewPayload["reviews"][number];

export const TOPIC_LABELS: Record<ManagementReviewTopic, string> = {
  PREVIOUS_REVIEW_FOLLOWUP: "Seguimiento de revisiones previas",
  AUDIT_RESULTS: "Resultados de auditorías",
  CUSTOMER_FEEDBACK: "Satisfacción del cliente",
  PROCESS_PERFORMANCE: "Desempeño de procesos",
  PRODUCT_CONFORMITY: "Conformidad de productos/servicios",
  NONCONFORMITIES_ACTIONS: "No conformidades y acciones correctivas",
  MONITORING_MEASUREMENT: "Resultados de seguimiento y medición",
  EXTERNAL_PROVIDERS: "Desempeño de proveedores externos",
  ADEQUACY_RESOURCES: "Adecuación de los recursos",
  EFFECTIVENESS_RISK_ACTIONS: "Eficacia de acciones frente a riesgos",
  IMPROVEMENT_OPPORTUNITIES: "Oportunidades de mejora",
  RISKS_OPPORTUNITIES: "Riesgos y oportunidades",
  CHANGES_INTERNAL_EXTERNAL: "Cambios internos y externos",
  KPI_RESULTS: "Resultados de KPIs",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<ManagementReviewStatus, string> = {
  PLANNED: "Planificada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function statusBadge(s: ManagementReviewStatus) {
  return s === "COMPLETED" ? "ON_TRACK" : s === "CANCELLED" ? "OFF_TRACK" : s === "IN_PROGRESS" ? "IN_PROGRESS" : "AT_RISK";
}

const NEXT_STATUS: Partial<Record<ManagementReviewStatus, ManagementReviewStatus>> = {
  PLANNED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

function fmtDate(iso: string | null) {
  return iso ? formatDate(iso) : "—";
}

export function ManagementReviewLive({ initial }: { initial: ManagementReviewPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const canManage = initial.access.canManage;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReviewRow | null>(null);
  const [actionDecision, setActionDecision] = useState<ReviewRow["decisions"][number] | null>(null);
  const [exporting, setExporting] = useState(false);
  const detail = detailId ? initial.reviews.find(r => r.id === detailId) ?? null : null;

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      scheduledDate: String(fd.get("scheduledDate") ?? "") || undefined,
      chairId: String(fd.get("chairId") ?? "") || undefined,
      attendees: String(fd.get("attendees") ?? "").split(",").map(s => s.trim()).filter(Boolean),
      participantIds: fd.getAll("participantIds").map(String),
      standards: fd.getAll("standards").map(String),
    };
    run(() => (editing ? updateManagementReview(editing.id, input) : createManagementReview(input)), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: editing ? "Revisión actualizada." : "Revisión creada.",
    });
  }

  function advance(row: ReviewRow) {
    const next = NEXT_STATUS[row.status];
    if (!next) return;
    run(() => updateManagementReview(row.id, { title: row.title, status: next }), {
      successMessage: next === "COMPLETED" ? "Revisión cerrada." : "Revisión en curso.",
    });
  }

  function remove(row: ReviewRow) {
    setConfirmDelete(row);
  }

  function addInput(event: FormEvent<HTMLFormElement>, reviewId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(() => addReviewInput(reviewId, { topic: fd.get("topic") as ManagementReviewTopic, content: String(fd.get("content") ?? ""), auditId: String(fd.get("auditId") ?? "") || undefined, indicatorId: String(fd.get("indicatorId") ?? "") || undefined, riskId: String(fd.get("riskId") ?? "") || undefined, nonconformityId: String(fd.get("nonconformityId") ?? "") || undefined, actionId: String(fd.get("actionId") ?? "") || undefined, capaId: String(fd.get("capaId") ?? "") || undefined }), {
      onSuccess: () => form.reset(),
      successMessage: "Entrada añadida.",
    });
  }

  async function downloadActa(review: ReviewRow) {
    setExporting(true);
    try {
      const result = await exportManagementReview(review.id);
      await downloadQueuedReport(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar el acta PDF."); } finally { setExporting(false); }
  }

  function addDecision(event: FormEvent<HTMLFormElement>, reviewId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(() => addReviewDecision(reviewId, {
      topic: String(fd.get("dtopic") ?? ""),
      decision: String(fd.get("decision") ?? ""),
      ownerId: String(fd.get("ownerId") ?? "") || undefined,
      dueDate: String(fd.get("dueDate") ?? "") || undefined,
    }), { onSuccess: () => form.reset(), successMessage: "Decisión registrada." });
  }

  function saveSummary(reviewId: string, title: string, summary: string) {
    run(() => updateManagementReview(reviewId, { title, summary }), { successMessage: "Resumen guardado." });
  }

  return (
    <div>
      <OperationalHeader
        title="Revisión por la dirección"
        subtitle="Revisiones por la dirección con entradas, decisiones y acciones acordadas (cláusula 9.3)."
        canCreate={canManage}
        actionLabel="Nueva revisión"
        onCreate={() => { setError(""); setCreating(true); }}
      />
      <OperationalMessages error={error} success={success} />

      <EntityTable
          caption="Revisiones por la dirección"
          rows={initial.reviews}
          rowKey={(row) => row.id}
          rowAction={(row) => setDetailId(row.id)}
          storageKey="management-reviews"
          searchText={(row) => `${row.title} ${row.chairName ?? ""}`}
          searchPlaceholder="Buscar por título o presidente…"
          filters={[{ id: "status", label: "Estado", value: (row) => row.status, format: (value) => STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value }]}
          emptyTitle="Todavía no hay revisiones"
          emptyDescription="La revisión por la dirección recoge entradas, decisiones y acciones con trazabilidad."
          columns={[
            {
              id: "title", header: "Revisión", primary: true, minWidth: 240, sortValue: (row) => row.title,
              cell: (row) => <CellTitle title={row.title} meta={`Programada ${fmtDate(row.scheduledDate)}`} />,
            },
            { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={statusBadge(row.status)} label={STATUS_LABELS[row.status]} /> },
            { id: "chair", header: "Presidente", hideable: true, sortValue: (row) => row.chairName ?? "", cell: (row) => row.chairName ?? "Sin presidente" },
            { id: "inputs", header: "Entradas", numeric: true, align: "end", hideable: true, sortValue: (row) => row.inputs.length, cell: (row) => <CountCell value={row.inputs.length} /> },
            { id: "decisions", header: "Decisiones", numeric: true, align: "end", hideable: true, sortValue: (row) => row.decisions.length, cell: (row) => <CountCell value={row.decisions.length} /> },
            { id: "actions", header: "Acciones", numeric: true, align: "end", hideable: true, sortValue: (row) => row.actionCount, cell: (row) => <CountCell value={row.actionCount} /> },
          ]}
          actions={canManage ? (row) => (
            <RowActions canUpdate canDelete pending={isPending} onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
          ) : undefined}
        />

      {/* Create / edit */}
      <FormModal open={creating || !!editing} title={editing ? "Editar revisión" : "Nueva revisión por la dirección"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submitReview}>
        <Field label="Título"><input aria-label="Revisión por la dirección 2026" name="title" className="nf-app-input" style={inputStyle} defaultValue={editing?.title ?? ""} required placeholder="Revisión por la dirección 2026" /></Field>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Fecha programada"><DateField aria-label="Fecha prevista" name="scheduledDate" className="nf-app-input" style={inputStyle} defaultValue={editing?.scheduledDate?.slice(0, 10) ?? ""} /></Field>
          <Field label="Presidente / responsable"><PersonPicker name="chairId" people={initial.members} defaultValue={editing?.chairId ?? ""} placeholder="Sin asignar" ariaLabel="Presidente" style={inputStyle} /></Field>
        </div>
        {initial.standards.length > 0 && <Field label="Normas incluidas"><Picker aria-label="Normas" name="standards" multiple className="nf-app-input" style={{ ...inputStyle, minHeight: 90 }} defaultValue={editing?.standards ?? []}>{initial.standards.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}{s.version ? ` (${s.version})` : ""}</option>)}</Picker><span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>⌘/Ctrl + clic para seleccionar varias.</span></Field>}
        {initial.members.length > 0 && <Field label="Participantes internos"><PersonPicker name="participantIds" people={initial.members} defaultValue={editing?.participants.map(p => p.id) ?? []} multiple placeholder="Sin seleccionar" ariaLabel="Participantes" style={inputStyle} /><span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>Los participantes quedan trazados como miembros activos del tenant.</span></Field>}
        <Field label="Asistentes (separados por comas)"><input aria-label="Dirección general, Calidad, Operaciones" name="attendees" className="nf-app-input" style={inputStyle} defaultValue={editing?.attendees.join(", ") ?? ""} placeholder="Dirección general, Calidad, Operaciones" /></Field>
      </FormModal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail?.title ?? "Revisión"} width={760}>
        {detail && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="nf-grid-2" style={{ gap: 18, flex: 1, minWidth: 240 }}>
                <Meta label="Estado" value={STATUS_LABELS[detail.status]} />
                <Meta label="Presidente" value={detail.chairName ?? "—"} />
                <Meta label="Programada" value={fmtDate(detail.scheduledDate)} />
                <Meta label="Realizada" value={fmtDate(detail.heldAt)} />
                <Meta label="Normas" value={detail.standards.join(" · ") || "—"} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canManage && NEXT_STATUS[detail.status] && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => advance(detail)}>{detail.status === "PLANNED" ? "Iniciar revisión" : "Cerrar revisión"}</button>}
                {initial.access.canExport && <button type="button" className="nf-app-btn-outline" disabled={exporting} onClick={() => downloadActa(detail)}>{exporting ? "Generando…" : "Acta PDF"}</button>}
              </div>
            </div>
            {detail.attendees.length > 0 && <Meta label="Asistentes" value={detail.attendees.join(" · ")} />}
            {detail.participants.length > 0 && <Meta label="Participantes internos" value={detail.participants.map(p => p.name).join(" · ")} />}

            {/* Inputs 9.3.2 */}
            <section>
              <strong style={{ fontSize: 14 }}>Entradas (9.3.2) · {detail.inputs.length}</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {detail.inputs.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin entradas registradas.</p>}
                {detail.inputs.map(i => (
                  <div key={i.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-primary-active)" }}>{TOPIC_LABELS[i.topic]}</span>
                      {canManage && <button type="button" className="nf-app-btn-ghost" style={{ color: "var(--nf-danger-text)" }} disabled={isPending} onClick={() => run(() => deleteReviewInput(i.id))}>Eliminar</button>}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--nf-ink)" }}>{i.content}</p>
                    {(i.auditId || i.indicatorId || i.riskId || i.nonconformityId || i.actionId || i.capaId) && <div style={{ marginTop: 5, fontSize: 11, color: "var(--nf-ink-3)" }}>Fuente vinculada: {i.auditId ? "Auditoría" : i.indicatorId ? "KPI" : i.riskId ? "Riesgo" : i.nonconformityId ? "NC" : i.actionId ? "Acción" : "CAPA"}</div>}
                  </div>
                ))}
              </div>
              {canManage && detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                <form onSubmit={e => addInput(e, detail.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <Picker aria-label="Tema" name="topic" className="nf-app-input" style={inputStyle} defaultValue="AUDIT_RESULTS">
                      {Object.entries(TOPIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Picker>
                    <button type="submit" className="nf-app-btn-outline" disabled={isPending}>Añadir entrada</button>
                  </div>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <Picker aria-label="Vincular auditoría" name="auditId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular auditoría…</option>{initial.sources.audits.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Picker>
                    <Picker aria-label="Vincular KPI" name="indicatorId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular KPI…</option>{initial.sources.indicators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Picker>
                  </div>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <Picker aria-label="Vincular riesgo" name="riskId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular riesgo…</option>{initial.sources.risks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Picker>
                    <Picker aria-label="Vincular NC" name="nonconformityId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular NC…</option>{initial.sources.nonconformities.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Picker>
                  </div>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <Picker aria-label="Vincular acción" name="actionId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular acción…</option>{initial.sources.actions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Picker>
                    <Picker aria-label="Vincular CAPA" name="capaId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Vincular CAPA…</option>{initial.sources.capas.map(item => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</Picker>
                  </div>
                  <textarea aria-label="Resumen / datos de la entrada" name="content" className="nf-app-input" style={inputStyle} rows={2} placeholder="Resumen / datos de la entrada…" required />
                </form>
              )}
            </section>

            {/* Decisions 9.3.3 */}
            <section>
              <strong style={{ fontSize: 14 }}>Decisiones y acciones (9.3.3) · {detail.decisions.length}</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {detail.decisions.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin decisiones registradas.</p>}
                {detail.decisions.map(d => (
                  <div key={d.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{d.topic}</span>
                      {canManage && <button type="button" className="nf-app-btn-ghost" style={{ color: "var(--nf-danger-text)" }} disabled={isPending} onClick={() => run(() => deleteReviewDecision(d.id))}>Eliminar</button>}
                    </div>
                    <p style={{ margin: "4px 0", fontSize: 13, color: "var(--nf-ink)" }}>{d.decision}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 12, color: "var(--nf-ink-3)" }}><span>{d.ownerName ?? "Sin responsable"}{d.dueDate ? ` · vence ${fmtDate(d.dueDate)}` : ""}</span>{initial.access.canCreateAction && !d.actionId && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => setActionDecision(d)}>Crear acción</button>}{d.actionTitle && <span>Acción: {d.actionTitle} · {d.actionStatus}</span>}</div>
                  </div>
                ))}
              </div>
              {canManage && detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                <form onSubmit={e => addDecision(e, detail.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <input aria-label="Tema / asunto" name="dtopic" className="nf-app-input" style={inputStyle} placeholder="Tema / asunto" required />
                    <PersonPicker name="ownerId" people={initial.members} defaultValue="" placeholder="Responsable…" ariaLabel="Responsable" style={inputStyle} />
                  </div>
                  <textarea aria-label="Decisión / acción acordada" name="decision" className="nf-app-input" style={inputStyle} rows={2} placeholder="Decisión / acción acordada…" required />
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <DateField aria-label="Fecha de vencimiento" name="dueDate" className="nf-app-input" style={inputStyle} />
                    <button type="submit" className="nf-app-btn-outline" disabled={isPending}>Registrar decisión</button>
                  </div>
                </form>
              )}
            </section>

            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 14 }}>Evidencias vinculadas · {detail.evidenceLinks.length}</strong>{canManage && <Picker resetOnSelect aria-label="Vincular evidencia" className="nf-app-input" style={{ ...inputStyle, maxWidth: 280 }} defaultValue="" onChange={event => { const evidenceId = event.target.value; if (evidenceId) run(() => linkReviewEvidence(detail.id, evidenceId), { successMessage: "Evidencia vinculada." }); }}><option value="">Vincular evidencia…</option>{initial.evidenceFiles.filter(file => !detail.evidenceLinks.some(link => link.id === file.id)).map(file => <option key={file.id} value={file.id}>{file.title}</option>)}</Picker>}</div>
              {detail.evidenceLinks.length > 0 ? <ul style={{ margin: "9px 0 0" }}>{detail.evidenceLinks.map(link => <li key={link.id}>{link.title} · {link.evidenceType}</li>)}</ul> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin evidencias vinculadas.</p>}
            </section>

            {/* Summary */}
            {canManage && (
              <section>
                <strong style={{ fontSize: 14 }}>Conclusiones</strong>
                <SummaryEditor key={detail.id} initialValue={detail.summary ?? ""} pending={isPending} onSave={value => saveSummary(detail.id, detail.title, value)} />
              </section>
            )}
          </div>
        )}
      </Modal>
      <FormModal open={!!actionDecision} title="Crear acción en Plan de Acción" pending={isPending} error={error} onClose={() => setActionDecision(null)} onSubmit={event => { event.preventDefault(); if (!actionDecision) return; const fd = new FormData(event.currentTarget); run(() => createReviewAction(actionDecision.id, { title: String(fd.get("actionTitle") ?? ""), description: String(fd.get("actionDescription") ?? ""), ownerId: String(fd.get("actionOwnerId") ?? "") || undefined, dueDate: String(fd.get("actionDueDate") ?? "") || undefined, priority: fd.get("actionPriority") as Priority }), { onSuccess: () => setActionDecision(null), successMessage: "Acción creada en Plan de Acción." }); }}><Field label="Acción"><input aria-label="Título de la acción" name="actionTitle" className="nf-app-input" style={inputStyle} defaultValue={actionDecision?.decision ?? ""} required /></Field><Field label="Descripción"><textarea aria-label="Descripción de la acción" name="actionDescription" className="nf-app-input" style={inputStyle} rows={3} /></Field><div className="nf-grid-2" style={{ gap: 8 }}><PersonPicker name="actionOwnerId" people={initial.members} defaultValue={actionDecision?.ownerId ?? ""} placeholder="Responsable…" ariaLabel="Responsable" style={inputStyle} /><Picker aria-label="Prioridad de la acción" name="actionPriority" className="nf-app-input" style={inputStyle} defaultValue={Priority.MEDIUM}>{Object.values(Priority).map(value => <option key={value}>{value}</option>)}</Picker></div><Field label="Fecha objetivo"><DateField aria-label="Vencimiento de la acción" name="actionDueDate" className="nf-app-input" style={inputStyle} /></Field></FormModal>
      <ConfirmActionModal
        open={!!confirmDelete}
        title="Eliminar revisión"
        confirmLabel="Eliminar"
        danger
        pending={isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          run(() => deleteManagementReview(confirmDelete.id), {
            onSuccess: () => {
              setDetailId((current) => current === confirmDelete.id ? null : current);
              setConfirmDelete(null);
            },
            successMessage: "Revisión eliminada.",
          });
        }}
      >
        ¿Eliminar la revisión <strong>{confirmDelete?.title}</strong>?
      </ConfirmActionModal>
    </div>
  );
}

function SummaryEditor({ initialValue, pending, onSave }: { initialValue: string; pending: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <textarea aria-label="Conclusiones generales de la revisión por la dirección" className="nf-app-input" style={inputStyle} rows={3} value={value} onChange={e => setValue(e.target.value)} placeholder="Conclusiones generales de la revisión por la dirección…" />
      <div><button type="button" className="nf-app-btn-outline" disabled={pending} onClick={() => onSave(value)}>Guardar conclusiones</button></div>
    </div>
  );
}
