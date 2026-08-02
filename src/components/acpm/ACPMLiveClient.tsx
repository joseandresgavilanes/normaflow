"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Paperclip, Plus, Search, ShieldCheck, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionTitle from "@/components/ui/SectionTitle";
import { NF_INPUT_CLASS, ModalField, modalInputStyle } from "@/components/ui/ModalForm";
import { useServerAction } from "@/hooks/useServerAction";
import { formatDate } from "@/lib/utils";
import { advanceCAPA, addCAPAComment, approveCAPARootCause, createCAPA, exportCAPAIndex, getCAPAEvidenceUrl, updateCAPA, uploadCAPAEvidence, verifyCAPA, type CreateCAPAInput } from "@/lib/actions/capa";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import type { CAPAPayload } from "@/lib/server-queries";

type Row = CAPAPayload["capas"][number];
type Stage = "REGISTERED" | "ROOT_CAUSE" | "ACTION_PLAN" | "IMPLEMENTATION" | "VERIFICATION" | "CLOSED";
type Origin = "AUDIT" | "COMPLAINT" | "PROCESS" | "SUPPLIER" | "INDICATOR" | "RISK" | "OTHER";
type Severity = "CRITICAL" | "MAJOR" | "MINOR";
type EvidenceKind = "NONCONFORMITY" | "IMPLEMENTATION" | "EFFECTIVENESS";

const STAGES: { value: Stage; label: string; detail: string }[] = [
  { value: "REGISTERED", label: "No conformidad", detail: "Registro" },
  { value: "ROOT_CAUSE", label: "Causa raíz", detail: "Análisis" },
  { value: "ACTION_PLAN", label: "Plan de acción", detail: "Aprobación" },
  { value: "IMPLEMENTATION", label: "Implementación", detail: "Ejecución" },
  { value: "VERIFICATION", label: "Eficacia", detail: "Verificación" },
  { value: "CLOSED", label: "Cierre", detail: "Lecciones" },
];
const ORIGINS: { value: Origin; label: string }[] = [{ value: "AUDIT", label: "Auditoría" }, { value: "COMPLAINT", label: "Queja" }, { value: "PROCESS", label: "Proceso" }, { value: "SUPPLIER", label: "Proveedor" }, { value: "INDICATOR", label: "Indicador" }, { value: "RISK", label: "Riesgo" }, { value: "OTHER", label: "Otro" }];
const SEVERITIES: { value: Severity; label: string }[] = [{ value: "CRITICAL", label: "Crítica" }, { value: "MAJOR", label: "Mayor" }, { value: "MINOR", label: "Menor" }];
const STAGE_LABEL = new Map(STAGES.map((stage) => [stage.value, stage.label]));
const ORIGIN_LABEL = new Map(ORIGINS.map((origin) => [origin.value, origin.label]));

