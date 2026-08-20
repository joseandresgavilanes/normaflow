"use client";
import { useState } from "react";
import EntityTable from "@/components/ui/EntityTable";
import { CellTitle } from "@/components/operations/OperationalUi";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type IntegrationInstanceRow, type IntegrationKey } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { formatDateTime } from "@/lib/format/datetime";

function statusBadge(s: IntegrationInstanceRow["status"]) {
  if (s === "CONNECTED") return <Badge status="ON_TRACK" label="Conectada" />;
  if (s === "PENDING") return <Badge status="AT_RISK" label="Pendiente" />;
  if (s === "NEEDS_ATTENTION") return <Badge status="OFF_TRACK" label="Requiere atención" />;
  return <Badge status="PENDING" label="No conectada" />;
}

export default function IntegrationsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [detail, setDetail] = useState<IntegrationInstanceRow | null>(null);
  const [connecting, setConnecting] = useState<IntegrationKey | null>(null);

  function mockConnect(key: IntegrationKey) {
    setConnecting(key);
    setTimeout(() => {
      dispatch({
        type: "updateIntegration",
        key,
        patch: { status: "CONNECTED", lastSyncAt: new Date().toISOString(), detailNote: "Conexión OAuth simulada completada." },
      });
      dispatch({
        type: "appendAudit",
        event: createAuditEvent({
          ts: new Date().toISOString(),
          actorName: state.session.name,
          actorEmail: state.session.email,
          action: AUDIT_ACTIONS.INTEGRATION_CONNECTED,
          entityType: "INTEGRATION",
          entityId: key,
          newValue: "CONNECTED",
        }),
      });
      showToast("Integración conectada (simulado) · evento auditado");
      setConnecting(null);
      setDetail(null);
    }, 1200);
  }

  return (
    <div>
      <SectionTitle title="Integraciones" sub="Catálogo de conectores para evidencias, identidad y operación — estados operativos simulados" />

      <EntityTable
        caption="Integraciones"
        rows={state.integrations}
        rowKey={(row) => row.key}
        rowAction={(row) => setDetail(row)}
        storageKey="demo-integrations"
        searchText={(row) => `${row.name} ${row.category} ${row.description}`}
        searchPlaceholder="Buscar por nombre o categoría…"
        filters={[
          { id: "status", label: "Estado", value: (row) => row.status },
          { id: "category", label: "Categoría", value: (row) => row.category, format: (value) => value },
        ]}
        emptyTitle="Todavía no hay integraciones"
        columns={[
          {
            id: "name", header: "Integración", primary: true, minWidth: 220, sortValue: (row) => row.name,
            cell: (row) => <CellTitle title={row.name} meta={row.category} />,
          },
          { id: "status", header: "Estado", cell: (row) => statusBadge(row.status) },
          { id: "description", header: "Qué aporta", hideable: true, minWidth: 280, cell: (row) => row.description },
          {
            id: "sync", header: "Última sincronización", numeric: true, hideable: true, sortValue: (row) => row.lastSyncAt ?? "",
            cell: (row) => row.lastSyncAt ? formatDateTime(row.lastSyncAt) : "—",
          },
        ]}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={560}>
        {detail && (
          <div>
            <p style={{ fontSize: 14, color: "var(--nf-ink)", lineHeight: 1.55 }}>{detail.valueProposition}</p>
            <div style={{ marginTop: 12, marginBottom: 16 }}>{statusBadge(detail.status)}</div>
            {detail.detailNote && (
              <div style={{ background: "var(--nf-warning-subtle)", border: "1px solid #f5e0a8", borderRadius: 8, padding: 12, fontSize: 13, color: "#7a5c1a", marginBottom: 16 }}>{detail.detailNote}</div>
            )}
            <p style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>
              La ingesta de evidencias desde este conector quedaría mapeada a controles, documentos y auditorías. Desde{" "}
              <a href="/app/evidence" style={{ color: "var(--nf-primary-active)", fontWeight: 600 }}>
                Evidencias
              </a>{" "}
              puede distinguir origen manual vs. automatizado.
            </p>
            {perm.integrations.manage && detail.status !== "CONNECTED" && (
              <button
                type="button"
                disabled={!!connecting}
                onClick={() => mockConnect(detail.key)}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: 12,
                  background: "var(--nf-primary)",
                  color: "var(--nf-text-on-primary)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: connecting ? "wait" : "pointer",
                }}
              >
                {connecting === detail.key ? "Conectando…" : "Iniciar conexión (simulada)"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
