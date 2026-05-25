"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  loadPersistedWorkspace,
  mergePersistedWithSeed,
  savePersistedWorkspace,
} from "@/lib/workspace-persistence";
import {
  normalizeWorkspaceLinks,
  syncProcessDocCodes,
  syncChangeRequestProcessCodes,
  syncProcessChangeCodes,
  syncProcessIndicatorNames,
  syncProcessRiskCodes,
  syncProcessTrainingId,
} from "@/lib/workspace-sync";
import {
  DEMO_ACTIONS,
  DEMO_ACTIVITY,
  DEMO_AUDITS,
  DEMO_EVIDENCE,
  DEMO_INDICATORS,
  DEMO_NONCONFORMITIES,
} from "@/lib/demo-data";
import { DEMO_ORGANIZATIONS, getDemoOrg } from "@/lib/demo/organizations";
import type { AuditEventRow } from "@/lib/domain/audit-event";
import {
  type AuditProgramSummary,
  type ChangeRequestRow,
  type DemoPerson,
  type IntegrationInstanceRow,
  type IntegrationKey,
  type OnboardingChecklistRow,
  type SupplierRow,
  type TeamRow,
  type TrainingAssignmentRow,
  type TrainingCourseRow,
  buildAuditProgram,
  buildChangeRequests,
  buildDemoPeople,
  buildInitialAuditLog,
  buildIntegrations,
  buildOnboardingChecklist,
  buildSuppliers,
  buildTeams,
  buildTrainingAssignments,
  buildTrainingCourses,
  enrichDocumentsEnterprise,
  enrichEvidenceEnterprise,
} from "@/lib/demo/enterprise-seed";
import {
  type GapClauseState,
  type NotificationItem,
  type SiteRow,
  activityForOrg,
  buildGapState,
  buildNotifications,
  buildSites,
  documentsWithMeta,
  indicatorsForOrg,
  processesWithLinks,
  recomputeGapClause,
  risksForOrg,
} from "@/lib/demo/seed-entities";

export type RiskRow = ReturnType<typeof risksForOrg>[number];
export type IndicatorRow = ReturnType<typeof indicatorsForOrg>[number] & {
  owner?: string;
  objective?: string;
  nextReviewDue?: string;
  managementComment?: string;
  /** % de la meta por debajo del cual dispara alerta en revisión de dirección */
  alertThresholdPct?: number;
};
export type AuditRow = (typeof DEMO_AUDITS)[number];
export type NcRow = {
  id: string;
  code: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  owner: string;
  due: string;
  rootCause: string;
  correction: string;
  correctiveAction: string;
  auditId?: string;
  auditTitle?: string;
  clause?: string;
  preventiveAction?: string;
  effectivenessCheck?: string;
};
export type ActionRow = (typeof DEMO_ACTIONS)[number];
export type DocumentRow = ReturnType<typeof documentsWithMeta>[number] & {
  previewUrl?: string;
  reviewDue?: string;
  reviewCycleMonths?: number;
  reviewers?: string[];
  approvers?: string[];
  trainingImpact?: boolean;
  linkedChangeIds?: string[];
  lastAcknowledgedAt?: string;
};
export type ProcessRow = ReturnType<typeof processesWithLinks>[number];

export type {
  AuditEventRow,
  TrainingCourseRow,
  TrainingAssignmentRow,
  ChangeRequestRow,
  SupplierRow,
  IntegrationInstanceRow,
  OnboardingChecklistRow,
  AuditProgramSummary,
  DemoPerson,
  TeamRow,
  IntegrationKey,
};

export type ChecklistItem = { id: string; clause: string; requirement: string; done: boolean; notes?: string };

export type EvidenceItem = {
  id: string;
  title: string;
  module: string | null;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  blobUrl?: string;
  origin?: "MANUAL" | "AUTOMATED" | "INTEGRATION";
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  framework?: string | null;
};

