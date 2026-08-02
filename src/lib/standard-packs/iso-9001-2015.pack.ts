import type { StandardPackInput } from "./pack-schema";

/**
 * ISO 9001:2015 — Sistema de Gestión de la Calidad.
 * Only codes, structure and NormaFlow's own Spanish titles/summaries — no
 * protected standard text. Requirement codes are preserved so the deterministic
 * `cl-9001-…` ids match rows already present in production.
 */
export const iso9001Pack: StandardPackInput = {
  code: "PACK_ISO_9001",
  name: "ISO 9001 — Calidad",
  version: "2015.1",
  lifecycleStatus: "LIVE",
  description: "Paquete normativo ISO 9001:2015 (Gestión de la Calidad).",
  requiredModules: ["gap", "documents", "audits", "nonconformities", "actions", "indicators", "management-review"],
  featureFlags: { qualityManagement: true },
  editions: [
    {
      familyCode: "ISO_9001",
      familyName: "ISO 9001",
      category: "Calidad",
      familyDescription: "Sistema de Gestión de la Calidad",
      editionCode: "2015",
      name: "ISO 9001",
      version: "2015",
      year: 2015,
      description: "Sistema de Gestión de la Calidad",
      catalogVersion: "2015.1",
      status: "ACTIVE",
      requirements: [
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
      ],
      evidenceRules: [
        { requirementCode: "4.1", expectedType: "RECORD", frequency: "ANNUAL", note: "Análisis de contexto (FODA / PESTEL)." },
        { requirementCode: "7.5", expectedType: "PROCEDURE", note: "Procedimiento de control de la información documentada." },
        { requirementCode: "9.2", expectedType: "REPORT", frequency: "ANNUAL", note: "Programa e informes de auditoría interna." },
        { requirementCode: "9.3", expectedType: "MINUTES", frequency: "ANNUAL", note: "Acta de revisión por la dirección." },
      ],
      gapQuestions: [
        { requirementCode: "4.1", question: "¿Se han determinado las cuestiones internas y externas pertinentes?", guidance: "Buscar análisis de contexto documentado y revisado.", weight: 2 },
        { requirementCode: "6.1", question: "¿Se planifican acciones para abordar riesgos y oportunidades?", weight: 3 },
        { requirementCode: "9.2", question: "¿Existe un programa de auditoría interna que cubre todos los procesos?", weight: 2 },
      ],
      auditChecklist: [
        { requirementCode: "7.5", question: "Verificar el control de versiones de la información documentada.", expectedEvidence: "Listado maestro de documentos vigente.", criterion: "Documentos vigentes, identificados y disponibles." },
        { requirementCode: "9.3", question: "Revisar entradas y salidas de la última revisión por la dirección.", expectedEvidence: "Acta con decisiones y acciones.", criterion: "Cubre todas las entradas de la cláusula 9.3.2." },
      ],
      templates: [
        { requirementCode: "5.2", templateType: "POLICY", name: "Política de Calidad (plantilla)", content: "" },
        { requirementCode: "9.3", templateType: "RECORD", name: "Acta de Revisión por la Dirección (plantilla)", content: "" },
      ],
    },
  ],
  mappings: [],
};
