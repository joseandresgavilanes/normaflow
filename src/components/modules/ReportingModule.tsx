"use client";
import { useState } from "react";
import { CalendarRange, FileDown, FileStack, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

const REPORTS = [
  { id: "exec", title: "Ejecutivo — salud del sistema", desc: "Readiness, formación, cambios y acciones críticas.", accent: "#123C66" },
  { id: "iso", title: "Cumplimiento por norma", desc: "ISO 9001 / 27001 — GAP, documentos y auditorías.", accent: "#2E8B57" },
  { id: "site", title: "Por sede y área", desc: "Riesgos, proveedores y hallazgos agregados.", accent: "#6B3FB5" },
  { id: "capa", title: "CAPA y NC", desc: "Estado, eficacia y antigüedad.", accent: "#C93C37" },
  { id: "train", title: "Training compliance", desc: "Asignaciones, vencidos y reacreditaciones.", accent: "#D68A1A" },
  { id: "changes", title: "Cambios abiertos", desc: "Pipeline de control de cambios.", accent: "#123C66" },
  { id: "auditpack", title: "Audit evidence pack", desc: "Paquete ZIP/PDF simulado para auditor externo.", accent: "#1a5490" },
];

export default function ReportingModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-04-30");
  const [busy, setBusy] = useState<string | null>(null);

  if (!perm.reporting.use) {
    return (
      <Card style={{ padding: 32, textAlign: "center" }}>
        <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
          Su rol no incluye acceso a informes. Solicite permiso a administración.
        </p>
      </Card>
    );
  }

  function exportMock(reportId: string, title: string) {
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
          reason: `Rango ${from} — ${to} · Exportación simulada (PDF/Excel/CSV)`,
        }),
      });
      showToast(`Generado: ${title} (simulado) — registro creado en trazabilidad`);
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
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.16) 0%, rgba(18, 60, 102, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <FileStack size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#123C66", letterSpacing: "-0.03em", lineHeight: 1 }}>{REPORTS.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Plantillas de informe</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{from}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha desde</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.2) 0%, rgba(214, 138, 26, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{to}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha hasta</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(107, 63, 181, 0.16) 0%, rgba(107, 63, 181, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5a348f",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--nf-ink-2)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>PDF / Excel / CSV</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Formatos simulados</div>
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
          Los formatos se simulan en esta fase; el registro de exportación es operativo para demostrar trazabilidad.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        {REPORTS.map(r => (
          <Card key={r.id} style={{ padding: 0, overflow: "hidden", borderRadius: 14, border: "1px solid var(--nf-line)", boxShadow: "0 14px 40px -28px rgba(18, 60, 102, 0.2)" }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${r.accent}, ${r.accent}99)` }} />
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
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>{r.title}</h3>
              <p className="nf-app-help" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                {r.desc}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => exportMock(r.id, r.title)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(180deg, #154a7a 0%, #123c66 100%)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.7 : 1,
                    boxShadow: "0 1px 2px rgba(15, 50, 85, 0.2)",
                  }}
                >
                  {busy === r.id ? "Generando…" : "Exportar PDF"}
                </button>
                <button type="button" disabled={!!busy} className="nf-app-btn-outline" onClick={() => exportMock(`${r.id}-xlsx`, `${r.title} (Excel)`)}>
                  Excel
                </button>
                <button type="button" disabled={!!busy} className="nf-app-btn-outline" onClick={() => exportMock(`${r.id}-csv`, `${r.title} (CSV)`)}>
                  CSV
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
