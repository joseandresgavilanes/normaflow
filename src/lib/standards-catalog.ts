/**
 * Catálogo maestro de normas y cláusulas.
 *
 * Fuente de verdad para sembrar (idempotentemente) las tablas globales
 * `Standard` y `Clause` cuando una organización adopta una norma.
 *
 * IDs deterministas (`cl-9001-4.1`) para que el upsert sea seguro en
 * producción: nunca duplica, solo añade lo que falte. Los capítulos
 * (`cl-9001-4`) coinciden con los IDs que creó el seed original, por lo
 * que las organizaciones existentes no se ven afectadas.
 */

export type ClauseSpec = {
  code: string;
  title: string;
  description?: string;
  /** Código del capítulo padre (p. ej. "4" para "4.1"). */
  parent?: string;
};

export type StandardSpec = {
  code: "ISO_9001" | "ISO_27001";
  name: string;
  version: string;
  description: string;
  clauses: ClauseSpec[];
};

const ISO_9001_CLAUSES: ClauseSpec[] = [
  { code: "4", title: "Contexto de la organización" },
  { code: "4.1", title: "Comprensión de la organización y de su contexto", parent: "4" },
  { code: "4.2", title: "Comprensión de las necesidades y expectativas de las partes interesadas", parent: "4" },
  { code: "4.3", title: "Determinación del alcance del sistema de gestión de la calidad", parent: "4" },
  { code: "4.4", title: "Sistema de gestión de la calidad y sus procesos", parent: "4" },
  { code: "5", title: "Liderazgo" },
  { code: "5.1", title: "Liderazgo y compromiso", parent: "5" },
  { code: "5.2", title: "Política de la calidad", parent: "5" },
  { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", parent: "5" },
  { code: "6", title: "Planificación" },
  { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", parent: "6" },
  { code: "6.2", title: "Objetivos de la calidad y planificación para lograrlos", parent: "6" },
  { code: "6.3", title: "Planificación de los cambios", parent: "6" },
  { code: "7", title: "Apoyo" },
  { code: "7.1", title: "Recursos", parent: "7" },
  { code: "7.2", title: "Competencia", parent: "7" },
  { code: "7.3", title: "Toma de conciencia", parent: "7" },
  { code: "7.4", title: "Comunicación", parent: "7" },
  { code: "7.5", title: "Información documentada", parent: "7" },
  { code: "8", title: "Operación" },
  { code: "8.1", title: "Planificación y control operacional", parent: "8" },
  { code: "8.2", title: "Requisitos para los productos y servicios", parent: "8" },
  { code: "8.3", title: "Diseño y desarrollo de los productos y servicios", parent: "8" },
  { code: "8.4", title: "Control de los procesos, productos y servicios suministrados externamente", parent: "8" },
  { code: "8.5", title: "Producción y provisión del servicio", parent: "8" },
  { code: "8.6", title: "Liberación de los productos y servicios", parent: "8" },
  { code: "8.7", title: "Control de las salidas no conformes", parent: "8" },
  { code: "9", title: "Evaluación del desempeño" },
  { code: "9.1", title: "Seguimiento, medición, análisis y evaluación", parent: "9" },
  { code: "9.2", title: "Auditoría interna", parent: "9" },
  { code: "9.3", title: "Revisión por la dirección", parent: "9" },
  { code: "10", title: "Mejora" },
  { code: "10.1", title: "Generalidades", parent: "10" },
  { code: "10.2", title: "No conformidad y acción correctiva", parent: "10" },
  { code: "10.3", title: "Mejora continua", parent: "10" },
];

const ISO_27001_CLAUSES: ClauseSpec[] = [
  { code: "4", title: "Contexto de la organización" },
  { code: "4.1", title: "Comprensión de la organización y de su contexto", parent: "4" },
  { code: "4.2", title: "Comprensión de las necesidades y expectativas de las partes interesadas", parent: "4" },
  { code: "4.3", title: "Determinación del alcance del SGSI", parent: "4" },
  { code: "4.4", title: "Sistema de gestión de la seguridad de la información", parent: "4" },
  { code: "5", title: "Liderazgo" },
  { code: "5.1", title: "Liderazgo y compromiso", parent: "5" },
  { code: "5.2", title: "Política de seguridad de la información", parent: "5" },
  { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", parent: "5" },
  { code: "6", title: "Planificación" },
  { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", parent: "6" },
  { code: "6.1.2", title: "Evaluación de riesgos de seguridad de la información", parent: "6.1" },
  { code: "6.1.3", title: "Tratamiento de riesgos de seguridad de la información", parent: "6.1" },
  { code: "6.2", title: "Objetivos de seguridad de la información y planificación para lograrlos", parent: "6" },
  { code: "6.3", title: "Planificación de los cambios", parent: "6" },
  { code: "7", title: "Apoyo" },
  { code: "7.1", title: "Recursos", parent: "7" },
  { code: "7.2", title: "Competencia", parent: "7" },
  { code: "7.3", title: "Toma de conciencia", parent: "7" },
  { code: "7.4", title: "Comunicación", parent: "7" },
  { code: "7.5", title: "Información documentada", parent: "7" },
  { code: "8", title: "Operación" },
  { code: "8.1", title: "Planificación y control operacional", parent: "8" },
  { code: "8.2", title: "Apreciación de los riesgos de seguridad de la información", parent: "8" },
  { code: "8.3", title: "Tratamiento de los riesgos de seguridad de la información", parent: "8" },
  { code: "9", title: "Evaluación del desempeño" },
  { code: "9.1", title: "Seguimiento, medición, análisis y evaluación", parent: "9" },
  { code: "9.2", title: "Auditoría interna", parent: "9" },
  { code: "9.3", title: "Revisión por la dirección", parent: "9" },
  { code: "10", title: "Mejora" },
  { code: "10.1", title: "Mejora continua", parent: "10" },
  { code: "10.2", title: "No conformidad y acción correctiva", parent: "10" },
  { code: "A.5", title: "Controles organizacionales (Anexo A — 37 controles)" },
  { code: "A.6", title: "Controles de personas (Anexo A — 8 controles)" },
  { code: "A.7", title: "Controles físicos (Anexo A — 14 controles)" },
  { code: "A.8", title: "Controles tecnológicos (Anexo A — 34 controles)" },
];

export const STANDARDS_CATALOG: StandardSpec[] = [
  {
    code: "ISO_9001",
    name: "ISO 9001",
    version: "2015",
    description: "Sistema de Gestión de la Calidad",
    clauses: ISO_9001_CLAUSES,
  },
  {
    code: "ISO_27001",
    name: "ISO 27001",
    version: "2022",
    description: "Sistema de Gestión de Seguridad de la Información",
    clauses: ISO_27001_CLAUSES,
  },
];

/** Prefijo del ID determinista de cláusula: cl-9001-<code> / cl-27001-<code>. */
export function clauseIdFor(standardCode: StandardSpec["code"], clauseCode: string): string {
  const prefix = standardCode === "ISO_9001" ? "cl-9001" : "cl-27001";
  return `${prefix}-${clauseCode}`;
}

export function getStandardSpec(code: string): StandardSpec | null {
  return STANDARDS_CATALOG.find((s) => s.code === code) ?? null;
}
