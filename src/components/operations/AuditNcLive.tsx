"use client";

import { useState, type FormEvent } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { AuditStatus, AuditType, ChecklistItemStatus, FindingSeverity, FindingType, NCSeverity, NCSource, NCStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal, PromptActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  addAuditChecklistItem,
  addNonconformityComment,
  archiveNonconformity,
  transitionAudit,
  closeAuditWithReport,
  linkAuditEvidence,
  exportAuditReport,
  transitionNonconformity,
  createAudit,
  createAuditsBulk,
  createAuditFinding,
  createNonconformity,
  deleteAudit,
  deleteNonconformity,
  deleteNonconformityComment,
  updateAudit,
  updateAuditChecklistItem,
  updateNonconformity,
  restoreNonconformity,
  type AuditInput,
  type BulkAuditInput,
  type NonconformityInput,
} from "@/lib/actions/operations";
import { createCAPAFromFinding } from "@/lib/actions/capa";
import type { AuditsPayload, NonconformitiesPayload } from "@/lib/server-queries";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta, OperationalCard, OperationalGrid,
  OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type AuditRow = AuditsPayload["audits"][number];
type NcRow = NonconformitiesPayload["nonconformities"][number];
type ChecklistRow = AuditRow["checklistItems"][number];
type BulkAuditDraft = {
  id: number;
  title: string;
  type: AuditType;
  standardCode: string;
  plannedDate: string;
  scheduledDate: string;
  auditorId: string;
  programId: string;
};

function emptyBulkAudit(id: number): BulkAuditDraft {
  return { id, title: "", type: AuditType.INTERNAL, standardCode: "", plannedDate: "", scheduledDate: "", auditorId: "", programId: "" };
}

function formatPlanningPeriod(iso: string) {
  return new Date(iso).toLocaleDateString("es", { month: "long", year: "numeric" });
}

