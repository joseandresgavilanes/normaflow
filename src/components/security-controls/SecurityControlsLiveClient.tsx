"use client";

import { useMemo, useState } from "react";
import { Download, FileCheck2, Link2, Search, ShieldCheck, Timer } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { exportSecurityControls, linkControlEvidence, linkRiskToSecurityControl, reviewSecurityControl, updateOrganizationControl, type SecurityControlsPayload } from "@/lib/actions/security-controls";

const DOMAIN_LABEL: Record<string, string> = { ORGANIZATIONAL: "A.5 Organizacionales", PEOPLE: "A.6 Personas", PHYSICAL: "A.7 Físicos", TECHNOLOGICAL: "A.8 Tecnológicos" };
const STATUS_LABEL: Record<string, string> = { NOT_ASSESSED: "Sin evaluar", NOT_IMPLEMENTED: "No implementado", PLANNED: "Planificado", PARTIALLY_IMPLEMENTED: "Parcial", IMPLEMENTED: "Implementado", EFFECTIVE: "Efectivo", NOT_EFFECTIVE: "No efectivo" };
const APPLICABILITY_LABEL: Record<string, string> = { INCLUDED: "Incluido", EXCLUDED: "Excluido", UNDER_REVIEW: "En revisión" };

type Row = SecurityControlsPayload["controls"][number];

