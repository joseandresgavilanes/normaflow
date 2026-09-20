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
  addProgramAudits,
  exportAuditProgram,
  linkProgramEvidence,
  unlinkProgramEvidence,
  type PlannedProgramAuditInput,
} from "@/lib/actions/audit-program";
import type { AuditProgramPayload } from "@/lib/server-queries";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { formatDate, formatTime } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
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
  ProgressCell,
  RowActions,
  inputStyle,
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

const fmtDate = (iso: string | null) => (iso ? formatDate(iso) : "—");

/**
 * El estado real del ciclo, que es lo que un programa anual tiene que enseñar.
 *
 * Antes solo se veía el título de cada auditoría y un porcentaje: no había
 * forma de saber cuáles van tarde, cuáles siguen sin empezar ni qué salió de
 * las que ya se hicieron. Se calcula en la pantalla porque sale entero de los
 * datos que ya viajan con el programa.
 */
type ProgramAudit = ProgramRow["audits"][number];

function seguimiento(audits: readonly ProgramAudit[], hoy = new Date()) {
  const cerrada = (a: ProgramAudit) => a.status === "COMPLETED" || a.status === "CANCELLED";
  const atrasada = (a: ProgramAudit) => !cerrada(a) && !!a.plannedDate && new Date(a.plannedDate) < hoy;
  return {
    total: audits.length,
    planificadas: audits.filter((a) => a.status === "PLANNED").length,
    enCurso: audits.filter((a) => a.status === "IN_PROGRESS").length,
    completadas: audits.filter((a) => a.status === "COMPLETED").length,
    atrasadas: audits.filter(atrasada).length,
    hallazgos: audits.reduce((suma, a) => suma + a.findingCount, 0),
    noConformidades: audits.reduce((suma, a) => suma + a.nonconformityCount, 0),
    esAtrasada: atrasada,
  };
}

/** Una línea del plan: un proceso, su día y su franja horaria. */
type PlanRow = { id: number; processId: string; title: string; date: string; startTime: string; endTime: string; auditorId: string };

function emptyPlanRow(id: number, defaults?: Partial<PlanRow>): PlanRow {
  return { id, processId: "", title: "", date: "", startTime: "", endTime: "", auditorId: "", ...defaults };
}

/**
 * Convierte «8 de octubre, 09:00» en el instante que corresponde.
 *
 * La conversión se hace aquí y no en el servidor porque la zona horaria de
 * quien planifica solo se conoce en su navegador: montar la hora sobre UTC en
 * el servidor desplazaría el plan entero tantas horas como diferencia haya.
 */
function toInstant(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const local = new Date(`${date}T${time}:00`);
  return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
}

/** Franja horaria de una auditoría ya planificada, si se guardó con horas. */
function slotLabel(audit: { startDate: string | null; endDate: string | null }): string {
  if (!audit.startDate) return "";
  return audit.endDate ? `${formatTime(audit.startDate)}–${formatTime(audit.endDate)}` : formatTime(audit.startDate);
}

