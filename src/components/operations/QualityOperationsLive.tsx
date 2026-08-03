"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createCustomerRequirement, updateCustomerRequirement, deleteCustomerRequirement,
  createCustomerProperty, transitionCustomerProperty, deleteCustomerProperty,
  createPreservationRecord, updatePreservationRecord, deletePreservationRecord,
  createCustomerFeedback, transitionCustomerFeedback, deleteCustomerFeedback,
  createCommunicationRecord, updateCommunicationRecord, deleteCommunicationRecord,
} from "@/lib/actions/quality-operations";
import type { QualityOperationsPayload } from "@/lib/quality-operations/queries";
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta,
  OperationalCard, OperationalGrid, OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type Requirement = QualityOperationsPayload["requirements"][number];
type Property = QualityOperationsPayload["properties"][number];
type Preservation = QualityOperationsPayload["preservation"][number];
type Feedback = QualityOperationsPayload["feedback"][number];
type Communication = QualityOperationsPayload["communications"][number];
type Tab = "requirements" | "property" | "preservation" | "feedback" | "communication";

const TABS: { key: Tab; label: string }[] = [
  { key: "requirements", label: "Requisitos del cliente" },
  { key: "property", label: "Propiedad del cliente" },
  { key: "preservation", label: "Preservación" },
  { key: "feedback", label: "Satisfacción del cliente" },
  { key: "communication", label: "Comunicación" },
];

export function QualityOperationsLive({ initial }: { initial: QualityOperationsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [tab, setTab] = useState<Tab>("requirements");
  const [creating, setCreating] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [editingPres, setEditingPres] = useState<Preservation | null>(null);
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  const memberOptions = initial.members.map((m) => ({ id: m.id, name: m.name }));
  const processOptions = initial.processes;

  function openCreate() { setError(""); setEditingReq(null); setEditingPres(null); setEditingComm(null); setCreating(true); }
  function closeForm() { setCreating(false); setEditingReq(null); setEditingPres(null); setEditingComm(null); setError(""); }

  return <div>
    <SectionTitle title="Requisitos operativos" sub="Cláusulas 7.2, 7.4, 8.5.3, 8.5.4 y 9.1.2 — antes solo texto libre, ahora datos estructurados y trazables." />
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {TABS.map((t) => <button key={t.key} type="button" className={tab === t.key ? "nf-app-btn-primary" : "nf-app-btn-outline"} onClick={() => setTab(t.key)}>{t.label}</button>)}
    </div>
    <OperationalMessages error={error} success={success} />

    {tab === "requirements" && <RequirementsTab initial={initial} run={run} isPending={isPending} setError={setError} creating={creating} editing={editingReq} setEditing={setEditingReq} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} />}
    {tab === "property" && <PropertyTab initial={initial} run={run} isPending={isPending} setError={setError} creating={creating} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} memberOptions={memberOptions} />}
    {tab === "preservation" && <PreservationTab initial={initial} run={run} isPending={isPending} setError={setError} creating={creating} editing={editingPres} setEditing={setEditingPres} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} memberOptions={memberOptions} />}
    {tab === "feedback" && <FeedbackTab initial={initial} run={run} isPending={isPending} setError={setError} creating={creating} openCreate={openCreate} closeForm={closeForm} />}
    {tab === "communication" && <CommunicationTab initial={initial} run={run} isPending={isPending} setError={setError} creating={creating} editing={editingComm} setEditing={setEditingComm} openCreate={openCreate} closeForm={closeForm} memberOptions={memberOptions} />}
  </div>;
}

type RunFn = ReturnType<typeof useServerAction>["run"];

