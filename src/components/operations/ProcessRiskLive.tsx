"use client";

import { useState, type FormEvent } from "react";
import { ControlStatus, ControlType, RiskStatus, RiskTreatment } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import BarChart from "@/components/charts/BarChart";
import RiskMatrix from "@/components/charts/RiskMatrix";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createProcess,
  createRisk,
  createRiskControl,
  deleteProcess,
  deleteRisk,
  deleteRiskControl,
  updateProcess,
  updateRisk,
  updateRiskControl,
  transitionRisk,
  transitionRiskControl,
  type ProcessInput,
  type RiskControlInput,
  type RiskInput,
} from "@/lib/actions/operations";
import type { ProcessesPayload, RisksPayload } from "@/lib/server-queries";
import { DEFAULT_RISK_CATEGORY, riskCategoryOptions } from "@/lib/risk-catalog";
import { formatDate } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import EntityTable from "@/components/ui/EntityTable";
import DateField from "@/components/ui/DateField";
import { processTypeLabel } from "@/lib/status-labels";
import {
  CellTitle,
  CountCell,
  Field,
  FormModal,
  Meta,
  OperationalHeader,
  OperationalMessages,
  RowActions,
  ScoreCell,
  inputStyle,
} from "./OperationalUi";

type ProcessRow = ProcessesPayload["processes"][number];
type RiskRow = RisksPayload["risks"][number];
type ControlRow = RiskRow["controls"][number];

/**
 * Reparto por categoría, de mayor a menor y con el resto agrupado.
 *
 * El catálogo de categorías es abierto: sin el corte, una organización con
 * veinte categorías obtiene veinte barras de una unidad, que no comparan nada.
 */