export function AuditProgramLive({ initial }: { initial: AuditProgramPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const canManage = initial.access.canManage;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProgramRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProgramRow | null>(null);
  const [planningFor, setPlanningFor] = useState<ProgramRow | null>(null);
  const [planRows, setPlanRows] = useState<PlanRow[]>([emptyPlanRow(1)]);
  const [planStandard, setPlanStandard] = useState("");
  const [auditView, setAuditView] = useState<"list" | "calendar">("list");
  const [exportBusy, setExportBusy] = useState<"PDF" | "EXCEL" | null>(null);
  const detail = detailId ? initial.programs.find(p => p.id === detailId) ?? null : null;

  // Las normas del plan salen del propio programa; si no declaró ninguna, se
  // ofrecen todas las habilitadas en la organización.
  const planStandards = planningFor?.standards?.length
    ? initial.standards.filter((standard) => planningFor.standards.includes(standard.code))
    : initial.standards;

  function openPlanner(program: ProgramRow) {
    setError("");
    setPlanningFor(program);
    setPlanStandard(program.standards?.[0] ?? initial.standards[0]?.code ?? "");
    setPlanRows([emptyPlanRow(1)]);
  }

  function closePlanner() {
    setPlanningFor(null);
    setPlanRows([emptyPlanRow(1)]);
  }

  function updatePlanRow(id: number, patch: Partial<PlanRow>) {
    setPlanRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function addPlanRow(defaults?: Partial<PlanRow>) {
    setPlanRows((rows) => [...rows, emptyPlanRow(Math.max(0, ...rows.map((row) => row.id)) + 1, defaults)]);
  }

  /**
   * Carga en el plan todos los procesos que aún no tienen línea.
   *
   * Es el atajo que evita repetir doce veces «agregar línea → elegir proceso»:
   * el plan anual suele recorrer el mapa de procesos entero, y lo que cambia de
   * una línea a otra es la fecha y la hora, no el hecho de estar incluido.
   */
  function addEveryProcess() {
    setPlanRows((rows) => {
      // Las líneas a medio rellenar se conservan; la línea en blanco con la que
      // se abre el formulario, no: sería una fila vacía en medio del plan.
      const kept = rows.filter((row) => row.processId);
      const taken = new Set(kept.map((row) => row.processId));
      const last = rows.at(-1);
      let nextId = Math.max(0, ...rows.map((row) => row.id));
      const added = initial.processes.filter((process) => !taken.has(process.id)).map((process) => emptyPlanRow(++nextId, {
        processId: process.id,
        title: `Auditoría de ${process.code ? `${process.code} · ` : ""}${process.name}`,
        // Fecha, franja y auditor se heredan de la última línea escrita para
        // no repetirlos: se corrigen los que difieran.
        date: last?.date ?? "",
        startTime: last?.startTime ?? "",
        endTime: last?.endTime ?? "",
        auditorId: last?.auditorId ?? "",
      }));
      return [...kept, ...added].length ? [...kept, ...added] : rows;
    });
  }

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planningFor) return;
    // Las horas se revisan antes de salir: proceso, fecha y auditor los exige el
    // propio formulario, pero una franja al revés solo se ve comparando los dos
    // campos, y el aviso nombra la línea para no tener que buscarla.
    const badSlot = planRows.findIndex((row) => (row.endTime && !row.startTime) || (row.startTime && row.endTime && row.endTime <= row.startTime));
    if (badSlot >= 0) {
      const row = planRows[badSlot];
      setError(row.endTime && !row.startTime
        ? `Línea ${badSlot + 1}: indica también la hora de inicio.`
        : `Línea ${badSlot + 1}: la hora de fin debe ser posterior a la de inicio.`);
      return;
    }
    const inputs: PlannedProgramAuditInput[] = planRows.map((row) => ({
      title: row.title.trim() || undefined,
      processId: row.processId,
      standardCode: planStandard,
      date: row.date,
      startAt: toInstant(row.date, row.startTime),
      endAt: toInstant(row.date, row.endTime),
      auditorId: row.auditorId,
    }));
    run(() => addProgramAudits(planningFor.id, inputs), {
      onSuccess: closePlanner,
      successMessage: `${inputs.length} auditoría${inputs.length === 1 ? "" : "s"} planificada${inputs.length === 1 ? "" : "s"}.`,
    });
  }

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
        subtitle="Programa anual de auditorías: alcance, calendario y avance del ciclo (cláusula 9.2.2)."
        canCreate={canManage}
        actionLabel="Nuevo programa"
        onCreate={() => { setError(""); setCreating(true); }}
      />
      <OperationalMessages error={error} success={success} />

      <EntityTable
          caption="Programas de auditoría"
          rows={initial.programs}
          rowKey={(row) => row.id}
          rowAction={(row) => setDetailId(row.id)}
          storageKey="audit-programs"
          searchText={(row) => `${row.title} ${row.year}`}
          searchPlaceholder="Buscar por título o año…"
          filters={[
            { id: "status", label: "Estado", value: (row) => row.status, format: (value) => PROGRAM_STATUS_LABELS[value as keyof typeof PROGRAM_STATUS_LABELS] ?? value },
            { id: "year", label: "Año", value: (row) => String(row.year), format: (value) => value },
          ]}
          emptyTitle="Todavía no hay programas"
          emptyDescription="El programa anual agrupa las auditorías del año y su avance."
          columns={[
            {
              id: "title", header: "Programa", primary: true, minWidth: 240, sortValue: (row) => row.title,
              cell: (row) => <CellTitle title={row.title} meta={String(row.year)} />,
            },
            { id: "status", header: "Estado", sortValue: (row) => row.status, cell: (row) => <Badge status={programBadge(row.status)} label={PROGRAM_STATUS_LABELS[row.status]} /> },
            {
              id: "audits", header: "Auditorías", numeric: true, align: "end", sortValue: (row) => row.auditCount,
              cell: (row) => `${row.completedCount}/${row.auditCount}`,
            },
            { id: "progress", header: "Avance", numeric: true, sortValue: (row) => row.avgProgress, cell: (row) => <ProgressCell value={row.avgProgress} /> },
          ]}
          actions={canManage ? (row) => {
            /* La transición principal vive también aquí. Estaba solo dentro de
               la ficha, que se abre pulsando la fila, y desde la lista parecía
               que un programa en borrador no se podía aprobar. */
            const next = NEXT_ACTIONS[row.status].find((action) => action.primary);
            const approvalBlocked = next?.to === "APPROVED" && row.approvalGaps.length > 0;
            return (
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="nf-app-btn-ghost nf-app-btn-sm"
                  disabled={isPending || row.status === "COMPLETED" || row.status === "CANCELLED"}
                  title={row.status === "COMPLETED" || row.status === "CANCELLED" ? "No se puede modificar el cronograma de un programa cerrado." : "Agregar auditorías, fechas, horarios y auditores al cronograma."}
                  onClick={() => openPlanner(row)}
                >
                  Cronograma
                </button>
                {next && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" disabled={isPending || approvalBlocked} title={approvalBlocked ? `Antes de aprobar falta: ${row.approvalGaps.join(", ")}.` : undefined} onClick={() => changeStatus(row.id, next.to, next.label)}>{next.label}</button>}
                <RowActions canUpdate canDelete pending={isPending} onEdit={() => { setError(""); setEditing(row); }} onDelete={() => remove(row)} />
              </div>
            );
          } : undefined}
        />

      {/* Create / edit */}
      <FormModal open={creating || !!editing} title={editing ? "Editar programa" : "Nuevo programa anual"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submit}>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <Field label="Año"><input aria-label="Año" name="year" type="number" min="2000" max="2100" className="nf-app-input" style={inputStyle} defaultValue={editing?.year ?? new Date().getFullYear()} required /></Field>
          <Field label="Título"><input aria-label="Programa anual de auditorías" name="title" className="nf-app-input" style={inputStyle} defaultValue={editing?.title ?? ""} required placeholder="Programa anual de auditorías" /></Field>
        </div>
        <Field label="Objetivos"><textarea aria-label="Verificar la conformidad y eficacia del SGC" name="objectives" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.objectives ?? ""} placeholder="Verificar la conformidad y eficacia del SGC…" /></Field>
        <Field label="Alcance"><textarea aria-label="Todos los procesos y sedes certificadas" name="scope" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.scope ?? ""} placeholder="Todos los procesos y sedes certificadas…" /></Field>
        <Field label="Normas incluidas"><Picker aria-label="Normas" name="standards" multiple className="nf-app-input" style={inputStyle} defaultValue={editing?.standards ?? []}>{initial.standards.map((standard) => <option key={standard.code} value={standard.code}>{standard.name} {standard.version}</option>)}</Picker></Field>
        <Field label="Criterios de auditoría"><textarea aria-label="Criterios" name="criteria" className="nf-app-input" style={inputStyle} rows={2} defaultValue={editing?.criteria ?? ""} placeholder="Requisitos de la norma, políticas y procedimientos aplicables…" /></Field>
        <Field label="Responsable del programa"><PersonPicker name="responsibleId" people={initial.members} defaultValue={editing?.responsibleId ?? ""} placeholder="Sin asignar" ariaLabel="Responsable" style={inputStyle} /></Field>
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
                    <button key={action.to} type="button" disabled={isPending || (action.to === "APPROVED" && detail.approvalGaps.length > 0)} title={action.to === "APPROVED" && detail.approvalGaps.length ? `Antes de aprobar falta: ${detail.approvalGaps.join(", ")}.` : undefined} className={action.primary ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => changeStatus(detail.id, action.to, action.label)}>
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
              {detail.status === "DRAFT" && <Meta label="Listo para aprobación" value={detail.approvalGaps.length ? `Pendiente: ${detail.approvalGaps.join(", ")}` : "Sí"} />}
            </div>

            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>Auditorías del programa · {detail.auditCount}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button type="button" className={auditView === "list" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setAuditView("list")}>Lista</button><button type="button" className={auditView === "calendar" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setAuditView("calendar")}>Calendario</button>{canManage && <button type="button" className="nf-app-btn-ghost" onClick={() => openPlanner(detail)}>Planificar auditorías</button>}<Link href="/app/audits" style={{ fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700, textDecoration: "none" }}>Abrir módulo →</Link></div>
              </div>
              {(() => { const s = seguimiento(detail.audits); return s.total > 0 ? (<div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, padding: "10px 12px", border: "1px solid var(--nf-line)", borderRadius: 9, fontSize: 12 }}><span><strong>{s.planificadas}</strong> planificadas</span><span><strong>{s.enCurso}</strong> en curso</span><span><strong>{s.completadas}</strong> completadas</span><span style={{ color: s.atrasadas ? "var(--nf-danger-text)" : undefined, fontWeight: s.atrasadas ? 700 : undefined }}><strong>{s.atrasadas}</strong> atrasadas</span><span style={{ marginLeft: "auto", color: "var(--nf-ink-3)" }}>{s.hallazgos} hallazgos · {s.noConformidades} no conformidades</span></div>) : null; })()}<div style={{ display: "grid", gridTemplateColumns: auditView === "calendar" ? "repeat(auto-fit,minmax(210px,1fr))" : "1fr", gap: 8, marginTop: 10 }}>
                {detail.audits.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin auditorías planificadas. Usa «Planificar auditorías» para agregar procesos, fechas, horarios y auditores al cronograma.</p>}
                {detail.audits.map(a => (
                  <div key={a.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</span>
                      <Badge status={a.status === "COMPLETED" ? "ON_TRACK" : a.status === "CANCELLED" ? "OFF_TRACK" : a.status === "IN_PROGRESS" ? "IN_PROGRESS" : "AT_RISK"} label={AUDIT_STATUS_LABELS[a.status] ?? a.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>{a.processName ?? "Sin proceso"} · {fmtDate(a.plannedDate)}{slotLabel(a) ? ` · ${slotLabel(a)}` : ""} · {a.auditorName ?? "Sin auditor"} · {a.progress}%{seguimiento(detail.audits).esAtrasada(a) && <strong style={{ color: "var(--nf-danger-text)" }}> · Atrasada</strong>}</div><div style={{ fontSize: 12, marginTop: 4 }}>{a.findingCount || a.nonconformityCount ? <Link href="/app/audits" style={{ color: "var(--nf-primary-active)", fontWeight: 700, textDecoration: "none" }}>{a.findingCount} hallazgo{a.findingCount === 1 ? "" : "s"} · {a.nonconformityCount} NC →</Link> : <span style={{ color: "var(--nf-ink-3)" }}>Sin hallazgos registrados</span>}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* El plan anual también se sostiene con evidencias propias —acta de
                aprobación, competencia del equipo auditor, convocatoria— y hasta
                ahora solo podían colgar de una auditoría concreta. */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>Evidencias del plan · {detail.evidenceLinks.length}</strong>
                {canManage && <Picker resetOnSelect aria-label="Vincular evidencia" className="nf-app-input" style={{ ...inputStyle, maxWidth: 260 }} defaultValue="" onChange={(event) => { const evidenceId = event.target.value; if (evidenceId) run(() => linkProgramEvidence(detail.id, evidenceId), { successMessage: "Evidencia vinculada al plan." }); }}>
                  <option value="">Vincular evidencia…</option>
                  {initial.evidenceFiles.filter((file) => !detail.evidenceLinks.some((link) => link.id === file.id)).map((file) => <option key={file.id} value={file.id}>{file.title}</option>)}
                </Picker>}
              </div>
              {detail.evidenceLinks.length ? <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {detail.evidenceLinks.map((link) => <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 9, fontSize: 13 }}>
                  <span>{link.title} · <span style={{ color: "var(--nf-ink-3)" }}>{link.evidenceType}</span></span>
                  {canManage && <button type="button" className="nf-app-btn-ghost" disabled={isPending} onClick={() => run(() => unlinkProgramEvidence(detail.id, link.id), { successMessage: "Evidencia desvinculada." })}>Quitar</button>}
                </div>)}
              </div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 10 }}>Sin evidencias del plan. Vincula aquí el acta de aprobación del programa, la competencia del equipo auditor o la convocatoria.</p>}
            </section>
          </div>
        )}
      </Modal>
      {/* Plan de auditoría: los procesos, sus días y sus franjas horarias en una
          sola pasada. Antes había que abrir este formulario una vez por proceso
          y no había dónde escribir la hora, así que el plan —que es justamente
          un horario— se llevaba fuera del producto. */}
      <Modal open={!!planningFor} onClose={closePlanner} title={planningFor ? `Plan de auditoría · ${planningFor.year}` : "Plan de auditoría"} width={1020}>
        <form onSubmit={submitPlan} className="nf-modal-form">
          <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-3)" }}>
            Añade una línea por proceso auditado con su fecha y su franja horaria. Todas se crean como auditorías internas en estado Planificada.
          </p>
          <Field label="Norma auditada">
            <Picker aria-label="Norma" className="nf-app-input" style={{ ...inputStyle, maxWidth: 320 }} value={planStandard} onChange={(event) => setPlanStandard(event.target.value)} required>
              <option value="">Seleccionar norma</option>
              {planStandards.map((standard) => <option key={standard.code} value={standard.code}>{standard.name}{standard.version ? ` ${standard.version}` : ""}</option>)}
            </Picker>
          </Field>

          <div style={{ display: "grid", gap: 10 }}>
            {planRows.map((row, index) => {
              const process = initial.processes.find((item) => item.id === row.processId);
              return (
                <div key={row.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 11, padding: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{index + 1}. {process ? `${process.code ? `${process.code} · ` : ""}${process.name}` : "Sin proceso"}</strong>
                    {planRows.length > 1 && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger" onClick={() => setPlanRows((rows) => rows.filter((item) => item.id !== row.id))}>Quitar</button>}
                  </div>
                  <div className="nf-grid-2" style={{ gap: 10 }}>
                    <Field label="Proceso">
                      <Picker
                        aria-label={`Proceso de la línea ${index + 1}`}
                        className="nf-app-input"
                        style={inputStyle}
                        required
                        value={row.processId}
                        onChange={(event) => {
                          const picked = initial.processes.find((item) => item.id === event.target.value);
                          // El título se rellena solo al elegir proceso, salvo
                          // que ya se hubiera escrito uno a mano.
                          const autoTitle = picked ? `Auditoría de ${picked.code ? `${picked.code} · ` : ""}${picked.name}` : "";
                          const previous = initial.processes.find((item) => item.id === row.processId);
                          const previousAuto = previous ? `Auditoría de ${previous.code ? `${previous.code} · ` : ""}${previous.name}` : "";
                          updatePlanRow(row.id, { processId: event.target.value, title: !row.title || row.title === previousAuto ? autoTitle : row.title });
                        }}
                      >
                        <option value="">Seleccionar proceso</option>
                        {initial.processes.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}
                      </Picker>
                    </Field>
                    <Field label="Auditor">
                      <PersonPicker people={initial.members} value={row.auditorId} onValueChange={(personId) => updatePlanRow(row.id, { auditorId: personId })} required placeholder="Seleccionar auditor" ariaLabel={`Auditor de la línea ${index + 1}`} style={inputStyle} />
                    </Field>
                  </div>
                  <div className="nf-grid-2" style={{ gap: 10 }}>
                    <Field label="Fecha">
                      <DateField aria-label={`Fecha de la línea ${index + 1}`} className="nf-app-input" style={inputStyle} required value={row.date} onChange={(event) => updatePlanRow(row.id, { date: event.target.value })} />
                    </Field>
                    <Field label="Título">
                      <input aria-label={`Título de la línea ${index + 1}`} className="nf-app-input" style={inputStyle} value={row.title} onChange={(event) => updatePlanRow(row.id, { title: event.target.value })} placeholder="Auditoría del proceso…" />
                    </Field>
                  </div>
                  <div className="nf-grid-2" style={{ gap: 10 }}>
                    <Field label="Hora de inicio">
                      <input type="time" aria-label={`Hora de inicio de la línea ${index + 1}`} className="nf-app-input" style={inputStyle} value={row.startTime} onChange={(event) => updatePlanRow(row.id, { startTime: event.target.value })} />
                    </Field>
                    <Field label="Hora de fin">
                      {/* Sin `min`: el navegador bloquearía el envío sin decir
                          por qué, y el aviso de `submitPlan` nombra la línea. */}
                      <input type="time" aria-label={`Hora de fin de la línea ${index + 1}`} className="nf-app-input" style={inputStyle} value={row.endTime} onChange={(event) => updatePlanRow(row.id, { endTime: event.target.value })} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="nf-app-btn-ghost" onClick={() => addPlanRow({ date: planRows.at(-1)?.date ?? "", auditorId: planRows.at(-1)?.auditorId ?? "" })}>Agregar proceso</button>
              {initial.processes.length > 1 && <button type="button" className="nf-app-btn-ghost" onClick={addEveryProcess}>Añadir todos los procesos</button>}
            </div>
            <div className="nf-modal-actions" style={{ marginTop: 0 }}>
              <button type="button" className="nf-app-btn-ghost" onClick={closePlanner} disabled={isPending}>Cancelar</button>
              <button type="submit" className="nf-app-btn-primary" disabled={isPending}>{isPending ? "Planificando…" : `Planificar ${planRows.length} auditoría${planRows.length === 1 ? "" : "s"}`}</button>
            </div>
          </div>
          {error && <div className="nf-modal-error">{error}</div>}
        </form>
      </Modal>
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
