"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuditProgramStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import ProgressBar from "@/components/ui/ProgressBar";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createAuditProgram,
  updateAuditProgram,
  deleteAuditProgram,
  transitionAuditProgram,
  addProgramAudit,
  exportAuditProgram,
} from "@/lib/actions/audit-program";
import type { AuditProgramPayload } from "@/lib/server-queries";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
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

type ProgramRow = AuditProgramPayload["programs"][number];

export const PROGRAM_STATUS_LABELS: Record<AuditProgramStatus, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  IN_EXECUTION: "En ejecución",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const AUDIT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planificada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function programBadge(s: AuditProgramStatus) {
  return s === "COMPLETED" ? "ON_TRACK" : s === "CANCELLED" ? "OFF_TRACK" : s === "IN_EXECUTION" ? "IN_PROGRESS" : s === "APPROVED" ? "ON_TRACK" : "AT_RISK";
}

// Status transitions offered in the UI (mirrors the server-side guard).
const NEXT_ACTIONS: Record<AuditProgramStatus, { to: AuditProgramStatus; label: string; primary?: boolean }[]> = {
  DRAFT: [{ to: "APPROVED", label: "Aprobar programa", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  APPROVED: [{ to: "IN_EXECUTION", label: "Iniciar ejecución", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  IN_EXECUTION: [{ to: "COMPLETED", label: "Completar programa", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  COMPLETED: [],
  CANCELLED: [{ to: "DRAFT", label: "Reabrir como borrador" }],
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es") : "—");

export function AuditProgramLive({ initial }: { initial: AuditProgramPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const canManage = initial.access.canManage;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProgramRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProgramRow | null>(null);
  const [planningFor, setPlanningFor] = useState<ProgramRow | null>(null);
  const [auditView, setAuditView] = useState<"list" | "calendar">("list");
  const [exportBusy, setExportBusy] = useState<"PDF" | "EXCEL" | null>(null);
  const detail = detailId ? initial.programs.find(p => p.id === detailId) ?? null : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      year: Number(fd.get("year") ?? 0),
      title: String(fd.get("title") ?? ""),
      objectives: String(fd.get("objectives") ?? "") || undefined,
      scope: String(fd.get("scope") ?? "") || undefined,
      standards: fd.getAll("standards").map(String),
      criteria: String(fd.get("criteria") ?? "") || undefined,
      responsibleId: String(fd.get("responsibleId") ?? "") || undefined,
    };
    run(() => (editing ? updateAuditProgram(editing.id, input) : createAuditProgram(input)), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: editing ? "Programa actualizado." : "Programa creado.",
    });
  }

  function remove(row: ProgramRow) {
    setConfirmDelete(row);
  }

  function changeStatus(id: string, to: AuditProgramStatus, label: string) {
    run(() => transitionAuditProgram(id, to), { successMessage: `${label} ✓` });
  }

  async function exportProgram(format: "PDF" | "EXCEL") {
    if (!detail) return;
    setExportBusy(format);
    try {
      const result = await exportAuditProgram(detail.id, format);
      await downloadQueuedReport(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo exportar el programa."); }
    finally { setExportBusy(null); }
  }

  return (
    <div>
      <OperationalHeader
        title="Programa anual de auditorías"
        subtitle={`${initial.programs.length} programas · ISO 9001 cláusula 9.2.2`}
        canCreate={canManage}
        actionLabel="Nuevo programa"
        onCreate={() => { setError(""); setCreating(true); }}
      />
      <OperationalMessages error={error} success={success} />

      {initial.programs.length === 0 ? (
        <EmptyOperational>Aún no hay programas anuales. Crea uno para planificar y agrupar las auditorías del año.</EmptyOperational>
      ) : (
        <OperationalGrid>
          {initial.programs.map(row => (
            <OperationalCard key={row.id} onClick={() => setDetailId(row.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", color: "var(--nf-primary-active)", fontSize: 12, fontWeight: 600 }}>{row.year}</div>
                  <h3 style={{ margin: "6px 0 5px", fontSize: 18, color: "var(--nf-ink)" }}>{row.title}</h3>
                  <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{row.completedCount}/{row.auditCount} auditorías completadas</div>
                </div>
                <Badge status={programBadge(row.status)} label={PROGRAM_STATUS_LABELS[row.status]} />
              </div>
              <div style={{ marginTop: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 4 }}>
                  <span>Avance del programa</span><span style={{ fontWeight: 700 }}>{row.avgProgress}%</span>
                </div>
                <ProgressBar value={row.avgProgress} color={row.avgProgress >= 80 ? "var(--nf-success)" : row.avgProgress >= 40 ? "var(--nf-warning)" : "var(--nf-primary)"} height={7} railColor="var(--nf-surface-sunken)" />
              </div>
              {canManage && (
                <CardActions canUpdate canDelete pending={isPending} onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
              )}
            </OperationalCard>
          ))}
        </OperationalGrid>
      )}

      {/* Create / edit */}
      <FormModal open={creating || !!editing} title={editing ? "Editar programa" : "Nuevo programa anual"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Año"><input aria-label="Año" name="year" type="number" min="2000" max="2100" className="nf-app-input" style={inputStyle} defaultValue={editing?.year ?? new Date().getFullYear()} required /></Field>
          <Field label="Título"><input aria-label="Programa anual de auditorías" name="title" className="nf-app-input" style={inputStyle} defaultValue={editing?.title ?? ""} required placeholder="Programa anual de auditorías" /></Field>
        </div>
        <Field label="Objetivos"><textarea aria-label="Verificar la conformidad y eficacia del SGC" name="objectives" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.objectives ?? ""} placeholder="Verificar la conformidad y eficacia del SGC…" /></Field>
        <Field label="Alcance"><textarea aria-label="Todos los procesos y sedes certificadas" name="scope" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.scope ?? ""} placeholder="Todos los procesos y sedes certificadas…" /></Field>
        <Field label="Normas incluidas"><select aria-label="Normas" name="standards" multiple size={Math.min(Math.max(2, initial.standards.length), 6)} className="nf-app-input" style={inputStyle} defaultValue={editing?.standards ?? []}>{initial.standards.map((standard) => <option key={standard.code} value={standard.code}>{standard.name} {standard.version}</option>)}</select></Field>
        <Field label="Criterios de auditoría"><textarea aria-label="Criterios" name="criteria" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.criteria ?? ""} placeholder="Requisitos de la norma, políticas y procedimientos aplicables…" /></Field>
        <Field label="Responsable del programa"><select aria-label="Responsable" name="responsibleId" className="nf-app-input" style={inputStyle} defaultValue={editing?.responsibleId ?? ""}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
      </FormModal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.year} · ${detail.title}` : "Programa"} width={720}>
        {detail && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Badge status={programBadge(detail.status)} label={PROGRAM_STATUS_LABELS[detail.status]} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {initial.access.canExport && <><button type="button" className="nf-app-btn-ghost" disabled={!!exportBusy} onClick={() => void exportProgram("EXCEL")}>Excel</button><button type="button" className="nf-app-btn-ghost" disabled={!!exportBusy} onClick={() => void exportProgram("PDF")}>PDF</button></>}
                {canManage && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {NEXT_ACTIONS[detail.status].map(action => (
                    <button key={action.to} type="button" disabled={isPending} className={action.primary ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => changeStatus(detail.id, action.to, action.label)}>
                      {action.label}
                    </button>
                  ))}
                </div>
                )}
              </div>
            </div>

            <div className="nf-grid-2" style={{ gap: 18 }}>
              <Meta label="Objetivos" value={detail.objectives ?? "—"} />
              <Meta label="Alcance" value={detail.scope ?? "—"} />
              <Meta label="Normas incluidas" value={detail.standards?.join(", ") || "—"} />
              <Meta label="Criterios" value={detail.criteria ?? "—"} />
              <Meta label="Responsable" value={detail.responsibleName ?? "—"} />
              <Meta label="Aprobado por" value={detail.approvedByName ?? "—"} />
              <Meta label="Fecha de aprobación" value={fmtDate(detail.approvedAt)} />
            </div>

            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>Auditorías del programa · {detail.auditCount}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button type="button" className={auditView === "list" ? "nf-app-btn-primary nf-app-btn-sm" : "nf-app-btn-ghost nf-app-btn-sm"} onClick={() => setAuditView("list")}>Lista</button><button type="button" className={auditView === "calendar" ? "nf-app-btn-primary nf-app-btn-sm" : "nf-app-btn-ghost nf-app-btn-sm"} onClick={() => setAuditView("calendar")}>Calendario</button>{canManage && <button type="button" className="nf-app-btn-ghost" onClick={() => setPlanningFor(detail)}>+ Planificar auditoría</button>}<Link href="/app/audits" style={{ fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700, textDecoration: "none" }}>Abrir módulo →</Link></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: auditView === "calendar" ? "repeat(auto-fit,minmax(210px,1fr))" : "1fr", gap: 8, marginTop: 10 }}>
                {detail.audits.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin auditorías enlazadas. Asígnalas desde el módulo de Auditorías seleccionando este programa.</p>}
                {detail.audits.map(a => (
                  <div key={a.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</span>
                      <Badge status={a.status === "COMPLETED" ? "ON_TRACK" : a.status === "CANCELLED" ? "OFF_TRACK" : a.status === "IN_PROGRESS" ? "IN_PROGRESS" : "AT_RISK"} label={AUDIT_STATUS_LABELS[a.status] ?? a.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>{a.type} · Planeamiento: {fmtDate(a.plannedDate)} · Ejecución: {fmtDate(a.scheduledDate)} · {a.progress}%</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Modal>
      <FormModal open={!!planningFor} title="Agregar auditoría planificada" pending={isPending} error={error} onClose={() => setPlanningFor(null)} onSubmit={(event) => { event.preventDefault(); if (!planningFor) return; const fd = new FormData(event.currentTarget); run(() => addProgramAudit(planningFor.id, { title: String(fd.get("title") ?? ""), processId: String(fd.get("processId") ?? ""), standardCode: String(fd.get("standardCode") ?? ""), date: String(fd.get("date") ?? ""), auditorId: String(fd.get("auditorId") ?? "") }), { onSuccess: () => setPlanningFor(null), successMessage: "Auditoría planificada." }); }}>
        <Field label="Título"><input aria-label="Auditoría del proceso de compras" name="title" required className="nf-app-input" style={inputStyle} placeholder="Auditoría del proceso de compras" /></Field>
        <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Proceso"><select aria-label="Seleccionar" name="processId" required className="nf-app-input" style={inputStyle}><option value="">Seleccionar</option>{initial.processes.map((process) => <option key={process.id} value={process.id}>{process.code ? `${process.code} · ` : ""}{process.name}</option>)}</select></Field><Field label="Norma"><select aria-label="Seleccionar" name="standardCode" required className="nf-app-input" style={inputStyle}><option value="">Seleccionar</option>{initial.standards.map((standard) => <option key={standard.code} value={standard.code}>{standard.name}</option>)}</select></Field></div>
        <div className="nf-grid-2" style={{ gap: 12 }}><Field label="Fecha"><input aria-label="Fecha" name="date" type="date" required className="nf-app-input" style={inputStyle} /></Field><Field label="Auditor"><select aria-label="Seleccionar" name="auditorId" required className="nf-app-input" style={inputStyle}><option value="">Seleccionar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div>
      </FormModal>
      <ConfirmActionModal
        open={!!confirmDelete}
        title="Eliminar programa"
        confirmLabel="Eliminar"
        danger
        pending={isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          run(() => deleteAuditProgram(confirmDelete.id), {
            onSuccess: () => {
              setDetailId((current) => current === confirmDelete.id ? null : current);
              setConfirmDelete(null);
            },
            successMessage: "Programa eliminado.",
          });
        }}
      >
        ¿Eliminar el programa <strong>{confirmDelete ? `${confirmDelete.year} · ${confirmDelete.title}` : ""}</strong>? Las auditorías enlazadas se conservarán sin programa.
      </ConfirmActionModal>
    </div>
  );
}
