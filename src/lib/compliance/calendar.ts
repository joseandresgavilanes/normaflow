/**
 * Calendario de obligaciones y alertas (ISO 37301 §8.1).
 *
 * Puro y determinista: el estado de un vencimiento se calcula siempre a partir
 * de la fecha de referencia que se le pasa, nunca de `new Date()` escondido
 * dentro. Así el informe de hoy y la prueba de ayer coinciden.
 */
import type { CalendarItemStatus, CalendarRecurrence } from "@prisma/client";

const DAY_MS = 86400000;

/** Días entre dos fechas, en días completos y con signo (negativo = pasado). */
export function daysUntil(dueDate: Date, today: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((due - now) / DAY_MS);
}

export type CalendarItemState = {
  status: CalendarItemStatus;
  daysRemaining: number;
  /** Cierto cuando toca avisar: dentro de la ventana de preaviso o ya vencido. */
  alertDue: boolean;
  overdueDays: number;
};

/**
 * Estado de un vencimiento. `COMPLETED` y `CANCELLED` son terminales y no se
 * recalculan: un vencimiento cumplido tarde sigue estando cumplido.
 */
export function calendarState(input: {
  dueDate: Date;
  leadTimeDays?: number | null;
  completedAt?: Date | null;
  cancelled?: boolean;
  today: Date;
}): CalendarItemState {
  const daysRemaining = daysUntil(input.dueDate, input.today);
  const overdueDays = daysRemaining < 0 ? -daysRemaining : 0;

  if (input.cancelled) return { status: "CANCELLED", daysRemaining, alertDue: false, overdueDays: 0 };
  if (input.completedAt) return { status: "COMPLETED", daysRemaining, alertDue: false, overdueDays: 0 };

  const leadTime = Math.max(0, input.leadTimeDays ?? 0);
  if (daysRemaining < 0) return { status: "OVERDUE", daysRemaining, alertDue: true, overdueDays };
  if (daysRemaining <= leadTime) return { status: "DUE_SOON", daysRemaining, alertDue: true, overdueDays: 0 };
  return { status: "SCHEDULED", daysRemaining, alertDue: false, overdueDays: 0 };
}

const MONTHS_BY_RECURRENCE: Record<CalendarRecurrence, number> = {
  ONCE: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
  BIENNIAL: 24,
};

/**
 * Siguiente ocurrencia de una obligación recurrente, o null si no se repite.
 * Se apoya en `setUTCMonth`, que ya normaliza el 31 de enero + 1 mes.
 */
export function nextOccurrence(dueDate: Date, recurrence: CalendarRecurrence): Date | null {
  const months = MONTHS_BY_RECURRENCE[recurrence];
  if (!months) return null;
  const next = new Date(dueDate.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export type CalendarAlert = {
  id: string;
  code: string;
  title: string;
  dueDate: Date;
  status: CalendarItemStatus;
  daysRemaining: number;
  responsibleId: string | null;
  /** Cierto si ya se avisó: evita repetir la misma notificación cada carga. */
  alreadyAlerted: boolean;
};

/**
 * Vencimientos que exigen aviso hoy. Devuelve lo próximo primero, porque un
 * calendario ordenado por urgencia es el que se mira.
 */
export function dueAlerts(
  rows: {
    id: string;
    code: string;
    title: string;
    dueDate: Date;
    leadTimeDays?: number | null;
    completedAt?: Date | null;
    status?: CalendarItemStatus;
    responsibleId?: string | null;
    alertSentAt?: Date | null;
  }[],
  today: Date,
): CalendarAlert[] {
  return rows
    .map((row) => ({ row, state: calendarState({ ...row, cancelled: row.status === "CANCELLED", today }) }))
    .filter(({ state }) => state.alertDue)
    .map(({ row, state }) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      dueDate: row.dueDate,
      status: state.status,
      daysRemaining: state.daysRemaining,
      responsibleId: row.responsibleId ?? null,
      alreadyAlerted: Boolean(row.alertSentAt),
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** Cerrar un vencimiento exige fecha y quién lo cumplió. */
export function assertCalendarCompletion(input: { completedById: string | null | undefined }): void {
  if (!input.completedById) {
    throw new Error("Marcar un vencimiento como cumplido exige registrar quién lo cumplió.");
  }
}

export type CalendarSummary = {
  total: number;
  scheduled: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  /** Cumplimiento en plazo: cumplidos antes de su fecha / cumplidos. */
  onTimeRate: number | null;
};

export function summarizeCalendar(
  rows: { dueDate: Date; leadTimeDays?: number | null; completedAt?: Date | null; status?: CalendarItemStatus }[],
  today: Date,
): CalendarSummary {
  const states = rows.map((row) => ({
    row,
    state: calendarState({ ...row, cancelled: row.status === "CANCELLED", today }),
  }));
  const completed = states.filter(({ state }) => state.status === "COMPLETED");
  const onTime = completed.filter(({ row }) => row.completedAt && row.completedAt.getTime() <= row.dueDate.getTime());
  return {
    total: rows.length,
    scheduled: states.filter(({ state }) => state.status === "SCHEDULED").length,
    dueSoon: states.filter(({ state }) => state.status === "DUE_SOON").length,
    overdue: states.filter(({ state }) => state.status === "OVERDUE").length,
    completed: completed.length,
    onTimeRate: completed.length === 0 ? null : Math.round((onTime.length / completed.length) * 100),
  };
}
