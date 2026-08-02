"use client";

import { useMemo, useState } from "react";
import { Archive, Download, Eye, FileDown, FileText, Loader2, Search, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { ConfirmActionModal, PromptActionModal } from "@/components/ui/ActionDialogs";
import { NF_INPUT_CLASS, ModalField, modalInputStyle } from "@/components/ui/ModalForm";
import { useServerAction } from "@/hooks/useServerAction";
import { formatDate } from "@/lib/utils";
import { archiveEvidence, createEvidence, exportEvidenceIndex, getEvidenceUrl, reviewEvidence, type CreateEvidenceInput } from "@/lib/actions/evidence";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import type { EvidencePayload } from "@/lib/server-queries";

type EvidenceRow = EvidencePayload["evidence"][number];
type EvidenceStatus = "VALID" | "EXPIRED" | "PENDING_REVIEW";
type EvidenceType = CreateEvidenceInput["evidenceType"];

const TYPES: { value: EvidenceType; label: string }[] = [
  { value: "POLICY", label: "Política" },
  { value: "PROCEDURE", label: "Procedimiento" },
  { value: "RECORD", label: "Registro" },
  { value: "REPORT", label: "Informe" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "LOG", label: "Log / bitácora" },
  { value: "PHOTO", label: "Fotografía" },
  { value: "SCREENSHOT", label: "Captura de pantalla" },
  { value: "MINUTES", label: "Acta" },
  { value: "OTHER", label: "Otro" },
];
const TYPE_LABEL = new Map(TYPES.map((item) => [item.value, item.label]));
const STATUS_LABEL: Record<EvidenceStatus, string> = { VALID: "Vigente", EXPIRED: "Vencida", PENDING_REVIEW: "Pendiente de revisión" };
const STATUS_COLOR: Record<EvidenceStatus, string> = { VALID: "#15803D", EXPIRED: "#B91C1C", PENDING_REVIEW: "#B45309" };

export function EvidenceRepositoryLiveClient({ initial }: { initial: EvidencePayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EvidenceStatus | "ALL">("ALL");
  const [type, setType] = useState<EvidenceType | "ALL">("ALL");
  const [processId, setProcessId] = useState("ALL");
  const [standardCode, setStandardCode] = useState("ALL");
  const [clauseId, setClauseId] = useState("ALL");
  const [responsibleId, setResponsibleId] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<EvidenceRow | null>(null);
  const [preview, setPreview] = useState<{ row: EvidenceRow; url: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [archiveRow, setArchiveRow] = useState<EvidenceRow | null>(null);
  const [rejectRow, setRejectRow] = useState<EvidenceRow | null>(null);
  const [exportBusy, setExportBusy] = useState<"PDF" | "EXCEL" | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initial.evidence.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (type !== "ALL" && row.evidenceType !== type) return false;
      if (processId !== "ALL" && row.processId !== processId) return false;
      if (standardCode !== "ALL" && row.standardCode !== standardCode) return false;
      if (clauseId !== "ALL" && row.clauseId !== clauseId) return false;
      if (responsibleId !== "ALL" && row.responsibleId !== responsibleId) return false;
      if (!query) return true;
      return [row.title, row.description, row.processName, row.standardCode, row.clauseName, row.responsibleName, ...row.documentLabels, ...row.riskLabels, ...row.auditLabels, ...row.nonconformityLabels]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [initial.evidence, search, status, type, processId, standardCode, clauseId, responsibleId]);

  const filters = { search, status, evidenceType: type, processId, standardCode, clauseId, responsibleId } as const;

  async function openPreview(row: EvidenceRow) {
    setPreviewBusy(row.id);
    setError("");
    try {
      setPreview({ row, url: await getEvidenceUrl(row.id) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la evidencia.");
    } finally {
      setPreviewBusy(null);
    }
  }

  async function exportIndex(format: "PDF" | "EXCEL") {
    setExportBusy(format);
    setError("");
    try {
      const result = await exportEvidenceIndex({ format, filters });
      await downloadQueuedReport(result.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo exportar el índice.");
    } finally {
      setExportBusy(null);
    }
  }

  const stats = {
    total: initial.evidence.length,
    valid: initial.evidence.filter((row) => row.status === "VALID").length,
    expired: initial.evidence.filter((row) => row.status === "EXPIRED").length,
    pending: initial.evidence.filter((row) => row.status === "PENDING_REVIEW").length,
  };

  return (
    <div>
      <SectionTitle title="Repositorio de Evidencias" sub="Fuente única de evidencia para auditorías ISO, con vínculos, vencimientos y trazabilidad." action={initial.access.canCreate ? "+ Subir evidencia" : undefined} onAction={initial.access.canCreate ? () => { setError(""); setCreating(true); } : undefined} />

      <div className="nf-metric-strip">
        <Stat label="Total" value={stats.total} icon={<FileText size={20} />} />
        <Stat label="Vigentes" value={stats.valid} icon={<ShieldCheck size={20} />} color="#15803D" />
        <Stat label="Por revisar" value={stats.pending} icon={<Loader2 size={20} />} color="#B45309" />
        <Stat label="Vencidas" value={stats.expired} icon={<Archive size={20} />} color="#B91C1C" />
      </div>

      {error && <div className="nf-alert nf-alert--error">{error}</div>}
      {success && <div className="nf-alert nf-alert--success">{success}</div>}

      <Card>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} aria-hidden />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, descripción o vínculo…" className="nf-app-input" style={{ ...modalInputStyle, paddingLeft: 32 }} />
          </div>
          <FilterSelect label="Estado" value={status} onChange={(value) => setStatus(value as EvidenceStatus | "ALL")} options={[{ value: "ALL", label: "Todos los estados" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect label="Tipo" value={type} onChange={(value) => setType(value as EvidenceType | "ALL")} options={[{ value: "ALL", label: "Todos los tipos" }, ...TYPES]} />
          <FilterSelect label="Norma" value={standardCode} onChange={(value) => { setStandardCode(value); setClauseId("ALL"); }} options={[{ value: "ALL", label: "Todas las normas" }, ...initial.standards.map((standard) => ({ value: standard.code, label: standard.name }))]} />
          <FilterSelect label="Cláusula" value={clauseId} onChange={setClauseId} options={[{ value: "ALL", label: "Todas las cláusulas" }, ...initial.clauses.filter((clause) => standardCode === "ALL" || clause.standardCode === standardCode).map((clause) => ({ value: clause.id, label: `${clause.standardCode} · ${clause.code}` }))]} />
          <FilterSelect label="Proceso" value={processId} onChange={setProcessId} options={[{ value: "ALL", label: "Todos los procesos" }, ...initial.targets.process.map((item) => ({ value: item.id, label: item.label }))]} />
          <FilterSelect label="Responsable" value={responsibleId} onChange={setResponsibleId} options={[{ value: "ALL", label: "Todos los responsables" }, ...initial.members.map((member) => ({ value: member.id, label: member.name }))]} />
          {initial.access.canExport && <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}><button type="button" className="nf-app-btn-ghost" disabled={exportBusy != null} onClick={() => void exportIndex("EXCEL")}><FileDown size={14} />{exportBusy === "EXCEL" ? "Generando…" : "Excel"}</button><button type="button" className="nf-app-btn-ghost" disabled={exportBusy != null} onClick={() => void exportIndex("PDF")}><FileDown size={14} />{exportBusy === "PDF" ? "Generando…" : "PDF"}</button></div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12, color: "var(--nf-ink-3)" }}><span>{filtered.length} de {initial.evidence.length} evidencias</span><span>Vencimientos y revisiones controlados por fecha</span></div>
        <div className="nf-data-table-wrap">
          <table className="nf-data-table" style={{ minWidth: 920 }}>
            <thead><tr><th>Título</th><th>Tipo</th><th>Norma / cláusula</th><th>Proceso</th><th>Responsable</th><th>Estado</th><th>Vence</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((row) => <tr key={row.id} onClick={() => setDetail(row)} style={{ cursor: "pointer" }}>
                <td><strong>{row.title}</strong><div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 3 }}>{row.fileSize ? `${Math.ceil(row.fileSize / 1024)} KB` : "Archivo"} · cargada {formatDate(row.createdAt)}</div></td>
                <td>{TYPE_LABEL.get(row.evidenceType) ?? row.evidenceType}</td>
                <td>{row.standardCode ?? "—"}{row.clauseName && <div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{row.clauseName}</div>}</td>
                <td>{row.processName ?? "—"}</td>
                <td><StatusBadge status={row.status as EvidenceStatus} /></td>
                <td style={{ color: row.status === "EXPIRED" ? "#B91C1C" : "var(--nf-ink-2)" }}>{row.expiresAt ? formatDate(row.expiresAt) : "Sin vencimiento"}</td>
                <td><button type="button" className="nf-app-btn-ghost" disabled={previewBusy === row.id} onClick={(event) => { event.stopPropagation(); void openPreview(row); }}>{previewBusy === row.id ? <Loader2 size={14} className="nf-icon-spin" /> : <Eye size={14} />}</button></td>
              </tr>)}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="nf-data-table-empty">No hay evidencias para los filtros seleccionados.</div>}
        </div>
      </Card>

      <EvidenceCreateModal initial={initial} open={creating} isPending={isPending} onClose={() => !isPending && setCreating(false)} onSubmit={(input) => run(() => createEvidence(input), { onSuccess: () => setCreating(false), successMessage: "Evidencia cargada y registrada." })} />
      <EvidenceDetailModal row={detail} canReview={initial.access.canReview} canDelete={initial.access.canDelete} isPending={isPending} onClose={() => setDetail(null)} onPreview={() => detail && void openPreview(detail)} onReview={(decision) => detail && (decision === "REJECT" ? (setRejectRow(detail), setDetail(null)) : run(() => reviewEvidence(detail.id, "APPROVE"), { onSuccess: () => setDetail(null), successMessage: "Evidencia revisada y marcada como vigente." }))} onArchive={() => { setArchiveRow(detail); setDetail(null); }} />
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Vista previa · ${preview?.row.title ?? "Evidencia"}`} width={900}>{preview && <EvidencePreview row={preview.row} url={preview.url} />}</Modal>
      <ConfirmActionModal open={!!archiveRow} title="Archivar evidencia" confirmLabel="Archivar" danger pending={isPending} onCancel={() => setArchiveRow(null)} onConfirm={() => archiveRow && run(() => archiveEvidence(archiveRow.id), { onSuccess: () => setArchiveRow(null), successMessage: "Evidencia archivada." })}>La evidencia se conservará en Storage y en el audit trail, pero dejará de aparecer en el repositorio activo.</ConfirmActionModal>
      <PromptActionModal open={!!rejectRow} title="Rechazar evidencia" label="Comentario de rechazo" placeholder="Indica qué debe corregirse antes de volver a revisar la evidencia…" confirmLabel="Rechazar" danger pending={isPending} onCancel={() => setRejectRow(null)} onConfirm={(comment) => rejectRow && run(() => reviewEvidence(rejectRow.id, "REJECT", comment), { onSuccess: () => setRejectRow(null), successMessage: "Evidencia rechazada y devuelta a revisión." })} />
    </div>
  );
}

function EvidenceCreateModal({ initial, open, isPending, onClose, onSubmit }: { initial: EvidencePayload; open: boolean; isPending: boolean; onClose: () => void; onSubmit: (input: CreateEvidenceInput) => void }) {
  return <Modal open={open} onClose={onClose} title="Subir evidencia" width={760}><form className="nf-modal-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("file"); if (!(file instanceof File) || !file.size) return; const input: CreateEvidenceInput = { title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""), evidenceType: String(form.get("evidenceType") ?? "OTHER") as EvidenceType, processId: String(form.get("processId") ?? "") || undefined, standardCode: String(form.get("standardCode") ?? "") || undefined, clauseId: String(form.get("clauseId") ?? "") || undefined, responsibleId: String(form.get("responsibleId") ?? "") || undefined, issuedAt: String(form.get("issuedAt") ?? "") || undefined, expiresAt: String(form.get("expiresAt") ?? "") || undefined, file, links: { documentIds: form.getAll("documentIds").map(String), riskIds: form.getAll("riskIds").map(String), auditIds: form.getAll("auditIds").map(String), findingIds: form.getAll("findingIds").map(String), nonconformityIds: form.getAll("nonconformityIds").map(String), indicatorIds: form.getAll("indicatorIds").map(String), managementReviewIds: form.getAll("managementReviewIds").map(String) } }; onSubmit(input); }} style={{ display: "grid", gap: 13 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Field label="Título *"><input name="title" required className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Tipo de evidencia *"><select name="evidenceType" defaultValue="OTHER" className={NF_INPUT_CLASS} style={modalInputStyle}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div>
    <Field label="Descripción"><textarea name="description" rows={3} className={NF_INPUT_CLASS} style={modalInputStyle} /></Field>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><Field label="Norma"><select name="standardCode" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.standards.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field><Field label="Cláusula"><select name="clauseId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.clauses.map((item) => <option key={item.id} value={item.id}>{item.standardCode.replace("_", " ")} · {item.code}</option>)}</select></Field><Field label="Proceso"><select name="processId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.targets.process.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><Field label="Responsable"><select name="responsibleId" className={NF_INPUT_CLASS} style={modalInputStyle}><option value="">—</option>{initial.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fecha de emisión"><input name="issuedAt" type="date" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field><Field label="Fecha de vencimiento"><input name="expiresAt" type="date" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field></div>
    <Field label="Archivo *"><input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,image/*" className={NF_INPUT_CLASS} style={modalInputStyle} /></Field>
    <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-ink-2)", marginBottom: 7 }}>Vincular con registros</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{(["documentIds", "riskIds", "auditIds", "findingIds", "nonconformityIds", "indicatorIds", "managementReviewIds"] as const).map((name) => <MultiSelect key={name} name={name} label={linkLabel(name)} options={initial.targets[targetKey(name)]} />)}</div></div>
    <div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" onClick={onClose} disabled={isPending}>Cancelar</button><button type="submit" className="nf-app-btn-primary" disabled={isPending}>{isPending ? "Cargando…" : "Subir y registrar evidencia"}</button></div>
  </form></Modal>;
}

function EvidenceDetailModal({ row, canReview, canDelete, isPending, onClose, onPreview, onReview, onArchive }: { row: EvidenceRow | null; canReview: boolean; canDelete: boolean; isPending: boolean; onClose: () => void; onPreview: () => void; onReview: (decision: "APPROVE" | "REJECT") => void; onArchive: () => void }) {
  if (!row) return null;
  const links = [...row.documentLabels, ...row.riskLabels, ...row.auditLabels, ...row.findingLabels, ...row.nonconformityLabels, ...row.indicatorLabels, ...row.managementReviewLabels];
  return <Modal open onClose={onClose} title={row.title} width={760}><div style={{ display: "grid", gap: 16 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}><Meta label="Estado" value={<StatusBadge status={row.status as EvidenceStatus} />} /><Meta label="Tipo" value={TYPE_LABEL.get(row.evidenceType) ?? row.evidenceType} /><Meta label="Norma" value={row.standardCode ?? "—"} /><Meta label="Cláusula" value={row.clauseName ?? "—"} /><Meta label="Proceso" value={row.processName ?? "—"} /><Meta label="Responsable" value={row.responsibleName ?? "—"} /><Meta label="Emisión" value={row.issuedAt ? formatDate(row.issuedAt) : "—"} /><Meta label="Vencimiento" value={row.expiresAt ? formatDate(row.expiresAt) : "Sin vencimiento"} /></div>{row.description && <div style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", color: "var(--nf-ink-2)", fontSize: 13 }}>{row.description}</div>}<div><strong style={{ fontSize: 13 }}>Vínculos ({links.length})</strong>{links.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{links.map((link) => <span key={link} className="nf-chip">{link}</span>)}</div> : <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin vínculos adicionales.</p>}</div><div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Cargada el {formatDate(row.createdAt)} por {row.uploadedByName ?? "usuario"}{row.reviewedAt && ` · revisada el ${formatDate(row.reviewedAt)} por ${row.reviewedByName ?? "usuario"}`}</div><div className="nf-modal-actions"><button type="button" className="nf-app-btn-primary" onClick={onPreview}><Eye size={14} /> Vista previa</button>{canReview && row.status === "PENDING_REVIEW" && <><button type="button" className="nf-app-btn-success" disabled={isPending} onClick={() => onReview("APPROVE")}><ShieldCheck size={14} /> Aprobar</button><button type="button" className="nf-app-btn-danger" disabled={isPending} onClick={() => onReview("REJECT")}><Archive size={14} /> Rechazar</button></>}{canDelete && <button type="button" className="nf-app-btn-danger" disabled={isPending} onClick={onArchive}><Archive size={14} /> Archivar</button>}</div></div></Modal>;
}

function EvidencePreview({ row, url }: { row: EvidenceRow; url: string }) { const image = row.mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(row.fileUrl); const pdf = row.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(row.fileUrl); return image ? <img src={url} alt={row.title} style={{ display: "block", maxWidth: "100%", maxHeight: "72vh", margin: "0 auto", borderRadius: 8 }} /> : pdf ? <iframe title={row.title} src={url} style={{ width: "100%", height: "72vh", border: "1px solid var(--nf-line)", borderRadius: 8 }} /> : <div style={{ padding: 20, background: "var(--nf-app-surface-2)", borderRadius: 8 }}><p>Vista previa no disponible para este formato.</p><a href={url} target="_blank" rel="noreferrer" className="nf-app-btn-primary"><Download size={14} /> Abrir o descargar</a></div>; }
function StatusBadge({ status }: { status: EvidenceStatus }) { return <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: `${STATUS_COLOR[status]}14`, color: STATUS_COLOR[status], fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[status]}</span>; }
function Stat({ label, value, icon, color = "var(--nf-ink)" }: { label: string; value: number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <ModalField label={label}>{children}</ModalField>; }
function Meta({ label, value }: { label: string; value: React.ReactNode }) { return <div><div style={{ fontSize: 10, color: "var(--nf-ink-3)", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{value}</div></div>; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={NF_INPUT_CLASS} style={{ width: "auto", minWidth: 140 }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }
function MultiSelect({ name, label, options }: { name: string; label: string; options: { id: string; label: string }[] }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<select name={name} multiple size={Math.min(Math.max(options.length, 2), 4)} className={NF_INPUT_CLASS} style={modalInputStyle}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>; }
function linkLabel(name: string) { return ({ documentIds: "Documentos", riskIds: "Riesgos", auditIds: "Auditorías", findingIds: "Hallazgos", nonconformityIds: "CAPA / NC", indicatorIds: "Indicadores", managementReviewIds: "Revisión por dirección" } as Record<string, string>)[name] ?? name; }
function targetKey(name: string): keyof EvidencePayload["targets"] { return ({ documentIds: "document", riskIds: "risk", auditIds: "audit", findingIds: "finding", nonconformityIds: "nc", indicatorIds: "indicator", managementReviewIds: "managementReview" } as Record<string, keyof EvidencePayload["targets"]>)[name]; }
