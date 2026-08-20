/**
 * Navegador y sistema a partir del user-agent, a ojo.
 *
 * Vive fuera de `lib/sessions.ts` a propósito: ese módulo es `server-only`
 * —toca el esquema `auth` de Supabase— y la tarjeta de sesiones es un
 * componente de cliente. Importarlo desde allí revienta en ejecución aunque
 * el tipado pase.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) && !/Chrome/.test(userAgent) ? "Safari"
    : /Firefox\//.test(userAgent) ? "Firefox" : "Navegador";
  const os = /Windows/.test(userAgent) ? "Windows"
    : /Macintosh|Mac OS/.test(userAgent) ? "macOS"
    : /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad/.test(userAgent) ? "iOS"
    : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
