"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import {
  bcpProcessSchema,
  bcpSchema,
  bcpUpdateSchema,
  continuityExportSchema,
  drpSchema,
  drpUpdateSchema,
  improvementSchema,
  improvementStatusSchema,
  scenarioSchema,
  testResultSchema,
  testSchema,
  testStatusSchema,
} from "@/lib/validation/continuity";

const PATH = "/app/continuity";

export type ContinuityPayload = Awaited<ReturnType<typeof getContinuityPayload>>;

function dateValue(v: Date | null | undefined) { return v?.toISOString().slice(0, 10) ?? null; }
function toDate(v: string | null | undefined) { if (!v) return null; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : new Date(v); }
async function ensureMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const m = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!m) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}

export async function getContinuityPayload() {
  const authorization = await requireAuthorization("continuity:read");
  const organizationId = authorization.ctx.organization.id;

  const [bcps, drps, members, processOptions, evidenceOptions] = await Promise.all([
    prisma.businessContinuityPlan.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        owner: { select: { id: true, name: true } },
        criticalProcesses: { include: { process: { select: { id: true, name: true } } } },
        scenarios: { orderBy: { createdAt: "asc" } },
        tests: {
          orderBy: { createdAt: "desc" },
          include: { responsible: { select: { id: true, name: true } }, scenario: { select: { id: true, title: true } }, results: { orderBy: { testedAt: "desc" }, include: { testedBy: { select: { id: true, name: true } }, evidence: { select: { id: true, title: true } }, improvementActions: { include: { responsible: { select: { id: true, name: true } } } } } } },
        },
      },
    }),
    prisma.disasterRecoveryPlan.findMany({ where: { organizationId }, orderBy: { code: "asc" }, include: { owner: { select: { id: true, name: true } }, bcp: { select: { id: true, code: true, title: true } } } }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const allTests = bcps.flatMap((b) => b.tests);
  return {
    canCreate: authorization.can("continuity:create"),
    canUpdate: authorization.can("continuity:update"),
    canExport: authorization.can("continuity:export"),
    summary: {
      bcps: bcps.length,
      drps: drps.length,
      tests: allTests.length,
      testsPassed: allTests.flatMap((t) => t.results).filter((r) => r.outcome === "PASSED").length,
      openImprovements: allTests.flatMap((t) => t.results).flatMap((r) => r.improvementActions).filter((a) => a.status !== "DONE").length,
    },
    bcps: bcps.map((b) => ({
      id: b.id, code: b.code, title: b.title, scope: b.scope, owner: b.owner, status: b.status, rtoMinutes: b.rtoMinutes, rpoMinutes: b.rpoMinutes, dependencies: b.dependencies, nextReviewDate: dateValue(b.nextReviewDate),
      criticalProcesses: b.criticalProcesses.map((p) => ({ id: p.id, process: p.process, rtoMinutes: p.rtoMinutes, rpoMinutes: p.rpoMinutes })),
      scenarios: b.scenarios.map((s) => ({ id: s.id, title: s.title, description: s.description, type: s.type })),
      tests: b.tests.map((t) => ({ id: t.id, title: t.title, type: t.type, status: t.status, plannedDate: dateValue(t.plannedDate), executedDate: dateValue(t.executedDate), responsible: t.responsible, scenario: t.scenario, results: t.results.map((r) => ({ id: r.id, outcome: r.outcome, rtoAchievedMinutes: r.rtoAchievedMinutes, rpoAchievedMinutes: r.rpoAchievedMinutes, summary: r.summary, testedBy: r.testedBy, testedAt: r.testedAt.toISOString(), evidence: r.evidence, improvementActions: r.improvementActions.map((a) => ({ id: a.id, description: a.description, responsible: a.responsible, targetDate: dateValue(a.targetDate), status: a.status })) })) })),
    })),
    drps: drps.map((d) => ({ id: d.id, code: d.code, title: d.title, owner: d.owner, bcp: d.bcp, status: d.status, rtoMinutes: d.rtoMinutes, rpoMinutes: d.rpoMinutes, systems: d.systems, dependencies: d.dependencies, nextReviewDate: dateValue(d.nextReviewDate) })),
    members: members.map((m) => m.user),
    processOptions, evidenceOptions,
  };
}

