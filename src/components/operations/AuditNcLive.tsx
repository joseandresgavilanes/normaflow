"use client";

import { useState, type FormEvent } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { AuditStatus, AuditType, ChecklistItemStatus, FindingSeverity, FindingType, NCSeverity, NCSource, NCStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useServerAction } from "@/hooks/useServerAction";
import {
  addAuditChecklistItem,
  addNonconformityComment,
  transitionAudit,
  createAudit,
  createAuditFinding,
  createNonconformity,
  deleteAudit,
  deleteNonconformity,
  deleteNonconformityComment,
  updateAudit,
  updateAuditChecklistItem,
  updateNonconformity,
  type AuditInput,
  type NonconformityInput,
} from "@/lib/actions/operations";
import type { AuditsPayload, NonconformitiesPayload } from "@/lib/server-queries";
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta, OperationalCard, OperationalGrid,
  OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type AuditRow = AuditsPayload["audits"][number];
type NcRow = NonconformitiesPayload["nonconformities"][number];
type ChecklistRow = AuditRow["checklistItems"][number];

export function AuditsLiveClient({ initial }: { initial: AuditsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AuditRow | null>(null);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [checklistAudit, setChecklistAudit] = useState<AuditRow | null>(null);
  const [checklistItem, setChecklistItem] = useState<ChecklistRow | null>(null);
  const [findingAudit, setFindingAudit] = useState<AuditRow | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: AuditInput = {
      title: String(fd.get("title") ?? ""), type: fd.get("type") as AuditType, status: fd.get("status") as AuditStatus,
      standardCode: String(fd.get("standardCode") ?? ""), auditorId: String(fd.get("auditorId") ?? "") || undefined,
      auditorExternal: String(fd.get("auditorExternal") ?? ""), scheduledDate: String(fd.get("scheduledDate") ?? "") || undefined,
      scope: String(fd.get("scope") ?? ""), objectives: String(fd.get("objectives") ?? ""), criteria: String(fd.get("criteria") ?? ""),
      progress: Number(fd.get("progress") ?? 0), programId: String(fd.get("programId") ?? "") || undefined,
    };
    run(() => editing ? updateAudit(editing.id, input) : createAudit(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Auditoría actualizada." : "Auditoría creada en Supabase." });
  }

  function submitChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!checklistAudit) return;
    const fd = new FormData(event.currentTarget);
    run(() => addAuditChecklistItem(checklistAudit.id, { clauseCode: String(fd.get("clauseCode") ?? ""), question: String(fd.get("question") ?? ""), expected: String(fd.get("expected") ?? "") }), { onSuccess: () => setChecklistAudit(null), successMessage: "Pregunta añadida." });
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

  function remove(row: AuditRow) { if (window.confirm(`¿Eliminar la auditoría “${row.title}”?`)) run(() => deleteAudit(row.id), { successMessage: "Auditoría eliminada." }); }
  const row = editing;
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  return <div>
    <OperationalHeader title="Auditorías" subtitle={`${initial.audits.length} auditorías persistidas`} canCreate={initial.access.canCreate} actionLabel="Nueva auditoría" onCreate={() => { setError(""); setCreating(true); }} />
    <OperationalMessages error={error} success={success} />
    {initial.audits.length === 0 ? <EmptyOperational>No hay auditorías registradas.</EmptyOperational> : <OperationalGrid>{initial.audits.map((audit) => <OperationalCard key={audit.id} onClick={() => setDetail(audit)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)" }}>{audit.type} · {audit.standardCode ?? "Sin norma"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{audit.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{audit.auditorName ?? audit.auditorExternal ?? "Sin auditor"}</div></div><Badge status={audit.status} /></div>
      <div style={{ marginTop: 13, height: 7, borderRadius: 99, background: "#e7edf4", overflow: "hidden" }}><div style={{ width: `${audit.progress}%`, height: "100%", background: "#16A34A" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "var(--nf-ink-3)" }}><span>{audit.progress}%</span><span>{audit.findings.length} hallazgos · {audit.nonconformityCount} NC</span></div>
      <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(audit); }} onDelete={() => remove(audit)} />
    </OperationalCard>)}</OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar auditoría" : "Nueva auditoría"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input name="title" className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} required /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><select name="type" className="nf-app-input" style={inputStyle} defaultValue={row?.type ?? AuditType.INTERNAL}>{Object.values(AuditType).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Estado"><select name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? AuditStatus.PLANNED}>{Object.values(AuditStatus).map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Norma"><input name="standardCode" className="nf-app-input" style={inputStyle} defaultValue={row?.standardCode ?? "ISO 9001"} /></Field><Field label="Fecha programada"><input name="scheduledDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.scheduledDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Auditor interno"><select name="auditorId" className="nf-app-input" style={inputStyle} defaultValue={row?.auditorId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Auditor externo"><input name="auditorExternal" className="nf-app-input" style={inputStyle} defaultValue={row?.auditorExternal ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Programa"><select name="programId" className="nf-app-input" style={inputStyle} defaultValue={row?.programId ?? ""}><option value="">Sin programa</option>{initial.programs.map((program) => <option key={program.id} value={program.id}>{program.year} · {program.title}</option>)}</select></Field><Field label="Progreso"><input name="progress" type="number" min="0" max="100" className="nf-app-input" style={inputStyle} defaultValue={row?.progress ?? 0} /></Field></div>
      <Field label="Alcance"><textarea name="scope" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.scope ?? ""} /></Field><Field label="Objetivos"><textarea name="objectives" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.objectives ?? ""} /></Field><Field label="Criterios"><textarea name="criteria" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.criteria ?? ""} /></Field>
    </FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? "Auditoría"} width={720}>{detail && <div style={{ display: "grid", gap: 18 }}>
      <div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Programa" value={detail.programTitle} /><Meta label="Alcance" value={detail.scope} /><Meta label="Criterios" value={detail.criteria} /></div>
      {initial.access.canUpdate && detail.status !== AuditStatus.COMPLETED && detail.status !== AuditStatus.CANCELLED && (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => { const next = detail.status === AuditStatus.PLANNED ? AuditStatus.IN_PROGRESS : AuditStatus.COMPLETED; run(() => transitionAudit(detail.id, next), { onSuccess: () => setDetail(null), successMessage: next === AuditStatus.COMPLETED ? "Auditoría completada." : "Auditoría en curso." }); }}>
            {detail.status === AuditStatus.PLANNED ? "Iniciar auditoría" : "Completar auditoría"}
          </button>
        </div>
      )}
      <div><div style={{ display: "flex", justifyContent: "space-between" }}><strong>Checklist ({detail.checklistItems.length})</strong>{initial.access.canUpdate && <button className="nf-app-btn-ghost" onClick={() => { setDetail(null); setChecklistAudit(detail); }}>Añadir pregunta</button>}</div>{detail.checklistItems.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.checklistItems.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 9, border: "1px solid var(--nf-line)", borderRadius: 9 }}><span style={{ fontSize: 13 }}>{item.clauseCode ? `${item.clauseCode} · ` : ""}{item.question} — {item.status}</span>{initial.access.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setChecklistItem(item); }}>Responder</button>}</div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin preguntas.</p>}</div>
      <div><div style={{ display: "flex", justifyContent: "space-between" }}><strong>Hallazgos ({detail.findings.length})</strong>{initial.access.canUpdate && <button className="nf-app-btn-ghost" onClick={() => { setDetail(null); setFindingAudit(detail); }}>Registrar hallazgo</button>}</div>{detail.findings.length ? <ul>{detail.findings.map((item) => <li key={item.id}>{item.title} · {item.type} · {item.status}</li>)}</ul> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin hallazgos.</p>}</div>
    </div>}</Modal>
    <FormModal open={!!checklistAudit} title="Nueva pregunta de checklist" pending={isPending} error={error} onClose={() => setChecklistAudit(null)} onSubmit={submitChecklist}><Field label="Cláusula"><input name="clauseCode" className="nf-app-input" style={inputStyle} /></Field><Field label="Pregunta"><textarea name="question" required rows={3} className="nf-app-input" style={inputStyle} /></Field><Field label="Resultado esperado"><textarea name="expected" rows={2} className="nf-app-input" style={inputStyle} /></Field></FormModal>
    <FormModal open={!!checklistItem} title="Responder checklist" pending={isPending} error={error} onClose={() => { setChecklistItem(null); setError(""); }} onSubmit={submitChecklistResponse}><Field label="Pregunta"><div style={{ fontSize: 13, fontWeight: 600 }}>{checklistItem?.question}</div></Field><Field label="Estado"><select name="status" className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.status ?? ChecklistItemStatus.PENDING}>{Object.values(ChecklistItemStatus).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Respuesta"><textarea name="response" rows={3} className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.response ?? ""} /></Field><Field label="Notas"><textarea name="notes" rows={2} className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.notes ?? ""} /></Field><Field label="URL de evidencia"><input name="evidenceUrl" className="nf-app-input" style={inputStyle} defaultValue={checklistItem?.evidenceUrl ?? ""} /></Field></FormModal>
    <FormModal open={!!findingAudit} title="Registrar hallazgo" pending={isPending} error={error} onClose={() => setFindingAudit(null)} onSubmit={submitFinding}><Field label="Título"><input name="title" required className="nf-app-input" style={inputStyle} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><select name="type" className="nf-app-input" style={inputStyle}>{Object.values(FindingType).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Severidad"><select name="severity" className="nf-app-input" style={inputStyle}>{Object.values(FindingSeverity).map((value) => <option key={value}>{value}</option>)}</select></Field></div><Field label="Cláusula"><input name="clauseCode" className="nf-app-input" style={inputStyle} /></Field><Field label="Descripción"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} /></Field><Field label="URL de evidencia"><input name="evidenceUrl" className="nf-app-input" style={inputStyle} /></Field></FormModal>
  </div>;
}

export function NonconformitiesLiveClient({ initial }: { initial: NonconformitiesPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<NcRow | null>(null); const [detailId, setDetailId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const detail = detailId ? initial.nonconformities.find((n) => n.id === detailId) ?? null : null;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const input: NonconformityInput = { title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), source: fd.get("source") as NCSource, severity: fd.get("severity") as NCSeverity, status: fd.get("status") as NCStatus, ownerId: String(fd.get("ownerId") ?? "") || undefined, rootCause: String(fd.get("rootCause") ?? ""), dueDate: String(fd.get("dueDate") ?? "") || undefined, auditId: String(fd.get("auditId") ?? "") || undefined, findingId: String(fd.get("findingId") ?? "") || undefined, effectivenessValidated: fd.get("effectivenessValidated") === "on" }; run(() => editing ? updateNonconformity(editing.id, input) : createNonconformity(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "NC actualizada." : "NC creada en Supabase." }); }
  function remove(row: NcRow) { if (window.confirm(`¿Eliminar la NC “${row.title}”?`)) run(() => deleteNonconformity(row.id), { successMessage: "NC eliminada." }); }
  const row = editing;
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  return <div><OperationalHeader title="No conformidades" subtitle={`${initial.nonconformities.length} NC persistidas`} canCreate={initial.access.canCreate} actionLabel="Nueva NC" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    {initial.nonconformities.length === 0 ? <EmptyOperational>No hay no conformidades registradas.</EmptyOperational> : <OperationalGrid>{initial.nonconformities.map((nc) => <OperationalCard key={nc.id} onClick={() => setDetailId(nc.id)}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)" }}>{nc.source} · {nc.severity}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{nc.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{nc.auditTitle ?? "Sin auditoría"} · {nc.ownerName ?? "Sin responsable"}</div></div><Badge status={nc.status} /></div><div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{nc.dueDate ? `Vence ${new Date(nc.dueDate).toLocaleDateString("es")}` : "Sin vencimiento"} · {nc.actionCount} acciones</div><CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(nc); }} onDelete={() => remove(nc)} /></OperationalCard>)}</OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar NC" : "Nueva NC"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><Field label="Título"><input name="title" required className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Origen"><select name="source" className="nf-app-input" style={inputStyle} defaultValue={row?.source ?? NCSource.INTERNAL_AUDIT}>{Object.values(NCSource).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Severidad"><select name="severity" className="nf-app-input" style={inputStyle} defaultValue={row?.severity ?? NCSeverity.MINOR}>{Object.values(NCSeverity).map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Estado"><select name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? NCStatus.OPEN}>{Object.values(NCStatus).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Responsable"><select name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={row?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Auditoría"><select name="auditId" className="nf-app-input" style={inputStyle} defaultValue={row?.auditId ?? ""}><option value="">Sin auditoría</option>{initial.audits.map((audit) => <option key={audit.id} value={audit.id}>{audit.title}</option>)}</select></Field><Field label="Hallazgo"><select name="findingId" className="nf-app-input" style={inputStyle} defaultValue={row?.findingId ?? ""}><option value="">Sin hallazgo</option>{initial.findings.map((finding) => <option key={finding.id} value={finding.id}>{finding.title}</option>)}</select></Field></div><Field label="Fecha objetivo"><input name="dueDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.dueDate?.slice(0, 10) ?? ""} /></Field><Field label="Descripción"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field><Field label="Causa raíz"><textarea name="rootCause" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.rootCause ?? ""} /></Field><label style={{ fontSize: 13 }}><input name="effectivenessValidated" type="checkbox" defaultChecked={row?.effectivenessValidated ?? false} /> Eficacia validada</label></FormModal>
    <Modal open={!!detail} onClose={() => { setDetailId(null); setCommentText(""); }} title={detail?.title ?? "NC"} width={650}>{detail && <div style={{ display: "grid", gap: 18 }}><div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Severidad" value={detail.severity} /><Meta label="Auditoría" value={detail.auditTitle} /><Meta label="Hallazgo" value={detail.findingTitle} /></div><Meta label="Descripción" value={detail.description} /><Meta label="Causa raíz" value={detail.rootCause} /><Meta label="Eficacia" value={detail.effectivenessValidated ? "Validada" : "Pendiente"} />
      <section>
        <strong style={{ fontSize: 14 }}>Comentarios · {detail.comments.length}</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {detail.comments.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin comentarios. Registra el seguimiento de esta no conformidad.</p>}
          {detail.comments.map((c) => (
            <div key={c.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#5266F6" }}>{c.authorName}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{new Date(c.createdAt).toLocaleString("es")}</span>
                  {initial.access.canUpdate && <button type="button" className="nf-app-btn-ghost" style={{ color: "#a62d29", padding: "2px 6px" }} disabled={isPending} onClick={() => run(() => deleteNonconformityComment(c.id))}>Eliminar</button>}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--nf-ink)" }}>{c.content}</p>
            </div>
          ))}
        </div>
        {initial.access.canUpdate && (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="nf-app-input" style={inputStyle} rows={2} placeholder="Añadir comentario de seguimiento…" />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="nf-app-btn-outline" disabled={isPending || !commentText.trim()} onClick={() => run(() => addNonconformityComment(detail.id, commentText), { onSuccess: () => setCommentText(""), successMessage: "Comentario añadido." })}>Comentar</button>
            </div>
          </div>
        )}
      </section>
    </div>}</Modal>
  </div>;
}