export type DocVersion = {
  version: string;
  date: string;
  author: string;
  note: string;
  /** Archivo archivado de esta revisión (URL absoluta o blob en demo). */
  fileUrl?: string;
  /** Nombre sugerido al descargar (p. ej. SGC-MAN-001-v3.1.pdf). */
  fileName?: string;
};

export type InvoiceRow = { id: string; period: string; amount: string; paid: boolean; pdfUrl?: string };

export type ActivityFeedRow = (typeof DEMO_ACTIVITY)[number];

type PlanKey = "STARTER" | "GROWTH" | "ENTERPRISE";

export type SessionProfile = {
  name: string;
  email: string;
  orgName: string;
  roleLabel: string;
  roleKey: string;
  activeOrgId: string;
  workspaceKind?: "demo" | "blank";
  plan?: string;
};

export type WorkspaceState = {
  risks: RiskRow[];
  indicators: IndicatorRow[];
  audits: AuditRow[];
  auditChecklists: Record<string, ChecklistItem[]>;
  nonconformities: NcRow[];
  actions: ActionRow[];
  documents: DocumentRow[];
  documentVersions: Record<string, DocVersion[]>;
  evidence: EvidenceItem[];
  processes: ProcessRow[];
  billing: {
    plan: PlanKey;
    nextBilling: string;
    invoices: InvoiceRow[];
    trialEnds?: string;
    trialActive?: boolean;
  };
  session: SessionProfile;
  toast: string | null;
  notifications: NotificationItem[];
  gapIso9001: GapClauseState[];
  gapIso27001: GapClauseState[];
  sites: SiteRow[];
  activityFeed: ActivityFeedRow[];
  demoOrganizations: typeof DEMO_ORGANIZATIONS;
  auditEvents: AuditEventRow[];
  trainingCourses: TrainingCourseRow[];
  trainingAssignments: TrainingAssignmentRow[];
  changeRequests: ChangeRequestRow[];
  suppliers: SupplierRow[];
  integrations: IntegrationInstanceRow[];
  onboardingChecklist: OnboardingChecklistRow[];
  auditProgram: AuditProgramSummary;
  demoPeople: DemoPerson[];
  teams: TeamRow[];
};

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function nextSequentialCode(prefix: string, rows: { code: string }[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const r of rows) {
    const m = re.exec(r.code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function nextChangeRequestCode(rows: ChangeRequestRow[]): string {
  let max = 0;
  for (const r of rows) {
    const m = /^CR-(\d+)$/.exec(r.code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CR-${String(max + 1).padStart(3, "0")}`;
}

function defaultChecklistForAudit(auditId: string, standard: string): ChecklistItem[] {
  const base = [
    { clause: "4", requirement: "Contexto de la organización comprendido y documentado" },
    { clause: "5", requirement: "Liderazgo y compromiso de la dirección verificables" },
    { clause: "6", requirement: "Planificación de acciones para riesgos y oportunidades" },
    { clause: "7", requirement: "Recursos, competencia y comunicación adecuados" },
    { clause: "8", requirement: "Operación y control de procesos conforme a lo planificado" },
    { clause: "9", requirement: "Seguimiento, medición y evaluación del desempeño" },
    { clause: "10", requirement: "Mejora continua y no conformidades tratadas" },
  ];
  return base.map((b, i) => ({
    id: `${auditId}-chk-${i}`,
    clause: b.clause,
    requirement: `${b.requirement}${standard.includes("27001") ? " (SGSI)" : ""}`,
    done: auditId === "a1" ? i < 5 : auditId === "a2" ? i < 3 : false,
    notes: "",
  }));
}

function syncAuditFindingCounts(audits: AuditRow[], nonconformities: NcRow[]): AuditRow[] {
  return audits.map(audit => {
    const linked = nonconformities.filter(n => n.auditId === audit.id);
    return {
      ...audit,
      findings: linked.length,
      criticals: linked.filter(n => n.severity === "CRITICAL").length,
    };
  });
}

function resolveSeedOrgId(activeOrgId: string): string {
  if (DEMO_ORGANIZATIONS.some(o => o.id === activeOrgId)) return activeOrgId;
  return "org_tecnoserv";
}

function normalizePlan(plan: string | undefined): PlanKey {
  const key = plan?.trim().toUpperCase();
  if (key === "STARTER") return "STARTER";
  if (key === "ENTERPRISE") return "ENTERPRISE";
  return "GROWTH";
}

function createBlankWorkspaceState(session: SessionProfile): WorkspaceState {
  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const plan = normalizePlan(session.plan);
  const sessionResolved: SessionProfile = { ...session, workspaceKind: "blank" };
  const integrations = buildIntegrations().map(i => ({
    ...i,
    status: "NOT_CONNECTED" as const,
    lastSyncAt: undefined,
    detailNote: undefined,
  }));

  return {
    risks: [],
    indicators: [],
    audits: [],
    auditChecklists: {},
    nonconformities: [],
    actions: [],
    documents: [],
    documentVersions: {},
    evidence: [],
    processes: [],
    billing: {
      plan,
      nextBilling: nextBilling.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
      invoices: [],
      trialActive: false,
    },
    session: sessionResolved,
    toast: null,
    notifications: [],
    gapIso9001: buildGapState("iso9001", { preset: false }),
    gapIso27001: buildGapState("iso27001", { preset: false }),
    sites: [],
    activityFeed: [],
    demoOrganizations: DEMO_ORGANIZATIONS,
    auditEvents: [],
    trainingCourses: [],
    trainingAssignments: [],
    changeRequests: [],
    suppliers: [],
    integrations,
    onboardingChecklist: buildOnboardingChecklist(),
    auditProgram: {
      programYear: now.getFullYear(),
      programOwner: session.name,
      nextManagementReview: "Sin programar",
      objectives: "Define el programa anual de auditorías cuando completes el alcance y los procesos.",
    },
    demoPeople: [],
    teams: [],
  };
}

export function createWorkspaceState(session: SessionProfile): WorkspaceState {
  if (session.workspaceKind === "blank") return createBlankWorkspaceState(session);

  const orgId = resolveSeedOrgId(session.activeOrgId);
  const org = getDemoOrg(orgId) ?? DEMO_ORGANIZATIONS[0];
  const demoTenant = DEMO_ORGANIZATIONS.some(o => o.id === session.activeOrgId);
  const sessionResolved: SessionProfile = demoTenant
    ? { ...session, orgName: org.name, activeOrgId: org.id }
    : { ...session };
  const docsRaw = documentsWithMeta(orgId);
  const docsEnriched = enrichDocumentsEnterprise(docsRaw, orgId);
  const docs: DocumentRow[] = docsEnriched.map(d => ({
    ...d,
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  }));
  const versions: Record<string, DocVersion[]> = {};
  docs.forEach(d => {
    const fileUrl = d.previewUrl;
    const cur = parseFloat(String(d.version)) || 1;
    const prevNum = Math.max(1, Math.round((cur - 0.1) * 10) / 10);
    const prevStr = prevNum % 1 === 0 ? String(prevNum) : prevNum.toFixed(1);
    versions[d.id] = [
      {
        version: d.version,
        date: d.updated,
        author: d.owner,
        note: "Versión vigente",
        fileUrl,
        fileName: `${d.code}-v${d.version}.pdf`,
      },
      {
        version: prevStr,
        date: "2024-11-01",
        author: d.owner,
        note: "Revisión intermedia",
        fileUrl,
        fileName: `${d.code}-v${prevStr}.pdf`,
      },
    ];
  });

  const evidenceSeeds: EvidenceItem[] = enrichEvidenceEnterprise(
    [
      {
        id: `${orgId}-e1`,
        title: DEMO_EVIDENCE[0]?.title ?? "Evidencia 1",
        module: DEMO_EVIDENCE[0]?.module ?? "audit",
        fileUrl:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
        mimeType: "image/png",
        fileSize: 45000,
        createdAt: `${DEMO_EVIDENCE[0]?.date ?? "2025-05-22"}T12:00:00.000Z`,
      },
      {
        id: `${orgId}-e2`,
        title: DEMO_EVIDENCE[1]?.title ?? "Evidencia PDF",
        module: DEMO_EVIDENCE[1]?.module ?? "risk",
        fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        mimeType: "application/pdf",
        fileSize: 13264,
        createdAt: `${DEMO_EVIDENCE[1]?.date ?? "2025-06-01"}T12:00:00.000Z`,
      },
      {
        id: `${orgId}-e3`,
        title: DEMO_EVIDENCE[2]?.title ?? "Evidencia Office",
        module: DEMO_EVIDENCE[2]?.module ?? "document",
        fileUrl: "https://example.com/documento-ejemplo.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 184320,
        createdAt: `${DEMO_EVIDENCE[2]?.date ?? "2025-06-10"}T12:00:00.000Z`,
      },
    ],
    orgId
  );

  const ncs: NcRow[] = deepClone(DEMO_NONCONFORMITIES).map((n, i) => ({
    ...n,
    preventiveAction: i === 0 ? "Revisión trimestral automatizada del calendario documental" : undefined,
    effectivenessCheck: n.status === "CLOSED" ? "Verificado en seguimiento Q1 — eficaz" : undefined,
  }));

  const audits = syncAuditFindingCounts(deepClone(DEMO_AUDITS), ncs);
  const checklists: Record<string, ChecklistItem[]> = {};
  audits.forEach(a => {
    checklists[a.id] = defaultChecklistForAudit(a.id, a.standard);
  });

  const invoices: InvoiceRow[] = [
    { id: "inv-1", period: "Jun 2026", amount: "€299", paid: true },
    { id: "inv-2", period: "May 2026", amount: "€299", paid: true },
    { id: "inv-3", period: "Apr 2026", amount: "€299", paid: true },
    { id: "inv-4", period: "Mar 2026", amount: "€299", paid: true },
    { id: "inv-5", period: "Feb 2026", amount: "€299", paid: true },
    { id: "inv-6", period: "Jan 2026", amount: "€299", paid: true },
  ];

  const demoPeople = buildDemoPeople(orgId, org);
  const teams = buildTeams(orgId, org);
  const trainingCourses = buildTrainingCourses();
  const trainingAssignments = buildTrainingAssignments(orgId, demoPeople);
  const changeRequests = buildChangeRequests(orgId);
  const suppliers = buildSuppliers(orgId);
  const integrations = buildIntegrations();
  const onboardingChecklist = buildOnboardingChecklist();
  const auditProgram = buildAuditProgram(org);
  const auditEvents = buildInitialAuditLog(sessionResolved, org);

  const indicatorOwners = ["Carlos Méndez", "Ana García", "Pedro Ruiz", "Laura Vega", "Carlos Méndez", "Laura Vega"];
  const indicatorsEnriched: IndicatorRow[] = indicatorsForOrg(orgId).map((ind, i) => {
    const due = new Date();
    due.setDate(due.getDate() + 18 + i * 7);
    return {
      ...ind,
      owner: indicatorOwners[i % indicatorOwners.length],
      objective: `Mantener "${ind.name}" alineado con cláusula ${ind.clause} y entradas de revisión por la dirección.`,
      nextReviewDue: due.toISOString().slice(0, 10),
      managementComment:
        i === 0
          ? "Comité Q2: acción comercial con proveedor clave para recuperar NPS."
          : i === 3
            ? "Operaciones: plantear umbral de escalado si supera 4h en dos semanas consecutivas."
            : "",
      alertThresholdPct: 90,
    };
  });

  const linked = normalizeWorkspaceLinks({
    risks: risksForOrg(orgId),
    indicators: indicatorsEnriched,
    documents: docs,
    processes: processesWithLinks(orgId),
    changeRequests,
    trainingAssignments,
  });

  return {
    risks: linked.risks,
    indicators: linked.indicators,
    audits,
    auditChecklists: checklists,
    nonconformities: ncs,
    actions: deepClone(DEMO_ACTIONS),
    documents: linked.documents,
    documentVersions: versions,
    evidence: evidenceSeeds as EvidenceItem[],
    processes: linked.processes,
    billing: {
      plan: org.plan === "Starter" ? "STARTER" : "GROWTH",
      nextBilling: "15 Jul 2026",
      invoices,
      trialEnds: "12 May 2026",
      trialActive: org.plan === "Starter",
    },
    session: sessionResolved,
    toast: null,
    notifications: buildNotifications(org),
    gapIso9001: buildGapState("iso9001"),
    gapIso27001: buildGapState("iso27001"),
    sites: buildSites(org),
    activityFeed: activityForOrg(org),
    demoOrganizations: DEMO_ORGANIZATIONS,
    auditEvents,
    trainingCourses,
    trainingAssignments: linked.trainingAssignments,
    changeRequests: linked.changeRequests,
    suppliers,
    integrations,
    onboardingChecklist,
    auditProgram,
    demoPeople,
    teams,
  };
}

type Action =
  | { type: "toast"; message: string | null }
  | { type: "addRisk"; risk: RiskRow }
  | { type: "updateRisk"; id: string; patch: Partial<RiskRow> }
  | { type: "addIndicator"; ind: IndicatorRow }
  | { type: "updateIndicator"; id: string; patch: Partial<IndicatorRow> }
  | { type: "addAudit"; audit: AuditRow }
  | { type: "updateAudit"; id: string; patch: Partial<AuditRow> }
  | { type: "toggleChecklist"; auditId: string; itemId: string; done: boolean }
  | { type: "addNc"; nc: NcRow }
  | { type: "updateNc"; id: string; patch: Partial<NcRow> }
  | { type: "addAction"; action: ActionRow }
  | { type: "updateAction"; id: string; patch: Partial<ActionRow> }
  | { type: "addDocument"; doc: DocumentRow }
  | { type: "updateDocument"; id: string; patch: Partial<DocumentRow> }
  | { type: "addDocVersion"; docId: string; v: DocVersion }
  | { type: "addEvidence"; ev: EvidenceItem }
  | { type: "setBillingPlan"; plan: PlanKey }
  | { type: "updateSession"; patch: Partial<SessionProfile> }
  | { type: "addProcess"; p: ProcessRow }
  | { type: "switchDemoOrg"; orgId: string }
  | { type: "markNotificationRead"; id: string }
  | { type: "markAllNotificationsRead" }
  | { type: "updateGapQuestion"; standard: "iso9001" | "iso27001"; clause: string; questionId: string; answer: "YES" | "NO" | "NA" }
  | { type: "updateGapComment"; standard: "iso9001" | "iso27001"; clause: string; comment: string }
  | { type: "appendAudit"; event: AuditEventRow }
  | { type: "addTrainingAssignment"; row: TrainingAssignmentRow }
  | { type: "updateTrainingAssignment"; id: string; patch: Partial<TrainingAssignmentRow> }
  | { type: "addChangeRequest"; row: ChangeRequestRow }
  | { type: "updateChangeRequest"; id: string; patch: Partial<ChangeRequestRow> }
  | { type: "updateSupplier"; id: string; patch: Partial<SupplierRow> }
  | { type: "updateIntegration"; key: IntegrationKey; patch: Partial<IntegrationInstanceRow> }
  | { type: "toggleOnboarding"; id: string; done?: boolean }
  | { type: "replaceWorkspace"; state: WorkspaceState };

function patchGapList(list: GapClauseState[], a: Extract<Action, { type: "updateGapQuestion" }>): GapClauseState[] {
  return list.map(row => {
    if (row.clause !== a.clause) return row;
    const questionsDetail = row.questionsDetail.map(q => (q.id === a.questionId ? { ...q, answer: a.answer } : q));
    return recomputeGapClause({ ...row, questionsDetail });
  });
}

function patchGapComment(list: GapClauseState[], a: Extract<Action, { type: "updateGapComment" }>): GapClauseState[] {
  return list.map(row => (row.clause === a.clause ? { ...row, comment: a.comment } : row));
}

function reducer(state: WorkspaceState, a: Action): WorkspaceState {
  switch (a.type) {
    case "toast":
      return { ...state, toast: a.message };
    case "addRisk": {
      const risks = [a.risk, ...state.risks];
      const processes = a.risk.linkedProcessCode
        ? syncProcessRiskCodes(state.processes, a.risk.code, a.risk.linkedProcessCode)
        : state.processes;
      return { ...state, risks, processes };
    }
    case "updateRisk": {
      const prev = state.risks.find(r => r.id === a.id);
      const risks = state.risks.map(r => {
        if (r.id !== a.id) return r;
        const next = { ...r, ...a.patch };
        next.score = next.probability * next.impact;
        return next;
      });
      const nextRisk = risks.find(r => r.id === a.id);
      const processes =
        prev && nextRisk && a.patch.linkedProcessCode !== undefined
          ? syncProcessRiskCodes(state.processes, prev.code, nextRisk.linkedProcessCode ?? "", prev.linkedProcessCode)
          : state.processes;
      return { ...state, risks, processes };
    }
    case "addIndicator": {
      const indicators = [...state.indicators, a.ind];
      const processes = a.ind.linkedProcessCode
        ? syncProcessIndicatorNames(state.processes, a.ind.name, a.ind.linkedProcessCode)
        : state.processes;
      return { ...state, indicators, processes };
    }
    case "updateIndicator": {
      const prev = state.indicators.find(i => i.id === a.id);
      const indicators = state.indicators.map(i => (i.id === a.id ? { ...i, ...a.patch } : i));
      const nextInd = indicators.find(i => i.id === a.id);
      const processes =
        prev && nextInd && a.patch.linkedProcessCode !== undefined
          ? syncProcessIndicatorNames(
              state.processes,
              prev.name,
              nextInd.linkedProcessCode ?? "",
              prev.linkedProcessCode,
            )
          : state.processes;
      return { ...state, indicators, processes };
    }
    case "addAudit":
      return {
        ...state,
        audits: [a.audit, ...state.audits],
        auditChecklists: {
          ...state.auditChecklists,
          [a.audit.id]: defaultChecklistForAudit(a.audit.id, a.audit.standard),
        },
      };
    case "updateAudit":
      return { ...state, audits: state.audits.map(x => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case "toggleChecklist":
      return {
        ...state,
        auditChecklists: {
          ...state.auditChecklists,
          [a.auditId]: (state.auditChecklists[a.auditId] ?? []).map(it =>
            it.id === a.itemId ? { ...it, done: a.done } : it
          ),
        },
      };
    case "addNc":
      {
        const nonconformities = [a.nc, ...state.nonconformities];
        return { ...state, nonconformities, audits: syncAuditFindingCounts(state.audits, nonconformities) };
      }
    case "updateNc":
      {
        const nonconformities = state.nonconformities.map(n => (n.id === a.id ? { ...n, ...a.patch } : n));
        return {
          ...state,
          nonconformities,
          audits: syncAuditFindingCounts(state.audits, nonconformities),
        };
      }
    case "addAction":
      return { ...state, actions: [a.action, ...state.actions] };
    case "updateAction":
      return { ...state, actions: state.actions.map(x => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case "addDocument": {
      const processes = a.doc.linkedProcessCode
        ? syncProcessDocCodes(state.processes, a.doc.code, a.doc.linkedProcessCode)
        : state.processes;
      return {
        ...state,
        documents: [a.doc, ...state.documents],
        processes,
        documentVersions: {
          ...state.documentVersions,
          [a.doc.id]: [
            {
              version: a.doc.version,
              date: a.doc.updated,
              author: a.doc.owner,
              note: "Versión inicial",
              fileUrl: a.doc.previewUrl,
              fileName: `${a.doc.code}-v${a.doc.version}.pdf`,
            },
          ],
        },
      };
    }
    case "updateDocument": {
      const prev = state.documents.find(d => d.id === a.id);
      const documents = state.documents.map(d => (d.id === a.id ? { ...d, ...a.patch } : d));
      const nextDoc = documents.find(d => d.id === a.id);
      const processes =
        prev && nextDoc && a.patch.linkedProcessCode !== undefined
          ? syncProcessDocCodes(state.processes, prev.code, nextDoc.linkedProcessCode ?? "", prev.linkedProcessCode)
          : state.processes;
      return { ...state, documents, processes };
    }
    case "addDocVersion":
      return {
        ...state,
        documentVersions: {
          ...state.documentVersions,
          [a.docId]: [a.v, ...(state.documentVersions[a.docId] ?? [])],
        },
        documents: state.documents.map(d =>
          d.id === a.docId ? { ...d, version: a.v.version, updated: a.v.date.split("T")[0] ?? a.v.date } : d
        ),
      };
    case "addEvidence":
      return { ...state, evidence: [a.ev, ...state.evidence] };
    case "setBillingPlan":
      return { ...state, billing: { ...state.billing, plan: a.plan, trialActive: false } };
    case "updateSession":
      return { ...state, session: { ...state.session, ...a.patch } };
    case "addProcess":
      return { ...state, processes: [...state.processes, a.p] };
    case "switchDemoOrg": {
      const org = getDemoOrg(a.orgId);
      if (!org) return state;
      const nextSession: SessionProfile = {
        ...state.session,
        activeOrgId: org.id,
        orgName: org.name,
      };
      const profile: SessionProfile = {
        ...nextSession,
        roleKey: state.session.roleKey,
        roleLabel: state.session.roleLabel,
      };
      const seeded = createWorkspaceState(profile);
      if (typeof window === "undefined") return seeded;
      const persisted = loadPersistedWorkspace(profile);
      return persisted ? mergeHydratedState(seeded, persisted, profile) : seeded;
    }
    case "markNotificationRead":
      return {
        ...state,
        notifications: state.notifications.map(n => (n.id === a.id ? { ...n, read: true } : n)),
      };
    case "markAllNotificationsRead":
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case "updateGapQuestion":
      return a.standard === "iso9001"
        ? { ...state, gapIso9001: patchGapList(state.gapIso9001, a) }
        : { ...state, gapIso27001: patchGapList(state.gapIso27001, a) };
    case "updateGapComment":
      return a.standard === "iso9001"
        ? { ...state, gapIso9001: patchGapComment(state.gapIso9001, a) }
        : { ...state, gapIso27001: patchGapComment(state.gapIso27001, a) };
    case "appendAudit":
      return { ...state, auditEvents: [a.event, ...state.auditEvents] };
    case "addTrainingAssignment": {
      const trainingAssignments = [a.row, ...state.trainingAssignments];
      const processes = a.row.processCode
        ? syncProcessTrainingId(state.processes, a.row.id, a.row.processCode)
        : state.processes;
      return { ...state, trainingAssignments, processes };
    }
    case "updateTrainingAssignment": {
      const prev = state.trainingAssignments.find(t => t.id === a.id);
      const trainingAssignments = state.trainingAssignments.map(t => (t.id === a.id ? { ...t, ...a.patch } : t));
      const next = trainingAssignments.find(t => t.id === a.id);
      const processes =
        prev && next && a.patch.processCode !== undefined
          ? syncProcessTrainingId(state.processes, a.id, next.processCode ?? "", prev.processCode)
          : state.processes;
      return { ...state, trainingAssignments, processes };
    }
    case "addChangeRequest": {
      const changeRequests = [a.row, ...state.changeRequests];
      let processes = state.processes;
      for (const code of a.row.processCodes ?? []) {
        processes = syncProcessChangeCodes(processes, a.row.code, code);
      }
      return { ...state, changeRequests, processes };
    }
    case "updateChangeRequest": {
      const prev = state.changeRequests.find(c => c.id === a.id);
      const changeRequests = state.changeRequests.map(c =>
        c.id === a.id ? { ...c, ...a.patch, updatedAt: new Date().toISOString().slice(0, 10) } : c
      );
      const next = changeRequests.find(c => c.id === a.id);
      const processes =
        prev && next && a.patch.processCodes
          ? syncChangeRequestProcessCodes(state.processes, prev.code, next.processCodes, prev.processCodes)
          : state.processes;
      return { ...state, changeRequests, processes };
    }
    case "updateSupplier":
      return {
        ...state,
        suppliers: state.suppliers.map(s => (s.id === a.id ? { ...s, ...a.patch } : s)),
      };
    case "updateIntegration":
      return {
        ...state,
        integrations: state.integrations.map(i => (i.key === a.key ? { ...i, ...a.patch } : i)),
      };
    case "toggleOnboarding":
      return {
        ...state,
        onboardingChecklist: state.onboardingChecklist.map(o =>
          o.id === a.id ? { ...o, done: a.done ?? !o.done } : o
        ),
      };
    case "replaceWorkspace":
      return a.state;
    default:
      return state;
  }
}

type Ctx = {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  nextRiskCode: () => string;
  nextNcCode: () => string;
  nextActionCode: () => string;
  nextChangeCode: () => string;
  showToast: (m: string) => void;
  switchDemoOrg: (orgId: string) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

function mergeHydratedState(seeded: WorkspaceState, persisted: WorkspaceState, profile: SessionProfile): WorkspaceState {
  const merged = mergePersistedWithSeed(seeded, persisted, profile);
  const linked = normalizeWorkspaceLinks({
    documents: merged.documents,
    risks: merged.risks,
    indicators: merged.indicators,
    processes: merged.processes,
    changeRequests: merged.changeRequests,
    trainingAssignments: merged.trainingAssignments,
  });
  return { ...merged, ...linked };
}

export function WorkspaceProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: SessionProfile;
}) {
  const seeded = useMemo(() => createWorkspaceState(profile), [profile]);
  const [state, dispatch] = useReducer(reducer, seeded);
  const persistReady = useRef(false);

  useEffect(() => {
    const persisted = loadPersistedWorkspace(profile);
    if (persisted) {
      dispatch({ type: "replaceWorkspace", state: mergeHydratedState(seeded, persisted, profile) });
    }
    persistReady.current = true;
  }, [profile, seeded]);

  useEffect(() => {
    if (!persistReady.current) return;
    const t = window.setTimeout(() => savePersistedWorkspace(profile, state), 350);
    return () => window.clearTimeout(t);
  }, [state, profile]);

  const nextRiskCode = useCallback(() => nextSequentialCode("R", state.risks), [state.risks]);
  const nextNcCode = useCallback(() => nextSequentialCode("NC", state.nonconformities), [state.nonconformities]);
  const nextActionCode = useCallback(() => nextSequentialCode("AC", state.actions), [state.actions]);
  const nextChangeCode = useCallback(() => nextChangeRequestCode(state.changeRequests), [state.changeRequests]);

  const showToast = useCallback((message: string) => {
    dispatch({ type: "toast", message });
    setTimeout(() => dispatch({ type: "toast", message: null }), 3200);
  }, []);

  const switchDemoOrg = useCallback((orgId: string) => {
    dispatch({ type: "switchDemoOrg", orgId });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, nextRiskCode, nextNcCode, nextActionCode, nextChangeCode, showToast, switchDemoOrg }),
    [state, dispatch, nextRiskCode, nextNcCode, nextActionCode, nextChangeCode, showToast, switchDemoOrg]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const x = useContext(WorkspaceContext);
  if (!x) throw new Error("useWorkspace outside WorkspaceProvider");
  return x;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
