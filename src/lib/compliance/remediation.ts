/**
 * Planes de remediación (ISO 37301 §10.1).
 *
 * El estado se deriva del avance y de las fechas, no se teclea: así un plan
 * vencido no puede seguir apareciendo "en curso" porque nadie lo tocó.
 */
import type { RemediationPlanStatus } from "@prisma/client";

const ALLOWED: Record<RemediationPlanStatus, RemediationPlanStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "OVERDUE", "CANCELLED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextRemediationStatuses(status: RemediationPlanStatus): RemediationPlanStatus[] {
  return ALLOWED[status] ?? [];
}

export function assertRemediationTransition(from: RemediationPlanStatus, to: RemediationPlanStatus): void {
  if (from === to) throw new Error(`El plan ya está en estado ${from}.`);
  if (from === "COMPLETED") throw new Error("Un plan completado no se reabre: registre un plan nuevo.");
  if (from === "CANCELLED") throw new Error("Un plan cancelado no se reactiva: registre un plan nuevo.");
  if (!nextRemediationStatuses(from).includes(to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextRemediationStatuses(from).join(", ")}.`);
  }
}

/** Un plan solo se ejecuta si alguien lo aprobó. */
export function assertApproved(input: { approvedById: string | null | undefined; approvedAt: Date | null | undefined }): void {
  if (!input.approvedById || !input.approvedAt) {
    throw new Error("Un plan de remediación solo puede ejecutarse tras su aprobación registrada.");
  }
}

/**
 * Estado efectivo del plan a día de hoy. `OVERDUE` es una consecuencia de la
 * fecha, no una decisión: en cuanto pasa el vencimiento sin completar, lo está.
 */
export function effectiveStatus(
  row: { status: RemediationPlanStatus; dueDate?: Date | null; completedAt?: Date | null },
  today: Date,
): RemediationPlanStatus {
  if (row.status === "COMPLETED" || row.status === "CANCELLED" || row.status === "DRAFT") return row.status;
  if (row.completedAt) return "COMPLETED";
  if (row.dueDate && row.dueDate < today) return "OVERDUE";
  return row.status;
}

/**
 * Verificar la eficacia exige plan completado y un verificador distinto del
 * responsable: nadie certifica su propio trabajo (también lo exige un CHECK).
 */
export function assertEffectivenessVerification(input: {
  status: RemediationPlanStatus;
  completedAt: Date | null | undefined;
  verifierId: string | null | undefined;
  ownerId: string | null | undefined;
  note: string | null | undefined;
}): void {
  if (input.status !== "COMPLETED" || !input.completedAt) {
    throw new Error("La eficacia solo se verifica sobre un plan completado.");
  }
  if (!input.verifierId) throw new Error("Verificar la eficacia exige registrar quién verifica.");
  if (input.ownerId && input.verifierId === input.ownerId) {
    throw new Error("La eficacia de un plan no puede verificarla su propio responsable.");
  }
  if (!input.note) throw new Error("Verificar la eficacia exige registrar en qué se basa la conclusión.");
}

export type RemediationSummary = {
  total: number;
  inProgress: number;
  overdue: number;
  completed: number;
  verified: number;
  /** Planes completados cuya eficacia nadie verificó: cierres a medias. */
  completedNotVerified: number;
  averageProgress: number | null;
};

export function summarizeRemediation(
  rows: {
    status: RemediationPlanStatus;
    dueDate?: Date | null;
    completedAt?: Date | null;
    progressPercent: number;
    effectivenessVerified: boolean;
  }[],
  today: Date,
): RemediationSummary {
  const states = rows.map((row) => ({ row, status: effectiveStatus(row, today) }));
  const completed = states.filter(({ status }) => status === "COMPLETED");
  return {
    total: rows.length,
    inProgress: states.filter(({ status }) => status === "IN_PROGRESS").length,
    overdue: states.filter(({ status }) => status === "OVERDUE").length,
    completed: completed.length,
    verified: rows.filter((row) => row.effectivenessVerified).length,
    completedNotVerified: completed.filter(({ row }) => !row.effectivenessVerified).length,
    averageProgress: rows.length === 0 ? null : Math.round(rows.reduce((sum, row) => sum + row.progressPercent, 0) / rows.length),
  };
}
