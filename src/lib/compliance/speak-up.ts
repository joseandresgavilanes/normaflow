/**
 * Canal de denuncias (ISO 37301 §8.3, ISO 37002, Directiva (UE) 2019/1937).
 *
 * Reglas del canal, puras y sin base de datos:
 *   - el anonimato solo existe si la configuración lo habilita, y cuando existe
 *     la identidad no se guarda "por si acaso": se descarta antes de escribir;
 *   - el caso avanza por estados, y acusar recibo es obligatorio antes de
 *     triarlo: la persona que denuncia sabe que su caso existe;
 *   - la asignación es restringida y sensible al conflicto: quien está señalado
 *     en la denuncia nunca la gestiona;
 *   - el cierre exige resultado y resumen, y la retención fija cuándo puede
 *     destruirse el caso, ni antes ni por olvido.
 *
 * La base de datos vuelve a exigir todo esto con CHECK constraints y una
 * política RLS restrictiva; aquí solo obtenemos mensajes legibles y pruebas
 * rápidas.
 */
import type {
  ReportIdentificationMode,
  SpeakUpOutcome,
  SpeakUpStatus,
} from "@prisma/client";

// ── Modo de identificación ───────────────────────────

export type ChannelConfig = {
  allowAnonymous: boolean;
  allowConfidential: boolean;
  acknowledgementDays: number;
  feedbackDays: number;
  retentionMonths: number;
};

export const DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
  allowAnonymous: true,
  allowConfidential: true,
  acknowledgementDays: 7,
  feedbackDays: 90,
  retentionMonths: 60,
};

/** El modo pedido solo es válido si la organización lo tiene habilitado. */
export function assertModeAllowed(mode: ReportIdentificationMode, config: ChannelConfig): void {
  if (mode === "ANONYMOUS" && !config.allowAnonymous) {
    throw new Error("Esta organización no admite denuncias anónimas. Use el modo confidencial o identificado.");
  }
  if (mode === "CONFIDENTIAL" && !config.allowConfidential) {
    throw new Error("Esta organización no admite denuncias confidenciales.");
  }
}

export type ReporterIdentity = {
  reporterUserId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
};

/**
 * Identidad que se persiste según el modo. En anónimo se devuelve todo a null:
 * no se guarda la identidad ni cifrada ni "solo para el receptor". Lo que no se
 * escribe no se puede filtrar.
 */
export function identityForMode(
  mode: ReportIdentificationMode,
  input: Partial<ReporterIdentity>,
): ReporterIdentity {
  if (mode === "ANONYMOUS") {
    return { reporterUserId: null, reporterName: null, reporterEmail: null, reporterPhone: null };
  }
  return {
    reporterUserId: input.reporterUserId ?? null,
    reporterName: input.reporterName ?? null,
    reporterEmail: input.reporterEmail ?? null,
    reporterPhone: input.reporterPhone ?? null,
  };
}

/** Un caso identificado sin identidad no es identificado, es anónimo mal etiquetado. */
export function assertIdentityConsistent(mode: ReportIdentificationMode, identity: ReporterIdentity): void {
  const hasIdentity = Boolean(identity.reporterUserId || identity.reporterName || identity.reporterEmail || identity.reporterPhone);
  if (mode === "ANONYMOUS" && hasIdentity) {
    throw new Error("Una denuncia anónima no puede almacenar ningún dato del informante.");
  }
  if (mode !== "ANONYMOUS" && !hasIdentity) {
    throw new Error(`Una denuncia en modo ${mode} exige al menos un dato de contacto del informante.`);
  }
}

// ── Flujo del caso ───────────────────────────────────

