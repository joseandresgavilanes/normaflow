"use client";
import Link from "next/link";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace, type SupplierRow } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { formatDate } from "@/lib/utils";

export default function SuppliersModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { suppliers, auditEvents, risks, documents } = state;
  const [detail, setDetail] = useState<SupplierRow | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const rows = filter === "ALL" ? suppliers : suppliers.filter(s => s.criticality === filter || s.status === filter);
  const detailLive = detail ? suppliers.find(s => s.id === detail.id) ?? detail : null;
  const supEvents = auditEvents.filter(e => e.entityType === "SUPPLIER" || (e.entityLabel?.startsWith("PRV") ?? false));

  function bumpReview(s: SupplierRow) {
    if (!perm.suppliers.manage) return;
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    dispatch({ type: "updateSupplier", id: s.id, patch: { nextReviewDue: d.toISOString().slice(0, 10), lastEvaluationAt: new Date().toISOString().slice(0, 10) } });
    showToast("Próxima revisión reprogramada (+6 meses)");
    setDetail(prev => (prev?.id === s.id ? { ...prev, nextReviewDue: d.toISOString().slice(0, 10) } : prev));
  }

  return (
    <div>
      <SectionTitle title="Proveedores y contratistas" sub="Criticidad, revisiones, riesgos, documentos y evidencias" />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${filter === f ? "#123C66" : "#E5EAF2"}`,
              background: filter === f ? "#123C6615" : "#fff",
              fontSize: 12,
              cursor: "pointer",
              color: filter === f ? "#123C66" : "#5E6B7A",
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f === "ALL" ? "Todos" : f}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F9FC", textAlign: "left", color: "#5E6B7A", fontSize: 12 }}>
              <th style={{ padding: 12 }}>Código</th>
              <th style={{ padding: 12 }}>Proveedor</th>
              <th style={{ padding: 12 }}>Criticidad</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Dueño</th>
              <th style={{ padding: 12 }}>Próx. revisión</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} style={{ borderTop: "1px solid #E5EAF2", cursor: "pointer" }} onClick={() => setDetail(s)}>
                <td style={{ padding: 12, fontWeight: 700, color: "#123C66" }}>{s.code}</td>
                <td style={{ padding: 12 }}>{s.name}</td>
                <td style={{ padding: 12 }}>
                  <Badge status={s.criticality === "CRITICAL" ? "OFF_TRACK" : s.criticality === "HIGH" ? "AT_RISK" : "ON_TRACK"} label={s.criticality} />
                </td>
                <td style={{ padding: 12 }}>
                  <Badge status={s.status === "APPROVED" ? "ON_TRACK" : "AT_RISK"} label={s.status} />
                </td>
                <td style={{ padding: 12, color: "#5E6B7A" }}>{s.owner}</td>
                <td style={{ padding: 12 }}>{formatDate(s.nextReviewDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!detailLive} onClose={() => setDetail(null)} title={detailLive?.name ?? ""} width={600}>
        {detailLive && (
          <div>
            <p style={{ fontSize: 13, color: "#5E6B7A" }}>
              Categoría: {detailLive.category} · Código {detailLive.code}
            </p>
            <div style={{ margin: "16px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Riesgos vinculados</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detailLive.riskCodes.length === 0 ? (
                  <span style={{ color: "#5E6B7A", fontSize: 12 }}>—</span>
                ) : (
                  detailLive.riskCodes.map(code => {
                    const r = risks.find(x => x.code === code);
                    return (
                      <Link key={code} href="/app/risks" style={{ fontSize: 12, color: "#123C66" }}>
                        {r?.title ?? code}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Documentos</div>
              {detailLive.documentCodes.map(c => {
                const d = documents.find(x => x.code === c);
                return (
                  <Link key={c} href="/app/documents" style={{ fontSize: 12, color: "#123C66", marginRight: 10 }}>
                    {d?.title ?? c}
                  </Link>
                );
              })}
              {detailLive.documentCodes.length === 0 && <span style={{ fontSize: 12, color: "#5E6B7A" }}>—</span>}
            </div>
            {perm.suppliers.manage && (
              <button type="button" onClick={() => bumpReview(detailLive)} style={{ padding: "10px 16px", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                Registrar evaluación y +6 meses revisión
              </button>
            )}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Actividad relacionada (global)</div>
              <AuditTimeline events={supEvents.slice(0, 8)} max={8} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
