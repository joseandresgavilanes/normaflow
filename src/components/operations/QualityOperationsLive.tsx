"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SectionTitle from "@/components/ui/SectionTitle";
import PageTabs from "@/components/ui/PageTabs";
import { useModuleSection } from "@/hooks/useModuleSection";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createCustomerRequirement, updateCustomerRequirement, deleteCustomerRequirement,
  createCustomerProperty, transitionCustomerProperty, deleteCustomerProperty,
  createPreservationRecord, updatePreservationRecord, deletePreservationRecord,
  createCustomerFeedback, transitionCustomerFeedback, deleteCustomerFeedback,
  createCommunicationRecord, updateCommunicationRecord, deleteCommunicationRecord,
} from "@/lib/actions/quality-operations";
import type { QualityOperationsPayload } from "@/lib/quality-operations/queries";
import { formatDate } from "@/lib/format/datetime";
import Picker from "@/components/ui/Picker";
import EntityTable from "@/components/ui/EntityTable";
import DateField from "@/components/ui/DateField";
import {
  CellTitle,
  Field,
  FormModal,
  Meta,
  OperationalHeader,
  OperationalMessages,
  RowActions,
  inputStyle,
} from "./OperationalUi";

type Requirement = QualityOperationsPayload["requirements"][number];
type Property = QualityOperationsPayload["properties"][number];
type Preservation = QualityOperationsPayload["preservation"][number];
type Feedback = QualityOperationsPayload["feedback"][number];
type Communication = QualityOperationsPayload["communications"][number];
type Tab = "requirements" | "property" | "preservation" | "feedback" | "communication";

/** No es una norma: su navegación vive dentro de la página. */
const TABS = [
  { id: "requirements" as const, label: "Requisitos del cliente" },
  { id: "property" as const, label: "Propiedad del cliente" },
  { id: "preservation" as const, label: "Preservación" },
  { id: "feedback" as const, label: "Satisfacción del cliente" },
  { id: "communication" as const, label: "Comunicación" },
];

export function QualityOperationsLive({ initial }: { initial: QualityOperationsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [tab, setTab] = useModuleSection<Tab>("requirements");
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
    <PageTabs tabs={TABS} active={tab} onChange={setTab} label="Secciones de requisitos operativos" />
    <OperationalMessages error={error} success={success} />

    {tab === "requirements" && <RequirementsTab initial={initial} run={run} isPending={isPending} error={error} setError={setError} creating={creating} editing={editingReq} setEditing={setEditingReq} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} />}
    {tab === "property" && <PropertyTab initial={initial} run={run} isPending={isPending} error={error} setError={setError} creating={creating} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} memberOptions={memberOptions} />}
    {tab === "preservation" && <PreservationTab initial={initial} run={run} isPending={isPending} error={error} setError={setError} creating={creating} editing={editingPres} setEditing={setEditingPres} openCreate={openCreate} closeForm={closeForm} processOptions={processOptions} memberOptions={memberOptions} />}
    {tab === "feedback" && <FeedbackTab initial={initial} run={run} isPending={isPending} error={error} setError={setError} creating={creating} openCreate={openCreate} closeForm={closeForm} />}
    {tab === "communication" && <CommunicationTab initial={initial} run={run} isPending={isPending} error={error} setError={setError} creating={creating} editing={editingComm} setEditing={setEditingComm} openCreate={openCreate} closeForm={closeForm} memberOptions={memberOptions} />}
  </div>;
}

type RunFn = ReturnType<typeof useServerAction>["run"];

