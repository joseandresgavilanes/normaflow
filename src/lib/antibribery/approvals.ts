import type { HighRiskApprovalStatus } from "@prisma/client";

const ALLOWED: Record<HighRiskApprovalStatus, HighRiskApprovalStatus[]> = {
  REQUESTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function nextHighRiskStatuses(status: HighRiskApprovalStatus): HighRiskApprovalStatus[] {
  return ALLOWED[status] ?? [];
}

export function assertHighRiskTransition(from: HighRiskApprovalStatus, to: HighRiskApprovalStatus): void {
  if (from === to) throw new Error(`La aprobación ya está en estado ${from}.`);
  if (!nextHighRiskStatuses(from).includes(to)) {
    throw new Error(
      `Transición no permitida: de ${from} solo se puede pasar a ${nextHighRiskStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function assertHighRiskApproval(input: { approvedById: string | null | undefined }): void {
  if (!input.approvedById) {
    throw new Error("Aprobar una operación de alto riesgo exige registrar quién la aprueba.");
  }
}

export function assertHighRiskRejection(reason: string | null | undefined): void {
  if (!reason) throw new Error("Rechazar una operación de alto riesgo exige un motivo documentado.");
}

/** Una operación con funcionario público o comisión de agente no puede auto-aprobarse. */
export function requiresIndependentApproval(input: {
  involvesPublicOfficial: boolean;
  transactionType: string;
  requestedById?: string | null;
  approvedById?: string | null;
}): void {
  if (input.requestedById && input.approvedById && input.requestedById === input.approvedById) {
    throw new Error("Quien solicita una operación de alto riesgo no puede aprobarla.");
  }
  if (input.involvesPublicOfficial && !input.approvedById) {
    throw new Error("Una operación con funcionario público exige aprobación explícita.");
  }
}
