import type { DemoOrganization } from "@/lib/demo/organizations";
import { createAuditEvent, type AuditEventRow } from "@/lib/domain/audit-event";

export type DemoPerson = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  siteId: string;
  teamId: string;
};

export type TeamRow = { id: string; name: string; code: string; siteId: string };

export type TrainingCourseRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  standardTags: string[];
  linkedDocumentCodes: string[];
  defaultValidityMonths: number;
  mandatory: boolean;
};

export type TrainingAssignmentStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"
  | "RETRAINING_REQUIRED";

export type TrainingAssignmentRow = {
  id: string;
  courseId: string;
  assigneeName: string;
  assigneeEmail: string;
  assigneeRole?: string;
  siteId: string;
  processCode?: string;
  teamId?: string;
  status: TrainingAssignmentStatus;
  assignedAt: string;
  dueAt: string;
  completedAt?: string;
  evidenceNote?: string;
  triggeredByDocumentCode?: string;
  triggeredByVersion?: string;
  reminderSent?: boolean;
};

export type ChangeRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTED"
  | "VERIFIED"
  | "CLOSED";

export type ChangeRequestRow = {
  id: string;
  code: string;
  title: string;
  category: string;
  changeType: string;
  reason: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedAreas: string[];
  documentIds: string[];
  processCodes: string[];
  riskCodes: string[];
  trainingCourseIds: string[];
  approvers: string[];
  status: ChangeRequestStatus;
  ncId?: string;
  evidenceIds: string[];
  tasks: { id: string; title: string; done: boolean }[];
  requesterName: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  owner: string;
  status: "APPROVED" | "CONDITIONAL" | "UNDER_REVIEW" | "SUSPENDED";
  documentCodes: string[];
  riskCodes: string[];
  nextReviewDue: string;
  lastEvaluationAt?: string;
  linkedNcIds: string[];
  evidenceIds: string[];
};

export type IntegrationKey =
  | "hr_bamboo"
  | "storage_sharepoint"
  | "ticketing_jira"
  | "sso_okta"
  | "cloud_aws"
  | "tasks_asana"
  | "sheets_upload"
  | "training_ack";

export type IntegrationInstanceRow = {
  key: IntegrationKey;
  name: string;
  category: string;
  description: string;
  valueProposition: string;
  status: "CONNECTED" | "NOT_CONNECTED" | "NEEDS_ATTENTION" | "PENDING";
  lastSyncAt?: string;
  detailNote?: string;
};

export type OnboardingChecklistRow = {
  id: string;
  title: string;
  description: string;
  href: string;
  block: "foundation" | "docs" | "ops" | "assurance";
  done: boolean;
  weight: number;
};

export type AuditProgramSummary = {
  programYear: number;
  programOwner: string;
  nextManagementReview: string;
  objectives: string;
};

function iso(d: Date) {
  return d.toISOString();
}

export function buildDemoPeople(orgId: string, org: DemoOrganization): DemoPerson[] {
  const s1 = `${orgId}-s1`;
  return [
    { id: `${orgId}-p1`, name: "Ana García", email: "ana.garcia@demo.normaflow.io", roleLabel: "Compliance Manager", siteId: s1, teamId: `${orgId}-t1` },
    { id: `${orgId}-p2`, name: "Carlos Méndez", email: "carlos.mendez@demo.normaflow.io", roleLabel: "Calidad", siteId: s1, teamId: `${orgId}-t1` },
    { id: `${orgId}-p3`, name: "Laura Vega", email: "laura.vega@demo.normaflow.io", roleLabel: "Operaciones", siteId: s1, teamId: `${orgId}-t2` },
    { id: `${orgId}-p4`, name: "Pedro Ruiz", email: "pedro.ruiz@demo.normaflow.io", roleLabel: "TI / SGSI", siteId: s1, teamId: `${orgId}-t3` },
    { id: `${orgId}-p5`, name: "María Torres", email: "maria.torres@demo.normaflow.io", roleLabel: "Producción", siteId: `${orgId}-s2`, teamId: `${orgId}-t2` },
  ];
}

export function buildTeams(orgId: string, org: DemoOrganization): TeamRow[] {
  const city = org.city;
  return [
    { id: `${orgId}-t1`, name: "Calidad y cumplimiento", code: "QM", siteId: `${orgId}-s1` },
    { id: `${orgId}-t2`, name: "Producción y logística", code: "OPS", siteId: `${orgId}-s2` },
    { id: `${orgId}-t3`, name: "TI y seguridad", code: "IT", siteId: `${orgId}-s1` },
  ];
}

