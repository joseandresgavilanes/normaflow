"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileCheck2, FilePlus2, Search, Send, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionTitle from "@/components/ui/SectionTitle";
import { useServerAction } from "@/hooks/useServerAction";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { approveSoA, createSoADraft, exportSoA, submitSoAForReview, updateSoAEntry, type SoAPayload } from "@/lib/actions/soa";

const DOMAIN_LABEL: Record<string, string> = { ORGANIZATIONAL: "A.5 Organizacionales", PEOPLE: "A.6 Personas", PHYSICAL: "A.7 Físicos", TECHNOLOGICAL: "A.8 Tecnológicos" };
const STATUS_LABEL: Record<string, string> = { NOT_ASSESSED: "Sin evaluar", NOT_IMPLEMENTED: "No implementado", PLANNED: "Planificado", PARTIALLY_IMPLEMENTED: "Parcial", IMPLEMENTED: "Implementado", EFFECTIVE: "Efectivo", NOT_EFFECTIVE: "No efectivo" };
const APPLICABILITY_LABEL: Record<string, string> = { INCLUDED: "Incluido", EXCLUDED: "Excluido", UNDER_REVIEW: "En revisión" };
const SOA_STATUS_LABEL: Record<string, string> = { DRAFT: "Borrador", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", SUPERSEDED: "Reemplazada" };
const REPORT_LABEL: Record<string, string> = { "soa": "Declaración completa", "excluded-controls": "Controles excluidos", "pending-controls": "Controles pendientes", "control-evidence": "Evidencias por control" };

type Entry = SoAPayload["entries"][number];

export default function SoALiveClient({ initial }: { initial: SoAPayload }) {
  const { run, isPending, error, success } = useServerAction();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [applicability, setApplicability] = useState("ALL");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [reportType, setReportType] = useState("soa");
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => initial.entries.filter((row) => {
    if (domain !== "ALL" && row.domain !== domain) return false;
    if (applicability !== "ALL" && row.applicability !== applicability) return false;
    const term = query.trim().toLowerCase();
    return !term || `${row.code} ${row.title} ${row.responsible?.name ?? ""}`.toLowerCase().includes(term);
  }), [initial.entries, query, domain, applicability]);

  async function exportReport(format: "PDF" | "EXCEL") {
    setExporting(true);
    try {
      const result = await exportSoA({ reportType: reportType as never, format });
      await downloadQueuedReport(result.id);
    } finally { setExporting(false); }
  }

  const current = initial.current;
  const editable = current?.editable ?? false;

  const columns = useMemo<DataTableColumn<Entry>[]>(() => [
    { id: "code", header: "Control", primary: true, minWidth: 200, hideable: false, sortValue: (r) => r.code,
      cell: (r) => <><strong>{r.code}</strong><div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>{r.title}</div></> },
    { id: "domain", header: "Dominio", minWidth: 150, sortValue: (r) => r.domain, cell: (r) => DOMAIN_LABEL[r.domain] },
    { id: "applicability", header: "Aplicabilidad", minWidth: 130, sortValue: (r) => r.applicability,
      cell: (r) => <Badge value={APPLICABILITY_LABEL[r.applicability]} tone={r.applicability === "INCLUDED" ? "green" : r.applicability === "EXCLUDED" ? "gray" : "amber"} /> },
    { id: "justification", header: "Justificación", minWidth: 220, sortValue: (r) => r.justification ?? "",
      cell: (r) => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{r.applicability === "EXCLUDED" ? (r.justification || <span style={{ color: "#B91C1C" }}>Falta justificación</span>) : "—"}</span> },
    { id: "implementation", header: "Implementación", minWidth: 140, sortValue: (r) => r.implementationStatus,
      cell: (r) => <Badge value={STATUS_LABEL[r.implementationStatus]} tone={r.implementationStatus === "EFFECTIVE" ? "green" : r.implementationStatus === "NOT_EFFECTIVE" ? "red" : "blue"} /> },
    { id: "owner", header: "Responsable", minWidth: 140, sortValue: (r) => r.responsible?.name ?? "", cell: (r) => r.responsible?.name ?? "—" },
    { id: "risk", header: "Riesgo", minWidth: 120, sortValue: (r) => r.relatedRiskItem?.reference ?? "", cell: (r) => r.relatedRiskItem?.reference ?? "—" },
  ], []);

  return <div>
    <SectionTitle title="Declaración de Aplicabilidad (SoA)" sub="Declaración versionada del Anexo A ISO 27001: inclusión/exclusión justificada, estado, riesgo y evidencia de cada control." />
    {error && <div className="nf-alert nf-alert--error">{error}</div>}
    {success && <div className="nf-alert nf-alert--success">{success}</div>}

    {!current && <Card><div style={{ textAlign: "center", padding: 30 }}>
      <FileCheck2 size={34} style={{ color: "#5266F6" }} />
      <h3 style={{ margin: "12px 0 6px" }}>Aún no hay una Declaración de Aplicabilidad</h3>
      <p style={{ fontSize: 13, color: "var(--nf-ink-3)", maxWidth: 520, margin: "0 auto 16px" }}>Genera la primera versión: se crearán automáticamente las entradas de los {initial.catalogVersion?.version ? "93" : "93"} controles del catálogo ISO 27001, prellenadas con el estado operativo actual.</p>
      {initial.canCreate && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => run(() => createSoADraft({}))}><FilePlus2 size={15} /> Crear SoA v1 (93 controles)</button>}
    </div></Card>}

    {current && <>
      <div className="nf-metric-strip">
        <Metric label="Controles" value={initial.summary.total} icon={<ShieldCheck size={19} />} />
        <Metric label="Incluidos" value={initial.summary.included} icon={<CheckCircle2 size={19} />} color="#15803D" />
        <Metric label="Excluidos" value={initial.summary.excluded} icon={<FileCheck2 size={19} />} color="#667085" />
        <Metric label="Pendientes" value={initial.summary.pending} icon={<Search size={19} />} color="#B45309" />
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <strong style={{ fontSize: 15 }}>Versión {current.version}</strong>
            <Badge value={SOA_STATUS_LABEL[current.status]} tone={current.status === "APPROVED" ? "green" : current.status === "SUPERSEDED" ? "gray" : current.status === "UNDER_REVIEW" ? "amber" : "blue"} />
            {current.approvedAt && <span style={{ fontSize: 12, color: "var(--nf-ink-3)", marginLeft: 8 }}>Aprobada {current.approvedAt.slice(0, 10)} · {current.approver?.name ?? ""}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {initial.canUpdate && current.status === "DRAFT" && <button type="button" className="nf-app-btn-ghost" disabled={isPending} onClick={() => run(() => submitSoAForReview({ id: current.id }), { successMessage: "Enviada a revisión." })}><Send size={14} /> Enviar a revisión</button>}
            {initial.canApprove && editable && <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => run(() => approveSoA({ id: current.id }), { successMessage: "SoA aprobada." })}><CheckCircle2 size={14} /> Aprobar</button>}
            {initial.canCreate && !editable && <button type="button" className="nf-app-btn-ghost" disabled={isPending} onClick={() => run(() => createSoADraft({ scope: current.scope ?? undefined }), { successMessage: "Nueva versión creada." })}><FilePlus2 size={14} /> Nueva versión</button>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--nf-ink-3)" }} /><input aria-label="Buscar código, título o responsable" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, título o responsable…" className="nf-app-input" style={{ paddingLeft: 32 }} /></div>
          <Filter label="Dominio" value={domain} onChange={setDomain} options={["ALL", "ORGANIZATIONAL", "PEOPLE", "PHYSICAL", "TECHNOLOGICAL"].map((v) => ({ value: v, label: v === "ALL" ? "Todos" : DOMAIN_LABEL[v] }))} />
          <Filter label="Aplicabilidad" value={applicability} onChange={setApplicability} options={[{ value: "ALL", label: "Todas" }, ...Object.entries(APPLICABILITY_LABEL).map(([value, label]) => ({ value, label }))]} />
          {initial.canExport && <><select aria-label="Tipo de informe" className="nf-app-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ maxWidth: 190 }}>{Object.entries(REPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("EXCEL")}><Download size={14} />Excel</button><button type="button" className="nf-app-btn-ghost" disabled={exporting} onClick={() => void exportReport("PDF")}><Download size={14} />PDF</button></>}
        </div>

        <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 10 }}>{filtered.length} de {initial.summary.total} controles · catálogo ISO 27001 v{initial.catalogVersion?.version ?? "—"}</div>
          <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          /* La fila solo abre el editor si la declaración es editable y hay
             permiso: se conserva exactamente la condición anterior. */
          rowAction={editable && initial.canUpdate ? (r) => setSelected(r) : undefined}
          caption="Declaración de aplicabilidad: control, dominio, aplicabilidad, justificación de exclusión, estado de implementación, responsable y riesgo relacionado."
          storageKey="soa"
          empty={<EmptyState kind="no-results" title="No hay entradas para los filtros seleccionados." description="La declaración de aplicabilidad justifica, control a control, por qué se incluye o se excluye del alcance." />}
        />
        {!editable && <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 10 }}>Esta versión está {SOA_STATUS_LABEL[current.status].toLowerCase()} y es inmutable. Crea una nueva versión para introducir cambios.</div>}
      </Card>
    </>}

    {selected && current && <EntryDetail row={selected} initial={initial} pending={isPending} onClose={() => setSelected(null)} onRun={run} />}
  </div>;
}

