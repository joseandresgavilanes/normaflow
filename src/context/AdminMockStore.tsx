"use client";

/**
 * In-memory mock store for the Phase 1.1 admin / info / catalog pages.
 *
 * Purpose: lets the stakeholder click through the new UI and validate the
 * design *before* we wire the real Prisma persistence (Phase 1.2+).
 *
 * State resets on hard refresh (this is intentional — it's a demo store).
 * Server actions in `src/lib/actions/*.ts` remain in place for the real
 * Prisma integration; this file is purely client-side.
 */

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { planMaxUsers } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

export type CatalogBase = { id: string; name: string; active: boolean; createdAt: string };

export type PositionRow = CatalogBase & { description: string | null };
export type LocationRow = CatalogBase & { description: string | null };
export type DispositionRow = CatalogBase;
export type ArchiveMethodRow = CatalogBase;
export type RecordTypeRow = CatalogBase;
export type RetentionTimeRow = CatalogBase & { months: number };
export type ProcessOptionRow = { id: string; code: string | null; name: string };

export type RecordMockRow = {
  id: string;
  code: string;
  name: string;
  processId: string | null;
  processName: string | null;
  recordTypeId: string | null;
  retentionTimeId: string | null;
  dispositionId: string | null;
  archiveMethodId: string | null;
  custodianId: string | null;
  physicalLocation: string | null;
  digitalLocation: string | null;
  observations: string | null;
  active: boolean;
  createdAt: string;
  lastEntryAt: string | null;
};

export type RecordEntryMockRow = {
  id: string;
  recordId: string;
  reference: string;
  description: string | null;
  fileName: string | null;
  hasFile?: boolean;
  /** URL de objeto en navegador (demo); revocar al eliminar entrada. */
  blobUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  enteredById: string | null;
  enteredAt: string;
};

export type ACPMStage =
  | "REQUEST"
  | "REQUEST_APPROVAL"
  | "ANALYSIS"
  | "SOLUTION_APPROVAL"
  | "IMPLEMENTATION"
  | "VERIFICATION"
  | "CLOSED";

export type ACPMType = "CORRECTIVE" | "PREVENTIVE" | "IMPROVEMENT";
export type ACPMPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ACPMRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: ACPMType;
  priority: ACPMPriority;
  stage: ACPMStage;
  source: string | null;
  rootCause: string | null;
  proposedSolution: string | null;
  effectivenessCheck: string | null;
  effectivenessAt: string | null;
  requestedById: string | null;
  requestApproverId: string | null;
  solutionApproverId: string | null;
  ownerId: string | null;
  dueDate: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type ACPMHistoryRow = {
  id: string;
  acpmId: string;
  kind: "transition" | "comment" | "edit";
  fromStage: ACPMStage | null;
  toStage: ACPMStage | null;
  message: string;
  actorId: string | null;
  at: string;
};

export type AuditTrailEntry = {
  id: string;
  at: string;
  action: string;   // create, update, deactivate, transition, approve, reject, invite, ...
  module: string;   // position, personnel, record, acpm, group, organization, ...
  recordId: string | null;
  recordLabel: string | null;
  actorId: string | null;
  actorName: string | null;
  summary: string;  // short human-readable line
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type PersonnelMockRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  identification: string | null;
  positionId: string | null;
  active: boolean;
  hiredAt: string | null;
  createdAt: string;
};

export type OrgMemberMockRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "COMPLIANCE_MANAGER" | "AUDITOR" | "CONTRIBUTOR" | "VIEWER";
  createdAt: string;
  isSelf: boolean;
};

export type GroupMockRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  memberIds: string[];
  createdAt: string;
};

export type OrgSettingsMock = {
  name: string;
  industry: string | null;
  country: string;
  logoUrl: string | null;
  plan: "STARTER" | "GROWTH" | "ENTERPRISE";
};

type AdminMockState = {
  organization: OrgSettingsMock;
  members: OrgMemberMockRow[];
  groups: GroupMockRow[];
  positions: PositionRow[];
  personnel: PersonnelMockRow[];
  locations: LocationRow[];
  retentionTimes: RetentionTimeRow[];
  dispositions: DispositionRow[];
  archiveMethods: ArchiveMethodRow[];
  recordTypes: RecordTypeRow[];
  processes: ProcessOptionRow[];
  records: RecordMockRow[];
  recordEntries: RecordEntryMockRow[];
  acpms: ACPMRow[];
  acpmHistory: ACPMHistoryRow[];
  auditTrail: AuditTrailEntry[];
};

type AdminSeedMode = "demo" | "blank";

type AdminMockProfile = {
  name: string;
  email: string;
  orgName: string;
  roleKey: string;
  plan?: string;
};

// ─── Seed ────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const past = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAdminRole(role: string | undefined): OrgMemberMockRow["role"] {
  const key = role?.trim().toUpperCase().replace(/\s+/g, "_");
  if (
    key === "SUPER_ADMIN" ||
    key === "ORG_ADMIN" ||
    key === "COMPLIANCE_MANAGER" ||
    key === "AUDITOR" ||
    key === "CONTRIBUTOR" ||
    key === "VIEWER"
  ) {
    return key;
  }
  return "ORG_ADMIN";
}

function normalizeAdminPlan(plan: string | undefined): OrgSettingsMock["plan"] {
  const key = plan?.trim().toUpperCase();
  if (key === "STARTER" || key === "ENTERPRISE") return key;
  return "GROWTH";
}

function blankState(profile?: AdminMockProfile): AdminMockState {
  const adminUserId = "u-self";
  const memberName = profile?.name || "Admin Cliente";
  const memberEmail = profile?.email || "cliente@normaflow.io";
  return {
    organization: {
      name: profile?.orgName || "Mi Organización",
      industry: null,
      country: "ES",
      logoUrl: null,
      plan: normalizeAdminPlan(profile?.plan),
    },
    members: [
      {
        membershipId: "m-self",
        userId: adminUserId,
        name: memberName,
        email: memberEmail,
        role: normalizeAdminRole(profile?.roleKey),
        createdAt: NOW,
        isSelf: true,
      },
    ],
    groups: [],
    positions: [],
    personnel: [],
    locations: [],
    retentionTimes: [],
    dispositions: [],
    archiveMethods: [],
    recordTypes: [],
    processes: [],
    records: [],
    recordEntries: [],
    acpms: [],
    acpmHistory: [],
    auditTrail: [
      {
        id: "at-local-login",
        at: NOW,
        action: "login",
        module: "auth",
        recordId: adminUserId,
        recordLabel: memberName,
        actorId: adminUserId,
        actorName: memberName,
        summary: "Inicio de sesión correcto",
      },
    ],
  };
}

