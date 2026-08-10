/** Tema visual del producto. */
export type Theme = "light" | "dark";
/** `system` no es un tema: es "no elijo, respeta el sistema operativo". */
export type ThemePreference = Theme | "system";

export const THEME_COOKIE = "nf_theme";
/** Un año: la preferencia de tema no caduca por sesión. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isThemePreference(value: string | undefined | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Preferencia guardada, o `system` si no hay ninguna.
 *
 * Devolver `system` cuando falta la cookie —en vez de `light`— es lo que hace
 * que el bloque `@media (prefers-color-scheme: dark)` pueda actuar: si se
 * escribiera `data-theme="light"` por defecto, ese bloque quedaría anulado por
 * especificidad y el modo oscuro no se activaría nunca solo.
 */
export function readThemePreference(cookieValue: string | undefined): ThemePreference {
  return isThemePreference(cookieValue) ? cookieValue : "system";
}