export default function SecurityControlsLiveClient({ initial }: { initial: SecurityControlsPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [applicability, setApplicability] = useState("ALL");
  const [selected, setSelected] = useState<Row | null>(null);
  const [exporting, setExporting] = useState<"PDF" | "EXCEL" | null>(null);

  const filtered = useMemo(() => initial.controls.filter((row) => {
    if (domain !== "ALL" && row.domain !== domain) return false;
    if (status !== "ALL" && row.status !== status) return false;
    if (applicability !== "ALL" && row.applicability !== applicability) return false;
    const term = query.trim().toLowerCase();
    return !term || `${row.code} ${row.title} ${row.responsible?.name ?? ""}`.toLowerCase().includes(term);
  }), [initial.controls, query, domain, status, applicability]);

  async function exportCatalog(format: "PDF" | "EXCEL") {
    setExporting(format);
    try {
      const result = await exportSecurityControls({ format, filters: { ...(domain !== "ALL" ? { domain } : {}), ...(status !== "ALL" ? { status } : {}), ...(applicability !== "ALL" ? { applicability } : {}) } });
      await downloadQueuedReport(result.id);
    } finally { setExporting(null); }
  }

  return <div>
    <SectionTitle title="Controles ISO 27001" sub="Catálogo operativo y versionado del Anexo A con aplicabilidad, evidencia, riesgos y revisiones." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}

    <div className="nf-metric-strip">
      <Metric label="Controles activos" value={initial.summary.total} icon={<ShieldCheck size={19} />} />
      <Metric label="Incluidos" value={initial.summary.included} icon={<FileCheck2 size={19} />} color="#5266F6" />
      <Metric label="Cobertura" value={`${initial.summary.coverage}%`} icon={<Link2 size={19} />} color="#15803D" />
      <Metric label="Revisiones vencidas" value={initial.summary.overdue} icon={<Timer size={19} />} color="#B91C1C" />
    </div>

    <Card>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, título o responsable…" className="nf-app-input" style={{ paddingLeft: 32 }} /></div>
        <Filter label="Dominio" value={domain} onChange={setDomain} options={["ALL", "ORGANIZATIONAL", "PEOPLE", "PHYSICAL", "TECHNOLOGICAL"].map((value) => ({ value, label: value === "ALL" ? "Todos los dominios" : DOMAIN_LABEL[value] }))} />
        <Filter label="Estado" value={status} onChange={setStatus} options={[{ value: "ALL", label: "Todos los estados" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Aplicabilidad" value={applicability} onChange={setApplicability} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(APPLICABILITY_LABEL).map(([value, label]) => ({ value, label }))]} />
        {initial.canExport && <><button type="button" className="nf-app-btn-ghost" disabled={!!exporting} onClick={() => void exportCatalog("EXCEL")}><Download size={14} />{exporting === "EXCEL" ? "Generando…" : "Excel"}</button><button type="button" className="nf-app-btn-ghost" disabled={!!exporting} onClick={() => void exportCatalog("PDF")}><Download size={14} />{exporting === "PDF" ? "Generando…" : "PDF"}</button></>}
      </div>
      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 10 }}>{filtered.length} controles · catálogo ISO 27001 versión {initial.catalogVersion?.version ?? "—"}</div>
      <div className="nf-data-table-wrap"><table className="nf-data-table" style={{ minWidth: 980 }}><thead><tr><th>Control</th><th>Dominio</th><th>Aplicabilidad</th><th>Estado</th><th>Implementación</th><th>Responsable</th><th>Próxima revisión</th><th>Evidencias</th><th>Riesgos</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => setSelected(row)} style={{ cursor: "pointer" }}><td><strong>{row.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{row.title}</div></td><td>{DOMAIN_LABEL[row.domain]}</td><td><Badge value={APPLICABILITY_LABEL[row.applicability]} tone={row.applicability === "INCLUDED" ? "green" : row.applicability === "EXCLUDED" ? "gray" : "amber"} /></td><td><Badge value={STATUS_LABEL[row.status]} tone={row.status === "EFFECTIVE" ? "green" : row.status === "NOT_EFFECTIVE" ? "red" : "blue"} /></td><td><div style={{ minWidth: 110 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>{row.implementationLevel}%</span><span>{row.status === "EFFECTIVE" ? "✓" : ""}</span></div><div style={{ height: 6, background: "#edf0f5", borderRadius: 9, marginTop: 4 }}><div style={{ width: `${row.implementationLevel}%`, height: "100%", background: row.status === "EFFECTIVE" ? "#15803D" : "#5266F6", borderRadius: 9 }} /></div></div></td><td>{row.responsible?.name ?? "—"}</td><td>{row.nextReviewDate ?? "—"}</td><td>{row.evidence.length}</td><td>{row.risks.length}</td></tr>)}</tbody></table>{!filtered.length && <div className="nf-data-table-empty">No hay controles para los filtros seleccionados.</div>}</div>
    </Card>
    {selected && <ControlDetail row={selected} initial={initial} canUpdate={initial.canUpdate} canApprove={initial.canApprove} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function ControlDetail({ row, initial, canUpdate, canApprove, pending, onClose, onRun }: { row: Row; initial: SecurityControlsPayload; canUpdate: boolean; canApprove: boolean; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [localStatus, setLocalStatus] = useState(row.status);
  const [level, setLevel] = useState(row.implementationLevel);
  const [app, setApp] = useState(row.applicability);
  const [responsibleId, setResponsibleId] = useState(row.responsible?.id ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [review, setReview] = useState("CONFORMING");
  const [effectiveness, setEffectiveness] = useState("EFFECTIVE");
  const [evidenceId, setEvidenceId] = useState(initial.evidenceOptions[0]?.id ?? "");
  const [riskId, setRiskId] = useState(initial.riskOptions[0]?.id ?? "");

  return (
    <div className="nf-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nf-modal" style={{ maxWidth: 760, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
        <div className="nf-modal-header"><div><h3>{row.code} · {row.title}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>{DOMAIN_LABEL[row.domain]} · objetivo operativo propio NormaFlow</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
        <div style={{ display: "grid", gap: 16, padding: 20 }}>
          <div style={{ padding: 12, borderRadius: 10, background: "var(--nf-app-surface-2)", fontSize: 13 }}>{row.descriptionInternal}<br /><strong>Objetivo:</strong> {row.objective}</div>
          {canUpdate && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label>Aplicabilidad<select className="nf-app-input" value={app} onChange={(event) => setApp(event.target.value as typeof app)}>{Object.entries(APPLICABILITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Estado<select className="nf-app-input" value={localStatus} onChange={(event) => setLocalStatus(event.target.value as typeof localStatus)}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Implementación (%)<input className="nf-app-input" type="number" min={0} max={100} value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label>
            </div>
            <label>Responsable<select className="nf-app-input" value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)}><option value="">Sin asignar</option>{initial.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Notas<textarea className="nf-app-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => updateOrganizationControl({ id: row.id, applicability: app, status: localStatus, implementationLevel: level, responsibleId: responsibleId || null, reviewDate: new Date().toISOString().slice(0, 10), nextReviewDate: null, notes }))}>Guardar evaluación</button>
          </>}
          {canUpdate && <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}><h4>Vincular trazabilidad</h4><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select className="nf-app-input" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}><option value="">Evidencia…</option>{initial.evidenceOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={pending || !evidenceId} onClick={() => onRun(() => linkControlEvidence({ organizationControlId: row.id, evidenceId, period: new Date().toISOString().slice(0, 7) }))}><Link2 size={14} /> Vincular evidencia</button><select className="nf-app-input" value={riskId} onChange={(event) => setRiskId(event.target.value)}><option value="">Riesgo…</option>{initial.riskOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={pending || !riskId} onClick={() => onRun(() => linkRiskToSecurityControl({ organizationControlId: row.id, riskId, purpose: "Tratamiento del riesgo relacionado" }))}><Link2 size={14} /> Vincular riesgo</button></div></div>}
          {canApprove && <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14 }}><h4>Revisión de eficacia</h4><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select className="nf-app-input" value={review} onChange={(event) => setReview(event.target.value)}><option value="CONFORMING">Conforme</option><option value="PARTIALLY_CONFORMING">Parcial</option><option value="NONCONFORMING">No conforme</option></select><select className="nf-app-input" value={effectiveness} onChange={(event) => setEffectiveness(event.target.value)}><option value="EFFECTIVE">Efectivo</option><option value="INEFFECTIVE">No efectivo</option><option value="NOT_TESTED">No probado</option></select><button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => reviewSecurityControl({ organizationControlId: row.id, result: review, effectiveness, comments: "Revisión registrada desde el catálogo operativo." }))}><ShieldCheck size={14} /> Registrar revisión</button></div></div>}
          <div><h4>Historial reciente</h4>{row.reviews.length ? row.reviews.map((item) => <div key={item.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--nf-line)", fontSize: 12 }}>{item.reviewedAt.slice(0, 10)} · {item.result} · {item.effectiveness} · {item.reviewer.name}</div>) : <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Sin revisiones todavía.</span>}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<select className="nf-app-input" value={value} onChange={(event) => onChange(event.target.value)} style={{ marginTop: 3 }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>; }
