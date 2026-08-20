/**
 * Preferencias de interfaz que viven en cookie.
 *
 * Mismo criterio que el tema (`src/lib/theme/config.ts`): en cookie y no en la
 * tabla de usuario porque tienen que resolverse en el servidor ANTES de pintar
 * —si no, hay destello— y porque una de ellas, la página de inicio, se
 * necesita en /login, donde todavía no hay sesión.
 */

export const HOME_COOKIE = "nf_home";
export const PRIVATE_MODE_COOKIE = "nf_private";
export const MOTION_COOKIE = "nf_motion";
export const TIME_ZONE_COOKIE = "nf_tz";
export const DATE_FORMAT_COOKIE = "nf_datefmt";
/** Un año: son preferencias, no estado de sesión. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Claves del sidebar en `localStorage`, compartidas con el botón que las limpia. */
export const NAV_PINNED_STORAGE_KEY = "nf.nav.pinned";
export const NAV_OPEN_GROUPS_STORAGE_KEY = "nf.nav.openGroups";

export const DEFAULT_HOME = "/app/dashboard";

/**
 * Destinos admitidos como página de inicio.
 *
 * Es una lista cerrada a propósito: el valor sale de una cookie y termina en
 * un `router.push`, así que aceptar texto libre convertiría la preferencia en
 * una redirección abierta —basta con escribir la cookie para llevarte a otro
 * sitio. Con la lista, un valor desconocido cae al panel.
 */
export const HOME_OPTIONS = [
  { href: "/app/dashboard", label: "Panel de control" },
  { href: "/app/audits", label: "Auditorías" },
  { href: "/app/nonconformities", label: "No conformidades" },
  { href: "/app/actions", label: "Plan de acción" },
  { href: "/app/documents", label: "Documentos" },
  { href: "/app/risks", label: "Riesgos" },
  { href: "/app/indicators", label: "Indicadores" },
  { href: "/app/standards", label: "Normas ISO" },
] as const;

export type HomeOption = (typeof HOME_OPTIONS)[number]["href"];

export function isHomeOption(value: string | undefined | null): value is HomeOption {
  return HOME_OPTIONS.some((option) => option.href === value);
}

export function readHomePreference(cookieValue: string | undefined): HomeOption {
  return isHomeOption(cookieValue) ? cookieValue : DEFAULT_HOME;
}

export function readPrivateMode(cookieValue: string | undefined): boolean {
  return cookieValue === "1";
}

/** `system` = respetar `prefers-reduced-motion`; `reduced` = reducir siempre. */
export type MotionPreference = "system" | "reduced";

export function readMotionPreference(cookieValue: string | undefined): MotionPreference {
  return cookieValue === "reduced" ? "reduced" : "system";
}
