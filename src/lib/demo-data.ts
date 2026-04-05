// NormaFlow Demo Data
// Organización: Tecnoserv Industrial S.A.

export const DEMO_ORG = {
  id: "org_demo_tecnoserv",
  name: "Tecnoserv Industrial S.A.",
  slug: "tecnoserv-industrial",
  industry: "Manufactura y Distribución",
  plan: "GROWTH" as const,
  complianceScore: 78,
  iso9001Score: 82,
  iso27001Score: 74,
};

export const DEMO_USERS = [
  { id: "u1", name: "Ana García", email: "ana.garcia@tecnoserv.com", role: "COMPLIANCE_MANAGER", avatar: "AG" },
  { id: "u2", name: "Carlos Méndez", email: "carlos.mendez@tecnoserv.com", role: "AUDITOR", avatar: "CM" },
  { id: "u3", name: "Laura Vega", email: "laura.vega@tecnoserv.com", role: "ORG_ADMIN", avatar: "LV" },
  { id: "u4", name: "Pedro Ruiz", email: "pedro.ruiz@tecnoserv.com", role: "CONTRIBUTOR", avatar: "PR" },
  { id: "u5", name: "María Torres", email: "maria.torres@tecnoserv.com", role: "CONTRIBUTOR", avatar: "MT" },
  { id: "u6", name: "José López", email: "jose.lopez@tecnoserv.com", role: "VIEWER", avatar: "JL" },
];

export const DEMO_RISKS = [
  { id: "r1", code: "R-001", title: "Fuga de datos de clientes", probability: 4, impact: 5, score: 20, status: "UNDER_TREATMENT", owner: "Ana García", category: "Información", due: "2025-08-15", control: "Cifrado AES-256 + DLP", treatment: "MITIGATE" },
  { id: "r2", code: "R-002", title: "Fallo de proveedor crítico de componentes", probability: 3, impact: 4, score: 12, status: "MONITORED", owner: "Carlos Méndez", category: "Operacional", due: "2025-09-01", control: "Plan de contingencia activo + 2 proveedores alternativos", treatment: "MITIGATE" },
  { id: "r3", code: "R-003", title: "Incumplimiento normativa RGPD", probability: 2, impact: 5, score: 10, status: "MITIGATED", owner: "Laura Vega", category: "Legal y Regulatorio", due: "2025-07-30", control: "DPO designado + auditoría externa anual", treatment: "MITIGATE" },
  { id: "r4", code: "R-004", title: "Acceso no autorizado a sistemas de producción", probability: 3, impact: 3, score: 9, status: "UNDER_TREATMENT", owner: "Pedro Ruiz", category: "Seguridad TI", due: "2025-08-20", control: "MFA obligatorio en todos los sistemas", treatment: "MITIGATE" },
  { id: "r5", code: "R-005", title: "Error crítico en proceso de fabricación", probability: 2, impact: 4, score: 8, status: "ACCEPTED", owner: "María Torres", category: "Operacional", due: "2025-10-01", control: "QA automatizado + revisión en línea", treatment: "ACCEPT" },
  { id: "r6", code: "R-006", title: "Pérdida de certificación ISO por falta de mantenimiento", probability: 1, impact: 5, score: 5, status: "MITIGATED", owner: "José López", category: "Cumplimiento", due: "2025-12-01", control: "Auditorías internas trimestrales + NormaFlow", treatment: "MITIGATE" },
];

