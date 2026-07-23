export const AUDIT_ACTION_PLAN_STAGES = ["ACTION_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"] as const;

export function checklistIsReady(items: readonly { status: string }[]) {
  return items.length > 0 && items.every((item) => item.status !== "PENDING");
}

export function criticalFindingsHaveActionPlan(findings: readonly { severity: string; capaStage?: string | null }[]) {
  return findings.every((finding) => finding.severity !== "CRITICAL" || AUDIT_ACTION_PLAN_STAGES.includes(finding.capaStage as typeof AUDIT_ACTION_PLAN_STAGES[number]));
}
