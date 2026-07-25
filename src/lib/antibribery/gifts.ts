/**
 * Regalos y hospitalidad (ISO 37001 §8.7 / controles A.8–A.13).
 *
 * SUBMITTED → MANAGER_REVIEW → COMPLIANCE_REVIEW → APPROVED | REJECTED
 */
import type { GiftHospitalityStatus } from "@prisma/client";

const ALLOWED: Record<GiftHospitalityStatus, GiftHospitalityStatus[]> = {
  SUBMITTED: ["MANAGER_REVIEW"],
  MANAGER_REVIEW: ["COMPLIANCE_REVIEW", "REJECTED"],
  COMPLIANCE_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function nextGiftStatuses(status: GiftHospitalityStatus): GiftHospitalityStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionGift(from: GiftHospitalityStatus, to: GiftHospitalityStatus): boolean {
  return nextGiftStatuses(from).includes(to);
}

export function assertGiftTransition(from: GiftHospitalityStatus, to: GiftHospitalityStatus): void {
  if (from === to) throw new Error(`El registro ya está en estado ${from}.`);
  if (from === "APPROVED" || from === "REJECTED") {
    throw new Error("Un regalo u hospitalidad decidido no se reabre: registre uno nuevo si es necesario.");
  }
  if (!canTransitionGift(from, to)) {
    throw new Error(
      `Transición no permitida: de ${from} solo se puede pasar a ${nextGiftStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

/** Por encima del umbral de política, o con funcionario público, compliance no se puede saltar. */
export function mustReachComplianceReview(input: {
  aboveThreshold: boolean;
  involvesPublicOfficial: boolean;
  estimatedValue?: number | null;
  policyThreshold?: number | null;
}): boolean {
  if (input.involvesPublicOfficial) return true;
  if (input.aboveThreshold) return true;
  if (
    typeof input.estimatedValue === "number" &&
    typeof input.policyThreshold === "number" &&
    input.estimatedValue > input.policyThreshold
  ) {
    return true;
  }
  return false;
}

export function assertGiftRejection(reason: string | null | undefined): void {
  if (!reason) throw new Error("Rechazar un regalo u hospitalidad exige un motivo documentado.");
}

export function assertComplianceDecision(input: {
  reviewerId: string | null | undefined;
}): void {
  if (!input.reviewerId) {
    throw new Error("La decisión de compliance sobre un regalo exige registrar quién decide.");
  }
}