export const DEMO_DOCUMENTS = [
  { id: "d1", code: "SGC-MAN-001", title: "Manual del Sistema de Gestión de Calidad", type: "MANUAL", status: "APPROVED", standard: "ISO 9001", clause: "4.4", version: "3.2", owner: "Laura Vega", updated: "2025-05-10", size: "2.4 MB", tags: ["calidad", "manual", "sgc"] },
  { id: "d2", code: "SGC-PRO-001", title: "Procedimiento de Control de Documentos y Registros", type: "PROCEDURE", status: "APPROVED", standard: "ISO 9001", clause: "7.5", version: "2.1", owner: "Carlos Méndez", updated: "2025-04-22", size: "890 KB", tags: ["documentación", "control"] },
  { id: "d3", code: "SGSI-POL-001", title: "Política de Seguridad de la Información", type: "POLICY", status: "IN_REVIEW", standard: "ISO 27001", clause: "5.2", version: "1.5", owner: "Ana García", updated: "2025-06-01", size: "450 KB", tags: ["seguridad", "política", "sgsi"] },
  { id: "d4", code: "SGSI-PRO-003", title: "Procedimiento de Gestión de Incidentes de Seguridad", type: "PROCEDURE", status: "APPROVED", standard: "ISO 27001", clause: "6.1", version: "2.0", owner: "Pedro Ruiz", updated: "2025-03-15", size: "1.2 MB", tags: ["incidentes", "seguridad"] },
  { id: "d5", code: "SGSI-MAN-002", title: "Plan de Continuidad del Negocio y Recuperación", type: "PLAN", status: "DRAFT", standard: "ISO 27001", clause: "8.1", version: "1.0", owner: "María Torres", updated: "2025-06-08", size: "3.1 MB", tags: ["continuidad", "bcp", "recuperación"] },
  { id: "d6", code: "SGC-INS-007", title: "Instrucción de Trabajo — Control de Calidad en Línea", type: "INSTRUCTION", status: "APPROVED", standard: "ISO 9001", clause: "8.5", version: "4.0", owner: "José López", updated: "2025-05-28", size: "780 KB", tags: ["producción", "calidad", "instrucción"] },
  { id: "d7", code: "SGC-PRO-008", title: "Procedimiento de Auditoría Interna", type: "PROCEDURE", status: "APPROVED", standard: "ISO 9001", clause: "9.2", version: "1.3", owner: "Carlos Méndez", updated: "2025-02-14", size: "560 KB", tags: ["auditoría", "interna"] },
  { id: "d8", code: "SGC-FOR-012", title: "Formulario de Registro de No Conformidades", type: "FORM", status: "APPROVED", standard: "ISO 9001", clause: "10.2", version: "2.2", owner: "Ana García", updated: "2025-04-05", size: "120 KB", tags: ["formulario", "nc", "registro"] },
];

export const DEMO_AUDITS = [
  { id: "a1", title: "Auditoría Interna ISO 9001 — Q2 2025", type: "INTERNAL", standard: "ISO 9001", status: "COMPLETED", date: "2025-05-20", findings: 8, criticals: 1, progress: 100, auditor: "Carlos Méndez", scope: "Cláusulas 4 a 10", objectives: "Verificar el mantenimiento del SGC y preparación para la auditoría de vigilancia" },
  { id: "a2", title: "Auditoría de Seguridad ISO 27001 — Semestral", type: "INTERNAL", standard: "ISO 27001", status: "IN_PROGRESS", date: "2025-06-15", findings: 3, criticals: 0, progress: 65, auditor: "Ana García", scope: "Controles Anexo A: A.5 a A.12", objectives: "Evaluar la implementación de controles técnicos y organizativos" },
  { id: "a3", title: "Auditoría de Certificación ISO 9001:2015", type: "EXTERNAL", standard: "ISO 9001", status: "PLANNED", date: "2025-09-10", findings: 0, criticals: 0, progress: 0, auditor: "Bureau Veritas", scope: "Sistema de Gestión de Calidad completo", objectives: "Obtener/renovar la certificación ISO 9001:2015" },
  { id: "a4", title: "Revisión de Controles Anexo A — ISO 27001", type: "INTERNAL", standard: "ISO 27001", status: "PLANNED", date: "2025-08-01", findings: 0, criticals: 0, progress: 0, auditor: "Pedro Ruiz", scope: "Controles A.12 a A.18 (TI y operaciones)", objectives: "Verificar eficacia de controles técnicos implementados" },
];

