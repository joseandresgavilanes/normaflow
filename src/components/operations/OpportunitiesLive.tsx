"use client";

import { useState, type FormEvent } from "react";
import { OpportunityStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { PromptActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createOpportunity,
  deleteOpportunity,
  transitionOpportunity,
  updateOpportunity,
  type OpportunityInput,
} from "@/lib/actions/opportunities";
import type { OpportunitiesPayload } from "@/lib/server-queries";
import { formatDate } from "@/lib/format/datetime";
import Picker from "@/components/ui/Picker";
import EntityTable from "@/components/ui/EntityTable";
import DateField from "@/components/ui/DateField";
import {
  CellTitle,
  Field,
  FormModal,
  inputStyle,
  Meta,
  OperationalHeader,
  OperationalMessages,
  RowActions,
} from "./OperationalUi";

type Row = OpportunitiesPayload["opportunities"][number];

const NEXT_STATUS: Partial<Record<OpportunityStatus, OpportunityStatus[]>> = {
  IDENTIFIED: [OpportunityStatus.UNDER_REVIEW],
  UNDER_REVIEW: [OpportunityStatus.APPROVED, OpportunityStatus.REJECTED],
  APPROVED: [OpportunityStatus.IN_MATERIALIZATION],
  IN_MATERIALIZATION: [OpportunityStatus.MATERIALIZED],
  MATERIALIZED: [OpportunityStatus.CLOSED],
  REJECTED: [OpportunityStatus.IDENTIFIED],
};

function submitInput(event: FormEvent<HTMLFormElement>): OpportunityInput {
  const fd = new FormData(event.currentTarget);
  return {
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    standardCode: String(fd.get("standardCode") ?? ""),
    source: String(fd.get("source") ?? ""),
    category: String(fd.get("category") ?? ""),
    ownerId: String(fd.get("ownerId") ?? "") || undefined,
    reviewerId: String(fd.get("reviewerId") ?? "") || undefined,
    dueDate: String(fd.get("dueDate") ?? "") || undefined,
    materializationAnalysis: String(fd.get("materializationAnalysis") ?? ""),
    materializationPlan: String(fd.get("materializationPlan") ?? ""),
    materializationEvidence: String(fd.get("materializationEvidence") ?? ""),
  };
}

export function OpportunitiesLive({ initial }: { initial: OpportunitiesPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const row = editing;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = submitInput(event);
    run(() => row ? updateOpportunity(row.id, input) : createOpportunity(input), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: row ? "Oportunidad actualizada." : "Oportunidad creada en estado identificado.",
    });
  }

  function move(rowToMove: Row, status: OpportunityStatus) {
    if (status === OpportunityStatus.REJECTED) {
      setRejecting(rowToMove);
      return;
    }
    run(() => transitionOpportunity(rowToMove.id, status), {
      onSuccess: () => setDetail(null),
      successMessage: `Oportunidad movida a ${status.replaceAll("_", " ")}.`,
    });
  }

  const memberRows = initial.members.map((member) => ({ id: member.id, name: member.name }));

  return <div>
    <OperationalHeader
      title="Oportunidades"
      subtitle="Oportunidades de mejora con revisor, análisis de materialización y aprobación trazable (cláusula 6.1)."
      canCreate={initial.access.canCreate}
      actionLabel="Nueva oportunidad"
      onCreate={() => { setError(""); setCreating(true); }}
    />
    <OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Oportunidades"
      rows={initial.opportunities}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="opportunities"
      searchText={(row) => `${row.title} ${row.description ?? ""} ${row.category ?? ""} ${row.reviewerName ?? ""}`}
      searchPlaceholder="Buscar por título, categoría o revisor…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "standard", label: "Norma", value: (row) => row.standardCode, format: (value) => value.replaceAll("_", " ") },
        { id: "category", label: "Categoría", value: (row) => row.category, format: (value) => value },
      ]}
      emptyTitle="Todavía no hay oportunidades"
      emptyDescription="Registra una oportunidad y asígnale un revisor antes de enviarla a aprobación."
      columns={[
        {
          id: "title", header: "Oportunidad", primary: true, minWidth: 240,
          sortValue: (row) => row.title,
          cell: (row) => <CellTitle title={row.title} meta={`${row.standardCode?.replaceAll("_", " ") ?? "Sin norma"} · ${row.category}`} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        { id: "reviewer", header: "Revisor", hideable: true, sortValue: (row) => row.reviewerName ?? "", cell: (row) => row.reviewerName ?? "Sin asignar" },
        {
          id: "plan", header: "Materialización", hideable: true,
          sortValue: (row) => (row.materializationPlan ? 1 : 0),
          cell: (row) => row.materializationPlan ? "Plan documentado" : "Plan pendiente",
        },
        {
          id: "due", header: "Vencimiento", hideable: true, numeric: true,
          sortValue: (row) => row.dueDate ?? "",
          cell: (row) => row.dueDate ? formatDate(row.dueDate) : "—",
        },
      ]}
      actions={(row) => (
        <RowActions
          canUpdate={initial.access.canUpdate && row.status !== OpportunityStatus.MATERIALIZED && row.status !== OpportunityStatus.CLOSED}
          canDelete={initial.access.canDelete && (row.status === OpportunityStatus.IDENTIFIED || row.status === OpportunityStatus.REJECTED)}
          pending={isPending}
          onEdit={() => { setError(""); setEditing(row); }}
          onDelete={() => run(() => deleteOpportunity(row.id), { onSuccess: () => setDetail(null), successMessage: "Oportunidad eliminada." })}
        />
      )}
    />

    <FormModal open={creating || !!editing} title={editing ? "Editar oportunidad" : "Nueva oportunidad"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Norma / versión"><input aria-label="ISO_9001:2015" name="standardCode" className="nf-app-input" style={inputStyle} placeholder="ISO_9001:2015" defaultValue={row?.standardCode ?? ""} /></Field><Field label="Categoría"><input aria-label="Cliente, proceso, tecnología" name="category" required className="nf-app-input" style={inputStyle} placeholder="Cliente, proceso, tecnología…" defaultValue={row?.category ?? ""} /></Field></div>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Fuente"><input aria-label="Auditoría, análisis de contexto" name="source" className="nf-app-input" style={inputStyle} placeholder="Auditoría, análisis de contexto…" defaultValue={row?.source ?? ""} /></Field><Field label="Fecha objetivo"><DateField aria-label="Fecha de vencimiento" name="dueDate" className="nf-app-input" style={inputStyle} defaultValue={row?.dueDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Responsable"><Picker aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={row?.ownerId ?? ""}><option value="">Sin asignar</option>{memberRows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Picker></Field><Field label="Revisor obligatorio"><Picker aria-label="Seleccionar revisor" name="reviewerId" required className="nf-app-input" style={inputStyle} defaultValue={row?.reviewerId ?? ""}><option value="">Seleccionar revisor…</option>{memberRows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Picker></Field></div>
      <Field label="Análisis de materialización"><textarea aria-label="¿Qué evidencia demostrará que la oportunidad se materializó?" name="materializationAnalysis" rows={3} className="nf-app-input" style={inputStyle} placeholder="¿Qué evidencia demostrará que la oportunidad se materializó?" defaultValue={row?.materializationAnalysis ?? ""} /></Field>
      <Field label="Plan de materialización"><textarea aria-label="Acciones, responsables, recursos y criterios de éxito." name="materializationPlan" rows={3} className="nf-app-input" style={inputStyle} placeholder="Acciones, responsables, recursos y criterios de éxito." defaultValue={row?.materializationPlan ?? ""} /></Field>
      <Field label="Evidencia / resultado"><textarea aria-label="Evidencia de materialización" name="materializationEvidence" rows={2} className="nf-app-input" style={inputStyle} defaultValue={row?.materializationEvidence ?? ""} /></Field>
    </FormModal>

    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? "Oportunidad"} width={720}>{detail && <div style={{ display: "grid", gap: 16 }}>
      <div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Norma" value={detail.standardCode} /><Meta label="Responsable" value={detail.ownerName} /><Meta label="Revisor" value={detail.reviewerName} /></div>
      <Meta label="Descripción" value={detail.description} /><Meta label="Análisis de materialización" value={detail.materializationAnalysis} /><Meta label="Plan de materialización" value={detail.materializationPlan} /><Meta label="Evidencia / resultado" value={detail.materializationEvidence} />
      {initial.access.canUpdate && detail.reviewerId === initial.access.currentUserId && detail.status === OpportunityStatus.UNDER_REVIEW && <div style={{ display: "flex", gap: 8 }}><button type="button" className="nf-app-btn-primary" onClick={() => move(detail, OpportunityStatus.APPROVED)}>Aprobar revisión</button><button type="button" className="nf-app-btn-outline" onClick={() => setRejecting(detail)}>Devolver</button></div>}
      {initial.access.canUpdate && detail.status !== OpportunityStatus.UNDER_REVIEW && (NEXT_STATUS[detail.status] ?? []).length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--nf-line)", paddingTop: 12 }}>{(NEXT_STATUS[detail.status] ?? []).map((status) => <button key={status} type="button" className="nf-app-btn-primary" onClick={() => move(detail, status)}>Mover a {status.replaceAll("_", " ")}</button>)}</div>}
    </div>}</Modal>
    <PromptActionModal open={!!rejecting} title="Devolver oportunidad" label="Motivo" placeholder="Explica qué debe corregirse antes de aprobar." confirmLabel="Devolver" danger pending={isPending} onCancel={() => setRejecting(null)} onConfirm={(reason) => { if (!rejecting) return; run(() => transitionOpportunity(rejecting.id, OpportunityStatus.REJECTED, reason), { onSuccess: () => { setRejecting(null); setDetail(null); }, successMessage: "Oportunidad devuelta a identificación." }); }} />
  </div>;
}
