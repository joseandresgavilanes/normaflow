/**
 * Ciclo de vida de las entidades del producto, en un solo sitio.
 *
 * Cada módulo dibujaba su propio riel de etapas: `ACPMClient` con clases CSS
 * en globals.css, `ACPMLiveClient` con estilos en línea, `ChangeControlModule`
 * con flechas de texto. Tres aspectos distintos para el mismo concepto, y
 * ninguno decía en qué paso estabas de forma que un lector de pantalla lo
 * pudiera anunciar.
 *
 * Los valores salen literalmente de los enums de `prisma/schema.prisma`. Si
 * el esquema añade un estado y aquí no se declara, `stepsFor` lo devuelve
 * igualmente al final en vez de ocultarlo: perder un estado del riel es peor
 * que enseñarlo sin etiqueta bonita.
 */

export type WorkflowStep = {
  /** Valor exacto del enum de Prisma. */
  value: string;
  label: string;
  /** Qué se hace en este paso, en tres o cuatro palabras. */
  hint?: string;
};

export type WorkflowDefinition = {
  /** Clave de módulo, la misma que usa AuditLog. */
  key: string;
  /** Nombre de la entidad en singular. */
  entity: string;
  /** Camino principal, en orden. */
  steps: WorkflowStep[];
  /**
   * Salidas que no están en el camino: rechazo, cancelación, baja. Se pintan
   * aparte porque colocarlas en la fila sugeriría que hay que pasar por ellas.
   */
  exits?: WorkflowStep[];
};

const D = (value: string, label: string, hint?: string): WorkflowStep => ({ value, label, hint });

