/**
 * Investigación de denuncias e incumplimientos (ISO 37301 §8.3, §9.1).
 *
 * La independencia del investigador no es una buena intención: se comprueba
 * contra la persona señalada y contra las declaraciones de conflicto de interés
 * vigentes. Si aparece conflicto, el caso se reasigna; no se sigue "con cuidado".
 */
import type { ConflictReviewStatus, InvestigationStatus } from "@prisma/client";

const ALLOWED: Record<InvestigationStatus, InvestigationStatus[]> = {
  PLANNED: ["ACTIVE", "CLOSED"],
  ACTIVE: ["SUSPENDED", "CONCLUDED"],
  SUSPENDED: ["ACTIVE", "CONCLUDED"],
  CONCLUDED: ["CLOSED"],
  CLOSED: [],
};

export function nextInvestigationStatuses(status: InvestigationStatus): InvestigationStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionInvestigation(from: InvestigationStatus, to: InvestigationStatus): boolean {
  return nextInvestigationStatuses(from).includes(to);
}

export function assertInvestigationTransition(from: InvestigationStatus, to: InvestigationStatus): void {
  if (from === to) throw new Error(`La investigación ya está en estado ${from}.`);
  if (from === "CLOSED") throw new Error("Una investigación cerrada no admite más transiciones.");
  if (!canTransitionInvestigation(from, to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextInvestigationStatuses(from).join(", ") || "ningún estado"}.`);
  }
}

/** Concluir exige hallazgos y conclusión: una investigación sin conclusión no concluyó. */
export function assertConclusion(input: {
  findings: string | null | undefined;
  conclusion: string | null | undefined;
}): void {
  if (!input.findings) throw new Error("Concluir una investigación exige registrar los hallazgos.");
  if (!input.conclusion) throw new Error("Concluir una investigación exige una conclusión motivada.");
}

export type ConflictCheck = {
  conflictDetected: boolean;
  /** Motivos concretos, para dejarlos en el expediente y en el informe. */
  reasons: string[];
};

/** Declaraciones que obligan a abstenerse (aceptadas o mitigadas, con recusación). */
export type ActiveDeclaration = {
  declarantId: string;
  hasConflict: boolean;
  recusalRequired: boolean;
  reviewStatus: ConflictReviewStatus;
  relatedParty?: string | null;
};

/**
 * Comprueba la independencia de quien va a investigar. Devuelve los motivos en
 * lugar de un booleano suelto para que el expediente explique la reasignación.
 */
export function checkIndependence(input: {
  investigatorId: string;
  subjectUserId?: string | null;
  reporterUserId?: string | null;
  declarations?: ActiveDeclaration[];
}): ConflictCheck {
  const reasons: string[] = [];
  if (input.subjectUserId && input.investigatorId === input.subjectUserId) {
    reasons.push("la persona asignada es la señalada en el caso");
  }
  if (input.reporterUserId && input.investigatorId === input.reporterUserId) {
    reasons.push("la persona asignada es quien presentó el caso");
  }
  for (const declaration of input.declarations ?? []) {
    if (declaration.declarantId !== input.investigatorId) continue;
    if (declaration.hasConflict && declaration.recusalRequired && declaration.reviewStatus !== "REJECTED") {
      reasons.push(
        declaration.relatedParty
          ? `conflicto de interés declarado con ${declaration.relatedParty}`
          : "conflicto de interés declarado con abstención obligatoria",
      );
    }
  }
  return { conflictDetected: reasons.length > 0, reasons };
}

/**
 * Asignar a alguien no independiente es un error de proceso, no un aviso: la
 * asignación se rechaza antes de escribir nada.
 */
export function assertIndependence(input: Parameters<typeof checkIndependence>[0]): void {
  const check = checkIndependence(input);
  if (check.conflictDetected) {
    throw new Error(`No se puede asignar la investigación: ${check.reasons.join("; ")}.`);
  }
}

/** Recusar exige motivo y una persona a la que reasignar el caso. */
export function assertRecusal(input: {
  reason: string | null | undefined;
  reassignedToId: string | null | undefined;
  subjectUserId?: string | null;
}): void {
  if (!input.reason) throw new Error("La recusación exige un motivo documentado.");
  if (!input.reassignedToId) {
    throw new Error("La recusación exige reasignar la investigación: un caso sin investigador queda desatendido.");
  }
  if (input.subjectUserId && input.reassignedToId === input.subjectUserId) {
    throw new Error("No se puede reasignar la investigación a la persona señalada en el caso.");
  }
}