export function buildTrainingCourses(): TrainingCourseRow[] {
  return [
    {
      id: "tc-sgsi-pol",
      code: "TR-SGSI-01",
      title: "Política de Seguridad de la Información y uso aceptable",
      description: "Reconocimiento obligatorio tras cada versión mayor aprobada de SGSI-POL-001.",
      standardTags: ["ISO 27001", "SGSI"],
      linkedDocumentCodes: ["SGSI-POL-001"],
      defaultValidityMonths: 12,
      mandatory: true,
    },
    {
      id: "tc-doc-control",
      code: "TR-SGC-DC",
      title: "Control documental y registros (ISO 9001)",
      description: "Procedimiento SGC-PRO-001 — roles, estados y trazabilidad.",
      standardTags: ["ISO 9001", "SGC"],
      linkedDocumentCodes: ["SGC-PRO-001"],
      defaultValidityMonths: 24,
      mandatory: true,
    },
    {
      id: "tc-nc-capa",
      code: "TR-NC-01",
      title: "Gestión de no conformidades y acciones correctivas",
      description: "Flujo NC → causa raíz → acción → verificación de eficacia.",
      standardTags: ["ISO 9001", "Mejora"],
      linkedDocumentCodes: ["SGC-FOR-012"],
      defaultValidityMonths: 12,
      mandatory: false,
    },
  ];
}

export function buildTrainingAssignments(orgId: string, people: DemoPerson[]): TrainingAssignmentRow[] {
  const now = new Date();
  const due1 = new Date(now);
  due1.setDate(due1.getDate() + 14);
  const due2 = new Date(now);
  due2.setDate(due2.getDate() - 5);
  const done = new Date(now);
  done.setDate(done.getDate() - 20);

  return [
    {
      id: `${orgId}-ta1`,
      courseId: "tc-sgsi-pol",
      assigneeName: people[3]?.name ?? "Pedro Ruiz",
      assigneeEmail: people[3]?.email ?? "pedro@demo.normaflow.io",
      assigneeRole: "TI / SGSI",
      siteId: `${orgId}-s1`,
      processCode: "P-08",
      teamId: `${orgId}-t3`,
      status: "IN_PROGRESS",
      assignedAt: iso(new Date(now.getTime() - 86400000 * 10)),
      dueAt: due1.toISOString().slice(0, 10),
      triggeredByDocumentCode: "SGSI-POL-001",
      triggeredByVersion: "1.5",
    },
    {
      id: `${orgId}-ta2`,
      courseId: "tc-doc-control",
      assigneeName: people[2]?.name ?? "Laura Vega",
      assigneeEmail: people[2]?.email ?? "laura@demo.normaflow.io",
      siteId: `${orgId}-s1`,
      teamId: `${orgId}-t2`,
      status: "OVERDUE",
      assignedAt: iso(new Date(now.getTime() - 86400000 * 40)),
      dueAt: due2.toISOString().slice(0, 10),
    },
    {
      id: `${orgId}-ta3`,
      courseId: "tc-nc-capa",
      assigneeName: people[1]?.name ?? "Carlos Méndez",
      assigneeEmail: people[1]?.email ?? "carlos@demo.normaflow.io",
      siteId: `${orgId}-s1`,
      teamId: `${orgId}-t1`,
      status: "COMPLETED",
      assignedAt: iso(new Date(now.getTime() - 86400000 * 60)),
      dueAt: done.toISOString().slice(0, 10),
      completedAt: iso(done),
      evidenceNote: "Cuestionario 100% · registro en LMS interno (simulado)",
    },
    {
      id: `${orgId}-ta4`,
      courseId: "tc-sgsi-pol",
      assigneeName: people[4]?.name ?? "María Torres",
      assigneeEmail: people[4]?.email ?? "maria@demo.normaflow.io",
      siteId: `${orgId}-s2`,
      status: "RETRAINING_REQUIRED",
      assignedAt: iso(new Date(now.getTime() - 86400000 * 400)),
      dueAt: new Date(now.getTime() - 86400000 * 30).toISOString().slice(0, 10),
      triggeredByDocumentCode: "SGSI-POL-001",
      triggeredByVersion: "1.4",
    },
  ];
}

