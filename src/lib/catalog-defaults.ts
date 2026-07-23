/**
 * Opciones base para que una organización nueva pueda usar los formularios
 * de personal, documentos y control de registros desde el primer día.
 *
 * Son solo catálogos reutilizables: no contienen datos de negocio de otra
 * organización y cada tenant recibe sus propias filas en la base de datos.
 */

export const DEFAULT_POSITIONS = [
  { name: "Director de Calidad", description: "Responsable del sistema de gestión de calidad." },
  { name: "Auditor Interno", description: null },
  { name: "Coordinador SGSI", description: "Coordina la gestión de seguridad de la información." },
  { name: "Responsable de Procesos", description: null },
] as const;

export const DEFAULT_LOCATIONS = [
  { name: "Sede principal", description: "Ubicación principal de la organización." },
  { name: "Servidor corporativo", description: "Repositorio digital de documentos y registros." },
] as const;

export const DEFAULT_RETENTION_TIMES = [
  { name: "6 meses", months: 6 },
  { name: "1 año", months: 12 },
  { name: "3 años", months: 36 },
  { name: "5 años", months: 60 },
  { name: "10 años", months: 120 },
] as const;

export const DEFAULT_DISPOSITIONS = ["RECICLAR", "ELIMINAR", "ARCHIVAR HISTÓRICO"] as const;

export const DEFAULT_ARCHIVE_METHODS = [
  "Archivador físico",
  "Carpeta compartida",
  "Repositorio cifrado",
  "Almacén en frío",
] as const;

export const DEFAULT_RECORD_TYPES = ["FÍSICO", "ELECTRÓNICO", "FÍSICO Y ELECTRÓNICO"] as const;

export const DEFAULT_ADMIN_CATALOGS = {
  DOCUMENT_TYPE: ["Manual", "Política", "Procedimiento", "Instrucción", "Formato", "Registro", "Plan", "Otro"],
  STATUS: ["Borrador", "En revisión", "Aprobado", "Obsoleto"],
  PRIORITY: ["Crítica", "Alta", "Media", "Baja"],
  RISK_CATEGORY: ["Estratégico", "Operativo", "Tecnológico", "Cumplimiento", "Financiero", "Reputacional"],
  FINDING_TYPE: ["No conformidad", "Observación", "Oportunidad", "Fortaleza"],
  EVIDENCE_TYPE: ["Documento", "Registro", "Entrevista", "Observación", "Captura de pantalla", "Otro"],
} as const;
