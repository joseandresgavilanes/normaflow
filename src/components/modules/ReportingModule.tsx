"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

const REPORTS = [
  { id: "exec", title: "Ejecutivo — salud del sistema", desc: "Readiness, formación, cambios y acciones críticas." },
  { id: "iso", title: "Cumplimiento por norma", desc: "ISO 9001 / 27001 — GAP, documentos y auditorías." },
  { id: "site", title: "Por sede y área", desc: "Riesgos, proveedores y hallazgos agregados." },
  { id: "capa", title: "CAPA y NC", desc: "Estado, eficacia y antigüedad." },
  { id: "train", title: "Training compliance", desc: "Asignaciones, vencidos y reacreditaciones." },
  { id: "changes", title: "Cambios abiertos", desc: "Pipeline de control de cambios." },
  { id: "auditpack", title: "Audit evidence pack", desc: "Paquete ZIP/PDF simulado para auditor externo." },
];

export default function ReportingModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-04-30");
  const [busy, setBusy] = useState<string | null>(null);

  if (!perm.reporting.use) {
    return (
      <Card style={{ padding: 32, textAlign: "center", color: "#5E6B7A" }}>
        Su rol no incluye acceso a informes. Solicite permiso a administración.
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

      <Card style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#142033", display: "block", marginBottom: 6 }}>Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #E5EAF2" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#142033", display: "block", marginBottom: 6 }}>Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #E5EAF2" }} />
        </div>
        <p style={{ fontSize: 12, color: "#5E6B7A", margin: 0, flex: 1, minWidth: 200 }}>
          Los formatos PDF, Excel y CSV se simulan en esta fase; el registro de exportación es operativo para demostrar trazabilidad.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
        {REPORTS.map(r => (
          <Card key={r.id}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#142033" }}>{r.title}</h3>
            <p style={{ fontSize: 13, color: "#5E6B7A", margin: "0 0 14px", lineHeight: 1.5 }}>{r.desc}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => exportMock(r.id, r.title)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#123C66",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy === r.id ? "Generando…" : "Exportar PDF"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => exportMock(`${r.id}-xlsx`, `${r.title} (Excel)`)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5EAF2", background: "#fff", fontSize: 12, cursor: "pointer" }}
              >
                Excel
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => exportMock(`${r.id}-csv`, `${r.title} (CSV)`)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5EAF2", background: "#fff", fontSize: 12, cursor: "pointer" }}
              >
                CSV
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
