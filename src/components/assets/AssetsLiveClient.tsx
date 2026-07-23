"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Download, Link2, Plus, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import {
  addAssetDependency,
  addAssetRisk,
  createAsset,
  deleteAsset,
  exportAssets,
  getAssetHistory,
  importAssetsCsv,
  markAssetReviewed,
  removeAssetControl,
  removeAssetDependency,
  removeAssetRisk,
  updateAsset,
  upsertAssetClassification,
  upsertAssetControl,
  type AssetsPayload,
} from "@/lib/actions/assets";

const CATEGORY_LABEL: Record<string, string> = { INFORMATION: "Información", SOFTWARE: "Software", HARDWARE: "Hardware", SERVICES: "Servicios", PEOPLE: "Personas", FACILITIES: "Instalaciones", SUPPLIERS: "Proveedores" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Activo", UNDER_REVIEW: "En revisión", INACTIVE: "Inactivo", RETIRED: "Retirado" };
const CRIT_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
const CIA_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };
const CLASS_LABEL: Record<string, string> = { PUBLIC: "Pública", INTERNAL: "Interna", CONFIDENTIAL: "Confidencial", RESTRICTED: "Restringida" };
const CTRL_STATUS_LABEL: Record<string, string> = { NOT_ASSESSED: "Sin evaluar", NOT_IMPLEMENTED: "No implementado", PLANNED: "Planificado", PARTIALLY_IMPLEMENTED: "Parcial", IMPLEMENTED: "Implementado", EFFECTIVE: "Efectivo", NOT_EFFECTIVE: "No efectivo" };
const DEP_LABEL: Record<string, string> = { DEPENDS_ON: "Depende de", SUPPORTS: "Soporta", PROCESSES: "Procesa", STORES: "Almacena", HOSTS: "Aloja", BACKS_UP: "Respalda" };
const REPORT_LABEL: Record<string, string> = { "assets": "Inventario", "asset-classification": "Clasificación", "asset-risks": "Riesgos", "asset-controls": "Controles" };

type Asset = AssetsPayload["assets"][number];

function critTone(c: string): "green" | "amber" | "red" | "blue" { return c === "CRITICAL" ? "red" : c === "HIGH" ? "amber" : c === "LOW" ? "green" : "blue"; }

