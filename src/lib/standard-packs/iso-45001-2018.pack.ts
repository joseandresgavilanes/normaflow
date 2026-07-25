import type { StandardPackInput } from "./pack-schema";

/**
 * ISO 45001:2018 — Sistema de Gestión de Seguridad y Salud en el Trabajo.
 *
 * Only clause codes, structure and NormaFlow's OWN Spanish titles/summaries —
 * never the protected full text of the standard. Requirement ids resolve to the
 * stable `req-iso-45001-<code>` form via `requirementIdFor`.
 */
export const iso45001Pack: StandardPackInput = {
  code: "PACK_ISO_45001",
  name: "ISO 45001 — Seguridad y salud",
  version: "2018.1",
  description: "Paquete normativo ISO 45001:2018 (Seguridad y Salud en el Trabajo).",
  requiredModules: [
    "gap", "documents", "audits", "nc", "capa", "indicators", "mgmt-review", "training", "suppliers", "safety",
  ],
  featureFlags: { occupationalSafety: true },
  editions: [
    {
      familyCode: "ISO_45001",
      familyName: "ISO 45001",
      category: "Seguridad y salud",
      familyDescription: "Sistema de Gestión de Seguridad y Salud en el Trabajo",
      editionCode: "2018",
      name: "ISO 45001",
      version: "2018",
      year: 2018,
      description: "Sistema de Gestión de Seguridad y Salud en el Trabajo",
      catalogVersion: "2018.1",
      status: "ACTIVE",
      requirements: [
        { code: "4", title: "Contexto de la organización" },
        { code: "4.1", title: "Comprensión de la organización y de su contexto", parent: "4" },
        { code: "4.2", title: "Comprensión de las necesidades y expectativas de los trabajadores y otras partes interesadas", parent: "4" },
        { code: "4.3", title: "Determinación del alcance del sistema de gestión de la SST", parent: "4" },
        { code: "4.4", title: "Sistema de gestión de la SST", parent: "4" },
        { code: "5", title: "Liderazgo y participación de los trabajadores" },
        { code: "5.1", title: "Liderazgo y compromiso", parent: "5" },
        { code: "5.2", title: "Política de la SST", parent: "5" },
        { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", parent: "5" },
        { code: "5.4", title: "Consulta y participación de los trabajadores", parent: "5", summary: "Mecanismos de consulta y participación de los trabajadores en el SG-SST." },
        { code: "6", title: "Planificación" },
        { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", parent: "6" },
        { code: "6.1.1", title: "Generalidades", parent: "6.1" },
        { code: "6.1.2", title: "Identificación de peligros y evaluación de los riesgos y oportunidades", parent: "6.1", summary: "Identificación de peligros, evaluación de riesgos laborales y jerarquía de controles." },
        { code: "6.1.3", title: "Determinación de los requisitos legales y otros requisitos", parent: "6.1" },
        { code: "6.1.4", title: "Planificación de acciones", parent: "6.1" },
        { code: "6.2", title: "Objetivos de la SST y planificación para lograrlos", parent: "6" },
        { code: "7", title: "Apoyo" },
        { code: "7.1", title: "Recursos", parent: "7" },
        { code: "7.2", title: "Competencia", parent: "7" },
        { code: "7.3", title: "Toma de conciencia", parent: "7" },
        { code: "7.4", title: "Comunicación", parent: "7" },
        { code: "7.5", title: "Información documentada", parent: "7" },
        { code: "8", title: "Operación" },
        { code: "8.1", title: "Planificación y control operacional", parent: "8" },
        { code: "8.1.2", title: "Eliminar peligros y reducir riesgos para la SST", parent: "8.1", summary: "Jerarquía de controles: eliminación, sustitución, controles de ingeniería, administrativos y EPP." },
        { code: "8.1.3", title: "Gestión del cambio", parent: "8.1" },
        { code: "8.1.4", title: "Compras y contratistas", parent: "8.1", summary: "Control de la SST en compras, contratistas y contratación externa." },
        { code: "8.2", title: "Preparación y respuesta ante emergencias", parent: "8", summary: "Planes de emergencia, simulacros y respuesta." },
        { code: "9", title: "Evaluación del desempeño" },
        { code: "9.1", title: "Seguimiento, medición, análisis y evaluación del desempeño", parent: "9", summary: "Indicadores de seguridad: frecuencia, gravedad, accidentabilidad." },
        { code: "9.1.2", title: "Evaluación del cumplimiento", parent: "9.1" },
        { code: "9.2", title: "Auditoría interna", parent: "9" },
        { code: "9.3", title: "Revisión por la dirección", parent: "9" },
        { code: "10", title: "Mejora" },
        { code: "10.1", title: "Generalidades", parent: "10" },
        { code: "10.2", title: "Incidentes, no conformidades y acciones correctivas", parent: "10", summary: "Investigación de incidentes, causa raíz y acciones correctivas." },
        { code: "10.3", title: "Mejora continua", parent: "10" },
      ],
      evidenceRules: [
        { requirementCode: "6.1.2", expectedType: "RECORD", frequency: "ANNUAL", note: "Matriz IPER: identificación de peligros y evaluación de riesgos laborales." },
        { requirementCode: "5.4", expectedType: "MINUTES", frequency: "QUARTERLY", note: "Actas de consulta y participación de los trabajadores / comité de SST." },
        { requirementCode: "8.1.4", expectedType: "RECORD", note: "Evaluación de SST de contratistas." },
        { requirementCode: "8.2", expectedType: "REPORT", frequency: "SEMIANNUAL", note: "Programa y actas de simulacros de emergencia." },
        { requirementCode: "9.1", expectedType: "REPORT", frequency: "MONTHLY", note: "Indicadores de seguridad (frecuencia, gravedad, accidentabilidad)." },
        { requirementCode: "10.2", expectedType: "RECORD", note: "Investigación de incidentes y accidentes con causa raíz." },
      ],
      gapQuestions: [
        { requirementCode: "6.1.2", question: "¿Se identifican los peligros y se evalúan los riesgos laborales con una metodología documentada?", guidance: "Buscar matriz IPER con jerarquía de controles.", weight: 3 },
        { requirementCode: "5.4", question: "¿Existen mecanismos de consulta y participación de los trabajadores?", weight: 2 },
        { requirementCode: "8.2", question: "¿Se dispone de planes de emergencia y se realizan simulacros?", weight: 2 },
        { requirementCode: "10.2", question: "¿Se investigan los incidentes y casi accidentes determinando su causa raíz?", weight: 3 },
      ],
      auditChecklist: [
        { requirementCode: "6.1.2", question: "Verificar la matriz de peligros y los riesgos críticos.", expectedEvidence: "Matriz IPER vigente con niveles y aceptabilidad.", criterion: "Riesgos evaluados con jerarquía de controles aplicada." },
        { requirementCode: "10.2", question: "Revisar la investigación de incidentes del periodo.", expectedEvidence: "Informes de investigación con causa raíz y acciones.", criterion: "Flujo de investigación completo hasta verificación de eficacia." },
        { requirementCode: "8.2", question: "Comprobar simulacros de emergencia y sus resultados.", expectedEvidence: "Actas de simulacros con tiempos de respuesta.", criterion: "Simulacros ejecutados según programa." },
      ],
      templates: [
        { requirementCode: "5.2", templateType: "POLICY", name: "Política de SST (plantilla)", content: "" },
        { requirementCode: "6.1.2", templateType: "RECORD", name: "Matriz IPER (plantilla)", content: "" },
        { requirementCode: "10.2", templateType: "PROCEDURE", name: "Procedimiento de Investigación de Incidentes (plantilla)", content: "" },
      ],
    },
  ],
  // Annex SL common structure — correspondence with ISO 9001:2015.
  mappings: [
    { sourceFamily: "ISO_45001", sourceCode: "4.1", targetFamily: "ISO_9001", targetCode: "4.1", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_45001", sourceCode: "5.2", targetFamily: "ISO_9001", targetCode: "5.2", relationType: "PARTIAL", equivalencePercent: 80, notes: "Política de SST ⇄ política de calidad (misma estructura)." },
    { sourceFamily: "ISO_45001", sourceCode: "7.5", targetFamily: "ISO_9001", targetCode: "7.5", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_45001", sourceCode: "9.2", targetFamily: "ISO_9001", targetCode: "9.2", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_45001", sourceCode: "9.3", targetFamily: "ISO_9001", targetCode: "9.3", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_45001", sourceCode: "10.2", targetFamily: "ISO_9001", targetCode: "10.2", relationType: "PARTIAL", equivalencePercent: 70, notes: "Incidentes y NC ⇄ no conformidad y acción correctiva." },
  ],
};
