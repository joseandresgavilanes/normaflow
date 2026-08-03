"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createInterestedParty, updateInterestedParty, deleteInterestedParty,
  createIntegratedObjective, updateIntegratedObjective, deleteIntegratedObjective,
} from "@/lib/actions/integrated";
import type { OrganizationalContextPayload } from "@/lib/context/queries";
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta,
  OperationalCard, OperationalGrid, OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type Party = OrganizationalContextPayload["interestedParties"][number];
type Objective = OrganizationalContextPayload["objectives"][number];
type Tab = "parties" | "objectives";

export function ContextLive({ initial }: { initial: OrganizationalContextPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [tab, setTab] = useState<Tab>("parties");
  const [creating, setCreating] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [detailParty, setDetailParty] = useState<Party | null>(null);
  const [detailObjective, setDetailObjective] = useState<Objective | null>(null);

  const memberOptions = initial.members.map((m) => ({ id: m.id, name: m.name }));

  function submitParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      type: String(fd.get("type") ?? "") || undefined,
      needs: String(fd.get("needs") ?? "") || undefined,
      requirements: String(fd.get("requirements") ?? "") || undefined,
      influence: Number(fd.get("influence") ?? 3),
      dependency: Number(fd.get("dependency") ?? 3),
      communication: String(fd.get("communication") ?? "") || undefined,
      responsibleId: String(fd.get("responsibleId") ?? "") || undefined,
    };
    run(() => editingParty ? updateInterestedParty(editingParty.id, input) : createInterestedParty(input), {
      onSuccess: () => { setCreating(false); setEditingParty(null); },
      successMessage: editingParty ? "Parte interesada actualizada." : "Parte interesada registrada.",
    });
  }

  function submitObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      target: String(fd.get("target") ?? "") || undefined,
      baseline: String(fd.get("baseline") ?? "") || undefined,
      unit: String(fd.get("unit") ?? "") || undefined,
      targetValue: fd.get("targetValue") ? Number(fd.get("targetValue")) : undefined,
      currentValue: fd.get("currentValue") ? Number(fd.get("currentValue")) : undefined,
      dueDate: String(fd.get("dueDate") ?? "") || undefined,
      status: (String(fd.get("status") ?? "PLANNED")) as Objective["status"],
      ownerId: String(fd.get("ownerId") ?? "") || undefined,
      resources: String(fd.get("resources") ?? "") || undefined,
    };
    run(() => editingObjective ? updateIntegratedObjective(editingObjective.id, input) : createIntegratedObjective(input), {
      onSuccess: () => { setCreating(false); setEditingObjective(null); },
      successMessage: editingObjective ? "Objetivo actualizado." : "Objetivo registrado.",
    });
  }

  return <div>
    <SectionTitle title="Contexto de la organización" sub="Partes interesadas y objetivos (cláusula 4.2 / 6.2) — aplica a cualquier norma activa, no solo al Sistema Integrado." />
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button type="button" className={tab === "parties" ? "nf-app-btn-primary" : "nf-app-btn-outline"} onClick={() => setTab("parties")}>Partes interesadas ({initial.interestedParties.length})</button>
      <button type="button" className={tab === "objectives" ? "nf-app-btn-primary" : "nf-app-btn-outline"} onClick={() => setTab("objectives")}>Objetivos ({initial.objectives.length})</button>
    </div>
    <OperationalMessages error={error} success={success} />

    {tab === "parties" ? <>
      <OperationalHeader title="Partes interesadas" subtitle="Necesidades, expectativas y requisitos aplicables por parte interesada." canCreate={initial.access.canCreate} actionLabel="Nueva parte interesada" onCreate={() => { setError(""); setEditingParty(null); setCreating(true); }} />
      {initial.interestedParties.length === 0 ? <EmptyOperational>No hay partes interesadas registradas. La cláusula 4.2 exige identificarlas y sus requisitos aplicables.</EmptyOperational> : <OperationalGrid>
        {initial.interestedParties.map((p) => <OperationalCard key={p.id} onClick={() => setDetailParty(p)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{p.code} · {p.type ?? "Sin tipo"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{p.name}</h3></div>
            {!p.isRelevant && <Badge status="OBSOLETE" />}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>Influencia {p.influence}/5 · Dependencia {p.dependency}/5</div>
          <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditingParty(p); setCreating(true); }} onDelete={() => run(() => deleteInterestedParty(p.id), { onSuccess: () => setDetailParty(null), successMessage: "Parte interesada eliminada." })} />
        </OperationalCard>)}
      </OperationalGrid>}

      <FormModal open={creating && !editingObjective} title={editingParty ? "Editar parte interesada" : "Nueva parte interesada"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditingParty(null); setError(""); }} onSubmit={submitParty}>
        <Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={editingParty?.name ?? ""} /></Field>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Tipo"><input aria-label="Cliente, trabajador, autoridad" name="type" className="nf-app-input" style={inputStyle} placeholder="Cliente, trabajador, autoridad…" defaultValue={editingParty?.type ?? ""} /></Field>
          <Field label="Responsable"><select aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle} defaultValue={editingParty?.responsibleId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Influencia (1-5)"><input aria-label="Influencia" name="influence" type="number" min={1} max={5} className="nf-app-input" style={inputStyle} defaultValue={editingParty?.influence ?? 3} /></Field>
          <Field label="Dependencia (1-5)"><input aria-label="Dependencia" name="dependency" type="number" min={1} max={5} className="nf-app-input" style={inputStyle} defaultValue={editingParty?.dependency ?? 3} /></Field>
        </div>
        <Field label="Necesidades y expectativas"><textarea aria-label="Necesidades" name="needs" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editingParty?.needs ?? ""} /></Field>
        <Field label="Requisitos aplicables"><textarea aria-label="Requisitos" name="requirements" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editingParty?.requirements ?? ""} /></Field>
        <Field label="Cómo se comunica"><textarea aria-label="Comunicación" name="communication" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editingParty?.communication ?? ""} /></Field>
      </FormModal>

      <Modal open={!!detailParty} onClose={() => setDetailParty(null)} title={detailParty?.name ?? "Parte interesada"} width={640}>{detailParty && <div style={{ display: "grid", gap: 12 }}>
        <div className="nf-grid-2"><Meta label="Tipo" value={detailParty.type} /><Meta label="Relevante" value={detailParty.isRelevant ? "Sí" : "No"} /></div>
        <Meta label="Necesidades y expectativas" value={detailParty.needs} />
        <Meta label="Requisitos aplicables" value={detailParty.requirements} />
        <Meta label="Comunicación" value={detailParty.communication} />
      </div>}</Modal>
    </> : <>
      <OperationalHeader title="Objetivos" subtitle="Objetivos medibles, coherentes con la política y con seguimiento de avance." canCreate={initial.access.canCreate} actionLabel="Nuevo objetivo" onCreate={() => { setError(""); setEditingObjective(null); setCreating(true); }} />
      {initial.objectives.length === 0 ? <EmptyOperational>No hay objetivos registrados. La cláusula 6.2 exige objetivos medibles y un plan para alcanzarlos.</EmptyOperational> : <OperationalGrid>
        {initial.objectives.map((o) => <OperationalCard key={o.id} onClick={() => setDetailObjective(o)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{o.code}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{o.title}</h3></div>
            <Badge status={o.status} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{o.targetValue != null ? `Meta: ${o.targetValue}${o.unit ?? ""}${o.currentValue != null ? ` · actual: ${o.currentValue}${o.unit ?? ""}` : ""}` : o.target ?? "Sin meta cuantificada"}</div>
          <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditingObjective(o); setCreating(true); }} onDelete={() => run(() => deleteIntegratedObjective(o.id), { onSuccess: () => setDetailObjective(null), successMessage: "Objetivo eliminado." })} />
        </OperationalCard>)}
      </OperationalGrid>}

      <FormModal open={creating && !editingParty} title={editingObjective ? "Editar objetivo" : "Nuevo objetivo"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditingObjective(null); setError(""); }} onSubmit={submitObjective}>
        <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.title ?? ""} /></Field>
        <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.description ?? ""} /></Field>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Meta (texto)"><input aria-label="Meta" name="target" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.target ?? ""} /></Field>
          <Field label="Línea base"><input aria-label="Línea base" name="baseline" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.baseline ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Valor meta"><input aria-label="Valor objetivo" name="targetValue" type="number" step="any" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.targetValue ?? ""} /></Field>
          <Field label="Valor actual"><input aria-label="Valor actual" name="currentValue" type="number" step="any" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.currentValue ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Unidad"><input aria-label="%, días, unidades" name="unit" className="nf-app-input" style={inputStyle} placeholder="%, días, unidades…" defaultValue={editingObjective?.unit ?? ""} /></Field>
          <Field label="Fecha objetivo"><input aria-label="Fecha de vencimiento" name="dueDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.dueDate?.slice(0, 10) ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.status ?? "PLANNED"}><option value="PLANNED">Planificado</option><option value="IN_PROGRESS">En curso</option><option value="ACHIEVED">Alcanzado</option><option value="NOT_ACHIEVED">No alcanzado</option><option value="CANCELLED">Cancelado</option></select></Field>
          <Field label="Responsable"><select aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.ownerId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        </div>
        <Field label="Recursos necesarios"><textarea aria-label="Recursos" name="resources" rows={2} className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.resources ?? ""} /></Field>
      </FormModal>

      <Modal open={!!detailObjective} onClose={() => setDetailObjective(null)} title={detailObjective?.title ?? "Objetivo"} width={640}>{detailObjective && <div style={{ display: "grid", gap: 12 }}>
        <div className="nf-grid-2"><Meta label="Estado" value={detailObjective.status} /><Meta label="Fecha objetivo" value={detailObjective.dueDate?.slice(0, 10)} /></div>
        <Meta label="Descripción" value={detailObjective.description} />
        <Meta label="Meta" value={detailObjective.target} />
        <Meta label="Recursos" value={detailObjective.resources} />
      </div>}</Modal>
    </>}
  </div>;
}