// ─── 1. Requisitos del cliente ───────────────────────
function RequirementsTab({ initial, run, isPending, setError, creating, editing, setEditing, openCreate, closeForm, processOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; setError: (v: string) => void;
  creating: boolean; editing: Requirement | null; setEditing: (v: Requirement | null) => void;
  openCreate: () => void; closeForm: () => void; processOptions: QualityOperationsPayload["processes"];
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      source: String(fd.get("source") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined,
      status: (String(fd.get("status") ?? "OPEN")) as Requirement["status"],
    };
    run(() => editing ? updateCustomerRequirement(editing.id, input) : createCustomerRequirement(input), {
      onSuccess: closeForm, successMessage: editing ? "Requisito actualizado." : "Requisito registrado.",
    });
  }
  return <>
    <OperationalHeader title="Requisitos del cliente" subtitle="Requisitos especificados, implícitos y legales/reglamentarios aplicables al producto o servicio (§7.2)." canCreate={initial.access.canCreate} actionLabel="Nuevo requisito" onCreate={openCreate} />
    {initial.requirements.length === 0 ? <EmptyOperational>No hay requisitos de cliente registrados.</EmptyOperational> : <OperationalGrid>
      {initial.requirements.map((r) => <OperationalCard key={r.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{r.code} · {r.source ?? "Sin fuente"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{r.title}</h3></div>
          <Badge status={r.status} />
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{r.description ?? "Sin descripción"}</div>
        <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(r); }} onDelete={() => run(() => deleteCustomerRequirement(r.id), { successMessage: "Requisito eliminado." })} />
      </OperationalCard>)}
    </OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar requisito" : "Nuevo requisito del cliente"} pending={isPending} error="" onClose={closeForm} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={editing?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Fuente"><input aria-label="Cliente, contrato, licitación" name="source" className="nf-app-input" style={inputStyle} placeholder="Cliente, contrato, licitación…" defaultValue={editing?.source ?? ""} /></Field>
        <Field label="Proceso"><select aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={editing?.processId ?? ""}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editing?.description ?? ""} /></Field>
      <Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editing?.status ?? "OPEN"}><option value="OPEN">Abierto</option><option value="REVIEWED">Revisado</option><option value="MET">Cumplido</option></select></Field>
    </FormModal>
  </>;
}

// ─── 2. Propiedad del cliente ────────────────────────
function PropertyTab({ initial, run, isPending, setError, creating, openCreate, closeForm, processOptions, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; setError: (v: string) => void;
  creating: boolean; openCreate: () => void; closeForm: () => void;
  processOptions: QualityOperationsPayload["processes"]; memberOptions: { id: string; name: string }[];
}) {
  const [reporting, setReporting] = useState<Property | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      description: String(fd.get("description") ?? ""),
      customerName: String(fd.get("customerName") ?? ""),
      conditionOnReceipt: String(fd.get("conditionOnReceipt") ?? "") || undefined,
      responsibleId: String(fd.get("responsibleId") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined,
    };
    run(() => createCustomerProperty(input), { onSuccess: closeForm, successMessage: "Propiedad del cliente registrada." });
  }
  return <>
    <OperationalHeader title="Propiedad del cliente" subtitle="Bienes del cliente bajo custodia, control y trazabilidad de incidentes (§8.5.3)." canCreate={initial.access.canCreate} actionLabel="Nueva propiedad" onCreate={openCreate} />
    {initial.properties.length === 0 ? <EmptyOperational>No hay propiedad de cliente registrada.</EmptyOperational> : <OperationalGrid>
      {initial.properties.map((p) => <OperationalCard key={p.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{p.code} · {p.customerName}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{p.description}</h3></div>
          <Badge status={p.status} />
        </div>
        {initial.access.canUpdate && p.status === "IN_CUSTODY" && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => transitionCustomerProperty(p.id, { status: "RETURNED" }), { successMessage: "Propiedad devuelta al cliente." })}>Marcar devuelta</button>
          <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => setReporting(p)}>Reportar incidente</button>
        </div>}
        <CardActions canUpdate={false} canDelete={initial.access.canDelete && p.status !== "IN_CUSTODY"} pending={isPending} onEdit={() => {}} onDelete={() => run(() => deleteCustomerProperty(p.id), { successMessage: "Registro eliminado." })} />
      </OperationalCard>)}
    </OperationalGrid>}
    <FormModal open={creating} title="Nueva propiedad del cliente" pending={isPending} error="" onClose={closeForm} onSubmit={submit}>
      <Field label="Descripción del bien"><input aria-label="Descripción" name="description" required className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Cliente"><input aria-label="Cliente" name="customerName" required className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Condición al recibir"><textarea aria-label="Estado a la recepción" name="conditionOnReceipt" rows={2} className="nf-app-input" style={inputStyle} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Responsable"><select aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Proceso"><select aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
    </FormModal>
    <Modal open={!!reporting} onClose={() => setReporting(null)} title="Reportar incidente" width={520}>{reporting && <form onSubmit={(e) => {
      e.preventDefault();
      const note = String(new FormData(e.currentTarget).get("incidentNote") ?? "");
      run(() => transitionCustomerProperty(reporting.id, { status: "LOST_OR_DAMAGED", incidentNote: note }), { onSuccess: () => setReporting(null), successMessage: "Incidente registrado." });
    }} style={{ display: "grid", gap: 12 }}>
      <Field label="Descripción del incidente"><textarea aria-label="Qué ocurrió, cuándo se detectó y qué se comunicó al cliente." name="incidentNote" required rows={4} className="nf-app-input" style={inputStyle} placeholder="Qué ocurrió, cuándo se detectó y qué se comunicó al cliente." /></Field>
      <button type="submit" className="nf-app-btn-primary" disabled={isPending}>Registrar incidente</button>
    </form>}</Modal>
  </>;
}

