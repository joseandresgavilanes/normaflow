import type { Prisma, PrismaClient } from "@prisma/client";
import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clauseIdFor, STANDARDS_CATALOG, type StandardSpec } from "@/lib/standards-catalog";
import { ensureStandardCatalog } from "@/lib/standards-adoption";

export type TemplateField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date";
  required?: boolean;
  placeholder?: string;
};

export type DocumentTemplateSeed = {
  code: string;
  standardCode: StandardSpec["code"];
  title: string;
  description: string;
  documentType: DocumentType;
  clauseCode: string;
  content: string;
  fields: TemplateField[];
  tags: string[];
  sortOrder: number;
};

const COMMON_FIELDS: TemplateField[] = [
  { key: "SYSTEM_SCOPE", label: "Alcance del sistema", type: "textarea", required: true, placeholder: "Procesos, sedes, productos y servicios incluidos" },
  { key: "OWNER_NAME", label: "Responsable", type: "text", required: true, placeholder: "Nombre y cargo" },
  { key: "EFFECTIVE_DATE", label: "Fecha de vigencia", type: "date", required: true },
  { key: "APPROVER_NAME", label: "Aprobador", type: "text", placeholder: "Nombre y cargo" },
];
const QUALITY_FIELDS: TemplateField[] = [
  { key: "QUALITY_OBJECTIVES", label: "Objetivos de calidad", type: "textarea", required: true },
  ...COMMON_FIELDS,
];
const SECURITY_FIELDS: TemplateField[] = [
  { key: "SECURITY_OBJECTIVES", label: "Objetivos de seguridad", type: "textarea", required: true },
  ...COMMON_FIELDS,
];

