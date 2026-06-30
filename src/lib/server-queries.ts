import "server-only";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization, requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { isPlanCheckoutConfigured, isStripeConfigured, PLANS } from "@/lib/stripe";

export async function getDashboardPayload() {
  const ctx = await requirePermission("dashboard:read");
  const organizationId = ctx.organization.id;
  const currentUserId = ctx.user.id;
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
    trainingAssignments,
    recentActivity,
    auditEventCount,
    locations,
    documentsReviewDueSoon,
    unreadNotifications,
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
    prisma.trainingAssignment.findMany({
      where: { organizationId },
      select: { status: true, dueAt: true, completedAt: true, course: { select: { defaultValidityMonths: true } } },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.location.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
    prisma.document.count({
      where: {
        organizationId,
        status: "APPROVED",
        reviewDate: { gte: now, lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.notification.count({ where: { organizationId, userId: currentUserId, read: false } }),
  ]);

  const scores = orgStandards.map(o => o.score).filter((s): s is number => s != null);
  const iso9001 = orgStandards.find(o => o.standard.code === "ISO_9001");
  const iso27001 = orgStandards.find(o => o.standard.code === "ISO_27001");
  const globalPct =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const overdueCritical = actions.filter(
    a =>
      a.status !== "COMPLETED" &&
      a.priority === "CRITICAL" &&
      a.dueDate &&
      a.dueDate < now
  ).length;

  const pendingActions = actions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length;

  const criticalRisks = risks.filter(r => r.score >= 15).length;

  const trainingNeedsRenewal = (assignment: (typeof trainingAssignments)[number]) => {
    if (assignment.status !== "COMPLETED" || !assignment.completedAt) return false;
    const expiresAt = new Date(assignment.completedAt);
    expiresAt.setMonth(expiresAt.getMonth() + assignment.course.defaultValidityMonths);
    return expiresAt < now;
  };
  const trainingDone = trainingAssignments.filter(
    (assignment) => assignment.status === "COMPLETED" && !trainingNeedsRenewal(assignment),
  ).length;
  const trainingOverdue = trainingAssignments.filter(
    (assignment) =>
      assignment.status === "OVERDUE" ||
      assignment.status === "RETRAINING_REQUIRED" ||
      trainingNeedsRenewal(assignment) ||
      (assignment.dueAt < now && assignment.status !== "COMPLETED" && assignment.status !== "CANCELLED"),
  ).length;

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
    iso9001Pct: iso9001?.score != null ? Math.round(iso9001.score) : null,
    iso27001Pct: iso27001?.score != null ? Math.round(iso27001.score) : null,
    overdueCritical,
    pendingActions,
    criticalRisks,
    documentsInReview,
    auditsUpcoming,
    openNcs,
    trainingTotal: trainingAssignments.length,
    trainingDone,
    trainingOverdue,
    unreadNotifications,
    auditEventCount,
    documentsReviewDueSoon,
    indicatorRows,
    locations,
    recentActivity: recentActivity.map(event => ({
      user: event.user?.name ?? "Sistema",
      action: event.action.replaceAll("_", " "),
      object: `${event.module}${event.recordId ? ` · ${event.recordId}` : ""}`,
      time: event.createdAt.toISOString(),
    })),
    upcomingActions: actions
      .filter(action => action.status !== "COMPLETED" && action.status !== "CANCELLED" && action.dueDate)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .slice(0, 4)
      .map(action => {
        const parsed = /^(ACPM-\d{4}-\d{3})\s*·\s*(.+)$/.exec(action.title);
        return {
          id: action.id,
          code: parsed?.[1] ?? "ACPM",
          title: parsed?.[2] ?? action.title,
          due: action.dueDate!.toISOString().slice(0, 10),
        };
      }),
    recentAudits: recentAudits.map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      scheduledDate: a.scheduledDate?.toISOString() ?? null,
    })),
  };
}

