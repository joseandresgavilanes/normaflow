/**
 * Debida diligencia de socios de negocio (ISO 37001 §8.2).
 *
 * DRAFT → SCREENING → REVIEW → ENHANCED_REVIEW → APPROVED | REJECTED
 * APPROVED → PERIODIC_REVIEW → REVIEW | ENHANCED_REVIEW | APPROVED
 */
import type { DueDiligenceStatus } from "@prisma/client";

const ALLOWED: Record<DueDiligenceStatus, DueDiligenceStatus[]> = {
  DRAFT: ["SCREENING"],
  SCREENING: ["REVIEW", "ENHANCED_REVIEW"],
  REVIEW: ["ENHANCED_REVIEW", "APPROVED", "REJECTED"],
  ENHANCED_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PERIODIC_REVIEW"],
  REJECTED: ["DRAFT"],
  PERIODIC_REVIEW: ["REVIEW", "ENHANCED_REVIEW", "APPROVED"],
};

export function nextDueDiligenceStatuses(status: DueDiligenceStatus): DueDiligenceStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionDueDiligence(from: DueDiligenceStatus, to: DueDiligenceStatus): boolean {
  return nextDueDiligenceStatuses(from).includes(to);
}

export function assertDueDiligenceTransition(from: DueDiligenceStatus, to: DueDiligenceStatus): void {
  if (from === to) throw new Error(`La debida diligencia ya está en estado ${from}.`);
  if (!canTransitionDueDiligence(from, to)) {
    throw new Error(
      `Transición no permitida: de ${from} solo se puede pasar a ${nextDueDiligenceStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function assertDueDiligenceApproval(input: {
  approvedById: string | null | undefined;
}): void {
  if (!input.approvedById) {
    throw new Error("Aprobar una debida diligencia exige registrar quién la aprueba.");
  }
}

export function assertDueDiligenceRejection(input: {
  rejectedById: string | null | undefined;
  rejectionReason: string | null | undefined;
}): void {
  if (!input.rejectedById) throw new Error("Rechazar una debida diligencia exige registrar quién la rechaza.");
  if (!input.rejectionReason) throw new Error("Rechazar una debida diligencia exige un motivo documentado.");
}

/** La revisión reforzada es obligatoria cuando el socio es de riesgo alto/crítico o PEP. */
export function requiresEnhancedReview(input: {
  riskTier: string;
  isPublicOfficial?: boolean;
  interactsWithPEPs?: boolean;
  screeningResult?: string;
}): boolean {
  if (input.riskTier === "HIGH" || input.riskTier === "CRITICAL") return true;
  if (input.isPublicOfficial || input.interactsWithPEPs) return true;
  if (input.screeningResult === "POTENTIAL_MATCH" || input.screeningResult === "CONFIRMED_HIT") return true;
  return false;
}
