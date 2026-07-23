import type { ApprovalStatus } from "@prisma/client";

export type ApprovalSnapshot = {
  approverId: string;
  status: ApprovalStatus;
};

/** A privileged role cannot bypass the assigned approval workflow. */
export function hasPendingAssignedApproval(approvals: ApprovalSnapshot[], actorId: string): boolean {
  return approvals.some((approval) => approval.approverId === actorId && approval.status === "PENDING");
}

/** A document may publish only when every assigned approval completed positively. */
export function canPublishApprovedDocument(counts: { pending: number; approved: number; rejected: number }): boolean {
  return counts.approved > 0 && counts.pending === 0 && counts.rejected === 0;
}
