"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import {
  DEMO_ACTIONS,
  DEMO_AUDITS,
  DEMO_DOCUMENTS,
  DEMO_EVIDENCE,
  DEMO_INDICATORS,
  DEMO_NONCONFORMITIES,
  DEMO_PROCESSES,
  DEMO_RISKS,
} from "@/lib/demo-data";

export type RiskRow = (typeof DEMO_RISKS)[number];
export type IndicatorRow = (typeof DEMO_INDICATORS)[number];
export type AuditRow = (typeof DEMO_AUDITS)[number];
export type NcRow = (typeof DEMO_NONCONFORMITIES)[number];
export type ActionRow = (typeof DEMO_ACTIONS)[number];
export type DocumentRow = (typeof DEMO_DOCUMENTS)[number] & { previewUrl?: string };
export type ProcessRow = (typeof DEMO_PROCESSES)[number];

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
};

export type DocVersion = { version: string; date: string; author: string; note: string };

export type InvoiceRow = { id: string; period: string; amount: string; paid: boolean; pdfUrl?: string };

type PlanKey = "STARTER" | "GROWTH" | "ENTERPRISE";

export type SessionProfile = {
  name: string;
  email: string;
  orgName: string;
  roleLabel: string;
};

type WorkspaceState = {
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
  billing: { plan: PlanKey; nextBilling: string; invoices: InvoiceRow[] };
  session: SessionProfile;
  toast: string | null;
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

function buildInitialState(session: SessionProfile): WorkspaceState {
  const docs: DocumentRow[] = deepClone(DEMO_DOCUMENTS).map(d => ({
    ...d,
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  }));
  const versions: Record<string, DocVersion[]> = {};
  docs.forEach(d => {
    versions[d.id] = [
      { version: d.version, date: d.updated, author: d.owner, note: "Versión vigente" },
      {
        version: String(Math.max(1, parseFloat(d.version) - 0.1)),
        date: "2024-11-01",
        author: d.owner,
        note: "Revisión intermedia",
      },
    ];
  });

  const evidenceSeeds: EvidenceItem[] = [
    {
      id: "e1",
      title: DEMO_EVIDENCE[0]?.title ?? "Evidencia 1",
      module: DEMO_EVIDENCE[0]?.module ?? "audit",
      fileUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
      mimeType: "image/png",
      fileSize: 45000,
      createdAt: `${DEMO_EVIDENCE[0]?.date ?? "2025-05-22"}T12:00:00.000Z`,
    },
    {
      id: "e2",
      title: DEMO_EVIDENCE[1]?.title ?? "Evidencia PDF",
      module: DEMO_EVIDENCE[1]?.module ?? "risk",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      mimeType: "application/pdf",
      fileSize: 13264,
      createdAt: `${DEMO_EVIDENCE[1]?.date ?? "2025-06-01"}T12:00:00.000Z`,
    },
    {
      id: "e3",
      title: DEMO_EVIDENCE[2]?.title ?? "Evidencia Office",
      module: DEMO_EVIDENCE[2]?.module ?? "document",
      fileUrl: "https://example.com/documento-ejemplo.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 184320,
      createdAt: `${DEMO_EVIDENCE[2]?.date ?? "2025-06-10"}T12:00:00.000Z`,
    },
  ];
  const evidence: EvidenceItem[] = evidenceSeeds;

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

  return {
    risks: deepClone(DEMO_RISKS),
    indicators: deepClone(DEMO_INDICATORS),
    audits,
    auditChecklists: checklists,
    nonconformities: deepClone(DEMO_NONCONFORMITIES),
    actions: deepClone(DEMO_ACTIONS),
    documents: docs,
    documentVersions: versions,
    evidence,
    processes: deepClone(DEMO_PROCESSES),
    billing: { plan: "GROWTH", nextBilling: "15 Jul 2026", invoices },
    session,
    toast: null,
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
  | { type: "addAction"; action: ActionRow }
  | { type: "updateAction"; id: string; patch: Partial<ActionRow> }
  | { type: "addDocument"; doc: DocumentRow }
  | { type: "addDocVersion"; docId: string; v: DocVersion }
  | { type: "addEvidence"; ev: EvidenceItem }
  | { type: "setBillingPlan"; plan: PlanKey }
  | { type: "updateSession"; patch: Partial<SessionProfile> }
  | { type: "addProcess"; p: ProcessRow };

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
      return { ...state, billing: { ...state.billing, plan: a.plan } };
    case "updateSession":
      return { ...state, session: { ...state.session, ...a.patch } };
    case "addProcess":
      return { ...state, processes: [...state.processes, a.p] };
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
  showToast: (m: string) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: SessionProfile;
}) {
  const initial = useMemo(() => buildInitialState(profile), [profile]);
  const [state, dispatch] = useReducer(reducer, initial);

  const nextRiskCode = useCallback(() => nextSequentialCode("R", state.risks), [state.risks]);
  const nextNcCode = useCallback(() => nextSequentialCode("NC", state.nonconformities), [state.nonconformities]);
  const nextActionCode = useCallback(() => nextSequentialCode("AC", state.actions), [state.actions]);

  const showToast = useCallback((message: string) => {
    dispatch({ type: "toast", message });
    setTimeout(() => dispatch({ type: "toast", message: null }), 3200);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, nextRiskCode, nextNcCode, nextActionCode, showToast }),
    [state, dispatch, nextRiskCode, nextNcCode, nextActionCode, showToast]
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