export const DEMO_NONCONFORMITIES = [
  { id: "nc1", code: "NC-001", title: "Documentación de proceso de producción desactualizada desde hace 8 meses", source: "INTERNAL_AUDIT", severity: "MAJOR", status: "IN_PROGRESS", owner: "José López", due: "2025-07-15", rootCause: "Ausencia de proceso formal de revisión periódica de documentos de proceso. El responsable de actualización no estaba designado formalmente en el procedimiento SGC-PRO-001.", correction: "Actualizar documentación de los 3 procesos afectados", correctiveAction: "Incluir responsable explícito en procedimiento de control documental y programar revisiones semestrales en calendario." },
  { id: "nc2", code: "NC-002", title: "Registros de trazabilidad de lotes de producción incompletos en turno de noche", source: "CUSTOMER_COMPLAINT", severity: "MINOR", status: "OPEN", owner: "María Torres", due: "2025-07-30", rootCause: "Operario del turno de noche sin formación actualizada en sistema de registro. Alta rotación en ese turno.", correction: "Completar registros del lote afectado (LT-2025-0312)", correctiveAction: "Formación obligatoria para todos los operarios de turno. Verificación de registros al inicio de cada turno por supervisor." },
  { id: "nc3", code: "NC-003", title: "Acceso lógico no revocado tras baja voluntaria de empleado de TI", source: "INTERNAL_AUDIT", severity: "CRITICAL", status: "CLOSED", owner: "Ana García", due: "2025-06-01", rootCause: "Proceso de offboarding de IT no estandarizado. RRHH no tenía integración con proceso de IT para revocación automática de accesos.", correction: "Revocación inmediata de todos los accesos del empleado (< 4h)", correctiveAction: "Implementar checklist de offboarding en sistema RRHH con pasos de IT obligatorios. SLA de 24h para revocación. Revisión trimestral de accesos activos." },
  { id: "nc4", code: "NC-004", title: "Indicadores de desempeño sin actualización desde hace 2 trimestres", source: "MANAGEMENT_REVIEW", severity: "MINOR", status: "OPEN", owner: "Carlos Méndez", due: "2025-08-10", rootCause: "Responsable de actualización de KPIs no asignado formalmente. No existe procedimiento de recopilación de datos de indicadores.", correction: "Actualizar todos los indicadores con datos de Q1 y Q2 2025", correctiveAction: "Asignar responsable por indicador. Crear procedimiento de actualización mensual con alerta automática." },
];

export const DEMO_ACTIONS = [
  { id: "ac1", code: "AC-001", title: "Actualizar procedimiento de revisión documental SGC-PRO-001", priority: "HIGH", status: "IN_PROGRESS", due: "2025-07-15", owner: "Laura Vega", source: "NC-001", progress: 60, type: "CORRECTIVE" },
  { id: "ac2", code: "AC-002", title: "Implementar MFA obligatorio en sistemas críticos (ERP + servidor producción)", priority: "CRITICAL", status: "IN_PROGRESS", due: "2025-07-01", owner: "Pedro Ruiz", source: "R-004", progress: 80, type: "CORRECTIVE" },
  { id: "ac3", code: "AC-003", title: "Formación en trazabilidad y registro para operarios turno de noche", priority: "MEDIUM", status: "PENDING", due: "2025-07-30", owner: "María Torres", source: "NC-002", progress: 0, type: "CORRECTIVE" },
  { id: "ac4", code: "AC-004", title: "Revisar, completar y aprobar Política de Seguridad SGSI-POL-001 v1.5", priority: "HIGH", status: "IN_REVIEW", due: "2025-06-20", owner: "Ana García", source: "Doc SGSI-POL-001", progress: 90, type: "IMPROVEMENT" },
  { id: "ac5", code: "AC-005", title: "Implementar checklist de offboarding IT con integración RRHH", priority: "HIGH", status: "COMPLETED", due: "2025-06-01", owner: "Ana García", source: "NC-003", progress: 100, type: "CORRECTIVE" },
  { id: "ac6", code: "AC-006", title: "Actualizar Plan de Continuidad del Negocio (BCP) — revisión completa", priority: "MEDIUM", status: "PENDING", due: "2025-08-30", owner: "María Torres", source: "Auditoría Q2 ISO 9001", progress: 10, type: "IMPROVEMENT" },
  { id: "ac7", code: "AC-007", title: "Asignar responsables por indicador y crear procedimiento de actualización mensual", priority: "MEDIUM", status: "PENDING", due: "2025-08-10", owner: "Carlos Méndez", source: "NC-004", progress: 0, type: "CORRECTIVE" },
];