// ─── 1. Requisitos del cliente ───────────────────────
function RequirementsTab({ initial, run, isPending, error, setError, creating, editing, setEditing, openCreate, closeForm, processOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; error: string; setError: (v: string) => void;
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
    <OperationalHeader headingLevel={2} title="Requisitos del cliente" subtitle="Requisitos especificados, implícitos y legales/reglamentarios aplicables al producto o servicio (§7.2)." canCreate={initial.access.canCreate} actionLabel="Nuevo requisito" onCreate={openCreate} />
    <EntityTable
        caption="Requisitos del cliente"
        rows={initial.requirements}
        rowKey={(row) => row.id}
        storageKey="customer-requirements"
        searchText={(row) => `${row.code} ${row.title} ${row.description ?? ""} ${row.source ?? ""}`}
        searchPlaceholder="Buscar por código, título o fuente…"
        filters={[
          { id: "status", label: "Estado", value: (row) => row.status },
          { id: "source", label: "Fuente", value: (row) => row.source, format: (value) => value },
        ]}
        emptyTitle="Todavía no hay requisitos"
        emptyDescription="Recoge lo que el cliente pide —contrato, pliego, norma— antes de comprometerte con ello."
        columns={[
          {
            id: "title", header: "Requisito", primary: true, minWidth: 240, sortValue: (row) => row.title,
            cell: (row) => <CellTitle title={row.title} meta={`${row.code} · ${row.source ?? "Sin fuente"}`} />,
          },
          { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
          { id: "description", header: "Descripción", hideable: true, minWidth: 260, cell: (row) => row.description ?? "Sin descripción" },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditing(row); }}
            onDelete={() => run(() => deleteCustomerRequirement(row.id), { successMessage: "Requisito eliminado." })} />
        )}
      />
    <FormModal open={creating || !!editing} title={editing ? "Editar requisito" : "Nuevo requisito del cliente"} pending={isPending} error={error} onClose={closeForm} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={editing?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Fuente"><input aria-label="Cliente, contrato, licitación" name="source" className="nf-app-input" style={inputStyle} placeholder="Cliente, contrato, licitación…" defaultValue={editing?.source ?? ""} /></Field>
        <Field label="Proceso"><Picker aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={editing?.processId ?? ""}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Picker></Field>
      </div>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editing?.description ?? ""} /></Field>
      <Field label="Estado"><Picker aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editing?.status ?? "OPEN"}><option value="OPEN">Abierto</option><option value="REVIEWED">Revisado</option><option value="MET">Cumplido</option></Picker></Field>
    </FormModal>
  </>;
}

