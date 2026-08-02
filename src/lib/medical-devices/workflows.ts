/**
 * Workflows y reglas de expediente para QMS de dispositivos médicos.
 */
import type {
  MdAdverseEventStatus, MdComplaintStatus, MdFsaStatus, MdPmsStatus,
  MdRecallStatus, MdRecordStatus, MdTestResult,
} from "@prisma/client";

const COMPLAINT: Record<MdComplaintStatus, MdComplaintStatus[]> = {
  RECEIVED: ["TRIAGED"],
  TRIAGED: ["INVESTIGATING", "RECEIVED"],
  INVESTIGATING: ["CAPA_LINKED", "CLOSED", "TRIAGED"],
  CAPA_LINKED: ["CLOSED", "INVESTIGATING"],
  CLOSED: [],
};

const ADVERSE_EVENT: Record<MdAdverseEventStatus, MdAdverseEventStatus[]> = {
  REPORTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["REPORTED_TO_AUTHORITY", "CLOSED", "REPORTED"],
  REPORTED_TO_AUTHORITY: ["CLOSED", "UNDER_REVIEW"],
  CLOSED: [],
};

const FSA: Record<MdFsaStatus, MdFsaStatus[]> = {
  DRAFT: ["INITIATED"],
  INITIATED: ["IN_PROGRESS", "DRAFT"],
  IN_PROGRESS: ["COMPLETED", "INITIATED"],
  COMPLETED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

const PMS: Record<MdPmsStatus, MdPmsStatus[]> = {
  PLANNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED", "OVERDUE", "PLANNED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
};

const RECALL: Record<MdRecallStatus, MdRecallStatus[]> = {
  DRAFT: ["INITIATED"],
  INITIATED: ["NOTIFYING", "DRAFT"],
  NOTIFYING: ["IN_PROGRESS", "INITIATED"],
  IN_PROGRESS: ["COMPLETED", "NOTIFYING"],
  COMPLETED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

const RECORD: Record<MdRecordStatus, MdRecordStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export function nextComplaintStatuses(status: MdComplaintStatus): MdComplaintStatus[] {
  return COMPLAINT[status] ?? [];
}

export function assertComplaintTransition(from: MdComplaintStatus, to: MdComplaintStatus): void {
  if (from === to) throw new Error(`La queja ya está en estado ${from}.`);
  if (!nextComplaintStatuses(from).includes(to)) {
    throw new Error(
      `Transición de queja no permitida: de ${from} solo a ${nextComplaintStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextAdverseEventStatuses(status: MdAdverseEventStatus): MdAdverseEventStatus[] {
  return ADVERSE_EVENT[status] ?? [];
}

export function assertAdverseEventTransition(from: MdAdverseEventStatus, to: MdAdverseEventStatus): void {
  if (from === to) throw new Error(`El evento adverso ya está en estado ${from}.`);
  if (!nextAdverseEventStatuses(from).includes(to)) {
    throw new Error(
      `Transición de evento adverso no permitida: de ${from} solo a ${nextAdverseEventStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextFsaStatuses(status: MdFsaStatus): MdFsaStatus[] {
  return FSA[status] ?? [];
}

export function assertFsaTransition(from: MdFsaStatus, to: MdFsaStatus): void {
  if (from === to) throw new Error(`La acción de campo ya está en estado ${from}.`);
  if (!nextFsaStatuses(from).includes(to)) {
    throw new Error(
      `Transición de acción de campo no permitida: de ${from} solo a ${nextFsaStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextPmsStatuses(status: MdPmsStatus): MdPmsStatus[] {
  return PMS[status] ?? [];
}

export function assertPmsTransition(from: MdPmsStatus, to: MdPmsStatus): void {
  if (from === to) throw new Error(`La vigilancia post-comercialización ya está en estado ${from}.`);
  if (!nextPmsStatuses(from).includes(to)) {
    throw new Error(
      `Transición de PMS no permitida: de ${from} solo a ${nextPmsStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextRecallStatuses(status: MdRecallStatus): MdRecallStatus[] {
  return RECALL[status] ?? [];
}

export function assertRecallTransition(from: MdRecallStatus, to: MdRecallStatus): void {
  if (from === to) throw new Error(`El retiro ya está en estado ${from}.`);
  if (!nextRecallStatuses(from).includes(to)) {
    throw new Error(
      `Transición de retiro no permitida: de ${from} solo a ${nextRecallStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function nextRecordStatuses(status: MdRecordStatus): MdRecordStatus[] {
  return RECORD[status] ?? [];
}

export function assertRecordTransition(from: MdRecordStatus, to: MdRecordStatus): void {
  if (from === to) throw new Error(`El expediente ya está en estado ${from}.`);
  if (!nextRecordStatuses(from).includes(to)) {
    throw new Error(
      `Transición de expediente no permitida: de ${from} solo a ${nextRecordStatuses(from).join(", ") || "ningún estado"}.`,
    );
  }
}

export function assertRecordApproval(input: { approvedById: string | null | undefined }): void {
  if (!input.approvedById) {
    throw new Error("Aprobar un expediente maestro / DHF exige registrar quién lo aprueba.");
  }
}

export function assertTestResultAttribution(input: {
  result: MdTestResult | string;
  verifiedById?: string | null;
  validatedById?: string | null;
}): void {
  if (input.result === "PENDING") return;
  if (!input.verifiedById && !input.validatedById) {
    throw new Error("Un resultado distinto de PENDING exige atribución del evaluador.");
  }
}

/** Cobertura de inputs de diseño por outputs (por código). */
export function designInputCoverage(input: {
  inputCodes: string[];
  linkedInputCodes: string[][];
}): { covered: string[]; uncovered: string[]; percent: number } {
  const coveredSet = new Set(input.linkedInputCodes.flat());
  const covered = input.inputCodes.filter((c) => coveredSet.has(c));
  const uncovered = input.inputCodes.filter((c) => !coveredSet.has(c));
  const percent = input.inputCodes.length
    ? Math.round((covered.length / input.inputCodes.length) * 100)
    : 100;
  return { covered, uncovered, percent };
}

/** Fecha hasta la que se conserva la queja/evento adverso, contada desde su cierre. */
export function mdRetentionUntil(closedAt: Date, retentionYears: number): Date {
  const until = new Date(closedAt.getTime());
  until.setUTCFullYear(until.getUTCFullYear() + Math.max(1, Math.trunc(retentionYears)));
  return until;
}

/**
 * La purga solo procede sobre un expediente cerrado cuya retención ya venció.
 * Antes de eso es prueba de vigilancia; después es un riesgo innecesario conservarlo.
 */
export function assertMdRecordPurgeable(
  row: { closedAt?: Date | null; retentionUntil?: Date | null; purgedAt?: Date | null },
  today: Date,
  label: string,
): void {
  if (row.purgedAt) throw new Error(`${label} ya fue purgado.`);
  if (!row.closedAt) throw new Error(`Solo ${label.toLowerCase()} cerrado puede purgarse.`);
  if (!row.retentionUntil) throw new Error(`${label} no tiene plazo de retención calculado.`);
  if (row.retentionUntil > today) {
    throw new Error(`El plazo de retención de ${label.toLowerCase()} vence el ${row.retentionUntil.toISOString().slice(0, 10)}; no puede purgarse antes.`);
  }
}