export function buildChangeRequests(orgId: string): ChangeRequestRow[] {
  const t = new Date().toISOString().slice(0, 10);
  return [
    {
      id: `${orgId}-cr1`,
      code: "CR-001",
      title: "Actualización MFA obligatorio en sistemas críticos",
      category: "TI / Seguridad",
      changeType: "Cambio organizativo y técnico",
      reason: "Mitigar riesgo R-004 y requisitos Anexo A.9",
      impact: "HIGH",
      affectedAreas: ["TI", "Operaciones", "RRHH"],
      documentIds: ["d3", "d4"],
      processCodes: ["P-08"],
      riskCodes: ["R-004"],
      trainingCourseIds: ["tc-sgsi-pol"],
      approvers: ["Ana García", "Pedro Ruiz"],
      status: "UNDER_REVIEW",
      evidenceIds: [],
      tasks: [
        { id: "t1", title: "Validar alcance en ERP y producción", done: true },
        { id: "t2", title: "Comunicar ventana de despliegue", done: false },
      ],
      requesterName: "Pedro Ruiz",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: `${orgId}-cr2`,
      code: "CR-002",
      title: "Revisión cadena de trazabilidad turno noche",
      category: "Calidad / Producción",
      changeType: "Proceso",
      reason: "NC-002 — registros incompletos",
      impact: "MEDIUM",
      affectedAreas: ["Producción", "Calidad"],
      documentIds: ["d6"],
      processCodes: ["P-01"],
      riskCodes: ["R-005"],
      trainingCourseIds: ["tc-nc-capa"],
      approvers: ["Laura Vega", "Carlos Méndez"],
      status: "IMPLEMENTED",
      ncId: "nc2",
      evidenceIds: [],
      tasks: [
        { id: "t1", title: "Actualizar instructivo de trabajo", done: true },
        { id: "t2", title: "Formación operarios turno noche", done: true },
      ],
      requesterName: "María Torres",
      createdAt: "2025-05-01",
      updatedAt: "2025-06-02",
    },
    {
      id: `${orgId}-cr3`,
      code: "CR-003",
      title: "Migración checklist offboarding a NormaFlow",
      category: "RRHH / IT",
      changeType: "Sistema de gestión",
      reason: "NC-003 cerrada — estandarizar evidencias",
      impact: "LOW",
      affectedAreas: ["RRHH", "TI"],
      documentIds: ["d2"],
      processCodes: ["P-08"],
      riskCodes: [],
      trainingCourseIds: [],
      approvers: ["Ana García"],
      status: "CLOSED",
      ncId: "nc3",
      evidenceIds: [],
      tasks: [{ id: "t1", title: "Cierre formal y lección aprendida", done: true }],
      requesterName: "Ana García",
      createdAt: "2025-04-10",
      updatedAt: "2025-06-15",
    },
  ];
}

export function buildSuppliers(orgId: string): SupplierRow[] {
  return [
    {
      id: `${orgId}-sup1`,
      code: "PRV-001",
      name: "Componentes del Norte S.A.",
      category: "Materias primas críticas",
      criticality: "HIGH",
      owner: "Carlos Méndez",
      status: "APPROVED",
      documentCodes: ["SGC-PRO-008"],
      riskCodes: ["R-002"],
      nextReviewDue: "2026-08-01",
      lastEvaluationAt: "2025-11-15",
      linkedNcIds: [],
      evidenceIds: [],
    },
    {
      id: `${orgId}-sup2`,
      code: "PRV-002",
      name: "CloudSec Iberia",
      category: "Servicios TI / hosting",
      criticality: "CRITICAL",
      owner: "Pedro Ruiz",
      status: "UNDER_REVIEW",
      documentCodes: ["SGSI-PRO-003"],
      riskCodes: ["R-001", "R-004"],
      nextReviewDue: "2026-05-20",
      linkedNcIds: [],
      evidenceIds: [],
    },
    {
      id: `${orgId}-sup3`,
      code: "PRV-003",
      name: "Logística Exprés 24h",
      category: "Transporte última milla",
      criticality: "MEDIUM",
      owner: "Laura Vega",
      status: "CONDITIONAL",
      documentCodes: [],
      riskCodes: ["R-002"],
      nextReviewDue: "2026-03-30",
      lastEvaluationAt: "2025-09-01",
      linkedNcIds: [],
      evidenceIds: [],
    },
  ];
}

