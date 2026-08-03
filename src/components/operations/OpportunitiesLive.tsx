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
import {
  CardActions,
  EmptyOperational,
  Field,
  FormModal,
  inputStyle,
  Meta,
  OperationalCard,
  OperationalGrid,
  OperationalHeader,
  OperationalMessages,
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
      subtitle={`${initial.opportunities.length} oportunidades · análisis de materialización y aprobación trazable`}
      canCreate={initial.access.canCreate}
      actionLabel="Nueva oportunidad"
      onCreate={() => { setError(""); setCreating(true); }}
    />
    <OperationalMessages error={error} success={success} />
    {initial.opportunities.length === 0 ? (
      <EmptyOperational>No hay oportunidades. Registra una oportunidad y asígnale un revisor antes de enviarla a aprobación.</EmptyOperational>
    ) : <OperationalGrid>{initial.opportunities.map((opportunity) => <OperationalCard key={opportunity.id} onClick={() => setDetail(opportunity)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{opportunity.standardCode ?? "Sin norma"} · {opportunity.category}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{opportunity.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Revisor: {opportunity.reviewerName ?? "Sin asignar"}</div></div>
        <Badge status={opportunity.status} />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{opportunity.materializationPlan ? "Plan de materialización documentado" : "Plan pendiente"}{opportunity.dueDate ? ` · vence ${new Date(opportunity.dueDate).toLocaleDateString("es")}` : ""}</div>
      <CardActions canUpdate={initial.access.canUpdate && opportunity.status !== OpportunityStatus.MATERIALIZED && opportunity.status !== OpportunityStatus.CLOSED} canDelete={initial.access.canDelete && (opportunity.status === OpportunityStatus.IDENTIFIED || opportunity.status === OpportunityStatus.REJECTED)} pending={isPending} onEdit={() => { setError(""); setEditing(opportunity); }} onDelete={() => run(() => deleteOpportunity(opportunity.id), { onSuccess: () => setDetail(null), successMessage: "Oportunidad eliminada." })} />
    </OperationalCard>)}</OperationalGrid>}

    <FormModal open={creating || !!editing} title={editing ? "Editar oportunidad" : "Nueva oportunidad"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={row?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Norma / versión"><input aria-label="ISO_9001:2015" name="standardCode" className="nf-app-input" style={inputStyle} placeholder="ISO_9001:2015" defaultValue={row?.standardCode ?? ""} /></Field><Field label="Categoría"><input aria-label="Cliente, proceso, tecnología" name="category" required className="nf-app-input" style={inputStyle} placeholder="Cliente, proceso, tecnología…" defaultValue={row?.category ?? ""} /></Field></div>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Fuente"><input aria-label="Auditoría, análisis de contexto" name="source" className="nf-app-input" style={inputStyle} placeholder="Auditoría, análisis de contexto…" defaultValue={row?.source ?? ""} /></Field><Field label="Fecha objetivo"><input aria-label="Fecha de vencimiento" name="dueDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={row?.dueDate?.slice(0, 10) ?? ""} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Responsable"><select aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={row?.ownerId ?? ""}><option value="">Sin asignar</option>{memberRows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Revisor obligatorio"><select aria-label="Seleccionar revisor" name="reviewerId" required className="nf-app-input" style={inputStyle} defaultValue={row?.reviewerId ?? ""}><option value="">Seleccionar revisor…</option>{memberRows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div>
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