// ─── 2. Propiedad del cliente ────────────────────────
function PropertyTab({ initial, run, isPending, error, setError, creating, openCreate, closeForm, processOptions, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; error: string; setError: (v: string) => void;
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
    <OperationalHeader headingLevel={2} title="Propiedad del cliente" subtitle="Bienes del cliente bajo custodia, control y trazabilidad de incidentes (§8.5.3)." canCreate={initial.access.canCreate} actionLabel="Nueva propiedad" onCreate={openCreate} />
    <EntityTable
        caption="Propiedad del cliente"
        rows={initial.properties}
        rowKey={(row) => row.id}
        storageKey="customer-properties"
        searchText={(row) => `${row.code} ${row.customerName} ${row.description}`}
        searchPlaceholder="Buscar por código, cliente o descripción…"
        filters={[{ id: "status", label: "Estado", value: (row) => row.status }]}
        emptyTitle="Todavía no hay propiedad del cliente"
        emptyDescription="Registra lo que el cliente deja bajo tu custodia y en qué estado se devuelve."
        columns={[
          {
            id: "description", header: "Propiedad", primary: true, minWidth: 240, sortValue: (row) => row.description,
            cell: (row) => <CellTitle title={row.description} meta={`${row.code} · ${row.customerName}`} />,
          },
          { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        ]}
        actions={(row) => (
          <RowActions canUpdate={false} canDelete={initial.access.canDelete && row.status !== "IN_CUSTODY"} pending={isPending}
            onEdit={() => {}} onDelete={() => run(() => deleteCustomerProperty(row.id), { successMessage: "Registro eliminado." })}
            extra={initial.access.canUpdate && row.status === "IN_CUSTODY" ? (
              <>
                <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending} onClick={() => run(() => transitionCustomerProperty(row.id, { status: "RETURNED" }), { successMessage: "Propiedad devuelta al cliente." })}>Devolver</button>
                <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending} onClick={() => setReporting(row)}>Incidente</button>
              </>
            ) : undefined} />
        )}
      />
    <FormModal open={creating} title="Nueva propiedad del cliente" pending={isPending} error={error} onClose={closeForm} onSubmit={submit}>
      <Field label="Descripción del bien"><input aria-label="Descripción" name="description" required className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Cliente"><input aria-label="Cliente" name="customerName" required className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Condición al recibir"><textarea aria-label="Estado a la recepción" name="conditionOnReceipt" rows={2} className="nf-app-input" style={inputStyle} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Responsable"><Picker aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Picker></Field>
        <Field label="Proceso"><Picker aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Picker></Field>
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
function PreservationTab({ initial, run, isPending, error, setError, creating, editing, setEditing, openCreate, closeForm, processOptions, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; error: string; setError: (v: string) => void;
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
    <OperationalHeader headingLevel={2} title="Preservación" subtitle="Identificación, manipulación, embalaje, almacenamiento, transmisión y protección de salidas (§8.5.4)." canCreate={initial.access.canCreate} actionLabel="Nuevo registro" onCreate={openCreate} />
    <EntityTable
        caption="Preservación"
        rows={initial.preservation}
        rowKey={(row) => row.id}
        storageKey="preservation"
        searchText={(row) => `${row.code} ${row.itemDescription}`}
        searchPlaceholder="Buscar por código o descripción…"
        filters={[{ id: "status", label: "Estado", value: (row) => row.status }]}
        emptyTitle="Todavía no hay registros de preservación"
        emptyDescription="Deja constancia de cómo se identifica, manipula y almacena cada elemento."
        columns={[
          {
            id: "item", header: "Elemento", primary: true, minWidth: 240, sortValue: (row) => row.itemDescription,
            cell: (row) => <CellTitle title={row.itemDescription} meta={row.code} />,
          },
          { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditing(row); }}
            onDelete={() => run(() => deletePreservationRecord(row.id), { successMessage: "Registro eliminado." })} />
        )}
      />
    <FormModal open={creating || !!editing} title={editing ? "Editar registro" : "Nuevo registro de preservación"} pending={isPending} error={error} onClose={closeForm} onSubmit={submit}>
      <Field label="Elemento / salida"><input aria-label="Descripción del artículo" name="itemDescription" required className="nf-app-input" style={inputStyle} defaultValue={editing?.itemDescription ?? ""} /></Field>
      <Field label="Instrucciones de manipulación"><textarea aria-label="Instrucciones de manipulación" name="handlingInstructions" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.handlingInstructions ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Condiciones de almacenamiento"><textarea aria-label="Condiciones de almacenamiento" name="storageConditions" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.storageConditions ?? ""} /></Field>
        <Field label="Nota de embalaje/transporte"><textarea aria-label="Nota de embalaje" name="packagingNote" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editing?.packagingNote ?? ""} /></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Responsable"><Picker aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle} defaultValue={editing?.responsibleId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Picker></Field>
        <Field label="Proceso"><Picker aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={editing?.processId ?? ""}><option value="">Sin asignar</option>{processOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Picker></Field>
      </div>
      <Field label="Estado"><Picker aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editing?.status ?? "UNDER_REVIEW"}><option value="UNDER_REVIEW">En revisión</option><option value="COMPLIANT">Conforme</option><option value="NON_COMPLIANT">No conforme</option></Picker></Field>
    </FormModal>
  </>;
}

