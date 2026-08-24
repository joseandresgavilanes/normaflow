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

export type SelfApprovalOutcome = "allowed" | "blocked" | "sole-approver";

/**
 * Quien elabora no aprueba: nadie firma la versión que subió él mismo.
 *
 * La excepción no es una casilla de configuración sino una condición que se
 * comprueba. Si en la organización no queda nadie más con permiso para aprobar,
 * exigir la separación dejaría el documento bloqueado para siempre — el caso de
 * la pyme de una sola persona, que es real. Ahí se permite y se registra como
 * excepción explícita en la auditoría, que es lo que un auditor va a querer ver.
 */
export function selfApprovalOutcome(input: {
  approverId: string;
  versionCreatedById: string | null;
  otherApproversAvailable: boolean;
}): SelfApprovalOutcome {
  const esSuPropiaVersion = input.versionCreatedById != null && input.versionCreatedById === input.approverId;
  if (!esSuPropiaVersion) return "allowed";
  return input.otherApproversAvailable ? "blocked" : "sole-approver";
}