const bodyByCode: Record<string, string> = {
  "ISO9001-POL-001": `## Declaración\nLa dirección de {{ORGANIZATION_NAME}} establece esta política para el alcance **{{SYSTEM_SCOPE}}**.\n\n## Compromisos\n- Cumplir requisitos aplicables y necesidades del cliente.\n- Gestionar riesgos, recursos, competencias y comunicación.\n- Mejorar continuamente mediante estos objetivos: **{{QUALITY_OBJECTIVES}}**.\n\nLa política se comunica, se revisa en la revisión por la dirección y se conserva como información documentada.`,
  "ISO9001-ALC-001": `## Límites y aplicabilidad\nEl SGC aplica a: **{{SYSTEM_SCOPE}}**.\n\nIncluye sedes, procesos, productos, servicios, funciones, partes interesadas y requisitos legales, reglamentarios y contractuales pertinentes. Toda no aplicabilidad se documenta con justificación.`,
  "ISO9001-MAP-001": `## Interacción de procesos\n{{PROCESS_MAP}}\n\n## Ficha mínima\nPara cada proceso documentar propósito, entradas, salidas, criterios, recursos, riesgos, responsable, indicadores y documentos asociados. Revisar las interacciones ante cambios.`,
  "ISO9001-DOC-001": `## Flujo controlado\n1. Crear borrador con código, tipo, norma, cláusula y proceso.\n2. Revisar contenido y evidencias.\n3. Aprobar, publicar y comunicar la versión vigente.\n4. Conservar historial y retirar versiones obsoletas.\n\n## Responsabilidades\nElaborador: {{OWNER_NAME}}. Aprobador: {{APPROVER_NAME}}. NormaFlow conserva versiones, comentarios, responsables, fechas y audit trail.`,
  "ISO9001-AUD-001": `## Programa y ejecución\nDefinir frecuencia según importancia de procesos, riesgos, cambios y resultados previos: **{{AUDIT_FREQUENCY}}**.\n\nCada auditoría define alcance, criterios, auditor independiente, checklist por cláusula, evidencia objetiva, hallazgos, informe y seguimiento. Las no conformidades generan acciones con responsable, fecha y verificación de eficacia.`,
  "ISO9001-CAPA-001": `## Registro y causa raíz\nRegistrar origen, requisito, descripción, severidad, contención y evidencia. Analizar con 5 porqués, Ishikawa u otra técnica; aprobar la causa raíz.\n\n## Acción, eficacia y cierre\nDefinir acción, responsable, prioridad y fecha límite. Registrar avance y evidencias. El cierre requiere evidencia objetiva y verificación de eficacia. Criterios de severidad: **{{SEVERITY_RULES}}**.`,
  "ISO9001-RISK-001": `## Criterio de valoración\nValorar probabilidad × impacto y documentar umbrales de aceptación: **{{RISK_SCALE}}**.\n\n| ID | Proceso | Riesgo u oportunidad | P | I | Nivel | Tratamiento | Responsable | Fecha | Estado |\n|---|---|---|---:|---:|---:|---|---|---|---|\n| R-001 | [Proceso] | [Descripción] | [ ] | [ ] | [ ] | [ ] | {{OWNER_NAME}} | [ ] | Abierto |\n\nRevisar ante cambios, incidentes, auditorías y revisión por la dirección.`,
  "ISO9001-KPI-001": `## Matriz\nObjetivos de calidad: **{{KPI_OBJECTIVES}}**.\n\n| Indicador | Fórmula | Fuente | Frecuencia | Meta | Responsable | Resultado | Tendencia | Acción |\n|---|---|---|---|---:|---|---:|---|---|\n| KPI-001 | [Fórmula] | [Fuente] | [Mensual] | [ ] | {{OWNER_NAME}} | [ ] | [ ] | [ ] |\n\nConservar resultados, análisis, tendencia y acciones derivadas.`,
  "ISO9001-PROG-001": `## Objetivo y criterios\nAño: **{{AUDIT_YEAR}}**. Objetivo: **{{AUDIT_OBJECTIVE}}**.\n\n| Auditoría | Proceso | Norma | Alcance | Fecha | Auditor | Estado |\n|---|---|---|---|---|---|---|\n| AUD-001 | [Proceso] | ISO 9001 | [Alcance] | [Fecha] | [Auditor] | Planificada |\n\nPriorizar procesos con mayor riesgo, cambios recientes, bajo desempeño o hallazgos abiertos.`,
  "ISO9001-MR-001": `## Entradas\nResultados de auditorías; desempeño de procesos e indicadores; no conformidades y acciones; riesgos y oportunidades; cambios; satisfacción del cliente; proveedores y recursos.\n\n## Decisiones y acciones\n| Decisión | Responsable | Fecha objetivo | Evidencia | Estado |\n|---|---|---|---|---|\n| [Decisión] | [Responsable] | [Fecha] | [Enlace] | Abierta |\n\nParticipantes: **{{PARTICIPANTS}}**. La dirección confirma conveniencia, adecuación y eficacia del sistema.`,
  "ISO27001-ALC-001": `## Alcance\nEl SGSI aplica a: **{{SYSTEM_SCOPE}}**. Incluye procesos, personas, información, aplicaciones, infraestructura, proveedores y sedes dentro de los límites definidos.\n\nDocumentar interfaces, responsabilidades compartidas, requisitos legales y contractuales y toda exclusión justificada.`,
  "ISO27001-POL-001": `## Principios\nLa política protege la información de {{ORGANIZATION_NAME}} dentro de **{{SYSTEM_SCOPE}}**.\n\n- Confidencialidad: acceso solo autorizado.\n- Integridad: información completa y protegida.\n- Disponibilidad: servicios accesibles cuando se necesitan.\n- Responsabilidad: roles, formación, reporte y mejora.\n\nObjetivos de seguridad: **{{SECURITY_OBJECTIVES}}**. La política se comunica y revisa periódicamente.`,
  "ISO27001-RM-001": `## Método\nIdentificar activos, procesos, amenazas, vulnerabilidades y consecuencias. Valorar probabilidad e impacto en confidencialidad, integridad y disponibilidad con estos criterios: **{{RISK_CRITERIA}}**.\n\nComparar con aceptación, seleccionar tratamiento, asignar responsable y calcular riesgo residual. Reevaluar ante cambios, incidentes o nuevos proveedores.`,
  "ISO27001-RR-001": `## Registro de riesgos\nCriterios: **{{RISK_CRITERIA}}**.\n\n| ID | Activo/proceso | Escenario | C | I | D | P | Impacto | Inherente | Controles | Residual | Propietario | Estado |\n|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---|---|\n| R-SGSI-001 | [Activo] | [Amenaza/vulnerabilidad] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [Controles] | [ ] | {{OWNER_NAME}} | Abierto |`,
  "ISO27001-TR-001": `## Plan de tratamiento\nCriterios de priorización: **{{TREATMENT_CRITERIA}}**.\n\n| Riesgo | Tratamiento | Control/acción | Responsable | Recursos | Fecha | Avance | Estado | Evidencia |\n|---|---|---|---|---|---|---:|---|---|\n| R-SGSI-001 | [Opción] | [Acción] | {{OWNER_NAME}} | [ ] | [ ] | 0% | Planificado | [Enlace] |\n\nLa dirección aprueba el plan y la aceptación del riesgo residual se registra con fecha y autoridad.`,
  "ISO27001-SOA-001": `## Matriz de aplicabilidad\nVersión: **{{SOA_VERSION}}** · Alcance: **{{SYSTEM_SCOPE}}**.\n\n| Control | Aplicable | Justificación | Estado | Riesgo | Evidencia |\n|---|---|---|---|---|---|\n| A.5.x | Sí/No | [Justificación] | [No iniciado/En curso/Implementado] | [ID] | [Enlace] |\n\nDeterminar aplicabilidad desde riesgos, requisitos y necesidades del negocio. Revisar ante cambios relevantes.`,
  "ISO27001-AST-001": `## Inventario\nReglas de clasificación: **{{CLASSIFICATION_RULES}}**.\n\n| ID | Activo | Tipo | Propietario | Custodio | Ubicación | C | I | D | Clasificación | Riesgos | Ciclo de vida |\n|---|---|---|---|---|---|---:|---:|---:|---|---|---|\n| ACT-001 | [Activo] | [Tipo] | {{OWNER_NAME}} | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ID] | Activo |\n\nActualizar altas, bajas, cambios, transferencias e incidentes.`,
  "ISO27001-INC-001": `## Reporte y respuesta\nReportar eventos por **{{CONTACT_CHANNEL}}**, con fecha, activo, descripción y evidencia. Clasificar con estos niveles y tiempos: **{{SEVERITY_LEVELS}}**.\n\nContener, preservar evidencia, erradicar, recuperar y comunicar según corresponda. Registrar causa, impacto, decisiones, acciones, lecciones aprendidas y actualizaciones a riesgos y controles.`,
  "ISO27001-ACC-001": `## Principios y ciclo de vida\nAplicar mínimo privilegio, necesidad de saber, segregación de funciones, autenticación robusta y trazabilidad.\n\nSolicitar con justificación, aprobar según **{{ACCESS_APPROVAL}}**, provisionar, revisar periódicamente y revocar al cambiar de rol o finalizar la relación. Conservar revisiones y excepciones con fecha de expiración.`,
  "ISO27001-EVA-001": `## Índice de evidencias\nCustodio: **{{EVIDENCE_OWNER}}**.\n\n| Control | Evidencia | Ubicación/ID | Periodo | Responsable | Estado | Revisión |\n|---|---|---|---|---|---|---|\n| A.5.x | [Política, procedimiento, registro o reporte] | [NormaFlow] | [Periodo] | {{OWNER_NAME}} | Pendiente | [Fecha] |\n\nLa evidencia debe ser íntegra, legible, fechada, atribuible, protegida y suficiente para demostrar operación. Vincularla a control, riesgo, documento y auditoría.`,
};

