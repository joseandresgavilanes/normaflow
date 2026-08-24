"use server";

import { revalidatePath } from "next/cache";
import { requireLiveContext } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { revokeUserSession } from "@/lib/sessions";

/**
 * Cierra una sesión de la propia cuenta.
 *
 * El usuario sale del contexto autenticado, nunca del formulario: con un id de
 * sesión ajeno en el cuerpo, aceptar el usuario de entrada permitiría cerrar la
 * sesión de otra persona.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const ctx = await requireLiveContext();
  if (!sessionId.trim()) throw new Error("Sesión no válida.");

  await revokeUserSession(ctx.user.authUserId, sessionId);

  /* Cerrar una sesión es un evento de seguridad: si alguien revoca la sesión
     de un dispositivo robado, el registro es la prueba de cuándo se hizo. */
  await logAuditEvent({
    ctx, action: "revoke_session", module: "account", recordId: ctx.user.id,
    after: { sessionId },
  });
  revalidatePath("/app/settings");
}
