import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sesiones activas de la cuenta.
 *
 * Los datos viven en `auth.sessions`, el esquema interno de Supabase, porque
 * es el único sitio donde existen: el SDK no expone «lista mis sesiones».
 * Toda la dependencia de ese esquema queda encerrada en este módulo —una sola
 * consulta que revisar si una actualización de GoTrue cambia columnas— en vez
 * de repartida por la aplicación.
 */

export type ActiveSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
  ip: string | null;
  userAgent: string | null;
  /** `aal2` = la sesión pasó por un segundo factor. */
  aal: string | null;
  current: boolean;
};

/**
 * Los dos identificadores que cruzan este módulo van a columnas `uuid`, y
 * Postgres rechaza el resto antes de mirar el `WHERE`. Comprobarlo aquí
 * convierte un error crudo del driver en una respuesta vacía manejable.
 */
function isAuthUserId(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Identificador de la sesión en curso.
 *
 * Sale del `session_id` del token, que es el único vínculo entre la petición y
 * la fila de `auth.sessions`. Se necesita para marcar «esta sesión» y para que
 * cerrarla no parezca un cierre cualquiera.
 */
async function currentSessionId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: string };
    return claims.session_id ?? null;
  } catch {
    return null;
  }
}

/**
 * El identificador es siempre el de `auth.users` (un UUID), nunca `User.id`:
 * la tabla de la aplicación usa CUID y `auth.sessions.user_id` es `uuid`, así
 * que pasar el id de Prisma reventaba la consulta con un 22P02 y la pantalla
 * se quedaba sin sesiones en silencio. `null` cuando la cuenta no tiene fila
 * en `auth.users`, que entonces tampoco tiene sesiones que enseñar.
 */
export async function listUserSessions(authUserId: string | null): Promise<ActiveSession[]> {
  if (!isAuthUserId(authUserId)) return [];
  try {
    const currentId = await currentSessionId();
    /* host(ip) y no ip::text: la columna es `inet` y el texto crudo sale como
       «186.47.137.92/32», con una máscara que no significa nada para quien
       revisa desde dónde está abierta su cuenta. */
    const rows = await prisma.$queryRaw<{
      id: string; created_at: Date | null; refreshed_at: Date | null;
      ip: string | null; user_agent: string | null; aal: string | null;
    }[]>`
      SELECT id::text, created_at, refreshed_at, host(ip) AS ip, user_agent, aal::text
      FROM auth.sessions
      WHERE user_id = ${authUserId}::uuid
        AND (not_after IS NULL OR not_after > now())
      ORDER BY COALESCE(refreshed_at, created_at) DESC
      LIMIT 20
    `;
    return rows.map((row) => ({
      id: row.id,
      createdAt: (row.created_at ?? new Date()).toISOString(),
      lastSeenAt: row.refreshed_at?.toISOString() ?? null,
      ip: row.ip,
      userAgent: row.user_agent,
      aal: row.aal,
      current: currentId === row.id,
    }));
  } catch (error) {
    // Sin sesiones que enseñar es mejor que una pantalla de cuenta rota: el
    // usuario del pool podría no tener permiso sobre el esquema `auth`.
    console.error("[sessions] no se pudieron listar", error);
    return [];
  }
}

/**
 * Cierra una sesión.
 *
 * Filtra por `user_id` además de por id: sin eso, un identificador de otra
 * persona cerraría su sesión.
 */
export async function revokeUserSession(authUserId: string | null, sessionId: string): Promise<void> {
  if (!isAuthUserId(authUserId)) throw new Error("Esta cuenta no tiene sesiones que cerrar.");
  await prisma.$executeRaw`
    DELETE FROM auth.sessions WHERE id = ${sessionId}::uuid AND user_id = ${authUserId}::uuid
  `;
}
