/**
 * Flujo de revisión energética (ISO 50001 §6.3).
 * DRAFT → IN_PROGRESS → UNDER_REVIEW → APPROVED | SUPERSEDED
 */
import type { EnergyReviewStatus } from "@prisma/client";

const ALLOWED: Record<EnergyReviewStatus, EnergyReviewStatus[]> = {
  DRAFT: ["IN_PROGRESS"],
  IN_PROGRESS: ["UNDER_REVIEW", "DRAFT"],
  UNDER_REVIEW: ["APPROVED", "IN_PROGRESS"],
  APPROVED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export function nextEnergyReviewStatuses(status: EnergyReviewStatus): EnergyReviewStatus[] {
  return ALLOWED[status] ?? [];
}

export function assertEnergyReviewTransition(from: EnergyReviewStatus, to: EnergyReviewStatus): void {
  if (from === to) throw new Error(`La revisión energética ya está en estado ${from}.`);
  if (!nextEnergyReviewStatuses(from).includes(to)) {
    throw new Error(
      `Transición no permitida: de ${from} solo se puede pasar a ${nextEnergyReviewStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function assertEnergyReviewApproval(input: { approvedById: string | null | undefined }): void {
  if (!input.approvedById) {
    throw new Error("Aprobar una revisión energética exige registrar quién la aprueba.");
  }
}
