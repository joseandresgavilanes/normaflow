"use client";
import { useState } from "react";
import { CalendarRange, FileDown, FileStack, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { exportReport } from "@/lib/actions/reporting";
import type { ReportingPayload } from "@/lib/server-queries";

const REPORTS = [
  { id: "exec", title: "Ejecutivo — salud del sistema", desc: "Readiness, formación, cambios y acciones críticas.", accent: "#5266F6" },
  { id: "iso", title: "Cumplimiento por norma", desc: "Normas activas, versión y porcentaje de avance.", accent: "#16A34A" },
  { id: "site", title: "Por sede", desc: "Sedes activas y documentos asociados.", accent: "#6B3FB5" },
  { id: "capa", title: "CAPA y NC", desc: "Estado, eficacia y antigüedad.", accent: "#DC2626" },
  { id: "train", title: "Training compliance", desc: "Asignaciones, vencidos y reacreditaciones.", accent: "#D97706" },
  { id: "changes", title: "Cambios abiertos", desc: "Pipeline de control de cambios.", accent: "#5266F6" },
  { id: "auditpack", title: "Resumen de auditoría", desc: "Auditorías, hallazgos, NC, checklist e informe asociado.", accent: "#5266F6" },
];

function today() { return new Date().toISOString().slice(0, 10); }
function yearStart() { return `${new Date().getUTCFullYear()}-01-01`; }

export default function ReportingModule({ liveData }: { liveData?: ReportingPayload }) {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
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

  function download(base64: string, mimeType: string, fileName: string) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function runExport(reportId: string, title: string, format: "PDF" | "EXCEL" | "CSV") {
    if (live) {
      setBusy(`${reportId}-${format}`);
      void exportReport({ reportId, title, format, from, to }).then(result => {
        download(result.base64, result.mimeType, result.fileName);
        showToast(`Informe generado · ${result.rowCount} filas`);
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
          reason: `Rango ${from} — ${to} · Exportación demo (${format})`,
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
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink-2)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>PDF / Excel / CSV</div>
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
                <button
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
                </button>
                <button type="button" disabled={!!busy} className="nf-app-btn-outline" onClick={() => runExport(r.id, r.title, "EXCEL")}>
                  Excel
                </button>
                <button type="button" disabled={!!busy} className="nf-app-btn-outline" onClick={() => runExport(r.id, r.title, "CSV")}>
                  CSV
                </button>
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
              <span className="nf-chip nf-chip--on">{item.format} · {item.rowCount} filas</span>
            </div>
          )) : <p className="nf-app-help" style={{ padding: 18, margin: 0, color: "var(--nf-ink-2, #223648)" }}>Todavía no se generaron informes.</p>}
        </Card>
      </div>}
    </div>
  );
}
