"use client";

import { useState, type FormEvent } from "react";
import { ControlStatus, ControlType, RiskStatus, RiskTreatment } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
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
  type ProcessInput,
  type RiskControlInput,
  type RiskInput,
} from "@/lib/actions/operations";
import type { ProcessesPayload, RisksPayload } from "@/lib/server-queries";
import { DEFAULT_RISK_CATEGORY, riskCategoryOptions } from "@/lib/risk-catalog";
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

type ProcessRow = ProcessesPayload["processes"][number];
type RiskRow = RisksPayload["risks"][number];
type ControlRow = RiskRow["controls"][number];

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
      successMessage: editing ? "Proceso actualizado." : "Proceso creado en Supabase.",
    });
  }

  function remove(row: ProcessRow) {
    setConfirmDelete(row);
  }

  const formRow = editing;
  return (
    <div>
      <OperationalHeader title="Mapa de procesos" subtitle={`${initial.processes.length} procesos persistidos en Supabase`} canCreate={initial.access.canCreate} actionLabel="Nuevo proceso" onCreate={() => { setError(""); setCreating(true); }} />
      <OperationalMessages error={error} success={success} />
      {initial.processes.length === 0 ? <EmptyOperational>No hay procesos. Crea el primero para enlazar documentos, riesgos e indicadores.</EmptyOperational> : (
        <OperationalGrid>
          {initial.processes.map((row) => (
            <OperationalCard key={row.id} onClick={() => setDetail(row)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", color: "#5266F6", fontSize: 12, fontWeight: 600 }}>{row.code ?? "SIN CÓDIGO"}</div>
                  <h3 style={{ margin: "7px 0 5px", fontSize: 18, color: "var(--nf-ink)" }}>{row.name}</h3>
                  <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{row.type ?? "Sin tipo"} · {row.ownerName ?? "Sin responsable"}</div>
                </div>
                <Badge status="ACTIVE" label={row.type ?? "Proceso"} />
              </div>
              {row.description && <p style={{ fontSize: 13, color: "var(--nf-ink-2)", lineHeight: 1.5 }}>{row.description}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginTop: 13 }}>
                {[["Docs", row.counts.documents], ["Riesgos", row.counts.risks], ["KPIs", row.counts.indicators], ["Formación", row.counts.trainingAssignments]].map(([label, value]) => (
                  <div key={String(label)} style={{ background: "var(--nf-app-surface-1)", borderRadius: 9, padding: "8px 4px", textAlign: "center" }}><strong style={{ display: "block", color: "#5266F6" }}>{value}</strong><span style={{ fontSize: 9, color: "var(--nf-ink-3)", textTransform: "none" }}>{label}</span></div>
                ))}
              </div>
              <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
            </OperationalCard>
          ))}
        </OperationalGrid>
      )}

      <FormModal open={creating || !!editing} title={editing ? "Editar proceso" : "Nuevo proceso"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Nombre"><input name="name" className="nf-app-input" style={inputStyle} defaultValue={formRow?.name ?? ""} required /></Field>
          <Field label="Código"><input name="code" className="nf-app-input" style={inputStyle} defaultValue={formRow?.code ?? ""} /></Field>
        </div>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Tipo"><select name="type" className="nf-app-input" style={inputStyle} defaultValue={formRow?.type ?? "core"}><option value="core">Core</option><option value="support">Soporte</option><option value="strategic">Estratégico</option></select></Field>
          <Field label="Responsable"><select name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={formRow?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
        </div>
        <Field label="Descripción"><textarea name="description" className="nf-app-input" style={inputStyle} rows={3} defaultValue={formRow?.description ?? ""} /></Field>
        <Field label="Entradas (separadas por comas)"><input name="inputs" className="nf-app-input" style={inputStyle} defaultValue={formRow?.inputs.join(", ") ?? ""} /></Field>
        <Field label="Salidas (separadas por comas)"><input name="outputs" className="nf-app-input" style={inputStyle} defaultValue={formRow?.outputs.join(", ") ?? ""} /></Field>
      </FormModal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Proceso"} width={650}>
        {detail && <div style={{ display: "grid", gap: 18 }}>
          <div className="nf-grid-2"><Meta label="Código" value={detail.code} /><Meta label="Responsable" value={detail.ownerName} /><Meta label="Tipo" value={detail.type} /><Meta label="Actualizado" value={new Date(detail.updatedAt).toLocaleDateString("es")} /></div>
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
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#5266F6", fontWeight: 700 }}>{d.code}</span>
        <span style={{ fontSize: 13, marginLeft: 8 }}>{d.title}</span>
        <span style={{ fontSize: 11, color: "var(--nf-ink-3)", marginLeft: 6 }}>v{d.currentVersion}</span>
        {d.supersededByCode && <div style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>↪ Reemplazado por {d.supersededByCode}</div>}
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
    run(() => editing ? updateRisk(editing.id, input) : createRisk(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Riesgo actualizado." : "Riesgo creado en Supabase." });
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
    <OperationalHeader title="Gestión de riesgos" subtitle={`${initial.risks.length} riesgos persistidos`} canCreate={initial.access.canCreate} actionLabel="Nuevo riesgo" onCreate={() => { setError(""); setCreating(true); }} />
    <OperationalMessages error={error} success={success} />
    {initial.risks.length === 0 ? <EmptyOperational>No hay riesgos registrados.</EmptyOperational> : <OperationalGrid>{initial.risks.map((row) => <OperationalCard key={row.id} onClick={() => setDetail(row)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: "var(--nf-ink-2, #223648)", textTransform: "none", fontWeight: 600 }}>{row.category}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{row.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3, #314456)" }}>{row.processCode ? `${row.processCode} · ${row.processName}` : "Sin proceso"}</div></div><div style={{ width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 900, color: row.score >= 15 ? "#a62d29" : row.score >= 8 ? "#9a6510" : "#17633b", background: row.score >= 15 ? "#fff0ef" : row.score >= 8 ? "#fff8e6" : "#edf9f2" }}>{row.score}</div></div>
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}><Badge status={row.status} /><Badge status="ACTIVE" label={row.treatment} /><span style={{ fontSize: 12, color: "var(--nf-ink-3, #314456)", fontWeight: 600 }}>{row.ownerName ?? "Sin responsable"}</span></div>
      <CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
    </OperationalCard>)}</OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar riesgo" : "Nuevo riesgo"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
      <Field label="Título"><input name="title" className="nf-app-input" style={inputStyle} defaultValue={formRow?.title ?? ""} required /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Categoría"><select name="category" className="nf-app-input" style={inputStyle} defaultValue={formRow?.category ?? DEFAULT_RISK_CATEGORY} required>{riskCategoryOptions(formRow?.category).map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><Field label="Proceso"><select name="processId" className="nf-app-input" style={inputStyle} defaultValue={formRow?.processId ?? ""}><option value="">Sin proceso</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code ?? "PROC"} · {process.name}</option>)}</select></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Probabilidad (1-5)"><input name="probability" type="number" min="1" max="5" className="nf-app-input" style={inputStyle} defaultValue={formRow?.probability ?? 3} /></Field><Field label="Impacto (1-5)"><input name="impact" type="number" min="1" max="5" className="nf-app-input" style={inputStyle} defaultValue={formRow?.impact ?? 3} /></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Estado"><select name="status" className="nf-app-input" style={inputStyle} defaultValue={formRow?.status ?? RiskStatus.IDENTIFIED}>{Object.values(RiskStatus).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Tratamiento"><select name="treatment" className="nf-app-input" style={inputStyle} defaultValue={formRow?.treatment ?? RiskTreatment.MITIGATE}>{Object.values(RiskTreatment).map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Responsable"><select name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={formRow?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Fecha objetivo"><input name="dueDate" type="date" className="nf-app-input" style={inputStyle} defaultValue={formRow?.dueDate?.slice(0, 10) ?? ""} /></Field></div>
      <Field label="Score residual (0-25)"><input name="residualScore" type="number" min="0" max="25" className="nf-app-input" style={inputStyle} defaultValue={formRow?.residualScore ?? ""} /></Field>
      <Field label="Descripción"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={formRow?.description ?? ""} /></Field>
    </FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? "Riesgo"} width={650}>{detail && <div style={{ display: "grid", gap: 18 }}><div className="nf-grid-2"><Meta label="Score inherente" value={detail.score} /><Meta label="Score residual" value={detail.residualScore} /><Meta label="Proceso" value={detail.processName} /><Meta label="Responsable" value={detail.ownerName} /></div><Meta label="Descripción" value={detail.description} /><div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 13 }}>Controles ({detail.controls.length})</strong>{initial.access.canUpdate && <button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setControlRisk(detail); setEditingControl(null); }}>Añadir control</button>}</div>{detail.controls.length ? <div style={{ display: "grid", gap: 8, marginTop: 9 }}>{detail.controls.map((control) => <div key={control.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 750 }}>{control.title}</span><Badge status={control.status} /></div><div style={{ marginTop: 4, fontSize: 12, color: "var(--nf-ink-3)" }}>{control.type}{control.description ? ` · ${control.description}` : ""}</div>{initial.access.canUpdate && <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button type="button" className="nf-app-btn-ghost" onClick={() => { setDetail(null); setControlRisk(detail); setEditingControl(control); }}>Editar</button><button type="button" className="nf-app-btn-ghost" style={{ color: "#a62d29" }} onClick={() => removeControl(control)}>Eliminar</button></div>}</div>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin controles.</p>}</div></div>}</Modal>
    <FormModal open={!!controlRisk} title={editingControl ? "Editar control" : `Nuevo control · ${controlRisk?.title ?? ""}`} pending={isPending} error={error} onClose={() => { setControlRisk(null); setEditingControl(null); setError(""); }} onSubmit={submitControl}>
      <Field label="Título"><input name="title" required className="nf-app-input" style={inputStyle} defaultValue={editingControl?.title ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Tipo"><select name="type" className="nf-app-input" style={inputStyle} defaultValue={editingControl?.type ?? ControlType.PREVENTIVE}>{Object.values(ControlType).map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Estado"><select name="status" className="nf-app-input" style={inputStyle} defaultValue={editingControl?.status ?? ControlStatus.PLANNED}>{Object.values(ControlStatus).map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      <Field label="Responsable"><select name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={editingControl?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
      <Field label="Descripción"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editingControl?.description ?? ""} /></Field>
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