function EntryDetail({ row, initial, pending, onClose, onRun }: { row: Entry; initial: SoAPayload; pending: boolean; onClose: () => void; onRun: ReturnType<typeof useServerAction>["run"] }) {
  const [app, setApp] = useState(row.applicability);
  const [justification, setJustification] = useState(row.justification ?? "");
  const [status, setStatus] = useState(row.implementationStatus);
  const [responsibleId, setResponsibleId] = useState(row.responsible?.id ?? "");
  const [evidenceId, setEvidenceId] = useState(initial.evidenceOptions.find((e) => e.id === row.evidence?.id)?.id ?? "");
  const [riskItemId, setRiskItemId] = useState(row.relatedRiskItem?.id ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");

  return (
    <div className="nf-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nf-modal" style={{ maxWidth: 680, width: "calc(100% - 32px)", maxHeight: "90vh", overflow: "auto" }}>
        <div className="nf-modal-header"><div><h3>{row.code} · {row.title}</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--nf-ink-3)" }}>{DOMAIN_LABEL[row.domain]}</p></div><button type="button" className="nf-app-btn-ghost" onClick={onClose}>Cerrar</button></div>
        <div style={{ display: "grid", gap: 14, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>Aplicabilidad<select className="nf-app-input" value={app} onChange={(e) => setApp(e.target.value as typeof app)}>{Object.entries(APPLICABILITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Estado de implementación<select className="nf-app-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label>Justificación {app === "EXCLUDED" && <span style={{ color: "#B91C1C" }}>· obligatoria para exclusiones</span>}<textarea className="nf-app-input" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={app === "EXCLUDED" ? "Motivo de la exclusión del control…" : "Justificación de la decisión de aplicabilidad…"} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>Responsable<select className="nf-app-input" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="">Sin asignar</option>{initial.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>Riesgo relacionado<select className="nf-app-input" value={riskItemId} onChange={(e) => setRiskItemId(e.target.value)}><option value="">Ninguno</option>{initial.riskItemOptions.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.title}</option>)}</select></label>
          </div>
          <label>Evidencia<select className="nf-app-input" value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}><option value="">Sin evidencia</option>{initial.evidenceOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
          <label>Notas<textarea className="nf-app-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button type="button" className="nf-app-btn-primary" disabled={pending} onClick={() => onRun(() => updateSoAEntry({ id: row.id, applicability: app, justification: justification || undefined, implementationStatus: status, responsibleId: responsibleId || null, evidenceId: evidenceId || null, relatedRiskItemId: riskItemId || null, reviewDate: new Date().toISOString().slice(0, 10), notes: notes || undefined }), { onSuccess: onClose })}>Guardar entrada</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, color = "#5266F6" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) { return <div className="nf-metric-cell"><div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>{icon}</div><div className="nf-metric-cell-body"><div className="nf-metric-cell-value" style={{ color }}>{value}</div><div className="nf-metric-cell-label">{label}</div></div></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{label}<select className="nf-app-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 3 }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function Badge({ value, tone }: { value: string; tone: "green" | "gray" | "amber" | "red" | "blue" }) { const colors = { green: ["#15803D", "#e8f5ee"], gray: ["#667085", "#f1f3f5"], amber: ["#B45309", "#fff8e6"], red: ["#B91C1C", "#fff0f0"], blue: ["#5266F6", "#eef0ff"] } as const; const [color, background] = colors[tone]; return <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color, background, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 8 }}>{value}</span>; }
