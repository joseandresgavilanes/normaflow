/** Evento de trazabilidad defendible (preparado para persistencia futura) */
export type AuditEventRow = {
  id: string;
  ts: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  attestation?: {
    method: "E_SIGN_SIMULATED";
    statement: string;
    confirmedAt: string;
  };
};

export function createAuditEvent(p: Omit<AuditEventRow, "id"> & { id?: string }): AuditEventRow {
  return {
    id: p.id ?? `ae-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...p,
  };
}

export const AUDIT_ACTIONS = {
  DOCUMENT_VIEW: "DOCUMENT_VIEW",
  DOCUMENT_UPDATE: "DOCUMENT_UPDATE",
  DOCUMENT_APPROVED: "DOCUMENT_APPROVED",
  DOCUMENT_SENT_REVIEW: "DOCUMENT_SENT_REVIEW",
  DOCUMENT_OBSOLETE: "DOCUMENT_OBSOLETE",
  CHANGE_CREATED: "CHANGE_CREATED",
  CHANGE_STATUS: "CHANGE_STATUS",
  TRAINING_ASSIGNED: "TRAINING_ASSIGNED",
  TRAINING_COMPLETED: "TRAINING_COMPLETED",
  NC_CLOSED: "NC_CLOSED",
  NC_EFFECTIVENESS: "NC_EFFECTIVENESS",
  AUDIT_CLOSED: "AUDIT_CLOSED",
  RISK_REVIEWED: "RISK_REVIEWED",
  EVIDENCE_INGESTED: "EVIDENCE_INGESTED",
  INTEGRATION_CONNECTED: "INTEGRATION_CONNECTED",
  REPORT_EXPORTED: "REPORT_EXPORTED",
} as const;
