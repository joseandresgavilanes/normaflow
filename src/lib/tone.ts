/**
 * Par de color texto/fondo para una insignia de estado.
 *
 * El producto repetía por todas partes el mismo atajo: tomar UN color y usarlo
 * de texto y, concatenándole "22" de alfa, también de fondo —
 * `chip(color + "22", color)`. Ese par nunca cumple contraste, porque el fondo
 * hereda el tono del propio texto: medido, entre 1.00:1 y 4.36:1.
 *
 * El sistema ya distingue las dos cosas: el token de relleno (`--nf-success`,
 * 3:1, válido para barras, iconos y fondos) del token de texto
 * (`--nf-success-text`, 4.5:1). Esta tabla traduce del primero al par correcto,
 * y acepta también los hex heredados para poder migrar sin reescribir los mapas
 * de cada módulo.
 */

export type TonePair = { bg: string; fg: string };

const PARES: Record<string, TonePair> = {
  success: { bg: "var(--nf-success-subtle)", fg: "var(--nf-success-text)" },
  warning: { bg: "var(--nf-warning-subtle)", fg: "var(--nf-warning-text)" },
  danger: { bg: "var(--nf-danger-subtle)", fg: "var(--nf-danger-text)" },
  info: { bg: "var(--nf-info-subtle)", fg: "var(--nf-info-text)" },
  primary: { bg: "var(--nf-primary-subtle)", fg: "var(--nf-primary-active)" },
  neutral: { bg: "var(--nf-surface-muted)", fg: "var(--nf-text-secondary)" },
};

/** Valores que los módulos siguen usando y a qué tono corresponden. */
const ALIAS: Record<string, keyof typeof PARES> = {
  "var(--nf-success)": "success",
  "var(--nf-success-text)": "success",
  "var(--nf-warning)": "warning",
  "var(--nf-warning-text)": "warning",
  "var(--nf-danger)": "danger",
  "var(--nf-danger-text)": "danger",
  "var(--nf-info)": "info",
  "var(--nf-info-text)": "info",
  "var(--nf-primary)": "primary",
  "var(--nf-primary-active)": "primary",
  "var(--nf-accent)": "primary",
  // Hex heredados que aún viven en los mapas de estado de los módulos.
  "#16a34a": "success", "#15803d": "success", "#1f6f45": "success",
  "#d97706": "warning", "#b45309": "warning", "#d68a1a": "warning", "#9a6510": "warning",
  "#dc2626": "danger", "#b91c1c": "danger", "#a62d29": "danger", "#8c2f39": "danger",
  "#0e7490": "info", "#0f766e": "info",
  "#5266f6": "primary", "#3b4bd8": "primary", "#123c66": "primary",
  "#64748b": "neutral", "#8794a5": "neutral", "#c3ccd8": "neutral", "#667085": "neutral",
};

/**
 * Par correcto para un valor de color cualquiera.
 *
 * Cuando el valor no se reconoce cae en el tono neutro, que siempre cumple: es
 * preferible una insignia gris legible a una de color ilegible.
 */
export function toneOf(value: string | undefined | null): TonePair {
  if (!value) return PARES.neutral;
  const clave = ALIAS[value.trim().toLowerCase()];
  return PARES[clave ?? "neutral"];
}

/** Estilo listo para una insignia, con el par ya resuelto. */
export function toneChip(value: string | undefined | null): React.CSSProperties {
  const { bg, fg } = toneOf(value);
  return {
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: 99,
    display: "inline-block",
  };
}
