"use client";

import { useState, type FormEvent } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { IndicatorStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useServerAction } from "@/hooks/useServerAction";
import {
  addIndicatorValue,
  createEvidence,
  createIndicator,
  deleteIndicator,
  getEvidenceUrl,
  removeEvidence,
  updateIndicator,
  type IndicatorInput,
} from "@/lib/actions/operations";
import type { EvidencePayload, IndicatorsPayload } from "@/lib/server-queries";
import { formatDate } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import EntityTable from "@/components/ui/EntityTable";
import FileImportArea from "@/components/ui/FileImportArea";
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

type IndicatorRow = IndicatorsPayload["indicators"][number];
type EvidenceRow = EvidencePayload["evidence"][number];
type EvidenceModule = keyof EvidencePayload["targets"];

export function IndicatorsLiveClient({ initial }: { initial: IndicatorsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<IndicatorRow | null>(null); const [detail, setDetail] = useState<IndicatorRow | null>(null); const [valueIndicator, setValueIndicator] = useState<IndicatorRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IndicatorRow | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const input: IndicatorInput = { name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), unit: String(fd.get("unit") ?? ""), target: Number(fd.get("target")), frequency: String(fd.get("frequency") ?? "monthly"), ownerId: String(fd.get("ownerId") ?? "") || undefined, status: fd.get("status") as IndicatorStatus, clauseCode: String(fd.get("clauseCode") ?? ""), processId: String(fd.get("processId") ?? "") || undefined }; run(() => editing ? updateIndicator(editing.id, input) : createIndicator(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Indicador actualizado." : "Indicador creado." }); }
  function submitValue(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!valueIndicator) return; const fd = new FormData(event.currentTarget); run(() => addIndicatorValue(valueIndicator.id, { value: Number(fd.get("value")), period: String(fd.get("period") ?? ""), note: String(fd.get("note") ?? "") }), { onSuccess: () => setValueIndicator(null), successMessage: "Medición registrada." }); }
  function remove(row: IndicatorRow) { setConfirmDelete(row); }
  const row = editing;
  return <div><OperationalHeader title="Indicadores" subtitle="Indicadores del sistema con meta, frecuencia de medición y responsable (cláusula 9.1)." canCreate={initial.access.canCreate} actionLabel="Nuevo indicador" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Indicadores"
      rows={initial.indicators}
      rowKey={(row) => row.id}
      rowAction={(row) => setDetail(row)}
      storageKey="indicators"
      searchText={(row) => `${row.name} ${row.processCode ?? ""} ${row.ownerName ?? ""}`}
      searchPlaceholder="Buscar por nombre, proceso o responsable…"
      filters={[
        { id: "status", label: "Estado", value: (row) => row.status },
        { id: "frequency", label: "Frecuencia", value: (row) => row.frequency },
      ]}
      emptyTitle="Todavía no hay indicadores"
      emptyDescription="Un indicador necesita meta, unidad y frecuencia para poder seguirse."
      columns={[
        {
          id: "name", header: "Indicador", primary: true, minWidth: 240, sortValue: (row) => row.name,
          cell: (row) => <CellTitle title={row.name} meta={`${row.frequency} · ${row.processCode ?? "Sin proceso"}`} />,
        },
        { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={row.status} /> },
        {
          id: "value", header: "Última medición", numeric: true, align: "end",
          sortValue: (row) => row.values[0]?.value ?? null,
          cell: (row) => row.values[0] ? `${row.values[0].value} ${row.unit}` : "—",
        },
        { id: "target", header: "Meta", numeric: true, align: "end", hideable: true, sortValue: (row) => row.target, cell: (row) => `${row.target} ${row.unit}` },
        { id: "owner", header: "Responsable", hideable: true, sortValue: (row) => row.ownerName ?? "", cell: (row) => row.ownerName ?? "Sin responsable" },
      ]}
      actions={(row) => (
        <RowActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending}
          onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)}
          extra={initial.access.canUpdate ? (
            <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => setValueIndicator(row)}>Medir</button>
          ) : undefined} />
      )}
    />
    <FormModal open={creating || !!editing} title={editing ? "Editar indicador" : "Nuevo indicador"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={row?.name ?? ""} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Unidad"><input aria-label="Unidad" name="unit" required className="nf-app-input" style={inputStyle} defaultValue={row?.unit ?? "%"} /></Field><Field label="Meta"><input aria-label="Meta" name="target" type="number" step="any" required className="nf-app-input" style={inputStyle} defaultValue={row?.target ?? 100} /></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Frecuencia"><Picker aria-label="Frecuencia" name="frequency" className="nf-app-input" style={inputStyle} defaultValue={row?.frequency ?? "monthly"}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></Picker></Field><Field label="Estado"><Picker aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? IndicatorStatus.ON_TRACK}>{Object.values(IndicatorStatus).map((value) => <option key={value}>{value}</option>)}</Picker></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Proceso"><Picker aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={row?.processId ?? ""}><option value="">Sin proceso</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code ?? "PROC"} · {process.name}</option>)}</Picker></Field><Field label="Responsable"><PersonPicker name="ownerId" people={initial.members} defaultValue={row?.ownerId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field></div><Field label="Cláusula"><input aria-label="Código de cláusula" name="clauseCode" className="nf-app-input" style={inputStyle} defaultValue={row?.clauseCode ?? ""} /></Field><Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field></FormModal>
    <FormModal open={!!valueIndicator} title={`Nueva medición · ${valueIndicator?.name ?? ""}`} pending={isPending} error={error} onClose={() => setValueIndicator(null)} onSubmit={submitValue}><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Valor"><input aria-label="Valor" name="value" type="number" step="any" required className="nf-app-input" style={inputStyle} /></Field><Field label="Periodo"><input aria-label="Periodo" name="period" placeholder="2026-06" required className="nf-app-input" style={inputStyle} /></Field></div><Field label="Nota"><textarea aria-label="Nota" name="note" rows={3} className="nf-app-input" style={inputStyle} /></Field></FormModal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Indicador"} width={650}>{detail && <div style={{ display: "grid", gap: 18 }}><div className="nf-grid-2"><Meta label="Meta" value={`${detail.target} ${detail.unit}`} /><Meta label="Proceso" value={detail.processName} /><Meta label="Responsable" value={detail.ownerName} /><Meta label="Cláusula" value={detail.clauseCode} /></div><Meta label="Descripción" value={detail.description} /><div><strong>Historial</strong>{detail.values.length ? <ul>{detail.values.map((value) => <li key={value.id}>{value.period}: {value.value} {detail.unit}{value.note ? ` · ${value.note}` : ""}</li>)}</ul> : <p style={{ color: "var(--nf-ink-3)", fontSize: 13 }}>Sin mediciones.</p>}</div></div>}</Modal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar indicador"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => deleteIndicator(confirmDelete.id), {
          onSuccess: () => {
            setDetail((current) => current?.id === confirmDelete.id ? null : current);
            setConfirmDelete(null);
          },
          successMessage: "Indicador eliminado.",
        });
      }}
    >
      ¿Eliminar el indicador <strong>{confirmDelete?.name}</strong> y sus mediciones?
    </ConfirmActionModal>
  </div>;
}