export const DEMO_INDICATORS = [
  { id: "i1", name: "Satisfacción del Cliente (NPS)", value: 72, target: 75, unit: "pts", trend: "up", status: "AT_RISK", period: "Jun 2025", frequency: "monthly", history: [65, 68, 70, 69, 71, 72], clause: "9.1.2" },
  { id: "i2", name: "Tasa de No Conformidades Internas", value: 2.1, target: 3.0, unit: "%", trend: "down", status: "ON_TRACK", period: "Jun 2025", frequency: "monthly", history: [4.2, 3.8, 3.1, 2.9, 2.4, 2.1], clause: "10.2" },
  { id: "i3", name: "Disponibilidad de Sistemas Críticos", value: 99.2, target: 99.5, unit: "%", trend: "up", status: "AT_RISK", period: "Jun 2025", frequency: "monthly", history: [98.5, 98.9, 99.0, 99.1, 99.2, 99.2], clause: "A.12.1" },
  { id: "i4", name: "Tiempo Medio de Resolución de Incidentes", value: 4.2, target: 4.0, unit: "h", trend: "down", status: "OFF_TRACK", period: "Jun 2025", frequency: "monthly", history: [6.5, 5.8, 5.2, 4.8, 4.5, 4.2], clause: "A.16.1" },
  { id: "i5", name: "Cobertura de Auditorías Planificadas", value: 85, target: 90, unit: "%", trend: "up", status: "AT_RISK", period: "Jun 2025", frequency: "quarterly", history: [60, 65, 70, 75, 80, 85], clause: "9.2" },
  { id: "i6", name: "Documentos Aprobados vs Planificados", value: 94, target: 95, unit: "%", trend: "up", status: "ON_TRACK", period: "Jun 2025", frequency: "monthly", history: [88, 89, 91, 92, 93, 94], clause: "7.5" },
];

export const DEMO_GAP = {
  iso9001: [
    { clause: "4", title: "Contexto de la organización", score: 85, questions: 8, answered: 8, status: "COMPLIANT" },
    { clause: "5", title: "Liderazgo", score: 70, questions: 12, answered: 12, status: "PARTIALLY_COMPLIANT" },
    { clause: "6", title: "Planificación", score: 60, questions: 10, answered: 10, status: "PARTIALLY_COMPLIANT" },
    { clause: "7", title: "Apoyo", score: 80, questions: 14, answered: 14, status: "COMPLIANT" },
    { clause: "8", title: "Operación", score: 75, questions: 20, answered: 20, status: "COMPLIANT" },
    { clause: "9", title: "Evaluación del desempeño", score: 55, questions: 12, answered: 12, status: "NON_COMPLIANT" },
    { clause: "10", title: "Mejora", score: 65, questions: 8, answered: 8, status: "PARTIALLY_COMPLIANT" },
  ],
  iso27001: [
    { clause: "4", title: "Contexto de la organización", score: 80, questions: 8, answered: 8, status: "COMPLIANT" },
    { clause: "5", title: "Liderazgo", score: 75, questions: 10, answered: 10, status: "COMPLIANT" },
    { clause: "6", title: "Planificación", score: 65, questions: 12, answered: 12, status: "PARTIALLY_COMPLIANT" },
    { clause: "7", title: "Apoyo", score: 70, questions: 10, answered: 10, status: "PARTIALLY_COMPLIANT" },
    { clause: "8", title: "Operación", score: 72, questions: 15, answered: 15, status: "COMPLIANT" },
    { clause: "9", title: "Evaluación del desempeño", score: 50, questions: 10, answered: 10, status: "NON_COMPLIANT" },
    { clause: "10", title: "Mejora", score: 60, questions: 8, answered: 8, status: "PARTIALLY_COMPLIANT" },
  ],
};

