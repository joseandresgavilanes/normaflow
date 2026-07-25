export const REPORT_IDS = [
  "gap", "documents", "risks", "audit-program", "audit", "capa", "actions", "indicators", "evidence", "management-review", "audit-package",
  "records", "security-controls", "exec", "iso", "site", "train", "changes",
  "soa", "excluded-controls", "pending-controls", "control-evidence",
  "risk-matrix", "risk-treatment-plan", "residual-risks",
  "assets", "asset-classification", "asset-risks", "asset-controls",
  "incident-log", "incident-report", "open-vulnerabilities", "remediation-plan",
  "continuity-plans", "bcp-dr-tests", "critical-suppliers",
  "env-aspects-impacts", "env-significant-aspects", "env-legal-obligations",
  "env-compliance-evaluation", "env-objectives", "env-resource-consumption",
  "env-waste", "env-emissions", "env-emergencies", "env-audit-package",
  "safety-hazard-matrix", "safety-critical-risks", "safety-inspections",
  "safety-ppe", "safety-permits", "safety-incidents", "safety-investigation",
  "safety-drills", "safety-indicators", "safety-contractors", "safety-audit-package",
  // Sistema Integrado de Gestión (ISO 9001 + 14001 + 45001)
  "sig-crosswalk", "sig-scope-policy", "sig-interested-parties", "sig-objectives",
  "sig-shared-elements", "sig-integrated-audit", "sig-integrated-capa",
  "sig-management-review", "sig-system-package",
  // Continuidad del negocio (ISO 22301)
  "bcm-bia", "bcm-critical-processes", "bcm-rto-rpo", "bcm-dependencies",
  "bcm-strategies", "bcm-plans", "bcm-exercises", "bcm-gaps", "bcm-audit-package",
  // Gestión de inteligencia artificial (ISO/IEC 42001)
  "ai-inventory", "ai-impact-assessment", "ai-risks", "ai-datasets", "ai-models",
  "ai-controls", "ai-incidents", "ai-transparency", "ai-human-review", "ai-audit-package",
  // Gestión de compliance (ISO 37301). El informe de denuncias sale agregado y
  // sin identidades; el resto del canal no se exporta.
  "compliance-obligations", "compliance-risks", "compliance-evaluations", "compliance-calendar",
  "compliance-speak-up", "compliance-investigations", "compliance-breaches",
  "compliance-remediation", "compliance-management-review",
  // Antisoborno (ISO 37001) — extensión del SGC; no duplica obligaciones ni canal.
  "abms-risk-map", "abms-third-parties", "abms-due-diligence", "abms-beneficial-owners",
  "abms-gifts", "abms-donations", "abms-conflicts", "abms-high-risk-ops",
  "abms-controls", "abms-investigations",
  // Gestión energética (ISO 50001)
  "enms-energy-review", "enms-significant-uses", "enms-baseline", "enms-enpi",
  "enms-consumption", "enms-opportunities", "enms-actions", "enms-savings",
  "enms-audit-package",
  // Inocuidad alimentaria (ISO 22000 / HACCP)
  "fsms-hazard-analysis", "fsms-prp", "fsms-oprp", "fsms-ccp", "fsms-monitoring",
  "fsms-deviations", "fsms-traceability", "fsms-recalls", "fsms-allergens",
  "fsms-audit-package",
  // Gestión de servicios TI (ISO/IEC 20000 / ITSM)
  "itsm-sla", "itsm-incidents", "itsm-problems", "itsm-changes",
  "itsm-availability", "itsm-capacity", "itsm-continuity", "itsm-suppliers",
  "itsm-service-performance",
  // Dispositivos médicos (ISO 13485)
  "md-design-history", "md-master-record", "md-risks", "md-validations",
  "md-suppliers", "md-batches", "md-complaints", "md-surveillance",
  "md-events", "md-recalls", "md-audit-package",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];
export type ExportFormat = "PDF" | "EXCEL";
export type ReportFilters = { from: string; to: string; standardCode?: string; status?: string; recordId?: string; ownerId?: string; domain?: string; applicability?: string; hoursWorked?: string };