export function ACPMLiveClient({ initial }: { initial: CAPAPayload }) {
  const { run, isPending, error, success, setError } = useServerAction();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "ALL">("ALL");
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const selected = useMemo(() => initial.capas.find((row) => row.id === selectedId) ?? null, [initial.capas, selectedId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.capas.filter((row) => (stage === "ALL" || row.stage === stage) && (severity === "ALL" || row.severity === severity) && (!q || [row.code, row.title, row.description, row.process?.name, row.owner?.name, row.standardCode, row.clause?.code].filter(Boolean).some((value) => String(value).toLowerCase().includes(q))));
  }, [initial.capas, query, stage, severity]);
  const open = initial.capas.filter((row) => row.stage !== "CLOSED");
  const overdue = open.filter((row) => row.dueDate && new Date(row.dueDate) < new Date()).length;

  async function exportIndex(format: "PDF" | "EXCEL") {
    setExportBusy(true); setError("");
    try { const result = await exportCAPAIndex({ format }); await downloadQueuedReport(result.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo exportar el índice."); } finally { setExportBusy(false); }
  }

  const columns = useMemo<DataTableColumn<Row>[]>(() => [
    { id: "code", header: "Código / no conformidad", primary: true, minWidth: 210, hideable: false, sortValue: (r) => r.code,
      cell: (r) => <><strong>{r.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-2)", marginTop: 3 }}>{r.title}</div></> },
    { id: "origin", header: "Origen", minWidth: 130, sortValue: (r) => r.origin,
      cell: (r) => <>{ORIGIN_LABEL.get(r.origin) ?? r.origin}<div style={{ fontSize: 11, color: r.severity === "CRITICAL" ? "#B91C1C" : "var(--nf-ink-3)", marginTop: 3 }}>{r.severity === "CRITICAL" ? "Crítica" : r.severity === "MAJOR" ? "Mayor" : "Menor"}</div></> },
    { id: "standard", header: "Norma / cláusula", minWidth: 170, sortValue: (r) => r.standardCode ?? r.clause?.standard.code ?? "",
      cell: (r) => <>{r.standardCode ?? r.clause?.standard.code ?? "—"}<div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{r.clause ? `${r.clause.code} · ${r.clause.title}` : "Sin cláusula"}</div></> },
    { id: "owner", header: "Responsable", minWidth: 140, sortValue: (r) => r.owner?.name ?? "", cell: (r) => r.owner?.name ?? "Sin asignar" },
    { id: "stage", header: "Etapa", minWidth: 120, sortValue: (r) => r.stage, cell: (r) => <StageBadge stage={r.stage as Stage} /> },
    { id: "due", header: "Vence", minWidth: 110, numeric: true, sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : null),
      cell: (r) => <span style={{ color: r.dueDate && new Date(r.dueDate) < new Date() && r.stage !== "CLOSED" ? "#B91C1C" : undefined }}>{r.dueDate ? formatDate(r.dueDate) : "—"}</span> },
    { id: "progress", header: "Avance", minWidth: 110, numeric: true, sortValue: (r) => r.progress,
      cell: (r) => <div style={{ minWidth: 90 }}><div style={{ fontSize: 11, marginBottom: 4 }}>{r.progress}%</div><div style={{ height: 5, background: "var(--nf-line)", borderRadius: 99 }}><div style={{ width: `${r.progress}%`, height: "100%", background: "#5266F6", borderRadius: 99 }} /></div></div> },
  ], []);

  return <div>
    <SectionTitle title="ACPM / CAPA" sub="No conformidades, acciones correctivas y verificación de eficacia con trazabilidad ISO." action={initial.access.canCreate ? <><Plus size={16} /> Nueva CAPA</> : undefined} onAction={initial.access.canCreate ? () => setCreating(true) : undefined} />
    <div className="nf-metric-strip"><Metric label="Abiertas" value={open.length} /><Metric label="En implementación" value={initial.capas.filter((row) => row.stage === "IMPLEMENTATION").length} color="#5266F6" /><Metric label="Por verificar" value={initial.capas.filter((row) => row.stage === "VERIFICATION").length} color="#B45309" /><Metric label="Vencidas" value={overdue} color="#B91C1C" /><Metric label="Cerradas" value={initial.capas.filter((row) => row.stage === "CLOSED").length} color="#15803D" /></div>
    {error && <div className="nf-alert nf-alert--error">{error}</div>}{success && <div className="nf-alert nf-alert--success">{success}</div>}
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}><div style={{ position: "relative", flex: 1, minWidth: 240 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input aria-label="Buscar CAPA" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, título, proceso…" className={NF_INPUT_CLASS} style={{ ...modalInputStyle, paddingLeft: 32 }} /></div><Filter label="Etapa" value={stage} onChange={(value) => setStage(value as Stage | "ALL")} options={[{ value: "ALL", label: "Todas las etapas" }, ...STAGES.map((item) => ({ value: item.value, label: item.label }))]} /><Filter label="Severidad" value={severity} onChange={(value) => setSeverity(value as Severity | "ALL")} options={[{ value: "ALL", label: "Todas las severidades" }, ...SEVERITIES]} />{initial.access.canExport && <><button type="button" className="nf-app-btn-ghost" disabled={exportBusy} onClick={() => void exportIndex("EXCEL")}><Download size={14} /> Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exportBusy} onClick={() => void exportIndex("PDF")}><Download size={14} /> PDF</button></>}</div>
      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 10 }}>{filtered.length} de {initial.capas.length} CAPA · cierre bloqueado hasta verificar eficacia y adjuntar evidencia</div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        rowAction={(r) => setSelectedId(r.id)}
        caption="Acciones correctivas y preventivas: código, origen, norma y cláusula, responsable, etapa del flujo, vencimiento y avance."
        storageKey="acpm"
        empty={<EmptyState kind="no-results" title="No hay CAPA para los filtros seleccionados." description="Las acciones correctivas y preventivas nacen de no conformidades, auditorías o incidentes, y registran causa raíz, plan y verificación de eficacia." />}
      />
    </Card>
    <CreateModal initial={initial} open={creating} pending={isPending} onClose={() => setCreating(false)} onSubmit={(input) => run(() => createCAPA(input), { onSuccess: () => setCreating(false), successMessage: "CAPA registrada." })} />
    <DetailModal initial={initial} row={selected} pending={isPending} onClose={() => setSelectedId(null)} canUpdate={initial.access.canUpdate} canApprove={initial.access.canApprove} onRun={(operation, message) => run(operation, { successMessage: message })} />
  </div>;
}

function CreateModal({ initial, open, pending, onClose, onSubmit }: { initial: CAPAPayload; open: boolean; pending: boolean; onClose: () => void; onSubmit: (input: CreateCAPAInput) => void }) {
  return <Modal open={open} onClose={onClose} title="Registrar no conformidad" width={760}><form className="nf-modal-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const evidenceFile = form.get("evidenceFile"); onSubmit({ title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""), origin: String(form.get("origin") ?? "OTHER") as Origin, standardCode: String(form.get("standardCode") ?? "") || undefined, clauseId: String(form.get("clauseId") ?? "") || undefined, processId: String(form.get("processId") ?? "") || undefined, severity: String(form.get("severity") ?? "MINOR") as Severity, priority: String(form.get("priority") ?? "MEDIUM") as CreateCAPAInput["priority"], ownerId: String(form.get("ownerId") ?? "") || undefined, dueDate: String(form.get("dueDate") ?? "") || undefined, evidenceTitle: String(form.get("evidenceTitle") ?? "") || undefined, evidenceFile: evidenceFile instanceof File && evidenceFile.size ? evidenceFile : undefined }); }}>
    <Field label="Título de la no conformidad *"><input name="title" required className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Descripción / requisito incumplido *"><textarea name="description" required rows={4} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field>
    <div className="nf-form-grid-3"><Field label="Origen *"><select name="origin" defaultValue="OTHER" className={NF_INPUT_CLASS} style={modalInputStyle}>{ORIGINS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Severidad *"><select name="severity" defaultValue="MINOR" className={NF_INPUT_CLASS} style={modalInputStyle}>{SEVERITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Prioridad *"><select name="priority" defaultValue="MEDIUM" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="CRITICAL">Crítica</option><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option></select></Field></div>
    <div className="nf-form-grid-3"><Field label="Norma"><select name="standardCode" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.standards.map((item) => <option key={item.code} value={item.code}>{item.name} {item.version}</option>)}</select></Field><Field label="Cláusula ISO"><select name="clauseId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.clauses.map((item) => <option key={item.id} value={item.id}>{item.standardCode} · {item.code}</option>)}</select></Field><Field label="Proceso"><select name="processId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.processes.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}</select></Field></div>
    <div className="nf-form-grid-3"><Field label="Responsable"><select name="ownerId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">Sin asignar</option>{initial.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fecha límite"><input type="date" name="dueDate" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><div /></div><div className="nf-form-grid-2"><Field label="Evidencia inicial (opcional)"><input name="evidenceFile" type="file" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Título de evidencia"><input name="evidenceTitle" placeholder="Acta, foto, informe…" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field></div>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose} disabled={pending}>Cancelar</button><button type="submit" className="nf-app-btn-primary" disabled={pending}>{pending ? "Registrando…" : "Registrar y continuar"}</button></div>
  </form></Modal>;
}

