"use client";

import { useState } from "react";
import { Download, Handshake } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { exportSupplierSecurity, upsertSupplierSecurityProfile, type SupplierSecurityPayload } from "@/lib/actions/supplier-security";

const CRIT_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
function critTone(c: string): "green" | "amber" | "red" | "blue" { return c === "CRITICAL" ? "red" : c === "HIGH" ? "amber" : c === "LOW" ? "green" : "blue"; }

type Supplier = SupplierSecurityPayload["suppliers"][number];

export default function SupplierSecurityLiveClient({ initial }: { initial: SupplierSecurityPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportReport(format: "PDF" | "EXCEL") { setExporting(true); try { const r = await exportSupplierSecurity({ format }); await downloadQueuedReport(r.id); } finally { setExporting(false); } }

  return <div>
    <SectionTitle title="Proveedores de seguridad" sub="Perfil de seguridad de proveedores: criticidad, datos tratados, accesos, obligaciones, controles, riesgo, revisión y vencimiento contractual." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}
    <div className="nf-metric-strip">
      <Metric label="Proveedores" value={initial.summary.total} icon={<Handshake size={19} />} />
      <Metric label="Con perfil" value={initial.summary.profiled} icon={<Handshake size={19} />} color="#15803D" />
      <Metric label="Críticos" value={initial.summary.critical} icon={<Handshake size={19} />} color="#B91C1C" />
      <Metric label="Contrato por vencer" value={initial.summary.expiringSoon} icon={<Handshake size={19} />} color="#B45309" />
    </div>
    {initial.summary.reviewOverdue > 0 && <div className="nf-alert nf-alert--warning" style={{ marginBottom: 14 }}>{initial.summary.reviewOverdue} proveedor(es) con revisión de seguridad vencida.</div>}
    <Card>
      {initial.canExport && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></div>}
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 940 }}><thead><tr><th>Proveedor</th><th>Criticidad seguridad</th><th>Datos tratados</th><th>Riesgo</th><th>Revisión</th><th>Vencimiento contrato</th></tr></thead><tbody>{initial.suppliers.map((s) => <tr key={s.id} onClick={() => setSelected(s)} style={{ cursor: "pointer" }}><td><strong>{s.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{s.name}</div></td><td>{s.profile ? <Badge value={CRIT_LABEL[s.profile.securityCriticality]} tone={critTone(s.profile.securityCriticality)} /> : <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Sin perfil</span>}</td><td style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.profile?.dataProcessed ?? "—"}</td><td style={{ fontSize: 12 }}>{s.profile?.riskLevel ?? "—"}</td><td style={{ color: s.profile?.reviewOverdue ? "#B91C1C" : undefined }}>{s.profile?.nextReviewDate ?? "—"}</td><td style={{ color: s.profile?.contractExpiringSoon ? "#B45309" : undefined }}>{s.profile?.contractExpiry ?? "—"}</td></tr>)}</tbody></table>{!initial.suppliers.length && <div className="nf-data-table-empty">No hay proveedores registrados.</div>}</div>
    </Card>
    {selected && <ProfileForm supplier={selected} pending={isPending} canUpdate={initial.canUpdate} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function ProfileForm({ supplier, pending, canUpdate, onClose, onRun }: { supplier: Supplier; pending: boolean; canUpdate: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const p = supplier.profile;
  const [f, setF] = useState({
    securityCriticality: p?.securityCriticality ?? "MEDIUM", dataProcessed: p?.dataProcessed ?? "", accessGranted: p?.accessGranted ?? "",
    obligations: p?.obligations ?? "", controls: p?.controls ?? "", riskLevel: p?.riskLevel ?? "", nextReviewDate: p?.nextReviewDate ?? "", contractExpiry: p?.contractExpiry ?? "", notes: p?.notes ?? "",
  });
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 680, width: "calc(100% - 32px)", maxHeight: "92vh", overflow: "auto" }}>
    <div className="nf-modal-header"><div><h3>{supplier.code} · {supplier.name}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>Perfil de seguridad del proveedor</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>Criticidad de seguridad<select className="nf-app-input" value={f.securityCriticality} onChange={(e) => set("securityCriticality", e.target.value)} disabled={!canUpdate}>{Object.entries(CRIT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Nivel de riesgo<input className="nf-app-input" value={f.riskLevel} onChange={(e) => set("riskLevel", e.target.value)} disabled={!canUpdate} /></label>
      </div>
      <label>Datos tratados<textarea className="nf-app-input" rows={2} value={f.dataProcessed} onChange={(e) => set("dataProcessed", e.target.value)} disabled={!canUpdate} /></label>
      <label>Accesos otorgados<textarea className="nf-app-input" rows={2} value={f.accessGranted} onChange={(e) => set("accessGranted", e.target.value)} disabled={!canUpdate} /></label>
      <label>Obligaciones contractuales de seguridad<textarea className="nf-app-input" rows={2} value={f.obligations} onChange={(e) => set("obligations", e.target.value)} disabled={!canUpdate} /></label>
      <label>Controles aplicados<textarea className="nf-app-input" rows={2} value={f.controls} onChange={(e) => set("controls", e.target.value)} disabled={!canUpdate} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>Próxima revisión<input className="nf-app-input" type="date" value={f.nextReviewDate ?? ""} onChange={(e) => set("nextReviewDate", e.target.value)} disabled={!canUpdate} /></label>
        <label>Vencimiento contractual<input className="nf-app-input" type="date" value={f.contractExpiry ?? ""} onChange={(e) => set("contractExpiry", e.target.value)} disabled={!canUpdate} /></label>
      </div>
      {canUpdate && <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => upsertSupplierSecurityProfile({ supplierId: supplier.id, securityCriticality: f.securityCriticality as never, dataProcessed: f.dataProcessed || undefined, accessGranted: f.accessGranted || undefined, obligations: f.obligations || undefined, controls: f.controls || undefined, riskLevel: f.riskLevel || undefined, nextReviewDate: f.nextReviewDate || null, contractExpiry: f.contractExpiry || null, notes: f.notes || undefined }), { onSuccess: onClose, successMessage: "Perfil guardado." })}>Guardar perfil</button>}
    </div>
  </div></div>;
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>; }