// ─── 3. Preservación ──────────────────────────────────
function PreservationTab({ initial, run, isPending, setError, creating, editing, setEditing, openCreate, closeForm, processOptions, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; setError: (v: string) => void;
  creating: boolean; editing: Preservation | null; setEditing: (v: Preservation | null) => void;
  openCreate: () => void; closeForm: () => void;
  processOptions: QualityOperationsPayload["processes"]; memberOptions: { id: string; name: string }[];
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      itemDescription: String(fd.get("itemDescription") ?? ""),
      handlingInstructions: String(fd.get("handlingInstructions") ?? "") || undefined,
      storageConditions: String(fd.get("storageConditions") ?? "") || undefined,
      packagingNote: String(fd.get("packagingNote") ?? "") || undefined,
      status: (String(fd.get("status") ?? "UNDER_REVIEW")) as Preservation["status"],
      responsibleId: String(fd.get("responsibleId") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined,
    };
    run(() => editing ? updatePreservationRecord(editing.id, input) : createPreservationRecord(input), {
      onSuccess: closeForm, successMessage: editing ? "Registro actualizado." : "Registro de preservación creado.",
    });
  }
  return <>
    <OperationalHeader title="Preservación" subtitle="Identificación, manipulación, embalaje, almacenamiento, transmisión y protección de salidas (§8.5.4)." canCreate={initial.access.canCreate} actionLabel="Nuevo registro" onCreate={openCreate} />
    {initial.preservation.length === 0 ? <EmptyOperational>No hay registros de preservación.</EmptyOperational> : <OperationalGrid>
      {initial.preservation.map((r) => <OperationalCard key={r.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{r.code}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{r.itemDescription}</h3></div>
          <Badge status={r.status} />
        </div>
        <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(r); }} onDelete={() => run(() => deletePreservationRecord(r.id), { successMessage: "Registro eliminado." })} />
      </OperationalCard>)}
    </OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar registro" : "Nuevo registro de preservación"} pending={isPending} error="" onClose={closeForm} onSubmit={submit}>
      <Field label="Elemento / salida"><input aria-label="Descripción del artículo" name="itemDescription" required className="nf-app-input" style={inputStyle} defaultValue={editing?.itemDescription ?? ""} /></Field>
      <Field label="Instrucciones de manipulación"><textarea aria-label="Instrucciones de manipulación" name="handlingInstructions" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.handlingInstructions ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Condiciones de almacenamiento"><textarea aria-label="Condiciones de almacenamiento" name="storageConditions" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.storageConditions ?? ""} /></Field>
        <Field label="Nota de embalaje/transporte"><textarea aria-label="Nota de embalaje" name="packagingNote" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.packagingNote ?? ""} /></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Responsable"><select aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle} defaultValue={editing?.responsibleId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Proceso"><select aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={editing?.processId ?? ""}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editing?.status ?? "UNDER_REVIEW"}><option value="UNDER_REVIEW">En revisión</option><option value="COMPLIANT">Conforme</option><option value="NON_COMPLIANT">No conforme</option></select></Field>
    </FormModal>
  </>;
}

