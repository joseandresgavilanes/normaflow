/** Enforces least-privilege payloads for member identity/role data. */

/**
 * Grado de acceso al directorio de personas.
 *
 * `directory` existe porque asignar trabajo y administrar la plantilla no son
 * la misma decisión: para escribir «responsable: Ana» hace falta el nombre de
 * Ana, no su correo ni la potestad de cambiarle el rol.
 */
export type MemberAccess = "none" | "directory" | "full";

export function memberAccessFor(can: (permission: string) => boolean): MemberAccess {
  if (can("members:view")) return "full";
  if (can("members:directory")) return "directory";
  return "none";
}

export function memberPayload<T>(canReadMembers: boolean, members: T[]): T[] {
  return canReadMembers ? members : [];
}

/**
 * Recorta la lista de personas al grado concedido.
 *
 * En `directory` se conservan el nombre, el rol y las capacidades derivadas
 * —hacen falta para asignar y para saber quién puede aprobar— y se quita el
 * correo, que es dato de contacto personal y no herramienta de asignación.
 *
 * El tipo de retorno es deliberadamente una unión: obliga a quien pinte el
 * correo a contemplar que puede no venir, en vez de renderizar «undefined».
 */
export function directoryPayload<T extends { email?: unknown }>(
  access: MemberAccess,
  members: T[],
): Array<T | Omit<T, "email">> {
  if (access === "none") return [];
  if (access === "full") return members;
  return members.map(({ email: _contacto, ...resto }) => resto);
}
