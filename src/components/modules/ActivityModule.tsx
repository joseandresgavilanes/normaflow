"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";

export default function ActivityModule() {
  const { state } = useWorkspace();
  const perm = useDemoPermission();
  const [entityType, setEntityType] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (entityType === "ALL") return state.auditEvents;
    return state.auditEvents.filter(e => e.entityType === entityType);
  }, [state.auditEvents, entityType]);

  if (!perm.activity.read) {
    return (
      <Card style={{ padding: 32, textAlign: "center", color: "#5E6B7A" }}>
        No tiene permiso para ver el registro de actividad global.
      </Card>
    );
  }

  const types = Array.from(new Set(state.auditEvents.map(e => e.entityType))).sort();

  return (
    <div>
      <SectionTitle
        title="Actividad y audit trail"
        sub="Registro cronológico defendible: quién hizo qué, cuándo y por qué — preparado para exportación legal"
      />

      <Card style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#5E6B7A", marginRight: 8 }}>Filtrar por entidad:</span>
        <button
          type="button"
          onClick={() => setEntityType("ALL")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${entityType === "ALL" ? "#123C66" : "#E5EAF2"}`,
            background: entityType === "ALL" ? "#123C6615" : "#fff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Todas
        </button>
        {types.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setEntityType(t)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${entityType === t ? "#123C66" : "#E5EAF2"}`,
              background: entityType === t ? "#123C6615" : "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </Card>

      <Card>
        <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 16 }}>
          {filtered.length} evento(s) mostrados · Total en sesión: {state.auditEvents.length}
        </div>
        <AuditTimeline events={filtered} max={200} />
      </Card>
    </div>
  );
}
