/** Etiquetas cortas para tipo de entidad en audit trail (chips y tarjetas) */
export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  ORGANIZATION: "Organización",
  DOCUMENT: "Documento",
  CHANGE_REQUEST: "Cambio",
  RISK: "Riesgo",
  AUDIT: "Auditoría",
  NONCONFORMITY: "No conformidad",
  TRAINING_ASSIGNMENT: "Formación",
  DOCUMENT_VERSION: "Versión doc.",
  INTEGRATION: "Integración",
  REPORT: "Informe",
  EVIDENCE: "Evidencia",
  ACTION: "Acción",
  PROCESS: "Proceso",
  SUPPLIER: "Proveedor",
  INDICATOR: "Indicador",
};

export function auditEntityTypeLabel(code: string) {
  return AUDIT_ENTITY_TYPE_LABELS[code] ?? code.replace(/_/g, " ");
}