// ─── 4. Satisfacción del cliente ─────────────────────
function FeedbackTab({ initial, run, isPending, error, setError, creating, openCreate, closeForm }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; error: string; setError: (v: string) => void;
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
    {/* El promedio es dato y se queda a la vista; la definición de la cláusula
        es explicación y se pide. */}
    <OperationalHeader
      headingLevel={2}
      title="Satisfacción del cliente"
      subtitle="Percepción del cliente sobre el cumplimiento de sus necesidades y expectativas (§9.1.2)."
      meta={initial.summary.avgSatisfaction != null
        ? <span className="nf-page-header__chip">Promedio {initial.summary.avgSatisfaction}/100</span>
        : undefined}
      canCreate={initial.access.canCreate}
      actionLabel="Nueva retroalimentación"
      onCreate={openCreate}
    />
    <EntityTable
        caption="Retroalimentación del cliente"
        rows={initial.feedback}
        rowKey={(row) => row.id}
        storageKey="customer-feedback"
        searchText={(row) => `${row.code} ${row.customerName ?? ""} ${row.comment ?? ""} ${row.channel}`}
        searchPlaceholder="Buscar por cliente, canal o comentario…"
        filters={[
          { id: "status", label: "Estado", value: (row) => row.status },
          { id: "channel", label: "Canal", value: (row) => row.channel, format: (value) => value },
        ]}
        emptyTitle="Todavía no hay retroalimentación"
        emptyDescription="Quejas, felicitaciones y encuestas entran aquí y se enlazan con acciones correctivas."
        columns={[
          {
            id: "customer", header: "Cliente", primary: true, minWidth: 220, sortValue: (row) => row.customerName ?? "",
            cell: (row) => <CellTitle title={row.customerName ?? "Cliente sin identificar"} meta={`${row.code} · ${row.channel}`} />,
          },
          { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
          { id: "score", header: "Puntaje", numeric: true, align: "end", hideable: true, sortValue: (row) => row.score ?? null, cell: (row) => row.score != null ? `${row.score}/100` : "—" },
          { id: "received", header: "Recibida", numeric: true, hideable: true, sortValue: (row) => row.receivedAt, cell: (row) => formatDate(row.receivedAt) },
          { id: "comment", header: "Comentario", hideable: true, defaultHidden: true, minWidth: 260, cell: (row) => row.comment ?? "Sin comentario" },
        ]}
        actions={(row) => (
          <RowActions canUpdate={false} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => {}} onDelete={() => run(() => deleteCustomerFeedback(row.id), { successMessage: "Eliminada." })}
            extra={initial.access.canUpdate && row.status !== "CLOSED" ? (
              <>
                {row.status === "RECEIVED" && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(row.id, { status: "ANALYZED" }), { successMessage: "Marcada como analizada." })}>Analizar</button>}
                {row.status === "ANALYZED" && row.linkedCapaId && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(row.id, { status: "ACTION_TAKEN" }), { successMessage: "Acción registrada." })}>Acción tomada</button>}
                <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending} onClick={() => run(() => transitionCustomerFeedback(row.id, { status: "CLOSED" }), { successMessage: "Cerrada." })}>Cerrar</button>
              </>
            ) : undefined} />
        )}
      />
    <FormModal open={creating} title="Nueva retroalimentación de cliente" pending={isPending} error={error} onClose={closeForm} onSubmit={submit}>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Cliente"><input aria-label="Cliente" name="customerName" className="nf-app-input" style={inputStyle} /></Field>
        <Field label="Canal"><Picker aria-label="Canal" name="channel" className="nf-app-input" style={inputStyle}><option value="SURVEY">Encuesta</option><option value="COMPLAINT">Queja</option><option value="COMPLIMENT">Felicitación</option><option value="REVIEW">Reseña</option><option value="INTERVIEW">Entrevista</option><option value="OTHER">Otro</option></Picker></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Puntaje (0-100)"><input aria-label="Puntuación" name="score" type="number" min={0} max={100} className="nf-app-input" style={inputStyle} /></Field>
        <Field label="Fecha recibida"><DateField aria-label="Fecha de recepción" name="receivedAt" className="nf-app-input" style={inputStyle} /></Field>
      </div>
      <Field label="Comentario"><textarea aria-label="Comentario" name="comment" rows={3} className="nf-app-input" style={inputStyle} /></Field>
      <Field label="CAPA vinculada (si aplica)"><Picker aria-label="Ninguna" name="linkedCapaId" className="nf-app-input" style={inputStyle}><option value="">Ninguna</option>{initial.capas.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</Picker></Field>
    </FormModal>
  </>;
}