function makeTemplate(args: Omit<DocumentTemplateSeed, "content" | "fields" | "tags"> & { fields?: TemplateField[]; tags?: string[] }): DocumentTemplateSeed {
  return {
    ...args,
    content: `# ${args.title}\n\n**Organización:** {{ORGANIZATION_NAME}} · **Código:** {{DOCUMENT_CODE}} · **Versión:** {{VERSION}}\n\n${bodyByCode[args.code] ?? "## Contenido base\n\nCompletar el contenido y conservar la evidencia de implementación."}\n\n**Responsable:** {{OWNER_NAME}} · **Fecha:** {{EFFECTIVE_DATE}} · **Aprobador:** {{APPROVER_NAME}}`,
    fields: args.fields ?? COMMON_FIELDS,
    tags: args.tags ?? [args.standardCode === "ISO_9001" ? "iso 9001" : "iso 27001"],
  };
}

export const DOCUMENT_TEMPLATES: DocumentTemplateSeed[] = [
  makeTemplate({ code: "ISO9001-POL-001", standardCode: "ISO_9001", title: "Política de calidad", description: "Compromiso de la dirección con el SGC.", documentType: DocumentType.POLICY, clauseCode: "5.2", sortOrder: 10, fields: QUALITY_FIELDS, tags: ["calidad", "política"] }),
  makeTemplate({ code: "ISO9001-ALC-001", standardCode: "ISO_9001", title: "Alcance del sistema de gestión de la calidad", description: "Límites, procesos y aplicabilidad del SGC.", documentType: DocumentType.MANUAL, clauseCode: "4.3", sortOrder: 20, tags: ["alcance", "sgc"] }),
  makeTemplate({ code: "ISO9001-MAP-001", standardCode: "ISO_9001", title: "Mapa de procesos", description: "Interacción, responsables e indicadores de procesos.", documentType: DocumentType.FORM, clauseCode: "4.4", sortOrder: 30, fields: [{ key: "PROCESS_MAP", label: "Mapa o listado de procesos", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["procesos", "mapa"] }),
  makeTemplate({ code: "ISO9001-DOC-001", standardCode: "ISO_9001", title: "Procedimiento de control documental", description: "Creación, revisión, aprobación, distribución y obsolescencia.", documentType: DocumentType.PROCEDURE, clauseCode: "7.5", sortOrder: 40, tags: ["documentos", "información documentada"] }),
  makeTemplate({ code: "ISO9001-AUD-001", standardCode: "ISO_9001", title: "Procedimiento de auditoría interna", description: "Programa, ejecución, informe y seguimiento de auditorías.", documentType: DocumentType.PROCEDURE, clauseCode: "9.2", sortOrder: 50, fields: [{ key: "AUDIT_FREQUENCY", label: "Frecuencia y criterios", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["auditoría"] }),
  makeTemplate({ code: "ISO9001-CAPA-001", standardCode: "ISO_9001", title: "Procedimiento de no conformidades y acciones correctivas", description: "Causa raíz, acción, eficacia y cierre.", documentType: DocumentType.PROCEDURE, clauseCode: "10.2", sortOrder: 60, fields: [{ key: "SEVERITY_RULES", label: "Criterios de severidad", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["capa", "no conformidad"] }),
  makeTemplate({ code: "ISO9001-RISK-001", standardCode: "ISO_9001", title: "Matriz de riesgos y oportunidades", description: "Identificación, valoración, tratamiento y revisión.", documentType: DocumentType.FORM, clauseCode: "6.1", sortOrder: 70, fields: [{ key: "RISK_SCALE", label: "Escala de valoración", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["riesgos"] }),
  makeTemplate({ code: "ISO9001-KPI-001", standardCode: "ISO_9001", title: "Matriz de indicadores", description: "Objetivos, fórmulas, metas, resultados y acciones.", documentType: DocumentType.FORM, clauseCode: "9.1", sortOrder: 80, fields: [{ key: "KPI_OBJECTIVES", label: "Objetivos e indicadores", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["kpi"] }),
  makeTemplate({ code: "ISO9001-PROG-001", standardCode: "ISO_9001", title: "Programa anual de auditoría", description: "Plan anual de procesos, normas, fechas y auditores.", documentType: DocumentType.PLAN, clauseCode: "9.2", sortOrder: 90, fields: [{ key: "AUDIT_YEAR", label: "Año", type: "text", required: true }, { key: "AUDIT_OBJECTIVE", label: "Objetivo y criterios", type: "textarea", required: true }, ...COMMON_FIELDS], tags: ["programa", "auditoría"] }),
  makeTemplate({ code: "ISO9001-MR-001", standardCode: "ISO_9001", title: "Acta de revisión por la dirección", description: "Entradas, decisiones, acciones y seguimiento del SGC.", documentType: DocumentType.FORM, clauseCode: "9.3", sortOrder: 100, fields: [{ key: "PARTICIPANTS", label: "Participantes", type: "textarea", required: true }, { key: "MEETING_DATE", label: "Fecha de reunión", type: "date", required: true }, ...COMMON_FIELDS], tags: ["dirección", "revisión"] }),
  makeTemplate({ code: "ISO27001-ALC-001", standardCode: "ISO_27001", title: "Alcance del SGSI", description: "Contexto, límites, interfaces, activos y sedes.", documentType: DocumentType.MANUAL, clauseCode: "4.3", sortOrder: 10, tags: ["sgsi", "alcance"] }),
  makeTemplate({ code: "ISO27001-POL-001", standardCode: "ISO_27001", title: "Política de seguridad de la información", description: "Confidencialidad, integridad, disponibilidad y mejora.", documentType: DocumentType.POLICY, clauseCode: "5.2", sortOrder: 20, fields: SECURITY_FIELDS, tags: ["seguridad", "política"] }),
  makeTemplate({ code: "ISO27001-RM-001", standardCode: "ISO_27001", title: "Metodología de evaluación de riesgos", description: "Método reproducible de análisis y aceptación de riesgos.", documentType: DocumentType.PROCEDURE, clauseCode: "6.1.2", sortOrder: 30, fields: [{ key: "RISK_CRITERIA", label: "Criterios de riesgo", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["riesgos", "metodología"] }),
  makeTemplate({ code: "ISO27001-RR-001", standardCode: "ISO_27001", title: "Registro de riesgos", description: "Riesgos, activos, controles, propietarios y estado.", documentType: DocumentType.FORM, clauseCode: "6.1.2", sortOrder: 40, fields: [{ key: "RISK_CRITERIA", label: "Criterios y escala", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["riesgos", "registro"] }),
  makeTemplate({ code: "ISO27001-TR-001", standardCode: "ISO_27001", title: "Plan de tratamiento de riesgos", description: "Tratamientos, acciones, responsables, fechas y evidencias.", documentType: DocumentType.PLAN, clauseCode: "6.1.3", sortOrder: 50, fields: [{ key: "TREATMENT_CRITERIA", label: "Criterios de priorización", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["tratamiento", "riesgos"] }),
  makeTemplate({ code: "ISO27001-SOA-001", standardCode: "ISO_27001", title: "Declaración de aplicabilidad", description: "Aplicabilidad, justificación, estado y evidencia de controles.", documentType: DocumentType.FORM, clauseCode: "6.1.3", sortOrder: 60, fields: [{ key: "SOA_VERSION", label: "Versión de la declaración", type: "text", required: true }, ...SECURITY_FIELDS], tags: ["soa", "anexo a"] }),
  makeTemplate({ code: "ISO27001-AST-001", standardCode: "ISO_27001", title: "Registro de activos", description: "Inventario, propietarios, clasificación, ubicación y riesgos.", documentType: DocumentType.FORM, clauseCode: "A.5", sortOrder: 70, fields: [{ key: "CLASSIFICATION_RULES", label: "Reglas de clasificación", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["activos", "anexo a"] }),
  makeTemplate({ code: "ISO27001-INC-001", standardCode: "ISO_27001", title: "Procedimiento de incidentes", description: "Reporte, clasificación, respuesta, aprendizaje y registros.", documentType: DocumentType.PROCEDURE, clauseCode: "A.5", sortOrder: 80, fields: [{ key: "CONTACT_CHANNEL", label: "Canal de reporte", type: "text", required: true }, { key: "SEVERITY_LEVELS", label: "Niveles y tiempos de respuesta", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["incidentes", "anexo a"] }),
  makeTemplate({ code: "ISO27001-ACC-001", standardCode: "ISO_27001", title: "Control de accesos", description: "Alta, modificación, revisión y baja de accesos.", documentType: DocumentType.PROCEDURE, clauseCode: "A.5", sortOrder: 90, fields: [{ key: "ACCESS_APPROVAL", label: "Flujo de aprobación", type: "textarea", required: true }, ...SECURITY_FIELDS], tags: ["accesos", "anexo a"] }),
  makeTemplate({ code: "ISO27001-EVA-001", standardCode: "ISO_27001", title: "Evidencias por controles del Anexo A", description: "Índice de evidencias de diseño, implementación, operación y revisión.", documentType: DocumentType.FORM, clauseCode: "A.5", sortOrder: 100, fields: [{ key: "EVIDENCE_OWNER", label: "Custodio de evidencias", type: "text", required: true }, ...SECURITY_FIELDS], tags: ["evidencias", "anexo a"] }),
];

export function renderTemplateContent(content: string, values: Record<string, string | undefined>) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? `[Completar: ${key}]`);
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function ensureDocumentTemplates(db: Db = prisma) {
  for (const spec of STANDARDS_CATALOG) await ensureStandardCatalog(spec, db);
  for (const template of DOCUMENT_TEMPLATES) {
    const data = {
      standardCode: template.standardCode,
      title: template.title,
      description: template.description,
      documentType: template.documentType,
      clauseId: clauseIdFor(template.standardCode, template.clauseCode),
      content: template.content,
      fieldSchema: template.fields as unknown as Prisma.InputJsonValue,
      tags: template.tags,
      isActive: true,
      sortOrder: template.sortOrder,
    };
    await db.documentTemplate.upsert({ where: { code: template.code }, update: data, create: { code: template.code, ...data } });
  }
}