export async function getGapPayload() {
  const ctx = await requirePermission("gap:read");
  const organizationId = ctx.organization.id;
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
    // The unique [assessmentId, clauseId] constraint (and unique clause.code per
    // standard) means one answer per clause — each answer maps to one editable row.
    return assessment.answers
      .map(ans => {
        let status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" = "PARTIALLY_COMPLIANT";
        if (ans.status === "COMPLIANT") status = "COMPLIANT";
        else if (ans.status === "NON_COMPLIANT") status = "NON_COMPLIANT";
        return {
          clause: ans.clause.code,
          title: ans.clause.title,
          score: ans.score,
          questions: 1,
          answered: ans.status === "NOT_EVALUATED" ? 0 : 1,
          status,
          // Editable fields consumed by the live GAP editor:
          answerId: ans.id,
          clauseId: ans.clauseId,
          clauseStatus: ans.status,
          comment: ans.comment,
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

// ─── Documents ─────────────────────────────────────────────────────────

export async function getDocumentsPayload() {
  const authorization = await requireAuthorization("documents:read");
  const { ctx, can } = authorization;
  const organizationId = ctx.organization.id;
  const canCreate = can("documents:create");
  const canReadProcesses = can("processes:read");
  const [documents, locations, personnel, members, processes, clauses, standards] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: { orderBy: { createdAt: "asc" } },
        location: true,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.location.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.personnel.findMany({
      where: { organizationId, active: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
    }),
    canReadProcesses ? prisma.process.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }) : Promise.resolve([]),
    prisma.clause.findMany({
      where: { standard: { orgStandards: { some: { organizationId } } } },
      select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } },
      orderBy: [{ standard: { code: "asc" } }, { order: "asc" }],
    }),
    prisma.organizationStandard.findMany({
      where: { organizationId },
      select: { standard: { select: { code: true, name: true } } },
      orderBy: { standard: { code: "asc" } },
    }),
  ]);
  const memberNames = new Map(members.map((membership) => [membership.userId, membership.user.name]));
  const processNames = new Map(processes.map((process) => [process.id, process]));
  const clauseNames = new Map(clauses.map((clause) => [clause.id, clause]));
  // Supersede maps: id → {code,title} of the replacement, and reverse (what each doc replaces).
  const docMeta = new Map(documents.map((d) => [d.id, { code: d.code, title: d.title }]));
  const supersedesOf = new Map(
    documents.filter((d) => d.supersededById).map((d) => [d.supersededById as string, { id: d.id, code: d.code, title: d.title }]),
  );

  return {
    access: {
      canCreate,
      canApprove: can("documents:*"),
    },
    documents: documents.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      type: d.type,
      status: d.status,
      currentVersion: d.currentVersion,
      isExternal: d.isExternal,
      externalLink: d.externalLink,
      ownerId: d.ownerId,
      ownerName: d.ownerId ? memberNames.get(d.ownerId) ?? null : null,
      processId: canReadProcesses ? d.processId : null,
      processCode: d.processId ? processNames.get(d.processId)?.code ?? null : null,
      processName: d.processId ? processNames.get(d.processId)?.name ?? null : null,
      clauseId: d.clauseId,
      clauseCode: d.clauseId ? clauseNames.get(d.clauseId)?.code ?? null : null,
      clauseTitle: d.clauseId ? clauseNames.get(d.clauseId)?.title ?? null : null,
      standardCode: d.standardCode,
      reviewDate: d.reviewDate?.toISOString() ?? null,
      tags: d.tags,
      observations: d.observations,
      distributionList: d.distributionList,
      locationId: d.locationId,
      locationName: d.location?.name ?? null,
      physicalLocation: d.physicalLocation,
      responsibleElaborationId: d.responsibleElaborationId,
      responsibleApprovalId: d.responsibleApprovalId,
      custodianId: d.custodianId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      supersededById: d.supersededById,
      supersededByCode: d.supersededById ? docMeta.get(d.supersededById)?.code ?? null : null,
      supersededByTitle: d.supersededById ? docMeta.get(d.supersededById)?.title ?? null : null,
      supersedesId: supersedesOf.get(d.id)?.id ?? null,
      supersedesCode: supersedesOf.get(d.id)?.code ?? null,
      supersedesTitle: supersedesOf.get(d.id)?.title ?? null,
      versions: d.versions.map((v) => ({
        id: v.id,
        version: v.version,
        previousVersion: v.previousVersion,
        changeDescription: v.changeDescription ?? v.changeLog,
        fileUrl: v.fileUrl,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        createdAt: v.createdAt.toISOString(),
        createdById: v.createdById,
      })),
      approvals: d.approvals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        status: a.status,
        comment: a.comment,
        decidedAt: a.decidedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    locations,
    personnel,
    processes: canCreate ? processes : [],
    standards: canCreate ? standards.map((item) => item.standard) : [],
    clauses: canCreate ? clauses.map((clause) => ({ id: clause.id, code: clause.code, title: clause.title, standardCode: clause.standard.code, standardName: clause.standard.name })) : [],
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  };
}

export type DocumentsPayload = Awaited<ReturnType<typeof getDocumentsPayload>>;
export type DocumentRowLive = DocumentsPayload["documents"][number];

// ─── Training management ──────────────────────────────────────────────

export async function getTrainingPayload() {
  const authorization = await requireAuthorization("training:read");
  const { ctx, can } = authorization;
  const organizationId = ctx.organization.id;
  const now = new Date();
  const [courses, assignments, personnel, processes, documents, auditEvents] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { organizationId },
      include: { documentLinks: true, audienceLinks: true },
      orderBy: [{ active: "desc" }, { code: "asc" }],
    }),
    prisma.trainingAssignment.findMany({
      where: { organizationId },
      include: {
        course: true,
        personnel: { include: { position: true } },
        process: true,
        triggeredByDocument: true,
      },
      orderBy: [{ dueAt: "asc" }, { assignedAt: "desc" }],
    }),
    prisma.personnel.findMany({
      where: { organizationId, active: true },
      include: { position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.process.findMany({
      where: { organizationId },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    prisma.document.findMany({
      where: { organizationId, status: { not: "OBSOLETE" } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true, currentVersion: true, status: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, module: { in: ["training_course", "training_assignment"] } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    access: { canManage: can("training:*") },
    courses: courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      standardTags: course.standardTags,
      defaultValidityMonths: course.defaultValidityMonths,
      defaultDueDays: course.defaultDueDays,
      mandatory: course.mandatory,
      autoAssignOnDocApproval: course.autoAssignOnDocApproval,
      active: course.active,
      documentIds: course.documentLinks.map((link) => link.documentId),
      audiencePersonnelIds: course.audienceLinks.map((link) => link.personnelId),
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    })),
    assignments: assignments.map((assignment) => {
      let status = assignment.status;
      if (assignment.status === "COMPLETED" && assignment.completedAt) {
        const expiresAt = new Date(assignment.completedAt);
        expiresAt.setMonth(expiresAt.getMonth() + assignment.course.defaultValidityMonths);
        if (expiresAt < now) status = "RETRAINING_REQUIRED";
      } else if (
        assignment.dueAt < now &&
        assignment.status !== "CANCELLED" &&
        assignment.status !== "RETRAINING_REQUIRED"
      ) {
        status = "OVERDUE";
      }
      return {
        id: assignment.id,
        courseId: assignment.courseId,
        courseCode: assignment.course.code,
        courseTitle: assignment.course.title,
        personnelId: assignment.personnelId,
        assigneeName: `${assignment.personnel.firstName} ${assignment.personnel.lastName}`,
        assigneeEmail: assignment.personnel.email,
        assigneeRole: assignment.personnel.position?.name ?? null,
        processId: assignment.processId,
        processCode: assignment.process?.code ?? null,
        processName: assignment.process?.name ?? null,
        status,
        assignedAt: assignment.assignedAt.toISOString(),
        dueAt: assignment.dueAt.toISOString(),
        startedAt: assignment.startedAt?.toISOString() ?? null,
        completedAt: assignment.completedAt?.toISOString() ?? null,
        evidenceNote: assignment.evidenceNote,
        evidenceUrl: assignment.evidenceUrl,
        triggeredByDocumentId: assignment.triggeredByDocumentId,
        triggeredByDocumentCode: assignment.triggeredByDocument?.code ?? null,
        triggeredByVersion: assignment.triggeredByVersion,
        reminderSentAt: assignment.reminderSentAt?.toISOString() ?? null,
      };
    }),
    personnel: personnel.map((person) => ({
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
      email: person.email,
      role: person.position?.name ?? null,
    })),
    processes: processes.map((process) => ({ id: process.id, code: process.code, name: process.name })),
    documents,
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      module: event.module,
      recordId: event.recordId,
      actorName: event.user?.name ?? "Sistema",
      createdAt: event.createdAt.toISOString(),
      metadata: event.metadata,
    })),
  };
}