// ─── 4. Satisfacción del cliente ─────────────────────
function FeedbackTab({ initial, run, isPending, setError, creating, openCreate, closeForm }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; setError: (v: string) => void;
  creating: boolean; openCreate: () => void; closeForm: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      customerName: String(fd.get("customerName") ?? "") || undefined,
      channel: (String(fd.get("channel") ?? "SURVEY")) as Feedback["channel"],
      score: fd.get("score") ? Number(fd.get("score")) : undefined,
      comment: String(fd.get("comment") ?? "") || undefined,
      receivedAt: String(fd.get("receivedAt") ?? "") || undefined,
      linkedCapaId: String(fd.get("linkedCapaId") ?? "") || undefined,
    };
    run(() => createCustomerFeedback(input), { onSuccess: closeForm, successMessage: "Retroalimentación registrada." });
  }
  return <>
    <OperationalHeader title="Satisfacción del cliente" subtitle={`Percepción del cliente sobre el cumplimiento de sus necesidades y expectativas (§9.1.2).${initial.summary.avgSatisfaction != null ? ` Promedio: ${initial.summary.avgSatisfaction}/100.` : ""}`} canCreate={initial.access.canCreate} actionLabel="Nueva retroalimentación" onCreate={openCreate} />
    {initial.feedback.length === 0 ? <EmptyOperational>No hay retroalimentación de clientes registrada.</EmptyOperational> : <OperationalGrid>
      {initial.feedback.map((f) => <OperationalCard key={f.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{f.code} · {f.channel}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{f.customerName ?? "Cliente sin identificar"}</h3></div>
          <Badge status={f.status} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--nf-ink-3)" }}>{f.score != null ? `Puntaje: ${f.score}/100 · ` : ""}{new Date(f.receivedAt).toLocaleDateString("es")}</div>
        <div style={{ marginTop: 8, fontSize: 13 }}>{f.comment ?? "Sin comentario"}</div>
        {initial.access.canUpdate && f.status !== "CLOSED" && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {f.status === "RECEIVED" && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(f.id, { status: "ANALYZED" }), { successMessage: "Marcada como analizada." })}>Analizar</button>}
          {f.status === "ANALYZED" && f.linkedCapaId && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(f.id, { status: "ACTION_TAKEN" }), { successMessage: "Acción registrada." })}>Marcar acción tomada</button>}
          <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(f.id, { status: "CLOSED" }), { successMessage: "Cerrada." })}>Cerrar</button>
        </div>}
        <CardActions canUpdate={false} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => {}} onDelete={() => run(() => deleteCustomerFeedback(f.id), { successMessage: "Eliminada." })} />
      </OperationalCard>)}
    </OperationalGrid>}
    <FormModal open={creating} title="Nueva retroalimentación de cliente" pending={isPending} error="" onClose={closeForm} onSubmit={submit}>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Cliente"><input aria-label="Cliente" name="customerName" className="nf-app-input" style={inputStyle} /></Field>
        <Field label="Canal"><select aria-label="Canal" name="channel" className="nf-app-input" style={inputStyle}><option value="SURVEY">Encuesta</option><option value="COMPLAINT">Queja</option><option value="COMPLIMENT">Felicitación</option><option value="REVIEW">Reseña</option><option value="INTERVIEW">Entrevista</option><option value="OTHER">Otro</option></select></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Puntaje (0-100)"><input aria-label="Puntuación" name="score" type="number" min={0} max={100} className="nf-app-input" style={inputStyle} /></Field>
        <Field label="Fecha recibida"><input aria-label="Fecha de recepción" name="receivedAt" type="date" className="nf-app-input" style={inputStyle} /></Field>
      </div>
      <Field label="Comentario"><textarea aria-label="Comentario" name="comment" rows={3} className="nf-app-input" style={inputStyle} /></Field>
      <Field label="CAPA vinculada (si aplica)"><select aria-label="Ninguna" name="linkedCapaId" className="nf-app-input" style={inputStyle}><option value="">Ninguna</option>{initial.capas.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></Field>
    </FormModal>
  </>;
}

