/**
 * Ciclo de vida de un sistema de IA (ISO/IEC 42001 §A.6.2), desde la
 * planificación hasta el retiro.
 *
 *   PLANNED → IN_DEVELOPMENT → IN_VALIDATION → APPROVED → IN_PRODUCTION
 *                                                       ↘ SUSPENDED ⇄ IN_PRODUCTION
 *                                                                   ↘ RETIRED
 *
 * El paso a IN_PRODUCTION exige aprobación humana registrada y el retiro exige
 * motivo y plan de disposición de datos y modelos.
 */
import type { AISystemStatus } from "@prisma/client";

const ALLOWED: Record<AISystemStatus, AISystemStatus[]> = {
  PLANNED: ["IN_DEVELOPMENT", "RETIRED"],
  IN_DEVELOPMENT: ["IN_VALIDATION", "SUSPENDED", "RETIRED"],
  IN_VALIDATION: ["APPROVED", "IN_DEVELOPMENT", "SUSPENDED", "RETIRED"],
  APPROVED: ["IN_PRODUCTION", "IN_VALIDATION", "SUSPENDED", "RETIRED"],
  IN_PRODUCTION: ["SUSPENDED", "RETIRED"],
  SUSPENDED: ["IN_PRODUCTION", "IN_VALIDATION", "RETIRED"],
  RETIRED: [],
};

export function nextSystemStatuses(status: AISystemStatus): AISystemStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionSystem(from: AISystemStatus, to: AISystemStatus): boolean {
  return nextSystemStatuses(from).includes(to);
}

export function assertSystemTransition(from: AISystemStatus, to: AISystemStatus): void {
  if (from === to) throw new Error(`El sistema ya está en estado ${from}.`);
  if (from === "RETIRED") throw new Error("Un sistema retirado no admite más transiciones; registre un sistema nuevo.");
  if (!canTransitionSystem(from, to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextSystemStatuses(from).join(", ")}.`);
  }
}

/**
 * Puesta en producción: solo con aprobación humana registrada. Duplica la
 * garantía del CHECK constraint para devolver un mensaje legible.
 */
export function assertProductionApproval(input: {
  approvedById: string | null | undefined;
  approvedAt: Date | null | undefined;
}): void {
  if (!input.approvedById || !input.approvedAt) {
    throw new Error("Un sistema de IA solo puede pasar a producción con una aprobación humana registrada.");
  }
}

/** Retiro del sistema (§A.6.2.7): motivo y plan de disposición obligatorios. */
export function assertRetirement(input: { reason: string | null | undefined; plan: string | null | undefined }): void {
  if (!input.reason) throw new Error("El retiro de un sistema de IA requiere un motivo documentado.");
  if (!input.plan) {
    throw new Error("El retiro requiere un plan de disposición de datos, modelos y comunicaciones a los afectados.");
  }
}

export function isOperational(status: AISystemStatus): boolean {
  return status === "IN_PRODUCTION";
}