export default function AssetsLiveClient({ initial }: { initial: AssetsPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [criticality, setCriticality] = useState("ALL");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reportType, setReportType] = useState("assets");
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => initial.assets.filter((a) => {
    if (category !== "ALL" && a.category !== category) return false;
    if (status !== "ALL" && a.status !== status) return false;
    if (criticality !== "ALL" && a.criticality !== criticality) return false;
    const term = query.trim().toLowerCase();
    return !term || `${a.code} ${a.name} ${a.owner?.name ?? ""}`.toLowerCase().includes(term);
  }), [initial.assets, query, category, status, criticality]);

  async function exportReport(format: "PDF" | "EXCEL") {
    setExporting(true);
    try {
      const result = await exportAssets({ reportType: reportType as never, format });
      await downloadQueuedReport(result.id);
    } finally { setExporting(false); }
  }

  return <div>
    <SectionTitle title="Activos de información" sub="Inventario ISO 27001: propietario, custodio, clasificación CIA, dependencias, riesgos y controles del Anexo A por activo." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}

    <div className="nf-metric-strip">
      <Metric label="Activos" value={initial.summary.total} icon={<Boxes size={19} />} />
      <Metric label="Críticos" value={initial.summary.critical} icon={<AlertTriangle size={19} />} color="#B91C1C" />
      <Metric label="Clasificados" value={initial.summary.classified} icon={<ShieldCheck size={19} />} color="#15803D" />
      <Metric label="Revisión vencida" value={initial.summary.overdue} icon={<AlertTriangle size={19} />} color="#B45309" />
    </div>

    {initial.overdueAlerts.length > 0 && <div className="nf-alert nf-alert--warning" style={{ marginBottom: 14 }}>
      <strong>Revisión vencida:</strong> {initial.overdueAlerts.slice(0, 6).map((a) => `${a.code} (${a.nextReviewDate ?? "—"})`).join(", ")}{initial.overdueAlerts.length > 6 ? ` y ${initial.overdueAlerts.length - 6} más` : ""}.
    </div>}

    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, nombre o propietario…" className="nf-app-input" style={{ paddingLeft: 32 }} /></div>
        <Filter label="Categoría" value={category} onChange={setCategory} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Estado" value={status} onChange={setStatus} options={[{ value: "ALL", label: "Todos" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Criticidad" value={criticality} onChange={setCriticality} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(CRIT_LABEL).map(([value, label]) => ({ value, label }))]} />
        {initial.canCreate && <><button type="button" className="nf-app-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Nuevo activo</button><button type="button" className="nf-app-btn-ghost" onClick={() => setImporting(true)}><Upload size={14} /> Importar CSV</button></>}
        {initial.canExport && <><select className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 150 }}>{Object.entries(REPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
      </div>
      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 10 }}>{filtered.length} de {initial.summary.total} activos</div>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 980 }}><thead><tr><th>Activo</th><th>Categoría</th><th>Criticidad</th><th>Clasificación</th><th>CIA</th><th>Propietario</th><th>Próxima revisión</th><th>Estado</th></tr></thead><tbody>{filtered.map((a) => <tr key={a.id} onClick={() => setSelected(a)} style={{ cursor: "pointer" }}><td><strong>{a.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{a.name}</div></td><td>{CATEGORY_LABEL[a.category]}</td><td><Badge value={CRIT_LABEL[a.criticality]} tone={critTone(a.criticality)} /></td><td>{a.classification ? CLASS_LABEL[a.classification.classification] : "—"}</td><td style={{ fontSize: 12 }}>{a.classification ? `${a.classification.confidentiality[0]}/${a.classification.integrity[0]}/${a.classification.availability[0]}` : "—"}</td><td>{a.owner?.name ?? "—"}</td><td style={{ color: a.overdue ? "#B91C1C" : undefined }}>{a.nextReviewDate ?? "—"}</td><td><Badge value={STATUS_LABEL[a.status]} tone={a.status === "ACTIVE" ? "green" : a.status === "RETIRED" ? "gray" : "blue"} /></td></tr>)}</tbody></table>{!filtered.length && <div className="nf-data-table-empty">No hay activos para los filtros seleccionados.</div>}</div>
    </Card>

    {creating && <AssetForm initial={initial} pending={isPending} onClose={() => setCreating(false)} onRun={run} />}
    {importing && <ImportModal pending={isPending} onClose={() => setImporting(false)} onRun={run} />}
    {selected && <AssetDetail asset={selected} initial={initial} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function AssetForm({ asset, initial, pending, onClose, onRun }: { asset?: Asset; initial: AssetsPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [f, setF] = useState({
    code: asset?.code ?? "", name: asset?.name ?? "", description: asset?.description ?? "", category: asset?.category ?? "INFORMATION",
    criticality: asset?.criticality ?? "MEDIUM", status: asset?.status ?? "ACTIVE", ownerId: asset?.owner?.id ?? "", custodianId: asset?.custodian?.id ?? "",
    processId: asset?.process?.id ?? "", locationId: asset?.location?.id ?? "", nextReviewDate: asset?.nextReviewDate ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const payload = () => ({ code: f.code, name: f.name, description: f.description || undefined, category: f.category as never, criticality: f.criticality as never, status: f.status as never, ownerId: f.ownerId || null, custodianId: f.custodianId || null, processId: f.processId || null, locationId: f.locationId || null, nextReviewDate: f.nextReviewDate || null });
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 680, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="nf-modal-header"><h3>{asset ? `Editar ${asset.code}` : "Nuevo activo"}</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <label>Código<input className="nf-app-input" value={f.code} onChange={(e) => set("code", e.target.value)} /></label>
        <label>Nombre<input className="nf-app-input" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
      </div>
      <label>Descripción<textarea className="nf-app-input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>Categoría<select className="nf-app-input" value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Criticidad<select className="nf-app-input" value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>{Object.entries(CRIT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Estado<select className="nf-app-input" value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>Propietario<select className="nf-app-input" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Sin asignar</option>{initial.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Custodio<select className="nf-app-input" value={f.custodianId} onChange={(e) => set("custodianId", e.target.value)}><option value="">Sin asignar</option>{initial.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>Proceso<select className="nf-app-input" value={f.processId} onChange={(e) => set("processId", e.target.value)}><option value="">Ninguno</option>{initial.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Ubicación<select className="nf-app-input" value={f.locationId} onChange={(e) => set("locationId", e.target.value)}><option value="">Ninguna</option>{initial.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Próxima revisión<input className="nf-app-input" type="date" value={f.nextReviewDate ?? ""} onChange={(e) => set("nextReviewDate", e.target.value)} /></label>
      </div>
      <button type="button" className="nf-app-btn-primary" disabled={pending || !f.code.trim() || !f.name.trim()} onClick={() => onRun(() => asset ? updateAsset({ id: asset.id, ...payload() }) : createAsset(payload()), { onSuccess: onClose, successMessage: asset ? "Activo actualizado." : "Activo creado." })}>{asset ? "Guardar cambios" : "Crear activo"}</button>
    </div>
  </div></div>;
}

function ImportModal({ pending, onClose, onRun }: { pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [csv, setCsv] = useState("code,name,category,criticality,description\n");
  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 640, width: "calc(100% - 32px)" }}>
    <div className="nf-modal-header"><h3>Importar activos (CSV)</h3><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 12, padding: 20 }}>
      <p style={{ fontSize: 12, color: "var(--nf-ink-3)", margin: 0 }}>Columnas requeridas: <code>code, name, category</code>. Opcionales: <code>criticality, description</code>. Categorías válidas: {Object.keys(CATEGORY_LABEL).join(", ")}.</p>
      <textarea className="nf-app-input" rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ fontFamily: "monospace", fontSize: 12 }} />
      <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => importAssetsCsv({ csv }), { onSuccess: onClose, successMessage: "Importación procesada." })}><Upload size={14} /> Importar</button>
    </div>
  </div></div>;
}

