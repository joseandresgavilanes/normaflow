import {
  DEMO_ACTIONS,
  DEMO_ACTIVITY,
  DEMO_AUDITS,
  DEMO_DOCUMENTS,
  DEMO_EVIDENCE,
  DEMO_GAP,
  DEMO_INDICATORS,
  DEMO_NONCONFORMITIES,
  DEMO_NOTIFICATIONS,
  DEMO_PROCESSES,
  DEMO_RISKS,
} from "@/lib/demo-data";
import type { DemoOrganization } from "@/lib/demo/organizations";

export type GapQuestion = { id: string; text: string; answer: "YES" | "NO" | "NA" | null };

export type GapClauseState = {
  clause: string;
  title: string;
  score: number;
  questions: number;
  answered: number;
  status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT";
  comment: string;
  questionsDetail: GapQuestion[];
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

export type SiteRow = { id: string; name: string; code: string; city: string };

export type AuditFindingRow = {
  id: string;
  auditId: string;
  title: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "OBSERVATION";
  status: "OPEN" | "CLOSED";
  clause?: string;
};

function deep<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function gapQuestionsForClause(clause: string, title: string): GapQuestion[] {
  return [
    {
      id: `${clause}-q1`,
      text: `¿El requisito de «${title}» está documentado y comunicado?`,
      answer: null,
    },
    {
      id: `${clause}-q2`,
      text: `¿Existe evidencia objetiva de implementación en los últimos 12 meses?`,
      answer: null,
    },
    {
      id: `${clause}-q3`,
      text: `¿Las no conformidades previas en esta área están cerradas efectivamente?`,
      answer: null,
    },
  ];
}

export function recomputeGapClause(row: GapClauseState): GapClauseState {
  const { score, answered } = scoreFromGapQuestions(row.questionsDetail);
  return { ...row, score, answered, status: statusFromScore(score) };
}

function scoreFromGapQuestions(qs: GapQuestion[]): { score: number; answered: number } {
  const answered = qs.filter(q => q.answer != null).length;
  if (answered === 0) return { score: 0, answered: 0 };
  let pts = 0;
  for (const q of qs) {
    if (q.answer === "YES") pts += 100;
    else if (q.answer === "NA") pts += 75;
    else if (q.answer === "NO") pts += 35;
  }
  return { score: Math.round(pts / qs.length), answered };
}

function statusFromScore(score: number): GapClauseState["status"] {
  if (score >= 80) return "COMPLIANT";
  if (score >= 55) return "PARTIALLY_COMPLIANT";
  return "NON_COMPLIANT";
}

function presetAnswersForDemoScore(score: number): GapQuestion["answer"][] {
  if (score >= 80) return ["YES", "YES", "YES"];
  if (score >= 65) return ["YES", "YES", "NA"];
  if (score >= 50) return ["YES", "NO", "NO"];
  return ["NO", "NO", "YES"];
}

export function buildGapState(standard: "iso9001" | "iso27001"): GapClauseState[] {
  const base = DEMO_GAP[standard];
  return base.map(row => {
    const questionsDetail = gapQuestionsForClause(row.clause, row.title);
    const preset = presetAnswersForDemoScore(row.score);
    questionsDetail.forEach((q, i) => {
      q.answer = preset[i] ?? null;
    });
    const { score, answered } = scoreFromGapQuestions(questionsDetail);
    return {
      clause: row.clause,
      title: row.title,
      score,
      questions: questionsDetail.length,
      answered,
      status: statusFromScore(score),
      comment: "",
      questionsDetail,
    };
  });
}

export function buildNotifications(org: DemoOrganization): NotificationItem[] {
  const prefix = org.id;
  const extra: NotificationItem[] = [
    {
      id: `${prefix}-n-x1`,
      title: "Revisión documental pendiente",
      body: `3 documentos en estado «En revisión» requieren validación en ${org.shortName}.`,
      type: "WARNING",
      read: false,
      link: "/app/documents",
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
    {
      id: `${prefix}-n-x2`,
      title: "Acción crítica próxima a vencer",
      body: "AC-002 — MFA en sistemas críticos vence en 5 días.",
      type: "ALERT",
      read: false,
      link: "/app/actions",
      createdAt: new Date(Date.now() - 7200_000).toISOString(),
    },
    {
      id: `${prefix}-n-x3`,
      title: "Auditoría interna en curso",
      body: "ISO 27001 semestral — completar checklist de evidencias.",
      type: "INFO",
      read: true,
      link: "/app/audits",
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: `${prefix}-n-x4`,
      title: "Indicador bajo objetivo",
      body: "Disponibilidad de sistemas críticos por debajo de la meta trimestral.",
      type: "WARNING",
      read: false,
      link: "/app/indicators",
      createdAt: new Date(Date.now() - 172800_000).toISOString(),
    },
    {
      id: `${prefix}-n-x5`,
      title: "Nueva evidencia registrada",
      body: "Se ha vinculado evidencia al módulo de auditoría.",
      type: "SUCCESS",
      read: true,
      link: "/app/evidence",
      createdAt: new Date(Date.now() - 250000_000).toISOString(),
    },
  ];
  const fromDemo = DEMO_NOTIFICATIONS.map(n => ({
    id: `${prefix}-${n.id}`,
    title: n.title,
    body: n.body,
    type: n.type,
    read: n.read,
    link: n.type === "INFO" ? "/app/audits" : n.type === "WARNING" ? "/app/documents" : "/app/actions",
    createdAt: n.time,
  }));
  return [...extra, ...fromDemo];
}

export function buildSites(org: DemoOrganization): SiteRow[] {
  const city = org.city;
  return [
    { id: `${org.id}-s1`, name: "Sede principal", code: "HQ-01", city },
    { id: `${org.id}-s2`, name: "Planta operaciones", code: "OP-02", city: org.id === "org_tecnoserv" ? "Toledo" : "Zaragoza" },
    { id: `${org.id}-s3`, name: "Oficina técnica", code: "TEC-03", city: org.id === "org_tecnoserv" ? "Madrid" : city },
  ];
}

export function buildAuditFindings(): AuditFindingRow[] {
  return [
    {
      id: "af-a1-1",
      auditId: "a1",
      title: "Documentación de proceso de producción desactualizada (>6 meses)",
      severity: "MAJOR",
      status: "OPEN",
      clause: "8.5",
    },
    {
      id: "af-a1-2",
      auditId: "a1",
      title: "Registro de auditorías internas incompleto en 2 áreas",
      severity: "MINOR",
      status: "CLOSED",
      clause: "9.2",
    },
    {
      id: "af-a1-3",
      auditId: "a1",
      title: "Observación: mejora oportuna en etiquetado de producto",
      severity: "OBSERVATION",
      status: "CLOSED",
      clause: "8.5",
    },
    {
      id: "af-a2-1",
      auditId: "a2",
      title: "Control de acceso físico a sala de servidores — revisión trimestral vencida",
      severity: "MINOR",
      status: "OPEN",
      clause: "A.11.1",
    },
  ];
}

const FOLDERS = ["SGC", "SGSI", "Operaciones", "RRHH", "Calidad"] as const;

export function documentsWithMeta(orgId: string) {
  return deep(DEMO_DOCUMENTS).map((d, i) => ({
    ...d,
    folder: FOLDERS[i % FOLDERS.length],
    siteId: `${orgId}-s1`,
    linkedClause: d.clause,
    linkedProcessCode: i % 3 === 0 ? "P-01" : i % 3 === 1 ? "P-08" : "P-03",
  }));
}

export function processesWithLinks(orgId: string) {
  return deep(DEMO_PROCESSES).map((p, i) => ({
    ...p,
    siteId: `${orgId}-s1`,
    linkedRiskCodes: i === 0 ? ["R-001", "R-002"] : i === 1 ? ["R-004"] : ["R-003"],
    linkedDocCodes: i === 0 ? ["SGC-MAN-001", "SGC-PRO-001"] : ["SGSI-POL-001"],
    linkedIndicatorNames: i === 0 ? ["Satisfacción del Cliente (NPS)"] : ["Disponibilidad de Sistemas Críticos"],
  }));
}

export function risksForOrg(orgId: string) {
  const r = deep(DEMO_RISKS);
  if (orgId === "org_logistica") {
    return r.map((x, i) => ({
      ...x,
      title: i === 0 ? "Rotura de cadena de frío en almacén" : i === 1 ? "Retrasos críticos en última milla" : x.title,
      category: i < 2 ? "Logística" : x.category,
    }));
  }
  if (orgId === "org_iberica") {
    return r.map((x, i) => ({
      ...x,
      title: i === 0 ? "Incidente de seguridad en aplicación SaaS" : x.title,
    }));
  }
  return r;
}

export function indicatorsForOrg(orgId: string) {
  const ind = deep(DEMO_INDICATORS);
  if (orgId !== "org_tecnoserv") {
    return ind.map(x => ({ ...x, value: Math.max(0, x.value * (orgId === "org_iberica" ? 0.92 : 0.97)) }));
  }
  return ind;
}

export function activityForOrg(org: DemoOrganization) {
  return deep(DEMO_ACTIVITY).map((a, i) => ({
    ...a,
    object: i === 0 ? `${a.object} (${org.shortName})` : a.object,
  }));
}
