"use server";

import { cookies } from "next/headers";
import { isThemePreference, THEME_COOKIE, THEME_COOKIE_MAX_AGE, type ThemePreference } from "@/lib/theme/config";

/**
 * Guarda la preferencia de tema.
 *
 * En cookie y no en la tabla de usuario a propósito: el tema debe funcionar en
 * /login y /signup, donde todavía no hay sesión, y no debería obligar a una
 * escritura en base de datos por cada clic en el conmutador.
 */
export async function setThemePreference(value: string): Promise<{ theme: ThemePreference }> {
  const theme: ThemePreference = isThemePreference(value) ? value : "system";
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    // No es información sensible y el cliente necesita leerla para reflejar el
    // estado del conmutador sin esperar a un viaje al servidor.
    httpOnly: false,
  });
  return { theme };
}