function initialState(): AdminMockState {
  const adminUserId = "u-self";
  const positions: PositionRow[] = [
    { id: "pos-1", name: "Director de Calidad",      description: "Responsable del SGC.",        active: true, createdAt: past(220) },
    { id: "pos-2", name: "Auditor Interno",          description: null,                          active: true, createdAt: past(210) },
    { id: "pos-3", name: "Coordinador SGSI",         description: "Coordina ISO 27001.",         active: true, createdAt: past(180) },
    { id: "pos-4", name: "Responsable de Procesos",  description: null,                          active: true, createdAt: past(150) },
    { id: "pos-5", name: "Becario de Calidad",       description: "Cargo histórico, ya no usado.", active: false, createdAt: past(400) },
  ];

  return {
    organization: {
      name: "Tecnoserv Industrial S.A.",
      industry: "Manufactura",
      country: "ES",
      logoUrl: null,
      plan: "GROWTH",
    },
    members: [
      { membershipId: "m-1", userId: adminUserId,    name: "Ana García",     email: "ana.garcia@tecnoserv.example",   role: "ORG_ADMIN",          createdAt: past(240), isSelf: true },
      { membershipId: "m-2", userId: "u-mt",          name: "María Torres",   email: "maria.torres@tecnoserv.example", role: "COMPLIANCE_MANAGER", createdAt: past(220), isSelf: false },
      { membershipId: "m-3", userId: "u-lc",          name: "Luis Castro",    email: "luis.castro@tecnoserv.example",  role: "CONTRIBUTOR",        createdAt: past(180), isSelf: false },
      { membershipId: "m-4", userId: "u-ar",          name: "Ana Ríos",       email: "ana.rios@tecnoserv.example",     role: "AUDITOR",            createdAt: past(150), isSelf: false },
      { membershipId: "m-5", userId: "u-pg",          name: "Pedro Gómez",    email: "pedro.gomez@tecnoserv.example",  role: "VIEWER",             createdAt: past(90),  isSelf: false },
    ],
    groups: [
      {
        id: "g-1",
        name: "Auditores internos",
        description: "Equipo que ejecuta el plan anual de auditorías internas.",
        permissions: ["audits:*", "audit-program:read", "nc:create", "documents:read"],
        memberIds: ["u-mt", "u-ar"],
        createdAt: past(160),
      },
      {
        id: "g-2",
        name: "Editores documentales",
        description: "Personal autorizado a crear y revisar documentos del SGC.",
        permissions: ["documents:create", "documents:read", "records:create"],
        memberIds: ["u-mt", "u-lc"],
        createdAt: past(120),
      },
    ],
    positions,
    personnel: [
      { id: "per-1", firstName: "María",  lastName: "Torres",  email: "maria.torres@tecnoserv.example",  identification: "44.812.901-K", positionId: "pos-1", active: true,  hiredAt: past(900),  createdAt: past(900) },
      { id: "per-2", firstName: "Luis",   lastName: "Castro",  email: "luis.castro@tecnoserv.example",   identification: "29.103.554-T", positionId: "pos-4", active: true,  hiredAt: past(620),  createdAt: past(620) },
      { id: "per-3", firstName: "Ana",    lastName: "Ríos",    email: "ana.rios@tecnoserv.example",      identification: "51.992.014-B", positionId: "pos-2", active: true,  hiredAt: past(540),  createdAt: past(540) },
      { id: "per-4", firstName: "Pedro",  lastName: "Gómez",   email: "pedro.gomez@tecnoserv.example",   identification: "33.481.722-M", positionId: null,    active: true,  hiredAt: past(380),  createdAt: past(380) },
      { id: "per-5", firstName: "Carlos", lastName: "Méndez",  email: null,                                identification: "47.001.220-N", positionId: "pos-3", active: true,  hiredAt: past(260),  createdAt: past(260) },
      { id: "per-6", firstName: "Sara",   lastName: "Domingo", email: "sara.domingo@tecnoserv.example",  identification: null,            positionId: "pos-5", active: false, hiredAt: past(1100), createdAt: past(1100) },
    ],
    locations: [
      { id: "loc-1", name: "Sede Madrid",          description: "Oficina central, calle Velázquez 24.",     active: true,  createdAt: past(900) },
      { id: "loc-2", name: "Sede Barcelona",       description: "Oficina comercial, Av. Diagonal 188.",     active: true,  createdAt: past(820) },
      { id: "loc-3", name: "Planta Valencia",      description: "Centro productivo principal.",             active: true,  createdAt: past(720) },
      { id: "loc-4", name: "Servidor Corporativo", description: "Repositorio digital de documentos del SGC.", active: true,  createdAt: past(600) },
      { id: "loc-5", name: "Almacén histórico",    description: "Archivo físico cerrado en 2023.",          active: false, createdAt: past(1500) },
    ],
    retentionTimes: [
      { id: "ret-1", name: "6 meses", months: 6,   active: true, createdAt: past(900) },
      { id: "ret-2", name: "1 año",   months: 12,  active: true, createdAt: past(900) },
      { id: "ret-3", name: "3 años",  months: 36,  active: true, createdAt: past(900) },
      { id: "ret-4", name: "5 años",  months: 60,  active: true, createdAt: past(900) },
      { id: "ret-5", name: "10 años", months: 120, active: true, createdAt: past(900) },
    ],
    dispositions: [
      { id: "dis-1", name: "RECICLAR",            active: true, createdAt: past(900) },
      { id: "dis-2", name: "ELIMINAR",            active: true, createdAt: past(900) },
      { id: "dis-3", name: "ARCHIVAR HISTÓRICO",  active: true, createdAt: past(900) },
    ],
    archiveMethods: [
      { id: "arc-1", name: "Archivador físico",      active: true, createdAt: past(900) },
      { id: "arc-2", name: "Carpeta compartida",     active: true, createdAt: past(900) },
      { id: "arc-3", name: "Repositorio cifrado",    active: true, createdAt: past(900) },
      { id: "arc-4", name: "Almacén en frío",        active: true, createdAt: past(900) },
    ],
    recordTypes: [
      { id: "rt-1", name: "FÍSICO",                 active: true, createdAt: past(900) },
      { id: "rt-2", name: "ELECTRÓNICO",            active: true, createdAt: past(900) },
      { id: "rt-3", name: "FÍSICO Y ELECTRÓNICO",   active: true, createdAt: past(900) },
    ],
    processes: [
      { id: "proc-production", code: "P-01", name: "Producción" },
      { id: "proc-governance", code: "P-02", name: "Gobierno SGC" },
      { id: "proc-sgsi", code: "P-08", name: "SGSI" },
      { id: "proc-hr", code: "P-06", name: "Recursos Humanos" },
      { id: "proc-maintenance", code: "P-07", name: "Mantenimiento" },
      { id: "proc-legal", code: "P-09", name: "Legal" },
    ],
    records: [
      {
        id: "rec-1",
        code: "REG-CAL-001",
        name: "Registro de inspección de producto terminado",
        processId: "proc-production",
        processName: "Producción",
        recordTypeId: "rt-2",
        retentionTimeId: "ret-3",
        dispositionId: "dis-1",
        archiveMethodId: "arc-2",
        custodianId: "per-1",
        physicalLocation: null,
        digitalLocation: "/calidad/inspeccion-producto",
        observations: "Aplica a todo lote despachado a cliente.",
        active: true,
        createdAt: past(540),
        lastEntryAt: past(2),
      },
      {
        id: "rec-2",
        code: "REG-CAL-002",
        name: "Acta de revisión por la dirección",
        processId: "proc-governance",
        processName: "Gobierno SGC",
        recordTypeId: "rt-3",
        retentionTimeId: "ret-5",
        dispositionId: "dis-3",
        archiveMethodId: "arc-1",
        custodianId: "per-1",
        physicalLocation: "Archivador Calidad, estante A-2",
        digitalLocation: "/calidad/revision-direccion",
        observations: "Conservar 10 años por requisito interno.",
        active: true,
        createdAt: past(820),
        lastEntryAt: past(90),
      },
      {
        id: "rec-3",
        code: "REG-SGSI-001",
        name: "Registro de incidentes de seguridad",
        processId: "proc-sgsi",
        processName: "SGSI",
        recordTypeId: "rt-2",
        retentionTimeId: "ret-4",
        dispositionId: "dis-2",
        archiveMethodId: "arc-3",
        custodianId: "per-5",
        physicalLocation: null,
        digitalLocation: "/sgsi/incidentes",
        observations: "Vinculado a ISO 27001 A.5.24.",
        active: true,
        createdAt: past(420),
        lastEntryAt: past(11),
      },
      {
        id: "rec-4",
        code: "REG-RRHH-001",
        name: "Registro de formación y competencias",
        processId: "proc-hr",
        processName: "Recursos Humanos",
        recordTypeId: "rt-3",
        retentionTimeId: "ret-4",
        dispositionId: "dis-1",
        archiveMethodId: "arc-1",
        custodianId: "per-4",
        physicalLocation: "Carpeta RRHH 2026",
        digitalLocation: "/rrhh/formacion-2026.xlsx",
        observations: null,
        active: true,
        createdAt: past(360),
        lastEntryAt: past(34),
      },
      {
        id: "rec-5",
        code: "REG-CAL-003",
        name: "Hoja de calibración de equipos",
        processId: "proc-maintenance",
        processName: "Mantenimiento",
        recordTypeId: "rt-1",
        retentionTimeId: "ret-3",
        dispositionId: "dis-1",
        archiveMethodId: "arc-1",
        custodianId: "per-2",
        physicalLocation: "Almacén técnico Valencia",
        digitalLocation: null,
        observations: "Las hojas físicas se digitalizan al cierre del año.",
        active: true,
        createdAt: past(280),
        lastEntryAt: past(180),
      },
      {
        id: "rec-6",
        code: "REG-LEG-001",
        name: "Registro histórico de contratos firmados",
        processId: "proc-legal",
        processName: "Legal",
        recordTypeId: "rt-1",
        retentionTimeId: "ret-5",
        dispositionId: "dis-3",
        archiveMethodId: "arc-4",
        custodianId: null,
        physicalLocation: "Almacén histórico",
        digitalLocation: null,
        observations: "Migrado al archivo histórico en 2023.",
        active: false,
        createdAt: past(1100),
        lastEntryAt: past(720),
      },
    ],
    recordEntries: [
      { id: "re-1", recordId: "rec-1", reference: "LOTE-2026-1142", description: "Inspección lote L-2891, sin desviaciones.",            fileName: "inspeccion-1142.pdf", enteredById: "per-2", enteredAt: past(2) },
      { id: "re-2", recordId: "rec-1", reference: "LOTE-2026-1141", description: "Inspección lote L-2890, observación en sello.",         fileName: "inspeccion-1141.pdf", enteredById: "per-2", enteredAt: past(9) },
      { id: "re-3", recordId: "rec-1", reference: "LOTE-2026-1140", description: "Inspección lote L-2889, sin desviaciones.",            fileName: "inspeccion-1140.pdf", enteredById: "per-2", enteredAt: past(16) },
      { id: "re-4", recordId: "rec-2", reference: "RD-2026-Q1",     description: "Acta de revisión Q1: 6 acuerdos, 0 NC mayores.",       fileName: "rd-q1.pdf",            enteredById: "per-1", enteredAt: past(90) },
      { id: "re-5", recordId: "rec-2", reference: "RD-2025-Q4",     description: "Acta de revisión Q4 2025.",                            fileName: "rd-q4-2025.pdf",       enteredById: "per-1", enteredAt: past(180) },
      { id: "re-6", recordId: "rec-3", reference: "INC-2026-0042", description: "Intento de acceso fallido a panel de administración.", fileName: null,                   enteredById: "per-5", enteredAt: past(11) },
      { id: "re-7", recordId: "rec-3", reference: "INC-2026-0041", description: "Phishing reportado por usuario, contenido.",            fileName: "phishing-report.eml",  enteredById: "per-5", enteredAt: past(28) },
      { id: "re-8", recordId: "rec-4", reference: "FORM-2026-014", description: "Curso ISO 27001:2022 — 4 personas certificadas.",       fileName: "certificados.zip",     enteredById: "per-4", enteredAt: past(34) },
      { id: "re-9", recordId: "rec-5", reference: "CAL-2026-007",  description: "Calibración anual báscula L-3, OK.",                   fileName: null,                   enteredById: "per-2", enteredAt: past(180) },
    ],
    acpms: [
      {
        id: "ac-1",
        code: "ACPM-2026-014",
        title: "Rotación incorrecta de credenciales tras offboarding",
        description: "Tras la baja de un colaborador, las reglas de notificación seguían apuntando a su cuenta. Se omitió control 8.1.4 en lote L-2891.",
        type: "CORRECTIVE",
        priority: "CRITICAL",
        stage: "VERIFICATION",
        source: "Auditoría interna Q3 — NC-2026-118",
        rootCause: "El procedimiento de offboarding no incluía la actualización de la matriz de roles del SGSI.",
        proposedSolution: "Reasignar reglas de notificación a roles funcionales (no a usuarios) y añadir revisión cruzada al cierre de turno.",
        effectivenessCheck: "Sin reincidencias en 21 días desde implementación.",
        effectivenessAt: past(2),
        requestedById: "per-3", requestApproverId: "per-1", solutionApproverId: "per-1",
        ownerId: "per-2",
        dueDate: future(8),
        progress: 90,
        createdAt: past(34),
        updatedAt: past(2),
      },
      {
        id: "ac-2",
        code: "ACPM-2026-015",
        title: "Quejas sobre tiempos de respuesta del soporte",
        description: "3 clientes reportaron tiempos >24h en consultas críticas durante Q1.",
        type: "CORRECTIVE",
        priority: "HIGH",
        stage: "IMPLEMENTATION",
        source: "Voz del cliente (encuestas Q1)",
        rootCause: "Falta de SLA documentado y panel de seguimiento de tickets sin alertas.",
        proposedSolution: "Definir SLA por tipo de incidencia, configurar alertas a 4h/12h y revisión semanal del backlog.",
        effectivenessCheck: null,
        effectivenessAt: null,
        requestedById: "per-2", requestApproverId: "per-1", solutionApproverId: "per-1",
        ownerId: "per-3",
        dueDate: future(22),
        progress: 55,
        createdAt: past(20),
        updatedAt: past(1),
      },
      {
        id: "ac-3",
        code: "ACPM-2026-016",
        title: "Oportunidad: digitalizar calibración de equipos",
        description: "Las hojas de calibración siguen siendo físicas. Riesgo de pérdida y dificulta el reporting trimestral.",
        type: "IMPROVEMENT",
        priority: "MEDIUM",
        stage: "SOLUTION_APPROVAL",
        source: "Revisión por la dirección Q1",
        rootCause: "Proceso heredado, nadie había evaluado el coste-beneficio de la migración.",
        proposedSolution: "Adquirir tablets para los técnicos y un formulario digital con firma. Migración progresiva en 6 meses.",
        effectivenessCheck: null,
        effectivenessAt: null,
        requestedById: "per-1", requestApproverId: "per-1", solutionApproverId: null,
        ownerId: "per-2",
        dueDate: future(60),
        progress: 25,
        createdAt: past(14),
        updatedAt: past(3),
      },
      {
        id: "ac-4",
        code: "ACPM-2026-017",
        title: "Auditoría 2026 detectó controles del Anexo A sin evidencia",
        description: "8 controles A.5.x sin evidencia registrada en NormaFlow durante la auditoría anual.",
        type: "CORRECTIVE",
        priority: "HIGH",
        stage: "ANALYSIS",
        source: "Auditoría externa de certificación",
        rootCause: null,
        proposedSolution: null,
        effectivenessCheck: null,
        effectivenessAt: null,
        requestedById: "per-5", requestApproverId: "per-1", solutionApproverId: null,
        ownerId: "per-5",
        dueDate: future(14),
        progress: 10,
        createdAt: past(7),
        updatedAt: past(1),
      },
      {
        id: "ac-5",
        code: "ACPM-2026-018",
        title: "Preventiva: actualizar matriz de riesgos al Anexo A 2022",
        description: "La matriz vigente todavía mapea a controles A. del 2013. Hay que migrar al Anexo A 2022.",
        type: "PREVENTIVE",
        priority: "MEDIUM",
        stage: "REQUEST_APPROVAL",
        source: "Iniciativa del Comité de Calidad",
        rootCause: null,
        proposedSolution: null,
        effectivenessCheck: null,
        effectivenessAt: null,
        requestedById: "per-5", requestApproverId: null, solutionApproverId: null,
        ownerId: null,
        dueDate: future(45),
        progress: 0,
        createdAt: past(3),
        updatedAt: past(3),
      },
      {
        id: "ac-6",
        code: "ACPM-2026-019",
        title: "Solicitud: revisión de procedimiento de gestión del cambio",
        description: "Detectado por usuario que el procedimiento PR-04 no contempla cambios de proveedores cloud.",
        type: "CORRECTIVE",
        priority: "LOW",
        stage: "REQUEST",
        source: "Reporte de usuario",
        rootCause: null,
        proposedSolution: null,
        effectivenessCheck: null,
        effectivenessAt: null,
        requestedById: "per-4", requestApproverId: null, solutionApproverId: null,
        ownerId: null,
        dueDate: future(30),
        progress: 0,
        createdAt: past(1),
        updatedAt: past(1),
      },
      {
        id: "ac-7",
        code: "ACPM-2026-013",
        title: "Defectos en sellado de lote L-2740",
        description: "3 unidades del lote presentaron sellado deficiente.",
        type: "CORRECTIVE",
        priority: "HIGH",
        stage: "CLOSED",
        source: "Inspección de producto terminado",
        rootCause: "Desajuste térmico de la selladora tras mantenimiento.",
        proposedSolution: "Recalibrar selladora y añadir verificación inicial de turno.",
        effectivenessCheck: "30 días sin reincidencias. Cerrado en revisión Q1.",
        effectivenessAt: past(45),
        requestedById: "per-2", requestApproverId: "per-1", solutionApproverId: "per-1",
        ownerId: "per-2",
        dueDate: past(50),
        progress: 100,
        createdAt: past(120),
        updatedAt: past(45),
      },
    ],
    acpmHistory: [
      { id: "h1",  acpmId: "ac-1", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "ACPM abierta desde auditoría interna",        actorId: "per-3", at: past(34) },
      { id: "h2",  acpmId: "ac-1", kind: "transition", fromStage: "REQUEST",             toStage: "REQUEST_APPROVAL",    message: "Solicitud enviada a aprobación",              actorId: "per-3", at: past(33) },
      { id: "h3",  acpmId: "ac-1", kind: "transition", fromStage: "REQUEST_APPROVAL",    toStage: "ANALYSIS",            message: "Solicitud aprobada",                          actorId: "per-1", at: past(30) },
      { id: "h4",  acpmId: "ac-1", kind: "transition", fromStage: "ANALYSIS",            toStage: "SOLUTION_APPROVAL",   message: "Causa raíz documentada (5 porqués)",         actorId: "per-2", at: past(20) },
      { id: "h5",  acpmId: "ac-1", kind: "transition", fromStage: "SOLUTION_APPROVAL",   toStage: "IMPLEMENTATION",      message: "Solución aprobada por dirección",            actorId: "per-1", at: past(15) },
      { id: "h6",  acpmId: "ac-1", kind: "transition", fromStage: "IMPLEMENTATION",      toStage: "VERIFICATION",        message: "Acciones implementadas, comienza verificación", actorId: "per-2", at: past(5) },
      { id: "h7",  acpmId: "ac-2", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "ACPM abierta desde encuestas Q1",            actorId: "per-2", at: past(20) },
      { id: "h8",  acpmId: "ac-2", kind: "transition", fromStage: "ANALYSIS",            toStage: "SOLUTION_APPROVAL",   message: "Solución propuesta",                          actorId: "per-3", at: past(12) },
      { id: "h9",  acpmId: "ac-2", kind: "transition", fromStage: "SOLUTION_APPROVAL",   toStage: "IMPLEMENTATION",      message: "Solución aprobada",                           actorId: "per-1", at: past(8) },
      { id: "h10", acpmId: "ac-3", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "Oportunidad detectada en revisión",          actorId: "per-1", at: past(14) },
      { id: "h11", acpmId: "ac-3", kind: "transition", fromStage: "ANALYSIS",            toStage: "SOLUTION_APPROVAL",   message: "Propuesta lista para revisión",              actorId: "per-2", at: past(3) },
      { id: "h12", acpmId: "ac-4", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "Apertura desde auditoría externa",            actorId: "per-5", at: past(7) },
      { id: "h13", acpmId: "ac-4", kind: "transition", fromStage: "REQUEST_APPROVAL",    toStage: "ANALYSIS",            message: "Solicitud aprobada",                          actorId: "per-1", at: past(4) },
      { id: "h14", acpmId: "ac-5", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "Iniciativa del comité",                      actorId: "per-5", at: past(3) },
      { id: "h15", acpmId: "ac-5", kind: "transition", fromStage: "REQUEST",             toStage: "REQUEST_APPROVAL",    message: "Solicitud enviada a aprobación",              actorId: "per-5", at: past(3) },
      { id: "h16", acpmId: "ac-6", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "Solicitud creada",                            actorId: "per-4", at: past(1) },
      { id: "h17", acpmId: "ac-7", kind: "transition", fromStage: null,                  toStage: "REQUEST",             message: "Defecto detectado",                           actorId: "per-2", at: past(120) },
      { id: "h18", acpmId: "ac-7", kind: "transition", fromStage: "VERIFICATION",        toStage: "CLOSED",              message: "Verificación de eficacia aprobada — cerrado",  actorId: "per-1", at: past(45) },
    ],
    auditTrail: buildSeedAuditTrail(),
  };
}