export function AuditsLiveClient({ initial }: { initial: AuditsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AuditRow | null>(null);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [checklistAudit, setChecklistAudit] = useState<AuditRow | null>(null);
  const [checklistItem, setChecklistItem] = useState<ChecklistRow | null>(null);
  const [findingAudit, setFindingAudit] = useState<AuditRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AuditRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkAuditDraft[]>([emptyBulkAudit(1)]);
  const [showPlanning, setShowPlanning] = useState(true);
  const [reportAudit, setReportAudit] = useState<AuditRow | null>(null);
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: AuditInput = {
      title: String(fd.get("title") ?? ""), type: fd.get("type") as AuditType, status: fd.get("status") as AuditStatus,
      standardCode: String(fd.get("standardCode") ?? ""), auditorId: String(fd.get("auditorId") ?? "") || undefined,
      auditorExternal: String(fd.get("auditorExternal") ?? ""), plannedDate: String(fd.get("plannedDate") ?? "") || undefined,
      scheduledDate: String(fd.get("scheduledDate") ?? "") || undefined,
      scope: String(fd.get("scope") ?? ""), objectives: String(fd.get("objectives") ?? ""), criteria: String(fd.get("criteria") ?? ""),
      progress: Number(fd.get("progress") ?? 0), programId: String(fd.get("programId") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined,
      startDate: String(fd.get("startDate") ?? "") || undefined,
      endDate: String(fd.get("endDate") ?? "") || undefined,
      auditeeIds: fd.getAll("auditeeIds").map(String),
    };
    run(() => editing ? updateAudit(editing.id, input) : createAudit(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Auditoría actualizada." : "Auditoría creada en Supabase." });
  }

  function updateBulkRow(id: number, field: keyof Omit<BulkAuditDraft, "id">, value: string) {
    setBulkRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: field === "type" ? value as AuditType : value } : row));
  }

  function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inputs: BulkAuditInput[] = bulkRows.map((row) => ({
      title: row.title,
      type: row.type,
      standardCode: row.standardCode,
      plannedDate: row.plannedDate || undefined,
      scheduledDate: row.scheduledDate || undefined,
      auditorId: row.auditorId || undefined,
      programId: row.programId || undefined,
    }));
    run(() => createAuditsBulk(inputs), {
      onSuccess: () => { setBulkOpen(false); setBulkRows([emptyBulkAudit(1)]); },
      successMessage: `${inputs.length} auditoría${inputs.length === 1 ? "" : "s"} creada${inputs.length === 1 ? "" : "s"} en bloque.`,
    });
  }

  function submitChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!checklistAudit) return;
    const fd = new FormData(event.currentTarget);
    run(() => addAuditChecklistItem(checklistAudit.id, { clauseCode: String(fd.get("clauseCode") ?? ""), clauseId: String(fd.get("clauseId") ?? "") || undefined, question: String(fd.get("question") ?? ""), expected: String(fd.get("expected") ?? "") }), { onSuccess: () => setChecklistAudit(null), successMessage: "Pregunta añadida." });
  }

  function submitFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!findingAudit) return;
    const fd = new FormData(event.currentTarget);
    run(() => createAuditFinding(findingAudit.id, { title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), type: fd.get("type") as FindingType, severity: fd.get("severity") as FindingSeverity, clauseCode: String(fd.get("clauseCode") ?? ""), evidenceUrl: String(fd.get("evidenceUrl") ?? "") }), { onSuccess: () => setFindingAudit(null), successMessage: "Hallazgo registrado." });
  }

  function submitChecklistResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!checklistItem) return;
    const fd = new FormData(event.currentTarget);
    run(() => updateAuditChecklistItem(checklistItem.id, {
      status: fd.get("status") as ChecklistItemStatus,
      response: String(fd.get("response") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      evidenceUrl: String(fd.get("evidenceUrl") ?? ""),
    }), { onSuccess: () => setChecklistItem(null), successMessage: "Respuesta de checklist guardada." });
  }

  function remove(row: AuditRow) { setConfirmDelete(row); }
  async function downloadReport(audit: AuditRow) {
    setExportingReport(audit.id);
    try { const result = await exportAuditReport(audit.id); await downloadQueuedReport(result.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar el informe."); } finally { setExportingReport(null); }
  }
  const row = editing;
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  const plannedAudits = initial.audits.filter((audit) => audit.plannedDate).sort((a, b) => new Date(a.plannedDate!).getTime() - new Date(b.plannedDate!).getTime());
  const planningGroups = Array.from(new Set(plannedAudits.map((audit) => `${new Date(audit.plannedDate!).getFullYear()}-${new Date(audit.plannedDate!).getMonth()}`))).map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { key, date: new Date(year, month, 1), audits: plannedAudits.filter((audit) => { const date = new Date(audit.plannedDate!); return date.getFullYear() === year && date.getMonth() === month; }) };
  });
  return <div>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <OperationalHeader title="Auditorías" subtitle={`${initial.audits.length} auditorías persistidas`} canCreate={initial.access.canCreate} actionLabel="Nueva auditoría" onCreate={() => { setError(""); setCreating(true); }} />
      {initial.access.canCreate && <button type="button" className="nf-app-btn-ghost" onClick={() => { setError(""); setBulkOpen(true); }}>Crear varias / planificar</button>}
    </div>
    <OperationalMessages error={error} success={success} />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
      <button type="button" className={showPlanning ? "nf-app-btn-primary nf-app-btn-sm" : "nf-app-btn-ghost nf-app-btn-sm"} onClick={() => setShowPlanning(true)}>Cronograma de planeamiento</button>
      <button type="button" className={!showPlanning ? "nf-app-btn-primary nf-app-btn-sm" : "nf-app-btn-ghost nf-app-btn-sm"} onClick={() => setShowPlanning(false)}>Lista de ejecución</button>
    </div>
    {showPlanning ? <section style={{ border: "1px solid var(--nf-line)", borderRadius: 14, padding: 16, background: "linear-gradient(135deg, #f7f9ff, #fff)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0, fontSize: 18 }}>Cronograma de planeamiento</h2><p style={{ margin: "5px 0 0", color: "var(--nf-ink-3)", fontSize: 12 }}>Ordenado por la fecha en que se planea realizar cada auditoría. La fecha de ejecución se conserva por separado.</p></div>
        <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{plannedAudits.length} con fecha · {initial.audits.length - plannedAudits.length} sin planificar</span>
      </div>
      {planningGroups.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 12, marginTop: 16 }}>{planningGroups.map((group) => <div key={group.key} style={{ border: "1px solid var(--nf-line)", borderRadius: 11, background: "var(--nf-surface)", padding: 12 }}><div style={{ textTransform: "capitalize", fontSize: 12, fontWeight: 800, color: "var(--nf-primary-active)", marginBottom: 9 }}>{formatPlanningPeriod(group.date.toISOString())}</div><div style={{ display: "grid", gap: 8 }}>{group.audits.map((audit) => <button key={audit.id} type="button" onClick={() => setDetail(audit)} style={{ textAlign: "left", border: "1px solid #e8edf6", borderRadius: 9, background: "var(--nf-surface-muted)", padding: "9px 10px", cursor: "pointer" }}><div style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>{audit.title}</div><div style={{ marginTop: 4, fontSize: 11, color: "var(--nf-ink-3)" }}>{new Date(audit.plannedDate!).toLocaleDateString("es")} · {audit.type} · {audit.status}</div></button>)}</div></div>)}</div> : <EmptyOperational>Aún no hay fechas de planeamiento. Crea o edita auditorías para construir el cronograma.</EmptyOperational>}
    </section> : initial.audits.length === 0 ? <EmptyOperational>No hay auditorías registradas.</EmptyOperational> : <OperationalGrid>{initial.audits.map((audit) => <OperationalCard key={audit.id} onClick={() => setDetail(audit)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)" }}>{audit.type} · {audit.standardCode ?? "Sin norma"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{audit.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{audit.auditorName ?? audit.auditorExternal ?? "Sin auditor"}</div></div><Badge status={audit.status} /></div>
      <div style={{ marginTop: 13, height: 7, borderRadius: 99, background: "var(--nf-surface-selected)", overflow: "hidden" }}><div style={{ width: `${audit.progress}%`, height: "100%", background: "var(--nf-success)" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "var(--nf-ink-3)" }}><span>{audit.progress}%</span><span>{audit.findings.length} hallazgos · {audit.nonconformityCount} NC</span></div>
      <div style={{ marginTop: 7, fontSize: 11, color: "var(--nf-ink-3)" }}>Planeamiento: {audit.plannedDate ? new Date(audit.plannedDate).toLocaleDateString("es") : "sin fecha"} · Ejecución: {audit.scheduledDate ? new Date(audit.scheduledDate).toLocaleDateString("es") : "sin fecha"}</div><CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(audit); }} onDelete={() => remove(audit)} />
    </OperationalCard>)}</OperationalGrid>}
    <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Crear y planificar auditorías en bloque" width={960}>
      <form onSubmit={submitBulk} className="nf-modal-form">
        <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-3)" }}>Agrega varias auditorías con sus fechas de planeamiento, ejecución, programa y auditor responsable. Todas quedarán en estado Planificada.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {bulkRows.map((row, index) => <div key={row.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 11, padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 13 }}>Auditoría {index + 1}</strong>{bulkRows.length > 1 && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger" onClick={() => setBulkRows((rows) => rows.filter((item) => item.id !== row.id))}>Quitar</button>}</div>
            <div className="nf-grid-2" style={{ gap: 10 }}>
              <Field label="Título"><input aria-label="Auditoría del proceso" className="nf-app-input" style={inputStyle} value={row.title} onChange={(event) => updateBulkRow(row.id, "title", event.target.value)} required placeholder="Auditoría del proceso…" /></Field>
              <Field label="Tipo"><select aria-label="Tipo" className="nf-app-input" style={inputStyle} value={row.type} onChange={(event) => updateBulkRow(row.id, "type", event.target.value)}>{Object.values(AuditType).map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Programa"><select aria-label="Programa" className="nf-app-input" style={inputStyle} value={row.programId} onChange={(event) => updateBulkRow(row.id, "programId", event.target.value)}><option value="">Sin programa</option>{initial.programs.map((program) => <option key={program.id} value={program.id}>{program.year} · {program.title}</option>)}</select></Field>
              <Field label="Auditor interno"><select aria-label="Auditor" className="nf-app-input" style={inputStyle} value={row.auditorId} onChange={(event) => updateBulkRow(row.id, "auditorId", event.target.value)}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
              <Field label="Fecha de planeamiento"><input aria-label="Fecha planificada" type="date" className="nf-app-input" style={inputStyle} value={row.plannedDate} onChange={(event) => updateBulkRow(row.id, "plannedDate", event.target.value)} /></Field>
              <Field label="Fecha de ejecución estimada"><input aria-label="Fecha prevista" type="date" className="nf-app-input" style={inputStyle} value={row.scheduledDate} onChange={(event) => updateBulkRow(row.id, "scheduledDate", event.target.value)} /></Field>
              <Field label="Norma"><input aria-label="Código de norma" className="nf-app-input" style={inputStyle} value={row.standardCode} onChange={(event) => updateBulkRow(row.id, "standardCode", event.target.value)} /></Field>
            </div>
          </div>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="nf-app-btn-ghost" onClick={() => setBulkRows((rows) => [...rows, emptyBulkAudit(Math.max(...rows.map((row) => row.id), 0) + 1)])}>+ Agregar otra auditoría</button>
          <div className="nf-modal-actions" style={{ marginTop: 0 }}><button type="button" className="nf-app-btn-ghost" onClick={() => setBulkOpen(false)} disabled={isPending}>Cancelar</button><button type="submit" className="nf-app-btn-primary" disabled={isPending}>{isPending ? "Creando…" : `Crear ${bulkRows.length} auditoría${bulkRows.length === 1 ? "" : "s"}`}</button></div>
        </div>
        {error && <div className="nf-modal-error">{error}</div>}
      </form>
    </Modal>
    <FormModal open={creating || !!editing} title={editing ? "Editar auditoría" : "Nueva auditoría"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} required /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><select aria-label="Tipo" name="type" className="nf-app-input" style={inputStyle} defaultValue={row?.type ?? AuditType.INTERNAL}>{Object.values(AuditType).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? AuditStatus.PLANNED}>{Object.values(AuditStatus).map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Norma"><input aria-label="ISO_9001" name="standardCode" className="nf-app-input" style={inputStyle} placeholder="ISO_9001" defaultValue={row?.standardCode ?? ""} /></Field><Field label="Fecha de planeamiento"><input aria-label="Fecha planificada" name="plannedDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.plannedDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Proceso auditado"><select aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={row?.processId ?? ""}><option value="">Sin proceso</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code} · {process.name}</option>)}</select></Field><Field label="Fecha de ejecución estimada"><input aria-label="Fecha prevista" name="scheduledDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.scheduledDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Fecha de inicio"><input aria-label="Fecha de inicio" name="startDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.startDate?.slice(0, 10) ?? ""} /></Field><Field label="Fecha de fin"><input aria-label="Fecha de fin" name="endDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.endDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Auditor interno"><select aria-label="Auditor" name="auditorId" className="nf-app-input" style={inputStyle} defaultValue={row?.auditorId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Auditor externo"><input aria-label="Auditor externo" name="auditorExternal" className="nf-app-input" style={inputStyle} defaultValue={row?.auditorExternal ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Programa"><select aria-label="Programa" name="programId" className="nf-app-input" style={inputStyle} defaultValue={row?.programId ?? ""}><option value="">Sin programa</option>{initial.programs.map((program) => <option key={program.id} value={program.id}>{program.year} · {program.title}</option>)}</select></Field><Field label="Progreso"><input aria-label="Progreso" name="progress" type="number" min="0" max="100" className="nf-app-input" style={inputStyle} defaultValue={row?.progress ?? 0} /></Field></div>
      <Field label="Auditados"><select aria-label="Auditados" name="auditeeIds" multiple className="nf-app-input" style={{ ...inputStyle, minHeight: 88 }} defaultValue={row?.participants.map((participant) => participant.id) ?? []}>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
      <Field label="Alcance"><textarea aria-label="Alcance" name="scope" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.scope ?? ""} /></Field><Field label="Objetivos"><textarea aria-label="Objetivos" name="objectives" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.objectives ?? ""} /></Field><Field label="Criterios"><textarea aria-label="Criterios" name="criteria" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.criteria ?? ""} /></Field>
    </FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? "Auditoría"} width={720}>{detail && <div style={{ display: "grid", gap: 18 }}>
      <div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Programa" value={detail.programTitle} /><Meta label="Proceso" value={detail.processName} /><Meta label="Norma" value={detail.standardCode} /><Meta label="Auditor" value={detail.auditorName ?? detail.auditorExternal} /><Meta label="Auditados" value={detail.participants.map((participant) => participant.name).join(", ") || "Sin registrar"} /><Meta label="Inicio" value={detail.startDate ? new Date(detail.startDate).toLocaleDateString("es") : "Sin fecha"} /><Meta label="Fin" value={detail.endDate ? new Date(detail.endDate).toLocaleDateString("es") : "Sin fecha"} /><Meta label="Planeamiento" value={detail.plannedDate ? new Date(detail.plannedDate).toLocaleDateString("es") : "Sin fecha"} /><Meta label="Ejecución estimada" value={detail.scheduledDate ? new Date(detail.scheduledDate).toLocaleDateString("es") : "Sin fecha"} /><Meta label="Alcance" value={detail.scope} /><Meta label="Criterios" value={detail.criteria} /></div>
      {initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && detail.status !== AuditStatus.CANCELLED && (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => detail.status === AuditStatus.PLANNED ? run(() => transitionAudit(detail.id, AuditStatus.IN_PROGRESS), { onSuccess: () => setDetail(null), successMessage: "Auditoría en curso." }) : setReportAudit(detail)}>
            {detail.status === AuditStatus.PLANNED ? "Iniciar auditoría" : "Generar informe y cerrar"}
          </button>
        </div>
      )}
      {detail.status === AuditStatus.COMPLETED && initial.access.canExport && <button type="button" className="nf-app-btn-outline" disabled={exportingReport === detail.id} onClick={() => downloadReport(detail)}>{exportingReport === detail.id ? "Generando…" : "Informe PDF"}</button>}
      <div><div style={{ display: "flex", justifyContent: "space-between" }}><strong>Checklist ({detail.checklistItems.length})</strong>{initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && <button className="nf-app-btn-ghost" onClick={() => { setDetail(null); setChecklistAudit(detail); }}>Añadir pregunta</button>}</div>{detail.checklistItems.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.checklistItems.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 9, border: "1px solid var(--nf-line)", borderRadius: 9 }}><span style={{ fontSize: 13 }}>{item.clauseCode ? `${item.clauseCode} · ` : ""}{item.clauseName ? `${item.clauseName} · ` : ""}{item.question} — {item.status}</span>{initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && <button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setChecklistItem(item); }}>Responder</button>}</div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin preguntas.</p>}</div>
      <div><div style={{ display: "flex", justifyContent: "space-between" }}><strong>Evidencia revisada ({detail.evidenceLinks.length})</strong>{initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && <select aria-label="Vincular evidencia" className="nf-app-input" style={{ ...inputStyle, maxWidth: 260 }} defaultValue="" onChange={(event) => { const evidenceId = event.target.value; if (evidenceId) run(() => linkAuditEvidence(detail.id, evidenceId), { successMessage: "Evidencia vinculada." }); event.currentTarget.value = ""; }}><option value="">Vincular evidencia…</option>{initial.evidenceFiles.filter((file) => !detail.evidenceLinks.some((link) => link.id === file.id)).map((file) => <option key={file.id} value={file.id}>{file.title}</option>)}</select>}</div>{detail.evidenceLinks.length ? <ul style={{ margin: "10px 0 0" }}>{detail.evidenceLinks.map((link) => <li key={link.id}>{link.title} · {link.evidenceType}</li>)}</ul> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>No se han vinculado evidencias del repositorio.</p>}</div>
      <div><div style={{ display: "flex", justifyContent: "space-between" }}><strong>Hallazgos ({detail.findings.length})</strong>{initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && <button className="nf-app-btn-ghost" onClick={() => { setDetail(null); setFindingAudit(detail); }}>Registrar hallazgo</button>}</div>{detail.findings.length ? <ul>{detail.findings.map((item) => <li key={item.id}>{item.title} · {item.type} · {item.severity} · {item.capaCode ? `CAPA ${item.capaCode} (${item.capaStage})` : initial.access.canConvertFinding ? <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => run(() => createCAPAFromFinding(item.id), { successMessage: "Hallazgo convertido en CAPA." })}>Convertir a CAPA</button> : "CAPA pendiente"}</li>)}</ul> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin hallazgos.</p>}</div>
      {detail.reportSummary && <div className="nf-grid-2"><Meta label="Resumen del informe" value={detail.reportSummary} /><Meta label="Conclusión" value={detail.reportConclusion} /><Meta label="Cerrada por" value={detail.closedByName} /></div>}
    </div>}</Modal>
    <FormModal open={!!checklistAudit} title="Nueva pregunta de checklist" pending={isPending} error={error} onClose={() => setChecklistAudit(null)} onSubmit={submitChecklist}><Field label="Cláusula ISO"><select aria-label="Seleccionar cláusula" name="clauseId" className="nf-app-input" style={inputStyle} defaultValue=""><option value="">Seleccionar cláusula…</option>{initial.clauses.map((clause) => <option key={clause.id} value={clause.id}>{clause.standardCode} · {clause.code} · {clause.title}</option>)}</select></Field><Field label="Código de cláusula (opcional)"><input aria-label="Código de cláusula" name="clauseCode" className="nf-app-input" style={inputStyle} /></Field><Field label="Pregunta"><textarea aria-label="Pregunta" name="question" required rows={3} className="nf-app-input" style={inputStyle} /></Field><Field label="Resultado esperado"><textarea aria-label="Resultado esperado" name="expected" rows={2} className="nf-app-input" style={inputStyle} /></Field></FormModal>
    <FormModal open={!!checklistItem} title="Responder checklist" pending={isPending} error={error} onClose={() => { setChecklistItem(null); setError(""); }} onSubmit={submitChecklistResponse}><Field label="Pregunta"><div style={{ fontSize: 13, fontWeight: 600 }}>{checklistItem?.question}</div></Field><Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.status ?? ChecklistItemStatus.PENDING}>{Object.values(ChecklistItemStatus).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Respuesta"><textarea aria-label="Respuesta" name="response" rows={3} className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.response ?? ""} /></Field><Field label="Notas"><textarea aria-label="Notas" name="notes" rows={2} className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.notes ?? ""} /></Field><Field label="URL de evidencia"><input aria-label="Enlace a la evidencia" name="evidenceUrl" className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.evidenceUrl ?? ""} /></Field></FormModal>
    <FormModal open={!!findingAudit} title="Registrar hallazgo" pending={isPending} error={error} onClose={() => setFindingAudit(null)} onSubmit={submitFinding}><Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><select aria-label="Tipo" name="type" className="nf-app-input" style={inputStyle}>{Object.values(FindingType).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Severidad"><select aria-label="Severidad" name="severity" className="nf-app-input" style={inputStyle}>{Object.values(FindingSeverity).map((value) => <option key={value}>{value}</option>)}</select></Field></div><Field label="Cláusula"><input aria-label="Código de cláusula" name="clauseCode" className="nf-app-input" style={inputStyle} /></Field><Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} /></Field><Field label="URL de evidencia"><input aria-label="Enlace a la evidencia" name="evidenceUrl" className="nf-app-input" style={inputStyle} /></Field></FormModal>
    <FormModal open={!!reportAudit} title="Generar informe y cerrar auditoría" pending={isPending} error={error} onClose={() => setReportAudit(null)} onSubmit={(event) => { event.preventDefault(); if (!reportAudit) return; const fd = new FormData(event.currentTarget); run(() => closeAuditWithReport(reportAudit.id, { summary: String(fd.get("summary") ?? ""), conclusion: String(fd.get("conclusion") ?? "") }), { onSuccess: () => { setReportAudit(null); setDetail(null); }, successMessage: "Auditoría cerrada con informe." }); }}><p style={{ margin: 0, color: "var(--nf-ink-3)", fontSize: 13 }}>El cierre exige checklist completamente revisado y plan de acción para todo hallazgo crítico.</p><Field label="Resumen ejecutivo"><textarea aria-label="Resumen" name="summary" required rows={4} className="nf-app-input" style={inputStyle} defaultValue={reportAudit?.reportSummary ?? ""} /></Field><Field label="Conclusión"><textarea aria-label="Conclusión" name="conclusion" required rows={4} className="nf-app-input" style={inputStyle} defaultValue={reportAudit?.reportConclusion ?? ""} /></Field></FormModal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar auditoría"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteAudit(confirmDelete.id), {
          onSuccess: () => {
            setDetail((current) => current?.id === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "Auditoría eliminada.",
        });
      }}
    >
      ¿Eliminar la auditoría <strong>{confirmDelete?.title}</strong>?
    </ConfirmActionModal>
  </div>;
}

