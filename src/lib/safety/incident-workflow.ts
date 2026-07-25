/**
 * Occupational incident investigation workflow (ISO 45001 §10.2).
 *
 * Strictly linear — every transition must advance exactly one step; jumps and
 * backward moves are rejected. Pure and testable; used by the server action and
 * the tests.
 *
 *   REPORTED → CLASSIFIED → INVESTIGATING → ROOT_CAUSE → ACTION_PLAN
 *            → IMPLEMENTED → EFFECTIVENESS_VERIFIED → CLOSED
 */
import type { OccupationalIncidentStatus } from "@prisma/client";

export const INCIDENT_FLOW: OccupationalIncidentStatus[] = [
  "REPORTED",
  "CLASSIFIED",
  "INVESTIGATING",
  "ROOT_CAUSE",
  "ACTION_PLAN",
  "IMPLEMENTED",
  "EFFECTIVENESS_VERIFIED",
  "CLOSED",
];

/** The single status that may follow `status`, or null at the end of the flow. */
export function nextIncidentStatus(status: OccupationalIncidentStatus): OccupationalIncidentStatus | null {
  const i = INCIDENT_FLOW.indexOf(status);
  return i >= 0 && i < INCIDENT_FLOW.length - 1 ? INCIDENT_FLOW[i + 1] : null;
}

/** True only for a forward-by-one transition. */
export function canTransitionIncident(from: OccupationalIncidentStatus, to: OccupationalIncidentStatus): boolean {
  return nextIncidentStatus(from) === to;
}

/** Throw a descriptive error unless the transition advances exactly one step. */
export function assertIncidentTransition(from: OccupationalIncidentStatus, to: OccupationalIncidentStatus): void {
  if (from === to) throw new Error(`El incidente ya está en estado ${from}.`);
  const expected = nextIncidentStatus(from);
  if (expected === null) throw new Error(`El incidente está en estado final (${from}); no admite más transiciones.`);
  if (to !== expected) {
    throw new Error(`Transición no permitida: de ${from} solo se puede avanzar a ${expected} (no se permiten saltos).`);
  }
}

export function isTerminalIncidentStatus(status: OccupationalIncidentStatus): boolean {
  return status === "CLOSED";
}
