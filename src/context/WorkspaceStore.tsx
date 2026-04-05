"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
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
  type AuditFindingRow,
  type GapClauseState,
  type NotificationItem,
  type SiteRow,
  activityForOrg,
  buildAuditFindings,
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
export type NcRow = (typeof DEMO_NONCONFORMITIES)[number] & {
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

export type DocVersion = { version: string; date: string; author: string; note: string };

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
};

export type WorkspaceState = {
  risks: RiskRow[];
  indicators: IndicatorRow[];
  audits: AuditRow[];
  auditChecklists: Record<string, ChecklistItem[]>;
  auditFindings: AuditFindingRow[];
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

function resolveSeedOrgId(activeOrgId: string): string {
  if (DEMO_ORGANIZATIONS.some(o => o.id === activeOrgId)) return activeOrgId;
  return "org_tecnoserv";
}

export function createWorkspaceState(session: SessionProfile): WorkspaceState {
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
    versions[d.id] = [
      { version: d.version, date: d.updated, author: d.owner, note: "Versión vigente" },
      {
        version: String(Math.max(1, parseFloat(String(d.version)) - 0.1)),
        date: "2024-11-01",
        author: d.owner,
        note: "Revisión intermedia",
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

  const audits = deepClone(DEMO_AUDITS);
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

  const ncs: NcRow[] = deepClone(DEMO_NONCONFORMITIES).map((n, i) => ({
    ...n,
    preventiveAction: i === 0 ? "Revisión trimestral automatizada del calendario documental" : undefined,
    effectivenessCheck: n.status === "CLOSED" ? "Verificado en seguimiento Q1 — eficaz" : undefined,
  }));

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

  return {
    risks: risksForOrg(orgId),
    indicators: indicatorsEnriched,
    audits,
    auditChecklists: checklists,
    auditFindings: buildAuditFindings(),
    nonconformities: ncs,
    actions: deepClone(DEMO_ACTIONS),
    documents: docs,
    documentVersions: versions,
    evidence: evidenceSeeds as EvidenceItem[],
    processes: processesWithLinks(orgId),
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
    trainingAssignments,
    changeRequests,
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
  | { type: "addAuditFinding"; finding: AuditFindingRow }
  | { type: "appendAudit"; event: AuditEventRow }
  | { type: "addTrainingAssignment"; row: TrainingAssignmentRow }
  | { type: "updateTrainingAssignment"; id: string; patch: Partial<TrainingAssignmentRow> }
  | { type: "addChangeRequest"; row: ChangeRequestRow }
  | { type: "updateChangeRequest"; id: string; patch: Partial<ChangeRequestRow> }
  | { type: "updateSupplier"; id: string; patch: Partial<SupplierRow> }
  | { type: "updateIntegration"; key: IntegrationKey; patch: Partial<IntegrationInstanceRow> }
  | { type: "toggleOnboarding"; id: string; done?: boolean };

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
    case "addRisk":
      return { ...state, risks: [a.risk, ...state.risks] };
    case "updateRisk":
      return {
        ...state,
        risks: state.risks.map(r => {
          if (r.id !== a.id) return r;
          const next = { ...r, ...a.patch };
          next.score = next.probability * next.impact;
          return next;
        }),
      };
    case "addIndicator":
      return { ...state, indicators: [...state.indicators, a.ind] };
    case "updateIndicator":
      return { ...state, indicators: state.indicators.map(i => (i.id === a.id ? { ...i, ...a.patch } : i)) };
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
      return { ...state, nonconformities: [a.nc, ...state.nonconformities] };
    case "updateNc":
      return {
        ...state,
        nonconformities: state.nonconformities.map(n => (n.id === a.id ? { ...n, ...a.patch } : n)),
      };
    case "addAction":
      return { ...state, actions: [a.action, ...state.actions] };
    case "updateAction":
      return { ...state, actions: state.actions.map(x => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case "addDocument":
      return {
        ...state,
        documents: [a.doc, ...state.documents],
        documentVersions: {
          ...state.documentVersions,
          [a.doc.id]: [{ version: a.doc.version, date: a.doc.updated, author: a.doc.owner, note: "Versión inicial" }],
        },
      };
    case "updateDocument":
      return {
        ...state,
        documents: state.documents.map(d => (d.id === a.id ? { ...d, ...a.patch } : d)),
      };
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
      return { ...createWorkspaceState(nextSession), session: { ...nextSession, roleKey: state.session.roleKey, roleLabel: state.session.roleLabel } };
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
    case "addAuditFinding":
      return { ...state, auditFindings: [a.finding, ...state.auditFindings] };
    case "appendAudit":
      return { ...state, auditEvents: [a.event, ...state.auditEvents] };
    case "addTrainingAssignment":
      return { ...state, trainingAssignments: [a.row, ...state.trainingAssignments] };
    case "updateTrainingAssignment":
      return {
        ...state,
        trainingAssignments: state.trainingAssignments.map(t => (t.id === a.id ? { ...t, ...a.patch } : t)),
      };
    case "addChangeRequest":
      return { ...state, changeRequests: [a.row, ...state.changeRequests] };
    case "updateChangeRequest":
      return {
        ...state,
        changeRequests: state.changeRequests.map(c =>
          c.id === a.id ? { ...c, ...a.patch, updatedAt: new Date().toISOString().slice(0, 10) } : c
        ),
      };
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

export function WorkspaceProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: SessionProfile;
}) {
  const initial = useMemo(() => createWorkspaceState(profile), [profile]);
  const [state, dispatch] = useReducer(reducer, initial);

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