function DetailModal({ initial, row, pending, onClose, canUpdate, canApprove, onRun }: { initial: CAPAPayload; row: Row | null; pending: boolean; onClose: () => void; canUpdate: boolean; canApprove: boolean; onRun: (operation: () => Promise<unknown>, message: string) => void }) {
  const [comment, setComment] = useState("");
  const [verifyComment, setVerifyComment] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"EFFECTIVE" | "NOT_EFFECTIVE">("EFFECTIVE");
  if (!row) return null;
  const index = STAGES.findIndex((item) => item.value === row.stage);
  const next = STAGES[index + 1];
  const save = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); onRun(() => updateCAPA(row.id, { ownerId: String(form.get("ownerId") ?? "") || undefined, dueDate: String(form.get("dueDate") ?? "") || undefined, rootCauseMethod: String(form.get("rootCauseMethod") ?? "FREE_TEXT") as "FIVE_WHY" | "ISHIKAWA" | "FREE_TEXT", fiveWhys: [1, 2, 3, 4, 5].map((n) => String(form.get(`why${n}`) ?? "")), ishikawaAnalysis: String(form.get("ishikawaAnalysis") ?? ""), rootCause: String(form.get("rootCause") ?? ""), correctiveAction: String(form.get("correctiveAction") ?? ""), progress: Number(form.get("progress") ?? row.progress), implementationComments: String(form.get("implementationComments") ?? ""), lessonsLearned: String(form.get("lessonsLearned") ?? "") }), "Cambios guardados."); };
  return <Modal open onClose={onClose} title={`${row.code} · ${row.title}`} width={900}><div style={{ display: "grid", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(95px, 1fr))`, gap: 4 }}>{STAGES.map((item, i) => <div key={item.value} style={{ borderTop: `4px solid ${i <= index ? "#5266F6" : "var(--nf-line)"}`, paddingTop: 7, opacity: i <= index ? 1 : .55 }}><div style={{ fontSize: 11, fontWeight: 750 }}>{i + 1}. {item.label}</div><div style={{ fontSize: 10, color: "var(--nf-ink-3)" }}>{item.detail}</div></div>)}</div>
    <div className="nf-detail-grid"><Meta label="Origen" value={ORIGIN_LABEL.get(row.origin) ?? row.origin} /><Meta label="Severidad" value={row.severity} /><Meta label="Norma / cláusula" value={`${row.standardCode ?? row.clause?.standard.code ?? "—"} · ${row.clause?.code ?? "—"}`} /><Meta label="Proceso" value={row.process?.name ?? "—"} /><Meta label="Responsable" value={row.owner?.name ?? "Sin asignar"} /><Meta label="Vence" value={row.dueDate ? formatDate(row.dueDate) : "—"} /></div>
    <div style={{ padding: 13, borderRadius: 10, background: "var(--nf-app-surface-2)", fontSize: 13, lineHeight: 1.55 }}>{row.description}</div>
    {canUpdate && row.stage !== "CLOSED" ? <form onSubmit={save} style={{ display: "grid", gap: 12 }}><div className="nf-form-grid-2"><Field label="Responsable"><select name="ownerId" defaultValue={row.ownerId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">Sin asignar</option>{initial.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fecha límite"><input name="dueDate" type="date" defaultValue={row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : ""} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field></div><div className="nf-form-grid-2"><Field label="Método de causa raíz"><select name="rootCauseMethod" defaultValue={row.rootCauseMethod ?? "FREE_TEXT"} className={NF_INPUT_CLASS} style={modalInputStyle}><option value="FIVE_WHY">5 porqués</option><option value="ISHIKAWA">Ishikawa</option><option value="FREE_TEXT">Texto libre</option></select></Field><Field label="Avance de implementación (%)"><input name="progress" type="number" min="0" max="100" defaultValue={row.progress} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field></div><Field label="5 porqués (completa los aplicables)"><div style={{ display: "grid", gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <input key={n} name={`why${n}`} defaultValue={Array.isArray(row.fiveWhys) ? String(row.fiveWhys[n - 1] ?? "") : ""} placeholder={`Por qué ${n}`} className={NF_INPUT_CLASS} style={modalInputStyle} />)}</div></Field><Field label="Análisis Ishikawa / texto libre"><textarea name="ishikawaAnalysis" defaultValue={row.ishikawaAnalysis ?? ""} rows={3} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Causa raíz aprobable"><textarea name="rootCause" defaultValue={row.rootCause ?? ""} rows={2} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Acción correctiva"><textarea name="correctiveAction" defaultValue={row.correctiveAction ?? ""} rows={3} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Comentarios de implementación"><textarea name="implementationComments" defaultValue={row.implementationComments ?? ""} rows={2} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Lecciones aprendidas"><textarea name="lessonsLearned" defaultValue={row.lessonsLearned ?? ""} rows={2} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><button type="submit" className="nf-app-btn-ghost" disabled={pending}>Guardar etapa</button></form> : null}
    <div style={{ display: "grid", gap: 9 }}><strong style={{ fontSize: 13 }}>Evidencias ({row.evidences.length})</strong>{row.evidences.map((e) => <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 12 }}><span><Paperclip size={13} style={{ verticalAlign: "-2px" }} /> {e.title} · {e.kind}</span><button type="button" className="nf-app-btn-ghost" onClick={() => void getCAPAEvidenceUrl(e.id).then((url) => window.open(url, "_blank"))}>Abrir</button></div>)}{canUpdate && row.stage !== "CLOSED" && <EvidenceForm row={row} pending={pending} onRun={onRun} />}</div>
    {row.stage === "VERIFICATION" && canApprove && <div className="nf-acpm-verification-box"><strong>Verificación de eficacia</strong><div className="nf-form-grid-2"><select value={verifyStatus} onChange={(event) => setVerifyStatus(event.target.value as typeof verifyStatus)} className={NF_INPUT_CLASS} style={modalInputStyle}><option value="EFFECTIVE">Eficaz</option><option value="NOT_EFFECTIVE">No eficaz</option></select><input value={verifyComment} onChange={(event) => setVerifyComment(event.target.value)} placeholder="Comentario del verificador" className={NF_INPUT_CLASS} style={modalInputStyle} /></div><button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => verifyCAPA(row.id, { status: verifyStatus, comment: verifyComment }), "Verificación registrada.")}>Registrar verificación</button></div>}
    <div><strong style={{ fontSize: 13 }}>Trazabilidad y comentarios</strong>{row.comments.map((item) => <div key={item.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 12 }}><b>{item.author.name}</b> · {formatDate(item.createdAt)}<div>{item.content}</div></div>)}{canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Añadir comentario de implementación…" className={NF_INPUT_CLASS} style={{ ...modalInputStyle, flex: 1 }} /><button type="button" className="nf-app-btn-ghost" onClick={() => onRun(() => addCAPAComment(row.id, comment), "Comentario añadido.")}>Comentar</button></div>}</div>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button>{row.stage === "ROOT_CAUSE" && canApprove && !row.rootCauseApproved && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => approveCAPARootCause(row.id), "Causa raíz aprobada.")}><ShieldCheck size={14} /> Aprobar causa raíz</button>}{next && ((next.value !== "CLOSED" && canUpdate) || (next.value === "CLOSED" && canApprove)) && <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => advanceCAPA(row.id), `CAPA avanzada a ${next.label}.`)}>Avanzar a {next.label}</button>}</div>
  </div></Modal>;
}

function EvidenceForm({ row, pending, onRun }: { row: Row; pending: boolean; onRun: (operation: () => Promise<unknown>, message: string) => void }) { const [kind, setKind] = useState<EvidenceKind>(row.stage === "VERIFICATION" ? "EFFECTIVENESS" : row.stage === "IMPLEMENTATION" ? "IMPLEMENTATION" : "NONCONFORMITY"); return <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("file"); if (!(file instanceof File) || !file.size) return; onRun(() => uploadCAPAEvidence({ capaId: row.id, kind, title: String(form.get("title") ?? ""), file }), "Evidencia adjuntada."); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}><Field label="Tipo"><select value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)} className={NF_INPUT_CLASS} style={modalInputStyle}><option value="NONCONFORMITY">No conformidad</option><option value="IMPLEMENTATION">Implementación</option><option value="EFFECTIVENESS">Eficacia</option></select></Field><Field label="Título"><input name="title" required className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Archivo"><input name="file" type="file" required className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><button type="submit" className="nf-app-btn-ghost" disabled={pending}>{pending ? <Loader2 size={14} className="nf-icon-spin" /> : <Paperclip size={14} />} Adjuntar</button></form>; }
function Metric({ label, value, color = "var(--nf-ink)" }: { label: string; value: number; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ color, background: `${color}14` }}><FileText size={19} /></div><div><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function StageBadge({ stage }: { stage: Stage }) { const color = stage === "CLOSED" ? "#15803D" : stage === "VERIFICATION" ? "#B45309" : "#5266F6"; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: `${color}14`, color, fontSize: 11, fontWeight: 750 }}>{STAGE_LABEL.get(stage) ?? stage}</span>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={NF_INPUT_CLASS} style={{ width: "auto", minWidth: 150 }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <ModalField label={label}>{children}</ModalField>; }
function Meta({ label, value }: { label: string; value: React.ReactNode }) { return <div><div style={{ fontSize: 10, color: "var(--nf-ink-3)", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 13 }}>{value}</div></div>; }
