"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseId, parseInput } from "@/lib/validation/common";
import type { Prisma } from "@prisma/client";
import { assertRtoWithinMtpd, criticalityFor, detectGaps, impactScore, readinessScore, recoveryPriority } from "@/lib/continuity/bia";
import {
  biaSchema,
  biaUpdateSchema,
  communicationNodeSchema,
  crisisContactSchema,
  crisisTeamSchema,
  criticalActivitySchema,
  criticalActivityUpdateSchema,
  dependencySchema,
  dependencyUpdateSchema,
  planActivationSchema,
  planApprovalSchema,
  planDeactivationSchema,
  planVersionSchema,
  productPrioritySchema,
  productPriorityUpdateSchema,
  recoveryProcedureSchema,
  recoveryProcedureUpdateSchema,
  resourceSchema,
  resourceUpdateSchema,
  strategySchema,
  strategyUpdateSchema,
  strategyStatusSchema,
  bcpProcessSchema,
  bcpSchema,
  bcpUpdateSchema,
  continuityExportSchema,
  drpSchema,
  drpUpdateSchema,
  crisisContactUpdateSchema,
  crisisTeamUpdateSchema,
  communicationNodeUpdateSchema,
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
function toDate(v: string | null | undefined) {
  if (!v) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : new Date(v);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha no es válida.");
  return date;
}

function assertRecoveryWindow(rtoMinutes?: number | null, rpoMinutes?: number | null) {
  if (typeof rtoMinutes === "number" && typeof rpoMinutes === "number" && rpoMinutes > rtoMinutes) {
    throw new Error(`El RPO (${rpoMinutes} min) no puede superar el RTO (${rtoMinutes} min).`);
  }
}

function assertDateOrder(start?: string | null, end?: string | null) {
  if (!start || !end) return;
  const startTime = toDate(start)?.getTime();
  const endTime = toDate(end)?.getTime();
  if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
    throw new Error("La fecha de revisión debe ser posterior o igual a la fecha realizada.");
  }
}

function assertResourceQuantities(normalQuantity?: number | null, minimumQuantity?: number | null) {
  if (typeof normalQuantity === "number" && typeof minimumQuantity === "number" && minimumQuantity > normalQuantity) {
    throw new Error("La cantidad mínima no puede superar la cantidad normal.");
  }
}
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
    canApprove: authorization.can("continuity:approve"),
    canDelete: authorization.can("continuity:delete"),
    canExport: authorization.can("continuity:export"),
    summary: {
      bcps: bcps.length,
      drps: drps.length,
      tests: allTests.length,
      testsPassed: allTests.flatMap((t) => t.results).filter((r) => r.outcome === "PASSED").length,
      openImprovements: allTests.flatMap((t) => t.results).flatMap((r) => r.improvementActions).filter((a) => a.status !== "DONE").length,
    },
    bcps: bcps.map((b) => ({
      id: b.id, code: b.code, title: b.title, scope: b.scope, owner: b.owner, status: b.status, version: b.version, rtoMinutes: b.rtoMinutes, rpoMinutes: b.rpoMinutes, dependencies: b.dependencies, nextReviewDate: dateValue(b.nextReviewDate),
      criticalProcesses: b.criticalProcesses.map((p) => ({ id: p.id, process: p.process, rtoMinutes: p.rtoMinutes, rpoMinutes: p.rpoMinutes })),
      scenarios: b.scenarios.map((s) => ({ id: s.id, title: s.title, description: s.description, type: s.type })),
      tests: b.tests.map((t) => ({ id: t.id, title: t.title, type: t.type, status: t.status, plannedDate: dateValue(t.plannedDate), executedDate: dateValue(t.executedDate), responsible: t.responsible, scenario: t.scenario, results: t.results.map((r) => ({ id: r.id, outcome: r.outcome, rtoAchievedMinutes: r.rtoAchievedMinutes, rpoAchievedMinutes: r.rpoAchievedMinutes, summary: r.summary, testedBy: r.testedBy, testedAt: r.testedAt.toISOString(), evidence: r.evidence, improvementActions: r.improvementActions.map((a) => ({ id: a.id, description: a.description, responsible: a.responsible, targetDate: dateValue(a.targetDate), status: a.status })) })) })),
    })),
    drps: drps.map((d) => ({ id: d.id, code: d.code, title: d.title, owner: d.owner, bcp: d.bcp, status: d.status, rtoMinutes: d.rtoMinutes, rpoMinutes: d.rpoMinutes, systems: d.systems, dependencies: d.dependencies, nextReviewDate: dateValue(d.nextReviewDate) })),
    members: members.map((m) => m.user),
    processOptions, evidenceOptions,
    ...(await getBcmSection(organizationId, bcps)),
  };
}

/**
 * Sección de continuidad del negocio (ISO 22301): BIA, actividades críticas con
 * sus dependencias/recursos/estrategias, equipos de crisis, activaciones y el
 * análisis de brechas y preparación derivado.
 */
