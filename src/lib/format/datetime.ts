import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Formateo de fechas con zona horaria explícita.
 *
 * El producto formateaba con `date-fns` y con `toLocaleDateString`, y ninguno
 * de los dos recibía zona: ambos usan la del entorno que ejecuta el código. En
 * el navegador eso es la del equipo; en un componente de servidor, la del
 * contenedor —normalmente UTC. La misma fecha de evidencia se veía distinta
 * según quién y desde dónde la mirase, y esa fecha acaba en un informe de
 * auditoría. Aquí la zona es siempre un dato explícito.
 *
 * `Intl.DateTimeFormat` y no `date-fns` porque es el único que convierte a una
 * zona arbitraria sin dependencias extra: `format()` de date-fns siempre
 * imprime en la zona local del proceso.
 */

export type DateFormatStyle = "dmy" | "mdy" | "iso";

export const DATE_FORMAT_OPTIONS: { value: DateFormatStyle; label: string; sample: string }[] = [
  { value: "dmy", label: "Día/mes/año", sample: "31/12/2026" },
  { value: "mdy", label: "Mes/día/año", sample: "12/31/2026" },
  { value: "iso", label: "ISO 8601", sample: "2026-12-31" },
];

export function isDateFormatStyle(value: string | undefined | null): value is DateFormatStyle {
  return value === "dmy" || value === "mdy" || value === "iso";
}

/** `system` = la zona del dispositivo; cualquier otro valor es una zona IANA. */
export const SYSTEM_TIME_ZONE = "system";

/**
 * Zona válida según el propio motor de `Intl`.
 *
 * Se valida en vez de confiar en la cookie: un valor inventado hace que
 * `Intl.DateTimeFormat` lance, y una fecha que revienta el render es peor que
 * una fecha en la zona equivocada.
 */
export function isValidTimeZone(value: string | undefined | null): boolean {
  if (!value || value === SYSTEM_TIME_ZONE) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function readTimeZone(value: string | undefined): string {
  return isValidTimeZone(value) ? (value as string) : SYSTEM_TIME_ZONE;
}

export function readDateFormat(value: string | undefined): DateFormatStyle {
  return isDateFormatStyle(value) ? value : "dmy";
}

export type DateFormatContext = {
  timeZone?: string;
  style?: DateFormatStyle;
  locale?: Locale;
};

/**
 * Preferencia vigente.
 *
 * En el cliente sale de los atributos que el servidor pintó en `<html>`, igual
 * que el tema: así cualquier `formatDate(x)` del producto la respeta sin tener
 * que pasarla por props por toda la jerarquía. En el servidor no hay `document`
 * y se cae a los valores por defecto, que es justo lo que se quiere: un
 * componente de servidor no conoce la zona del lector.
 */
function currentContext(context?: DateFormatContext): Required<DateFormatContext> {
  const root = typeof document === "undefined" ? null : document.documentElement;
  return {
    timeZone: context?.timeZone ?? root?.dataset.timezone ?? SYSTEM_TIME_ZONE,
    style: context?.style ?? readDateFormat(root?.dataset.datefmt),
    locale: context?.locale ?? DEFAULT_LOCALE,
  };
}

function zoneOption(timeZone: string): { timeZone?: string } {
  return timeZone === SYSTEM_TIME_ZONE || !isValidTimeZone(timeZone) ? {} : { timeZone };
}

const INTL_LOCALES: Record<Locale, string> = { es: "es-ES", en: "en-US", "pt-BR": "pt-BR" };

/** Fecha sin hora, en el estilo elegido. */
export function formatDate(value: Date | string | number, context?: DateFormatContext): string {
  const { timeZone, style, locale } = currentContext(context);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  if (style === "iso") {
    // `en-CA` produce YYYY-MM-DD, que es exactamente ISO 8601 en formato corto,
    // y respeta la zona horaria — cosa que `toISOString()` no hace: ese
    // siempre imprime en UTC y adelanta o atrasa el día.
    return new Intl.DateTimeFormat("en-CA", { ...zoneOption(timeZone), dateStyle: "short" }).format(date);
  }
  const parts = new Intl.DateTimeFormat(style === "mdy" ? "en-US" : INTL_LOCALES[locale], {
    ...zoneOption(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return parts;
}

/** Fecha y hora, para sellos de auditoría y trazas donde la hora importa. */
export function formatDateTime(value: Date | string | number, context?: DateFormatContext): string {
  const { timeZone, locale } = currentContext(context);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    ...zoneOption(timeZone),
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** `YYYY-MM-DD` en la zona elegida, para rellenar `<input type="date">`. */
export function formatDateInput(value: Date | string | number, context?: DateFormatContext): string {
  const { timeZone } = currentContext(context);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { ...zoneOption(timeZone), dateStyle: "short" }).format(date);
}

/** Abreviatura de la zona vigente («CEST», «GMT-5»), para acompañar una hora. */
export function timeZoneLabel(context?: DateFormatContext): string {
  const { timeZone, locale } = currentContext(context);
  try {
    const parts = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      ...zoneOption(timeZone),
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Zona del dispositivo, para enseñar qué implica «Sistema». */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Lista de zonas del motor, con reserva corta si `supportedValuesOf` no existe. */
export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const values = intl.supportedValuesOf?.("timeZone");
    if (values?.length) return values;
  } catch {
    /* motor sin soporte: se usa la reserva */
  }
  return [
    "UTC", "Europe/Madrid", "Europe/London", "Europe/Lisbon", "Europe/Berlin",
    "America/Mexico_City", "America/Bogota", "America/Lima", "America/Guayaquil",
    "America/Santiago", "America/Argentina/Buenos_Aires", "America/Sao_Paulo",
    "America/New_York", "America/Chicago", "America/Los_Angeles",
  ];
}