export function NonconformitiesLiveClient({ initial }: { initial: NonconformitiesPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<NcRow | null>(null); const [detailId, setDetailId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<NcRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<NcRow | null>(null);
  const detail = detailId ? initial.nonconformities.find((n) => n.id === detailId) ?? null : null;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const input: NonconformityInput = { title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), source: fd.get("source") as NCSource, severity: fd.get("severity") as NCSeverity, status: fd.get("status") as NCStatus, ownerId: String(fd.get("ownerId") ?? "") || undefined, rootCause: String(fd.get("rootCause") ?? ""), dueDate: String(fd.get("dueDate") ?? "") || undefined, auditId: String(fd.get("auditId") ?? "") || undefined, findingId: String(fd.get("findingId") ?? "") || undefined, effectivenessValidated: fd.get("effectivenessValidated") === "on" }; run(() => editing ? updateNonconformity(editing.id, input) : createNonconformity(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "NC actualizada." : "NC creada en Supabase." }); }
  function remove(row: NcRow) { setConfirmDelete(row); }
  const row = editing;
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  function nextStatus(status: NCStatus) {
    if (status === NCStatus.OPEN) return NCStatus.IN_PROGRESS;
    if (status === NCStatus.IN_PROGRESS) return NCStatus.PENDING_VALIDATION;
    if (status === NCStatus.PENDING_VALIDATION) return NCStatus.CLOSED;
    return null;
  }
  return <div><OperationalHeader title="No conformidades" subtitle={`${initial.nonconformities.length} NC persistidas`} canCreate={initial.access.canCreate} actionLabel="Nueva NC" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    {initial.nonconformities.length === 0 ? <EmptyOperational>No hay no conformidades registradas.</EmptyOperational> : <OperationalGrid>{initial.nonconformities.map((nc) => <OperationalCard key={nc.id} onClick={() => setDetailId(nc.id)}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)" }}>{nc.source} · {nc.severity}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{nc.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{nc.auditTitle ?? "Sin auditoría"} · {nc.ownerName ?? "Sin responsable"}</div></div><Badge status={nc.status} /></div><div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{nc.dueDate ? `Vence ${new Date(nc.dueDate).toLocaleDateString("es")}` : "Sin vencimiento"} · {nc.actionCount} acciones</div><CardActions canUpdate={initial.access.canUpdate && nc.status !== NCStatus.ARCHIVED} canDelete={initial.access.canDelete && nc.status !== NCStatus.ARCHIVED} pending={isPending} onEdit={() => { setError(""); setEditing(nc); }} onDelete={() => remove(nc)} /></OperationalCard>)}</OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar NC" : "Nueva NC"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Origen"><select aria-label="Fuente" name="source" className="nf-app-input" style={inputStyle} defaultValue={row?.source ?? NCSource.INTERNAL_AUDIT}>{Object.values(NCSource).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Severidad"><select aria-label="Severidad" name="severity" className="nf-app-input" style={inputStyle} defaultValue={row?.severity ?? NCSeverity.MINOR}>{Object.values(NCSeverity).map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Estado"><div className="nf-app-input" style={{ ...inputStyle, color: "var(--nf-ink-3)" }}>{row?.status ?? NCStatus.OPEN}<input type="hidden" name="status" value={row?.status ?? NCStatus.OPEN} /></div></Field><Field label="Responsable"><select aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={row?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Auditoría"><select aria-label="Auditoría" name="auditId" className="nf-app-input" style={inputStyle} defaultValue={row?.auditId ?? ""}><option value="">Sin auditoría</option>{initial.audits.map((audit) => <option key={audit.id} value={audit.id}>{audit.title}</option>)}</select></Field><Field label="Hallazgo"><select aria-label="Hallazgo" name="findingId" className="nf-app-input" style={inputStyle} defaultValue={row?.findingId ?? ""}><option value="">Sin hallazgo</option>{initial.findings.map((finding) => <option key={finding.id} value={finding.id}>{finding.title}</option>)}</select></Field></div><Field label="Fecha objetivo"><input aria-label="Fecha de vencimiento" name="dueDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.dueDate?.slice(0, 10) ?? ""} /></Field><Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field><Field label="Causa raíz"><textarea aria-label="Causa raíz" name="rootCause" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.rootCause ?? ""} /></Field><label style={{ fontSize: 13 }}><input name="effectivenessValidated" type="checkbox" defaultChecked={row?.effectivenessValidated ?? false} /> Eficacia validada</label></FormModal>
    <Modal open={!!detail} onClose={() => { setDetailId(null); setCommentText(""); }} title={detail?.title ?? "NC"} width={650}>{detail && <div style={{ display: "grid", gap: 18 }}><div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Severidad" value={detail.severity} /><Meta label="Auditoría" value={detail.auditTitle} /><Meta label="Hallazgo" value={detail.findingTitle} /></div><Meta label="Descripción" value={detail.description} /><Meta label="Causa raíz" value={detail.rootCause} /><Meta label="Eficacia" value={detail.effectivenessValidated ? "Validada" : "Pendiente"} />
      {initial.access.canUpdate && detail.status !== NCStatus.ARCHIVED && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {nextStatus(detail.status) && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => run(() => transitionNonconformity(detail.id, nextStatus(detail.status)!), { onSuccess: () => setDetailId(null), successMessage: "Estado de NC actualizado." })}>Mover a {nextStatus(detail.status)}</button>}
        {detail.status === NCStatus.CLOSED && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => setArchiveTarget(detail)}>Archivar NC</button>}
      </div>}
      {initial.access.canUpdate && detail.status === NCStatus.ARCHIVED && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => restoreNonconformity(detail.id), { onSuccess: () => setDetailId(null), successMessage: "NC restaurada." })}>Restaurar NC</button>}
      <section>
        <strong style={{ fontSize: 14 }}>Comentarios · {detail.comments.length}</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {detail.comments.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin comentarios. Registra el seguimiento de esta no conformidad.</p>}
          {detail.comments.map((c) => (
            <div key={c.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-primary-active)" }}>{c.authorName}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{new Date(c.createdAt).toLocaleString("es")}</span>
                  {initial.access.canUpdate && <button type="button" className="nf-app-btn-ghost" style={{ color: "var(--nf-danger-text)", padding: "2px 6px" }} disabled={isPending} onClick={() => run(() => deleteNonconformityComment(c.id))}>Eliminar</button>}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--nf-ink)" }}>{c.content}</p>
            </div>
          ))}
        </div>
        {initial.access.canUpdate && (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <textarea aria-label="Añadir comentario de seguimiento" value={commentText} onChange={(e) => setCommentText(e.target.value)} className="nf-app-input" style={inputStyle} rows={2} placeholder="Añadir comentario de seguimiento…" />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="nf-app-btn-outline" disabled={isPending || !commentText.trim()} onClick={() => run(() => addNonconformityComment(detail.id, commentText), { onSuccess: () => setCommentText(""), successMessage: "Comentario añadido." })}>Comentar</button>
            </div>
          </div>
        )}
      </section>
    </div>}</Modal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar no conformidad"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteNonconformity(confirmDelete.id), {
          onSuccess: () => {
            setDetailId((current) => current === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "NC eliminada.",
        });
      }}
    >
      ¿Eliminar la NC <strong>{confirmDelete?.title}</strong>?
    </ConfirmActionModal>
    <PromptActionModal open={!!archiveTarget} title="Archivar no conformidad" label="Motivo del archivo" placeholder="Indica por qué se archiva esta NC." confirmLabel="Archivar" pending={isPending} onCancel={() => setArchiveTarget(null)} onConfirm={(reason) => { if (!archiveTarget) return; run(() => archiveNonconformity(archiveTarget.id, reason), { onSuccess: () => { setArchiveTarget(null); setDetailId(null); }, successMessage: "NC archivada." }); }} />
  </div>;
}
