import type { StandardPackInput } from "./pack-schema";

/**
 * ISO 27001:2022 — Sistema de Gestión de Seguridad de la Información.
 * Codes/structure/own summaries only. Annex A control detail lives in the
 * dedicated security-control catalog; here we keep the clause tree (4–10) plus
 * the Annex A domain headers. Requirement codes are preserved so the
 * deterministic `cl-27001-…` ids match production rows.
 */
export const iso27001Pack: StandardPackInput = {
  code: "PACK_ISO_27001",
  name: "ISO 27001 — Seguridad de la Información",
  version: "2022.1",
  description: "Paquete normativo ISO 27001:2022 (Seguridad de la Información).",
  requiredModules: ["gap", "documents", "risks", "risk-treatment", "soa", "security-controls", "assets", "incidents"],
  featureFlags: { informationSecurity: true, annexA: true },
  editions: [
    {
      familyCode: "ISO_27001",
      familyName: "ISO 27001",
      category: "Seguridad de la información",
      familyDescription: "Sistema de Gestión de Seguridad de la Información",
      editionCode: "2022",
      name: "ISO 27001",
      version: "2022",
      year: 2022,
      description: "Sistema de Gestión de Seguridad de la Información",
      catalogVersion: "2022.1",
      status: "ACTIVE",
      requirements: [
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
      ],
      evidenceRules: [
        { requirementCode: "6.1.2", expectedType: "REPORT", frequency: "ANNUAL", note: "Metodología e informe de evaluación de riesgos." },
        { requirementCode: "6.1.3", expectedType: "RECORD", note: "Plan de tratamiento de riesgos y Declaración de Aplicabilidad (SoA)." },
        { requirementCode: "9.2", expectedType: "REPORT", frequency: "ANNUAL", note: "Programa e informes de auditoría interna del SGSI." },
      ],
      gapQuestions: [
        { requirementCode: "4.3", question: "¿Está definido y documentado el alcance del SGSI?", weight: 2 },
        { requirementCode: "6.1.2", question: "¿Existe una metodología de evaluación de riesgos aprobada?", weight: 3 },
        { requirementCode: "6.1.3", question: "¿La Declaración de Aplicabilidad justifica inclusiones y exclusiones?", weight: 3 },
      ],
      auditChecklist: [
        { requirementCode: "6.1.3", question: "Contrastar la SoA con el plan de tratamiento de riesgos.", expectedEvidence: "SoA aprobada y vigente.", criterion: "Cada control incluido/excluido tiene justificación." },
        { requirementCode: "A.8", question: "Muestrear controles tecnológicos implementados.", expectedEvidence: "Registros de configuración y logs.", criterion: "Controles operativos y efectivos." },
      ],
      templates: [
        { requirementCode: "5.2", templateType: "POLICY", name: "Política de Seguridad de la Información (plantilla)", content: "" },
        { requirementCode: "6.1.3", templateType: "RECORD", name: "Declaración de Aplicabilidad — SoA (plantilla)", content: "" },
      ],
    },
  ],
  // Correspondencia Anexo SL (estructura de alto nivel compartida) + mejora.
  mappings: [
    { sourceFamily: "ISO_9001", sourceCode: "4.1", targetFamily: "ISO_27001", targetCode: "4.1", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "Comprensión de la organización y su contexto (Anexo SL 4.1)." },
    { sourceFamily: "ISO_9001", sourceCode: "4.2", targetFamily: "ISO_27001", targetCode: "4.2", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "Necesidades y expectativas de las partes interesadas." },
    { sourceFamily: "ISO_9001", sourceCode: "5.1", targetFamily: "ISO_27001", targetCode: "5.1", relationType: "EQUIVALENT", equivalencePercent: 95, notes: "Liderazgo y compromiso." },
    { sourceFamily: "ISO_9001", sourceCode: "7.5", targetFamily: "ISO_27001", targetCode: "7.5", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "Información documentada." },
    { sourceFamily: "ISO_9001", sourceCode: "9.2", targetFamily: "ISO_27001", targetCode: "9.2", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "Auditoría interna." },
    { sourceFamily: "ISO_9001", sourceCode: "9.3", targetFamily: "ISO_27001", targetCode: "9.3", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "Revisión por la dirección." },
    { sourceFamily: "ISO_9001", sourceCode: "10.2", targetFamily: "ISO_27001", targetCode: "10.2", relationType: "EQUIVALENT", equivalencePercent: 100, notes: "No conformidad y acción correctiva." },
  ],
};