function buildSeedAuditTrail(): AuditTrailEntry[] {
  // Names match the personnel seed for traceability.
  const ana   = { id: "u-self", name: "Ana García" };
  const maria = { id: "u-mt",   name: "María Torres" };
  const luis  = { id: "u-lc",   name: "Luis Castro" };
  const ariel = { id: "u-ar",   name: "Ana Ríos" };
  const pedro = { id: "u-pg",   name: "Pedro Gómez" };

  let counter = 1;
  function entry(daysAgo: number, hoursAgo: number, partial: Omit<AuditTrailEntry, "id" | "at">): AuditTrailEntry {
    const at = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();
    return { id: `at-${String(counter++).padStart(3, "0")}`, at, ...partial };
  }

  return [
    // ─── ACPM lifecycle (matches acpms + acpmHistory seeds above) ───
    entry(34, 5,  { action: "create",     module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: ariel.id, actorName: ariel.name, summary: "Apertura de ACPM desde auditoría interna", after: { stage: "REQUEST", priority: "CRITICAL" } }),
    entry(33, 12, { action: "transition", module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: ariel.id, actorName: ariel.name, summary: "Solicitud enviada a aprobación", before: { stage: "REQUEST" }, after: { stage: "REQUEST_APPROVAL" } }),
    entry(30, 9,  { action: "approve",    module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: maria.id, actorName: maria.name, summary: "Solicitud aprobada", before: { stage: "REQUEST_APPROVAL" }, after: { stage: "ANALYSIS" } }),
    entry(20, 4,  { action: "transition", module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: luis.id,  actorName: luis.name,  summary: "Causa raíz documentada (5 porqués)", after: { rootCause: "El procedimiento de offboarding no actualizaba la matriz de roles." } }),
    entry(15, 7,  { action: "approve",    module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: maria.id, actorName: maria.name, summary: "Solución aprobada por dirección", before: { stage: "SOLUTION_APPROVAL" }, after: { stage: "IMPLEMENTATION" } }),
    entry(5,  6,  { action: "transition", module: "acpm",          recordId: "ac-1", recordLabel: "ACPM-2026-014",  actorId: luis.id,  actorName: luis.name,  summary: "Acciones implementadas, inicia verificación", before: { stage: "IMPLEMENTATION", progress: 65 }, after: { stage: "VERIFICATION", progress: 90 } }),

    entry(20, 1,  { action: "create",     module: "acpm",          recordId: "ac-2", recordLabel: "ACPM-2026-015",  actorId: maria.id, actorName: maria.name, summary: "Apertura ACPM por quejas de cliente", after: { stage: "REQUEST", priority: "HIGH" } }),
    entry(12, 8,  { action: "transition", module: "acpm",          recordId: "ac-2", recordLabel: "ACPM-2026-015",  actorId: luis.id,  actorName: luis.name,  summary: "Solución propuesta", after: { proposedSolution: "Definir SLA por tipo y panel de alertas." } }),
    entry(8,  3,  { action: "approve",    module: "acpm",          recordId: "ac-2", recordLabel: "ACPM-2026-015",  actorId: maria.id, actorName: maria.name, summary: "Solución aprobada", before: { stage: "SOLUTION_APPROVAL" }, after: { stage: "IMPLEMENTATION" } }),
    entry(3,  10, { action: "update",     module: "acpm",          recordId: "ac-2", recordLabel: "ACPM-2026-015",  actorId: luis.id,  actorName: luis.name,  summary: "Progreso actualizado", before: { progress: 40 }, after: { progress: 55 } }),

    entry(14, 0,  { action: "create",     module: "acpm",          recordId: "ac-3", recordLabel: "ACPM-2026-016",  actorId: maria.id, actorName: maria.name, summary: "Oportunidad de mejora desde revisión por la dirección", after: { stage: "REQUEST", type: "IMPROVEMENT" } }),
    entry(3,  4,  { action: "transition", module: "acpm",          recordId: "ac-3", recordLabel: "ACPM-2026-016",  actorId: luis.id,  actorName: luis.name,  summary: "Propuesta enviada a aprobación", before: { stage: "ANALYSIS" }, after: { stage: "SOLUTION_APPROVAL" } }),

    entry(7,  6,  { action: "create",     module: "acpm",          recordId: "ac-4", recordLabel: "ACPM-2026-017",  actorId: pedro.id, actorName: pedro.name, summary: "Apertura por hallazgos auditoría externa", after: { stage: "REQUEST" } }),
    entry(4,  3,  { action: "approve",    module: "acpm",          recordId: "ac-4", recordLabel: "ACPM-2026-017",  actorId: maria.id, actorName: maria.name, summary: "Solicitud aprobada", before: { stage: "REQUEST_APPROVAL" }, after: { stage: "ANALYSIS" } }),

    entry(3,  2,  { action: "create",     module: "acpm",          recordId: "ac-5", recordLabel: "ACPM-2026-018",  actorId: pedro.id, actorName: pedro.name, summary: "Preventiva: migración Anexo A 2022", after: { stage: "REQUEST", type: "PREVENTIVE" } }),
    entry(1,  9,  { action: "create",     module: "acpm",          recordId: "ac-6", recordLabel: "ACPM-2026-019",  actorId: ariel.id, actorName: ariel.name, summary: "Solicitud de revisión de PR-04", after: { stage: "REQUEST" } }),

    // ─── Records ───
    entry(2,  3,  { action: "add_entry", module: "record_entry",   recordId: "re-1", recordLabel: "LOTE-2026-1142",  actorId: luis.id,  actorName: luis.name,  summary: "Nueva entrada en REG-CAL-001: inspección lote L-2891" }),
    entry(9,  2,  { action: "add_entry", module: "record_entry",   recordId: "re-2", recordLabel: "LOTE-2026-1141",  actorId: luis.id,  actorName: luis.name,  summary: "Nueva entrada en REG-CAL-001: inspección lote L-2890 con observación" }),
    entry(11, 5,  { action: "add_entry", module: "record_entry",   recordId: "re-6", recordLabel: "INC-2026-0042",   actorId: pedro.id, actorName: pedro.name, summary: "Nueva entrada en REG-SGSI-001: intento de acceso fallido" }),
    entry(28, 1,  { action: "add_entry", module: "record_entry",   recordId: "re-7", recordLabel: "INC-2026-0041",   actorId: pedro.id, actorName: pedro.name, summary: "Nueva entrada en REG-SGSI-001: phishing reportado" }),
    entry(34, 2,  { action: "add_entry", module: "record_entry",   recordId: "re-8", recordLabel: "FORM-2026-014",   actorId: ariel.id, actorName: ariel.name, summary: "Nueva entrada en REG-RRHH-001: curso ISO 27001:2022" }),
    entry(45, 4,  { action: "create",    module: "record",         recordId: "rec-3", recordLabel: "REG-SGSI-001",   actorId: ana.id,   actorName: ana.name,   summary: "Alta de registro: Registro de incidentes de seguridad" }),
    entry(180,8,  { action: "create",    module: "record",         recordId: "rec-1", recordLabel: "REG-CAL-001",    actorId: ana.id,   actorName: ana.name,   summary: "Alta de registro: Registro de inspección de producto terminado" }),

    // ─── Documents (audit trail uses recordId of doc) ───
    entry(2,  4,  { action: "approve",    module: "document",      recordId: "d-001", recordLabel: "SGSI-POL-001 v3.2", actorId: maria.id, actorName: maria.name, summary: "Política de Seguridad de la Información aprobada", before: { status: "IN_REVIEW", version: "3.2" }, after: { status: "APPROVED", version: "3.2" } }),
    entry(6,  10, { action: "submit_review", module: "document",   recordId: "d-001", recordLabel: "SGSI-POL-001 v3.2", actorId: luis.id,  actorName: luis.name,  summary: "Documento enviado a revisión", before: { status: "DRAFT" }, after: { status: "IN_REVIEW" } }),
    entry(7,  5,  { action: "create",     module: "document_version", recordId: "d-001-v32", recordLabel: "SGSI-POL-001 v3.2", actorId: luis.id, actorName: luis.name, summary: "Nueva versión creada: v3.2", after: { version: "3.2", previousVersion: "3.1" } }),
    entry(18, 3,  { action: "obsolete",   module: "document",      recordId: "d-091", recordLabel: "PR-04 v1.4 (antiguo)", actorId: ana.id,   actorName: ana.name,   summary: "Documento marcado como obsoleto", before: { status: "APPROVED" }, after: { status: "OBSOLETE" } }),

    // ─── Audits ───
    entry(60, 6,  { action: "approve",    module: "audit_program", recordId: "ap-2026", recordLabel: "Programa anual 2026", actorId: ana.id, actorName: ana.name,   summary: "Programa anual de auditoría aprobado", before: { status: "DRAFT" }, after: { status: "APPROVED" } }),
    entry(45, 2,  { action: "complete",   module: "audit",         recordId: "a-2026-q1", recordLabel: "Auditoría interna Q1", actorId: pedro.id, actorName: pedro.name, summary: "Auditoría cerrada con informe", after: { status: "COMPLETED", findings: 4 } }),
    entry(46, 8,  { action: "create",     module: "audit_finding", recordId: "f-q1-03", recordLabel: "Hallazgo Q1-03", actorId: pedro.id, actorName: pedro.name, summary: "Hallazgo registrado: Anexo A.5 sin evidencia", after: { type: "NONCONFORMITY", severity: "MINOR" } }),

    // ─── Catalog / admin ───
    entry(0,  2,  { action: "create",     module: "position",      recordId: "pos-3",  recordLabel: "Coordinador SGSI",     actorId: ana.id,   actorName: ana.name,   summary: "Cargo creado en el directorio", after: { name: "Coordinador SGSI" } }),
    entry(1,  7,  { action: "create",     module: "personnel",     recordId: "per-5",  recordLabel: "Carlos Méndez",        actorId: ana.id,   actorName: ana.name,   summary: "Alta de personal: Carlos Méndez (Coordinador SGSI)", after: { positionId: "pos-3" } }),
    entry(5,  3,  { action: "update",     module: "organization",  recordId: "org-1",  recordLabel: "Tecnoserv Industrial", actorId: ana.id,   actorName: ana.name,   summary: "Actualización de datos de la organización", before: { industry: "Manufactura tradicional" }, after: { industry: "Manufactura" } }),
    entry(10, 4,  { action: "invite",     module: "member",        recordId: "u-pg",   recordLabel: "Pedro Gómez",          actorId: ana.id,   actorName: ana.name,   summary: "Pedro Gómez invitado como Visor", after: { role: "VIEWER" } }),
    entry(11, 6,  { action: "update",     module: "member",        recordId: "u-lc",   recordLabel: "Luis Castro",          actorId: ana.id,   actorName: ana.name,   summary: "Rol cambiado", before: { role: "VIEWER" }, after: { role: "CONTRIBUTOR" } }),
    entry(12, 1,  { action: "create",     module: "group",         recordId: "g-1",    recordLabel: "Auditores internos",   actorId: ana.id,   actorName: ana.name,   summary: "Grupo creado", after: { permissions: 4 } }),
    entry(12, 8,  { action: "update",     module: "group_permission", recordId: "g-1", recordLabel: "Auditores internos",   actorId: ana.id,   actorName: ana.name,   summary: "Permisos del grupo actualizados", before: { permissions: 2 }, after: { permissions: 4 } }),
    entry(13, 3,  { action: "create",     module: "location",      recordId: "loc-4",  recordLabel: "Servidor Corporativo", actorId: ana.id,   actorName: ana.name,   summary: "Lugar añadido al catálogo" }),

    // ─── Auth ───
    entry(0,  0,  { action: "login",      module: "auth",          recordId: ana.id,   recordLabel: "Ana García",           actorId: ana.id,   actorName: ana.name,   summary: "Inicio de sesión correcto" }),
    entry(1,  10, { action: "login",      module: "auth",          recordId: maria.id, recordLabel: "María Torres",         actorId: maria.id, actorName: maria.name, summary: "Inicio de sesión correcto" }),
    entry(2,  6,  { action: "login",      module: "auth",          recordId: luis.id,  recordLabel: "Luis Castro",          actorId: luis.id,  actorName: luis.name,  summary: "Inicio de sesión correcto" }),

    // ─── Risks / nonconformities ───
    entry(40, 2,  { action: "update",     module: "risk",          recordId: "r-021",  recordLabel: "R-021 Acceso no autorizado", actorId: luis.id, actorName: luis.name, summary: "Probabilidad ajustada tras controles preventivos", before: { probability: 4, score: 16 }, after: { probability: 3, score: 12 } }),
    entry(35, 9,  { action: "create",     module: "nonconformity", recordId: "nc-118", recordLabel: "NC-2026-118",          actorId: ariel.id, actorName: ariel.name, summary: "No conformidad abierta tras auditoría", after: { severity: "MAJOR" } }),
    entry(34, 5,  { action: "create",     module: "action",        recordId: "ac-1",   recordLabel: "ACPM-2026-014",        actorId: ariel.id, actorName: ariel.name, summary: "Acción correctiva enlazada a NC-2026-118" }),
  ];
}

