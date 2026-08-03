"use client";

import { useMemo, useState } from "react";
import { Bug, Download, Plus, Search, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { addRemediation, addVerification, createVulnerability, exportVulnerabilities, linkVulnerabilityAsset, updateRemediation, updateVulnerability, type VulnerabilitiesPayload } from "@/lib/actions/vulnerabilities";

const SEV_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
const STATUS_LABEL: Record<string, string> = { OPEN: "Abierta", IN_PROGRESS: "En progreso", REMEDIATED: "Remediada", VERIFIED: "Verificada", ACCEPTED: "Aceptada", CLOSED: "Cerrada" };
const REM_STATUS: Record<string, string> = { PLANNED: "Planificada", IN_PROGRESS: "En progreso", DONE: "Hecha", VERIFIED: "Verificada" };
const VER_RESULT: Record<string, string> = { PASSED: "Aprobada", FAILED: "Fallida", PARTIAL: "Parcial" };
function sevTone(s: string): "green" | "amber" | "red" | "blue" { return s === "CRITICAL" ? "red" : s === "HIGH" ? "amber" : s === "LOW" ? "green" : "blue"; }

type Vuln = VulnerabilitiesPayload["vulnerabilities"][number];

export default function VulnerabilitiesLiveClient({ initial }: { initial: VulnerabilitiesPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const [severity, setSeverity] = useState("ALL");
  const [selected, setSelected] = useState<Vuln | null>(null); const [creating, setCreating] = useState(false);
  const [reportType, setReportType] = useState("open-vulnerabilities"); const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => initial.vulnerabilities.filter((v) => {
    if (status !== "ALL" && v.status !== status) return false;
    if (severity !== "ALL" && v.severity !== severity) return false;
    const t = query.trim().toLowerCase();
    return !t || `${v.code} ${v.cve ?? ""} ${v.description ?? ""}`.toLowerCase().includes(t);
  }), [initial.vulnerabilities, query, status, severity]);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const r = await exportVulnerabilities({ reportType: reportType as never, format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  return <div>
    <SectionTitle title="Vulnerabilidades" sub="Gestión de vulnerabilidades ISO 27001: origen, CVE, severidad, activos expuestos, remediación y verificación." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    <div className="nf-metric-strip">
      <Metric label="Total" value={initial.summary.total} icon={<Bug size={19} />} />
      <Metric label="Abiertas" value={initial.summary.open} icon={<Bug size={19} />} color="#B45309" />
      <Metric label="Críticas abiertas" value={initial.summary.critical} icon={<Bug size={19} />} color="#B91C1C" />
      <Metric label="Vencidas" value={initial.summary.overdue} icon={<Bug size={19} />} color="#B91C1C" />
    </div>
    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input aria-label="Buscar código, CVE o descripción" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, CVE o descripción…" className="nf-app-input" style={{ paddingLeft: 32 }} /></div>
        <Filter label="Estado" value={status} onChange={setStatus} options={[{ value: "ALL", label: "Todos" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Severidad" value={severity} onChange={setSeverity} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(SEV_LABEL).map(([value, label]) => ({ value, label }))]} />
        {initial.canCreate && <button type="button" className="nf-app-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Nueva vulnerabilidad</button>}
        {initial.canExport && <><select aria-label="Tipo de informe" className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 160 }}><option value="open-vulnerabilities">Abiertas</option><option value="remediation-plan">Plan remediación</option></select><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
      </div>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 940 }}><thead><tr><th>Vulnerabilidad</th><th>Origen</th><th>CVE</th><th>Severidad</th><th>Estado</th><th>Responsable</th><th>Objetivo</th></tr></thead><tbody>{filtered.map((v) => <tr key={v.id} onClick={() => setSelected(v)} style={{ cursor: "pointer" }}><td><strong>{v.code}</strong></td><td style={{ fontSize: 12 }}>{v.source}</td><td style={{ fontSize: 12 }}>{v.cve ?? "—"}</td><td><Badge value={SEV_LABEL[v.severity]} tone={sevTone(v.severity)} /></td><td><Badge value={STATUS_LABEL[v.status]} tone={v.status === "VERIFIED" || v.status === "CLOSED" ? "green" : "blue"} /></td><td>{v.responsible?.name ?? "—"}</td><td style={{ color: v.overdue ? "var(--nf-danger-text)" : undefined }}>{v.targetDate ?? "—"}</td></tr>)}</tbody></table>{!filtered.length && <div className="nf-data-table-empty">No hay vulnerabilidades para los filtros seleccionados.</div>}</div>
    </Card>
    {creating && <VulnForm initial={initial} pending={isPending} onClose={() => setCreating(false)} onRun={run} />}
    {selected && <VulnDetail vuln={selected} initial={initial} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function VulnForm({ initial, pending, onClose, onRun }: { initial: VulnerabilitiesPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({ code: "", source: "", cve: "", severity: "MEDIUM", exposure: "", description: "", responsibleId: "", targetDate: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 640, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><h3>Nueva vulnerabilidad</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><label>Código<input className="nf-app-input" value={f.code} onChange={(e) => set("code", e.target.value)} /></label><label>Origen<input className="nf-app-input" value={f.source} onChange={(e) => set("source", e.target.value)} placeholder="Pentest, scanner…" /></label><label>CVE<input className="nf-app-input" value={f.cve} onChange={(e) => set("cve", e.target.value)} placeholder="CVE-2026-…" /></label></div>
      <label>Descripción<textarea className="nf-app-input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label>Exposición<input className="nf-app-input" value={f.exposure} onChange={(e) => set("exposure", e.target.value)} placeholder="Internet, interna…" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>Severidad<select className="nf-app-input" value={f.severity} onChange={(e) => set("severity", e.target.value)}>{Object.entries(SEV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Responsable<select className="nf-app-input" value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Sin asignar</option>{initial.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Fecha objetivo<input className="nf-app-input" type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} /></label>
      </div>
      <button type="button" className="nf-app-btn-primary" disabled={pending || !f.code.trim() || !f.source.trim()} onClick={() => onRun(() => createVulnerability({ code: f.code, source: f.source, cve: f.cve || null, severity: f.severity as never, exposure: f.exposure || undefined, description: f.description || undefined, responsibleId: f.responsibleId || null, targetDate: f.targetDate || null }), { onSuccess: onClose, successMessage: "Vulnerabilidad creada." })}>Crear</button>
    </div>
  </div></div>;
}

function VulnDetail({ vuln, initial, pending, onClose, onRun }: { vuln: Vuln; initial: VulnerabilitiesPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [assetId, setAssetId] = useState(""); const [remText, setRemText] = useState(""); const [status, setStatus] = useState(vuln.status);
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 760, width: "calc(100% - 32px)", maxHeight: "92vh", overflow: "auto" }}>
    <div className="nf-modal-header"><div><h3>{vuln.code}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>{vuln.source}{vuln.cve ? ` · ${vuln.cve}` : ""} · {SEV_LABEL[vuln.severity]} · {STATUS_LABEL[vuln.status]}</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 16, padding: 20 }}>
      {vuln.description && <div style={{ fontSize: 13 }}>{vuln.description}</div>}
      {initial.canUpdate && <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}><label style={{ fontSize: 11 }}>Estado<select className="nf-app-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => updateVulnerability({ id: vuln.id, code: vuln.code, source: vuln.source, cve: vuln.cve || null, severity: vuln.severity as never, exposure: vuln.exposure || undefined, description: vuln.description || undefined, responsibleId: vuln.responsible?.id ?? null, targetDate: vuln.targetDate || null, status: status as never }), { successMessage: "Estado actualizado." })}>Guardar estado</button></div>}

      <Section title="Activos expuestos">
        {vuln.assets.map((a) => <div key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>{a.asset.code} · {a.asset.name}{a.exposure ? ` · ${a.exposure}` : ""}</div>)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 6 }}><select aria-label="Activo" className="nf-app-input" value={assetId} onChange={(e) => setAssetId(e.target.value)}><option value="">Activo…</option>{initial.assetOptions.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={pending || !assetId} onClick={() => onRun(() => linkVulnerabilityAsset({ vulnerabilityId: vuln.id, assetId }), { successMessage: "Activo vinculado." })}>Añadir</button></div>}
      </Section>

      <Section title="Remediaciones y verificación">
        {vuln.remediations.map((m) => <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{m.description}</span><Badge value={REM_STATUS[m.status]} tone={m.status === "VERIFIED" ? "green" : "blue"} /></div>
          <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{m.responsible?.name ?? "Sin responsable"}{m.targetDate ? ` · objetivo ${m.targetDate}` : ""}</div>
          {m.verifications.map((v) => <div key={v.id} style={{ fontSize: 12, marginTop: 3 }}>✓ {VER_RESULT[v.result]} · {v.verifiedBy.name} · {v.verifiedAt.slice(0, 10)}</div>)}
          {initial.canUpdate && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {m.status !== "DONE" && m.status !== "VERIFIED" && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => updateRemediation({ id: m.id, description: m.description, responsibleId: m.responsible?.id ?? null, targetDate: m.targetDate || null, status: "DONE" }), { successMessage: "Remediación completada." })}>Marcar hecha</button>}
            <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => addVerification({ remediationId: m.id, result: "PASSED", notes: "Verificación satisfactoria." }), { successMessage: "Verificada." })}><ShieldCheck size={13} /> Verificar (OK)</button>
            <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => addVerification({ remediationId: m.id, result: "FAILED", notes: "La verificación falló." }), { successMessage: "Verificación registrada." })}>Verificar (falla)</button>
          </div>}
        </div>)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><input aria-label="Nueva remediación" className="nf-app-input" placeholder="Nueva remediación…" value={remText} onChange={(e) => setRemText(e.target.value)} /><button type="button" className="nf-app-btn-primary" disabled={pending || !remText.trim()} onClick={() => onRun(() => addRemediation({ vulnerabilityId: vuln.id, description: remText }), { onSuccess: () => setRemText(""), successMessage: "Remediación añadida." })}>Añadir</button></div>}
      </Section>
    </div>
  </div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}><h4>{title}</h4>{children}</div>; }
function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<select className="nf-app-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 3 }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["var(--nf-success-text)", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["var(--nf-warning-text)", "#fff8e6"], red: ["var(--nf-danger-text)", "#fff0f0"], blue: ["var(--nf-primary)", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>; }
