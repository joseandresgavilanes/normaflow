/**
 * Codificación del mapa de procesos.
 *
 * La convención de un SGC en español codifica el proceso por su tipo —PE para
 * los estratégicos, PO para los operativos (clave) y PA para los de apoyo—, así
 * que un código correlativo único para todos («P-01», «P-02»…) obliga a
 * renombrarlos a mano y termina con procesos estratégicos numerados como
 * operativos. El prefijo sale del tipo y la numeración corre por prefijo: cada
 * familia tiene su propia serie.
 */
export const PROCESS_CODE_PREFIXES: Record<string, string> = {
  strategic: "PE",
  core: "PO",
  support: "PA",
};

/** Prefijo del tipo. Un proceso sin tipo se queda en la serie genérica «P». */
export function processCodePrefix(type?: string | null): string {
  return PROCESS_CODE_PREFIXES[(type ?? "").trim()] ?? "P";
}

/**
 * Siguiente código libre de la serie que le toca al tipo. Solo mira los códigos
 * de esa serie: renumerar «PE» no depende de cuántos «PO» haya.
 */
export function nextProcessCode(type: string | null | undefined, existingCodes: (string | null | undefined)[]): string {
  const prefix = processCodePrefix(type);
  const serie = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let last = 0;
  for (const code of existingCodes) {
    const match = code?.trim().match(serie);
    if (match) last = Math.max(last, Number(match[1]));
  }
  return `${prefix}-${String(last + 1).padStart(2, "0")}`;
}