export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  document: {
    key: "document",
    entity: "Documento",
    steps: [
      D("DRAFT", "Borrador", "Redacción"),
      D("IN_REVIEW", "En revisión", "Validación"),
      D("APPROVED", "Aprobado", "Vigente"),
    ],
    exits: [D("OBSOLETE", "Obsoleto", "Retirado de uso")],
  },
  risk: {
    key: "risk",
    entity: "Riesgo",
    steps: [
      D("IDENTIFIED", "Identificado", "Registro"),
      D("UNDER_TREATMENT", "En tratamiento", "Plan en marcha"),
      D("MONITORED", "Monitorizado", "Seguimiento"),
      D("MITIGATED", "Mitigado", "Riesgo reducido"),
      D("CLOSED", "Cerrado"),
    ],
    exits: [D("ACCEPTED", "Aceptado", "Riesgo asumido")],
  },
  risk_treatment: {
    key: "risk_treatment",
    entity: "Tratamiento",
    steps: [
      D("OPEN", "Abierto"),
      D("IN_TREATMENT", "En tratamiento"),
      D("RESIDUAL_PENDING", "Residual pendiente", "Falta reevaluar"),
      D("CLOSED", "Cerrado"),
    ],
    exits: [D("ACCEPTED", "Aceptado")],
  },
  nonconformity: {
    key: "nonconformity",
    entity: "No conformidad",
    steps: [
      D("REQUEST", "Solicitud", "Apertura"),
      D("REQUEST_APPROVAL", "Aprobación", "Validación inicial"),
      D("ANALYSIS", "Análisis", "Causa raíz"),
      D("SOLUTION_APPROVAL", "Aprobación solución", "Validación"),
      D("IMPLEMENTATION", "Implementación", "Ejecución"),
      D("VERIFICATION", "Verificación", "Eficacia"),
      D("CLOSED", "Cerrada", "Verificada"),
    ],
  },
  capa: {
    key: "capa",
    entity: "CAPA",
    steps: [
      D("REGISTERED", "Registrada"),
      D("ROOT_CAUSE", "Causa raíz", "Análisis"),
      D("ACTION_PLAN", "Plan de acción"),
      D("IMPLEMENTATION", "Implementación"),
      D("VERIFICATION", "Verificación", "Eficacia"),
      D("CLOSED", "Cerrada"),
    ],
  },
  audit: {
    key: "audit",
    entity: "Auditoría",
    steps: [
      D("PLANNED", "Planificada", "Programa"),
      D("IN_PROGRESS", "En ejecución", "Trabajo de campo"),
      D("COMPLETED", "Completada", "Informe emitido"),
    ],
    exits: [D("CANCELLED", "Cancelada")],
  },
  change: {
    key: "change",
    entity: "Cambio",
    steps: [
      D("DRAFT", "Borrador"),
      D("SUBMITTED", "Enviado"),
      D("UNDER_REVIEW", "En revisión"),
      D("APPROVED", "Aprobado"),
      D("IMPLEMENTED", "Implementado"),
      D("VERIFIED", "Verificado"),
      D("CLOSED", "Cerrado"),
    ],
    exits: [D("REJECTED", "Rechazado", "No se implanta")],
  },
  incident: {
    key: "incident",
    entity: "Incidente",
    steps: [
      D("DETECTED", "Detectado"),
      D("TRIAGED", "Clasificado", "Prioridad asignada"),
      D("INVESTIGATING", "En investigación"),
      D("CONTAINED", "Contenido", "Impacto acotado"),
      D("ERADICATED", "Erradicado", "Causa eliminada"),
      D("RECOVERED", "Recuperado", "Servicio restablecido"),
      D("CLOSED", "Cerrado", "Lecciones registradas"),
    ],
  },
  vulnerability: {
    key: "vulnerability",
    entity: "Vulnerabilidad",
    steps: [
      D("OPEN", "Abierta"),
      D("IN_PROGRESS", "En remediación"),
      D("REMEDIATED", "Remediada"),
      D("VERIFIED", "Verificada"),
      D("CLOSED", "Cerrada"),
    ],
    exits: [D("ACCEPTED", "Aceptada", "Riesgo asumido")],
  },
  continuity_plan: {
    key: "continuity_plan",
    entity: "Plan de continuidad",
    steps: [
      D("DRAFT", "Borrador"),
      D("UNDER_REVIEW", "En revisión"),
      D("APPROVED", "Aprobado", "Activable"),
    ],
    exits: [D("RETIRED", "Retirado")],
  },
  action: {
    key: "action",
    entity: "Acción",
    steps: [D("OPEN", "Abierta"), D("IN_PROGRESS", "En curso"), D("DONE", "Hecha")],
  },
  asset: {
    key: "asset",
    entity: "Activo",
    steps: [D("ACTIVE", "Activo"), D("UNDER_REVIEW", "En revisión"), D("INACTIVE", "Inactivo")],
    exits: [D("RETIRED", "Dado de baja")],
  },
  supplier: {
    key: "supplier",
    entity: "Proveedor",
    steps: [
      D("UNDER_REVIEW", "En evaluación"),
      D("CONDITIONAL", "Condicional", "Aprobado con reservas"),
      D("APPROVED", "Aprobado"),
    ],
    exits: [D("SUSPENDED", "Suspendido")],
  },
  training: {
    key: "training",
    entity: "Formación",
    steps: [
      D("ASSIGNED", "Asignada"),
      D("IN_PROGRESS", "En curso"),
      D("COMPLETED", "Completada"),
    ],
    exits: [
      D("OVERDUE", "Vencida"),
      D("RETRAINING_REQUIRED", "Requiere repetirse"),
      D("CANCELLED", "Cancelada"),
    ],
  },
  record: {
    key: "record",
    entity: "Registro",
    steps: [D("DRAFT", "Borrador"), D("VALID", "Vigente"), D("ARCHIVED", "Archivado")],
    exits: [D("EXPIRED", "Caducado")],
  },
  evidence: {
    key: "evidence",
    entity: "Evidencia",
    steps: [D("PENDING_REVIEW", "Pendiente de revisión"), D("VALID", "Vigente")],
    exits: [D("EXPIRED", "Caducada")],
  },
};

/**
 * Estado de cada paso respecto al actual.
 *
 * Si el estado actual es una salida (rechazado, cancelado), el camino
 * principal queda pendiente y la salida se marca como error: es información
 * distinta de "va por el paso 3".
 */
export function stepStatuses(
  definition: WorkflowDefinition,
  current: string,
): { step: WorkflowStep; status: "done" | "current" | "pending" | "error" }[] {
  const exit = definition.exits?.find((e) => e.value === current);
  const index = definition.steps.findIndex((s) => s.value === current);

  const path = definition.steps.map((step, i) => ({
    step,
    status: exit
      ? ("pending" as const)
      : i < index
        ? ("done" as const)
        : i === index
          ? ("current" as const)
          : ("pending" as const),
  }));

  if (exit) return [...path, { step: exit, status: "error" as const }];

  // Estado que el esquema conoce y este registro no: se muestra al final en
  // vez de desaparecer del riel.
  if (index === -1 && current) {
    return [...path, { step: { value: current, label: current }, status: "current" as const }];
  }
  return path;
}

export function workflowFor(key: string): WorkflowDefinition | undefined {
  return WORKFLOWS[key];
}

/** Etiqueta legible de un estado, buscando en camino y salidas. */
export function statusLabel(key: string, value: string): string {
  const definition = WORKFLOWS[key];
  if (!definition) return value;
  return (
    definition.steps.find((s) => s.value === value)?.label ??
    definition.exits?.find((s) => s.value === value)?.label ??
    value
  );
}
