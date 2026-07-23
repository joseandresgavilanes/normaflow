"use client";
import { useState } from "react";
import { CalendarRange, FileDown, FileStack, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { downloadReportExport, exportReport, getReportExportStatus } from "@/lib/actions/reporting";
import type { ReportFilters } from "@/lib/reporting-contract";
import type { ReportingPayload } from "@/lib/server-queries";

const REPORTS = [
  { id: "gap", title: "Informe GAP Assessment", desc: "Brechas, score y estado por cláusula ISO.", accent: "#5266F6", formats: ["PDF", "EXCEL"] },
  { id: "documents", title: "Matriz documental", desc: "Documentos, versiones, responsables y estado.", accent: "#16A34A", formats: ["PDF", "EXCEL"] },
  { id: "risks", title: "Matriz de riesgos", desc: "Probabilidad, impacto, tratamiento y vencimientos.", accent: "#DC2626", formats: ["PDF", "EXCEL"] },
  { id: "audit-program", title: "Programa anual de auditorías", desc: "Auditorías planificadas por proceso y norma.", accent: "#6B3FB5", formats: ["PDF", "EXCEL"] },
  { id: "audit", title: "Informe de auditoría interna", desc: "Auditorías, checklist, hallazgos e informe.", accent: "#5266F6", formats: ["PDF", "EXCEL"] },
  { id: "capa", title: "Matriz de NC y CAPA", desc: "No conformidades, etapas, responsables y eficacia.", accent: "#DC2626", formats: ["PDF", "EXCEL"] },
  { id: "actions", title: "Plan de acción", desc: "Acciones derivadas, prioridades y avances.", accent: "#D97706", formats: ["PDF", "EXCEL"] },
  { id: "indicators", title: "Matriz de indicadores / KPIs", desc: "Objetivos, tendencia reciente y estado.", accent: "#16A34A", formats: ["PDF", "EXCEL"] },
  { id: "evidence", title: "Índice de evidencias", desc: "Evidencias, responsables, vigencia y cláusulas.", accent: "#6B3FB5", formats: ["PDF", "EXCEL"] },
  { id: "management-review", title: "Acta de revisión por la dirección", desc: "Entradas, decisiones, acciones y conclusiones.", accent: "#5266F6", formats: ["PDF"] },
  { id: "audit-package", title: "Paquete completo de auditoría", desc: "Compendio GAP, documentos, riesgos, auditoría, CAPA, KPIs y evidencias.", accent: "#0F766E", formats: ["PDF", "EXCEL"] },
];

function today() { return new Date().toISOString().slice(0, 10); }
function yearStart() { return `${new Date().getUTCFullYear()}-01-01`; }

export default function ReportingModule({ liveData }: { liveData?: ReportingPayload }) {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [standardCode, setStandardCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const live = liveData !== undefined;

  if (!live && !perm.reporting.use) {
    return (
      <Card style={{ padding: 32, textAlign: "center" }}>
        <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
          Su rol no incluye acceso a informes. Solicite permiso a administración.
        </p>
      </Card>
    );
  }

  function download(url: string, fileName: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  }

  async function waitForArtifact(id: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await getReportExportStatus(id);
      if (status.status === "COMPLETED") {
        const artifact = await downloadReportExport(id);
        download(artifact.url, artifact.fileName);
        return artifact;
      }
      if (status.status === "FAILED") throw new Error(status.error ?? "El worker no pudo generar el informe.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("El informe sigue en cola. Puedes descargarlo desde el historial cuando termine.");
  }

  function runExport(reportId: string, title: string, format: "PDF" | "EXCEL") {
    if (live) {
      setBusy(`${reportId}-${format}`);
      const filters: ReportFilters = { from, to, standardCode: standardCode || undefined, status: status || undefined };
      void exportReport({ reportId, title, format, filters }).then(async result => {
        if (result.status === "COMPLETED") {
          const artifact = await downloadReportExport(result.id);
          download(artifact.url, artifact.fileName);
          showToast(`Informe descargado · ${artifact.rowCount} filas`);
          return;
        }
        showToast("Informe en cola. Se descargará cuando finalice el worker.");
        const artifact = await waitForArtifact(result.id);
        showToast(`Informe descargado · ${artifact.rowCount} filas`);
      }).catch(error => showToast(error instanceof Error ? error.message : "No se pudo generar el informe")).finally(() => setBusy(null));
      return;
    }
    setBusy(reportId);
    setTimeout(() => {
      dispatch({
        type: "appendAudit",
        event: createAuditEvent({
          ts: new Date().toISOString(),
          actorName: state.session.name,
          actorEmail: state.session.email,
          action: AUDIT_ACTIONS.REPORT_EXPORTED,
          entityType: "REPORT",
          entityId: reportId,
          entityLabel: title,
          reason: `Rango ${from} — ${to} · Norma ${standardCode || "todas"} · Estado ${status || "todos"} · Exportación demo (${format})`,
        }),
      });
      showToast(`Generado: ${title} (${format}, demo)`);
      setBusy(null);
    }, 900);
  }

  return (
    <div>
      <SectionTitle title="Informes y paquetes de auditoría" sub="Exportaciones trazables · listas para comité o auditor externo" />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5266F6",
            }}
          >
            <FileStack size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#5266F6", letterSpacing: "-0.03em", lineHeight: 1 }}>{REPORTS.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Plantillas de informe</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#F0FDF4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{from}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha desde</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FFFBEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{to}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha hasta</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#F5F3FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5a348f",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink-2)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>PDF / XLSX</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>{live ? "Exportación real" : "Modo demo"}</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 22, padding: "18px 20px" }}>
        <div className="nf-grid-2" style={{ gap: 16, alignItems: "flex-end" }}>
          <label style={{ display: "block" }}>
            <span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
              Desde
            </span>
            <input type="date" className="nf-app-input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </label>
          {live && <label style={{ display: "block" }}><span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>Norma</span><select className="nf-app-input" value={standardCode} onChange={e => setStandardCode(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}><option value="">Todas las normas</option>{liveData.standards.map(item => <option key={item.standard.code} value={item.standard.code}>{item.standard.code} · {item.standard.name}</option>)}</select></label>}
          {live && <label style={{ display: "block" }}><span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>Estado</span><select className="nf-app-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}><option value="">Todos los estados</option><option value="COMPLETED">Completado</option><option value="IN_PROGRESS">En curso</option><option value="PENDING">Pendiente</option><option value="OPEN">Abierto</option><option value="APPROVED">Aprobado</option></select></label>}
          <label style={{ display: "block" }}>
            <span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
              Hasta
            </span>
            <input type="date" className="nf-app-input" value={to} onChange={e => setTo(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </label>
        </div>
        <p className="nf-app-help" style={{ margin: "14px 0 0", lineHeight: 1.55 }}>
          {live ? "Cada exportación consulta datos del tenant, descarga el archivo y registra quién la generó en la trazabilidad." : "Las descargas se simulan únicamente en el espacio demo."}
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        {REPORTS.map(r => (
          <Card key={r.id} style={{ padding: 0, overflow: "hidden", borderRadius: 14, border: "1px solid var(--nf-line)", boxShadow: "none" }}>
            
            <div style={{ padding: "16px 18px 18px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${r.accent}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: r.accent,
                  marginBottom: 12,
                }}
              >
                <FileDown size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>{r.title}</h3>
              <p className="nf-app-help" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                {r.desc}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {live && !liveData.canExport ? <span className="nf-app-help">Sin permiso de exportación</span> : <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => runExport(r.id, r.title, "PDF")}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--nf-app-accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.7 : 1,
                    boxShadow: "0 1px 2px rgba(15, 50, 85, 0.2)",
                  }}
                >
                  {busy === `${r.id}-PDF` || busy === r.id ? "Generando…" : "Exportar PDF"}
                </button>}
                {r.formats.includes("EXCEL") && <button type="button" disabled={!!busy || (live && !liveData.canExport)} className="nf-app-btn-outline" onClick={() => runExport(r.id, r.title, "EXCEL")}>XLSX</button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {live && <div style={{ marginTop: 26 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12, fontWeight: 600, color: "var(--nf-ink, #0f1b2d)", letterSpacing: "-0.02em" }}>Historial de exportaciones</h3>
        <Card style={{ padding: 0, overflow: "hidden" }} className="nf-export-history">
          {liveData.exports.length ? liveData.exports.map((item, index) => (
            <div
              key={item.id}
              className="nf-export-history-row"
              style={{
                padding: "12px 16px",
                borderBottom: index < liveData.exports.length - 1 ? "1px solid var(--nf-line, #b8c8d9)" : "none",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "var(--nf-ink, #0f1b2d)", fontWeight: 700, fontSize: 14, wordBreak: "break-all" }}>{item.fileName}</strong>
                <div className="nf-app-help" style={{ marginTop: 4, color: "var(--nf-ink-2, #223648)" }}>{item.generatedBy} · {new Date(item.createdAt).toLocaleString("es-ES")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className="nf-chip nf-chip--on">{item.format} · {item.rowCount} filas · {item.status}</span>{item.hasContent && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => { setBusy(`download-${item.id}`); void downloadReportExport(item.id).then(result => download(result.url, result.fileName)).catch(error => showToast(error instanceof Error ? error.message : "No se pudo descargar el informe")).finally(() => setBusy(null)); }}>{busy === `download-${item.id}` ? "Descargando…" : "Descargar"}</button>}</div>
              {item.status === "FAILED" && item.error && <p style={{ margin: 0, color: "var(--nf-danger, #b42318)", fontSize: 12 }}>Error: {item.error}</p>}
            </div>
          )) : <p className="nf-app-help" style={{ padding: 18, margin: 0, color: "var(--nf-ink-2, #223648)" }}>Todavía no se generaron informes.</p>}
        </Card>
      </div>}
    </div>
  );
}