export type TrainingPayload = Awaited<ReturnType<typeof getTrainingPayload>>;
export type TrainingCourseLive = TrainingPayload["courses"][number];
export type TrainingAssignmentLive = TrainingPayload["assignments"][number];

// ─── Operational modules ────────────────────────────────────────────

async function getOrganizationMembers(organizationId: string) {
  const rows = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((row) => ({ id: row.userId, name: row.user.name }));
}

export async function getProcessesPayload() {
  const { ctx, can } = await requireAuthorization("processes:read");
  const organizationId = ctx.organization.id;
  const canManage = can("processes:create") || can("processes:update");
  const linkedAccess = {
    documents: can("documents:read"),
    risks: can("risks:read"),
    indicators: can("indicators:read"),
    trainingAssignments: can("training:read"),
  };
  const linkedCountSelect = {
    ...(linkedAccess.documents ? { documents: true as const } : {}),
    ...(linkedAccess.risks ? { risks: true as const } : {}),
    ...(linkedAccess.indicators ? { indicators: true as const } : {}),
    ...(linkedAccess.trainingAssignments ? { trainingAssignments: true as const } : {}),
  };
  const hasLinkedAccess = Object.keys(linkedCountSelect).length > 0;
  const [processes, members] = await Promise.all([
    prisma.process.findMany({
      where: { organizationId },
      include: {
        ...(hasLinkedAccess ? { _count: { select: linkedCountSelect } } : {}),
        ...(linkedAccess.documents
          ? {
              documents: {
                select: { id: true, code: true, title: true, status: true, currentVersion: true, supersededById: true, supersededBy: { select: { code: true } } },
                orderBy: [{ status: "asc" as const }, { code: "asc" as const }],
              },
            }
          : {}),
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: { canCreate: can("processes:create"), canUpdate: can("processes:update"), canDelete: can("processes:delete") },
    members: canManage ? members : [],
    processes: processes.map((process) => {
      const counts = "_count" in process
        ? process._count as Partial<Record<keyof typeof linkedAccess, number>>
        : {};
      return {
      id: process.id,
      code: process.code,
      name: process.name,
      type: process.type,
      description: process.description,
      ownerId: process.ownerId,
      ownerName: process.ownerId ? memberNames.get(process.ownerId) ?? null : null,
      inputs: process.inputs,
      outputs: process.outputs,
      createdAt: process.createdAt.toISOString(),
      updatedAt: process.updatedAt.toISOString(),
        counts: {
          documents: linkedAccess.documents ? counts.documents ?? 0 : 0,
          risks: linkedAccess.risks ? counts.risks ?? 0 : 0,
          indicators: linkedAccess.indicators ? counts.indicators ?? 0 : 0,
          trainingAssignments: linkedAccess.trainingAssignments ? counts.trainingAssignments ?? 0 : 0,
        },
        documents: "documents" in process
          ? (process.documents as unknown as { id: string; code: string; title: string; status: string; currentVersion: string; supersededById: string | null; supersededBy: { code: string } | null }[]).map((d) => ({
              id: d.id,
              code: d.code,
              title: d.title,
              status: d.status,
              currentVersion: d.currentVersion,
              supersededByCode: d.supersededBy?.code ?? null,
            }))
          : [],
      };
    }),
  };
}

export async function getRisksPayload() {
  const { ctx, can } = await requireAuthorization("risks:read");
  const organizationId = ctx.organization.id;
  const canManage = can("risks:create") || can("risks:update");
  const canReadProcesses = can("processes:read");
  const canReadActions = can("actions:read");
  const [risks, processes, members] = await Promise.all([
    prisma.risk.findMany({
      where: { organizationId },
      include: {
        controls: { orderBy: { createdAt: "desc" } },
        ...(canReadActions ? { _count: { select: { actions: true } } } : {}),
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    }),
    canReadProcesses ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const processNames = new Map(processes.map((process) => [process.id, process]));
  return {
    access: { canCreate: can("risks:create"), canUpdate: can("risks:update"), canDelete: can("risks:delete") },
    members: canManage ? members : [],
    processes: canManage ? processes : [],
    risks: risks.map((risk) => ({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      category: risk.category,
      probability: risk.probability,
      impact: risk.impact,
      score: risk.score,
      status: risk.status,
      treatment: risk.treatment,
      ownerId: risk.ownerId,
      ownerName: risk.ownerId ? memberNames.get(risk.ownerId) ?? null : null,
      processId: risk.processId,
      processCode: risk.processId ? processNames.get(risk.processId)?.code ?? null : null,
      processName: risk.processId ? processNames.get(risk.processId)?.name ?? null : null,
      dueDate: risk.dueDate?.toISOString() ?? null,
      residualScore: risk.residualScore,
      controls: risk.controls.map((control) => ({
        ...control,
        ownerName: control.ownerId ? memberNames.get(control.ownerId) ?? null : null,
        createdAt: control.createdAt.toISOString(),
      })),
      actionCount: canReadActions && "_count" in risk ? risk._count.actions : 0,
      createdAt: risk.createdAt.toISOString(),
      updatedAt: risk.updatedAt.toISOString(),
    })),
  };
}

export async function getAuditsPayload() {
  const { ctx, can } = await requireAuthorization("audits:read");
  const organizationId = ctx.organization.id;
  const canManage = can("audits:create") || can("audits:update");
  const canReadPrograms = can("audit-program:read");
  const canReadNonconformities = can("nc:read");
  const [audits, programs, members] = await Promise.all([
    prisma.audit.findMany({
      where: { organizationId },
      include: {
        checklistItems: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        findings: { orderBy: { createdAt: "desc" } },
        ...(canReadNonconformities ? { _count: { select: { nonconformities: true } } } : {}),
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    }),
    canReadPrograms ? prisma.auditProgram.findMany({ where: { organizationId }, select: { id: true, year: true, title: true, status: true }, orderBy: [{ year: "desc" }, { title: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const programNames = new Map(programs.map((program) => [program.id, program.title]));
  return {
    access: { canCreate: can("audits:create"), canUpdate: can("audits:update"), canDelete: can("audits:delete") },
    programs: canManage ? programs : [],
    members: canManage ? members : [],
    audits: audits.map((audit) => ({
      id: audit.id,
      title: audit.title,
      type: audit.type,
      status: audit.status,
      standardCode: audit.standardCode,
      auditorId: audit.auditorId,
      auditorName: audit.auditorId ? memberNames.get(audit.auditorId) ?? null : null,
      auditorExternal: audit.auditorExternal,
      scheduledDate: audit.scheduledDate?.toISOString() ?? null,
      startedAt: audit.startedAt?.toISOString() ?? null,
      completedAt: audit.completedAt?.toISOString() ?? null,
      scope: audit.scope,
      objectives: audit.objectives,
      criteria: audit.criteria,
      reportUrl: audit.reportUrl,
      progress: audit.progress,
      programId: canReadPrograms ? audit.programId : null,
      programTitle: audit.programId ? programNames.get(audit.programId) ?? null : null,
      checklistItems: audit.checklistItems.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      findings: audit.findings.map((finding) => ({ ...finding, createdAt: finding.createdAt.toISOString(), updatedAt: finding.updatedAt.toISOString() })),
      nonconformityCount: canReadNonconformities && "_count" in audit ? audit._count.nonconformities : 0,
      createdAt: audit.createdAt.toISOString(),
      updatedAt: audit.updatedAt.toISOString(),
    })),
  };
}

export async function getNonconformitiesPayload() {
  const { ctx, can } = await requireAuthorization("nc:read");
  const organizationId = ctx.organization.id;
  const canManage = can("nc:create") || can("nc:update");
  const canReadAudits = can("audits:read");
  const canReadActions = can("actions:read");
  const [nonconformities, audits, findings, members] = await Promise.all([
    prisma.nonconformity.findMany({
      where: { organizationId },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        ...(canReadActions ? { _count: { select: { actions: true } } } : {}),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    canReadAudits ? prisma.audit.findMany({ where: { organizationId }, select: { id: true, title: true, type: true, status: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canReadAudits ? prisma.auditFinding.findMany({ where: { audit: { organizationId } }, select: { id: true, title: true, auditId: true, status: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const auditNames = new Map(audits.map((audit) => [audit.id, audit.title]));
  const findingNames = new Map(findings.map((finding) => [finding.id, finding.title]));
  return {
    access: { canCreate: can("nc:create"), canUpdate: can("nc:update"), canDelete: can("nc:delete") },
    audits: canManage ? audits : [],
    findings: canManage ? findings : [],
    members: canManage ? members : [],
    nonconformities: nonconformities.map((nc) => ({
      id: nc.id,
      title: nc.title,
      description: nc.description,
      source: nc.source,
      severity: nc.severity,
      status: nc.status,
      ownerId: nc.ownerId,
      ownerName: nc.ownerId ? memberNames.get(nc.ownerId) ?? null : null,
      rootCause: nc.rootCause,
      dueDate: nc.dueDate?.toISOString() ?? null,
      closedAt: nc.closedAt?.toISOString() ?? null,
      effectivenessValidated: nc.effectivenessValidated,
      auditId: canReadAudits ? nc.auditId : null,
      auditTitle: nc.auditId ? auditNames.get(nc.auditId) ?? null : null,
      findingId: canReadAudits ? nc.findingId : null,
      findingTitle: nc.findingId ? findingNames.get(nc.findingId) ?? null : null,
      actionCount: canReadActions && "_count" in nc ? (nc._count as { actions: number }).actions : 0,
      comments: nc.comments.map((c) => ({
        id: c.id,
        content: c.content,
        authorName: memberNames.get(c.authorId) ?? "Usuario",
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: nc.createdAt.toISOString(),
      updatedAt: nc.updatedAt.toISOString(),
    })),
  };
}

export async function getIndicatorsPayload() {
  const { ctx, can } = await requireAuthorization("indicators:read");
  const organizationId = ctx.organization.id;
  const canManage = can("indicators:create") || can("indicators:update");
  const canReadProcesses = can("processes:read");
  const [indicators, processes, members] = await Promise.all([
    prisma.indicator.findMany({
      where: { organizationId },
      include: { values: { orderBy: { createdAt: "desc" }, take: 24 } },
      orderBy: { name: "asc" },
    }),
    canReadProcesses ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const processNames = new Map(processes.map((process) => [process.id, process]));
  return {
    access: { canCreate: can("indicators:create"), canUpdate: can("indicators:update"), canDelete: can("indicators:delete") },
    processes: canManage ? processes : [],
    members: canManage ? members : [],
    indicators: indicators.map((indicator) => ({
      id: indicator.id,
      name: indicator.name,
      description: indicator.description,
      unit: indicator.unit,
      target: indicator.target,
      frequency: indicator.frequency,
      ownerId: indicator.ownerId,
      ownerName: indicator.ownerId ? memberNames.get(indicator.ownerId) ?? null : null,
      status: indicator.status,
      clauseCode: indicator.clauseCode,
      processId: indicator.processId,
      processCode: indicator.processId ? processNames.get(indicator.processId)?.code ?? null : null,
      processName: indicator.processId ? processNames.get(indicator.processId)?.name ?? null : null,
      values: indicator.values.map((value) => ({ ...value, createdAt: value.createdAt.toISOString() })),
      createdAt: indicator.createdAt.toISOString(),
      updatedAt: indicator.updatedAt.toISOString(),
    })),
  };
}

export async function getEvidencePayload() {
  const { ctx, can } = await requireAuthorization("evidence:read");
  const organizationId = ctx.organization.id;
  const canCreate = can("evidence:create");
  const [evidence, processes, risks, audits, nonconformities, indicators, documents, changes, suppliers, integrations] = await Promise.all([
    prisma.evidenceFile.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    can("processes:read") ? prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }) : Promise.resolve([]),
    can("risks:read") ? prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true } }) : Promise.resolve([]),
    can("audits:read") ? prisma.audit.findMany({ where: { organizationId }, select: { id: true, title: true } }) : Promise.resolve([]),
    can("nc:read") ? prisma.nonconformity.findMany({ where: { organizationId }, select: { id: true, title: true } }) : Promise.resolve([]),
    can("indicators:read") ? prisma.indicator.findMany({ where: { organizationId }, select: { id: true, name: true } }) : Promise.resolve([]),
    can("documents:read") ? prisma.document.findMany({ where: { organizationId }, select: { id: true, code: true, title: true } }) : Promise.resolve([]),
    can("changes:read") ? prisma.changeRequest.findMany({ where: { organizationId }, select: { id: true, code: true, title: true } }) : Promise.resolve([]),
    can("suppliers:read") ? prisma.supplier.findMany({ where: { organizationId }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    can("integrations:read") ? prisma.integration.findMany({ where: { organizationId }, select: { id: true, name: true, provider: true } }) : Promise.resolve([]),
  ]);
  const targets = {
    process: processes.map((item) => ({ id: item.id, label: `${item.code ?? "PROC"} · ${item.name}` })),
    risk: risks.map((item) => ({ id: item.id, label: item.title })),
    audit: audits.map((item) => ({ id: item.id, label: item.title })),
    nc: nonconformities.map((item) => ({ id: item.id, label: item.title })),
    indicator: indicators.map((item) => ({ id: item.id, label: item.name })),
    document: documents.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` })),
    change: changes.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` })),
    supplier: suppliers.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` })),
    integration: integrations.map((item) => ({ id: item.id, label: `${item.provider} · ${item.name}` })),
  };
  const targetLabels = new Map(
    Object.entries(targets).flatMap(([module, rows]) => rows.map((row) => [`${module}:${row.id}`, row.label] as const)),
  );
  return {
    access: { canCreate, canDelete: can("evidence:delete") },
    evidence: evidence.map((item) => ({
      ...item,
      targetLabel: item.module && item.moduleId ? targetLabels.get(`${item.module}:${item.moduleId}`) ?? null : null,
      createdAt: item.createdAt.toISOString(),
    })),
    targets: canCreate ? targets : { process: [], risk: [], audit: [], nc: [], indicator: [], document: [], change: [], supplier: [], integration: [] },
  };
}

export async function getChangesPayload() {
  const { ctx, can } = await requireAuthorization("changes:read");
  const organizationId = ctx.organization.id;
  const canManage = can("changes:create") || can("changes:update");
  const access = {
    processes: can("processes:read"),
    documents: can("documents:read"),
    risks: can("risks:read"),
    training: can("training:read"),
    nonconformities: can("nc:read"),
  };
  const [changes, members, processes, documents, risks, courses, nonconformities] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { organizationId },
      include: {
        processes: { select: { processId: true } },
        documents: { select: { documentId: true } },
        risks: { select: { riskId: true } },
        trainingCourses: { select: { courseId: true } },
        approvers: { orderBy: { createdAt: "asc" } },
        tasks: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    getOrganizationMembers(organizationId),
    access.processes ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    access.documents ? prisma.document.findMany({ where: { organizationId }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    access.risks ? prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    access.training ? prisma.trainingCourse.findMany({ where: { organizationId, active: true }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    access.nonconformities ? prisma.nonconformity.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: { canCreate: can("changes:create"), canUpdate: can("changes:update"), canDelete: can("changes:delete"), currentUserId: ctx.user.id },
    members: canManage ? members : [],
    processes: canManage ? processes : [],
    documents: canManage ? documents : [],
    risks: canManage ? risks : [],
    courses: canManage ? courses : [],
    nonconformities: canManage ? nonconformities : [],
    changes: changes.map((change) => ({
      id: change.id,
      code: change.code,
      title: change.title,
      category: change.category,
      changeType: change.changeType,
      reason: change.reason,
      impact: change.impact,
      affectedAreas: change.affectedAreas,
      status: change.status,
      requesterId: change.requesterId,
      requesterName: change.requesterName,
      nonconformityId: access.nonconformities ? change.nonconformityId : null,
      processIds: access.processes ? change.processes.map((item) => item.processId) : [],
      documentIds: access.documents ? change.documents.map((item) => item.documentId) : [],
      riskIds: access.risks ? change.risks.map((item) => item.riskId) : [],
      trainingCourseIds: access.training ? change.trainingCourses.map((item) => item.courseId) : [],
      approvers: change.approvers.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: memberNames.get(item.userId) ?? "Miembro",
        status: item.status,
        comment: item.comment,
        decidedAt: item.decidedAt?.toISOString() ?? null,
      })),
      tasks: change.tasks.map((task) => ({ ...task, completedAt: task.completedAt?.toISOString() ?? null, createdAt: task.createdAt.toISOString() })),
      submittedAt: change.submittedAt?.toISOString() ?? null,
      approvedAt: change.approvedAt?.toISOString() ?? null,
      implementedAt: change.implementedAt?.toISOString() ?? null,
      verifiedAt: change.verifiedAt?.toISOString() ?? null,
      closedAt: change.closedAt?.toISOString() ?? null,
      createdAt: change.createdAt.toISOString(),
      updatedAt: change.updatedAt.toISOString(),
    })),
  };
}

export async function getSuppliersPayload() {
  const { ctx, can } = await requireAuthorization("suppliers:read");
  const organizationId = ctx.organization.id;
  const canManage = can("suppliers:create") || can("suppliers:update");
  const linkedAccess = { documents: can("documents:read"), risks: can("risks:read"), nonconformities: can("nc:read") };
  const [suppliers, members, documents, risks, nonconformities] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId },
      include: {
        documents: { select: { documentId: true } },
        risks: { select: { riskId: true } },
        nonconformities: { select: { nonconformityId: true } },
        evaluations: { orderBy: { evaluatedAt: "desc" }, take: 12 },
      },
      orderBy: [{ criticality: "desc" }, { name: "asc" }],
    }),
    getOrganizationMembers(organizationId),
    linkedAccess.documents ? prisma.document.findMany({ where: { organizationId }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    linkedAccess.risks ? prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    linkedAccess.nonconformities ? prisma.nonconformity.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: { canCreate: can("suppliers:create"), canUpdate: can("suppliers:update"), canDelete: can("suppliers:delete") },
    members: canManage ? members : [],
    documents: canManage ? documents : [],
    risks: canManage ? risks : [],
    nonconformities: canManage ? nonconformities : [],
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      category: supplier.category,
      criticality: supplier.criticality,
      ownerId: supplier.ownerId,
      ownerName: supplier.ownerId ? memberNames.get(supplier.ownerId) ?? null : null,
      status: supplier.status,
      contactName: supplier.contactName,
      contactEmail: supplier.contactEmail,
      notes: supplier.notes,
      nextReviewDue: supplier.nextReviewDue?.toISOString() ?? null,
      lastEvaluationAt: supplier.lastEvaluationAt?.toISOString() ?? null,
      documentIds: linkedAccess.documents ? supplier.documents.map((item) => item.documentId) : [],
      riskIds: linkedAccess.risks ? supplier.risks.map((item) => item.riskId) : [],
      nonconformityIds: linkedAccess.nonconformities ? supplier.nonconformities.map((item) => item.nonconformityId) : [],
      evaluations: supplier.evaluations.map((evaluation) => ({ ...evaluation, evaluatedAt: evaluation.evaluatedAt.toISOString(), nextReviewDue: evaluation.nextReviewDue?.toISOString() ?? null, evaluatedByName: evaluation.evaluatedById ? memberNames.get(evaluation.evaluatedById) ?? null : null })),
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    })),
  };
}

export async function getIntegrationsPayload() {
  const { ctx, can } = await requireAuthorization("integrations:read");
  const organizationId = ctx.organization.id;
  const rows = await prisma.integration.findMany({
    where: { organizationId },
    include: { syncRuns: { orderBy: { startedAt: "desc" }, take: 10 } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return {
    access: { canManage: can("integrations:manage") },
    integrations: rows.map((integration) => ({
      id: integration.id,
      key: integration.key,
      name: integration.name,
      provider: integration.provider,
      category: integration.category,
      description: integration.description,
      valueProposition: integration.valueProposition,
      status: integration.status,
      externalAccount: integration.externalAccount,
      detailNote: integration.detailNote,
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
      connectedAt: integration.connectedAt?.toISOString() ?? null,
      syncRuns: integration.syncRuns.map((sync) => ({ ...sync, startedAt: sync.startedAt.toISOString(), completedAt: sync.completedAt?.toISOString() ?? null })),
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    })),
  };
}

export type ProcessesPayload = Awaited<ReturnType<typeof getProcessesPayload>>;
export type RisksPayload = Awaited<ReturnType<typeof getRisksPayload>>;
export type AuditsPayload = Awaited<ReturnType<typeof getAuditsPayload>>;
export type NonconformitiesPayload = Awaited<ReturnType<typeof getNonconformitiesPayload>>;
export type IndicatorsPayload = Awaited<ReturnType<typeof getIndicatorsPayload>>;
export type EvidencePayload = Awaited<ReturnType<typeof getEvidencePayload>>;
export type ChangesPayload = Awaited<ReturnType<typeof getChangesPayload>>;
export type SuppliersPayload = Awaited<ReturnType<typeof getSuppliersPayload>>;
export type IntegrationsPayload = Awaited<ReturnType<typeof getIntegrationsPayload>>;

// ─── Admin / Info / Catalogs / Records / ACPM — full payload ─────────

export async function getAdminPayload() {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const organizationId = ctx.organization.id;
  const currentUserId = ctx.user.id;
  const canReadOrganization = can("org:*");
  const canReadMembers = can("members:*");
  const canReadGroups = can("groups:read");
  const canReadPositions = can("positions:read");
  const canReadPersonnel = can("personnel:read");
  const canReadLocations = can("locations:read");
  const canReadCatalogs = can("catalogs:read");
  const canReadRecords = can("records:read");
  const canReadProcesses = can("processes:read");
  const canReadActions = can("actions:read");

  const [
    memberships,
    groups,
    positions,
    personnel,
    locations,
    retentionTimes,
    dispositions,
    archiveMethods,
    recordTypes,
    processes,
    records,
    recordEntries,
    actions,
    actionComments,
  ] = await Promise.all([
    canReadMembers ? prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }) : Promise.resolve([]),
    canReadGroups ? prisma.group.findMany({
      where: { organizationId },
      include: {
        permissions: { select: { permission: true } },
        members: { select: { userId: true } },
      },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
    canReadPositions ? prisma.position.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadPersonnel ? prisma.personnel.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { lastName: "asc" }] }) : Promise.resolve([]),
    canReadLocations ? prisma.location.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadCatalogs ? prisma.retentionTime.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { months: "asc" }] }) : Promise.resolve([]),
    canReadCatalogs ? prisma.disposition.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadCatalogs ? prisma.archiveMethod.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadCatalogs ? prisma.recordType.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadRecords && canReadProcesses ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadRecords ? prisma.record.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }) : Promise.resolve([]),
    canReadRecords ? prisma.recordEntry.findMany({
      where: { record: { organizationId } },
      orderBy: { enteredAt: "desc" },
    }) : Promise.resolve([]),
    canReadActions ? prisma.action.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
    canReadActions ? prisma.actionComment.findMany({
      where: { action: { organizationId } },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
  ]);

  const lastEntryAtByRecord = new Map<string, string>();
  const processNames = new Map(processes.map((process) => [process.id, process]));
  recordEntries.forEach((e) => {
    const cur = lastEntryAtByRecord.get(e.recordId);
    const iso = e.enteredAt.toISOString();
    if (!cur || cur < iso) lastEntryAtByRecord.set(e.recordId, iso);
  });

  function deriveCode(idx: number, year: number): string {
    return `ACPM-${year}-${String(idx).padStart(3, "0")}`;
  }
  // ACPMs ya tienen `code` embebido en title ("ACPM-2026-001 · ..."): lo extraemos
  function parseACPM(title: string): { code: string; title: string } {
    const m = /^(ACPM-\d{4}-\d{3})\s*·\s*(.+)$/.exec(title);
    if (m) return { code: m[1], title: m[2] };
    return { code: "", title };
  }

  return {
    organization: {
      name: ctx.organization.name,
      industry: canReadOrganization ? ctx.organization.industry : null,
      country: canReadOrganization ? ctx.organization.country : "",
      logoUrl: canReadOrganization ? ctx.organization.logoUrl : null,
      plan: ctx.organization.plan as "STARTER" | "GROWTH" | "ENTERPRISE",
    },
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      isSelf: m.userId === currentUserId,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      permissions: g.permissions.map((p) => p.permission),
      memberIds: g.members.map((m) => m.userId),
      createdAt: g.createdAt.toISOString(),
    })),
    positions: positions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      createdAt: p.createdAt.toISOString(),
    })),
    personnel: personnel.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      identification: p.identification,
      positionId: p.positionId,
      active: p.active,
      hiredAt: p.hiredAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      active: l.active,
      createdAt: l.createdAt.toISOString(),
    })),
    retentionTimes: retentionTimes.map((r) => ({
      id: r.id,
      name: r.name,
      months: r.months,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
    dispositions: dispositions.map((d) => ({
      id: d.id,
      name: d.name,
      active: d.active,
      createdAt: d.createdAt.toISOString(),
    })),
    archiveMethods: archiveMethods.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
    })),
    recordTypes: recordTypes.map((t) => ({
      id: t.id,
      name: t.name,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
    })),
    processes,
    records: records.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      processId: canReadProcesses ? r.processId : null,
      processName: r.processId ? processNames.get(r.processId)?.name ?? null : null,
      recordTypeId: r.recordTypeId,
      retentionTimeId: r.retentionTimeId,
      dispositionId: r.dispositionId,
      archiveMethodId: r.archiveMethodId,
      custodianId: r.custodianId,
      physicalLocation: r.physicalLocation,
      digitalLocation: r.digitalLocation,
      observations: r.observations,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      lastEntryAt: lastEntryAtByRecord.get(r.id) ?? null,
    })),
    recordEntries: recordEntries.map((e) => ({
      id: e.id,
      recordId: e.recordId,
      reference: e.reference ?? "",
      description: e.description,
      fileName: e.fileName,
      hasFile: Boolean(e.fileUrl),
      fileSize: e.fileSize,
      mimeType: e.mimeType,
      enteredById: e.enteredById,
      enteredAt: e.enteredAt.toISOString(),
    })),
    acpms: actions.map((a, idx) => {
      const parsed = parseACPM(a.title);
      const code = parsed.code || deriveCode(idx + 1, new Date(a.createdAt).getFullYear());
      return {
        id: a.id,
        code,
        title: parsed.title,
        description: a.description,
        type: a.type,
        priority: a.priority,
        stage: a.stage,
        source: a.source,
        rootCause: a.rootCause,
        proposedSolution: a.proposedSolution,
        effectivenessCheck: a.effectivenessCheck,
        effectivenessAt: a.effectivenessAt?.toISOString() ?? null,
        requestedById: a.requestedById,
        requestApproverId: a.requestApproverId,
        solutionApproverId: a.solutionApproverId,
        ownerId: a.ownerId,
        dueDate: a.dueDate?.toISOString() ?? null,
        progress: a.progress,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      };
    }),
    acpmHistory: actionComments.map((c) => ({
      id: c.id,
      acpmId: c.actionId,
      kind: "comment" as const,
      fromStage: null,
      toStage: null,
      message: c.content,
      actorId: c.authorId,
      at: c.createdAt.toISOString(),
    })),
  };
}

export type AdminPayload = Awaited<ReturnType<typeof getAdminPayload>>;

// ─── Activity / Audit log ─────────────────────────────────────────────

export async function getActivityPayload(limit = 500) {
  const ctx = await requirePermission("activity:read");
  const organizationId = ctx.organization.id;
  const [logs, memberships] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: true },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const userById = new Map(memberships.map((m) => [m.userId, { name: m.user.name, email: m.user.email }]));

  return {
    auditTrail: logs.map((l) => {
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      const before = meta.before as Record<string, unknown> | undefined;
      const after = meta.after as Record<string, unknown> | undefined;
      const summaryParts: string[] = [];
      if (typeof meta.message === "string") summaryParts.push(meta.message);
      if (typeof meta.reason === "string") summaryParts.push(`Motivo: ${meta.reason}`);
      const summary = summaryParts.join(" · ") || `${l.action} en ${l.module}`;

      const actor = l.userId ? userById.get(l.userId) : null;

      return {
        id: l.id,
        at: l.createdAt.toISOString(),
        action: l.action,
        module: l.module,
        recordId: l.recordId,
        recordLabel: (typeof meta.recordLabel === "string" ? meta.recordLabel : null) ?? l.recordId,
        actorId: l.userId,
        actorName: actor?.name ?? null,
        summary,
        before,
        after,
      };
    }),
  };
}

export type ActivityPayload = Awaited<ReturnType<typeof getActivityPayload>>;

export async function getNotificationsPayload() {
  const ctx = await requirePermission("notifications:read");
  const rows = await prisma.notification.findMany({
    where: { organizationId: ctx.organization.id, userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return rows.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    read: notification.read,
    link: notification.link,
    createdAt: notification.createdAt.toISOString(),
  }));
}

export async function getAccountPayload() {
  const { ctx } = await getServerAuthorization();
  return {
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    avatarUrl: ctx.user.avatarUrl,
    organizationId: ctx.organization.id,
    organizationName: ctx.organization.name,
    role: ctx.role,
  };
}

export async function getBillingPayload() {
  const { ctx, can } = await requireAuthorization("billing:read");
  const organizationId = ctx.organization.id;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [subscription, invoices, users, documents, audits, documentStorage, evidenceStorage, recordStorage] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId } }),
    prisma.billingInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.membership.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.audit.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    prisma.documentVersion.aggregate({ where: { document: { organizationId } }, _sum: { fileSize: true } }),
    prisma.evidenceFile.aggregate({ where: { organizationId }, _sum: { fileSize: true } }),
    prisma.recordEntry.aggregate({ where: { record: { organizationId } }, _sum: { fileSize: true } }),
  ]);
  const plan = subscription?.plan ?? ctx.organization.plan;
  const limits = PLANS[plan].limits;
  const storageBytes = (documentStorage._sum.fileSize ?? 0) + (evidenceStorage._sum.fileSize ?? 0) + (recordStorage._sum.fileSize ?? 0);
  return {
    plan,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    stripeConfigured: isStripeConfigured(),
    checkoutConfigured: { STARTER: isPlanCheckoutConfigured("STARTER"), GROWTH: isPlanCheckoutConfigured("GROWTH") },
    canManage: can("billing:*"),
    usage: {
      users,
      userLimit: limits.users,
      storageBytes,
      storageLimitGb: limits.storage,
      documents,
      auditsThisMonth: audits,
    },
    invoices: invoices.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      periodStart: invoice.periodStart?.toISOString() ?? null,
      periodEnd: invoice.periodEnd?.toISOString() ?? null,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
      invoicePdf: invoice.invoicePdf,
      createdAt: invoice.createdAt.toISOString(),
    })),
  };
}

export type BillingPayload = Awaited<ReturnType<typeof getBillingPayload>>;

export async function getReportingPayload() {
  const { ctx, can } = await requireAuthorization("reporting:read");
  const exports = await prisma.reportExport.findMany({
    where: { organizationId: ctx.organization.id },
    include: { generatedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return {
    canExport: can("reporting:read"),
    exports: exports.map(item => ({
      id: item.id,
      reportType: item.reportType,
      format: item.format,
      dateFrom: item.dateFrom.toISOString(),
      dateTo: item.dateTo.toISOString(),
      rowCount: item.rowCount,
      fileName: item.fileName,
      generatedBy: item.generatedBy?.name ?? "Sistema",
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export type ReportingPayload = Awaited<ReturnType<typeof getReportingPayload>>;

export async function getManagementReviewPayload() {
  const { ctx, can } = await requireAuthorization("mgmt-review:read");
  const organizationId = ctx.organization.id;
  const canManage = can("mgmt-review:*");
  const [reviews, members] = await Promise.all([
    prisma.managementReview.findMany({
      where: { organizationId },
      include: {
        inputs: { orderBy: { createdAt: "asc" } },
        decisions: { orderBy: { createdAt: "asc" } },
        _count: { select: { actions: true } },
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    }),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map(m => [m.id, m.name]));
  return {
    access: { canManage },
    members: canManage ? members : [],
    reviews: reviews.map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      scheduledDate: r.scheduledDate?.toISOString() ?? null,
      heldAt: r.heldAt?.toISOString() ?? null,
      chairId: r.chairId,
      chairName: r.chairId ? memberNames.get(r.chairId) ?? null : null,
      attendees: r.attendees,
      summary: r.summary,
      actionCount: r._count.actions,
      inputs: r.inputs.map(i => ({ id: i.id, topic: i.topic, content: i.content })),
      decisions: r.decisions.map(d => ({
        id: d.id,
        topic: d.topic,
        decision: d.decision,
        ownerId: d.ownerId,
        ownerName: d.ownerId ? memberNames.get(d.ownerId) ?? null : null,
        dueDate: d.dueDate?.toISOString() ?? null,
      })),
    })),
  };
}

export type ManagementReviewPayload = Awaited<ReturnType<typeof getManagementReviewPayload>>;

export async function getAuditProgramPayload() {
  const { ctx, can } = await requireAuthorization("audit-program:read");
  const organizationId = ctx.organization.id;
  const canManage = can("audit-program:*");
  const [programs, members] = await Promise.all([
    prisma.auditProgram.findMany({
      where: { organizationId },
      include: {
        audits: {
          select: { id: true, title: true, status: true, progress: true, scheduledDate: true, type: true },
          orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ year: "desc" }, { title: "asc" }],
    }),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map(m => [m.id, m.name]));
  return {
    access: { canManage },
    programs: programs.map(p => {
      const total = p.audits.length;
      const completed = p.audits.filter(a => a.status === "COMPLETED").length;
      const avgProgress = total ? Math.round(p.audits.reduce((s, a) => s + a.progress, 0) / total) : 0;
      return {
        id: p.id,
        year: p.year,
        title: p.title,
        objectives: p.objectives,
        scope: p.scope,
        status: p.status,
        approvedById: p.approvedById,
        approvedByName: p.approvedById ? memberNames.get(p.approvedById) ?? null : null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        auditCount: total,
        completedCount: completed,
        avgProgress,
        audits: p.audits.map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          progress: a.progress,
          type: a.type,
          scheduledDate: a.scheduledDate?.toISOString() ?? null,
        })),
      };
    }),
  };
}

export type AuditProgramPayload = Awaited<ReturnType<typeof getAuditProgramPayload>>;