function risksByCategory(risks: RiskRow[]) {
  const counts = new Map<string, number>();
  risks.forEach((risk) => {
    const key = risk.category || "Sin categoría";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, 6).map(([label, value]) => ({ label, value }));
  const tail = sorted.slice(6).reduce((sum, [, value]) => sum + value, 0);
  return tail > 0 ? [...head, { label: "Otras categorías", value: tail }] : head;
}

const NEXT_RISK_STATUS: Partial<Record<RiskStatus, RiskStatus[]>> = {
  IDENTIFIED: [RiskStatus.UNDER_TREATMENT, RiskStatus.ACCEPTED],
  UNDER_TREATMENT: [RiskStatus.MONITORED, RiskStatus.MITIGATED, RiskStatus.IDENTIFIED],
  MONITORED: [RiskStatus.UNDER_TREATMENT, RiskStatus.MITIGATED, RiskStatus.CLOSED],
  MITIGATED: [RiskStatus.MONITORED, RiskStatus.CLOSED],
  ACCEPTED: [RiskStatus.MONITORED, RiskStatus.CLOSED],
  CLOSED: [RiskStatus.IDENTIFIED],
};

const NEXT_CONTROL_STATUS: Partial<Record<ControlStatus, ControlStatus[]>> = {
  PLANNED: [ControlStatus.IMPLEMENTED],
  IMPLEMENTED: [ControlStatus.EFFECTIVE, ControlStatus.INEFFECTIVE],
  EFFECTIVE: [ControlStatus.INEFFECTIVE],
  INEFFECTIVE: [ControlStatus.PLANNED, ControlStatus.IMPLEMENTED],
};

function csv(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function ProcessesLiveClient({ initial }: { initial: ProcessesPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProcessRow | null>(null);
  const [detail, setDetail] = useState<ProcessRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProcessRow | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: ProcessInput = {
      name: String(fd.get("name") ?? ""),
      code: String(fd.get("code") ?? ""),
      type: String(fd.get("type") ?? "core"),
      description: String(fd.get("description") ?? ""),
      ownerId: String(fd.get("ownerId") ?? "") || undefined,
      inputs: csv(fd.get("inputs")),
      outputs: csv(fd.get("outputs")),
    };
    run(() => editing ? updateProcess(editing.id, input) : createProcess(input), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: editing ? "Proceso actualizado." : "Proceso creado.",
    });
  }

  function remove(row: ProcessRow) {
    setConfirmDelete(row);
  }

  const formRow = editing;
  return (
    <div>
      <OperationalHeader title="Mapa de procesos" subtitle="Mapa de procesos del SGC con responsable, entradas, salidas y sus documentos, riesgos e indicadores enlazados." canCreate={initial.access.canCreate} actionLabel="Nuevo proceso" onCreate={() => { setError(""); setCreating(true); }} />
      <OperationalMessages error={error} success={success} />
        <EntityTable
        caption="Procesos"
        rows={initial.processes}
        rowKey={(row) => row.id}
        rowAction={(row) => setDetail(row)}
        storageKey="processes"
        searchText={(row) => `${row.code ?? ""} ${row.name} ${row.type ?? ""} ${row.ownerName ?? ""} ${row.description ?? ""}`}
        searchPlaceholder="Buscar por código, nombre o responsable…"
        filters={[
          { id: "type", label: "Tipo", value: (row) => row.type, format: processTypeLabel },
          { id: "owner", label: "Responsable", value: (row) => row.ownerName, format: (value) => value },
        ]}
        emptyTitle="Todavía no hay procesos"
        emptyDescription="El mapa de procesos es la base sobre la que cuelgan documentos, riesgos e indicadores."
        columns={[
          {
            id: "name", header: "Proceso", primary: true, minWidth: 240, sortValue: (row) => row.name,
            cell: (row) => <CellTitle title={row.name} meta={`${row.code ?? "Sin código"} · ${processTypeLabel(row.type)}`} />,
          },
          { id: "owner", header: "Responsable", sortValue: (row) => row.ownerName ?? "", cell: (row) => row.ownerName ?? "Sin responsable" },
          { id: "documents", header: "Docs", numeric: true, align: "end", hideable: true, sortValue: (row) => row.counts.documents, cell: (row) => <CountCell value={row.counts.documents} /> },
          { id: "risks", header: "Riesgos", numeric: true, align: "end", hideable: true, sortValue: (row) => row.counts.risks, cell: (row) => <CountCell value={row.counts.risks} /> },
          { id: "indicators", header: "KPIs", numeric: true, align: "end", hideable: true, sortValue: (row) => row.counts.indicators, cell: (row) => <CountCell value={row.counts.indicators} /> },
          { id: "training", header: "Formación", numeric: true, align: "end", hideable: true, defaultHidden: true, sortValue: (row) => row.counts.trainingAssignments, cell: (row) => <CountCell value={row.counts.trainingAssignments} /> },
        ]}
        actions={(row) => (
          <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
            onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
        )}
      />

      <FormModal open={creating || !!editing} title={editing ? "Editar proceso" : "Nuevo proceso"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Nombre"><input aria-label="Nombre" name="name" className="nf-app-input" style={inputStyle} defaultValue={formRow?.name ?? ""} required /></Field>
          <Field label="Código"><input aria-label="Código" name="code" className="nf-app-input" style={inputStyle} defaultValue={formRow?.code ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Tipo"><Picker aria-label="Tipo" name="type" className="nf-app-input" style={inputStyle} defaultValue={formRow?.type ?? "core"}><option value="core">Core</option><option value="support">Soporte</option><option value="strategic">Estratégico</option></Picker></Field>
          <Field label="Responsable"><PersonPicker name="ownerId" people={initial.members} defaultValue={formRow?.ownerId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field>
        </div>
        <Field label="Descripción"><textarea aria-label="Descripción" name="description" className="nf-app-input" style={inputStyle} rows={3} defaultValue={formRow?.description ?? ""} /></Field>
        <Field label="Entradas (separadas por comas)"><input aria-label="Entradas" name="inputs" className="nf-app-input" style={inputStyle} defaultValue={formRow?.inputs.join(", ") ?? ""} /></Field>
        <Field label="Salidas (separadas por comas)"><input aria-label="Salidas" name="outputs" className="nf-app-input" style={inputStyle} defaultValue={formRow?.outputs.join(", ") ?? ""} /></Field>
      </FormModal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Proceso"} width={650}>
        {detail && <div style={{ display: "grid", gap: 18 }}>
          <div className="nf-grid-2"><Meta label="Código" value={detail.code} /><Meta label="Responsable" value={detail.ownerName} /><Meta label="Tipo" value={detail.type} /><Meta label="Actualizado" value={formatDate(detail.updatedAt)} /></div>
          <Meta label="Descripción" value={detail.description} />
          <div className="nf-grid-2"><Meta label="Entradas" value={detail.inputs.join(" · ") || "—"} /><Meta label="Salidas" value={detail.outputs.join(" · ") || "—"} /></div>
          <ProcessDocuments documents={detail.documents} />
        </div>}
      </Modal>
      <ConfirmActionModal
        open={!!confirmDelete}
        title="Eliminar proceso"
        confirmLabel="Eliminar"
        danger
        pending={isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          run(() => deleteProcess(confirmDelete.id), {
            onSuccess: () => {
              setDetail((current) => current?.id === confirmDelete.id ? null : current);
              setConfirmDelete(null);
            },
            successMessage: "Proceso eliminado.",
          });
        }}
      >
        ¿Eliminar el proceso <strong>{confirmDelete?.name}</strong>? Los vínculos quedarán sin proceso.
      </ConfirmActionModal>
    </div>
  );
}

function ProcessDocuments({ documents }: { documents: ProcessRow["documents"] }) {
  const active = documents.filter((d) => d.status !== "OBSOLETE");
  const historical = documents.filter((d) => d.status === "OBSOLETE");
  const Row = (d: ProcessRow["documents"][number], muted: boolean) => (
    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 9, opacity: muted ? 0.75 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700 }}>{d.code}</span>
        <span style={{ fontSize: 13, marginLeft: 8 }}>{d.title}</span>
        <span style={{ fontSize: 11, color: "var(--nf-ink-3)", marginLeft: 6 }}>v{d.currentVersion}</span>
        {d.supersededByCode && <div style={{ fontSize: 11, color: "var(--nf-warning-text)", fontWeight: 600 }}>↪ Reemplazado por {d.supersededByCode}</div>}
      </div>
      <Badge status={d.status} />
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <strong style={{ fontSize: 13 }}>Documentos activos ({active.length})</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {active.length ? active.map((d) => Row(d, false)) : <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: 0 }}>Sin documentos activos enlazados.</p>}
        </div>
      </div>
      {historical.length > 0 && (
        <div>
          <strong style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Históricos / obsoletos ({historical.length})</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {historical.map((d) => Row(d, true))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RisksLiveClient({ initial }: { initial: RisksPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RiskRow | null>(null);
  const [detail, setDetail] = useState<RiskRow | null>(null);
  const [controlRisk, setControlRisk] = useState<RiskRow | null>(null);
  const [editingControl, setEditingControl] = useState<ControlRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: "risk"; row: RiskRow }
    | { type: "control"; row: ControlRow }
    | null
  >(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const residual = String(fd.get("residualScore") ?? "");
    const input: RiskInput = {
      title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), category: String(fd.get("category") ?? ""),
      probability: Number(fd.get("probability")), impact: Number(fd.get("impact")), status: fd.get("status") as RiskStatus,
      treatment: fd.get("treatment") as RiskTreatment, ownerId: String(fd.get("ownerId") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined, dueDate: String(fd.get("dueDate") ?? "") || undefined,
      residualScore: residual ? Number(residual) : null,
    };
    run(() => editing ? updateRisk(editing.id, input) : createRisk(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Riesgo actualizado." : "Riesgo creado." });
  }

  function remove(row: RiskRow) {
    setConfirmDelete({ type: "risk", row });
  }

  function submitControl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!controlRisk) return;
    const fd = new FormData(event.currentTarget);
    const input: RiskControlInput = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      type: fd.get("type") as ControlType,
      status: fd.get("status") as ControlStatus,
      ownerId: String(fd.get("ownerId") ?? "") || undefined,
    };
    run(() => editingControl ? updateRiskControl(editingControl.id, input) : createRiskControl(controlRisk.id, input), {
      onSuccess: () => { setControlRisk(null); setEditingControl(null); },
      successMessage: editingControl ? "Control actualizado." : "Control añadido al riesgo.",
    });
  }

  function removeControl(control: ControlRow) {
    setConfirmDelete({ type: "control", row: control });
  }
  const formRow = editing;
  return <div>
    <OperationalHeader title="Gestión de riesgos" subtitle="Inventario de riesgos con probabilidad, impacto, tratamiento y responsable (cláusula 6.1)." canCreate={initial.access.canCreate} actionLabel="Nuevo riesgo" onCreate={() => { setError(""); setCreating(true); }} />
    <OperationalMessages error={error} success={success} />
    {/* La matriz existía solo en el módulo demo: una organización con datos
        reales veía el mismo producto sin ella. */}
    <div className="nf-chart-grid-2">
      <RiskMatrix risks={initial.risks} onSelect={(cell) => setDetail(cell[0])} />
      <BarChart
        title="Riesgos por categoría"
        subtitle="Cuántos riesgos concentra cada categoría del inventario."
        data={risksByCategory(initial.risks)}
      />
    </div>
    <EntityTable
      caption="Riesgos"
      rows={initial.risks}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="risks"
      searchText={(row) => `${row.title} ${row.category} ${row.processName ?? ""} ${row.ownerName ?? ""}`}
      searchPlaceholder="Buscar por título, categoría o proceso…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "treatment", label: "Tratamiento", value: (row) => row.treatment },
        { id: "category", label: "Categoría", value: (row) => row.category, format: (value) => value },
      ]}
      emptyTitle="Todavía no hay riesgos"
      emptyDescription="Un riesgo necesita probabilidad, impacto y un responsable que decida su tratamiento."
      columns={[
        {
          id: "title", header: "Riesgo", primary: true, minWidth: 240, sortValue: (row) => row.title,
          cell: (row) => <CellTitle title={row.title} meta={`${row.category}${row.processCode ? ` · ${row.processCode}` : ""}`} />,
        },
        {
          id: "score", header: "Nivel", numeric: true, align: "end", sortValue: (row) => row.score,
          cell: (row) => <ScoreCell value={row.score} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        { id: "treatment", header: "Tratamiento", hideable: true, sortValue: (row) => row.treatment, cell: (row) => row.treatment },
        { id: "owner", header: "Responsable", hideable: true, sortValue: (row) => row.ownerName ?? "", cell: (row) => row.ownerName ?? "Sin responsable" },
      ]}
      actions={(row) => (
        <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
          onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
      )}
    />
    <FormModal open={creating || !!editing} title={editing ? "Editar riesgo" : "Nuevo riesgo"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input aria-label="Título" name="title" className="nf-app-input" style={inputStyle} defaultValue={formRow?.title ?? ""} required /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Categoría"><Picker aria-label="Categoría" name="category" className="nf-app-input" style={inputStyle} defaultValue={formRow?.category ?? DEFAULT_RISK_CATEGORY} required>{riskCategoryOptions(formRow?.category).map((option) => <option key={option} value={option}>{option}</option>)}</Picker></Field><Field label="Proceso"><Picker aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={formRow?.processId ?? ""}><option value="">Sin proceso</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code ?? "PROC"} · {process.name}</option>)}</Picker></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Probabilidad (1-5)"><input aria-label="Probabilidad" name="probability" type="number" min="1" max="5" className="nf-app-input" style={inputStyle} defaultValue={formRow?.probability ?? 3} /></Field><Field label="Impacto (1-5)"><input aria-label="Impacto" name="impact" type="number" min="1" max="5" className="nf-app-input" style={inputStyle} defaultValue={formRow?.impact ?? 3} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Estado"><div className="nf-app-input" style={{ ...inputStyle, color: "var(--nf-ink-2)" }}>{formRow?.status ?? RiskStatus.IDENTIFIED}</div><input type="hidden" name="status" value={formRow?.status ?? RiskStatus.IDENTIFIED} /></Field><Field label="Tratamiento"><Picker aria-label="Tratamiento" name="treatment" className="nf-app-input" style={inputStyle} defaultValue={formRow?.treatment ?? RiskTreatment.MITIGATE}>{Object.values(RiskTreatment).map((value) => <option key={value}>{value}</option>)}</Picker></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Responsable"><PersonPicker name="ownerId" people={initial.members} defaultValue={formRow?.ownerId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field><Field label="Fecha objetivo"><DateField aria-label="Fecha de vencimiento" name="dueDate" className="nf-app-input" style={inputStyle} defaultValue={formRow?.dueDate?.slice(0, 10) ?? ""} /></Field></div>
      <Field label="Score residual (0-25)"><input aria-label="Puntuación residual" name="residualScore" type="number" min="0" max="25" className="nf-app-input" style={inputStyle} defaultValue={formRow?.residualScore ?? ""} /></Field>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={formRow?.description ?? ""} /></Field>
    </FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? "Riesgo"} width={650}>{detail && <div style={{ display: "grid", gap: 18 }}><div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Score inherente" value={detail.score} /><Meta label="Score residual" value={detail.residualScore} /><Meta label="Proceso" value={detail.processName} /><Meta label="Responsable" value={detail.ownerName} /></div><Meta label="Descripción" value={detail.description} />{initial.access.canUpdate && (NEXT_RISK_STATUS[detail.status] ?? []).length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(NEXT_RISK_STATUS[detail.status] ?? []).map((status) => <button key={status} type="button" className="nf-app-btn-primary" onClick={() => run(() => transitionRisk(detail.id, status), { onSuccess: () => setDetail(null), successMessage: `Riesgo movido a ${status.replaceAll("_", " ")}.` })}>Mover a {status.replaceAll("_", " ")}</button>)}</div>}<div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 13 }}>Controles ({detail.controls.length})</strong>{initial.access.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setControlRisk(detail); setEditingControl(null); }}>Añadir control</button>}</div>{detail.controls.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.controls.map((control) => <div key={control.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 750 }}>{control.title}</span><Badge status={control.status} /></div><div style={{ marginTop: 4, fontSize: 12, color: "var(--nf-ink-3)" }}>{control.type}{control.description ? ` · ${control.description}` : ""}</div>{initial.access.canUpdate && <div style={{ display: "flex", gap: 7, marginTop: 7, flexWrap: "wrap" }}>{(NEXT_CONTROL_STATUS[control.status] ?? []).map((status) => <button key={status} type="button" className="nf-app-btn-ghost" onClick={() => run(() => transitionRiskControl(control.id, status), { onSuccess: () => setDetail(null), successMessage: `Control movido a ${status}.` })}>{status}</button>)}<button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setControlRisk(detail); setEditingControl(control); }}>Editar</button><button type="button" className="nf-app-btn-ghost" style={{ color: "var(--nf-danger-text)" }} onClick={() => removeControl(control)}>Eliminar</button></div>}</div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin controles.</p>}</div></div>}</Modal>
    <FormModal open={!!controlRisk} title={editingControl ? "Editar control" : `Nuevo control · ${controlRisk?.title ?? ""}`} pending={isPending} error={error} onClose={() => { setControlRisk(null); setEditingControl(null); setError(""); }} onSubmit={submitControl}>
      <Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} defaultValue={editingControl?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><Picker aria-label="Tipo" name="type" className="nf-app-input" style={inputStyle} defaultValue={editingControl?.type ?? ControlType.PREVENTIVE}>{Object.values(ControlType).map((value) => <option key={value}>{value}</option>)}</Picker></Field><Field label="Estado"><div className="nf-app-input" style={{ ...inputStyle, color: "var(--nf-ink-2)" }}>{editingControl?.status ?? ControlStatus.PLANNED}</div><input type="hidden" name="status" value={editingControl?.status ?? ControlStatus.PLANNED} /></Field></div>
      <Field label="Responsable"><PersonPicker name="ownerId" people={initial.members} defaultValue={editingControl?.ownerId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field>
      <Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editingControl?.description ?? ""} /></Field>
    </FormModal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title={confirmDelete?.type === "control" ? "Eliminar control" : "Eliminar riesgo"}
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        if (confirmDelete.type === "risk") {
          const row = confirmDelete.row;
          run(() => deleteRisk(row.id), {
            onSuccess: () => {
              setDetail((current) => current?.id === row.id ? null : current);
              setConfirmDelete(null);
            },
            successMessage: "Riesgo eliminado.",
          });
          return;
        }
        run(() => deleteRiskControl(confirmDelete.row.id), {
          onSuccess: () => {
            setDetail(null);
            setConfirmDelete(null);
          },
          successMessage: "Control eliminado.",
        });
      }}
    >
      {confirmDelete?.type === "control" ? (
        <>¿Eliminar el control <strong>{confirmDelete.row.title}</strong>?</>
      ) : (
        <>¿Eliminar el riesgo <strong>{confirmDelete?.row.title}</strong>?</>
      )}
    </ConfirmActionModal>
  </div>;
}
