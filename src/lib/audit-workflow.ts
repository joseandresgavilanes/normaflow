export const AUDIT_ACTION_PLAN_STAGES = ["ACTION_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"] as const;

export function checklistIsReady(items: readonly { status: string }[]) {
  return items.length > 0 && items.every((item) => item.status !== "PENDING");
}

export function criticalFindingsHaveActionPlan(findings: readonly { severity: string; capaStage?: string | null }[]) {
  return findings.every((finding) => finding.severity !== "CRITICAL" || AUDIT_ACTION_PLAN_STAGES.includes(finding.capaStage as typeof AUDIT_ACTION_PLAN_STAGES[number]));
}

/** ISO management-system audits must be assigned independently of the work audited. */
export function assertAuditIndependence(input: {
  auditorId?: string | null;
  processOwnerId?: string | null;
  auditeeIds?: readonly string[];
}) {
  if (!input.auditorId) return;
  if (input.processOwnerId === input.auditorId) {
    throw new Error("El auditor no puede auditar un proceso del que es responsable.");
  }
  if (input.auditeeIds?.includes(input.auditorId)) {
    throw new Error("El auditor no puede figurar también como auditado en la misma auditoría.");
  }
}