export function buildIntegrations(): IntegrationInstanceRow[] {
  return [
    {
      key: "hr_bamboo",
      name: "BambooHR",
      category: "RRHH / personas",
      description: "Sincroniza altas, bajas y equipos para asignación de formaciones y offboarding.",
      valueProposition: "Asignación automática de trainings y evidencias de acknowledgement.",
      status: "NOT_CONNECTED",
      detailNote: "Webhook simulado: empleados → NormaFlow",
    },
    {
      key: "storage_sharepoint",
      name: "Microsoft SharePoint",
      category: "Almacenamiento documental",
      description: "Vincula bibliotecas controladas con documentos aprobados en NormaFlow.",
      valueProposition: "Doble registro con hash y registro de lectura.",
      status: "PENDING",
      lastSyncAt: "2026-03-28T10:00:00.000Z",
    },
    {
      key: "ticketing_jira",
      name: "Jira Service Management",
      category: "Ticketing / cambios",
      description: "Crea tickets desde NC, cambios y acciones con trazabilidad bidireccional.",
      valueProposition: "Cierre de acciones con evidencia en ambos sistemas.",
      status: "CONNECTED",
      lastSyncAt: "2026-04-01T08:30:00.000Z",
    },
    {
      key: "sso_okta",
      name: "Okta / SSO",
      category: "Identidad",
      description: "Autenticación centralizada y grupos para roles en NormaFlow.",
      valueProposition: "Menos cuentas locales; auditoría de acceso unificada.",
      status: "NEEDS_ATTENTION",
      detailNote: "Certificado SAML próximo a renovar (simulado)",
    },
    {
      key: "cloud_aws",
      name: "AWS Organizations",
      category: "Infraestructura cloud",
      description: "Inventario de cuentas y controles para evidencias ISO 27001.",
      valueProposition: "Evidencias automáticas de configuración y logs.",
      status: "NOT_CONNECTED",
    },
    {
      key: "tasks_asana",
      name: "Asana",
      category: "Tareas / proyectos",
      description: "Sincroniza hitos de planes de acción y CAPA.",
      valueProposition: "Visibilidad ejecutiva sin duplicar estado de cumplimiento.",
      status: "NOT_CONNECTED",
    },
    {
      key: "sheets_upload",
      name: "Importación CSV / Excel",
      category: "Carga de datos",
      description: "Carga controlada de indicadores y listados maestros.",
      valueProposition: "Onboarding rápido desde hojas existentes.",
      status: "CONNECTED",
      lastSyncAt: "2026-03-15T14:00:00.000Z",
    },
    {
      key: "training_ack",
      name: "Policy acknowledgement",
      category: "Formación / lectura obligada",
      description: "Registro de lectura y test corto vinculado a versiones de política.",
      valueProposition: "Dispara reentrenamiento al aprobar documento.",
      status: "CONNECTED",
      lastSyncAt: "2026-04-02T09:00:00.000Z",
    },
  ];
}

export function buildOnboardingChecklist(): OnboardingChecklistRow[] {
  return [
    { id: "ob-sites", title: "Confirmar sedes y equipos", description: "Alinear estructura operativa con el alcance certificable.", href: "/app/setup", block: "foundation", done: false, weight: 12 },
    { id: "ob-roles", title: "Revisar roles y responsables", description: "Dueños por proceso, documento y riesgo.", href: "/app/settings", block: "foundation", done: false, weight: 10 },
    { id: "ob-docs", title: "Cargar o validar documentos controlados", description: "Estados, revisores y periodicidad.", href: "/app/documents", block: "docs", done: false, weight: 15 },
    { id: "ob-train", title: "Lanzar plan de formación inicial", description: "Políticas y procedimientos críticos.", href: "/app/training", block: "docs", done: false, weight: 14 },
    { id: "ob-change", title: "Registrar primer cambio evaluado", description: "Práctica de gestión de cambios formal.", href: "/app/changes", block: "ops", done: false, weight: 11 },
    { id: "ob-gap", title: "Completar primer GAP", description: "Línea base ISO 9001 / 27001.", href: "/app/gap", block: "assurance", done: false, weight: 14 },
    { id: "ob-audit", title: "Planificar programa de auditorías", description: "Internas y puntos de vigilancia.", href: "/app/audits", block: "assurance", done: false, weight: 12 },
    { id: "ob-nc", title: "Probar flujo NC → acción → cierre", description: "Con trazabilidad y eficacia.", href: "/app/nonconformities", block: "assurance", done: false, weight: 12 },
  ];
}