export async function createBcp(input: unknown) {
  const data = parseInput(bcpSchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  const result = await prisma.$transaction(async (tx) => {
    const dup = await tx.businessContinuityPlan.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un plan con el código ${data.code}.`);
    const plan = await tx.businessContinuityPlan.create({ data: { organizationId, code: data.code, title: data.title, scope: data.scope ?? null, ownerId: data.ownerId ?? null, status: data.status, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null, dependencies: data.dependencies ?? null, nextReviewDate: toDate(data.nextReviewDate) } });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcp", recordId: plan.id, after: { code: plan.code } });
    return plan;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateBcp(input: unknown) {
  const data = parseInput(bcpUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  await prisma.$transaction(async (tx) => {
    const before = await tx.businessContinuityPlan.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Plan no encontrado.");
    await tx.businessContinuityPlan.update({ where: { id: before.id }, data: { code: data.code, title: data.title, scope: data.scope ?? null, ownerId: data.ownerId ?? null, status: data.status, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null, dependencies: data.dependencies ?? null, nextReviewDate: toDate(data.nextReviewDate) } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcp", recordId: before.id });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function createDrp(input: unknown) {
  const data = parseInput(drpSchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  const result = await prisma.$transaction(async (tx) => {
    if (data.bcpId) {
      const bcp = await tx.businessContinuityPlan.findFirst({ where: { id: data.bcpId, organizationId } });
      if (!bcp) throw new Error("El BCP vinculado no pertenece a la organización.");
    }
    const dup = await tx.disasterRecoveryPlan.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un DRP con el código ${data.code}.`);
    const plan = await tx.disasterRecoveryPlan.create({ data: { organizationId, code: data.code, title: data.title, bcpId: data.bcpId ?? null, ownerId: data.ownerId ?? null, status: data.status, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null, systems: data.systems ?? null, dependencies: data.dependencies ?? null, nextReviewDate: toDate(data.nextReviewDate) } });
    await writeAuditLog(tx, { ctx, action: "create", module: "drp", recordId: plan.id, after: { code: plan.code } });
    return plan;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateDrp(input: unknown) {
  const data = parseInput(drpUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  await prisma.$transaction(async (tx) => {
    const before = await tx.disasterRecoveryPlan.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("DRP no encontrado.");
    if (data.bcpId) {
      const bcp = await tx.businessContinuityPlan.findFirst({ where: { id: data.bcpId, organizationId } });
      if (!bcp) throw new Error("El BCP vinculado no pertenece a la organización.");
    }
    await tx.disasterRecoveryPlan.update({ where: { id: before.id }, data: { code: data.code, title: data.title, bcpId: data.bcpId ?? null, ownerId: data.ownerId ?? null, status: data.status, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null, systems: data.systems ?? null, dependencies: data.dependencies ?? null, nextReviewDate: toDate(data.nextReviewDate) } });
    await writeAuditLog(tx, { ctx, action: "update", module: "drp", recordId: before.id });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function addBcpProcess(input: unknown) {
  const data = parseInput(bcpProcessSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [plan, proc] = await Promise.all([
      tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId } }),
      tx.process.findFirst({ where: { id: data.processId, organizationId } }),
    ]);
    if (!plan || !proc) throw new Error("Plan o proceso no pertenecen a la organización.");
    const link = await tx.bCPProcess.create({ data: { organizationId, planId: plan.id, processId: proc.id, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null } });
    await writeAuditLog(tx, { ctx, action: "link_process", module: "bcp", recordId: plan.id, after: { processId: proc.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function removeBcpProcess(id: string) {
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.bCPProcess.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.bCPProcess.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_process", module: "bcp", recordId: link.planId });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function addScenario(input: unknown) {
  const data = parseInput(scenarioSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId } });
    if (!plan) throw new Error("Plan no encontrado.");
    const s = await tx.continuityScenario.create({ data: { organizationId, planId: plan.id, title: data.title, description: data.description ?? null, type: data.type ?? null } });
    await writeAuditLog(tx, { ctx, action: "add_scenario", module: "bcp", recordId: plan.id, after: { scenarioId: s.id } });
    return s;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function createTest(input: unknown) {
  const data = parseInput(testSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId } });
    if (!plan) throw new Error("Plan no encontrado.");
    if (data.scenarioId) {
      const sc = await tx.continuityScenario.findFirst({ where: { id: data.scenarioId, organizationId } });
      if (!sc) throw new Error("El escenario no pertenece a la organización.");
    }
    const t = await tx.continuityTest.create({ data: { organizationId, planId: plan.id, scenarioId: data.scenarioId ?? null, title: data.title, type: data.type, plannedDate: toDate(data.plannedDate), responsibleId: data.responsibleId ?? null } });
    await writeAuditLog(tx, { ctx, action: "create_test", module: "continuity_test", recordId: t.id, after: { planId: plan.id } });
    return t;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function setTestStatus(input: unknown) {
  const data = parseInput(testStatusSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await prisma.$transaction(async (tx) => {
    const test = await tx.continuityTest.findFirst({ where: { id: data.id, organizationId } });
    if (!test) throw new Error("Prueba no encontrada.");
    await tx.continuityTest.update({ where: { id: test.id }, data: { status: data.status, executedDate: data.status === "COMPLETED" ? new Date() : test.executedDate } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: "continuity_test", recordId: test.id, before: { status: test.status }, after: { status: data.status } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function recordTestResult(input: unknown) {
  const data = parseInput(testResultSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const test = await tx.continuityTest.findFirst({ where: { id: data.testId, organizationId } });
    if (!test) throw new Error("Prueba no encontrada.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const res = await tx.testResult.create({ data: { organizationId, testId: test.id, outcome: data.outcome, rtoAchievedMinutes: data.rtoAchievedMinutes ?? null, rpoAchievedMinutes: data.rpoAchievedMinutes ?? null, summary: data.summary ?? null, evidenceId: data.evidenceId ?? null, testedById: ctx.user.id } });
    await tx.continuityTest.update({ where: { id: test.id }, data: { status: "COMPLETED", executedDate: test.executedDate ?? new Date() } });
    await writeAuditLog(tx, { ctx, action: "record_result", module: "continuity_test", recordId: test.id, after: { resultId: res.id, outcome: data.outcome } });
    return res;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function addImprovementAction(input: unknown) {
  const data = parseInput(improvementSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const res = await tx.testResult.findFirst({ where: { id: data.testResultId, organizationId } });
    if (!res) throw new Error("Resultado de prueba no encontrado.");
    const action = await tx.improvementAction.create({ data: { organizationId, testResultId: res.id, description: data.description, responsibleId: data.responsibleId ?? null, targetDate: toDate(data.targetDate) } });
    await writeAuditLog(tx, { ctx, action: "add_improvement", module: "continuity_test", recordId: res.testId, after: { improvementId: action.id } });
    return action;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function setImprovementStatus(input: unknown) {
  const data = parseInput(improvementStatusSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await prisma.$transaction(async (tx) => {
    const action = await tx.improvementAction.findFirst({ where: { id: data.id, organizationId } });
    if (!action) throw new Error("Acción de mejora no encontrada.");
    await tx.improvementAction.update({ where: { id: action.id }, data: { status: data.status } });
    await writeAuditLog(tx, { ctx, action: "improvement_status", module: "continuity_test", recordId: action.testResultId, after: { improvementId: action.id, status: data.status } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function exportContinuity(input: unknown) {
  const data = parseInput(continuityExportSchema, input);
  const ctx = await requirePermission("continuity:export");
  const now = new Date();
  const reportType = data.reportType ?? "continuity-plans";
  const titles: Record<string, string> = { "continuity-plans": "Planes de continuidad y recuperación", "bcp-dr-tests": "Pruebas BCP/DR" };
  const report = await queueReportForContext({ ctx, reportType, title: titles[reportType] ?? "Continuidad", format: data.format, fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
