/**
 * Incumplimientos de compliance (ISO 37301 §10.1).
 *
 * Dos decisiones no se pueden posponer: si hay que notificar a la autoridad y en
 * qué plazo. El resto del expediente puede madurar; la notificación caduca.
 */
import type { BreachSeverity, BreachStatus, ComplianceCategory } from "@prisma/client";

const ALLOWED: Record<BreachStatus, BreachStatus[]> = {
  OPEN: ["UNDER_ANALYSIS"],
  UNDER_ANALYSIS: ["UNDER_REMEDIATION", "CLOSED"],
  UNDER_REMEDIATION: ["REMEDIATED"],
  REMEDIATED: ["CLOSED"],
  CLOSED: [],
};

export function nextBreachStatuses(status: BreachStatus): BreachStatus[] {
  return ALLOWED[status] ?? [];
}

export function canTransitionBreach(from: BreachStatus, to: BreachStatus): boolean {
  return nextBreachStatuses(from).includes(to);
}

export function assertBreachTransition(from: BreachStatus, to: BreachStatus): void {
  if (from === to) throw new Error(`El incumplimiento ya está en estado ${from}.`);
  if (from === "CLOSED") throw new Error("Un incumplimiento cerrado no admite más transiciones.");
  if (!canTransitionBreach(from, to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextBreachStatuses(from).join(", ") || "ningún estado"}.`);
  }
}

/** Categorías con obligación de notificar a la autoridad por su propia naturaleza. */
const NOTIFIABLE_CATEGORIES: ComplianceCategory[] = [
  "DATA_PROTECTION",
  "ANTI_MONEY_LAUNDERING",
  "ANTIBRIBERY",
  "TRADE_SANCTIONS",
  "FINANCIAL_REPORTING",
  "OCCUPATIONAL_SAFETY",
  "ENVIRONMENTAL",
];

/**
 * ¿Hay que decidir sobre notificación? Se decide siempre en categorías con deber
 * legal de comunicación y en todo incumplimiento grave. "Decidir" incluye
 * decidir que no procede, pero deja constancia de que se pensó.
 */
export function requiresNotificationDecision(category: ComplianceCategory, severity: BreachSeverity): boolean {
  if (NOTIFIABLE_CATEGORIES.includes(category)) return true;
  return severity === "MAJOR" || severity === "SEVERE";
}

/** Plazo por defecto de notificación, en horas, por categoría. */
export function notificationDeadlineHours(category: ComplianceCategory): number {
  // 72 h es el plazo de brecha de datos personales (RGPD art. 33); el resto se
  // trata como comunicación en 30 días naturales salvo plazo sectorial propio.
  return category === "DATA_PROTECTION" ? 72 : 24 * 30;
}

export function notificationDeadline(detectedAt: Date, category: ComplianceCategory): Date {
  return new Date(detectedAt.getTime() + notificationDeadlineHours(category) * 3600000);
}

/** Cierto cuando el plazo de notificación venció sin haber notificado. */
export function notificationOverdue(
  row: { notificationRequired: boolean; notificationDeadline?: Date | null; authorityNotifiedAt?: Date | null },
  today: Date,
): boolean {
  if (!row.notificationRequired || row.authorityNotifiedAt) return false;
  return Boolean(row.notificationDeadline && row.notificationDeadline < today);
}

/**
 * Cerrar un incumplimiento exige firma, causa raíz y remediación verificada. Sin
 * eso el cierre es administrativo y el incumplimiento vuelve.
 */
export function assertBreachClosure(input: {
  closedById: string | null | undefined;
  rootCause: string | null | undefined;
  remediationVerified: boolean;
  notificationRequired: boolean;
  authorityNotifiedAt: Date | null | undefined;
}): void {
  if (!input.closedById) throw new Error("Cerrar un incumplimiento exige registrar quién lo cierra.");
  if (!input.rootCause) throw new Error("Cerrar un incumplimiento exige su causa raíz documentada.");
  if (!input.remediationVerified) {
    throw new Error("Cerrar un incumplimiento exige un plan de remediación completado y verificado como eficaz.");
  }
  if (input.notificationRequired && !input.authorityNotifiedAt) {
    throw new Error("El incumplimiento requiere notificación a la autoridad y no consta como notificado.");
  }
}

export type BreachSummary = {
  total: number;
  open: number;
  severe: number;
  recurrent: number;
  pendingNotification: number;
  overdueNotification: number;
  totalSanctions: number;
};

export function summarizeBreaches(
  rows: {
    status: BreachStatus;
    severity: BreachSeverity;
    recurrence: boolean;
    notificationRequired: boolean;
    notificationDeadline?: Date | null;
    authorityNotifiedAt?: Date | null;
    sanctionAmount?: number | null;
  }[],
  today: Date,
): BreachSummary {
  return {
    total: rows.length,
    open: rows.filter((row) => row.status !== "CLOSED").length,
    severe: rows.filter((row) => row.severity === "SEVERE" || row.severity === "MAJOR").length,
    recurrent: rows.filter((row) => row.recurrence).length,
    pendingNotification: rows.filter((row) => row.notificationRequired && !row.authorityNotifiedAt).length,
    overdueNotification: rows.filter((row) => notificationOverdue(row, today)).length,
    totalSanctions: rows.reduce((total, row) => total + (row.sanctionAmount ?? 0), 0),
  };
}
