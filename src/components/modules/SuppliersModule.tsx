"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
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

  type SupplierRow = (typeof suppliers)[number];
  const columns = useMemo<DataTableColumn<SupplierRow>[]>(() => [
    { id: "code", header: "Código", primary: true, minWidth: 110, hideable: false, sortValue: (s) => s.code,
      cell: (s) => <span style={{ fontWeight: 700, color: "var(--nf-primary-active)" }}>{s.code}</span> },
    { id: "name", header: "Proveedor", minWidth: 180, sortValue: (s) => s.name, cell: (s) => s.name },
    { id: "criticality", header: "Criticidad", minWidth: 120, sortValue: (s) => s.criticality,
      cell: (s) => <Badge status={s.criticality === "CRITICAL" ? "OFF_TRACK" : s.criticality === "HIGH" ? "AT_RISK" : "ON_TRACK"} label={s.criticality} /> },
    { id: "status", header: "Estado", minWidth: 120, sortValue: (s) => s.status,
      cell: (s) => <Badge status={s.status === "APPROVED" ? "ON_TRACK" : "AT_RISK"} label={s.status} /> },
    { id: "owner", header: "Dueño", minWidth: 140, sortValue: (s) => s.owner,
      cell: (s) => <span style={{ color: "var(--nf-ink-3)" }}>{s.owner}</span> },
    { id: "review", header: "Próx. revisión", minWidth: 130, numeric: true, sortValue: (s) => String(s.nextReviewDue ?? ""),
      cell: (s) => formatDate(s.nextReviewDue) },
  ], []);

  const detailLive = detail ? suppliers.find(s => s.id === detail.id) ?? detail : null;
  const supEvents = auditEvents.filter(e => e.entityType === "SUPPLIER" || (e.entityLabel?.startsWith("PRV") ?? false));

  function bumpReview(s: SupplierRow) {
    if (!perm.suppliers.manage) return;
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    dispatch({ type: "updateSupplier", id: s.id, patch: { nextReviewDue: d.toISOString().slice(0, 10), lastEvaluationAt: new Date().toISOString().slice(0, 10) } });
    showToast("Próxima revisión reprogramada (+6 meses)");
    setDetail(null);
  }

  return (
    <div>
      <SectionTitle title="Proveedores y contratistas" sub="Criticidad, revisiones, riesgos, documentos y evidencias" />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Filtro
        </span>
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => (
          <button
            key={f}
            type="button"
            className={filter === f ? "nf-chip nf-chip--on" : "nf-chip"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "Todos" : f}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          rowAction={(s) => setDetail(s)}
          caption="Proveedores: código, nombre, criticidad, estado de homologación, dueño y próxima revisión."
          storageKey="suppliers-module"
          empty={<EmptyState kind="empty" title="No hay proveedores registrados." description="El listado recoge la criticidad de cada proveedor, su estado de homologación y cuándo toca revisarlo." />}
        />
      </Card>

      <Modal open={!!detailLive} onClose={() => setDetail(null)} title={detailLive?.name ?? ""} width={600}>
        {detailLive && (
          <div>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>
              Categoría: {detailLive.category} · Código {detailLive.code}
            </p>
            <div style={{ margin: "16px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Riesgos vinculados</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detailLive.riskCodes.length === 0 ? (
                  <span style={{ color: "var(--nf-ink-3)", fontSize: 12 }}>—</span>
                ) : (
                  detailLive.riskCodes.map(code => {
                    const r = risks.find(x => x.code === code);
                    return (
                      <Link key={code} href="/app/risks" style={{ fontSize: 12, color: "var(--nf-primary-active)" }}>
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
                  <Link key={c} href="/app/documents" style={{ fontSize: 12, color: "var(--nf-primary-active)", marginRight: 10 }}>
                    {d?.title ?? c}
                  </Link>
                );
              })}
              {detailLive.documentCodes.length === 0 && <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>—</span>}
            </div>
            {perm.suppliers.manage && (
              <button type="button" onClick={() => bumpReview(detailLive)} className="nf-app-btn-primary">
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