function future(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function stageTransitionMessage(toStage: ACPMStage): string {
  switch (toStage) {
    case "REQUEST":            return "Devuelto a solicitud";
    case "REQUEST_APPROVAL":   return "Solicitud enviada a aprobación";
    case "ANALYSIS":           return "Solicitud aprobada — comienza análisis";
    case "SOLUTION_APPROVAL":  return "Solución propuesta enviada a aprobación";
    case "IMPLEMENTATION":     return "Solución aprobada — comienza implementación";
    case "VERIFICATION":       return "Acciones implementadas — comienza verificación de eficacia";
    case "CLOSED":             return "ACPM cerrada — verificación de eficacia validada";
  }
}

// ─── Reducer ─────────────────────────────────────────────────────────

type CatalogKey = "positions" | "locations" | "dispositions" | "archiveMethods" | "recordTypes";

type Action =
  | { type: "updateOrg"; patch: Partial<OrgSettingsMock> }
  | { type: "addCatalog"; key: CatalogKey; row: PositionRow | LocationRow | DispositionRow | ArchiveMethodRow | RecordTypeRow }
  | { type: "updateCatalog"; key: CatalogKey; id: string; patch: Record<string, unknown> }
  | { type: "deactivateCatalog"; key: CatalogKey; id: string }
  | { type: "addRetention"; row: RetentionTimeRow }
  | { type: "updateRetention"; id: string; patch: Partial<RetentionTimeRow> }
  | { type: "deactivateRetention"; id: string }
  | { type: "addPersonnel"; row: PersonnelMockRow }
  | { type: "updatePersonnel"; id: string; patch: Partial<PersonnelMockRow> }
  | { type: "deactivatePersonnel"; id: string }
  | { type: "inviteMember"; row: OrgMemberMockRow }
  | { type: "updateMemberRole"; membershipId: string; role: OrgMemberMockRow["role"] }
  | { type: "removeMember"; membershipId: string }
  | { type: "createGroup"; row: GroupMockRow }
  | { type: "updateGroup"; id: string; patch: Partial<GroupMockRow> }
  | { type: "deleteGroup"; id: string }
  | { type: "toggleGroupPermission"; groupId: string; permission: string }
  | { type: "toggleGroupMember"; groupId: string; userId: string }
  | { type: "addRecord"; row: RecordMockRow }
  | { type: "updateRecord"; id: string; patch: Partial<RecordMockRow> }
  | { type: "deactivateRecord"; id: string }
  | { type: "addRecordEntry"; row: RecordEntryMockRow }
  | { type: "deleteRecordEntry"; id: string }
  | { type: "addACPM"; row: ACPMRow; history: ACPMHistoryRow }
  | { type: "updateACPM"; id: string; patch: Partial<ACPMRow>; history?: ACPMHistoryRow }
  | { type: "addACPMHistory"; row: ACPMHistoryRow }
  | { type: "deleteACPM"; id: string }
  | { type: "appendAudit"; row: AuditTrailEntry };

function reducer(state: AdminMockState, action: Action): AdminMockState {
  switch (action.type) {
    case "updateOrg":
      return { ...state, organization: { ...state.organization, ...action.patch } };

    case "addCatalog":
      return { ...state, [action.key]: [action.row as never, ...(state[action.key] as never[])] };
    case "updateCatalog":
      return {
        ...state,
        [action.key]: (state[action.key] as Array<{ id: string }>).map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r
        ),
      };
    case "deactivateCatalog":
      return {
        ...state,
        [action.key]: (state[action.key] as Array<{ id: string; active: boolean }>).map((r) =>
          r.id === action.id ? { ...r, active: false } : r
        ),
      };

    case "addRetention":
      return { ...state, retentionTimes: [action.row, ...state.retentionTimes] };
    case "updateRetention":
      return {
        ...state,
        retentionTimes: state.retentionTimes.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "deactivateRetention":
      return {
        ...state,
        retentionTimes: state.retentionTimes.map((r) => (r.id === action.id ? { ...r, active: false } : r)),
      };

    case "addPersonnel":
      return { ...state, personnel: [action.row, ...state.personnel] };
    case "updatePersonnel":
      return { ...state, personnel: state.personnel.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case "deactivatePersonnel":
      return { ...state, personnel: state.personnel.map((p) => (p.id === action.id ? { ...p, active: false } : p)) };

    case "inviteMember":
      return { ...state, members: [...state.members, action.row] };
    case "updateMemberRole":
      return { ...state, members: state.members.map((m) => (m.membershipId === action.membershipId ? { ...m, role: action.role } : m)) };
    case "removeMember":
      return {
        ...state,
        members: state.members.filter((m) => m.membershipId !== action.membershipId),
        groups: state.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((uid) => state.members.find((m) => m.membershipId === action.membershipId)?.userId !== uid) })),
      };

    case "createGroup":
      return { ...state, groups: [...state.groups, action.row] };
    case "updateGroup":
      return { ...state, groups: state.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)) };
    case "deleteGroup":
      return { ...state, groups: state.groups.filter((g) => g.id !== action.id) };
    case "toggleGroupPermission":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const has = g.permissions.includes(action.permission);
          return { ...g, permissions: has ? g.permissions.filter((p) => p !== action.permission) : [...g.permissions, action.permission] };
        }),
      };
    case "toggleGroupMember":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const has = g.memberIds.includes(action.userId);
          return { ...g, memberIds: has ? g.memberIds.filter((u) => u !== action.userId) : [...g.memberIds, action.userId] };
        }),
      };

    case "addRecord":
      return { ...state, records: [action.row, ...state.records] };
    case "updateRecord":
      return { ...state, records: state.records.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) };
    case "deactivateRecord":
      return { ...state, records: state.records.map((r) => (r.id === action.id ? { ...r, active: false } : r)) };
    case "addRecordEntry":
      return {
        ...state,
        recordEntries: [action.row, ...state.recordEntries],
        records: state.records.map((r) => (r.id === action.row.recordId ? { ...r, lastEntryAt: action.row.enteredAt } : r)),
      };
    case "deleteRecordEntry": {
      const entry = state.recordEntries.find((e) => e.id === action.id);
      const recordEntries = state.recordEntries.filter((e) => e.id !== action.id);
      let records = state.records;
      if (entry) {
        const remainingForRecord = recordEntries.filter((e) => e.recordId === entry.recordId);
        const newLast = remainingForRecord
          .map((e) => e.enteredAt)
          .sort()
          .reverse()[0] ?? null;
        records = state.records.map((r) => (r.id === entry.recordId ? { ...r, lastEntryAt: newLast } : r));
      }
      return { ...state, recordEntries, records };
    }

    case "addACPM":
      return {
        ...state,
        acpms: [action.row, ...state.acpms],
        acpmHistory: [...state.acpmHistory, action.history],
      };
    case "updateACPM":
      return {
        ...state,
        acpms: state.acpms.map((a) => (a.id === action.id ? { ...a, ...action.patch, updatedAt: new Date().toISOString() } : a)),
        acpmHistory: action.history ? [...state.acpmHistory, action.history] : state.acpmHistory,
      };
    case "addACPMHistory":
      return { ...state, acpmHistory: [...state.acpmHistory, action.row] };
    case "deleteACPM":
      return {
        ...state,
        acpms: state.acpms.filter((a) => a.id !== action.id),
        acpmHistory: state.acpmHistory.filter((h) => h.acpmId !== action.id),
      };
    case "appendAudit":
      return { ...state, auditTrail: [action.row, ...state.auditTrail] };
  }
}

