"use client";

import { useMemo, useState } from "react";
import { Download, Link2, Plus, Search, Siren, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { createIncident, exportIncidents, linkIncidentAsset, linkIncidentEvidence, transitionIncident, unlinkIncidentAsset, unlinkIncidentEvidence, updateIncident, type IncidentsPayload } from "@/lib/actions/incidents";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import DateField from "@/components/ui/DateField";

const SEV_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
const CAT_LABEL: Record<string, string> = { MALWARE: "Malware", PHISHING: "Phishing", UNAUTHORIZED_ACCESS: "Acceso no autorizado", DATA_LEAK: "Fuga de datos", DENIAL_OF_SERVICE: "Denegación de servicio", PHYSICAL: "Físico", HUMAN_ERROR: "Error humano", OTHER: "Otro" };
const STATUS_LABEL: Record<string, string> = { DETECTED: "Detectado", TRIAGED: "Clasificado", INVESTIGATING: "Investigando", CONTAINED: "Contenido", ERADICATED: "Erradicado", RECOVERED: "Recuperado", CLOSED: "Cerrado" };
function sevTone(s: string): "green" | "amber" | "red" | "blue" { return s === "CRITICAL" ? "red" : s === "HIGH" ? "amber" : s === "LOW" ? "green" : "blue"; }

type Incident = IncidentsPayload["incidents"][number];

export default function IncidentsLiveClient({ initial }: { initial: IncidentsPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const [severity, setSeverity] = useState("ALL");
  const [selected, setSelected] = useState<Incident | null>(null); const [creating, setCreating] = useState(false);
  const [reportType, setReportType] = useState("incident-log"); const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => initial.incidents.filter((i) => {
    if (status !== "ALL" && i.status !== status) return false;
    if (severity !== "ALL" && i.severity !== severity) return false;
    const t = query.trim().toLowerCase();
    return !t || `${i.code} ${i.description}`.toLowerCase().includes(t);
  }), [initial.incidents, query, status, severity]);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const r = await exportIncidents({ reportType: reportType as never, format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  const columns = useMemo<DataTableColumn<Incident>[]>(() => [
    { id: "code", header: "Incidente", primary: true, minWidth: 220, hideable: false, sortValue: (i) => i.code,
      cell: (i) => <><strong>{i.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{i.description}</div></> },
    { id: "detected", header: "Detectado", minWidth: 120, numeric: true, sortValue: (i) => i.detectedAt ?? "", cell: (i) => i.detectedAt ?? "—" },
    { id: "severity", header: "Severidad", minWidth: 120, sortValue: (i) => i.severity, cell: (i) => <Badge value={SEV_LABEL[i.severity]} tone={sevTone(i.severity)} /> },
    { id: "category", header: "Categoría", minWidth: 140, sortValue: (i) => i.category, cell: (i) => CAT_LABEL[i.category] },
    { id: "status", header: "Estado", minWidth: 120, sortValue: (i) => i.status, cell: (i) => <Badge value={STATUS_LABEL[i.status]} tone={i.status === "CLOSED" ? "gray" : "blue"} /> },
    { id: "owner", header: "Responsable", minWidth: 140, sortValue: (i) => i.responsible?.name ?? "", cell: (i) => i.responsible?.name ?? "—" },
    { id: "assets", header: "Activos", align: "end", numeric: true, minWidth: 90, sortValue: (i) => i.assets.length, cell: (i) => i.assets.length },
  ], []);

  return <div>
    <SectionTitle title="Incidentes de seguridad" sub="Gestión ISO 27001 de incidentes con flujo secuencial: detección, clasificación, investigación, contención, erradicación, recuperación y cierre." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    <div className="nf-metric-strip">
      <Metric label="Incidentes" value={initial.summary.total} icon={<Siren size={19} />} />
      <Metric label="Abiertos" value={initial.summary.open} icon={<Siren size={19} />} color="var(--nf-warning-text)" />
      <Metric label="Críticos abiertos" value={initial.summary.critical} icon={<Siren size={19} />} color="var(--nf-danger-text)" />
      <Metric label="Con notificación" value={initial.summary.notifiable} icon={<Siren size={19} />} color="var(--nf-primary-active)" />
    </div>
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input aria-label="Buscar código o descripción" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código o descripción…" className="nf-app-input" style={{ paddingLeft: 32 }} /></div>
        <Filter label="Estado" value={status} onChange={setStatus} options={[{ value: "ALL", label: "Todos" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Severidad" value={severity} onChange={setSeverity} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(SEV_LABEL).map(([value, label]) => ({ value, label }))]} />
        {initial.canCreate && <button type="button" className="nf-app-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Registrar incidente</button>}
        {initial.canExport && <><Picker aria-label="Tipo de informe" className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 150 }}><option value="incident-log">Registro</option><option value="incident-report">Informe</option></Picker><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(i) => i.id}
        rowAction={(i) => setSelected(i)}
        caption="Incidentes de seguridad: código, fecha de detección, severidad, categoría, estado, responsable y activos afectados."
        storageKey="incidents"
        empty={<EmptyState kind="no-results" title="No hay incidentes para los filtros seleccionados." description="Aquí se registran los incidentes de seguridad con su severidad, los activos afectados y el responsable de la respuesta." />}
      />
    </Card>
    {creating && <IncidentForm initial={initial} pending={isPending} onClose={() => setCreating(false)} onRun={run} />}
    {selected && <IncidentDetail incident={selected} initial={initial} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function IncidentForm({ initial, pending, onClose, onRun }: { initial: IncidentsPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({ code: "", description: "", severity: "MEDIUM", category: "OTHER", responsibleId: "", detectedAt: new Date().toISOString().slice(0, 10), notificationRequired: false, notificationDetails: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 640, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><h3>Registrar incidente</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Código<input className="nf-app-input" value={f.code} onChange={(e) => set("code", e.target.value)} /></label><label>Detectado<DateField className="nf-app-input" value={f.detectedAt} onChange={(e) => set("detectedAt", e.target.value)} /></label></div>
      <label>Descripción<textarea className="nf-app-input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>Severidad<Picker aria-label="Severidad" className="nf-app-input" value={f.severity} onChange={(e) => set("severity", e.target.value)}>{Object.entries(SEV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Picker></label>
        <label>Categoría<Picker aria-label="Categoría" className="nf-app-input" value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Picker></label>
        <label>Responsable<PersonPicker people={initial.members} value={f.responsibleId} onValueChange={(personId) => set("responsibleId", personId)} placeholder="Sin asignar" ariaLabel="Responsable" /></label>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={f.notificationRequired} onChange={(e) => set("notificationRequired", e.target.checked)} /> Requiere notificación (regulatoria / partes interesadas)</label>
      {f.notificationRequired && <label>Requisitos de notificación<textarea className="nf-app-input" rows={2} value={f.notificationDetails} onChange={(e) => set("notificationDetails", e.target.value)} /></label>}
      <button type="button" className="nf-app-btn-primary" disabled={pending || !f.code.trim() || !f.description.trim()} onClick={() => onRun(() => createIncident({ code: f.code, description: f.description, severity: f.severity as never, category: f.category as never, responsibleId: f.responsibleId || null, detectedAt: f.detectedAt || null, notificationRequired: f.notificationRequired, notificationDetails: f.notificationDetails || undefined }), { onSuccess: onClose, successMessage: "Incidente registrado." })}>Registrar</button>
    </div>
  </div></div>;
}

function IncidentDetail({ incident, initial, pending, onClose, onRun }: { incident: Incident; initial: IncidentsPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [assetId, setAssetId] = useState(""); const [evidenceId, setEvidenceId] = useState("");
  const [lessons, setLessons] = useState(incident.lessonsLearned ?? "");
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 760, width: "calc(100% - 32px)", maxHeight: "92vh", overflow: "auto" }}>
    <div className="nf-modal-header"><div><h3>{incident.code}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>{SEV_LABEL[incident.severity]} · {CAT_LABEL[incident.category]} · {STATUS_LABEL[incident.status]}</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 16, padding: 20 }}>
      <div style={{ fontSize: 13 }}>{incident.description}{incident.impact ? <div style={{ marginTop: 6 }}><strong>Impacto:</strong> {incident.impact}</div> : null}{incident.notificationRequired ? <div style={{ marginTop: 6, color: "var(--nf-warning-text)" }}><strong>Notificación requerida:</strong> {incident.notificationDetails ?? "—"}</div> : null}</div>

      {/* Workflow */}
      <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Flujo de gestión</h4>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>{initial.order.map((s) => <span key={s} style={{ padding: "3px 7px", borderRadius: 6, background: s === incident.status ? "var(--nf-primary)" : "var(--nf-app-surface-2)", color: s === incident.status ? "#fff" : "var(--nf-ink-3)" }}>{STATUS_LABEL[s]}</span>)}</div>
        {initial.canUpdate && incident.nextStatus && <button type="button" className="nf-app-btn-primary" style={{ marginTop: 10 }} disabled={pending} onClick={() => onRun(() => transitionIncident({ id: incident.id, toStatus: incident.nextStatus as never }), { successMessage: `Avanzado a ${STATUS_LABEL[incident.nextStatus!]}.` })}>Avanzar a {STATUS_LABEL[incident.nextStatus]}</button>}
        {!incident.nextStatus && <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 8 }}>Incidente cerrado — flujo completo.</div>}
      </div>

      {initial.canUpdate && <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Lecciones aprendidas</h4>
        <textarea aria-label="Lecciones aprendidas" className="nf-app-input" rows={2} value={lessons} onChange={(e) => setLessons(e.target.value)} />
        <button type="button" className="nf-app-btn-ghost" style={{ marginTop: 8 }} disabled={pending} onClick={() => onRun(() => updateIncident({ id: incident.id, severity: incident.severity as never, category: incident.category as never, responsibleId: incident.responsible?.id ?? null, occurredAt: incident.occurredAt, impact: incident.impact ?? undefined, notificationRequired: incident.notificationRequired, notificationDetails: incident.notificationDetails ?? undefined, lessonsLearned: lessons || undefined }), { successMessage: "Guardado." })}>Guardar lecciones</button>
      </div>}

      <Section title="Activos afectados">
        {incident.assets.map((a) => <Row key={a.id} text={`${a.asset.code} · ${a.asset.name}`} onRemove={initial.canUpdate ? () => onRun(() => unlinkIncidentAsset(a.id)) : undefined} pending={pending} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 6 }}><Picker aria-label="Activo" className="nf-app-input" value={assetId} onChange={(e) => setAssetId(e.target.value)}><option value="">Activo…</option>{initial.assetOptions.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</Picker><button type="button" className="nf-app-btn-ghost" disabled={pending || !assetId} onClick={() => onRun(() => linkIncidentAsset({ incidentId: incident.id, assetId }), { successMessage: "Activo vinculado." })}><Link2 size={14} /> Añadir</button></div>}
      </Section>
      <Section title="Evidencias">
        {incident.evidence.map((e) => <Row key={e.id} text={e.evidence.title} onRemove={initial.canUpdate ? () => onRun(() => unlinkIncidentEvidence(e.id)) : undefined} pending={pending} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 6 }}><Picker aria-label="Evidencia" className="nf-app-input" value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}><option value="">Evidencia…</option>{initial.evidenceOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</Picker><button type="button" className="nf-app-btn-ghost" disabled={pending || !evidenceId} onClick={() => onRun(() => linkIncidentEvidence({ incidentId: incident.id, evidenceId }), { successMessage: "Evidencia vinculada." })}><Link2 size={14} /> Añadir</button></div>}
      </Section>
    </div>
  </div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}><h4>{title}</h4>{children}</div>; }
function Row({ text, onRemove, pending }: { text: string; onRemove?: () => void; pending: boolean }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}><span>{text}</span>{onRemove && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={onRemove}><Trash2 size={13} /></button>}</div>; }
function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<Picker aria-label={label} className="nf-app-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 3 }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Picker></label>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["var(--nf-success-text)", "var(--nf-success-subtle)"], gray: ["var(--nf-text-secondary)", "var(--nf-surface-muted)"], amber: ["var(--nf-warning-text)", "var(--nf-warning-subtle)"], red: ["var(--nf-danger-text)", "var(--nf-danger-subtle)"], blue: ["var(--nf-primary-active)", "var(--nf-primary-subtle)"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>; }
