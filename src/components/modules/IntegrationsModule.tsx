"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type IntegrationInstanceRow, type IntegrationKey } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

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
      setDetail(prev => (prev?.key === key ? { ...prev, status: "CONNECTED", lastSyncAt: new Date().toISOString() } : prev));
    }, 1200);
  }

  return (
    <div>
      <SectionTitle title="Integraciones" sub="Catálogo de conectores para evidencias, identidad y operación — estados operativos simulados" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
        {state.integrations.map(int => (
          <Card key={int.key} style={{ cursor: "pointer" }} onClick={() => setDetail(int)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#5E6B7A", textTransform: "uppercase", letterSpacing: 0.5 }}>{int.category}</div>
                <h3 style={{ margin: "4px 0 8px", fontSize: 16, color: "#142033" }}>{int.name}</h3>
                <p style={{ fontSize: 13, color: "#5E6B7A", margin: 0, lineHeight: 1.45 }}>{int.description}</p>
              </div>
              {statusBadge(int.status)}
            </div>
            {int.lastSyncAt && <div style={{ fontSize: 11, color: "#9aa5b1", marginTop: 10 }}>Última sync: {new Date(int.lastSyncAt).toLocaleString("es-ES")}</div>}
          </Card>
        ))}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={560}>
        {detail && (
          <div>
            <p style={{ fontSize: 14, color: "#142033", lineHeight: 1.55 }}>{detail.valueProposition}</p>
            <div style={{ marginTop: 12, marginBottom: 16 }}>{statusBadge(detail.status)}</div>
            {detail.detailNote && (
              <div style={{ background: "#fff8e6", border: "1px solid #f5e0a8", borderRadius: 8, padding: 12, fontSize: 13, color: "#7a5c1a", marginBottom: 16 }}>{detail.detailNote}</div>
            )}
            <p style={{ fontSize: 12, color: "#5E6B7A" }}>
              La ingesta de evidencias desde este conector quedaría mapeada a controles, documentos y auditorías. Desde{" "}
              <a href="/app/evidence" style={{ color: "#123C66", fontWeight: 600 }}>
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
                  background: "#123C66",
                  color: "#fff",
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