const ALLOWED_STATUS: Record<SpeakUpStatus, SpeakUpStatus[]> = {
  RECEIVED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["UNDER_TRIAGE"],
  UNDER_TRIAGE: ["ADMISSIBLE", "INADMISSIBLE"],
  ADMISSIBLE: ["UNDER_INVESTIGATION", "RESOLVED"],
  INADMISSIBLE: ["CLOSED"],
  UNDER_INVESTIGATION: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function nextStatuses(status: SpeakUpStatus): SpeakUpStatus[] {
  return ALLOWED_STATUS[status] ?? [];
}

export function canTransitionStatus(from: SpeakUpStatus, to: SpeakUpStatus): boolean {
  return nextStatuses(from).includes(to);
}

export function assertStatusTransition(from: SpeakUpStatus, to: SpeakUpStatus): void {
  if (from === to) throw new Error(`El caso ya está en estado ${from}.`);
  if (from === "CLOSED") throw new Error("Un caso cerrado no admite más transiciones.");
  if (to === "UNDER_TRIAGE" && from === "RECEIVED") {
    throw new Error("Antes de triar el caso hay que acusar recibo al informante.");
  }
  if (!canTransitionStatus(from, to)) {
    throw new Error(`Transición no permitida: de ${from} solo se puede pasar a ${nextStatuses(from).join(", ") || "ningún estado"}.`);
  }
}

/** La decisión de admisibilidad se atribuye y se motiva. */
export function assertAdmissibilityDecision(input: {
  decidedById: string | null | undefined;
  rationale: string | null | undefined;
}): void {
  if (!input.decidedById) throw new Error("La decisión de admisibilidad exige registrar quién decide.");
  if (!input.rationale) throw new Error("La decisión de admisibilidad exige un motivo documentado.");
}

/** El cierre exige resultado, resumen y persona que cierra. */
export function assertClosure(input: {
  outcome: SpeakUpOutcome | null | undefined;
  summary: string | null | undefined;
  closedById: string | null | undefined;
}): void {
  if (!input.outcome) throw new Error("Cerrar un caso exige registrar su resultado.");
  if (!input.summary) throw new Error("Cerrar un caso exige un resumen de cierre para el informante y el expediente.");
  if (!input.closedById) throw new Error("Cerrar un caso exige registrar quién lo cierra.");
}

// ── Plazos ───────────────────────────────────────────

const DAY_MS = 86400000;

export type CaseDeadlines = { acknowledgementDueAt: Date; feedbackDueAt: Date };

/** Plazos de acuse y de respuesta al informante, contados desde la recepción. */
export function caseDeadlines(receivedAt: Date, config: ChannelConfig): CaseDeadlines {
  return {
    acknowledgementDueAt: new Date(receivedAt.getTime() + Math.max(1, config.acknowledgementDays) * DAY_MS),
    feedbackDueAt: new Date(receivedAt.getTime() + Math.max(1, config.feedbackDays) * DAY_MS),
  };
}

export type DeadlineBreaches = {
  acknowledgementOverdue: boolean;
  feedbackOverdue: boolean;
};

/**
 * Incumplimiento de plazos. Un plazo ya atendido no se incumple, aunque se
 * atendiera tarde: para eso está la fecha real en el expediente.
 */
export function deadlineBreaches(
  row: {
    acknowledgementDueAt?: Date | null;
    acknowledgedAt?: Date | null;
    feedbackDueAt?: Date | null;
    feedbackProvidedAt?: Date | null;
    status: SpeakUpStatus;
  },
  today: Date,
): DeadlineBreaches {
  const pendingAck = !row.acknowledgedAt && Boolean(row.acknowledgementDueAt) && row.acknowledgementDueAt! < today;
  const pendingFeedback =
    !row.feedbackProvidedAt && row.status !== "CLOSED" && Boolean(row.feedbackDueAt) && row.feedbackDueAt! < today;
  return { acknowledgementOverdue: pendingAck, feedbackOverdue: pendingFeedback };
}

/** Fecha hasta la que se conserva el caso, contada desde su cierre. */
export function retentionUntil(closedAt: Date, config: ChannelConfig): Date {
  const until = new Date(closedAt.getTime());
  until.setUTCMonth(until.getUTCMonth() + Math.max(1, config.retentionMonths));
  return until;
}

/**
 * La purga solo procede sobre un caso cerrado cuya retención ya venció. Antes de
 * eso el expediente es prueba, y después es un riesgo innecesario conservarlo.
 */
export function assertPurgeable(
  row: { status: SpeakUpStatus; retentionUntil?: Date | null; purgedAt?: Date | null },
  today: Date,
): void {
  if (row.purgedAt) throw new Error("El caso ya fue purgado.");
  if (row.status !== "CLOSED") throw new Error("Solo un caso cerrado puede purgarse.");
  if (!row.retentionUntil) throw new Error("El caso no tiene plazo de retención calculado.");
  if (row.retentionUntil > today) {
    throw new Error(`El plazo de retención del caso vence el ${row.retentionUntil.toISOString().slice(0, 10)}; no puede purgarse antes.`);
  }
}

// ── Asignación restringida ───────────────────────────

export type HandlerChoice = {
  handlerId: string | null;
  /** Por qué se eligió a esta persona (o por qué no hay nadie elegible). */
  reason: string;
  /** Cierto cuando el receptor designado quedó excluido por conflicto. */
  divertedFromDefault: boolean;
};

/**
 * Elige quién recibe el caso. Se descarta a la persona señalada en la denuncia y
 * a quien la presentó: nadie tría su propio caso ni el que le acusa. Si el
 * receptor designado queda excluido, entra el suplente, y esa desviación se
 * devuelve explícita para dejarla en el expediente.
 */
export function chooseHandler(input: {
  defaultHandlerId?: string | null;
  alternateHandlerId?: string | null;
  fallbackIds?: string[];
  subjectUserId?: string | null;
  reporterUserId?: string | null;
  /** Personas con conflicto declarado y abstención obligatoria. */
  recusedIds?: string[];
}): HandlerChoice {
  const excluded = new Set(
    [input.subjectUserId, input.reporterUserId, ...(input.recusedIds ?? [])].filter((id): id is string => Boolean(id)),
  );
  const candidates = [input.defaultHandlerId, input.alternateHandlerId, ...(input.fallbackIds ?? [])].filter(
    (id): id is string => Boolean(id),
  );

  for (const [index, candidate] of candidates.entries()) {
    if (excluded.has(candidate)) continue;
    const isDefault = index === 0 && candidate === input.defaultHandlerId;
    return {
      handlerId: candidate,
      reason: isDefault ? "receptor designado del canal" : "el receptor designado no puede gestionar este caso (conflicto de interés)",
      divertedFromDefault: !isDefault,
    };
  }

  return {
    handlerId: null,
    reason: "no hay ninguna persona elegible para gestionar el caso sin conflicto de interés",
    divertedFromDefault: true,
  };
}

// ── Integridad del expediente ────────────────────────

export type CaseIntegrity = { valid: boolean; problems: string[] };

/**
 * Comprueba que un caso almacenado no contradiga las reglas del canal. Cualquier
 * problema aquí es un incidente de gobernanza, no un detalle de datos: alimenta
 * el contador de infracciones del panel y del informe de auditoría.
 */
export function caseIntegrity(row: {
  identificationMode: ReportIdentificationMode;
  reporterUserId?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterPhone?: string | null;
  status: SpeakUpStatus;
  outcome?: SpeakUpOutcome | null;
  closedAt?: Date | null;
  closedById?: string | null;
  closureSummary?: string | null;
  admissibilityById?: string | null;
  admissibilityRationale?: string | null;
  purgedAt?: Date | null;
  retentionUntil?: Date | null;
}): CaseIntegrity {
  const problems: string[] = [];
  if (row.identificationMode === "ANONYMOUS" && (row.reporterUserId || row.reporterName || row.reporterEmail || row.reporterPhone)) {
    problems.push("caso anónimo con datos del informante");
  }
  if ((row.status === "ADMISSIBLE" || row.status === "INADMISSIBLE") && (!row.admissibilityById || !row.admissibilityRationale)) {
    problems.push("decisión de admisibilidad sin autor o sin motivo");
  }
  if (row.status === "CLOSED" && (!row.outcome || !row.closedAt || !row.closedById || !row.closureSummary)) {
    problems.push("cierre incompleto");
  }
  if (row.purgedAt && (!row.retentionUntil || row.purgedAt < row.retentionUntil)) {
    problems.push("purga anterior al vencimiento de la retención");
  }
  return { valid: problems.length === 0, problems };
}

/** Estados en los que el caso sigue vivo. */
export function isOpenCase(status: SpeakUpStatus): boolean {
  return status !== "CLOSED";
}