async function getBcmSection(
  organizationId: string,
  plans: { id: string; code: string; title: string; version: string; status: string; activated: boolean }[],
) {
  const [bias, activities, priorities, strategies, procedures, teams, activations, planVersions] = await Promise.all([
    prisma.businessImpactAnalysis.findMany({
      where: { organizationId }, orderBy: { code: "asc" },
      include: { owner: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
    }),
    prisma.criticalActivity.findMany({
      where: { organizationId }, orderBy: [{ priority: "asc" }, { code: "asc" }],
      include: {
        owner: { select: { id: true, name: true } },
        dependencies: true,
        resources: true,
        strategies: { select: { id: true, code: true, title: true, type: true, status: true, achievesRtoMinutes: true } },
        procedures: { select: { id: true, code: true, title: true } },
      },
    }),
    prisma.productServicePriority.findMany({ where: { organizationId }, orderBy: [{ priority: "asc" }, { code: "asc" }] }),
    prisma.continuityStrategy.findMany({
      where: { organizationId }, orderBy: { code: "asc" },
      include: { owner: { select: { id: true, name: true } }, activity: { select: { id: true, code: true, name: true } } },
    }),
    prisma.recoveryProcedure.findMany({
      where: { organizationId }, orderBy: [{ order: "asc" }, { code: "asc" }],
      include: { responsible: { select: { id: true, name: true } }, activity: { select: { id: true, code: true, name: true } } },
    }),
    prisma.crisisTeam.findMany({
      where: { organizationId }, orderBy: { code: "asc" },
      include: {
        leader: { select: { id: true, name: true } }, deputy: { select: { id: true, name: true } },
        contacts: { orderBy: { escalationOrder: "asc" } },
        trees: { orderBy: { order: "asc" } },
      },
    }),
    prisma.planActivation.findMany({
      where: { organizationId }, orderBy: { activatedAt: "desc" }, take: 50,
      include: { activatedBy: { select: { id: true, name: true } }, scenario: { select: { id: true, title: true } } },
    }),
    prisma.continuityPlanVersion.findMany({
      where: { organizationId }, orderBy: [{ planId: "asc" }, { createdAt: "desc" }],
      include: { approvedBy: { select: { id: true, name: true } } },
    }),
  ]);

  // Actividades ejercitadas: las cubiertas por algún simulacro ejecutado.
  const executedTests = await prisma.continuityTest.count({ where: { organizationId, status: "COMPLETED" } });

  const activityRows = activities.map((a) => {
    const gaps = detectGaps({
      id: a.id, name: a.name, mtpdMinutes: a.mtpdMinutes, rtoMinutes: a.rtoMinutes,
      strategies: a.strategies.map((s) => ({ achievesRtoMinutes: s.achievesRtoMinutes, status: s.status })),
      procedures: a.procedures.length,
      dependencies: a.dependencies.map((d) => ({ name: d.name, singlePointOfFailure: d.singlePointOfFailure })),
      tested: executedTests > 0,
    });
    return {
      id: a.id, biaId: a.biaId, code: a.code, name: a.name, description: a.description,
      processId: a.processId, owner: a.owner,
      mtpdMinutes: a.mtpdMinutes, rtoMinutes: a.rtoMinutes, rpoMinutes: a.rpoMinutes,
      minimumServiceLevel: a.minimumServiceLevel,
      impactScore: a.impactScore, criticality: a.criticality, priority: a.priority,
      impacts: {
        financial: a.financialImpact, operational: a.operationalImpact, legal: a.legalImpact,
        reputational: a.reputationalImpact, people: a.peopleImpact,
      },
      dependencies: a.dependencies.map((d) => ({
        id: d.id, type: d.type, name: d.name, criticality: d.criticality,
        maxOutageMinutes: d.maxOutageMinutes, alternative: d.alternative,
        singlePointOfFailure: d.singlePointOfFailure,
        supplierId: d.supplierId, assetId: d.assetId, processId: d.processId,
      })),
      resources: a.resources.map((r) => ({
        id: r.id, type: r.type, name: r.name, normalQuantity: r.normalQuantity,
        minimumQuantity: r.minimumQuantity, unit: r.unit, alternativeResource: r.alternativeResource,
        leadTimeMinutes: r.leadTimeMinutes,
      })),
      strategies: a.strategies,
      procedures: a.procedures,
      gaps,
    };
  });

  const allGaps = activityRows.flatMap((a) => a.gaps);
  return {
    bias: bias.map((b) => ({
      id: b.id, code: b.code, title: b.title, scope: b.scope, methodology: b.methodology,
      version: b.version, status: b.status, owner: b.owner, approvedBy: b.approvedBy,
      approvedAt: dateValue(b.approvedAt), performedAt: dateValue(b.performedAt), evidenceId: b.evidenceId,
      nextReviewDate: dateValue(b.nextReviewDate),
      activityCount: activityRows.filter((a) => a.biaId === b.id).length,
    })),
    activities: activityRows,
    productPriorities: priorities.map((p) => ({
      id: p.id, code: p.code, name: p.name, priority: p.priority, criticality: p.criticality,
      mtpdMinutes: p.mtpdMinutes, rtoMinutes: p.rtoMinutes, minimumServiceLevel: p.minimumServiceLevel,
      revenueShare: p.revenueShare, customersAffected: p.customersAffected, description: p.description, notes: p.notes,
    })),
    strategies: strategies.map((s) => ({
      id: s.id, code: s.code, title: s.title, type: s.type, status: s.status,
      achievesRtoMinutes: s.achievesRtoMinutes, achievesRpoMinutes: s.achievesRpoMinutes,
      cost: s.cost, owner: s.owner, activity: s.activity, description: s.description,
    })),
    recoveryProcedures: procedures.map((p) => ({
      id: p.id, code: p.code, title: p.title, objective: p.objective, order: p.order,
      version: p.version, estimatedMinutes: p.estimatedMinutes, responsible: p.responsible,
      activity: p.activity, documentId: p.documentId,
    })),
    crisisTeams: teams.map((t) => ({
      id: t.id, code: t.code, name: t.name, purpose: t.purpose, planId: t.planId,
      leader: t.leader, deputy: t.deputy, activationRule: t.activationRule, meetingPoint: t.meetingPoint,
      contacts: t.contacts.map((c) => ({
        id: c.id, name: c.name, role: c.role, type: c.type, primaryPhone: c.primaryPhone,
        altPhone: c.altPhone, email: c.email, escalationOrder: c.escalationOrder, isDeputy: c.isDeputy,
      })),
      communicationTree: t.trees.map((n) => ({
        id: n.id, parentId: n.parentId, contactId: n.contactId, label: n.label,
        audience: n.audience, channel: n.channel, order: n.order, maxDelayMinutes: n.maxDelayMinutes,
      })),
    })),
    activations: activations.map((a) => ({
      id: a.id, planId: a.planId, reason: a.reason, scenario: a.scenario,
      activatedBy: a.activatedBy, activatedAt: a.activatedAt.toISOString(),
      deactivatedAt: a.deactivatedAt?.toISOString() ?? null, outcome: a.outcome, lessonsLearned: a.lessonsLearned,
    })),
    planVersions: planVersions.map((v) => ({
      id: v.id, planId: v.planId, version: v.version, changeSummary: v.changeSummary,
      approvedBy: v.approvedBy, approvedAt: dateValue(v.approvedAt), createdAt: dateValue(v.createdAt),
    })),
    planStatus: plans.map((p) => ({ id: p.id, code: p.code, title: p.title, version: p.version, status: p.status, activated: p.activated })),
    gaps: allGaps,
    bcmSummary: {
      bias: bias.length,
      approvedBias: bias.filter((b) => b.status === "APPROVED").length,
      activities: activityRows.length,
      criticalActivities: activityRows.filter((a) => a.criticality === "CRITICAL" || a.criticality === "HIGH").length,
      dependencies: activityRows.reduce((n, a) => n + a.dependencies.length, 0),
      singlePointsOfFailure: activityRows.reduce((n, a) => n + a.dependencies.filter((d) => d.singlePointOfFailure).length, 0),
      strategies: strategies.length,
      approvedStrategies: strategies.filter((s) => s.status === "APPROVED" || s.status === "IMPLEMENTED").length,
      procedures: procedures.length,
      crisisTeams: teams.length,
      crisisContacts: teams.reduce((n, t) => n + t.contacts.length, 0),
      activePlans: plans.filter((p) => p.activated).length,
      totalGaps: allGaps.length,
      readiness: readinessScore(activityRows.map((a) => ({ criticality: a.criticality, gaps: a.gaps.length }))),
    },
  };
}

export async function createBcp(input: unknown) {
  const data = parseInput(bcpSchema, input);
  assertRecoveryWindow(data.rtoMinutes, data.rpoMinutes);
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
    assertRecoveryWindow(data.rtoMinutes ?? before.rtoMinutes, data.rpoMinutes ?? before.rpoMinutes);
    if (data.status !== undefined && data.status !== before.status) {
      throw new Error("El estado del BCP solo puede cambiarse mediante el flujo de aprobación.");
    }
    if (data.code !== undefined) {
      const duplicate = await tx.businessContinuityPlan.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un plan con el código ${data.code}.`);
    }
    await tx.businessContinuityPlan.update({
      where: { id: before.id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.scope !== undefined ? { scope: data.scope ?? null } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId ?? null } : {}),
        ...(data.rtoMinutes !== undefined ? { rtoMinutes: data.rtoMinutes ?? null } : {}),
        ...(data.rpoMinutes !== undefined ? { rpoMinutes: data.rpoMinutes ?? null } : {}),
        ...(data.dependencies !== undefined ? { dependencies: data.dependencies ?? null } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: toDate(data.nextReviewDate) } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcp", recordId: before.id });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function createDrp(input: unknown) {
  const data = parseInput(drpSchema, input);
  assertRecoveryWindow(data.rtoMinutes, data.rpoMinutes);
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
    assertRecoveryWindow(data.rtoMinutes ?? before.rtoMinutes, data.rpoMinutes ?? before.rpoMinutes);
    if (data.status !== undefined && data.status !== before.status) {
      throw new Error("El estado del DRP no puede modificarse desde la edición del plan.");
    }
    if (data.code !== undefined) {
      const duplicate = await tx.disasterRecoveryPlan.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un DRP con el código ${data.code}.`);
    }
    if (data.bcpId) {
      const bcp = await tx.businessContinuityPlan.findFirst({ where: { id: data.bcpId, organizationId } });
      if (!bcp) throw new Error("El BCP vinculado no pertenece a la organización.");
    }
    await tx.disasterRecoveryPlan.update({
      where: { id: before.id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.bcpId !== undefined ? { bcpId: data.bcpId ?? null } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId ?? null } : {}),
        ...(data.rtoMinutes !== undefined ? { rtoMinutes: data.rtoMinutes ?? null } : {}),
        ...(data.rpoMinutes !== undefined ? { rpoMinutes: data.rpoMinutes ?? null } : {}),
        ...(data.systems !== undefined ? { systems: data.systems ?? null } : {}),
        ...(data.dependencies !== undefined ? { dependencies: data.dependencies ?? null } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: toDate(data.nextReviewDate) } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: "drp", recordId: before.id });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function addBcpProcess(input: unknown) {
  const data = parseInput(bcpProcessSchema, input);
  assertRecoveryWindow(data.rtoMinutes, data.rpoMinutes);
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
  id = parseId(id);
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
      const sc = await tx.continuityScenario.findFirst({ where: { id: data.scenarioId, organizationId, planId: plan.id } });
      if (!sc) throw new Error("El escenario no pertenece a este plan.");
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
    const allowedTransitions: Record<string, string[]> = {
      PLANNED: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (test.status === data.status) return;
    if (!allowedTransitions[test.status]?.includes(data.status)) {
      throw new Error(`No se puede cambiar una prueba ${test.status} a ${data.status}.`);
    }
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
    if (test.status === "CANCELLED") throw new Error("No se puede registrar un resultado en una prueba cancelada.");
    const existingResult = await tx.testResult.findFirst({ where: { testId: test.id, organizationId }, select: { id: true } });
    if (existingResult) throw new Error("La prueba ya tiene un resultado registrado.");
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
    const allowedTransitions: Record<string, string[]> = { OPEN: ["IN_PROGRESS"], IN_PROGRESS: ["DONE"], DONE: [] };
    if (action.status === data.status) return;
    if (!allowedTransitions[action.status]?.includes(data.status)) {
      throw new Error(`No se puede cambiar una mejora ${action.status} a ${data.status}.`);
    }
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
  const titles: Record<string, string> = {
    "continuity-plans": "Planes de continuidad y recuperación", "bcp-dr-tests": "Pruebas BCP/DR",
    "bcm-bia": "Análisis de Impacto en el Negocio", "bcm-critical-processes": "Procesos críticos priorizados",
    "bcm-rto-rpo": "Matriz MTPD/RTO/RPO", "bcm-priority-products": "Priorización de productos y servicios",
    "bcm-dependencies": "Dependencias y recursos", "bcm-strategies": "Estrategias de continuidad",
    "bcm-plans": "Planes de continuidad", "bcm-plan-versions": "Historial de versiones de planes",
    "bcm-crisis-teams": "Equipos de crisis y contactos", "bcm-activations": "Activaciones e interrupciones reales",
    "bcm-exercises": "Simulacros y resultados", "bcm-gaps": "Brechas de continuidad", "bcm-audit-package": "Auditoría de continuidad (paquete completo)",
  };
  const report = await queueReportForContext({ ctx, reportType, title: titles[reportType] ?? "Continuidad", format: data.format, fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}

// ═══════════════════════════════════════════════════════
// PAQUETE DE CONTINUIDAD DEL NEGOCIO (ISO 22301)
// Reutiliza procesos, riesgos, activos, proveedores, incidentes, documentos y
// evidencias existentes: las referencias son ids escalares validados aquí.
// ═══════════════════════════════════════════════════════

/** Valida que cada referencia a otro módulo pertenece a la organización. */
async function ensureRefs(organizationId: string, refs: Partial<Record<
  "processId" | "assetId" | "supplierId" | "personnelId" | "locationId" | "documentId" | "evidenceId" | "riskId" | "incidentId", string | null | undefined
>>) {
  const checks: Promise<void>[] = [];
  const guard = <T>(p: Promise<T | null>, message: string) => checks.push(p.then((r) => { if (!r) throw new Error(message); }));
  if (refs.processId) guard(prisma.process.findFirst({ where: { id: refs.processId, organizationId }, select: { id: true } }), "El proceso no pertenece a la organización.");
  if (refs.assetId) guard(prisma.informationAsset.findFirst({ where: { id: refs.assetId, organizationId }, select: { id: true } }), "El activo no pertenece a la organización.");
  if (refs.supplierId) guard(prisma.supplier.findFirst({ where: { id: refs.supplierId, organizationId }, select: { id: true } }), "El proveedor no pertenece a la organización.");
  if (refs.personnelId) guard(prisma.personnel.findFirst({ where: { id: refs.personnelId, organizationId }, select: { id: true } }), "La persona no pertenece a la organización.");
  if (refs.locationId) guard(prisma.location.findFirst({ where: { id: refs.locationId, organizationId }, select: { id: true } }), "La ubicación no pertenece a la organización.");
  if (refs.documentId) guard(prisma.document.findFirst({ where: { id: refs.documentId, organizationId }, select: { id: true } }), "El documento no pertenece a la organización.");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst({ where: { id: refs.evidenceId, organizationId, deletedAt: null }, select: { id: true } }), "La evidencia no pertenece a la organización o fue eliminada.");
  if (refs.riskId) guard(prisma.risk.findFirst({ where: { id: refs.riskId, organizationId }, select: { id: true } }), "El riesgo no pertenece a la organización.");
  if (refs.incidentId) guard(prisma.securityIncident.findFirst({ where: { id: refs.incidentId, organizationId }, select: { id: true } }), "El incidente no pertenece a la organización.");
  await Promise.all(checks);
}

// ─── BIA ─────────────────────────────────────────────

export async function createBia(input: unknown) {
  const data = parseInput(biaSchema, input);
  assertDateOrder(data.performedAt, data.nextReviewDate);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  await ensureRefs(organizationId, { evidenceId: data.evidenceId });
  const result = await prisma.$transaction(async (tx) => {
    const dup = await tx.businessImpactAnalysis.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un BIA con el código ${data.code}.`);
    const bia = await tx.businessImpactAnalysis.create({
      data: {
        organizationId, code: data.code, title: data.title, scope: data.scope ?? null,
        methodology: data.methodology ?? null, version: data.version, ownerId: data.ownerId ?? null,
        evidenceId: data.evidenceId ?? null,
        performedAt: toDate(data.performedAt), nextReviewDate: toDate(data.nextReviewDate),
        createdById: ctx.user.id,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: bia.id, after: { code: bia.code, version: bia.version }, extra: { event: "create_bia" } });
    return bia;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateBia(input: unknown) {
  const data = parseInput(biaUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  await ensureRefs(organizationId, { evidenceId: data.evidenceId });
  await prisma.$transaction(async (tx) => {
    const before = await tx.businessImpactAnalysis.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("BIA no encontrado.");
    if (before.status === "APPROVED") throw new Error("El BIA aprobado está congelado; crea una nueva versión para modificarlo.");
    const performedAt = data.performedAt !== undefined ? data.performedAt : dateValue(before.performedAt);
    const nextReviewDate = data.nextReviewDate !== undefined ? data.nextReviewDate : dateValue(before.nextReviewDate);
    assertDateOrder(performedAt, nextReviewDate);
    if (data.code !== undefined) {
      const duplicate = await tx.businessImpactAnalysis.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un BIA con el código ${data.code}.`);
    }
    await tx.businessImpactAnalysis.update({
      where: { id: before.id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.scope !== undefined ? { scope: data.scope ?? null } : {}),
        ...(data.methodology !== undefined ? { methodology: data.methodology ?? null } : {}),
        ...(data.version !== undefined ? { version: data.version } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId ?? null } : {}),
        ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId ?? null } : {}),
        ...(data.performedAt !== undefined ? { performedAt: toDate(data.performedAt) } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: toDate(data.nextReviewDate) } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, before: { code: before.code, version: before.version }, after: { code: data.code ?? before.code, version: data.version ?? before.version }, extra: { event: "update_bia" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

/** Aprueba el BIA: queda congelado como línea base para las estrategias. */
export async function approveBia(input: unknown) {
  const data = parseInput(planApprovalSchema, input);
  const ctx = await requirePermission("continuity:approve");
  const organizationId = ctx.organization.id;
  await prisma.$transaction(async (tx) => {
    const bia = await tx.businessImpactAnalysis.findFirst({ where: { id: data.id, organizationId } });
    if (!bia) throw new Error("BIA no encontrado.");
    if (bia.status === "APPROVED") throw new Error("El BIA ya está aprobado.");
    await tx.businessImpactAnalysis.update({
      where: { id: bia.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), ...(data.version ? { version: data.version } : {}) },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: "bcm", recordId: bia.id, before: { status: bia.status }, after: { status: "APPROVED" }, extra: { event: "approve_bia" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Actividades críticas ────────────────────────────

/** Recalcula impacto, criticidad y prioridad de todas las actividades del BIA. */
async function rescoreActivities(tx: Prisma.TransactionClient, organizationId: string, biaId: string) {
  const rows = await tx.criticalActivity.findMany({ where: { organizationId, biaId } });
  const scored = rows.map((a) => ({
    id: a.id,
    impactScore: impactScore(a),
    mtpdMinutes: a.mtpdMinutes,
  }));
  const priorities = new Map(recoveryPriority(scored).map((p) => [p.id, p.priority]));
  for (const row of scored) {
    await tx.criticalActivity.update({
      where: { id: row.id },
      data: {
        impactScore: row.impactScore,
        criticality: criticalityFor(row.impactScore, row.mtpdMinutes),
        priority: priorities.get(row.id) ?? 0,
      },
    });
  }
}

export async function createCriticalActivity(input: unknown) {
  const data = parseInput(criticalActivitySchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  assertRtoWithinMtpd(data.rtoMinutes, data.mtpdMinutes);
  assertRecoveryWindow(data.rtoMinutes, data.rpoMinutes);
  await ensureMember(organizationId, data.ownerId);
  await ensureRefs(organizationId, { processId: data.processId });
  const result = await prisma.$transaction(async (tx) => {
    const bia = await tx.businessImpactAnalysis.findFirst({ where: { id: data.biaId, organizationId }, select: { id: true } });
    if (!bia) throw new Error("BIA no encontrado.");
    const dup = await tx.criticalActivity.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe una actividad con el código ${data.code}.`);
    const activity = await tx.criticalActivity.create({
      data: {
        organizationId, biaId: data.biaId, code: data.code, name: data.name,
        description: data.description ?? null, processId: data.processId ?? null, ownerId: data.ownerId ?? null,
        mtpdMinutes: data.mtpdMinutes ?? null, rtoMinutes: data.rtoMinutes ?? null, rpoMinutes: data.rpoMinutes ?? null,
        minimumServiceLevel: data.minimumServiceLevel ?? null,
        financialImpact: data.financialImpact, operationalImpact: data.operationalImpact,
        legalImpact: data.legalImpact, reputationalImpact: data.reputationalImpact, peopleImpact: data.peopleImpact,
        peakPeriods: data.peakPeriods ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
      },
    });
    await rescoreActivities(tx, organizationId, data.biaId);
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: activity.id, after: { code: activity.code }, extra: { event: "create_critical_activity" } });
    return activity;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateCriticalActivity(input: unknown) {
  const data = parseInput(criticalActivityUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  await ensureRefs(organizationId, { processId: data.processId });
  await prisma.$transaction(async (tx) => {
    const before = await tx.criticalActivity.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Actividad crítica no encontrada.");
    const mtpd = data.mtpdMinutes !== undefined ? data.mtpdMinutes : before.mtpdMinutes;
    const rto = data.rtoMinutes !== undefined ? data.rtoMinutes : before.rtoMinutes;
    const rpo = data.rpoMinutes !== undefined ? data.rpoMinutes : before.rpoMinutes;
    assertRtoWithinMtpd(rto, mtpd);
    assertRecoveryWindow(rto, rpo);
    await tx.criticalActivity.update({
      where: { id: before.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.processId !== undefined ? { processId: data.processId ?? null } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId ?? null } : {}),
        ...(data.mtpdMinutes !== undefined ? { mtpdMinutes: data.mtpdMinutes ?? null } : {}),
        ...(data.rtoMinutes !== undefined ? { rtoMinutes: data.rtoMinutes ?? null } : {}),
        ...(data.rpoMinutes !== undefined ? { rpoMinutes: data.rpoMinutes ?? null } : {}),
        ...(data.minimumServiceLevel !== undefined ? { minimumServiceLevel: data.minimumServiceLevel ?? null } : {}),
        ...(data.financialImpact !== undefined ? { financialImpact: data.financialImpact } : {}),
        ...(data.operationalImpact !== undefined ? { operationalImpact: data.operationalImpact } : {}),
        ...(data.legalImpact !== undefined ? { legalImpact: data.legalImpact } : {}),
        ...(data.reputationalImpact !== undefined ? { reputationalImpact: data.reputationalImpact } : {}),
        ...(data.peopleImpact !== undefined ? { peopleImpact: data.peopleImpact } : {}),
        ...(data.peakPeriods !== undefined ? { peakPeriods: data.peakPeriods ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      },
    });
    await rescoreActivities(tx, organizationId, before.biaId);
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_critical_activity" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function createProductPriority(input: unknown) {
  const data = parseInput(productPrioritySchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  assertRtoWithinMtpd(data.rtoMinutes, data.mtpdMinutes);
  const result = await prisma.$transaction(async (tx) => {
    const bia = await tx.businessImpactAnalysis.findFirst({ where: { id: data.biaId, organizationId }, select: { id: true } });
    if (!bia) throw new Error("BIA no encontrado.");
    const dup = await tx.productServicePriority.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un producto/servicio con el código ${data.code}.`);
    const count = await tx.productServicePriority.count({ where: { organizationId, biaId: data.biaId } });
    const row = await tx.productServicePriority.create({
      data: {
        organizationId, biaId: data.biaId, code: data.code, name: data.name,
        description: data.description ?? null, criticality: data.criticality, priority: count + 1,
        mtpdMinutes: data.mtpdMinutes ?? null, rtoMinutes: data.rtoMinutes ?? null,
        minimumServiceLevel: data.minimumServiceLevel ?? null, revenueShare: data.revenueShare ?? null,
        customersAffected: data.customersAffected ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { code: row.code }, extra: { event: "create_product_priority" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateProductPriority(input: unknown) {
  const data = parseInput(productPriorityUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const existing = await prisma.productServicePriority.findFirst({ where: { id: data.id, organizationId } });
  if (!existing) throw new Error("Producto o servicio prioritario no encontrado.");
  const mtpd = data.mtpdMinutes !== undefined ? data.mtpdMinutes : existing.mtpdMinutes;
  const rto = data.rtoMinutes !== undefined ? data.rtoMinutes : existing.rtoMinutes;
  assertRtoWithinMtpd(rto, mtpd);
  await prisma.$transaction(async (tx) => {
    if (data.biaId !== undefined) {
      const bia = await tx.businessImpactAnalysis.findFirst({ where: { id: data.biaId, organizationId }, select: { id: true } });
      if (!bia) throw new Error("BIA no encontrado.");
    }
    if (data.code !== undefined) {
      const duplicate = await tx.productServicePriority.findFirst({ where: { organizationId, code: data.code, NOT: { id: existing.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un producto/servicio con el código ${data.code}.`);
    }
    await tx.productServicePriority.update({ where: { id: existing.id }, data: {
      ...(data.biaId !== undefined ? { biaId: data.biaId } : {}), ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.criticality !== undefined ? { criticality: data.criticality } : {}), ...(data.mtpdMinutes !== undefined ? { mtpdMinutes: data.mtpdMinutes ?? null } : {}),
      ...(data.rtoMinutes !== undefined ? { rtoMinutes: data.rtoMinutes ?? null } : {}), ...(data.minimumServiceLevel !== undefined ? { minimumServiceLevel: data.minimumServiceLevel ?? null } : {}),
      ...(data.revenueShare !== undefined ? { revenueShare: data.revenueShare ?? null } : {}), ...(data.customersAffected !== undefined ? { customersAffected: data.customersAffected ?? null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: existing.id, extra: { event: "update_product_priority" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Dependencias y recursos ─────────────────────────

export async function addDependency(input: unknown) {
  const data = parseInput(dependencySchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { processId: data.processId, assetId: data.assetId, supplierId: data.supplierId, personnelId: data.personnelId, locationId: data.locationId });
  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
    const row = await tx.businessDependency.create({
      data: {
        organizationId, activityId: data.activityId, type: data.type, name: data.name,
        description: data.description ?? null, processId: data.processId ?? null, assetId: data.assetId ?? null,
        supplierId: data.supplierId ?? null, personnelId: data.personnelId ?? null, locationId: data.locationId ?? null,
        criticality: data.criticality, maxOutageMinutes: data.maxOutageMinutes ?? null,
        alternative: data.alternative ?? null, singlePointOfFailure: data.singlePointOfFailure, notes: data.notes ?? null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { type: row.type, name: row.name, spof: row.singlePointOfFailure }, extra: { event: "add_dependency" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateDependency(input: unknown) {
  const data = parseInput(dependencyUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { processId: data.processId, assetId: data.assetId, supplierId: data.supplierId, personnelId: data.personnelId, locationId: data.locationId });
  const before = await prisma.businessDependency.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Dependencia no encontrada.");
  if (data.activityId !== undefined) {
    const activity = await prisma.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.businessDependency.update({ where: { id: before.id }, data: {
      ...(data.activityId !== undefined ? { activityId: data.activityId } : {}), ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.processId !== undefined ? { processId: data.processId ?? null } : {}), ...(data.assetId !== undefined ? { assetId: data.assetId ?? null } : {}),
      ...(data.supplierId !== undefined ? { supplierId: data.supplierId ?? null } : {}), ...(data.personnelId !== undefined ? { personnelId: data.personnelId ?? null } : {}),
      ...(data.locationId !== undefined ? { locationId: data.locationId ?? null } : {}), ...(data.criticality !== undefined ? { criticality: data.criticality } : {}),
      ...(data.maxOutageMinutes !== undefined ? { maxOutageMinutes: data.maxOutageMinutes ?? null } : {}), ...(data.alternative !== undefined ? { alternative: data.alternative ?? null } : {}),
      ...(data.singlePointOfFailure !== undefined ? { singlePointOfFailure: data.singlePointOfFailure } : {}), ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, before: { name: before.name, spof: before.singlePointOfFailure }, after: { name: data.name ?? before.name, spof: data.singlePointOfFailure ?? before.singlePointOfFailure }, extra: { event: "update_dependency" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function addResourceRequirement(input: unknown) {
  const data = parseInput(resourceSchema, input);
  assertResourceQuantities(data.normalQuantity, data.minimumQuantity);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { supplierId: data.supplierId, assetId: data.assetId });
  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
    const row = await tx.resourceRequirement.create({
      data: {
        organizationId, activityId: data.activityId, type: data.type, name: data.name,
        description: data.description ?? null, normalQuantity: data.normalQuantity ?? null,
        minimumQuantity: data.minimumQuantity ?? null, unit: data.unit ?? null, availableAt: data.availableAt ?? null,
        alternativeResource: data.alternativeResource ?? null, leadTimeMinutes: data.leadTimeMinutes ?? null,
        supplierId: data.supplierId ?? null, assetId: data.assetId ?? null, notes: data.notes ?? null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { type: row.type, name: row.name }, extra: { event: "add_resource_requirement" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateResourceRequirement(input: unknown) {
  const data = parseInput(resourceUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { supplierId: data.supplierId, assetId: data.assetId });
  const before = await prisma.resourceRequirement.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Recurso mínimo no encontrado.");
  assertResourceQuantities(
    data.normalQuantity !== undefined ? data.normalQuantity : before.normalQuantity,
    data.minimumQuantity !== undefined ? data.minimumQuantity : before.minimumQuantity,
  );
  if (data.activityId !== undefined) {
    const activity = await prisma.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.resourceRequirement.update({ where: { id: before.id }, data: {
      ...(data.activityId !== undefined ? { activityId: data.activityId } : {}), ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.normalQuantity !== undefined ? { normalQuantity: data.normalQuantity ?? null } : {}), ...(data.minimumQuantity !== undefined ? { minimumQuantity: data.minimumQuantity ?? null } : {}),
      ...(data.unit !== undefined ? { unit: data.unit ?? null } : {}), ...(data.availableAt !== undefined ? { availableAt: data.availableAt ?? null } : {}),
      ...(data.alternativeResource !== undefined ? { alternativeResource: data.alternativeResource ?? null } : {}), ...(data.leadTimeMinutes !== undefined ? { leadTimeMinutes: data.leadTimeMinutes ?? null } : {}),
      ...(data.supplierId !== undefined ? { supplierId: data.supplierId ?? null } : {}), ...(data.assetId !== undefined ? { assetId: data.assetId ?? null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_resource_requirement" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Estrategias ─────────────────────────────────────

export async function createStrategy(input: unknown) {
  const data = parseInput(strategySchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  const result = await prisma.$transaction(async (tx) => {
    if (data.activityId) {
      const a = await tx.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
      if (!a) throw new Error("Actividad crítica no encontrada.");
    }
    if (data.planId) {
      const p = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
      if (!p) throw new Error("Plan no encontrado.");
    }
    const dup = await tx.continuityStrategy.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe una estrategia con el código ${data.code}.`);
    const row = await tx.continuityStrategy.create({
      data: {
        organizationId, code: data.code, title: data.title, activityId: data.activityId ?? null,
        planId: data.planId ?? null, type: data.type, description: data.description ?? null,
        achievesRtoMinutes: data.achievesRtoMinutes ?? null, achievesRpoMinutes: data.achievesRpoMinutes ?? null,
        cost: data.cost ?? null, ownerId: data.ownerId ?? null, resourcesNeeded: data.resourcesNeeded ?? null,
        notes: data.notes ?? null, createdById: ctx.user.id,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { code: row.code, type: row.type }, extra: { event: "create_strategy" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateStrategy(input: unknown) {
  const data = parseInput(strategyUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.ownerId);
  const before = await prisma.continuityStrategy.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Estrategia no encontrada.");
  if (data.activityId) {
    const activity = await prisma.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
  }
  if (data.planId) {
    const plan = await prisma.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
    if (!plan) throw new Error("Plan no encontrado.");
  }
  await prisma.$transaction(async (tx) => {
    if (data.code !== undefined) {
      const duplicate = await tx.continuityStrategy.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe una estrategia con el código ${data.code}.`);
    }
    await tx.continuityStrategy.update({ where: { id: before.id }, data: {
      ...(data.code !== undefined ? { code: data.code } : {}), ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.activityId !== undefined ? { activityId: data.activityId ?? null } : {}), ...(data.planId !== undefined ? { planId: data.planId ?? null } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}), ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.achievesRtoMinutes !== undefined ? { achievesRtoMinutes: data.achievesRtoMinutes ?? null } : {}), ...(data.achievesRpoMinutes !== undefined ? { achievesRpoMinutes: data.achievesRpoMinutes ?? null } : {}),
      ...(data.cost !== undefined ? { cost: data.cost ?? null } : {}), ...(data.ownerId !== undefined ? { ownerId: data.ownerId ?? null } : {}),
      ...(data.resourcesNeeded !== undefined ? { resourcesNeeded: data.resourcesNeeded ?? null } : {}), ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_strategy" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function setStrategyStatus(input: unknown) {
  const data = parseInput(strategyStatusSchema, input);
  const ctx = await requirePermission(data.status === "APPROVED" ? "continuity:approve" : "continuity:update");
  const organizationId = ctx.organization.id;
  await prisma.$transaction(async (tx) => {
    const before = await tx.continuityStrategy.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Estrategia no encontrada.");
    await tx.continuityStrategy.update({
      where: { id: before.id },
      data: { status: data.status, ...(data.status === "APPROVED" ? { approvedById: ctx.user.id, approvedAt: new Date() } : {}) },
    });
    await writeAuditLog(tx, { ctx, action: data.status === "APPROVED" ? "approve" : "update", module: "bcm", recordId: before.id, before: { status: before.status }, after: { status: data.status }, extra: { event: "set_strategy_status" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Procedimientos de recuperación ──────────────────

export async function createRecoveryProcedure(input: unknown) {
  const data = parseInput(recoveryProcedureSchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  await ensureRefs(organizationId, { documentId: data.documentId });
  const result = await prisma.$transaction(async (tx) => {
    if (data.planId) {
      const p = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
      if (!p) throw new Error("Plan no encontrado.");
    }
    if (data.activityId) {
      const a = await tx.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
      if (!a) throw new Error("Actividad crítica no encontrada.");
    }
    const dup = await tx.recoveryProcedure.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un procedimiento con el código ${data.code}.`);
    const row = await tx.recoveryProcedure.create({
      data: {
        organizationId, code: data.code, title: data.title, planId: data.planId ?? null,
        activityId: data.activityId ?? null, objective: data.objective ?? null, steps: data.steps ?? null,
        documentId: data.documentId ?? null, responsibleId: data.responsibleId ?? null,
        estimatedMinutes: data.estimatedMinutes ?? null, prerequisites: data.prerequisites ?? null,
        order: data.order, version: data.version, createdById: ctx.user.id,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { code: row.code }, extra: { event: "create_recovery_procedure" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateRecoveryProcedure(input: unknown) {
  const data = parseInput(recoveryProcedureUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  await ensureRefs(organizationId, { documentId: data.documentId });
  const before = await prisma.recoveryProcedure.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Procedimiento de recuperación no encontrado.");
  if (data.planId) {
    const plan = await prisma.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
    if (!plan) throw new Error("Plan no encontrado.");
  }
  if (data.activityId) {
    const activity = await prisma.criticalActivity.findFirst({ where: { id: data.activityId, organizationId }, select: { id: true } });
    if (!activity) throw new Error("Actividad crítica no encontrada.");
  }
  await prisma.$transaction(async (tx) => {
    if (data.code !== undefined) {
      const duplicate = await tx.recoveryProcedure.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un procedimiento con el código ${data.code}.`);
    }
    await tx.recoveryProcedure.update({ where: { id: before.id }, data: {
      ...(data.code !== undefined ? { code: data.code } : {}), ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.planId !== undefined ? { planId: data.planId ?? null } : {}), ...(data.activityId !== undefined ? { activityId: data.activityId ?? null } : {}),
      ...(data.objective !== undefined ? { objective: data.objective ?? null } : {}), ...(data.steps !== undefined ? { steps: data.steps ?? null } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId ?? null } : {}), ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId ?? null } : {}),
      ...(data.estimatedMinutes !== undefined ? { estimatedMinutes: data.estimatedMinutes ?? null } : {}), ...(data.prerequisites !== undefined ? { prerequisites: data.prerequisites ?? null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}), ...(data.version !== undefined ? { version: data.version } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_recovery_procedure" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Equipos de crisis y comunicación ────────────────

export async function createCrisisTeam(input: unknown) {
  const data = parseInput(crisisTeamSchema, input);
  const ctx = await requirePermission("continuity:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.leaderId);
  await ensureMember(organizationId, data.deputyId);
  const result = await prisma.$transaction(async (tx) => {
    if (data.planId) {
      const p = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
      if (!p) throw new Error("Plan no encontrado.");
    }
    const dup = await tx.crisisTeam.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un equipo con el código ${data.code}.`);
    const row = await tx.crisisTeam.create({
      data: {
        organizationId, code: data.code, name: data.name, purpose: data.purpose ?? null,
        planId: data.planId ?? null, leaderId: data.leaderId ?? null, deputyId: data.deputyId ?? null,
        activationRule: data.activationRule ?? null, meetingPoint: data.meetingPoint ?? null, createdById: ctx.user.id,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { code: row.code }, extra: { event: "create_crisis_team" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateCrisisTeam(input: unknown) {
  const data = parseInput(crisisTeamUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.leaderId);
  await ensureMember(organizationId, data.deputyId);
  const before = await prisma.crisisTeam.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Equipo de crisis no encontrado.");
  if (data.planId) {
    const plan = await prisma.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId }, select: { id: true } });
    if (!plan) throw new Error("Plan no encontrado.");
  }
  await prisma.$transaction(async (tx) => {
    if (data.code !== undefined) {
      const duplicate = await tx.crisisTeam.findFirst({ where: { organizationId, code: data.code, NOT: { id: before.id } }, select: { id: true } });
      if (duplicate) throw new Error(`Ya existe un equipo con el código ${data.code}.`);
    }
    await tx.crisisTeam.update({ where: { id: before.id }, data: {
      ...(data.code !== undefined ? { code: data.code } : {}), ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.purpose !== undefined ? { purpose: data.purpose ?? null } : {}), ...(data.planId !== undefined ? { planId: data.planId ?? null } : {}),
      ...(data.leaderId !== undefined ? { leaderId: data.leaderId ?? null } : {}), ...(data.deputyId !== undefined ? { deputyId: data.deputyId ?? null } : {}),
      ...(data.activationRule !== undefined ? { activationRule: data.activationRule ?? null } : {}), ...(data.meetingPoint !== undefined ? { meetingPoint: data.meetingPoint ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_crisis_team" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function addCrisisContact(input: unknown) {
  const data = parseInput(crisisContactSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.userId);
  await ensureRefs(organizationId, { personnelId: data.personnelId, supplierId: data.supplierId });
  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.crisisTeam.findFirst({ where: { id: data.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Equipo de crisis no encontrado.");
    const row = await tx.crisisContact.create({
      data: {
        organizationId, teamId: data.teamId, name: data.name, role: data.role ?? null, type: data.type,
        userId: data.userId ?? null, personnelId: data.personnelId ?? null, supplierId: data.supplierId ?? null,
        primaryPhone: data.primaryPhone ?? null, altPhone: data.altPhone ?? null, email: data.email ?? null,
        escalationOrder: data.escalationOrder, isDeputy: data.isDeputy, availability: data.availability ?? null,
        notes: data.notes ?? null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { name: row.name, type: row.type }, extra: { event: "add_crisis_contact" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateCrisisContact(input: unknown) {
  const data = parseInput(crisisContactUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.userId);
  await ensureRefs(organizationId, { personnelId: data.personnelId, supplierId: data.supplierId });
  const before = await prisma.crisisContact.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Contacto de crisis no encontrado.");
  if (data.teamId) {
    const team = await prisma.crisisTeam.findFirst({ where: { id: data.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Equipo de crisis no encontrado.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.crisisContact.update({ where: { id: before.id }, data: {
      ...(data.teamId !== undefined ? { teamId: data.teamId } : {}), ...(data.name !== undefined ? { name: data.name } : {}), ...(data.role !== undefined ? { role: data.role ?? null } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}), ...(data.userId !== undefined ? { userId: data.userId ?? null } : {}),
      ...(data.personnelId !== undefined ? { personnelId: data.personnelId ?? null } : {}), ...(data.supplierId !== undefined ? { supplierId: data.supplierId ?? null } : {}),
      ...(data.primaryPhone !== undefined ? { primaryPhone: data.primaryPhone ?? null } : {}), ...(data.altPhone !== undefined ? { altPhone: data.altPhone ?? null } : {}),
      ...(data.email !== undefined ? { email: data.email ?? null } : {}), ...(data.escalationOrder !== undefined ? { escalationOrder: data.escalationOrder } : {}),
      ...(data.isDeputy !== undefined ? { isDeputy: data.isDeputy } : {}), ...(data.availability !== undefined ? { availability: data.availability ?? null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_crisis_contact" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

export async function addCommunicationNode(input: unknown) {
  const data = parseInput(communicationNodeSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.crisisTeam.findFirst({ where: { id: data.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Equipo de crisis no encontrado.");
    if (data.contactId) {
      const c = await tx.crisisContact.findFirst({ where: { id: data.contactId, organizationId, teamId: data.teamId }, select: { id: true } });
      if (!c) throw new Error("El contacto no pertenece a este equipo.");
    }
    if (data.parentId) {
      const p = await tx.communicationTree.findFirst({ where: { id: data.parentId, organizationId, teamId: data.teamId }, select: { id: true } });
      if (!p) throw new Error("El nodo padre no pertenece a este árbol.");
    }
    const row = await tx.communicationTree.create({
      data: {
        organizationId, teamId: data.teamId, contactId: data.contactId ?? null, parentId: data.parentId ?? null,
        label: data.label, audience: data.audience ?? null, channel: data.channel ?? null,
        messageTemplate: data.messageTemplate ?? null, order: data.order, maxDelayMinutes: data.maxDelayMinutes ?? null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, after: { label: row.label }, extra: { event: "add_communication_node" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateCommunicationNode(input: unknown) {
  const data = parseInput(communicationNodeUpdateSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  const before = await prisma.communicationTree.findFirst({ where: { id: data.id, organizationId } });
  if (!before) throw new Error("Nodo de comunicación no encontrado.");
  const teamId = data.teamId ?? before.teamId;
  if (data.teamId) {
    const team = await prisma.crisisTeam.findFirst({ where: { id: data.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Equipo de crisis no encontrado.");
  }
  if (data.contactId) {
    const contact = await prisma.crisisContact.findFirst({ where: { id: data.contactId, organizationId, teamId }, select: { id: true } });
    if (!contact) throw new Error("El contacto no pertenece a este equipo.");
  }
  if (data.parentId) {
    if (data.parentId === before.id) throw new Error("Un nodo no puede ser su propio padre.");
    const parent = await prisma.communicationTree.findFirst({ where: { id: data.parentId, organizationId, teamId }, select: { id: true } });
    if (!parent) throw new Error("El nodo padre no pertenece a este árbol.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.communicationTree.update({ where: { id: before.id }, data: {
      ...(data.teamId !== undefined ? { teamId: data.teamId } : {}), ...(data.contactId !== undefined ? { contactId: data.contactId ?? null } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId ?? null } : {}), ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.audience !== undefined ? { audience: data.audience ?? null } : {}), ...(data.channel !== undefined ? { channel: data.channel ?? null } : {}),
      ...(data.messageTemplate !== undefined ? { messageTemplate: data.messageTemplate ?? null } : {}), ...(data.order !== undefined ? { order: data.order } : {}),
      ...(data.maxDelayMinutes !== undefined ? { maxDelayMinutes: data.maxDelayMinutes ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: before.id, extra: { event: "update_communication_node" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

// ─── Versionado, aprobación y ACTIVACIÓN del plan ────

export async function createPlanVersion(input: unknown) {
  const data = parseInput(planVersionSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { evidenceId: data.evidenceId });
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId } });
    if (!plan) throw new Error("Plan no encontrado.");
    const dup = await tx.continuityPlanVersion.findFirst({ where: { planId: plan.id, version: data.version } });
    if (dup) throw new Error(`La versión ${data.version} ya existe para este plan.`);
    const row = await tx.continuityPlanVersion.create({
      data: {
        organizationId, planId: plan.id, version: data.version, changeSummary: data.changeSummary ?? null,
        content: data.content ?? null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      },
    });
    // La versión vigente del plan pasa a ser la recién creada (vuelve a borrador).
    await tx.businessContinuityPlan.update({ where: { id: plan.id }, data: { version: data.version, status: "DRAFT", approvedById: null, approvedAt: null } });
    await writeAuditLog(tx, { ctx, action: "create", module: "bcm", recordId: row.id, before: { version: plan.version }, after: { version: data.version }, extra: { event: "create_plan_version" } });
    return row;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function approvePlan(input: unknown) {
  const data = parseInput(planApprovalSchema, input);
  const ctx = await requirePermission("continuity:approve");
  const organizationId = ctx.organization.id;
  await prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.findFirst({ where: { id: data.id, organizationId } });
    if (!plan) throw new Error("Plan no encontrado.");
    await tx.businessContinuityPlan.update({
      where: { id: plan.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), reviewDate: new Date(), ...(data.version ? { version: data.version } : {}) },
    });
    await tx.continuityPlanVersion.updateMany({
      where: { planId: plan.id, version: data.version ?? plan.version },
      data: { approvedById: ctx.user.id, approvedAt: new Date() },
    });
    await writeAuditLog(tx, { ctx, action: "approve", module: "bcm", recordId: plan.id, before: { status: plan.status }, after: { status: "APPROVED", version: data.version ?? plan.version }, extra: { event: "approve_plan" } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}

/** Activa el plan ante una interrupción real. Solo planes aprobados. */
export async function activatePlan(input: unknown) {
  const data = parseInput(planActivationSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { incidentId: data.incidentId });
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.findFirst({ where: { id: data.planId, organizationId } });
    if (!plan) throw new Error("Plan no encontrado.");
    if (plan.status !== "APPROVED") throw new Error("Solo se puede activar un plan aprobado.");
    if (plan.activated) throw new Error("El plan ya está activado.");
    if (data.scenarioId) {
      const s = await tx.continuityScenario.findFirst({ where: { id: data.scenarioId, organizationId, planId: plan.id }, select: { id: true } });
      if (!s) throw new Error("El escenario no pertenece a este plan.");
    }
    const activation = await tx.planActivation.create({
      data: {
        organizationId, planId: plan.id, reason: data.reason, scenarioId: data.scenarioId ?? null,
        incidentId: data.incidentId ?? null, activatedById: ctx.user.id,
      },
    });
    await tx.businessContinuityPlan.update({
      where: { id: plan.id },
      data: { activated: true, activatedAt: new Date(), activatedById: ctx.user.id, activationReason: data.reason, deactivatedAt: null },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: plan.id, after: { activated: true, reason: data.reason }, extra: { event: "activate_plan", activationId: activation.id } });
    return activation;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

/** Cierra la activación registrando resultado y lecciones aprendidas. */
export async function deactivatePlan(input: unknown) {
  const data = parseInput(planDeactivationSchema, input);
  const ctx = await requirePermission("continuity:update");
  const organizationId = ctx.organization.id;
  await ensureRefs(organizationId, { evidenceId: data.evidenceId });
  await prisma.$transaction(async (tx) => {
    const activation = await tx.planActivation.findFirst({ where: { id: data.id, organizationId, deactivatedAt: null } });
    if (!activation) throw new Error("Activación no encontrada o ya cerrada.");
    await tx.planActivation.update({
      where: { id: activation.id },
      data: { deactivatedAt: new Date(), outcome: data.outcome ?? null, lessonsLearned: data.lessonsLearned ?? null, evidenceId: data.evidenceId ?? null },
    });
    await tx.businessContinuityPlan.update({ where: { id: activation.planId }, data: { activated: false, deactivatedAt: new Date() } });
    await writeAuditLog(tx, { ctx, action: "update", module: "bcm", recordId: activation.planId, after: { activated: false }, extra: { event: "deactivate_plan", activationId: activation.id } });
  });
  revalidatePath(PATH);
  return { id: data.id };
}
