/**
 * Matriz de correspondencia del Sistema Integrado de Gestión (SIG).
 *
 * Correspondencia completa 3 vías entre ISO 9001:2015 (calidad),
 * ISO 14001:2015 (ambiente) e ISO 45001:2018 (seguridad y salud laboral),
 * basada en la estructura de alto nivel común (Anexo SL / Apéndice 2).
 *
 * Se instala DESPUÉS de los paquetes, porque un mapeo requiere que existan sus
 * dos extremos. Los requisitos SIN mapeo son, por definición, "específicos" de
 * su norma — el crosswalk los deriva en lugar de almacenarlos.
 *
 * Solo códigos, estructura y notas propias: nunca texto normativo protegido.
 */
import type { PackMapping } from "./pack-schema";

type Rel = "EQUIVALENT" | "PARTIAL" | "RELATED";

/** Códigos compartidos por las tres normas (Anexo SL) con su grado de equivalencia. */
const ANNEX_SL: { code: string; rel: Rel; pct: number; note?: string }[] = [
  { code: "4.1", rel: "EQUIVALENT", pct: 100, note: "Comprensión de la organización y de su contexto." },
  { code: "4.2", rel: "EQUIVALENT", pct: 95, note: "Partes interesadas: en ISO 45001 incluye explícitamente a los trabajadores." },
  { code: "4.3", rel: "EQUIVALENT", pct: 95, note: "Determinación del alcance del sistema de gestión." },
  { code: "4.4", rel: "EQUIVALENT", pct: 100, note: "Sistema de gestión y sus procesos." },
  { code: "5.1", rel: "EQUIVALENT", pct: 90, note: "Liderazgo y compromiso de la alta dirección." },
  { code: "5.2", rel: "PARTIAL", pct: 80, note: "Misma estructura de política; el objeto difiere (calidad / ambiente / SST)." },
  { code: "5.3", rel: "EQUIVALENT", pct: 100, note: "Roles, responsabilidades y autoridades." },
  { code: "6.2", rel: "EQUIVALENT", pct: 90, note: "Objetivos y planificación para lograrlos." },
  { code: "7.1", rel: "EQUIVALENT", pct: 100, note: "Recursos." },
  { code: "7.2", rel: "EQUIVALENT", pct: 100, note: "Competencia (formación común)." },
  { code: "7.3", rel: "EQUIVALENT", pct: 100, note: "Toma de conciencia." },
  { code: "7.4", rel: "EQUIVALENT", pct: 95, note: "Comunicación." },
  { code: "7.5", rel: "EQUIVALENT", pct: 100, note: "Información documentada: documento compartido entre normas." },
  { code: "8.1", rel: "PARTIAL", pct: 75, note: "Planificación y control operacional; el alcance operativo difiere." },
  { code: "9.1", rel: "EQUIVALENT", pct: 90, note: "Seguimiento, medición, análisis y evaluación." },
  { code: "9.2", rel: "EQUIVALENT", pct: 100, note: "Auditoría interna: permite una auditoría integrada." },
  { code: "9.3", rel: "EQUIVALENT", pct: 100, note: "Revisión por la dirección integrada." },
  { code: "10.1", rel: "EQUIVALENT", pct: 90, note: "Generalidades de mejora." },
  { code: "10.3", rel: "EQUIVALENT", pct: 100, note: "Mejora continua." },
];

