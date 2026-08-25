import type { ActionResult } from "./action-result";

/**
 * Devuelve el valor de una acción o lanza su mensaje.
 *
 * El `throw` ocurre ya en el navegador, donde Next no reescribe nada, así que
 * el `try/catch` que cada pantalla tenía alrededor de la llamada sigue
 * funcionando igual y muestra el texto que escribió la acción.
 */
export function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/**
 * Reconoce el fallo de una acción envuelta sin conocer su tipo concreto.
 *
 * Lo usa `useServerAction`, que recibe la llamada ya hecha y solo ve el valor
 * resuelto: así cada módulo hereda los mensajes buenos con solo envolver sus
 * acciones, sin tocar una por una las llamadas de su pantalla.
 */
export function isActionFailure(value: unknown): value is { ok: false; message: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { ok?: unknown; message?: unknown };
  return candidate.ok === false && typeof candidate.message === "string";
}