function AssetDetail({ asset, initial, pending, onClose, onRun }: { asset: Asset; initial: AssetsPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<{ id: string; action: string; at: string; by: string }[]>([]);
  const c = asset.classification;
  const [cls, setCls] = useState({ confidentiality: c?.confidentiality ?? "MEDIUM", integrity: c?.integrity ?? "MEDIUM", availability: c?.availability ?? "MEDIUM", classification: c?.classification ?? "INTERNAL", legalRequirements: c?.legalRequirements ?? "", retention: c?.retention ?? "" });
  const [threat, setThreat] = useState(""); const [vuln, setVuln] = useState(""); const [riskId, setRiskId] = useState("");
  const [ctrlId, setCtrlId] = useState(""); const [ctrlStatus, setCtrlStatus] = useState("PLANNED");
  const [depId, setDepId] = useState(""); const [depType, setDepType] = useState("DEPENDS_ON");

  useEffect(() => { getAssetHistory(asset.id).then(setHistory).catch(() => setHistory([])); }, [asset.id]);

  if (editing) return <AssetForm asset={asset} initial={initial} pending={pending} onClose={() => setEditing(false)} onRun={onRun} />;

  return <div className="nf-modal-backdrop" role="dialog" aria-modal="true"><div className="nf-modal" style={{ maxWidth: 780, width: "calc(100% - 32px)", maxHeight: "92vh", overflow: "auto" }}>
    <div className="nf-modal-header"><div><h3>{asset.code} · {asset.name}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>{CATEGORY_LABEL[asset.category]} · {CRIT_LABEL[asset.criticality]} · {STATUS_LABEL[asset.status]}</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
    <div style={{ display: "grid", gap: 16, padding: 20 }}>
      <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div><strong>Propietario:</strong> {asset.owner?.name ?? "—"}</div>
        <div><strong>Custodio:</strong> {asset.custodian?.name ?? "—"}</div>
        <div><strong>Proceso:</strong> {asset.process?.name ?? "—"}</div>
        <div><strong>Ubicación:</strong> {asset.location?.name ?? "—"}</div>
        <div><strong>Revisión:</strong> {asset.reviewDate ?? "—"}</div>
        <div style={{ color: asset.overdue ? "#B91C1C" : undefined }}><strong>Próxima:</strong> {asset.nextReviewDate ?? "—"}{asset.overdue ? " (vencida)" : ""}</div>
      </div>
      {initial.canUpdate && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="nf-app-btn-ghost" onClick={() => setEditing(true)}>Editar activo</button>
        <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => markAssetReviewed({ id: asset.id }), { successMessage: "Revisión registrada." })}><ShieldCheck size={14} /> Marcar revisado</button>
        {initial.canDelete && <button type="button" className="nf-app-btn-ghost" disabled={pending} style={{ color: "#B91C1C" }} onClick={() => onRun(() => deleteAsset(asset.id), { onSuccess: onClose, successMessage: "Activo eliminado." })}><Trash2 size={14} /> Eliminar</button>}
      </div>}

      {/* Clasificación */}
      <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}>
        <h4>Clasificación (CIA)</h4>
        {initial.canUpdate ? <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {(["confidentiality", "integrity", "availability"] as const).map((k) => <label key={k} style={{ fontSize: 11 }}>{k === "confidentiality" ? "Confidencialidad" : k === "integrity" ? "Integridad" : "Disponibilidad"}<select className="nf-app-input" value={cls[k]} onChange={(e) => setCls((p) => ({ ...p, [k]: e.target.value as never }))}>{Object.entries(CIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
            <label style={{ fontSize: 11 }}>Clasificación<select className="nf-app-input" value={cls.classification} onChange={(e) => setCls((p) => ({ ...p, classification: e.target.value as never }))}>{Object.entries(CLASS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <input className="nf-app-input" placeholder="Requisitos legales" value={cls.legalRequirements} onChange={(e) => setCls((p) => ({ ...p, legalRequirements: e.target.value }))} />
          <input className="nf-app-input" placeholder="Retención" value={cls.retention} onChange={(e) => setCls((p) => ({ ...p, retention: e.target.value }))} />
          <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={() => onRun(() => upsertAssetClassification({ assetId: asset.id, confidentiality: cls.confidentiality as never, integrity: cls.integrity as never, availability: cls.availability as never, classification: cls.classification as never, legalRequirements: cls.legalRequirements || undefined, retention: cls.retention || undefined }), { successMessage: "Clasificación guardada." })}>Guardar clasificación</button>
        </div> : <div style={{ fontSize: 13 }}>{c ? `${CLASS_LABEL[c.classification]} · CIA ${c.confidentiality}/${c.integrity}/${c.availability}` : "Sin clasificar"}</div>}
      </div>

      {/* Riesgos */}
      <Section title="Riesgos asociados">
        {asset.risks.map((r) => <Row key={r.id} text={`${r.riskTitle ?? r.threat ?? "Riesgo"}${r.vulnerability ? ` · ${r.vulnerability}` : ""}`} onRemove={initial.canUpdate ? () => onRun(() => removeAssetRisk(r.id)) : undefined} pending={pending} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <select className="nf-app-input" value={riskId} onChange={(e) => setRiskId(e.target.value)}><option value="">Riesgo del registro…</option>{initial.riskOptions.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
          <input className="nf-app-input" placeholder="Amenaza" value={threat} onChange={(e) => setThreat(e.target.value)} style={{ maxWidth: 150 }} />
          <input className="nf-app-input" placeholder="Vulnerabilidad" value={vuln} onChange={(e) => setVuln(e.target.value)} style={{ maxWidth: 150 }} />
          <button type="button" className="nf-app-btn-ghost" disabled={pending || (!riskId && !threat.trim())} onClick={() => onRun(() => addAssetRisk({ assetId: asset.id, riskId: riskId || null, threat: threat || undefined, vulnerability: vuln || undefined }), { successMessage: "Riesgo asociado." })}><Link2 size={14} /> Añadir</button>
        </div>}
      </Section>

      {/* Controles */}
      <Section title="Controles Anexo A asociados">
        {asset.controls.map((ct) => <Row key={ct.id} text={`${ct.code} · ${ct.title} · ${CTRL_STATUS_LABEL[ct.status]}${ct.evidence ? ` · ${ct.evidence.title}` : ""}`} onRemove={initial.canUpdate ? () => onRun(() => removeAssetControl(ct.id)) : undefined} pending={pending} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <select className="nf-app-input" value={ctrlId} onChange={(e) => setCtrlId(e.target.value)}><option value="">Control…</option>{initial.orgControlOptions.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.title}</option>)}</select>
          <select className="nf-app-input" value={ctrlStatus} onChange={(e) => setCtrlStatus(e.target.value)} style={{ maxWidth: 150 }}>{Object.entries(CTRL_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button type="button" className="nf-app-btn-ghost" disabled={pending || !ctrlId} onClick={() => onRun(() => upsertAssetControl({ assetId: asset.id, organizationControlId: ctrlId, status: ctrlStatus as never }), { successMessage: "Control asociado." })}><Link2 size={14} /> Añadir</button>
        </div>}
      </Section>

      {/* Dependencias */}
      <Section title="Dependencias">
        {asset.dependencies.map((d) => <Row key={d.id} text={`${DEP_LABEL[d.type]} → ${d.asset.code} ${d.asset.name}`} onRemove={initial.canUpdate ? () => onRun(() => removeAssetDependency(d.id)) : undefined} pending={pending} />)}
        {asset.dependents.map((d) => <Row key={d.id} text={`${d.asset.code} ${d.asset.name} → ${DEP_LABEL[d.type]} este activo`} pending={pending} />)}
        {initial.canUpdate && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <select className="nf-app-input" value={depType} onChange={(e) => setDepType(e.target.value)} style={{ maxWidth: 140 }}>{Object.entries(DEP_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="nf-app-input" value={depId} onChange={(e) => setDepId(e.target.value)}><option value="">Activo dependiente…</option>{initial.assets.filter((x) => x.id !== asset.id).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>
          <button type="button" className="nf-app-btn-ghost" disabled={pending || !depId} onClick={() => onRun(() => addAssetDependency({ sourceAssetId: asset.id, dependentAssetId: depId, type: depType as never }), { successMessage: "Dependencia añadida." })}><Link2 size={14} /> Añadir</button>
        </div>}
      </Section>

      {/* Historial */}
      <Section title="Historial">
        {history.length ? history.map((h) => <div key={h.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 12 }}>{h.at.slice(0, 16).replace("T", " ")} · {h.action} · {h.by}</div>) : <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Sin historial.</span>}
      </Section>
    </div>
  </div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}><h4>{title}</h4>{children}</div>; }
function Row({ text, onRemove, pending }: { text: string; onRemove?: () => void; pending: boolean }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 13 }}><span>{text}</span>{onRemove && <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={onRemove}><Trash2 size={13} /></button>}</div>; }
function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<select className="nf-app-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 3 }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>; }