// ─── Context ─────────────────────────────────────────────────────────

type AdminMockContextValue = {
  mode: "demo" | "live";
  state: AdminMockState;
  // organization
  updateOrganization: (patch: Partial<OrgSettingsMock>) => void;
  // simple catalogs
  createPosition: (data: { name: string; description?: string }) => void;
  updatePosition: (id: string, data: { name?: string; description?: string }) => void;
  deactivatePosition: (id: string) => void;
  createLocation: (data: { name: string; description?: string }) => void;
  updateLocation: (id: string, data: { name?: string; description?: string }) => void;
  deactivateLocation: (id: string) => void;
  createDisposition: (data: { name: string }) => void;
  updateDisposition: (id: string, data: { name?: string }) => void;
  deactivateDisposition: (id: string) => void;
  createArchiveMethod: (data: { name: string }) => void;
  updateArchiveMethod: (id: string, data: { name?: string }) => void;
  deactivateArchiveMethod: (id: string) => void;
  createRecordType: (data: { name: string }) => void;
  updateRecordType: (id: string, data: { name?: string }) => void;
  deactivateRecordType: (id: string) => void;
  // retention
  createRetention: (data: { name: string; months: number }) => void;
  updateRetention: (id: string, data: { name?: string; months?: number }) => void;
  deactivateRetention: (id: string) => void;
  // personnel
  createPersonnel: (data: { firstName: string; lastName: string; email?: string; identification?: string; positionId?: string; hiredAt?: string }) => void;
  updatePersonnel: (id: string, data: { firstName?: string; lastName?: string; email?: string; identification?: string; positionId?: string; hiredAt?: string }) => void;
  deactivatePersonnel: (id: string) => void;
  // members
  inviteMember: (data: { name: string; email: string; role: OrgMemberMockRow["role"] }) => void | Promise<void>;
  updateMemberRole: (membershipId: string, role: OrgMemberMockRow["role"]) => void;
  removeMember: (membershipId: string) => void;
  // groups
  createGroup: (data: { name: string; description?: string }) => void;
  updateGroup: (id: string, data: { name?: string; description?: string }) => void;
  deleteGroup: (id: string) => void;
  toggleGroupPermission: (groupId: string, permission: string) => void;
  toggleGroupMember: (groupId: string, userId: string) => void;
  // records
  createRecord: (data: {
    code: string;
    name: string;
    processId?: string;
    recordTypeId?: string;
    retentionTimeId?: string;
    dispositionId?: string;
    archiveMethodId?: string;
    custodianId?: string;
    physicalLocation?: string;
    digitalLocation?: string;
    observations?: string;
  }) => void;
  updateRecord: (id: string, data: Partial<Omit<RecordMockRow, "id" | "createdAt" | "lastEntryAt" | "active">>) => void;
  deactivateRecord: (id: string) => void;
  addRecordEntry: (
    recordId: string,
    data: {
      reference: string;
      description?: string;
      fileName?: string;
      file?: File;
      blobUrl?: string | null;
      mimeType?: string | null;
      fileSize?: number | null;
    }
  ) => void;
  getRecordEntryUrl: (id: string) => Promise<string>;
  deleteRecordEntry: (id: string) => void;
  // ACPMs
  createACPM: (data: { title: string; description?: string; type: ACPMType; priority: ACPMPriority; source?: string; dueDate?: string }) => void;
  updateACPMFields: (id: string, data: Partial<Pick<ACPMRow, "title" | "description" | "priority" | "type" | "source" | "rootCause" | "proposedSolution" | "effectivenessCheck" | "effectivenessAt" | "ownerId" | "dueDate" | "progress">>) => void;
  transitionACPM: (id: string, toStage: ACPMStage, comment?: string) => void;
  rejectACPM: (id: string, comment: string) => void;
  commentACPM: (id: string, message: string) => void;
  deleteACPM: (id: string) => void;
};