// ─── 5. Comunicación ──────────────────────────────────
function CommunicationTab({ initial, run, isPending, setError, creating, editing, setEditing, openCreate, closeForm, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; setError: (v: string) => void;
  creating: boolean; editing: Communication | null; setEditing: (v: Communication | null) => void;
  openCreate: () => void; closeForm: () => void; memberOptions: { id: string; name: string }[];
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      subject: String(fd.get("subject") ?? ""),
      content: String(fd.get("content") ?? "") || undefined,
      direction: (String(fd.get("direction") ?? "INTERNAL")) as Communication["direction"],
      audience: String(fd.get("audience") ?? "") || undefined,
      channel: String(fd.get("channel") ?? "") || undefined,
      communicatedById: String(fd.get("communicatedById") ?? "") || undefined,
      communicatedAt: String(fd.get("communicatedAt") ?? "") || undefined,
    };
    run(() => editing ? updateCommunicationRecord(editing.id, input) : createCommunicationRecord(input), {
      onSuccess: closeForm, successMessage: editing ? "Comunicación actualizada." : "Comunicación registrada.",
    });
  }
  return <>
    <OperationalHeader title="Comunicación" subtitle="Qué comunicar, cuándo, a quién, cómo y quién comunica — interna y externa (§7.4)." canCreate={initial.access.canCreate} actionLabel="Nueva comunicación" onCreate={openCreate} />
    {initial.communications.length === 0 ? <EmptyOperational>No hay comunicaciones registradas.</EmptyOperational> : <OperationalGrid>
      {initial.communications.map((c) => <OperationalCard key={c.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{c.code} · {c.audience ?? "Sin audiencia"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{c.subject}</h3></div>
          <Badge status={c.direction === "INTERNAL" ? "PLANNED" : "ACTIVE"} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--nf-ink-3)" }}>{c.direction === "INTERNAL" ? "Interna" : "Externa"} · {c.channel ?? "Sin canal"} · {new Date(c.communicatedAt).toLocaleDateString("es")}</div>
        <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(c); }} onDelete={() => run(() => deleteCommunicationRecord(c.id), { successMessage: "Comunicación eliminada." })} />
      </OperationalCard>)}
    </OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar comunicación" : "Nueva comunicación"} pending={isPending} error="" onClose={closeForm} onSubmit={submit}>
      <Field label="Asunto"><input aria-label="Asunto" name="subject" required className="nf-app-input" style={inputStyle} defaultValue={editing?.subject ?? ""} /></Field>
      <Field label="Contenido"><textarea aria-label="Contenido" name="content" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editing?.content ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Dirección"><select aria-label="Sentido" name="direction" className="nf-app-input" style={inputStyle} defaultValue={editing?.direction ?? "INTERNAL"}><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></Field>
        <Field label="Audiencia"><input aria-label="Empleados, clientes, autoridad" name="audience" className="nf-app-input" style={inputStyle} placeholder="Empleados, clientes, autoridad…" defaultValue={editing?.audience ?? ""} /></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Canal"><input aria-label="Email, reunión, boletín" name="channel" className="nf-app-input" style={inputStyle} placeholder="Email, reunión, boletín…" defaultValue={editing?.channel ?? ""} /></Field>
        <Field label="Fecha"><input aria-label="Fecha de comunicación" name="communicatedAt" type="date" className="nf-app-input" style={inputStyle} defaultValue={editing?.communicatedAt?.slice(0, 10) ?? ""} /></Field>
      </div>
      <Field label="Quién comunica"><select aria-label="Comunicado por" name="communicatedById" className="nf-app-input" style={inputStyle} defaultValue={editing?.communicatedById ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
    </FormModal>
  </>;
}
