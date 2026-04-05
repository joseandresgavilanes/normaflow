"use client";
import type { AuditEventRow } from "@/lib/domain/audit-event";
import { formatDate } from "@/lib/utils";

export default function AuditTimeline({
  events,
  max = 50,
  emptyText = "Sin eventos registrados.",
}: {
  events: AuditEventRow[];
  max?: number;
  emptyText?: string;
}) {
  const list = events.slice(0, max);
  if (list.length === 0) {
    return <p style={{ fontSize: 13, color: "#5E6B7A", margin: 0 }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {list.map((ev, i) => (
        <div
          key={ev.id}
          style={{
            display: "grid",
            gridTemplateColumns: "14px 1fr",
            gap: 12,
            paddingBottom: i < list.length - 1 ? 16 : 0,
            borderLeft: i < list.length - 1 ? "2px solid #E5EAF2" : "none",
            marginLeft: 6,
            paddingLeft: 14,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: ev.attestation ? "#2E8B57" : "#123C66",
              marginTop: 4,
              marginLeft: -21,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginBottom: 4 }}>
              {formatDate(ev.ts, "dd/MM/yyyy HH:mm")} · <strong style={{ color: "#142033" }}>{ev.actorName}</strong>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#142033", marginBottom: 4 }}>{ev.action.replace(/_/g, " ")}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", lineHeight: 1.5 }}>
              {ev.entityType} {ev.entityLabel ? `· ${ev.entityLabel}` : ev.entityId ? `· ${ev.entityId}` : ""}
              {ev.field && (
                <>
                  <br />
                  Campo: {ev.field}
                  {ev.oldValue != null && ` · de «${ev.oldValue}»`}
                  {ev.newValue != null && ` a «${ev.newValue}»`}
                </>
              )}
              {ev.reason && (
                <>
                  <br />
                  <span style={{ fontStyle: "italic" }}>Motivo: {ev.reason}</span>
                </>
              )}
              {ev.attestation && (
                <div style={{ marginTop: 6, padding: 8, background: "#e8f5ee", borderRadius: 8, fontSize: 11, color: "#1a5c38" }}>
                  <strong>Firma electrónica simulada</strong> · {ev.attestation.statement} · {formatDate(ev.attestation.confirmedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
