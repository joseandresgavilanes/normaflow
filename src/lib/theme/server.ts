import { cookies } from "next/headers";
import { readThemePreference, THEME_COOKIE, type ThemePreference } from "./config";

/**
 * Preferencia de tema resuelta en el servidor.
 *
 * Copia el patrón de `src/lib/i18n/server.ts`: leer la cookie en el servidor y
 * pintar el atributo en el HTML inicial. Así no hace falta un script
 * bloqueante en `<head>` y no hay destello de tema claro antes de hidratar.
 */
export async function getServerTheme(): Promise<ThemePreference> {
  const cookieStore = await cookies();
  return readThemePreference(cookieStore.get(THEME_COOKIE)?.value);
}
