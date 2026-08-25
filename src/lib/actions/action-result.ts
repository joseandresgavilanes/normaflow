import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";

/**
 * Resultado de una Server Action que puede fallar por una regla de negocio.
 *
 * Next.js sustituye el mensaje de cualquier excepción que escape de una Server
 * Action por un texto genérico en las builds de producción, para no filtrar
 * detalles internos. El efecto colateral es que las validaciones escritas para
 * que alguien las lea —«asigna un revisor antes de enviar el registro a
 * revisión»— llegan al navegador convertidas en un párrafo sobre digests. Por
 * eso el fallo viaja como valor de retorno, que Next no toca, en vez de como
 * excepción.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string };

const GENERIC = "No se pudo completar la operación. Inténtalo de nuevo.";

/**
 * Los errores de autorización se reconocen por `name`, que sus clases fijan a
 * propósito, y no importando `@/lib/permissions/server`: ese módulo arrastra el
 * contexto de la petición entero y dejaría esta utilidad imposible de probar
 * fuera de una request.
 */
const AUTH_MESSAGES: Record<string, string> = {
  PermissionError: "No tienes permiso para realizar esta acción.",
  UnauthenticatedError: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  TenantMismatchError: "Ese recurso no pertenece a tu organización.",
};

/**
 * Traduce lo que se lanzó a algo que una persona pueda leer.
 *
 * Solo el `Error` corriente enseña su mensaje: es la forma en que este código
 * escribe sus reglas de negocio. Los errores del driver y los de autorización
 * traen texto interno —nombres de columna, `Forbidden: missing permission …`—
 * así que se quedan en el log del servidor y salen con un texto neutro.
 */
function messageFor(error: unknown): string {
  if (error instanceof Error && AUTH_MESSAGES[error.name]) return AUTH_MESSAGES[error.name];
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) return GENERIC;
  if (error instanceof Error && error.message.trim()) return error.message;
  return GENERIC;
}

/**
 * Envuelve el cuerpo de una acción. `unstable_rethrow` va primero porque
 * `redirect()` y `notFound()` señalizan lanzando: capturarlos como si fueran
 * fallos rompería la navegación.
 */
export async function actionResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[action]", error);
    return { ok: false, message: messageFor(error) };
  }
}
