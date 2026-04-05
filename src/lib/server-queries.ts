import { prisma } from "@/lib/prisma";

export async function getDashboardPayload(organizationId: string) {
  const now = new Date();

  const [
    orgStandards,
    actions,
    risks,
    documentsInReview,
    auditsUpcoming,
    openNcs,
    indicators,
    recentAudits,
  ] = await Promise.all([
    prisma.organizationStandard.findMany({
      where: { organizationId },
      include: { standard: true },
    }),
    prisma.action.findMany({ where: { organizationId } }),
    prisma.risk.findMany({ where: { organizationId } }),
    prisma.document.count({
      where: { organizationId, status: "IN_REVIEW" },
    }),
    prisma.audit.count({
      where: {
        organizationId,
        status: "PLANNED",
      },
    }),
    prisma.nonconformity.count({
      where: { organizationId, status: { not: "CLOSED" } },
    }),
    prisma.indicator.findMany({
      where: { organizationId },
      include: { values: { orderBy: { createdAt: "desc" }, take: 6 } },
    }),
    prisma.audit.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
  ]);

  const scores = orgStandards.map(o => o.score).filter((s): s is number => s != null);
  const iso9001 = orgStandards.find(o => o.standard.code === "ISO_9001");
  const iso27001 = orgStandards.find(o => o.standard.code === "ISO_27001");
  const globalPct =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 78;

  const overdueCritical = actions.filter(
    a =>
      a.status !== "COMPLETED" &&
      a.priority === "CRITICAL" &&
      a.dueDate &&
      a.dueDate < now
  ).length;

  const pendingActions = actions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length;

  const criticalRisks = risks.filter(r => r.score >= 15).length;

  const indicatorRows = indicators.map(ind => {
    const latest = ind.values[0];
    const value = latest?.value ?? 0;
    return {
      id: ind.id,
      name: ind.name,
      value,
      target: ind.target,
      unit: ind.unit,
      status: ind.status,
    };
  });

  return {
    organizationId,
    globalPct,
    iso9001Pct: iso9001?.score != null ? Math.round(iso9001.score) : 82,
    iso27001Pct: iso27001?.score != null ? Math.round(iso27001.score) : 74,
    overdueCritical,
    pendingActions,
    criticalRisks,
    documentsInReview,
    auditsUpcoming,
    openNcs,
    indicatorRows,
    recentAudits: recentAudits.map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      scheduledDate: a.scheduledDate?.toISOString() ?? null,
    })),
  };
}

export async function getGapPayload(organizationId: string) {
  const assessments = await prisma.assessment.findMany({
    where: { organizationId, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    include: {
      standard: true,
      answers: { include: { clause: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  const byStandard = (code: string) =>
    assessments.find(a => a.standard.code === code) ?? null;

  function buildRows(assessment: (typeof assessments)[0] | null) {
    if (!assessment || assessment.answers.length === 0) return null;
    const byClause = new Map<string, { scores: number[]; statuses: string[]; title: string }>();
    for (const ans of assessment.answers) {
      const code = ans.clause.code;
      const cur = byClause.get(code) ?? { scores: [], statuses: [], title: ans.clause.title };
      cur.scores.push(ans.score);
      cur.statuses.push(ans.status);
      byClause.set(code, cur);
    }
    return Array.from(byClause.entries())
      .map(([clause, v]) => {
        const score = Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length);
        let status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" = "PARTIALLY_COMPLIANT";
        if (v.statuses.every(s => s === "COMPLIANT")) status = "COMPLIANT";
        else if (v.statuses.some(s => s === "NON_COMPLIANT")) status = "NON_COMPLIANT";
        return {
          clause,
          title: v.title,
          score,
          questions: v.scores.length,
          answered: v.scores.length,
          status,
        };
      })
      .sort((a, b) => a.clause.localeCompare(b.clause, undefined, { numeric: true }));
  }

  return {
    iso9001: buildRows(byStandard("ISO_9001")),
    iso27001: buildRows(byStandard("ISO_27001")),
  };
}

export type DashboardPayload = Awaited<ReturnType<typeof getDashboardPayload>>;
export type GapPayload = Awaited<ReturnType<typeof getGapPayload>>;