/** Pares específicos que no siguen el patrón común de código a código. */
const SPECIFIC_PAIRS: PackMapping[] = [
  // No conformidad y acción correctiva — ISO 45001 añade incidentes.
  { sourceFamily: "ISO_9001", sourceCode: "10.2", targetFamily: "ISO_14001", targetCode: "10.2", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "No conformidad y acción correctiva: CAPA común." },
  { sourceFamily: "ISO_9001", sourceCode: "10.2", targetFamily: "ISO_45001", targetCode: "10.2", relationType: "PARTIAL", equivalencePercent: 70, notes: "ISO 45001 10.2 cubre además la investigación de incidentes." },
  { sourceFamily: "ISO_14001", sourceCode: "10.2", targetFamily: "ISO_45001", targetCode: "10.2", relationType: "PARTIAL", equivalencePercent: 70, notes: "ISO 45001 10.2 cubre además la investigación de incidentes." },

  // Riesgos y oportunidades (6.1 / 6.1.1).
  { sourceFamily: "ISO_9001", sourceCode: "6.1", targetFamily: "ISO_14001", targetCode: "6.1", relationType: "PARTIAL", equivalencePercent: 80, notes: "Acciones para abordar riesgos y oportunidades; ISO 14001 desglosa aspectos y requisitos legales." },
  { sourceFamily: "ISO_9001", sourceCode: "6.1", targetFamily: "ISO_45001", targetCode: "6.1", relationType: "PARTIAL", equivalencePercent: 80, notes: "Acciones para abordar riesgos y oportunidades; ISO 45001 desglosa peligros." },
  { sourceFamily: "ISO_14001", sourceCode: "6.1.1", targetFamily: "ISO_45001", targetCode: "6.1.1", relationType: "EQUIVALENT", equivalencePercent: 90, notes: "Generalidades de la planificación de riesgos y oportunidades." },

  // Identificación: aspectos ambientales ⇄ peligros SST (misma mecánica, objeto distinto).
  { sourceFamily: "ISO_14001", sourceCode: "6.1.2", targetFamily: "ISO_45001", targetCode: "6.1.2", relationType: "PARTIAL", equivalencePercent: 65, notes: "Aspectos ambientales ⇄ identificación de peligros: misma sistemática de valoración, objeto distinto." },

  // Requisitos legales y otros requisitos — equivalente entre ambiente y SST.
  { sourceFamily: "ISO_14001", sourceCode: "6.1.3", targetFamily: "ISO_45001", targetCode: "6.1.3", relationType: "EQUIVALENT", equivalencePercent: 95, notes: "Requisitos legales y otros requisitos: registro legal compartido." },

  // Planificación de acciones.
  { sourceFamily: "ISO_14001", sourceCode: "6.1.4", targetFamily: "ISO_45001", targetCode: "6.1.4", relationType: "EQUIVALENT", equivalencePercent: 90, notes: "Planificación de acciones." },

  // Objetivos: ISO 14001 desglosa 6.2.1/6.2.2.
  { sourceFamily: "ISO_14001", sourceCode: "6.2.1", targetFamily: "ISO_9001", targetCode: "6.2", relationType: "PARTIAL", equivalencePercent: 85, notes: "Objetivos ambientales ⇄ objetivos de calidad." },
  { sourceFamily: "ISO_14001", sourceCode: "6.2.1", targetFamily: "ISO_45001", targetCode: "6.2", relationType: "PARTIAL", equivalencePercent: 85, notes: "Objetivos ambientales ⇄ objetivos de SST." },

  // Preparación y respuesta ante emergencias (14001 8.2 ⇄ 45001 8.2).
  { sourceFamily: "ISO_14001", sourceCode: "8.2", targetFamily: "ISO_45001", targetCode: "8.2", relationType: "EQUIVALENT", equivalencePercent: 90, notes: "Preparación y respuesta ante emergencias: plan y simulacros compartidos." },

  // Evaluación del cumplimiento legal (14001 9.1.2 ⇄ 45001 9.1.2).
  { sourceFamily: "ISO_14001", sourceCode: "9.1.2", targetFamily: "ISO_45001", targetCode: "9.1.2", relationType: "EQUIVALENT", equivalencePercent: 95, notes: "Evaluación del cumplimiento de requisitos legales." },
];

const FAMILIES = ["ISO_9001", "ISO_14001", "ISO_45001"] as const;

/**
 * Matriz completa: todos los pares (origen → destino) entre las tres normas.
 * Se emite una sola dirección por par (A→B) para no duplicar filas; las
 * consultas del crosswalk consideran ambos sentidos.
 */
export const SIG_CROSSWALK: PackMapping[] = [
  ...ANNEX_SL.flatMap(({ code, rel, pct, note }) =>
    FAMILIES.flatMap((source, i) =>
      FAMILIES.slice(i + 1).map((target) => ({
        sourceFamily: source,
        sourceCode: code,
        targetFamily: target,
        targetCode: code,
        relationType: rel,
        equivalencePercent: pct,
        notes: note,
      })),
    ),
  ),
  ...SPECIFIC_PAIRS,
];
