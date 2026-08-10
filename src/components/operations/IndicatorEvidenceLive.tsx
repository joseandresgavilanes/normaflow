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
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta, OperationalCard, OperationalGrid,
  OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type IndicatorRow = IndicatorsPayload["indicators"][number];
type EvidenceRow = EvidencePayload["evidence"][number];
type EvidenceModule = keyof EvidencePayload["targets"];

export function IndicatorsLiveClient({ initial }: { initial: IndicatorsPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<IndicatorRow | null>(null); const [detail, setDetail] = useState<IndicatorRow | null>(null); const [valueIndicator, setValueIndicator] = useState<IndicatorRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IndicatorRow | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const input: IndicatorInput = { name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), unit: String(fd.get("unit") ?? ""), target: Number(fd.get("target")), frequency: String(fd.get("frequency") ?? "monthly"), ownerId: String(fd.get("ownerId") ?? "") || undefined, status: fd.get("status") as IndicatorStatus, clauseCode: String(fd.get("clauseCode") ?? ""), processId: String(fd.get("processId") ?? "") || undefined }; run(() => editing ? updateIndicator(editing.id, input) : createIndicator(input), { onSuccess: () => { setCreating(false); setEditing(null); }, successMessage: editing ? "Indicador actualizado." : "Indicador creado en Supabase." }); }
  function submitValue(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!valueIndicator) return; const fd = new FormData(event.currentTarget); run(() => addIndicatorValue(valueIndicator.id, { value: Number(fd.get("value")), period: String(fd.get("period") ?? ""), note: String(fd.get("note") ?? "") }), { onSuccess: () => setValueIndicator(null), successMessage: "Medición registrada." }); }
  function remove(row: IndicatorRow) { setConfirmDelete(row); }
  const row = editing;
  return <div><OperationalHeader title="Indicadores" subtitle={`${initial.indicators.length} indicadores persistidos`} canCreate={initial.access.canCreate} actionLabel="Nuevo indicador" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    {initial.indicators.length === 0 ? <EmptyOperational>No hay indicadores registrados.</EmptyOperational> : <OperationalGrid>{initial.indicators.map((indicator) => { const latest = indicator.values[0]; return <OperationalCard key={indicator.id} onClick={() => setDetail(indicator)}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)" }}>{indicator.frequency} · {indicator.processCode ?? "Sin proceso"}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{indicator.name}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{indicator.ownerName ?? "Sin responsable"}</div></div><Badge status={indicator.status} /></div><div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}><strong style={{ fontSize: 28, color: "var(--nf-primary-active)" }}>{latest?.value ?? "—"}</strong><span style={{ color: "var(--nf-ink-3)" }}>{indicator.unit} / meta {indicator.target}</span></div><CardActions canUpdate={initial.access.canUpdate} canDelete={initial.access.canDelete} pending={isPending} onEdit={() => { setError(""); setEditing(indicator); }} onDelete={() => remove(indicator)} />{initial.access.canUpdate && <button type="button" className="nf-app-btn-primary" style={{ marginTop: 9, width: "100%" }} onClick={(event) => { event.stopPropagation(); setValueIndicator(indicator); }}>Registrar medición</button>}</OperationalCard>; })}</OperationalGrid>}
    <FormModal open={creating || !!editing} title={editing ? "Editar indicador" : "Nuevo indicador"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}><Field label="Nombre"><input aria-label="Nombre" name="name" required className="nf-app-input" style={inputStyle} defaultValue={row?.name ?? ""} /></Field><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Unidad"><input aria-label="Unidad" name="unit" required className="nf-app-input" style={inputStyle} defaultValue={row?.unit ?? "%"} /></Field><Field label="Meta"><input aria-label="Meta" name="target" type="number" step="any" required className="nf-app-input" style={inputStyle} defaultValue={row?.target ?? 100} /></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Frecuencia"><select aria-label="Frecuencia" name="frequency" className="nf-app-input" style={inputStyle} defaultValue={row?.frequency ?? "monthly"}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></Field><Field label="Estado"><select aria-label="Estado" name="status" className="nf-app-input" style={inputStyle} defaultValue={row?.status ?? IndicatorStatus.ON_TRACK}>{Object.values(IndicatorStatus).map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="nf-grid-2" style={{ gap: 12 }}><Field label="Proceso"><select aria-label="Proceso" name="processId" className="nf-app-input" style={inputStyle} defaultValue={row?.processId ?? ""}><option value="">Sin proceso</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code ?? "PROC"} · {process.name}</option>)}</select></Field><Field label="Responsable"><select aria-label="Responsable" name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={row?.ownerId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div><Field label="Cláusula"><input aria-label="Código de cláusula" name="clauseCode" className="nf-app-input" style={inputStyle} defaultValue={row?.clauseCode ?? ""} /></Field><Field label="Descripción"><textarea aria-label="Descripción" name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={row?.description ?? ""} /></Field></FormModal>
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
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); const file = fd.get("file"); if (!(file instanceof File) || !file.size) { setError("Selecciona un archivo."); return; } run(() => createEvidence({ title: String(fd.get("title") ?? ""), module: String(fd.get("module") ?? "") || undefined, moduleId: String(fd.get("moduleId") ?? "") || undefined, file }), { onSuccess: () => { setCreating(false); setModule(""); }, successMessage: "Evidencia subida a Supabase Storage." }); }
  async function openEvidence(row: EvidenceRow) { setOpening(row.id); setError(""); try { const url = await getEvidenceUrl(row.id); window.open(url, "_blank", "noopener,noreferrer"); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir la evidencia."); } finally { setOpening(null); } }
  function remove(row: EvidenceRow) { setConfirmDelete(row); }
  const targets = module ? initial.targets[module] : [];
  useCreateFromQuery(initial.access.canCreate, () => {
    setError("");
    setCreating(true);
  });
  return <div><OperationalHeader title="Evidencias" subtitle={`${initial.evidence.length} evidencias en base de datos y Storage`} canCreate={initial.access.canCreate} actionLabel="Subir evidencia" onCreate={() => { setError(""); setCreating(true); }} /><OperationalMessages error={error} success={success} />
    {initial.evidence.length === 0 ? <EmptyOperational>No hay evidencias cargadas.</EmptyOperational> : <OperationalGrid>{initial.evidence.map((item) => <OperationalCard key={item.id}><div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none" }}>{item.module ?? "General"}{item.targetLabel ? ` · ${item.targetLabel}` : ""}</div><h3 style={{ margin: "7px 0", fontSize: 17 }}>{item.title}</h3><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{item.mimeType ?? "Archivo"} · {item.fileSize ? `${Math.ceil(item.fileSize / 1024)} KB` : "Tamaño desconocido"} · {new Date(item.createdAt).toLocaleDateString("es")}</div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><button type="button" className="nf-app-btn-primary" disabled={opening === item.id} onClick={() => openEvidence(item)}>{opening === item.id ? "Abriendo…" : "Abrir"}</button>{initial.access.canDelete && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => remove(item)} style={{ color: "var(--nf-danger-text)", borderColor: "var(--nf-border)" }}>Eliminar</button>}</div></OperationalCard>)}</OperationalGrid>}
    <FormModal open={creating} title="Subir evidencia" pending={isPending} error={error} onClose={() => { setCreating(false); setModule(""); setError(""); }} onSubmit={submit} submitLabel="Subir"><Field label="Título"><input aria-label="Título" name="title" required className="nf-app-input" style={inputStyle} /></Field><Field label="Módulo relacionado"><select aria-label="Evidencia general" name="module" className="nf-app-input" style={inputStyle} value={module} onChange={(event) => setModule(event.target.value as EvidenceModule | "")}><option value="">Evidencia general</option><option value="process">Proceso</option><option value="risk">Riesgo</option><option value="audit">Auditoría</option><option value="nc">No conformidad</option><option value="indicator">Indicador</option><option value="document">Documento</option><option value="change">Cambio</option><option value="supplier">Proveedor</option><option value="integration">Integración</option></select></Field>{module && <Field label="Registro relacionado"><select aria-label="Seleccionar" name="moduleId" required className="nf-app-input" style={inputStyle}><option value="">Seleccionar…</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></Field>}<Field label="Archivo"><input aria-label="Archivo" name="file" type="file" required className="nf-app-input" style={inputStyle} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,image/*" /></Field></FormModal>
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
