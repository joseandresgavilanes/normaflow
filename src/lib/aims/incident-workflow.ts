/**
 * Investigación de incidentes de IA (ISO/IEC 42001 §A.10.4).
 *
 * Estrictamente lineal — cada transición avanza exactamente un paso; los saltos
 * y los retrocesos se rechazan. Puro y testable; lo usan la server action, la UI
 * y los tests.
 *
 *   REPORTED → TRIAGED → INVESTIGATING → ROOT_CAUSE → ACTION_PLAN
 *            → IMPLEMENTED → EFFECTIVENESS_VERIFIED → CLOSED
 */
import type { AIIncidentStatus } from "@prisma/client";

export const AI_INCIDENT_FLOW: AIIncidentStatus[] = [
  "REPORTED",
  "TRIAGED",
  "INVESTIGATING",
  "ROOT_CAUSE",
  "ACTION_PLAN",
  "IMPLEMENTED",
  "EFFECTIVENESS_VERIFIED",
  "CLOSED",
];

/** El único estado que puede seguir a `status`, o null al final del flujo. */
export function nextAIIncidentStatus(status: AIIncidentStatus): AIIncidentStatus | null {
  const index = AI_INCIDENT_FLOW.indexOf(status);
  return index >= 0 && index < AI_INCIDENT_FLOW.length - 1 ? AI_INCIDENT_FLOW[index + 1] : null;
}

/** Cierto solo para un avance de exactamente un paso. */
export function canTransitionAIIncident(from: AIIncidentStatus, to: AIIncidentStatus): boolean {
  return nextAIIncidentStatus(from) === to;
}

/** Lanza un error descriptivo salvo que la transición avance un único paso. */
export function assertAIIncidentTransition(from: AIIncidentStatus, to: AIIncidentStatus): void {
  if (from === to) throw new Error(`El incidente ya está en estado ${from}.`);
  const expected = nextAIIncidentStatus(from);
  if (expected === null) throw new Error(`El incidente está en estado final (${from}); no admite más transiciones.`);
  if (to !== expected) {
    throw new Error(`Transición no permitida: de ${from} solo se puede avanzar a ${expected} (no se permiten saltos).`);
  }
}

export function isTerminalAIIncidentStatus(status: AIIncidentStatus): boolean {
  return status === "CLOSED";
}

/**
 * Un incidente con daño a personas o brecha de privacidad exige decidir de
 * forma explícita si hay obligación de notificar antes de cerrar la causa raíz.
 */
export function requiresNotificationDecision(type: string, affectedCount: number | null | undefined): boolean {
  return type === "PRIVACY_BREACH" || type === "SECURITY_BREACH" || type === "HARMFUL_OUTPUT" || (affectedCount ?? 0) > 0;
}
