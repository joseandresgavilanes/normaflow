"use server";

import { cookies } from "next/headers";
import {
  DATE_FORMAT_COOKIE, DEFAULT_HOME, HOME_COOKIE, MOTION_COOKIE, PREFERENCE_COOKIE_MAX_AGE,
  PRIVATE_MODE_COOKIE, TIME_ZONE_COOKIE,
  isHomeOption, readMotionPreference,
  type HomeOption, type MotionPreference,
} from "@/lib/preferences/config";
import { readDateFormat, readTimeZone } from "@/lib/format/datetime";

/* `httpOnly: false` como el tema: el cliente necesita leerlas para reflejar el
   estado del control sin esperar a un viaje al servidor, y ninguna es
   información sensible. */
const COOKIE_OPTIONS = {
  path: "/",
  maxAge: PREFERENCE_COOKIE_MAX_AGE,
  sameSite: "lax",
  httpOnly: false,
} as const;

/**
 * Página a la que se entra tras iniciar sesión.
 *
 * El valor se valida contra la lista cerrada de destinos: acaba en un
 * `router.push`, así que un valor libre sería una redirección abierta.
 */
export async function setHomePreference(value: string): Promise<{ home: HomeOption }> {
  const home: HomeOption = isHomeOption(value) ? value : DEFAULT_HOME;
  const cookieStore = await cookies();
  cookieStore.set(HOME_COOKIE, home, COOKIE_OPTIONS);
  return { home };
}

/** Modo privado: oculta cifras y nombres al compartir pantalla. */
export async function setPrivateMode(enabled: boolean): Promise<{ privateMode: boolean }> {
  const cookieStore = await cookies();
  cookieStore.set(PRIVATE_MODE_COOKIE, enabled ? "1" : "0", COOKIE_OPTIONS);
  return { privateMode: enabled };
}

/**
 * Zona horaria y formato de fecha.
 *
 * La zona se valida contra el propio motor de `Intl`: un identificador
 * inventado hace que `Intl.DateTimeFormat` lance, y una fecha que revienta el
 * render es peor que una fecha en la zona equivocada.
 */
export async function setDateDisplayPreference(input: { timeZone: string; dateFormat: string }): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TIME_ZONE_COOKIE, readTimeZone(input.timeZone), COOKIE_OPTIONS);
  cookieStore.set(DATE_FORMAT_COOKIE, readDateFormat(input.dateFormat), COOKIE_OPTIONS);
}

/** Reducir animaciones por elección, además de por ajuste del sistema. */
export async function setMotionPreference(value: string): Promise<{ motion: MotionPreference }> {
  const motion = readMotionPreference(value);
  const cookieStore = await cookies();
  cookieStore.set(MOTION_COOKIE, motion, COOKIE_OPTIONS);
  return { motion };
}
