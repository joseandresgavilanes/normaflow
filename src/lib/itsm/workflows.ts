/**
 * Workflows ITSM (ISO/IEC 20000).
 * Distintos de SecurityIncident / ChangeRequest corporativos.
 */
import type { ITSMChangeStatus, ITSMIncidentStatus, ITSMProblemStatus } from "@prisma/client";

const INCIDENT: Record<ITSMIncidentStatus, ITSMIncidentStatus[]> = {
  NEW: ["ASSIGNED"],
  ASSIGNED: ["INVESTIGATING", "NEW"],
  INVESTIGATING: ["RESOLVED", "ASSIGNED"],
  RESOLVED: ["CONFIRMED", "INVESTIGATING"],
  CONFIRMED: ["CLOSED", "RESOLVED"],
  CLOSED: [],
};

const PROBLEM: Record<ITSMProblemStatus, ITSMProblemStatus[]> = {
  IDENTIFIED: ["ANALYSIS"],
  ANALYSIS: ["KNOWN_ERROR", "IDENTIFIED"],
  KNOWN_ERROR: ["REMEDIATION", "ANALYSIS"],
  REMEDIATION: ["RESOLVED", "KNOWN_ERROR"],
  RESOLVED: ["CLOSED", "REMEDIATION"],
  CLOSED: [],
};

const CHANGE: Record<ITSMChangeStatus, ITSMChangeStatus[]> = {
  REQUESTED: ["ASSESSED"],
  ASSESSED: ["APPROVED", "REQUESTED"],
  APPROVED: ["SCHEDULED", "ASSESSED"],
  SCHEDULED: ["IMPLEMENTED", "APPROVED"],
  IMPLEMENTED: ["REVIEWED", "SCHEDULED"],
  REVIEWED: ["CLOSED", "IMPLEMENTED"],
  CLOSED: [],
};

export function nextItsmIncidentStatuses(status: ITSMIncidentStatus): ITSMIncidentStatus[] {
  return INCIDENT[status] ?? [];
}

export function assertItsmIncidentTransition(from: ITSMIncidentStatus, to: ITSMIncidentStatus): void {
  if (from === to) throw new Error(`El incidente ITSM ya está en estado ${from}.`);
  if (!nextItsmIncidentStatuses(from).includes(to)) {
    throw new Error(
      `Transición de incidente no permitida: de ${from} solo a ${nextItsmIncidentStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextItsmProblemStatuses(status: ITSMProblemStatus): ITSMProblemStatus[] {
  return PROBLEM[status] ?? [];
}

export function assertItsmProblemTransition(from: ITSMProblemStatus, to: ITSMProblemStatus): void {
  if (from === to) throw new Error(`El problema ya está en estado ${from}.`);
  if (!nextItsmProblemStatuses(from).includes(to)) {
    throw new Error(
      `Transición de problema no permitida: de ${from} solo a ${nextItsmProblemStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextItsmChangeStatuses(status: ITSMChangeStatus): ITSMChangeStatus[] {
  return CHANGE[status] ?? [];
}

export function assertItsmChangeTransition(from: ITSMChangeStatus, to: ITSMChangeStatus): void {
  if (from === to) throw new Error(`El cambio ITSM ya está en estado ${from}.`);
  if (!nextItsmChangeStatuses(from).includes(to)) {
    throw new Error(
      `Transición de cambio no permitida: de ${from} solo a ${nextItsmChangeStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function assertItsmChangeApproval(input: { approvedById: string | null | undefined }): void {
  if (!input.approvedById) {
    throw new Error("Aprobar un cambio ITSM exige registrar quién lo aprueba.");
  }
}

/** % disponibilidad = (periodo − downtime) / periodo × 100 */
export function availabilityPercent(periodMinutes: number, downtimeMinutes: number): number {
  if (periodMinutes <= 0) throw new Error("El periodo de disponibilidad debe ser positivo.");
  if (downtimeMinutes < 0) throw new Error("El downtime no puede ser negativo.");
  const value = ((periodMinutes - Math.min(downtimeMinutes, periodMinutes)) / periodMinutes) * 100;
  return Math.round(value * 100) / 100;
}

/** Cumplimiento de SLA: resolución dentro del objetivo. */
export function slaMet(input: {
  responseDueMinutes: number;
  resolutionDueMinutes: number;
  responseActualMinutes?: number | null;
  resolutionActualMinutes?: number | null;
}): { responseMet: boolean | null; resolutionMet: boolean | null; overallMet: boolean | null } {
  const responseMet =
    typeof input.responseActualMinutes === "number"
      ? input.responseActualMinutes <= input.responseDueMinutes
      : null;
  const resolutionMet =
    typeof input.resolutionActualMinutes === "number"
      ? input.resolutionActualMinutes <= input.resolutionDueMinutes
      : null;
  const overallMet =
    responseMet === null && resolutionMet === null
      ? null
      : (responseMet !== false) && (resolutionMet !== false);
  return { responseMet, resolutionMet, overallMet };
}
