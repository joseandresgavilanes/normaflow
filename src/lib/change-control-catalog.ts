/**
 * Catálogo controlado para solicitudes de cambio.
 * ISO 9001 §6.3 (planificación de cambios) e ISO 27001 (gestión de cambios)
 * no obligan a valores fijos, pero sí a clasificar, evaluar impacto y autorizar.
 * Un vocabulario cerrado facilita trazabilidad y análisis en auditoría.
 */

export const CHANGE_CATEGORIES = [
  "Proceso / operación",
  "Documentación controlada",
  "Sistema de gestión (SGC / SGSI)",
  "TI / seguridad de la información",
  "Infraestructura / recursos",
  "Producto / servicio",
  "Proveedor / externo",
  "Recursos humanos / competencias",
  "Legal / normativo",
] as const;

export const CHANGE_TYPES = [
  "Mejora planificada",
  "Correctivo (NC / auditoría)",
  "Preventivo",
  "Documental",
  "Organizativo",
  "Tecnológico / sistema",
  "Emergencia / urgente",
] as const;

export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const DEFAULT_CHANGE_CATEGORY: ChangeCategory = "Proceso / operación";
export const DEFAULT_CHANGE_TYPE: ChangeType = "Mejora planificada";

/** Incluye valor histórico al editar registros creados antes del catálogo. */
export function changeCategoryOptions(current?: string): string[] {
  if (current && !CHANGE_CATEGORIES.includes(current as ChangeCategory)) {
    return [current, ...CHANGE_CATEGORIES];
  }
  return [...CHANGE_CATEGORIES];
}

export function changeTypeOptions(current?: string): string[] {
  if (current && !CHANGE_TYPES.includes(current as ChangeType)) {
    return [current, ...CHANGE_TYPES];
  }
  return [...CHANGE_TYPES];
}
