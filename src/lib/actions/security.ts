"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireLiveContext } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * Cambio de contraseña.
 *
 * La aplicación NO toca la contraseña: pide a Supabase que envíe su correo de
 * restablecimiento a la dirección de la cuenta autenticada. Así la contraseña
 * nueva se escribe en el flujo de Supabase, sobre su propio dominio, y nunca
 * pasa por este servidor ni por sus registros.
 *
 * El correo se toma del contexto, no de un formulario: aceptar una dirección
 * de entrada convertiría esto en un enviador de correos a terceros.
 */
export async function requestPasswordReset(): Promise<{ sentTo: string }> {
  const ctx = await requireLiveContext();
  if (!isSupabaseConfigured()) {
    throw new Error("El restablecimiento de contraseña requiere Supabase configurado.");
  }
  if (!ctx.user.email) throw new Error("Tu cuenta no tiene un correo asociado.");

  const supabase = await createSupabaseServerClient();
  /* `/auth/set-password` es la ruta que ya existe para escribir una contraseña
     nueva tras seguir un enlace de Supabase; inventar otra habría dejado el
     correo apuntando a un 404. */
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/set-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(ctx.user.email, {
    redirectTo: redirectTo || undefined,
  });
  if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`);

  /* Queda en la traza: un cambio de credencial es un evento de seguridad, y
     que conste quién lo pidió y cuándo es lo que se revisa después. */
  await logAuditEvent({
    ctx, action: "request_password_reset", module: "account", recordId: ctx.user.id,
  });
  return { sentTo: ctx.user.email };
}