export function buildAuditProgram(org: DemoOrganization): AuditProgramSummary {
  return {
    programYear: 2026,
    programOwner: "Carlos Méndez",
    nextManagementReview: "2026-07-18",
    objectives: `Programa anual ${org.shortName}: vigilancia ISO 9001 + ISO 27001, seguimiento de acciones de auditoría externa y revisión de proveedores críticos.`,
  };
}

/** Enriquece documentos del seed con control documental empresarial */
export function enrichDocumentsEnterprise<T extends { id: string; code: string; owner: string; status: string; type: string }>(
  docs: T[],
  orgId: string
): (T & {
  reviewDue: string;
  reviewCycleMonths: number;
  reviewers: string[];
  approvers: string[];
  trainingImpact: boolean;
  linkedChangeIds: string[];
  lastAcknowledgedAt?: string;
})[] {
  return docs.map((d, i) => {
    const base = new Date();
    base.setMonth(base.getMonth() + (6 + (i % 6)));
    const reviewDue = base.toISOString().slice(0, 10);
    const linkedChangeIds: string[] = [];
    if (d.code.includes("SGSI-POL")) linkedChangeIds.push(`${orgId}-cr1`);
    if (d.code.includes("SGC-INS")) linkedChangeIds.push(`${orgId}-cr2`);
    return {
      ...d,
      reviewDue,
      reviewCycleMonths: d.type === "POLICY" || d.type === "MANUAL" ? 12 : 24,
      reviewers: [d.owner, "Carlos Méndez"],
      approvers: ["Ana García"],
      trainingImpact: d.type === "POLICY" || d.code.includes("PRO-001"),
      linkedChangeIds,
      lastAcknowledgedAt: d.status === "APPROVED" && i % 2 === 0 ? "2026-02-10T11:00:00.000Z" : undefined,
    };
  });
}

export function enrichEvidenceEnterprise<T extends { id: string; title: string; module: string | null }>(
  items: T[],
  _orgId: string
): (T & {
  origin: "MANUAL" | "AUTOMATED" | "INTEGRATION";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  framework: string | null;
})[] {
  return items.map((ev, i) => ({
    ...ev,
    origin: i === 0 ? "AUTOMATED" : i === 1 ? "INTEGRATION" : "MANUAL",
    relatedEntityType: ev.module === "audit" ? "AUDIT" : ev.module === "risk" ? "RISK" : ev.module === "document" ? "DOCUMENT" : null,
    relatedEntityId: ev.module === "audit" ? "a1" : ev.module === "risk" ? "r1" : ev.module === "document" ? "d3" : null,
    framework: i % 2 === 0 ? "ISO 9001" : "ISO 27001",
  }));
}

export function buildInitialAuditLog(session: { name: string; email: string }, org: DemoOrganization): AuditEventRow[] {
  const ts = new Date().toISOString();
  return [
    createAuditEvent({
      ts,
      actorName: session.name,
      actorEmail: session.email,
      action: "SESSION_WORKSPACE_INIT",
      entityType: "ORGANIZATION",
      entityId: org.id,
      entityLabel: org.name,
      reason: "Inicialización de espacio de trabajo (demo empresarial)",
    }),
    createAuditEvent({
      ts: new Date(Date.now() - 3600000).toISOString(),
      actorName: "Carlos Méndez",
      actorEmail: "carlos.mendez@demo.normaflow.io",
      action: "DOCUMENT_APPROVED",
      entityType: "DOCUMENT",
      entityId: "d1",
      entityLabel: "SGC-MAN-001",
      newValue: "APPROVED",
      reason: "Revisión programada Q2",
    }),
    createAuditEvent({
      ts: new Date(Date.now() - 7200000).toISOString(),
      actorName: "Ana García",
      actorEmail: "ana.garcia@demo.normaflow.io",
      action: "CHANGE_STATUS",
      entityType: "CHANGE_REQUEST",
      entityId: `${org.id}-cr1`,
      entityLabel: "CR-001",
      oldValue: "SUBMITTED",
      newValue: "UNDER_REVIEW",
    }),
  ];
}