export const AdminCtx = createContext<AdminMockContextValue | null>(null);
const Ctx = AdminCtx;
export type { AdminMockContextValue };

export function AdminMockProvider({
  children,
  seedMode = "demo",
  profile,
}: {
  children: React.ReactNode;
  seedMode?: AdminSeedMode;
  profile?: AdminMockProfile;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    { seedMode, profile },
    ({ seedMode: mode, profile: p }) => (mode === "blank" ? blankState(p) : initialState())
  );

  const emit = useCallback(
    (partial: Omit<AuditTrailEntry, "id" | "at" | "actorId" | "actorName">) => {
      const self = state.members.find((m) => m.isSelf);
      dispatch({
        type: "appendAudit",
        row: {
          id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          at: new Date().toISOString(),
          actorId: self?.userId ?? null,
          actorName: self?.name ?? null,
          ...partial,
        },
      });
    },
    [state.members]
  );

  const mkPosition = useCallback(
    (data: { name: string; description?: string }): PositionRow => ({
      id: id("pos"),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
    }),
    []
  );
  const mkLocation = useCallback(
    (data: { name: string; description?: string }): LocationRow => ({
      id: id("loc"),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
    }),
    []
  );
  const mkSimple = useCallback((prefix: string, data: { name: string }) => ({
    id: id(prefix),
    name: data.name.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  }), []);

  const value = useMemo<AdminMockContextValue>(
    () => ({
      mode: "demo",
      state,
      updateOrganization: (patch) => {
        const before = { name: state.organization.name, industry: state.organization.industry, country: state.organization.country };
        dispatch({ type: "updateOrg", patch });
        emit({ action: "update", module: "organization", recordId: "org-1", recordLabel: state.organization.name, summary: "Datos de la organización actualizados", before, after: patch });
      },

      createPosition: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        const row = mkPosition(data);
        dispatch({ type: "addCatalog", key: "positions", row });
        emit({ action: "create", module: "position", recordId: row.id, recordLabel: row.name, summary: `Cargo creado: ${row.name}` });
      },
      updatePosition: (id, data) =>
        dispatch({ type: "updateCatalog", key: "positions", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        } }),
      deactivatePosition: (id) => dispatch({ type: "deactivateCatalog", key: "positions", id }),

      createLocation: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        const row = mkLocation(data);
        dispatch({ type: "addCatalog", key: "locations", row });
        emit({ action: "create", module: "location", recordId: row.id, recordLabel: row.name, summary: `Lugar añadido: ${row.name}` });
      },
      updateLocation: (id, data) =>
        dispatch({ type: "updateCatalog", key: "locations", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        } }),
      deactivateLocation: (id) => dispatch({ type: "deactivateCatalog", key: "locations", id }),

      createDisposition: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "dispositions", row: mkSimple("dis", data) });
      },
      updateDisposition: (id, data) =>
        dispatch({ type: "updateCatalog", key: "dispositions", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateDisposition: (id) => dispatch({ type: "deactivateCatalog", key: "dispositions", id }),

      createArchiveMethod: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "archiveMethods", row: mkSimple("arc", data) });
      },
      updateArchiveMethod: (id, data) =>
        dispatch({ type: "updateCatalog", key: "archiveMethods", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateArchiveMethod: (id) => dispatch({ type: "deactivateCatalog", key: "archiveMethods", id }),

      createRecordType: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "recordTypes", row: mkSimple("rt", data) });
      },
      updateRecordType: (id, data) =>
        dispatch({ type: "updateCatalog", key: "recordTypes", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateRecordType: (id) => dispatch({ type: "deactivateCatalog", key: "recordTypes", id }),

      createRetention: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        if (!Number.isFinite(data.months) || data.months < 0) throw new Error("Los meses deben ser no negativos.");
        dispatch({
          type: "addRetention",
          row: { id: id("ret"), name: data.name.trim(), months: Math.round(data.months), active: true, createdAt: new Date().toISOString() },
        });
      },
      updateRetention: (id, data) =>
        dispatch({ type: "updateRetention", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.months !== undefined ? { months: Math.round(data.months) } : {}),
        } }),
      deactivateRetention: (id) => dispatch({ type: "deactivateRetention", id }),

      createPersonnel: (data) => {
        if (!data.firstName.trim() || !data.lastName.trim()) throw new Error("Nombre y apellido son obligatorios.");
        const row = {
          id: id("per"),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email?.trim() || null,
          identification: data.identification?.trim() || null,
          positionId: data.positionId || null,
          active: true,
          hiredAt: data.hiredAt || null,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "addPersonnel", row });
        emit({ action: "create", module: "personnel", recordId: row.id, recordLabel: `${row.firstName} ${row.lastName}`, summary: `Alta de personal: ${row.firstName} ${row.lastName}` });
      },
      updatePersonnel: (id, data) =>
        dispatch({
          type: "updatePersonnel",
          id,
          patch: {
            ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
            ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
            ...(data.identification !== undefined ? { identification: data.identification.trim() || null } : {}),
            ...(data.positionId !== undefined ? { positionId: data.positionId || null } : {}),
            ...(data.hiredAt !== undefined ? { hiredAt: data.hiredAt || null } : {}),
          },
        }),
      deactivatePersonnel: (id) => dispatch({ type: "deactivatePersonnel", id }),

      inviteMember: (data) => {
        const email = data.email.trim().toLowerCase();
        if (!email || !data.name.trim()) throw new Error("Nombre y email son obligatorios.");
        if (state.members.some((m) => m.email.toLowerCase() === email)) {
          throw new Error("Esa persona ya pertenece a la organización.");
        }
        // Plan quota enforcement
        const limit = planMaxUsers(state.organization.plan);
        if (limit !== null && state.members.length >= limit) {
          throw new Error(`Has alcanzado el límite de ${limit} usuarios del plan ${state.organization.plan}. Actualiza tu plan para añadir más personas.`);
        }
        const userId = id("u");
        const name = data.name.trim();
        dispatch({
          type: "inviteMember",
          row: {
            membershipId: id("m"),
            userId,
            name,
            email,
            role: data.role,
            createdAt: new Date().toISOString(),
            isSelf: false,
          },
        });
        emit({ action: "invite", module: "member", recordId: userId, recordLabel: name, summary: `Invitación enviada a ${name} como ${data.role}`, after: { role: data.role, email } });
      },
      updateMemberRole: (membershipId, role) => {
        const target = state.members.find((m) => m.membershipId === membershipId);
        if (!target) throw new Error("Miembro no encontrado.");
        if (target.role === "ORG_ADMIN" && role !== "ORG_ADMIN") {
          const others = state.members.filter((m) => m.membershipId !== membershipId && m.role === "ORG_ADMIN").length;
          if (others === 0) throw new Error("No puedes dejar la organización sin Admin.");
        }
        dispatch({ type: "updateMemberRole", membershipId, role });
        emit({ action: "update", module: "member", recordId: target.userId, recordLabel: target.name, summary: `Rol cambiado · ${target.name}`, before: { role: target.role }, after: { role } });
      },
      removeMember: (membershipId) => {
        const target = state.members.find((m) => m.membershipId === membershipId);
        if (!target) throw new Error("Miembro no encontrado.");
        if (target.isSelf) throw new Error("No puedes eliminarte a ti mismo.");
        if (target.role === "ORG_ADMIN") {
          const others = state.members.filter((m) => m.membershipId !== membershipId && m.role === "ORG_ADMIN").length;
          if (others === 0) throw new Error("No puedes eliminar al último Admin.");
        }
        dispatch({ type: "removeMember", membershipId });
      },

      createGroup: (data) => {
        if (!data.name.trim()) throw new Error("El nombre del grupo es obligatorio.");
        const row = {
          id: id("g"),
          name: data.name.trim(),
          description: data.description?.trim() || null,
          permissions: [],
          memberIds: [],
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "createGroup", row });
        emit({ action: "create", module: "group", recordId: row.id, recordLabel: row.name, summary: `Grupo creado: ${row.name}` });
      },
      updateGroup: (id, data) =>
        dispatch({
          type: "updateGroup",
          id,
          patch: {
            ...(data.name !== undefined ? { name: data.name.trim() } : {}),
            ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
          },
        }),
      deleteGroup: (id) => dispatch({ type: "deleteGroup", id }),
      toggleGroupPermission: (groupId, permission) => dispatch({ type: "toggleGroupPermission", groupId, permission }),
      toggleGroupMember: (groupId, userId) => dispatch({ type: "toggleGroupMember", groupId, userId }),

      createRecord: (data) => {
        const code = data.code.trim();
        const name = data.name.trim();
        if (!code) throw new Error("El código es obligatorio.");
        if (!name) throw new Error("El nombre es obligatorio.");
        if (state.records.some((r) => r.code.toLowerCase() === code.toLowerCase())) {
          throw new Error("Ya existe un registro con ese código.");
        }
        const process = data.processId ? state.processes.find((item) => item.id === data.processId) : null;
        if (data.processId && !process) throw new Error("El proceso seleccionado no existe.");
        const row: RecordMockRow = {
          id: id("rec"),
          code,
          name,
          processId: process?.id ?? null,
          processName: process?.name ?? null,
          recordTypeId: data.recordTypeId || null,
          retentionTimeId: data.retentionTimeId || null,
          dispositionId: data.dispositionId || null,
          archiveMethodId: data.archiveMethodId || null,
          custodianId: data.custodianId || null,
          physicalLocation: data.physicalLocation?.trim() || null,
          digitalLocation: data.digitalLocation?.trim() || null,
          observations: data.observations?.trim() || null,
          active: true,
          createdAt: new Date().toISOString(),
          lastEntryAt: null,
        };
        dispatch({ type: "addRecord", row });
        emit({ action: "create", module: "record", recordId: row.id, recordLabel: `${code} — ${name}`, summary: `Alta de registro ${code}` });
      },
      updateRecord: (id, data) => {
        const patch: Partial<RecordMockRow> = {};
        if (data.code !== undefined) patch.code = data.code.trim();
        if (data.name !== undefined) patch.name = data.name.trim();
        if (data.processId !== undefined) {
          const process = data.processId ? state.processes.find((item) => item.id === data.processId) : null;
          if (data.processId && !process) throw new Error("El proceso seleccionado no existe.");
          patch.processId = process?.id ?? null;
          patch.processName = process?.name ?? null;
        }
        if (data.recordTypeId !== undefined) patch.recordTypeId = data.recordTypeId || null;
        if (data.retentionTimeId !== undefined) patch.retentionTimeId = data.retentionTimeId || null;
        if (data.dispositionId !== undefined) patch.dispositionId = data.dispositionId || null;
        if (data.archiveMethodId !== undefined) patch.archiveMethodId = data.archiveMethodId || null;
        if (data.custodianId !== undefined) patch.custodianId = data.custodianId || null;
        if (data.physicalLocation !== undefined) patch.physicalLocation = data.physicalLocation?.trim() || null;
        if (data.digitalLocation !== undefined) patch.digitalLocation = data.digitalLocation?.trim() || null;
        if (data.observations !== undefined) patch.observations = data.observations?.trim() || null;
        dispatch({ type: "updateRecord", id, patch });
      },
      deactivateRecord: (recordId) => dispatch({ type: "deactivateRecord", id: recordId }),

      addRecordEntry: (recordId, data) => {
        const reference = data.reference.trim();
        if (!reference) throw new Error("La referencia es obligatoria.");
        const record = state.records.find((r) => r.id === recordId);
        if (!record) throw new Error("Registro no encontrado.");
        const browserUrl = data.file ? URL.createObjectURL(data.file) : data.blobUrl ?? null;
        const fileName = data.file?.name || data.fileName?.trim() || (browserUrl ? `adjunto-${reference.replace(/[^\w.-]+/g, "_")}` : null);
        dispatch({
          type: "addRecordEntry",
          row: {
            id: id("re"),
            recordId,
            reference,
            description: data.description?.trim() || null,
            fileName,
            hasFile: Boolean(browserUrl),
            blobUrl: browserUrl,
            mimeType: data.file?.type || data.mimeType || null,
            fileSize: data.file?.size ?? data.fileSize ?? null,
            enteredById: state.members.find((m) => m.isSelf)?.userId ?? null,
            enteredAt: new Date().toISOString(),
          },
        });
        emit({ action: "add_entry", module: "record_entry", recordId: recordId, recordLabel: reference, summary: `Nueva entrada en ${record.code}: ${reference}` });
      },
      getRecordEntryUrl: async (entryId) => {
        const entry = state.recordEntries.find((item) => item.id === entryId);
        if (!entry) throw new Error("Entrada no encontrada.");
        if (entry.blobUrl) return entry.blobUrl;
        if (!entry.fileName) throw new Error("Esta entrada no tiene un archivo adjunto.");
        const text = `NormaFlow demo\nReferencia: ${entry.reference}\nArchivo: ${entry.fileName}`;
        return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
      },
      deleteRecordEntry: (entryId) => {
        const entry = state.recordEntries.find((e) => e.id === entryId);
        if (entry?.blobUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(entry.blobUrl);
          } catch {
            /* ignore */
          }
        }
        dispatch({ type: "deleteRecordEntry", id: entryId });
        if (entry) emit({ action: "delete", module: "record_entry", recordId: entry.recordId, recordLabel: entry.reference, summary: `Entrada eliminada: ${entry.reference}` });
      },

      createACPM: (data) => {
        const title = data.title.trim();
        if (!title) throw new Error("El título es obligatorio.");
        const year = new Date().getFullYear();
        const existingCodes = state.acpms
          .map((a) => /^ACPM-(\d{4})-(\d+)$/.exec(a.code))
          .filter((m): m is RegExpExecArray => m != null && m[1] === String(year))
          .map((m) => parseInt(m[2], 10));
        const seq = (existingCodes.length ? Math.max(...existingCodes) : 0) + 1;
        const code = `ACPM-${year}-${String(seq).padStart(3, "0")}`;
        const now = new Date().toISOString();
        const acpmId = id("ac");
        const requestedById = state.members.find((m) => m.isSelf)?.userId ?? null;
        dispatch({
          type: "addACPM",
          row: {
            id: acpmId,
            code,
            title,
            description: data.description?.trim() || null,
            type: data.type,
            priority: data.priority,
            stage: "REQUEST",
            source: data.source?.trim() || null,
            rootCause: null,
            proposedSolution: null,
            effectivenessCheck: null,
            effectivenessAt: null,
            requestedById,
            requestApproverId: null,
            solutionApproverId: null,
            ownerId: null,
            dueDate: data.dueDate || null,
            progress: 0,
            createdAt: now,
            updatedAt: now,
          },
          history: {
            id: id("h"),
            acpmId,
            kind: "transition",
            fromStage: null,
            toStage: "REQUEST",
            message: "ACPM creada",
            actorId: requestedById,
            at: now,
          },
        });
        emit({ action: "create", module: "acpm", recordId: acpmId, recordLabel: `${code} — ${title}`, summary: `ACPM creada: ${code}`, after: { type: data.type, priority: data.priority } });
      },

      updateACPMFields: (acpmId, data) => {
        const existing = state.acpms.find((a) => a.id === acpmId);
        if (!existing) throw new Error("ACPM no encontrada.");
        const patch: Partial<ACPMRow> = {};
        if (data.title !== undefined) patch.title = data.title.trim();
        if (data.description !== undefined) patch.description = data.description?.trim() || null;
        if (data.priority !== undefined) patch.priority = data.priority;
        if (data.type !== undefined) patch.type = data.type;
        if (data.source !== undefined) patch.source = data.source?.trim() || null;
        if (data.rootCause !== undefined) patch.rootCause = data.rootCause?.trim() || null;
        if (data.proposedSolution !== undefined) patch.proposedSolution = data.proposedSolution?.trim() || null;
        if (data.effectivenessCheck !== undefined) patch.effectivenessCheck = data.effectivenessCheck?.trim() || null;
        if (data.effectivenessAt !== undefined) patch.effectivenessAt = data.effectivenessAt || null;
        if (data.ownerId !== undefined) patch.ownerId = data.ownerId || null;
        if (data.dueDate !== undefined) patch.dueDate = data.dueDate || null;
        if (data.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(data.progress)));
        dispatch({ type: "updateACPM", id: acpmId, patch });
      },

      transitionACPM: (acpmId, toStage, comment) => {
        const existing = state.acpms.find((a) => a.id === acpmId);
        if (!existing) throw new Error("ACPM no encontrada.");
        if (existing.stage === toStage) return;

        // Validation gates per stage
        if (toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL") {
          // Approving the request → record the approver as the current user
        }
        if (toStage === "SOLUTION_APPROVAL") {
          if (!existing.rootCause?.trim()) throw new Error("Documenta la causa raíz antes de enviar la solución a aprobación.");
          if (!existing.proposedSolution?.trim()) throw new Error("Documenta la solución propuesta antes de enviarla a aprobación.");
        }
        if (toStage === "VERIFICATION" && (existing.progress ?? 0) < 100) {
          // soft-warn: still allow but bump progress
        }
        if (toStage === "CLOSED" && !existing.effectivenessCheck?.trim()) {
          throw new Error("Documenta la verificación de eficacia antes de cerrar.");
        }

        const actor = state.members.find((m) => m.isSelf)?.userId ?? null;
        const patch: Partial<ACPMRow> = { stage: toStage };

        if (toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL") {
          patch.requestApproverId = actor;
        }
        if (toStage === "IMPLEMENTATION" && existing.stage === "SOLUTION_APPROVAL") {
          patch.solutionApproverId = actor;
        }
        if (toStage === "CLOSED") {
          patch.progress = 100;
          patch.effectivenessAt = patch.effectivenessAt ?? new Date().toISOString();
        }

        dispatch({
          type: "updateACPM",
          id: acpmId,
          patch,
          history: {
            id: id("h"),
            acpmId,
            kind: "transition",
            fromStage: existing.stage,
            toStage,
            message: comment?.trim() || stageTransitionMessage(toStage),
            actorId: actor,
            at: new Date().toISOString(),
          },
        });
        const action = toStage === "CLOSED" ? "close"
          : toStage === "ANALYSIS" && existing.stage === "REQUEST_APPROVAL" ? "approve"
          : toStage === "IMPLEMENTATION" && existing.stage === "SOLUTION_APPROVAL" ? "approve"
          : "transition";
        emit({
          action, module: "acpm", recordId: acpmId, recordLabel: existing.code,
          summary: `${existing.code} · ${stageTransitionMessage(toStage)}`,
          before: { stage: existing.stage }, after: { stage: toStage },
        });
      },

      rejectACPM: (acpmId, comment) => {
        const existing = state.acpms.find((a) => a.id === acpmId);
        if (!existing) throw new Error("ACPM no encontrada.");
        if (!comment.trim()) throw new Error("Indica el motivo del rechazo.");
        const back: ACPMStage = existing.stage === "REQUEST_APPROVAL" ? "REQUEST"
          : existing.stage === "SOLUTION_APPROVAL" ? "ANALYSIS"
          : existing.stage;
        if (back === existing.stage) throw new Error("Esta etapa no admite rechazo.");
        const actor = state.members.find((m) => m.isSelf)?.userId ?? null;
        dispatch({
          type: "updateACPM",
          id: acpmId,
          patch: { stage: back },
          history: {
            id: id("h"),
            acpmId,
            kind: "transition",
            fromStage: existing.stage,
            toStage: back,
            message: `Rechazado: ${comment.trim()}`,
            actorId: actor,
            at: new Date().toISOString(),
          },
        });
        emit({
          action: "reject", module: "acpm", recordId: acpmId, recordLabel: existing.code,
          summary: `${existing.code} · Rechazado en ${existing.stage}: ${comment.trim()}`,
          before: { stage: existing.stage }, after: { stage: back },
        });
      },

      commentACPM: (acpmId, message) => {
        if (!message.trim()) throw new Error("Escribe un comentario.");
        const actor = state.members.find((m) => m.isSelf)?.userId ?? null;
        dispatch({
          type: "addACPMHistory",
          row: {
            id: id("h"),
            acpmId,
            kind: "comment",
            fromStage: null,
            toStage: null,
            message: message.trim(),
            actorId: actor,
            at: new Date().toISOString(),
          },
        });
      },

      deleteACPM: (acpmId) => {
        const existing = state.acpms.find((a) => a.id === acpmId);
        dispatch({ type: "deleteACPM", id: acpmId });
        if (existing) emit({ action: "delete", module: "acpm", recordId: acpmId, recordLabel: `${existing.code} — ${existing.title}`, summary: `ACPM eliminada: ${existing.code}` });
      },
    }),
    [state, mkPosition, mkLocation, mkSimple, emit]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminMock(): AdminMockContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminMock must be used inside <AdminMockProvider>");
  return v;
}