// ─── 5. Comunicación ──────────────────────────────────
function CommunicationTab({ initial, run, isPending, error, setError, creating, editing, setEditing, openCreate, closeForm, memberOptions }: {
  initial: QualityOperationsPayload; run: RunFn; isPending: boolean; error: string; setError: (v: string) => void;
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
    <OperationalHeader headingLevel={2} title="Comunicación" subtitle="Qué comunicar, cuándo, a quién, cómo y quién comunica — interna y externa (§7.4)." canCreate={initial.access.canCreate} actionLabel="Nueva comunicación" onCreate={openCreate} />
    <EntityTable
        caption="Comunicaciones"
        rows={initial.communications}
        rowKey={(row) => row.id}
        storageKey="communications"
        searchText={(row) => `${row.code} ${row.subject} ${row.audience ?? ""} ${row.channel ?? ""}`}
        searchPlaceholder="Buscar por asunto, audiencia o canal…"
        filters={[
          { id: "direction", label: "Dirección", value: (row) => row.direction, format: (value) => value === "INTERNAL" ? "Interna" : "Externa" },
          { id: "channel", label: "Canal", value: (row) => row.channel, format: (value) => value },
        ]}
        emptyTitle="Todavía no hay comunicaciones"
        emptyDescription="Registra qué se comunicó, a quién y por qué canal: la norma pide poder demostrarlo."
        columns={[
          {
            id: "subject", header: "Comunicación", primary: true, minWidth: 240, sortValue: (row) => row.subject,
            cell: (row) => <CellTitle title={row.subject} meta={`${row.code} · ${row.audience ?? "Sin audiencia"}`} />,
          },
          { id: "direction", header: "Dirección", sortValue: (row) => row.direction, cell: (row) => <Badge status={row.direction === "INTERNAL" ? "PLANNED" : "ACTIVE"} label={row.direction === "INTERNAL" ? "Interna" : "Externa"} /> },
          { id: "channel", header: "Canal", hideable: true, sortValue: (row) => row.channel ?? "", cell: (row) => row.channel ?? "—" },
          { id: "date", header: "Fecha", numeric: true, sortValue: (row) => row.communicatedAt, cell: (row) => formatDate(row.communicatedAt) },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditing(row); }}
            onDelete={() => run(() => deleteCommunicationRecord(row.id), { successMessage: "Comunicación eliminada." })} />
        )}
      />
    <FormModal open={creating || !!editing} title={editing ? "Editar comunicación" : "Nueva comunicación"} pending={isPending} error={error} onClose={closeForm} onSubmit={submit}>
      <Field label="Asunto"><input aria-label="Asunto" name="subject" required className="nf-app-input" style={inputStyle} defaultValue={editing?.subject ?? ""} /></Field>
      <Field label="Contenido"><textarea aria-label="Contenido" name="content" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editing?.content ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Dirección"><Picker aria-label="Sentido" name="direction" className="nf-app-input" style={inputStyle} defaultValue={editing?.direction ?? "INTERNAL"}><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></Picker></Field>
        <Field label="Audiencia"><input aria-label="Empleados, clientes, autoridad" name="audience" className="nf-app-input" style={inputStyle} placeholder="Empleados, clientes, autoridad…" defaultValue={editing?.audience ?? ""} /></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Canal"><input aria-label="Email, reunión, boletín" name="channel" className="nf-app-input" style={inputStyle} placeholder="Email, reunión, boletín…" defaultValue={editing?.channel ?? ""} /></Field>
        <Field label="Fecha"><DateField aria-label="Fecha de comunicación" name="communicatedAt" className="nf-app-input" style={inputStyle} defaultValue={editing?.communicatedAt?.slice(0, 10) ?? ""} /></Field>
      </div>
      <Field label="Quién comunica"><Picker aria-label="Comunicado por" name="communicatedById" className="nf-app-input" style={inputStyle} defaultValue={editing?.communicatedById ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Picker></Field>
    </FormModal>
  </>;
}
