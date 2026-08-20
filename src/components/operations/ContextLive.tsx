"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SectionTitle from "@/components/ui/SectionTitle";
import PageTabs from "@/components/ui/PageTabs";
import { useModuleSection } from "@/hooks/useModuleSection";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createInterestedParty, updateInterestedParty, deleteInterestedParty,
  createIntegratedObjective, updateIntegratedObjective, deleteIntegratedObjective,
} from "@/lib/actions/integrated";
import type { OrganizationalContextPayload } from "@/lib/context/queries";
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

type Party = OrganizationalContextPayload["interestedParties"][number];
type Objective = OrganizationalContextPayload["objectives"][number];
type Tab = "parties" | "objectives";

/** Contexto no es una norma: su navegación vive dentro de la página. */
const TABS = [
  { id: "parties" as const, label: "Partes interesadas" },
  { id: "objectives" as const, label: "Objetivos" },
];

export function ContextLive({ initial }: { initial: OrganizationalContextPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [tab, setTab] = useModuleSection<Tab>("parties");
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
    <PageTabs tabs={TABS} active={tab} onChange={setTab} label="Secciones del contexto de la organización" />
    <OperationalMessages error={error} success={success} />

    {tab === "parties" ? <>
      <OperationalHeader headingLevel={2} title="Partes interesadas" subtitle="Necesidades, expectativas y requisitos aplicables por parte interesada." canCreate={initial.access.canCreate} actionLabel="Nueva parte interesada" onCreate={() => { setError(""); setEditingParty(null); setCreating(true); }} />
      <EntityTable
        caption="Partes interesadas"
        rows={initial.interestedParties}
        rowKey={(row) => row.id}
        rowAction={(row) => setDetailParty(row)}
        storageKey="interested-parties"
        searchText={(row) => `${row.code} ${row.name} ${row.type ?? ""} ${row.needs ?? ""}`}
        searchPlaceholder="Buscar por código, nombre o tipo…"
        filters={[
          { id: "type", label: "Tipo", value: (row) => row.type, format: (value) => value },
          { id: "relevant", label: "Pertinencia", value: (row) => (row.isRelevant ? "SI" : "NO"), format: (value) => (value === "SI" ? "Pertinente" : "No pertinente") },
        ]}
        emptyTitle="Todavía no hay partes interesadas"
        emptyDescription="Identifica clientes, autoridades, proveedores y personal antes de analizar sus requisitos."
        columns={[
          {
            id: "name", header: "Parte interesada", primary: true, minWidth: 220, sortValue: (row) => row.name,
            cell: (row) => <CellTitle title={row.name} meta={`${row.code} · ${row.type ?? "Sin tipo"}`} />,
          },
          { id: "influence", header: "Influencia", numeric: true, align: "end", sortValue: (row) => row.influence, cell: (row) => `${row.influence}/5` },
          { id: "dependency", header: "Dependencia", numeric: true, align: "end", sortValue: (row) => row.dependency, cell: (row) => `${row.dependency}/5` },
          {
            id: "relevant", header: "Pertinencia", hideable: true, sortValue: (row) => (row.isRelevant ? 1 : 0),
            cell: (row) => row.isRelevant ? "Pertinente" : <Badge status="OBSOLETE" />,
          },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditingParty(row); setCreating(true); }}
            onDelete={() => run(() => deleteInterestedParty(row.id), { onSuccess: () => setDetailParty(null), successMessage: "Parte interesada eliminada." })} />
        )}
      />

      <FormModal open={creating && !editingObjective} title={editingParty ? "Editar parte interesada" : "Nueva parte interesada"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditingParty(null); setError(""); }} onSubmit={submitParty}>
        <Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={editingParty?.name ?? ""} /></Field>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Tipo"><input aria-label="Cliente, trabajador, autoridad" name="type" className="nf-app-input" style={inputStyle} placeholder="Cliente, trabajador, autoridad…" defaultValue={editingParty?.type ?? ""} /></Field>
          <Field label="Responsable"><Picker aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle} defaultValue={editingParty?.responsibleId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Picker></Field>
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
      <OperationalHeader headingLevel={2} title="Objetivos" subtitle="Objetivos medibles, coherentes con la política y con seguimiento de avance." canCreate={initial.access.canCreate} actionLabel="Nuevo objetivo" onCreate={() => { setError(""); setEditingObjective(null); setCreating(true); }} />
      <EntityTable
        caption="Objetivos"
        rows={initial.objectives}
        rowKey={(row) => row.id}
        rowAction={(row) => setDetailObjective(row)}
        storageKey="objectives"
        searchText={(row) => `${row.code} ${row.title} ${row.target ?? ""}`}
        searchPlaceholder="Buscar por código o título…"
        filters={[{ id: "status", label: "Estado", value: (row) => row.status }]}
        emptyTitle="Todavía no hay objetivos"
        emptyDescription="Un objetivo del sistema necesita meta, responsable y plazo para poder medirse."
        columns={[
          {
            id: "title", header: "Objetivo", primary: true, minWidth: 240, sortValue: (row) => row.title,
            cell: (row) => <CellTitle title={row.title} meta={row.code} />,
          },
          { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
          {
            id: "target", header: "Meta", hideable: true, sortValue: (row) => row.targetValue ?? "",
            cell: (row) => row.targetValue != null ? `${row.targetValue}${row.unit ?? ""}` : row.target ?? "Sin meta cuantificada",
          },
          {
            id: "current", header: "Actual", numeric: true, align: "end", hideable: true, sortValue: (row) => row.currentValue ?? "",
            cell: (row) => row.currentValue != null ? `${row.currentValue}${row.unit ?? ""}` : "—",
          },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditingObjective(row); setCreating(true); }}
            onDelete={() => run(() => deleteIntegratedObjective(row.id), { onSuccess: () => setDetailObjective(null), successMessage: "Objetivo eliminado." })} />
        )}
      />

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
          <Field label="Fecha objetivo"><DateField aria-label="Fecha de vencimiento" name="dueDate" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.dueDate?.slice(0, 10) ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Estado"><Picker aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.status ?? "PLANNED"}><option value="PLANNED">Planificado</option><option value="IN_PROGRESS">En curso</option><option value="ACHIEVED">Alcanzado</option><option value="NOT_ACHIEVED">No alcanzado</option><option value="CANCELLED">Cancelado</option></Picker></Field>
          <Field label="Responsable"><Picker aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={editingObjective?.ownerId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Picker></Field>
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
