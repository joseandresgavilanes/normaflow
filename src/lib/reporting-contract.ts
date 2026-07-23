export const REPORT_IDS = [
  "gap", "documents", "risks", "audit-program", "audit", "capa", "actions", "indicators", "evidence", "management-review", "audit-package",
  "records", "security-controls", "exec", "iso", "site", "train", "changes",
  "soa", "excluded-controls", "pending-controls", "control-evidence",
  "risk-matrix", "risk-treatment-plan", "residual-risks",
  "assets", "asset-classification", "asset-risks", "asset-controls",
  "incident-log", "incident-report", "open-vulnerabilities", "remediation-plan",
  "continuity-plans", "bcp-dr-tests", "critical-suppliers",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];
export type ExportFormat = "PDF" | "EXCEL";
export type ReportFilters = { from: string; to: string; standardCode?: string; status?: string; recordId?: string; ownerId?: string; domain?: string; applicability?: string };
