"use server";

import { getEntityHistory, type EntityHistoryEntry } from "@/lib/audit-log";
import { requireAuthorization } from "@/lib/permissions/server";

/**
 * Historial de cualquier entidad, para la línea de tiempo del detalle.
 *
 * Sustituye a `getAssetHistory`, que era el único historial por entidad del
 * producto y estaba escrito a mano para los activos.
 *
 * Sobre el aislamiento entre organizaciones: el `recordId` llega del cliente,
 * pero la consulta filtra SIEMPRE por el `organizationId` del contexto
 * autenticado, que sale de la cookie de sesión y nunca del argumento. Como
 * cada fila de AuditLog se escribe con la organización de quien la provocó,
 * un id de otro inquilino devuelve cero filas en vez de su rastro. No hace
 * falta —ni sería posible— comprobar la pertenencia contra 40 tablas
 * distintas desde aquí.
 */
export async function getRecordHistory(input: {
  /** Permiso del módulo, p. ej. "documents:read". */
  permission: string;
  /** Claves de módulo de AuditLog: la principal y sus satélites. */
  modules: string[];
  recordId: string;
}): Promise<EntityHistoryEntry[]> {
  if (!input?.recordId || !Array.isArray(input.modules) || input.modules.length === 0) return [];

  const authorization = await requireAuthorization(input.permission);
  return getEntityHistory({
    organizationId: authorization.ctx.organization.id,
    modules: input.modules,
    recordId: input.recordId,
  });
}
