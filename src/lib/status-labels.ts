/**
 * Etiquetas legibles de los códigos de estado.
 *
 * El catálogo vivía dentro de `Badge`, así que cualquier otra pantalla que
 * mostrara un estado —los gráficos de reparto, por ejemplo— acababa pintando
 * el enum crudo: «DRAFT», «ASSIGNED», «IDENTIFIED». Aquí queda en un solo
 * sitio para que la tabla, la insignia y el gráfico digan lo mismo.
 */

export type StatusStyle = { bg: string; color: string; label: string };

const PRIMARY = { bg: "var(--nf-primary-subtle)", color: "var(--nf-primary-active)" };
const SUCCESS = { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)" };
const WARNING = { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)" };
const DANGER = { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" };
const MUTED = { bg: "var(--nf-surface-muted)", color: "var(--nf-text-secondary)" };

export const STATUS_STYLES: Record<string, StatusStyle> = {
  APPROVED: { ...SUCCESS, label: "Aprobado" },
  approved: { ...SUCCESS, label: "Aprobado" },
  DRAFT: { ...PRIMARY, label: "Borrador" },
  draft: { ...PRIMARY, label: "Borrador" },
  IN_REVIEW: { ...WARNING, label: "En revisión" },
  in_review: { ...WARNING, label: "En revisión" },
  OBSOLETE: { ...MUTED, label: "Obsoleto" },
  COMPLETED: { ...SUCCESS, label: "Completada" },
  IN_PROGRESS: { ...WARNING, label: "En curso" },
  PLANNED: { ...PRIMARY, label: "Planificada" },
  OPEN: { ...DANGER, label: "Abierta" },
  CLOSED: { ...SUCCESS, label: "Cerrada" },
  PENDING: { ...PRIMARY, label: "Pendiente" },
  PENDING_VALIDATION: { ...PRIMARY, label: "Pendiente validación" },
  UNDER_TREATMENT: { ...WARNING, label: "En tratamiento" },
  MONITORED: { ...PRIMARY, label: "Monitoreo" },
  MITIGATED: { ...SUCCESS, label: "Mitigado" },
  ACCEPTED: { ...MUTED, label: "Aceptado" },
  IDENTIFIED: { ...PRIMARY, label: "Identificado" },
  ON_TRACK: { ...SUCCESS, label: "En objetivo" },
  AT_RISK: { ...WARNING, label: "En riesgo" },
  OFF_TRACK: { ...DANGER, label: "Desviado" },
  ACTIVE: { ...SUCCESS, label: "Activo" },
  TRIALING: { ...PRIMARY, label: "Trial" },
  CANCELLED: { ...MUTED, label: "Cancelado" },
  CRITICAL: { ...DANGER, label: "Crítica" },
  MAJOR: { ...WARNING, label: "Mayor" },
  MINOR: { ...MUTED, label: "Menor" },
  IN_REVIEW_STATUS: { ...PRIMARY, label: "En revisión" },
  success: { ...SUCCESS, label: "OK" },
  warning: { ...WARNING, label: "Atención" },
  danger: { ...DANGER, label: "Alerta" },

  /* Estados que solo aparecían en gráficos y tablas, nunca en una insignia:
     sin entrada aquí llegaban al usuario en mayúsculas y en inglés. */
  NOT_STARTED: { ...MUTED, label: "Sin iniciar" },
  ASSIGNED: { ...PRIMARY, label: "Asignado" },
  SUBMITTED: { ...PRIMARY, label: "Enviado" },
  INVESTIGATING: { ...WARNING, label: "Investigando" },
  RESOLVED: { ...SUCCESS, label: "Resuelto" },
  CONFIRMED: { ...SUCCESS, label: "Confirmado" },
  NEW: { ...PRIMARY, label: "Nuevo" },
  SCREENING: { ...WARNING, label: "En cribado" },
  REJECTED: { ...DANGER, label: "Rechazado" },
  SUSPENDED: { ...WARNING, label: "Suspendido" },
  EXPIRED: { ...DANGER, label: "Vencido" },
  ARCHIVED: { ...MUTED, label: "Archivado" },
  EVALUATED: { ...SUCCESS, label: "Evaluado" },
  IMPLEMENTED: { ...SUCCESS, label: "Implementado" },
  VERIFIED: { ...SUCCESS, label: "Verificado" },
  SUPERSEDED: { ...MUTED, label: "Sustituido" },
  UNDER_REVIEW: { ...WARNING, label: "En revisión" },
  UNDER_ANALYSIS: { ...WARNING, label: "En análisis" },
  IN_IMPLEMENTATION: { ...WARNING, label: "En implementación" },
  ASSESSED: { ...PRIMARY, label: "Evaluado" },
  NOT_ASSESSED: { ...MUTED, label: "Sin evaluar" },
  NOT_APPLICABLE: { ...MUTED, label: "No aplica" },
  RETIRED: { ...MUTED, label: "Retirado" },
  FULFILLED: { ...SUCCESS, label: "Atendida" },
  DOCUMENTED: { ...PRIMARY, label: "Documentado" },
  BUILDING: { ...WARNING, label: "En construcción" },
  READY: { ...PRIMARY, label: "Listo" },
  RELEASED: { ...SUCCESS, label: "Liberado" },
  ROLLED_BACK: { ...DANGER, label: "Revertido" },
  SUCCESS_STATUS: { ...SUCCESS, label: "Correcto" },
  FAILED: { ...DANGER, label: "Fallido" },
  ACHIEVED: { ...SUCCESS, label: "Alcanzado" },
  TABLETOP: { ...PRIMARY, label: "De mesa" },
  WALKTHROUGH: { ...PRIMARY, label: "Recorrido" },
  SIMULATION: { ...PRIMARY, label: "Simulacro" },
};

/**
 * Etiqueta de un código de estado.
 *
 * Sin entrada en el catálogo devuelve el código *humanizado* —«FOO_BAR» pasa a
 * «Foo bar»— en vez del enum a gritos: sigue sin estar traducido, pero deja de
 * parecer un error de la aplicación.
 */
export function statusLabel(code: string): string {
  const known = STATUS_STYLES[code];
  if (known) return known.label;
  // El vocabulario que no es estado se declara más abajo, en `ENUM_LABELS`.
  const vocabulario = ENUM_LABELS[code];
  if (vocabulario) return vocabulario;
  const clean = code.replaceAll("_", " ").trim();
  if (!clean) return code;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Tipo de proceso. En la base viaja en inglés y en minúsculas; en pantalla no
 * puede leerse «core» al lado de un nombre en español.
 */
export const PROCESS_TYPE_LABELS: Record<string, string> = {
  core: "Clave",
  strategic: "Estratégico",
  support: "Soporte",
};

export function processTypeLabel(type?: string | null) {
  if (!type) return "Sin tipo";
  return PROCESS_TYPE_LABELS[type] ?? statusLabel(type);
}

/**
 * Vocabulario de enum que llega a los desplegables.
 *
 * `STATUS_STYLES` es el catálogo de ESTADOS: cada entrada lleva su color de
 * insignia. Esto de aquí no son estados —son tipos, categorías, frecuencias,
 * fuentes de energía, roles—, así que no deben tener color: solo nombre.
 *
 * El barrido encontró 103 desplegables escritos como
 * `{Object.values(Enum).map((v) => <option key={v}>{v}</option>)}`, que ponían
 * al usuario a elegir entre «ON_TRACK» y «AT_RISK» dentro de un formulario en
 * su idioma. `Picker` ya no deja pasar el enum crudo (ver `etiquetaLegible`),
 * y aquí está el nombre que enseña en su lugar.
 */
export const ENUM_LABELS: Record<string, string> = {
  /* Frecuencia y periodicidad */
  ONCE: "Una vez", WEEKLY: "Semanal", MONTHLY: "Mensual", QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral", ANNUAL: "Anual", BIENNIAL: "Bienal", ON_EVENT: "Por evento",
  CONTINUOUS: "Continua", SAMPLING: "Por muestreo",

  /* Magnitud y severidad */
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", SEVERE: "Grave", MODERATE: "Moderada",
  NEGLIGIBLE: "Insignificante", NO_IMPACT: "Sin impacto", PARTIAL: "Parcial",
  NONE: "Ninguno", OTHER: "Otro", CUSTOM: "Personalizado", STANDARD: "Estándar",
  NEEDS_ATTENTION: "Requiere atención",

  /* Comparadores de umbral */
  EQ: "Igual que", GT: "Mayor que", GTE: "Mayor o igual que",
  LT: "Menor que", LTE: "Menor o igual que", BETWEEN: "Entre",

  /* Origen y ámbito */
  INTERNAL: "Interno", EXTERNAL: "Externo", THIRD_PARTY: "Tercero",
  LOCAL: "Local", REGIONAL: "Regional", NATIONAL: "Nacional",
  SUPRANATIONAL: "Supranacional", SECTORAL: "Sectorial", SECTOR_SPECIFIC: "Específico del sector",
  PUBLIC: "Público", CONFIDENTIAL: "Confidencial", RESTRICTED: "Restringido",
  STRICTLY_CONFIDENTIAL: "Estrictamente confidencial",

  /* Tipo de norma o fuente legal */
  LAW: "Ley", DECREE: "Decreto", DIRECTIVE: "Directiva", REGULATION: "Reglamento",
  ORDINANCE: "Ordenanza", CASE_LAW: "Jurisprudencia", GUIDANCE: "Guía",
  INTERPRETATION: "Interpretación", CONTRACTUAL: "Contractual", CONTRACT: "Contrato",
  LICENSE: "Licencia", LICENSE_CONDITION: "Condición de licencia",
  INTERNAL_POLICY: "Política interna", VOLUNTARY_COMMITMENT: "Compromiso voluntario",
  SECTOR_REGULATION: "Regulación sectorial", AMENDMENT: "Modificación",
  REPEAL: "Derogación", NEW_REQUIREMENT: "Requisito nuevo",
  ENFORCEMENT_TREND: "Tendencia sancionadora", RESOLUTION: "Resolución",
  LEGAL: "Legal", REGULATORY: "Regulatorio", REGULATOR: "Regulador",
  AUTHORITY: "Autoridad", OBLIGATION: "Obligación",

  /* Cumplimiento */
  COMPLIANT: "Conforme", NON_COMPLIANT: "No conforme", NONCOMPLIANT: "No conforme",
  PARTIALLY_COMPLIANT: "Parcialmente conforme", CONFORMING: "Conforme",
  NONCONFORMING: "No conforme", CONFORMITY: "Conformidad", NONCONFORMITY: "No conformidad",
  APPLICABLE: "Aplicable", PARTIALLY_APPLICABLE: "Parcialmente aplicable",
  NOT_EVALUATED: "Sin evaluar", UNDER_ASSESSMENT: "En evaluación",
  VALID: "Válido", INVALID: "No válido", CONDITIONAL: "Condicional",
  PASSED: "Superado", PASSED_WITH_CONDITIONS: "Superado con condiciones",
  OBSERVATION: "Observación", OPPORTUNITY: "Oportunidad", STRENGTH: "Fortaleza",

  /* Tratamiento del riesgo */
  MITIGATE: "Mitigar", ACCEPT: "Aceptar", AVOID: "Evitar", TRANSFER: "Transferir",
  PREVENTIVE: "Preventivo", CORRECTIVE: "Correctivo", DETECTIVE: "Detectivo",
  CONTROL: "Control", CONTROL_TESTING: "Prueba de control", DUAL_CONTROL: "Doble control",

  /* Auditoría y revisión */
  INTERNAL_AUDIT: "Auditoría interna", EXTERNAL_AUDIT: "Auditoría externa",
  SUPPLIER_AUDIT: "Auditoría a proveedor", CERTIFICATION: "Certificación",
  SURVEILLANCE: "Seguimiento", SELF_ASSESSMENT: "Autoevaluación",
  SAMPLING_REVIEW: "Revisión por muestreo", RECORD_REVIEW: "Revisión documental",
  AUTHORITY_INSPECTION: "Inspección de la autoridad",
  MANAGEMENT_REVIEW: "Revisión por la dirección", REVIEWER: "Revisor",
  OBSERVER: "Observador", INVESTIGATOR: "Investigador", INVESTIGATION: "Investigación",
  TRIAGE: "Triaje", SELF_DETECTED: "Detección propia", SELF_DETECTION: "Detección propia",
  CUSTOMER_COMPLAINT: "Reclamación de cliente", COMPLIANCE_EVALUATION: "Evaluación de cumplimiento",

  /* Órganos y roles */
  BOARD: "Consejo", CEO: "Dirección general", EXECUTIVE_MANAGEMENT: "Alta dirección",
  AUDIT_COMMITTEE: "Comité de auditoría", ETHICS_COMMITTEE: "Comité de ética",
  COMPLIANCE_COMMITTEE: "Comité de cumplimiento", LEGAL_COUNSEL: "Asesoría jurídica",
  DECISION_MAKER: "Responsable de la decisión", END_USER: "Usuario final",
  WORKER: "Trabajador", PERSONNEL: "Personal", CUSTOMER: "Cliente", SUPPLIER: "Proveedor",
  PUBLIC_OFFICIAL: "Funcionario público", DATA_SUBJECT: "Interesado",

  /* Antisoborno y conflictos */
  BRIBERY_CORRUPTION: "Soborno y corrupción", FRAUD: "Fraude", THEFT: "Robo",
  ANTI_MONEY_LAUNDERING: "Blanqueo de capitales", TRADE_SANCTIONS: "Sanciones comerciales",
  ACCOUNTING_IRREGULARITY: "Irregularidad contable", GIFT_HOSPITALITY: "Regalos y hospitalidad",
  CONFLICT_OF_INTEREST: "Conflicto de interés", FINANCIAL_INTEREST: "Interés financiero",
  FAMILY_RELATIONSHIP: "Relación familiar", FORMER_EMPLOYMENT: "Empleo anterior",
  OUTSIDE_ACTIVITY: "Actividad externa", POLITICAL_ACTIVITY: "Actividad política",
  RETALIATION: "Represalia", HARASSMENT: "Acoso", DISCRIMINATION: "Discriminación",
  POLICY_VIOLATION: "Incumplimiento de política", SPEAK_UP_CHANNEL: "Canal de denuncias",
  SPEAK_UP_REPORT: "Denuncia", APPEAL_CHANNEL: "Canal de apelación",
  DUE_DILIGENCE: "Diligencia debida", CODE_OF_CONDUCT: "Código de conducta",
  ANTIBRIBERY: "Antisoborno", CORPORATE_GOVERNANCE: "Gobierno corporativo",
  HUMAN_RIGHTS: "Derechos humanos", COMPETITION: "Competencia",
  CONSUMER_PROTECTION: "Protección del consumidor", FINANCIAL_REPORTING: "Información financiera",
  TAX: "Fiscal", LABOR: "Laboral",

  /* Privacidad */
  DATA_PRIVACY: "Privacidad", DATA_PROTECTION: "Protección de datos",
  INFORMATION_SECURITY: "Seguridad de la información", CONSENT: "Consentimiento",
  LEGAL_OBLIGATION: "Obligación legal", LEGITIMATE_INTEREST: "Interés legítimo",
  VITAL_INTEREST: "Interés vital", PUBLIC_TASK: "Misión de interés público",
  ANONYMIZATION: "Anonimización", ANONYMIZED: "Anonimizado", DELETION: "Supresión",
  WITHDRAWAL: "Retirada",

  /* Seguridad y salud */
  OCCUPATIONAL_SAFETY: "Seguridad laboral", ERGONOMIC: "Ergonómico",
  PSYCHOSOCIAL: "Psicosocial", PHYSICAL: "Físico", CHEMICAL: "Químico",
  BIOLOGICAL: "Biológico", MECHANICAL: "Mecánico", ELECTRICAL: "Eléctrico",
  FIRE_EXPLOSION: "Incendio y explosión", LOCATIVE: "Locativo",
  MAINTENANCE: "Mantenimiento", FACILITY: "Instalación",

  /* Inocuidad alimentaria */
  CCP: "PCC", OPRP: "PPRo", PRP: "PPR", ALLERGEN: "Alérgeno",
  ALLERGEN_CONTROL: "Control de alérgenos", ALLERGEN_INCIDENT: "Incidente por alérgeno",
  CONTAMINATION: "Contaminación", HYGIENE: "Higiene", CLEANING: "Limpieza",
  PEST_CONTROL: "Control de plagas", COOKING: "Cocción", COOLING: "Enfriamiento",
  STORAGE: "Almacenamiento", PACKAGING: "Envasado", LABELING: "Etiquetado",
  RAW_MATERIAL: "Materia prima", PREP: "Preparación", FINISHED: "Producto terminado",
  RECALL: "Retirada de producto", RECALL_EVENT: "Evento de retirada",
  STOCK_RECOVERY: "Recuperación de existencias", DEVIATION: "Desviación",
  CALIBRATION_CHECK: "Verificación de calibración",

  /* Energía */
  ELECTRICITY: "Electricidad", NATURAL_GAS: "Gas natural", DIESEL: "Diésel",
  FUEL_OIL: "Fuelóleo", LPG: "GLP", BIOMASS: "Biomasa", SOLAR: "Solar", WIND: "Eólica",
  STEAM: "Vapor", WATER: "Agua", WASTE: "Residuos", EMISSIONS: "Emisiones",
  DISTRICT_HEATING: "Red de calor", DISTRICT_COOLING: "Red de frío",
  CONSUMPTION: "Consumo", INTENSITY: "Intensidad", COST: "Coste",
  OPERATING_HOURS: "Horas de operación", DEGREE_DAYS: "Grados-día",
  OCCUPANCY: "Ocupación", PRODUCTION: "Producción", WEATHER: "Clima",
  ABSOLUTE_SAVINGS: "Ahorro absoluto", NORMALIZED_SAVINGS: "Ahorro normalizado",
  BASELINE_COMPARISON: "Comparación con línea base", PURCHASED: "Comprada",
  DISTRIBUTED: "Distribuida", DISTRIBUTION: "Distribución", ENVIRONMENTAL: "Ambiental",

  /* TI, integraciones y datos */
  INTEGRATION: "Integración", CONFIGURATION: "Configuración", CONNECTED: "Conectado",
  NOT_CONNECTED: "Sin conectar", AUTOMATED: "Automatizado", MANUAL: "Manual",
  HYBRID: "Híbrido", MERGE: "Fusionar", SPLIT: "Dividir", DECOMMISSION: "Retirar de servicio",
  SCOPE_CHANGE: "Cambio de alcance", THRESHOLD_CHANGE: "Cambio de umbral",
  DATA_CHANGE: "Cambio de datos", MEDIA: "Soporte", SENSOR: "Sensor",
  RECEIPT: "Comprobante", PROCESS: "Proceso", PROGRAM: "Programa",
  SUPPLY_DISRUPTION: "Interrupción de suministro", SUPPLIER_RELATIONSHIP: "Relación con proveedor",
  CUSTOMER_RELATIONSHIP: "Relación con cliente", CONSULTING: "Consultoría",

  /* Gobernanza de IA */
  FOUNDATION_MODEL: "Modelo fundacional", MODEL_API: "API de modelo",
  OPEN_SOURCE: "Código abierto", THIRD_PARTY_API: "API de tercero",
  THIRD_PARTY_LICENSED: "Licenciado a un tercero", THIRD_PARTY_PROVIDER: "Proveedor externo",
  MLOPS_PLATFORM: "Plataforma MLOps", INTERNAL_SYSTEM: "Sistema interno",
  EMBEDDED_FEATURE: "Función integrada", EMBEDDED_IN_PRODUCT: "Integrado en el producto",
  HUMAN_IN_THE_LOOP: "Persona en el bucle", HUMAN_ON_THE_LOOP: "Persona supervisando",
  HUMAN_IN_COMMAND: "Persona al mando", FULLY_AUTOMATED: "Totalmente automatizado",
  PUBLIC_DATASET: "Conjunto de datos público", USER_GENERATED: "Generado por usuarios",
  SYNTHETIC: "Sintético", WEB_SCRAPING: "Extracción web", DATASET: "Conjunto de datos",
  INGESTION: "Ingesta", TRANSFORMATION: "Transformación", AGGREGATION: "Agregación",
  ANNOTATION: "Anotación", AUGMENTATION: "Aumento", DERIVATION: "Derivación",
  ACCURACY: "Exactitud", PRECISION: "Precisión", F1: "F1", LATENCY: "Latencia",
  THROUGHPUT: "Rendimiento", ERROR_RATE: "Tasa de error", DRIFT: "Deriva",
  FAIRNESS: "Equidad", TOXICITY: "Toxicidad", AVAILABILITY: "Disponibilidad",
  HALLUCINATION_RATE: "Tasa de alucinación", REJECTION_RATE: "Tasa de rechazo",
  HUMAN_OVERRIDE_RATE: "Tasa de anulación humana", MODEL_UPDATE: "Actualización de modelo",
  PROMPT_CHANGE: "Cambio de instrucción", RETRAINING: "Reentrenamiento",
  MONITORING: "Monitorización",

  /* Formación */
  CLASSROOM: "Presencial", ONLINE: "En línea", ON_THE_JOB: "En el puesto",
  SELF_STUDY: "Autoformación", INTERMEDIATE: "Intermedio", BLENDED: "Mixto",

  /* Formatos y unidades de medida */
  LINEAR: "Lineal", RATIO: "Ratio",
};

/* Se consulta después de `STATUS_STYLES`: un código que sea estado conserva su
   etiqueta y su color; el resto es vocabulario y solo tiene nombre. */
