/**
 * Workflows y reglas de expediente para QMS de dispositivos médicos.
 */
import type { MdComplaintStatus, MdRecallStatus, MdRecordStatus, MdTestResult } from "@prisma/client";

const COMPLAINT: Record<MdComplaintStatus, MdComplaintStatus[]> = {
  RECEIVED: ["TRIAGED"],
  TRIAGED: ["INVESTIGATING", "RECEIVED"],
  INVESTIGATING: ["CAPA_LINKED", "CLOSED", "TRIAGED"],
  CAPA_LINKED: ["CLOSED", "INVESTIGATING"],
  CLOSED: [],
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