export const DEMO_PROCESSES = [
  { id: "p1", name: "Producción y entrega", code: "P-01", type: "core", description: "Fabricación, control de calidad en línea y expedición.", owner: "Laura Vega", inputs: ["Pedido", "Materias primas"], outputs: ["Producto terminado", "Trazabilidad"] },
  { id: "p2", name: "Soporte TI y seguridad", code: "P-08", type: "support", description: "Operación de sistemas, accesos, copias de seguridad e incidentes.", owner: "Pedro Ruiz", inputs: ["Tickets", "Cambios"], outputs: ["SLA", "Registros SGSI"] },
  { id: "p3", name: "Gestión de compras", code: "P-03", type: "support", description: "Evaluación y homologación de proveedores críticos.", owner: "Carlos Méndez", inputs: ["Necesidad", "Especificación"], outputs: ["OC", "Evaluación proveedor"] },
];

export const DEMO_EVIDENCE = [
  { id: "e1", title: "Lista de chequeo auditoría interna Q2", module: "audit", date: "2025-05-22", size: "240 KB" },
  { id: "e2", title: "Evidencia cifrado en tránsito — informe técnico", module: "risk", date: "2025-06-01", size: "1.1 MB" },
  { id: "e3", title: "Captura aprobación política SGSI v1.5", module: "document", date: "2025-06-10", size: "180 KB" },
];

export const DEMO_NOTIFICATIONS = [
  { id: "n1", title: "Documento en revisión", body: "SGSI-POL-001 espera aprobación.", time: "2025-06-10T09:00:00Z", read: false, type: "WARNING" },
  { id: "n2", title: "Acción crítica", body: "MFA en sistemas críticos — revisar fecha límite.", time: "2025-06-09T14:20:00Z", read: false, type: "ALERT" },
  { id: "n3", title: "Auditoría en curso", body: "ISO 27001 semestral al 65%.", time: "2025-06-08T11:00:00Z", read: true, type: "INFO" },
];

export const DEMO_ACTIVITY = [
  { time: "2025-06-10T09:12:00Z", user: "Ana García", action: "actualizó", object: "Política de Seguridad SGSI-POL-001 v1.5", type: "document" },
  { time: "2025-06-10T08:38:00Z", user: "Pedro Ruiz", action: "cerró hallazgo", object: "ACC-2025-047 — Acceso no revocado (NC-003)", type: "finding" },
  { time: "2025-06-10T08:00:00Z", user: "Carlos Méndez", action: "inició auditoría", object: "ISO 27001 Semestral — Jun 2025", type: "audit" },
  { time: "2025-06-09T16:45:00Z", user: "María Torres", action: "creó acción", object: "AC-003 — Formación trazabilidad operarios", type: "action" },
  { time: "2025-06-09T11:20:00Z", user: "José López", action: "registró riesgo", object: "R-006 — Pérdida de certificación ISO", type: "risk" },
  { time: "2025-06-08T10:00:00Z", user: "Laura Vega", action: "aprobó documento", object: "SGC-MAN-001 Manual SGC v3.2", type: "document" },
];
