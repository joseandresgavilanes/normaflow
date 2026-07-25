import type { StandardPackInput } from "./pack-schema";

/**
 * ISO 14001:2015 — Sistema de Gestión Ambiental.
 *
 * Only clause codes, structure and NormaFlow's OWN Spanish titles/summaries —
 * never the protected full text of the standard. Requirement ids resolve to the
 * stable `req-iso-14001-<code>` form via `requirementIdFor` (non-legacy family).
 */
export const iso14001Pack: StandardPackInput = {
  code: "PACK_ISO_14001",
  name: "ISO 14001 — Medio ambiente",
  version: "2015.1",
  description: "Paquete normativo ISO 14001:2015 (Gestión Ambiental).",
  requiredModules: [
    "gap", "documents", "audits", "nc", "capa", "indicators", "mgmt-review", "environment",
  ],
  featureFlags: { environmentalManagement: true },
  editions: [
    {
      familyCode: "ISO_14001",
      familyName: "ISO 14001",
      category: "Medio ambiente",
      familyDescription: "Sistema de Gestión Ambiental",
      editionCode: "2015",
      name: "ISO 14001",
      version: "2015",
      year: 2015,
      description: "Sistema de Gestión Ambiental",
      catalogVersion: "2015.1",
      status: "ACTIVE",
      requirements: [
        { code: "4", title: "Contexto de la organización" },
        { code: "4.1", title: "Comprensión de la organización y de su contexto", parent: "4" },
        { code: "4.2", title: "Comprensión de las necesidades y expectativas de las partes interesadas", parent: "4" },
        { code: "4.3", title: "Determinación del alcance del sistema de gestión ambiental", parent: "4" },
        { code: "4.4", title: "Sistema de gestión ambiental", parent: "4" },
        { code: "5", title: "Liderazgo" },
        { code: "5.1", title: "Liderazgo y compromiso", parent: "5" },
        { code: "5.2", title: "Política ambiental", parent: "5" },
        { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", parent: "5" },
        { code: "6", title: "Planificación" },
        { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", parent: "6" },
        { code: "6.1.1", title: "Generalidades", parent: "6.1" },
        { code: "6.1.2", title: "Aspectos ambientales", parent: "6.1", summary: "Determinación de aspectos ambientales y evaluación de su significancia con perspectiva de ciclo de vida." },
        { code: "6.1.3", title: "Requisitos legales y otros requisitos", parent: "6.1" },
        { code: "6.1.4", title: "Planificación de acciones", parent: "6.1" },
        { code: "6.2", title: "Objetivos ambientales y planificación para lograrlos", parent: "6" },
        { code: "6.2.1", title: "Objetivos ambientales", parent: "6.2" },
        { code: "6.2.2", title: "Planificación de acciones para lograr los objetivos ambientales", parent: "6.2" },
        { code: "7", title: "Apoyo" },
        { code: "7.1", title: "Recursos", parent: "7" },
        { code: "7.2", title: "Competencia", parent: "7" },
        { code: "7.3", title: "Toma de conciencia", parent: "7" },
        { code: "7.4", title: "Comunicación", parent: "7" },
        { code: "7.5", title: "Información documentada", parent: "7" },
        { code: "8", title: "Operación" },
        { code: "8.1", title: "Planificación y control operacional", parent: "8" },
        { code: "8.2", title: "Preparación y respuesta ante emergencias", parent: "8", summary: "Escenarios de emergencia ambiental, planes de respuesta y simulacros." },
        { code: "9", title: "Evaluación del desempeño" },
        { code: "9.1", title: "Seguimiento, medición, análisis y evaluación", parent: "9" },
        { code: "9.1.1", title: "Generalidades", parent: "9.1" },
        { code: "9.1.2", title: "Evaluación del cumplimiento", parent: "9.1", summary: "Evaluación periódica del cumplimiento de las obligaciones legales y otras." },
        { code: "9.2", title: "Auditoría interna", parent: "9" },
        { code: "9.3", title: "Revisión por la dirección", parent: "9" },
        { code: "10", title: "Mejora" },
        { code: "10.1", title: "Generalidades", parent: "10" },
        { code: "10.2", title: "No conformidad y acción correctiva", parent: "10" },
        { code: "10.3", title: "Mejora continua", parent: "10" },
      ],
      evidenceRules: [
        { requirementCode: "6.1.2", expectedType: "RECORD", frequency: "ANNUAL", note: "Matriz de identificación y evaluación de aspectos e impactos ambientales." },
        { requirementCode: "6.1.3", expectedType: "RECORD", frequency: "SEMIANNUAL", note: "Matriz de requisitos legales y otros requisitos aplicables." },
        { requirementCode: "6.2.1", expectedType: "RECORD", frequency: "ANNUAL", note: "Objetivos y programas ambientales con línea base y metas." },
        { requirementCode: "8.2", expectedType: "PROCEDURE", note: "Planes de emergencia y registros de simulacros." },
        { requirementCode: "9.1.1", expectedType: "REPORT", frequency: "MONTHLY", note: "Indicadores de desempeño ambiental (agua, energía, residuos, emisiones)." },
        { requirementCode: "9.1.2", expectedType: "RECORD", frequency: "SEMIANNUAL", note: "Registros de evaluación del cumplimiento legal." },
      ],
      gapQuestions: [
        { requirementCode: "6.1.2", question: "¿Se han identificado los aspectos ambientales y evaluado su significancia con una metodología documentada?", guidance: "Buscar matriz de aspectos/impactos y método de significancia versionado.", weight: 3 },
        { requirementCode: "6.1.3", question: "¿Se mantiene actualizada la matriz de requisitos legales y otros requisitos?", weight: 3 },
        { requirementCode: "8.2", question: "¿Existen planes de respuesta ante emergencias ambientales y se realizan simulacros?", weight: 2 },
        { requirementCode: "9.1.2", question: "¿Se evalúa periódicamente el cumplimiento de las obligaciones legales aplicables?", weight: 3 },
      ],
      auditChecklist: [
        { requirementCode: "6.1.2", question: "Verificar la matriz de aspectos e impactos y los aspectos significativos.", expectedEvidence: "Matriz vigente con criterios de significancia.", criterion: "Aspectos significativos determinados con perspectiva de ciclo de vida." },
        { requirementCode: "9.1.2", question: "Revisar las evaluaciones de cumplimiento legal del periodo.", expectedEvidence: "Registros de evaluación con resultado y acciones derivadas.", criterion: "Todas las obligaciones aplicables evaluadas en frecuencia definida." },
        { requirementCode: "8.2", question: "Comprobar simulacros de emergencia y sus resultados.", expectedEvidence: "Actas de simulacros y acciones de mejora.", criterion: "Simulacros ejecutados según programa." },
      ],
      templates: [
        { requirementCode: "5.2", templateType: "POLICY", name: "Política Ambiental (plantilla)", content: "" },
        { requirementCode: "6.1.2", templateType: "RECORD", name: "Matriz de Aspectos e Impactos Ambientales (plantilla)", content: "" },
        { requirementCode: "8.2", templateType: "PROCEDURE", name: "Plan de Emergencias Ambientales (plantilla)", content: "" },
      ],
    },
  ],
  // Annex SL common structure — correspondence with ISO 9001:2015.
  mappings: [
    { sourceFamily: "ISO_14001", sourceCode: "4.1", targetFamily: "ISO_9001", targetCode: "4.1", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_14001", sourceCode: "5.2", targetFamily: "ISO_9001", targetCode: "5.2", relationType: "PARTIAL", equivalencePercent: 80, notes: "Política ambiental ⇄ política de calidad (misma estructura)." },
    { sourceFamily: "ISO_14001", sourceCode: "7.5", targetFamily: "ISO_9001", targetCode: "7.5", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_14001", sourceCode: "9.2", targetFamily: "ISO_9001", targetCode: "9.2", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_14001", sourceCode: "9.3", targetFamily: "ISO_9001", targetCode: "9.3", relationType: "EQUIVALENT", equivalencePercent: 100 },
    { sourceFamily: "ISO_14001", sourceCode: "10.2", targetFamily: "ISO_9001", targetCode: "10.2", relationType: "EQUIVALENT", equivalencePercent: 100 },
  ],
};
