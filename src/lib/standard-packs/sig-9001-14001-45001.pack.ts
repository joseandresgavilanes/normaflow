import type { StandardPackInput } from "./pack-schema";

/**
 * Capa de integración del Sistema Integrado de Gestión — ISO 9001 + ISO 14001 +
 * ISO 45001. No es una norma ISO: es el conjunto de requisitos de gobierno que
 * demuestra que las tres normas se gestionan como un solo sistema (Anexo SL) en
 * vez de tres sistemas paralelos. La correspondencia clausa-a-clausa entre las
 * tres normas vive en `sig-crosswalk.ts` (`installCrosswalk`); este pack aporta
 * el árbol de requisitos propio de la integración (alcance único, política
 * única, auditoría integrada, CAPA común, revisión por dirección integrada…)
 * para que el checklist de 32 criterios y el ciclo de vida LIVE se apliquen
 * también a la oferta comercial "SIG", no solo a cada norma por separado.
 *
 * Activar este pack presupone tener activas ISO_9001, ISO_14001 e ISO_45001
 * (comercialmente se vende como bundle); no se fuerza por código porque cada
 * norma ya tiene su propio entitlement independiente — ver docs/pack-live-backlog.md.
 */
export const sigPack: StandardPackInput = {
  code: "PACK_SIG_9001_14001_45001",
  name: "Sistema Integrado de Gestión — ISO 9001 + 14001 + 45001",
  version: "1.0",
  lifecycleStatus: "PILOT",
  description: "Capa de integración: alcance, política, riesgos, auditoría, CAPA, revisión por dirección e indicadores comunes a ISO 9001, ISO 14001 e ISO 45001, sin duplicar requisitos.",
  requiredModules: [
    "gap", "documents", "audits", "nonconformities", "actions", "indicators", "management-review", "context", "quality-ops", "integrated",
  ],
  featureFlags: { integratedManagementSystem: true },
  editions: [
    {
      familyCode: "SIG_9001_14001_45001",
      familyName: "Sistema Integrado de Gestión",
      category: "Sistema integrado",
      familyDescription: "Capa de gobierno común a ISO 9001, ISO 14001 e ISO 45001 (Anexo SL).",
      editionCode: "1.0",
      name: "SIG 9001+14001+45001",
      version: "1.0",
      year: 2026,
      description: "Requisitos de integración: alcance, política, partes interesadas, riesgos, objetivos, documentos/evidencias multirrequisito, auditoría, CAPA, revisión por dirección e indicadores comunes.",
      catalogVersion: "1.0",
      status: "ACTIVE",
      requirements: [
        { code: "INT-1", title: "Alcance y política integrados" },
        { code: "INT-1.1", title: "Alcance integrado", parent: "INT-1", summary: "Un solo alcance para las tres normas, con notas y exclusiones por norma cuando aplique." },
        { code: "INT-1.2", title: "Política integrada", parent: "INT-1", summary: "Un documento único que declara el compromiso de calidad, ambiente y SST, versionado y aprobado." },
        { code: "INT-2", title: "Contexto y partes interesadas" },
        { code: "INT-2.1", title: "Partes interesadas compartidas", parent: "INT-2", summary: "Partes interesadas comunes a las tres disciplinas, sin registrarlas tres veces." },
        { code: "INT-2.2", title: "Contexto común", parent: "INT-2", summary: "Cuestiones internas y externas comunes (cláusula 4.1 compartida por Anexo SL)." },
        { code: "INT-3", title: "Procesos y riesgos" },
        { code: "INT-3.1", title: "Procesos comunes", parent: "INT-3", summary: "El mismo mapa de procesos sirve a las tres normas." },
        { code: "INT-3.2", title: "Riesgos por disciplina", parent: "INT-3", summary: "Un riesgo puede etiquetarse por disciplina (calidad/ambiente/SST) sin duplicar el registro." },
        { code: "INT-3.3", title: "Riesgos integrados", parent: "INT-3", summary: "Vista consolidada de riesgos críticos por disciplina y globales." },
        { code: "INT-4", title: "Objetivos compartidos", summary: "Un objetivo puede cubrir varias disciplinas a la vez (objetivo COMPARTIDO)." },
        { code: "INT-5", title: "Documentación y evidencia multirrequisito" },
        { code: "INT-5.1", title: "Documentos multirrequisito", parent: "INT-5", summary: "Un documento cubre varios requisitos/normas mediante la matriz de cobertura." },
        { code: "INT-5.2", title: "Evidencias multirrequisito", parent: "INT-5", summary: "Una evidencia cubre varios requisitos/normas mediante la matriz de cobertura." },
        { code: "INT-6", title: "Competencias y proveedores" },
        { code: "INT-6.1", title: "Competencias comunes", parent: "INT-6", summary: "Formación compartida entre disciplinas cuando el contenido lo permite." },
        { code: "INT-6.2", title: "Proveedores integrados", parent: "INT-6", summary: "Una sola evaluación de proveedor con las tres dimensiones (calidad/ambiente/SST)." },
        { code: "INT-7", title: "Cambios y auditoría integrada" },
        { code: "INT-7.1", title: "Cambios con impactos múltiples", parent: "INT-7", summary: "Una solicitud de cambio puede afectar a varias disciplinas sin duplicarse." },
        { code: "INT-7.2", title: "Auditoría integrada", parent: "INT-7", summary: "Una sola auditoría cubre varias normas: un programa, un checklist, hallazgos y CAPA compartidos." },
        { code: "INT-7.3", title: "Hallazgos multinorma", parent: "INT-7", summary: "Un hallazgo puede afectar a varias normas sin duplicarse." },
        { code: "INT-7.4", title: "CAPA única", parent: "INT-7", summary: "Una sola acción correctiva cubre varias normas." },
        { code: "INT-8", title: "Revisión, indicadores y mejora" },
        { code: "INT-8.1", title: "Revisión por la dirección integrada", parent: "INT-8", summary: "Una sola revisión por la dirección cubre todas las normas del sistema." },
        { code: "INT-8.2", title: "Indicadores por norma y globales", parent: "INT-8", summary: "Cumplimiento por norma y puntaje global del sistema." },
        { code: "INT-8.3", title: "Dashboard del sistema integrado", parent: "INT-8", summary: "Panel único con grado de integración, factor de reutilización y estado por norma." },
        { code: "INT-8.4", title: "Paquete de auditoría integrado", parent: "INT-8", summary: "Compendio exportable de todo el sistema integrado para la auditoría de certificación." },
      ],
      evidenceRules: [
        { requirementCode: "INT-1.2", expectedType: "POLICY", note: "Política integrada aprobada, con versión y fecha." },
        { requirementCode: "INT-5.1", expectedType: "RECORD", note: "Matriz de cobertura documento↔requisito con al menos un documento multirrequisito." },
        { requirementCode: "INT-7.2", expectedType: "REPORT", frequency: "ANNUAL", note: "Programa y ejecución de auditoría integrada." },
        { requirementCode: "INT-7.4", expectedType: "RECORD", note: "CAPA con más de una norma asociada." },
        { requirementCode: "INT-8.1", expectedType: "MINUTES", frequency: "ANNUAL", note: "Acta de revisión por la dirección integrada." },
      ],
      gapQuestions: [
        { requirementCode: "INT-1.1", question: "¿Existe un único alcance documentado para las tres normas?", weight: 3 },
        { requirementCode: "INT-1.2", question: "¿La política integrada cubre calidad, ambiente y SST en un solo documento aprobado?", weight: 3 },
        { requirementCode: "INT-5.1", question: "¿Hay documentos que satisfacen requisitos de más de una norma sin duplicarse?", guidance: "Revisar la matriz de cobertura y el factor de reutilización.", weight: 2 },
        { requirementCode: "INT-7.2", question: "¿Se ejecutan auditorías internas que cubren varias normas en un solo ejercicio?", weight: 3 },
        { requirementCode: "INT-7.4", question: "¿Existen CAPA que resuelven hallazgos de más de una norma?", weight: 2 },
        { requirementCode: "INT-8.1", question: "¿La revisión por la dirección analiza el desempeño de las tres normas en una sola sesión?", weight: 2 },
      ],
      auditChecklist: [
        { requirementCode: "INT-1.1", question: "Verificar que el alcance integrado cubre todos los procesos con impacto en calidad, ambiente o SST.", expectedEvidence: "Documento de alcance único, con exclusiones justificadas por norma si aplica.", criterion: "Un solo alcance, no tres alcances paralelos." },
        { requirementCode: "INT-7.2", question: "Revisar el programa de auditoría integrada del periodo.", expectedEvidence: "Auditorías con más de una norma marcada, checklist y hallazgos consolidados.", criterion: "Al menos una auditoría cubre las tres normas en el ciclo." },
        { requirementCode: "INT-8.1", question: "Comprobar que la revisión por la dirección incluye entradas de las tres disciplinas.", expectedEvidence: "Acta con desempeño de calidad, ambiente y SST en la misma reunión.", criterion: "Revisión única, no tres revisiones separadas." },
      ],
      templates: [
        { requirementCode: "INT-1.2", templateType: "POLICY", name: "Política Integrada de Gestión (plantilla)", content: "" },
        { requirementCode: "INT-7.2", templateType: "PROCEDURE", name: "Programa de Auditoría Integrada (plantilla)", content: "" },
      ],
    },
  ],
  // La correspondencia clausa-a-clausa entre las tres normas se instala aparte
  // vía installCrosswalk()/SIG_CROSSWALK — este pack no repite esos mapeos.
  mappings: [],
};