export function EvidenceLiveClient({ initial }: { initial: EvidencePayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [module, setModule] = useState<EvidenceModule | "">(""); const [opening, setOpening] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EvidenceRow | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const file = fd.get("file"); if (!(file instanceof File) || !file.size) { setError("Selecciona un archivo."); return; } run(() => createEvidence({ title: String(fd.get("title") ?? ""), module: String(fd.get("module") ?? "") || undefined, moduleId: String(fd.get("moduleId") ?? "") || undefined, file }), { onSuccess: () => { setCreating(false); setModule(""); }, successMessage: "Evidencia subida." }); }
  async function openEvidence(row: EvidenceRow) { setOpening(row.id); setError(""); try { const url = await getEvidenceUrl(row.id); window.open(url, "_blank", "noopener,noreferrer"); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir la evidencia."); } finally { setOpening(null); } }
  function remove(row: EvidenceRow) { setConfirmDelete(row); }
  const targets = module ? initial.targets[module] : [];
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  return <div><OperationalHeader title="Evidencias" subtitle="Archivos que respaldan lo declarado en el sistema, enlazados al registro que evidencian." canCreate={initial.access.canCreate} actionLabel="Subir evidencia" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    <EntityTable
      caption="Evidencias"
      rows={initial.evidence}
      rowKey={(row) => row.id}
      storageKey="indicator-evidence"
      searchText={(row) => `${row.title} ${row.module ?? ""} ${row.targetLabel ?? ""}`}
      searchPlaceholder="Buscar por título o módulo…"
      filters={[{ id: "module", label: "Módulo", value: (row) => row.module, format: (value) => value }]}
      emptyTitle="Todavía no hay evidencias"
      emptyDescription="Adjunta actas, informes o capturas que respalden lo declarado en el sistema."
      columns={[
        {
          id: "title", header: "Evidencia", primary: true, minWidth: 240, sortValue: (row) => row.title,
          cell: (row) => <CellTitle title={row.title} meta={`${row.module ?? "General"}${row.targetLabel ? ` · ${row.targetLabel}` : ""}`} />,
        },
        { id: "type", header: "Tipo", hideable: true, sortValue: (row) => row.mimeType ?? "", cell: (row) => row.mimeType ?? "Archivo" },
        {
          id: "size", header: "Tamaño", numeric: true, align: "end", hideable: true, sortValue: (row) => row.fileSize ?? 0,
          cell: (row) => row.fileSize ? `${Math.ceil(row.fileSize / 1024)} KB` : "—",
        },
        { id: "created", header: "Fecha", numeric: true, sortValue: (row) => row.createdAt, cell: (row) => formatDate(row.createdAt) },
      ]}
      actions={(row) => (
        <>
          <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={opening === row.id} onClick={() => openEvidence(row)}>
            {opening === row.id ? "Abriendo…" : "Abrir"}
          </button>
          {initial.access.canDelete && (
            <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger" disabled={isPending} onClick={() => remove(row)}>Eliminar</button>
          )}
        </>
      )}
    />
    <FormModal open={creating} title="Subir evidencia" pending={isPending} error={error} onClose={() => { setCreating(false); setModule(""); setError(""); }} onSubmit={submit} submitLabel="Subir"><Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} /></Field><Field label="Módulo relacionado"><Picker aria-label="Evidencia general" name="module" className="nf-app-input" style={inputStyle} value={module} onChange={(event) => setModule(event.target.value as EvidenceModule | "")}><option value="">Evidencia general</option><option value="process">Proceso</option><option value="risk">Riesgo</option><option value="audit">Auditoría</option><option value="nc">No conformidad</option><option value="indicator">Indicador</option><option value="document">Documento</option><option value="change">Cambio</option><option value="supplier">Proveedor</option><option value="integration">Integración</option></Picker></Field>{module && <Field label="Registro relacionado"><Picker aria-label="Seleccionar" name="moduleId" required className="nf-app-input" style={inputStyle}><option value="">Seleccionar…</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</Picker></Field>}<FileImportArea name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,image/*" maxSizeMB={50} label="Archivo" hint="Se guarda en el repositorio privado de la organización." compact /></FormModal>
    <ConfirmActionModal
      open={!!confirmDelete}
      title="Eliminar evidencia"
      confirmLabel="Eliminar"
      danger
      pending={isPending}
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (!confirmDelete) return;
        run(() => removeEvidence(confirmDelete.id), {
          onSuccess: () => setConfirmDelete(null),
          successMessage: "Evidencia eliminada.",
        });
      }}
    >
      ¿Eliminar la evidencia <strong>{confirmDelete?.title}</strong> y su archivo?
    </ConfirmActionModal>
  </div>;
}
