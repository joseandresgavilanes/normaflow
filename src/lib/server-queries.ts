import "server-only";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization, requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { isPlanCheckoutConfigured, isStripeConfigured, PLANS } from "@/lib/stripe";
import { ensureOrganizationDefaults } from "@/lib/organization-defaults";
import { getCollaboratorScope } from "@/lib/permissions/scope";
import { roleOrGroupCan } from "@/lib/permissions/matrix";
import { planEntitlements, isTrialActive, assertPlanModule } from "@/lib/plan-entitlements";
import { ensureDocumentTemplates } from "@/lib/document-templates";
import { directoryPayload, memberAccessFor, memberPayload } from "@/lib/payload-privacy";
import { packTemplateDocumentType } from "@/lib/standard-packs/template-content";
import { delegationsFor } from "@/lib/delegation";
import { createSignedAvatarUrl } from "@/lib/storage";
import { listUserSessions } from "@/lib/sessions";

export async function getDashboardPayload() {
  const ctx = await requirePermission("dashboard:read");
  const organizationId = ctx.organization.id;
  const currentUserId = ctx.user.id;
  const scope = await getCollaboratorScope(ctx);
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
    prisma.action.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.actionIds } } : {}) } }),
    prisma.risk.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.riskIds } } : {}) } }),
    prisma.document.count({
      where: { organizationId, status: "IN_REVIEW", ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}) },
    }),
    prisma.audit.count({
      where: {
        organizationId,
        status: "PLANNED",
        ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}),
      },
    }),
    prisma.nonconformity.count({
      where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] }, ...(scope.isScoped ? { id: { in: scope.nonconformityIds } } : {}) },
    }),
    prisma.indicator.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.indicatorIds } } : {}) },
      include: { values: { orderBy: { createdAt: "desc" }, take: 6 } },
    }),
    prisma.audit.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.trainingAssignment.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.trainingAssignmentIds } } : {}) },
      select: { status: true, dueAt: true, completedAt: true, course: { select: { defaultValidityMonths: true } } },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, ...(scope.isScoped ? { userId: currentUserId } : {}) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.auditLog.count({ where: { organizationId, ...(scope.isScoped ? { userId: currentUserId } : {}) } }),
    prisma.location.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
    prisma.document.count({
      where: {
        organizationId,
        status: "APPROVED",
        ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}),
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
  /* Reparto completo del inventario, no solo el recuento de críticos: la fila
     de avisos ya dice cuántos críticos hay, y un solo número no distingue una
     organización con tres riesgos de otra con trescientos. Los cortes son los
     de `riskLevel` (src/lib/utils.ts). */
  const riskLevels = {
    critical: criticalRisks,
    high: risks.filter(r => r.score >= 8 && r.score < 15).length,
    moderate: risks.filter(r => r.score < 8).length,
  };

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
    riskLevels,
    /* Todas las normas activas, no solo 9001 y 27001: el motor de normas
       admite trece y el panel enseñaba dos. */
    standardScores: orgStandards.map(row => ({
      code: row.standard.code.replaceAll("_", " "),
      name: row.standard.name,
      pct: row.score != null ? Math.round(row.score) : null,
    })),
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
    locations: scope.isScoped ? [] : locations,
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
  const scope = await getCollaboratorScope(ctx);
  const canCreate = can("documents:create");
  const canReadProcesses = can("processes:read");
  const memberAccess = memberAccessFor(can);
  const canReadMembers = memberAccess !== "none";
  const [documents, locations, personnel, members, processes, clauses, standards, templates, packTemplates] = await Promise.all([
    prisma.document.findMany({
      where: {
        organizationId,
        ...(scope.isScoped ? { OR: [{ ownerId: ctx.user.id }, { approvals: { some: { approverId: ctx.user.id } } }, ...(scope.processIds.length ? [{ processId: { in: scope.processIds } }] : [])] } : {}),
      },
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
    canReadMembers ? prisma.membership.findMany({
      where: { organizationId, active: true },
      include: { user: { select: { name: true, email: true } } },
    }) : Promise.resolve([]),
    canReadProcesses ? prisma.process.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }) : Promise.resolve([]),
    prisma.standardRequirement.findMany({
      where: { standard: { orgStandards: { some: { organizationId } } } },
      select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } },
      orderBy: [{ standard: { code: "asc" } }, { order: "asc" }],
    }),
    prisma.organizationStandard.findMany({
      where: { organizationId },
      select: { standard: { select: { code: true, name: true } } },
      orderBy: { standard: { code: "asc" } },
    }),
    prisma.documentTemplate.findMany({
      where: { isActive: true },
      include: { clause: { select: { code: true, title: true } } },
      orderBy: [{ standardCode: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.standardTemplate.findMany({
      where: {
        active: true,
        edition: { orgStandards: { some: { organizationId } } },
      },
      include: {
        edition: { select: { code: true, name: true } },
        requirement: { select: { code: true, title: true } },
      },
      orderBy: [{ edition: { code: "asc" } }, { name: "asc" }],
    }),
  ]);

  // `ensureDocumentTemplates()` se llamaba AQUÍ, antes de leer nada. Recorre el
  // catálogo de normas llamando a `installPack` una por una, así que cada visita
  // a esta pantalla reinstalaba el catálogo ISO entero antes de pintar la primera
  // fila: la ruta no llegaba a terminar de cargar nunca.
  //
  // Sembrar es una operación de arranque —`scripts/seed.ts`, el bootstrap de la
  // cuenta— y no del camino de lectura. Se conserva solo como red de seguridad
  // para una base sin sembrar, y se paga únicamente cuando de verdad no hay nada
  // que leer, no en cada carga.
  let documentTemplates = templates;
  if (documentTemplates.length === 0) {
    await ensureDocumentTemplates();
    documentTemplates = await prisma.documentTemplate.findMany({
      where: { isActive: true },
      include: { clause: { select: { code: true, title: true } } },
      orderBy: [{ standardCode: "asc" }, { sortOrder: "asc" }],
    });
  }
  const memberGroupPermissions = canReadMembers ? await prisma.groupMembership.findMany({
    where: { userId: { in: members.map((membership) => membership.userId) }, group: { organizationId } },
    select: { userId: true, group: { select: { permissions: { select: { permission: true } } } } },
  }) : [];
  const groupPermissionsByUser = new Map<string, string[]>();
  for (const membership of memberGroupPermissions) {
    const permissions = groupPermissionsByUser.get(membership.userId) ?? [];
    permissions.push(...membership.group.permissions.map((permission) => permission.permission));
    groupPermissionsByUser.set(membership.userId, permissions);
  }
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
      canApprove: can("documents:approve"),
      canObsolete: can("documents:*"),
      canExport: can("documents:export"),
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
      content: d.content,
      templateId: d.templateId,
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
        status: v.status,
        previousVersion: v.previousVersion,
        changeDescription: v.changeDescription ?? v.changeLog,
        fileUrl: v.fileUrl,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        createdAt: v.createdAt.toISOString(),
        createdById: v.createdById,
        content: v.content,
      })),
      approvals: d.approvals.map((a) => ({
        id: a.id,
        versionId: a.versionId,
        approverId: a.approverId,
        status: a.status,
        comment: a.comment,
        decidedAt: a.decidedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    locations: scope.isScoped ? [] : locations,
    /* Los selectores de custodio, elaboración y aprobación de la ficha del
       documento salen de aquí: vaciarla por alcance dejaba el formulario a
       medias para el contribuidor. Va el nombre, que es lo que un selector
       necesita, y no el correo, que es dato de contacto. */
    personnel: personnel.map((person) => ({
      ...person,
      email: scope.isScoped ? null : person.email,
    })),
    processes: canCreate ? processes : [],
    standards: standards.map((item) => item.standard),
    clauses: clauses.map((clause) => ({ id: clause.id, code: clause.code, title: clause.title, standardCode: clause.standard.code, standardName: clause.standard.name })),
    members: directoryPayload(memberAccess, members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      canApprove: roleOrGroupCan(m.role, groupPermissionsByUser.get(m.userId) ?? [], "documents:approve"),
    }))),
    templates: [
      ...documentTemplates.map((template) => ({
        id: template.id,
        code: template.code,
        standardCode: template.standardCode,
        title: template.title,
        description: template.description,
        documentType: template.documentType,
        clauseId: template.clauseId,
        clauseCode: template.clause?.code ?? null,
        clauseTitle: template.clause?.title ?? null,
        content: template.content,
        fields: template.fieldSchema,
        tags: template.tags,
      })),
      ...packTemplates.map((template) => ({
        id: `pack:${template.id}`,
        code: `${template.edition?.code ?? "PACK"}-${template.requirement?.code ?? template.templateType}`.replace(/[^A-Za-z0-9.-]+/g, "-"),
        standardCode: template.edition?.code ?? "PACK",
        title: template.name.replace(/\s*\(plantilla\)\s*$/i, ""),
        description: `Plantilla del Standard Pack${template.requirement ? ` · requisito ${template.requirement.code}` : ""}`,
        documentType: packTemplateDocumentType(template.templateType),
        clauseId: template.requirementId,
        clauseCode: template.requirement?.code ?? null,
        clauseTitle: template.requirement?.title ?? null,
        content: template.content,
        fields: [],
        tags: ["standard-pack", (template.edition?.code ?? "pack").toLowerCase()],
      })),
    ],
  };
}

export type DocumentsPayload = Awaited<ReturnType<typeof getDocumentsPayload>>;
export type DocumentRowLive = DocumentsPayload["documents"][number];

// ─── Training management ──────────────────────────────────────────────

export async function getTrainingPayload() {
  const authorization = await requireAuthorization("training:read");
  const { ctx, can } = authorization;
  assertPlanModule(ctx, "training");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
  const now = new Date();
  const [courses, assignments, personnel, processes, documents, auditEvents] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.trainingCourseIds } } : {}) },
      include: { documentLinks: true, audienceLinks: true },
      orderBy: [{ active: "desc" }, { code: "asc" }],
    }),
    prisma.trainingAssignment.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.trainingAssignmentIds } } : {}) },
      include: {
        course: true,
        personnel: { include: { position: true } },
        process: true,
        triggeredByDocument: true,
      },
      orderBy: [{ dueAt: "asc" }, { assignedAt: "desc" }],
    }),
    prisma.personnel.findMany({
      where: { organizationId, active: true, ...(scope.isScoped ? { id: { in: scope.personnelIds } } : {}) },
      include: { position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.process.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    prisma.document.findMany({
      where: { organizationId, status: { not: "OBSOLETE" }, ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}) },
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true, currentVersion: true, status: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, module: { in: ["training_course", "training_assignment"] }, ...(scope.isScoped ? { recordId: { in: scope.trainingAssignmentIds } } : {}) },
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
  const scope = await getCollaboratorScope(ctx);
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
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) },
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
    members: canManage && can("members:directory") ? members : [],
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
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("risks:create") || can("risks:update");
  const canReadProcesses = can("processes:read");
  const canReadActions = can("actions:read");
  const [risks, processes, members] = await Promise.all([
    prisma.risk.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.riskIds } } : {}) },
      include: {
        controls: { orderBy: { createdAt: "desc" } },
        ...(canReadActions ? { _count: { select: { actions: true } } } : {}),
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    }),
    canReadProcesses ? prisma.process.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const processNames = new Map(processes.map((process) => [process.id, process]));
  return {
    access: { canCreate: can("risks:create"), canUpdate: can("risks:update"), canDelete: can("risks:delete") },
    members: canManage && can("members:directory") ? members : [],
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

export async function getOpportunitiesPayload() {
  const { ctx, can } = await requireAuthorization("opportunities:read");
  assertPlanModule(ctx, "opportunities");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("opportunities:create") || can("opportunities:update");
  const [opportunities, members] = await Promise.all([
    prisma.opportunity.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.opportunityIds } } : {}) },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: {
      canCreate: can("opportunities:create"),
      canUpdate: can("opportunities:update"),
      canDelete: can("opportunities:delete"),
      currentUserId: ctx.user.id,
    },
    members: canManage && can("members:directory") ? members : [],
    opportunities: opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      standardCode: opportunity.standardCode,
      source: opportunity.source,
      category: opportunity.category,
      status: opportunity.status,
      ownerId: opportunity.ownerId,
      ownerName: opportunity.ownerId ? memberNames.get(opportunity.ownerId) ?? null : null,
      reviewerId: opportunity.reviewerId,
      reviewerName: opportunity.reviewerId ? memberNames.get(opportunity.reviewerId) ?? null : null,
      materializationAnalysis: opportunity.materializationAnalysis,
      materializationPlan: opportunity.materializationPlan,
      materializationEvidence: opportunity.materializationEvidence,
      dueDate: opportunity.dueDate?.toISOString() ?? null,
      materializedAt: opportunity.materializedAt?.toISOString() ?? null,
      closedAt: opportunity.closedAt?.toISOString() ?? null,
      rejectionReason: opportunity.rejectionReason,
      createdAt: opportunity.createdAt.toISOString(),
      updatedAt: opportunity.updatedAt.toISOString(),
    })),
  };
}

export async function getAuditsPayload() {
  const { ctx, can } = await requireAuthorization("audits:read");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("audits:create") || can("audits:update");
  const canReadPrograms = can("audit-program:read");
  const canReadNonconformities = can("nc:read");
  const [audits, programs, members, processes, clauses, evidenceFiles] = await Promise.all([
    prisma.audit.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) },
      include: {
        process: { select: { id: true, code: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true, evidenceType: true, fileUrl: true } } } },
        checklistItems: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { clause: { select: { id: true, code: true, title: true } } } },
        findings: { orderBy: { createdAt: "desc" }, include: { capa: { select: { id: true, code: true, stage: true } } } },
        ...(canReadNonconformities ? { _count: { select: { nonconformities: true } } } : {}),
      },
      orderBy: [{ plannedDate: "desc" }, { scheduledDate: "desc" }, { createdAt: "desc" }],
    }),
    canReadPrograms ? prisma.auditProgram.findMany({ where: { organizationId }, select: { id: true, year: true, title: true, status: true }, orderBy: [{ year: "desc" }, { title: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
    canManage ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    canManage ? prisma.standardRequirement.findMany({ where: { standard: { orgStandards: { some: { organizationId } } } }, select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } }, orderBy: [{ standard: { code: "asc" } }, { order: "asc" }] }) : Promise.resolve([]),
    canManage ? prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true, evidenceType: true }, orderBy: { createdAt: "desc" }, take: 500 }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const programNames = new Map(programs.map((program) => [program.id, program.title]));
  return {
    access: { canCreate: can("audits:create"), canUpdate: can("audits:update"), canDelete: can("audits:delete"), canExport: can("audits:export"), canConvertFinding: can("actions:create") },
    programs: canManage ? programs : [],
    members: canManage && can("members:directory") ? members : [],
    processes,
    clauses: clauses.map((clause) => ({ id: clause.id, code: clause.code, title: clause.title, standardCode: clause.standard.code })),
    evidenceFiles,
    audits: audits.map((audit) => ({
      id: audit.id,
      title: audit.title,
      type: audit.type,
      status: audit.status,
      standardCode: audit.standardCode,
      processId: audit.processId,
      processName: audit.process?.name ?? null,
      auditorId: audit.auditorId,
      auditorName: audit.auditorId ? memberNames.get(audit.auditorId) ?? null : null,
      auditorExternal: audit.auditorExternal,
      plannedDate: audit.plannedDate?.toISOString() ?? null,
      scheduledDate: audit.scheduledDate?.toISOString() ?? null,
      startDate: audit.startDate?.toISOString() ?? null,
      endDate: audit.endDate?.toISOString() ?? null,
      startedAt: audit.startedAt?.toISOString() ?? null,
      completedAt: audit.completedAt?.toISOString() ?? null,
      scope: audit.scope,
      objectives: audit.objectives,
      criteria: audit.criteria,
      reportUrl: audit.reportUrl,
      reportSummary: audit.reportSummary,
      reportConclusion: audit.reportConclusion,
      reportIssuedAt: audit.reportIssuedAt?.toISOString() ?? null,
      closedByName: audit.closedBy?.name ?? null,
      progress: audit.progress,
      programId: canReadPrograms ? audit.programId : null,
      programTitle: audit.programId ? programNames.get(audit.programId) ?? null : null,
      participants: audit.participants.map((participant) => ({ id: participant.user.id, name: participant.user.name, role: participant.role })),
      evidenceLinks: audit.evidenceLinks.map((link) => ({ id: link.evidence.id, title: link.evidence.title, evidenceType: link.evidence.evidenceType })),
      checklistItems: audit.checklistItems.map((item) => ({
        ...item,
        clauseName: item.clause?.title ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      findings: audit.findings.map((finding) => ({ ...finding, capaId: finding.capa?.id ?? null, capaCode: finding.capa?.code ?? null, capaStage: finding.capa?.stage ?? null, createdAt: finding.createdAt.toISOString(), updatedAt: finding.updatedAt.toISOString() })),
      nonconformityCount: canReadNonconformities && "_count" in audit ? audit._count.nonconformities : 0,
      createdAt: audit.createdAt.toISOString(),
      updatedAt: audit.updatedAt.toISOString(),
    })),
  };
}

export async function getNonconformitiesPayload() {
  const { ctx, can } = await requireAuthorization("nc:read");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("nc:create") || can("nc:update");
  const canReadAudits = can("audits:read");
  const canReadActions = can("actions:read");
  const [nonconformities, audits, findings, members] = await Promise.all([
    prisma.nonconformity.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.nonconformityIds } } : {}) },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        ...(canReadActions ? { _count: { select: { actions: true } } } : {}),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    canReadAudits ? prisma.audit.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) }, select: { id: true, title: true, type: true, status: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canReadAudits ? prisma.auditFinding.findMany({ where: { audit: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) } }, select: { id: true, title: true, auditId: true, status: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const auditNames = new Map(audits.map((audit) => [audit.id, audit.title]));
  const findingNames = new Map(findings.map((finding) => [finding.id, finding.title]));
  return {
    access: { canCreate: can("nc:create"), canUpdate: can("nc:update"), canDelete: can("nc:delete") },
    audits: canManage ? audits : [],
    findings: canManage ? findings : [],
    members: canManage && can("members:directory") ? members : [],
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
      archiveReason: nc.archiveReason,
      archivedAt: nc.archivedAt?.toISOString() ?? null,
      archivedById: nc.archivedById,
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
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("indicators:create") || can("indicators:update");
  const canReadProcesses = can("processes:read");
  const [indicators, processes, members] = await Promise.all([
    prisma.indicator.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.indicatorIds } } : {}) },
      include: { values: { orderBy: { createdAt: "desc" }, take: 24 } },
      orderBy: { name: "asc" },
    }),
    canReadProcesses ? prisma.process.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    getOrganizationMembers(organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const processNames = new Map(processes.map((process) => [process.id, process]));
  return {
    access: { canCreate: can("indicators:create"), canUpdate: can("indicators:update"), canDelete: can("indicators:delete") },
    processes: canManage ? processes : [],
    members: canManage && can("members:directory") ? members : [],
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
  const scope = await getCollaboratorScope(ctx);
  const canCreate = can("evidence:create");
  const canManage = canCreate || can("evidence:update");
  const visibleEvidenceTargets = scope.isScoped ? [
    ...(scope.processIds.length ? [{ processId: { in: scope.processIds } }] : []),
    ...(scope.documentIds.length ? [{ documentLinks: { some: { documentId: { in: scope.documentIds } } } }] : []),
    ...(scope.riskIds.length ? [{ riskLinks: { some: { riskId: { in: scope.riskIds } } } }] : []),
    ...(scope.auditIds.length ? [{ auditLinks: { some: { auditId: { in: scope.auditIds } } } }] : []),
    ...(scope.nonconformityIds.length ? [{ nonconformityLinks: { some: { nonconformityId: { in: scope.nonconformityIds } } } }] : []),
    ...(scope.indicatorIds.length ? [{ indicatorLinks: { some: { indicatorId: { in: scope.indicatorIds } } } }] : []),
  ] : [];
  const [evidence, processes, risks, audits, findings, nonconformities, indicators, documents, reviews, clauses, standards, members] = await Promise.all([
    prisma.evidenceFile.findMany({
      where: { organizationId, deletedAt: null, ...(scope.isScoped ? { OR: [{ uploadedById: ctx.user.id }, ...visibleEvidenceTargets] } : {}) },
      include: {
        process: { select: { id: true, code: true, name: true } },
        clause: { select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } } },
        uploadedBy: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        documentLinks: { include: { document: { select: { id: true, code: true, title: true } } } },
        riskLinks: { include: { risk: { select: { id: true, title: true } } } },
        auditLinks: { include: { audit: { select: { id: true, title: true } } } },
        findingLinks: { include: { finding: { select: { id: true, title: true } } } },
        nonconformityLinks: { include: { nonconformity: { select: { id: true, title: true } } } },
        indicatorLinks: { include: { indicator: { select: { id: true, name: true } } } },
        managementReviewLinks: { include: { managementReview: { select: { id: true, title: true } } } },
      },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
    }),
    can("processes:read") ? prisma.process.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) }, select: { id: true, name: true, code: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    can("risks:read") ? prisma.risk.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.riskIds } } : {}) }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    can("audits:read") ? prisma.audit.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    can("audits:read") ? prisma.auditFinding.findMany({ where: { audit: { organizationId, ...(scope.isScoped ? { id: { in: scope.auditIds } } : {}) } }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    can("nc:read") ? prisma.nonconformity.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.nonconformityIds } } : {}) }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    can("indicators:read") ? prisma.indicator.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.indicatorIds } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    can("documents:read") ? prisma.document.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}) }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    can("mgmt-review:read") ? prisma.managementReview.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    prisma.standardRequirement.findMany({ where: { standard: { orgStandards: { some: { organizationId } } } }, select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } }, orderBy: [{ standard: { code: "asc" } }, { order: "asc" }] }),
    prisma.organizationStandard.findMany({ where: { organizationId }, select: { standard: { select: { code: true, name: true } } }, orderBy: { standard: { code: "asc" } } }),
    canManage ? prisma.membership.findMany({ where: { organizationId, active: true }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);
  const targets = {
    process: processes.map((item) => ({ id: item.id, label: `${item.code ?? "PROC"} · ${item.name}` })),
    risk: risks.map((item) => ({ id: item.id, label: item.title })),
    audit: audits.map((item) => ({ id: item.id, label: item.title })),
    finding: findings.map((item) => ({ id: item.id, label: item.title })),
    nc: nonconformities.map((item) => ({ id: item.id, label: item.title })),
    indicator: indicators.map((item) => ({ id: item.id, label: item.name })),
    document: documents.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` })),
    managementReview: reviews.map((item) => ({ id: item.id, label: item.title })),
    // Legacy selector keys retained while old indicator evidence screens are phased out.
    change: [],
    supplier: [],
    integration: [],
  };
  const targetLabels = new Map(Object.entries(targets).flatMap(([module, rows]) => rows.map((row) => [`${module}:${row.id}`, row.label] as const)));
  const now = new Date();
  const displayStatus = (status: string, expiresAt: Date | null) => status === "PENDING_REVIEW" ? status : expiresAt && expiresAt < now ? "EXPIRED" : "VALID";
  return {
    access: { canCreate, canUpdate: can("evidence:update"), canReview: can("evidence:approve"), canDelete: can("evidence:delete"), canExport: can("evidence:export") },
    evidence: evidence.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      evidenceType: item.evidenceType,
      status: displayStatus(item.status, item.expiresAt),
      fileUrl: item.fileUrl,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      processId: item.processId,
      processName: item.process ? `${item.process.code ?? "PROC"} · ${item.process.name}` : null,
      standardCode: item.standardCode ?? item.clause?.standard.code ?? null,
      clauseId: item.clauseId,
      clauseName: item.clause ? `${item.clause.code} · ${item.clause.title}` : null,
      responsibleId: item.responsibleId,
      responsibleName: item.responsible?.name ?? null,
      issuedAt: item.issuedAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      reviewedByName: item.reviewedBy?.name ?? null,
      uploadedByName: item.uploadedBy?.name ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      targetLabel: item.module && item.moduleId ? targetLabels.get(`${item.module}:${item.moduleId}`) ?? null : null,
      module: item.module,
      moduleId: item.moduleId,
      uploadedById: item.uploadedById,
      documentIds: item.documentLinks.map((link) => link.documentId),
      documentLabels: item.documentLinks.map((link) => `${link.document.code} · ${link.document.title}`),
      riskIds: item.riskLinks.map((link) => link.riskId),
      riskLabels: item.riskLinks.map((link) => link.risk.title),
      auditIds: item.auditLinks.map((link) => link.auditId),
      auditLabels: item.auditLinks.map((link) => link.audit.title),
      findingIds: item.findingLinks.map((link) => link.findingId),
      findingLabels: item.findingLinks.map((link) => link.finding.title),
      nonconformityIds: item.nonconformityLinks.map((link) => link.nonconformityId),
      nonconformityLabels: item.nonconformityLinks.map((link) => link.nonconformity.title),
      indicatorIds: item.indicatorLinks.map((link) => link.indicatorId),
      indicatorLabels: item.indicatorLinks.map((link) => link.indicator.name),
      managementReviewIds: item.managementReviewLinks.map((link) => link.managementReviewId),
      managementReviewLabels: item.managementReviewLinks.map((link) => link.managementReview.title),
    })),
    targets: canManage ? targets : { process: [], risk: [], audit: [], finding: [], nc: [], indicator: [], document: [], managementReview: [], change: [], supplier: [], integration: [] },
    clauses: clauses.map((clause) => ({ id: clause.id, code: clause.code, title: clause.title, standardCode: clause.standard.code, standardName: clause.standard.name })),
    standards: standards.map((item) => item.standard),
    members: directoryPayload(memberAccessFor(can), members.map((membership) => ({ id: membership.user.id, name: membership.user.name, email: membership.user.email, role: membership.role }))),
  };
}

export async function getChangesPayload() {
  const { ctx, can } = await requireAuthorization("changes:read");
  assertPlanModule(ctx, "changes");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
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
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.changeIds } } : {}) },
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
    access.processes ? prisma.process.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.processIds } } : {}) }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    access.documents ? prisma.document.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}) }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    access.risks ? prisma.risk.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.riskIds } } : {}) }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    access.training ? prisma.trainingCourse.findMany({ where: { organizationId, active: true }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    access.nonconformities ? prisma.nonconformity.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.nonconformityIds } } : {}) }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: { canCreate: can("changes:create"), canUpdate: can("changes:update"), canDelete: can("changes:delete"), currentUserId: ctx.user.id },
    members: canManage && can("members:directory") ? members : [],
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
  assertPlanModule(ctx, "suppliers");
  const organizationId = ctx.organization.id;
  const scope = await getCollaboratorScope(ctx);
  const canManage = can("suppliers:create") || can("suppliers:update");
  const linkedAccess = { documents: can("documents:read"), risks: can("risks:read"), nonconformities: can("nc:read") };
  const [suppliers, members, documents, risks, nonconformities] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.supplierIds } } : {}) },
      include: {
        documents: { select: { documentId: true } },
        risks: { select: { riskId: true } },
        nonconformities: { select: { nonconformityId: true } },
        evaluations: { orderBy: { evaluatedAt: "desc" }, take: 12 },
      },
      orderBy: [{ criticality: "desc" }, { name: "asc" }],
    }),
    getOrganizationMembers(organizationId),
    linkedAccess.documents ? prisma.document.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}) }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    linkedAccess.risks ? prisma.risk.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.riskIds } } : {}) }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    linkedAccess.nonconformities ? prisma.nonconformity.findMany({ where: { organizationId, ...(scope.isScoped ? { id: { in: scope.nonconformityIds } } : {}) }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  return {
    access: { canCreate: can("suppliers:create"), canUpdate: can("suppliers:update"), canDelete: can("suppliers:delete") },
    members: canManage && can("members:directory") ? members : [],
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
  assertPlanModule(ctx, "integrations");
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
export type OpportunitiesPayload = Awaited<ReturnType<typeof getOpportunitiesPayload>>;
export type AuditsPayload = Awaited<ReturnType<typeof getAuditsPayload>>;
export type NonconformitiesPayload = Awaited<ReturnType<typeof getNonconformitiesPayload>>;
export type IndicatorsPayload = Awaited<ReturnType<typeof getIndicatorsPayload>>;
export type EvidencePayload = Awaited<ReturnType<typeof getEvidencePayload>>;
export type ChangesPayload = Awaited<ReturnType<typeof getChangesPayload>>;
export type SuppliersPayload = Awaited<ReturnType<typeof getSuppliersPayload>>;
export type IntegrationsPayload = Awaited<ReturnType<typeof getIntegrationsPayload>>;

// ─── ACPM / CAPA live ───────────────────────────────────────────────

export async function getCAPAPayload() {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const organizationId = ctx.organization.id;
  if (!can("actions:read")) {
    return { capas: [], members: [], processes: [], clauses: [], standards: [], access: { canCreate: false, canUpdate: false, canApprove: false, canExport: false } };
  }
  const contributorScope = ctx.scoped;
  const memberAccess = memberAccessFor(can);
  const canReadMembers = memberAccess !== "none";
  const [capas, members, processes, clauses, standards] = await Promise.all([
    prisma.cAPA.findMany({
      where: { organizationId, ...(contributorScope ? { OR: [{ ownerId: ctx.user.id }, { requestedById: ctx.user.id }] } : {}) },
      include: {
        clause: { include: { standard: { select: { code: true, name: true } } } },
        process: { select: { id: true, code: true, name: true } },
        owner: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        rootCauseApprovedBy: { select: { id: true, name: true } },
        verifier: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        evidences: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { id: true, name: true } } } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
      },
      orderBy: [{ stage: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    canReadMembers ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { userId: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }),
    prisma.standardRequirement.findMany({ where: { standard: { orgStandards: { some: { organizationId } } } }, select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } }, orderBy: [{ standard: { code: "asc" } }, { order: "asc" }] }),
    prisma.organizationStandard.findMany({ where: { organizationId }, select: { standard: { select: { code: true, name: true, version: true } } }, orderBy: { standard: { code: "asc" } } }),
  ]);
  return {
    capas,
    members: directoryPayload(memberAccess, members.map((row) => row.user)),
    processes,
    clauses: clauses.map((row) => ({ id: row.id, code: row.code, title: row.title, standardCode: row.standard.code, standardName: row.standard.name })),
    standards: standards.map((row) => row.standard),
    access: { canCreate: can("actions:create"), canUpdate: can("actions:update"), canApprove: can("actions:approve"), canExport: can("actions:export") },
  };
}

export type CAPAPayload = Awaited<ReturnType<typeof getCAPAPayload>>;

// ─── Admin / Info / Catalogs / Records / ACPM — full payload ─────────

export async function getAdminPayload() {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const organizationId = ctx.organization.id;

  // Backfill organizations created before the default catalogs were added.
  // This is idempotent and keeps existing tenants usable without a manual DB task.
  try {
    await ensureOrganizationDefaults(organizationId);
  } catch (error) {
    console.error("[admin-payload] unable to ensure organization defaults", error);
  }

  const currentUserId = ctx.user.id;
  const scope = await getCollaboratorScope(ctx);
  const canReadOrganization = can("org:*");
  const memberAccess = memberAccessFor(can);
  // De esta lista comen dos consumidores con necesidades distintas: la pantalla
  // de usuarios, que pinta la ficha entera, y los selectores de responsable,
  // revisor y aprobador de media aplicación, a los que les basta el nombre.
  // Exigir `members:view` para ambos dejaba sin gente los desplegables de quien
  // solo tiene `members:directory` —el contribuidor—, que es justo el permiso
  // que existe para poder asignar. El recorte por grado lo hace
  // `directoryPayload` más abajo, y la pantalla de usuarios sigue cerrada por
  // su propio `ServerPermissionGate permission="members:*"`.
  const canReadMembers = memberAccess !== "none";
  const canReadGroups = can("groups:read");
  const canReadPositions = can("positions:read");
  const canReadPersonnel = can("personnel:read");
  const canReadLocations = can("locations:read");
  const canReadCatalogs = can("catalogs:read");
  const canReadRecords = can("records:read");
  const canReadProcesses = can("processes:read");
  const canReadActions = can("actions:read");
  const recordsScopedToAssignedProcess = scope.isScoped;

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
    clauses,
    processes,
    records,
    recordEntries,
    actions,
    actionComments,
    organizationStandards,
    catalogItems,
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
        processLinks: { select: { processId: true } },
        moduleLinks: { select: { module: true } },
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
    canReadRecords ? prisma.standardRequirement.findMany({ where: { standard: { orgStandards: { some: { organizationId } } } }, select: { id: true, code: true, title: true, standard: { select: { code: true, name: true } } }, orderBy: [{ standard: { code: "asc" } }, { order: "asc" }] }) : Promise.resolve([]),
    canReadRecords && canReadProcesses ? prisma.process.findMany({ where: { organizationId, ...(recordsScopedToAssignedProcess ? { id: { in: scope.processIds } } : {}) }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    canReadRecords ? prisma.record.findMany({ where: { organizationId, ...(recordsScopedToAssignedProcess ? { id: { in: scope.recordIds } } : {}) }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }) : Promise.resolve([]),
    canReadRecords ? prisma.recordEntry.findMany({
      where: { record: { organizationId, ...(recordsScopedToAssignedProcess ? { id: { in: scope.recordIds } } : {}) } },
      orderBy: { enteredAt: "desc" },
    }) : Promise.resolve([]),
    canReadActions ? prisma.action.findMany({
      where: { organizationId, ...(scope.isScoped ? { id: { in: scope.actionIds } } : {}) },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
    canReadActions ? prisma.actionComment.findMany({
      where: { action: { organizationId, ...(scope.isScoped ? { id: { in: scope.actionIds } } : {}) } },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
    canReadOrganization ? prisma.organizationStandard.findMany({
      where: { organizationId },
      select: { standard: { select: { code: true, name: true, version: true } } },
      orderBy: { standard: { code: "asc" } },
    }) : Promise.resolve([]),
    canReadCatalogs ? prisma.organizationCatalogItem.findMany({
      where: { organizationId },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }) : Promise.resolve([]),
  ]);

  const lastEntryAtByRecord = new Map<string, string>();
  const processNames = new Map(processes.map((process) => [process.id, process]));
  recordEntries.forEach((e) => {
    const cur = lastEntryAtByRecord.get(e.recordId);
    const iso = e.entryDate.toISOString();
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
    groupPermissions: authorization.groupPermissions,
    organization: {
      name: ctx.organization.name,
      industry: canReadOrganization ? ctx.organization.industry : null,
      country: canReadOrganization ? ctx.organization.country : "",
      size: canReadOrganization ? ctx.organization.size : null,
      logoUrl: canReadOrganization ? ctx.organization.logoUrl : null,
      contactName: canReadOrganization ? ctx.organization.contactName : null,
      contactEmail: canReadOrganization ? ctx.organization.contactEmail : null,
      contactPhone: canReadOrganization ? ctx.organization.contactPhone : null,
      website: canReadOrganization ? ctx.organization.website : null,
      address: canReadOrganization ? ctx.organization.address : null,
      standards: organizationStandards.map((item) => item.standard.code),
      plan: ctx.organization.plan as "STARTER" | "GROWTH" | "ENTERPRISE",
    },
    /* Sin filtro por alcance: el alcance acota los registros de los que
       alguien es responsable, no la agenda de a quién puede nombrar. Recortada
       a uno mismo, un contribuidor solo podía asignarse a sí mismo. */
    members: directoryPayload(memberAccess, memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      active: m.active,
      scoped: m.scoped,
      deactivatedAt: m.deactivatedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      isSelf: m.userId === currentUserId,
    }))),
    groups: (scope.isScoped ? [] : groups).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      permissions: g.permissions.map((p) => p.permission),
      memberIds: g.members.map((m) => m.userId),
      processIds: g.processLinks.map((link) => link.processId),
      modules: g.moduleLinks.map((link) => link.module),
      createdAt: g.createdAt.toISOString(),
    })),
    catalogItems: catalogItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      description: item.description,
      active: item.active,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    positions: (scope.isScoped ? [] : positions).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      createdAt: p.createdAt.toISOString(),
    })),
    /* Mismo criterio que con los miembros, y por el mismo motivo: sin esta
       lista el selector de custodio sale vacío y el alta de un registro se
       queda a medias. A quien está acotado le llegan los nombres, que es lo que
       un selector necesita; el contacto y los datos de plantilla —correo,
       identificación, fecha de alta— se quedan fuera, igual que
       `directoryPayload` hace con el correo de los miembros. */
    personnel: personnel.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: scope.isScoped ? null : p.email,
      identification: scope.isScoped ? null : p.identification,
      positionId: p.positionId,
      active: p.active,
      hiredAt: scope.isScoped ? null : p.hiredAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    locations: (scope.isScoped ? [] : locations).map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      active: l.active,
      createdAt: l.createdAt.toISOString(),
    })),
    retentionTimes: (scope.isScoped ? [] : retentionTimes).map((r) => ({
      id: r.id,
      name: r.name,
      months: r.months,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
    dispositions: (scope.isScoped ? [] : dispositions).map((d) => ({
      id: d.id,
      name: d.name,
      active: d.active,
      createdAt: d.createdAt.toISOString(),
    })),
    archiveMethods: (scope.isScoped ? [] : archiveMethods).map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
    })),
    recordTypes: (scope.isScoped ? [] : recordTypes).map((t) => ({
      id: t.id,
      code: t.code,
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
      clauseId: r.clauseId,
      recordTypeId: r.recordTypeId,
      retentionTimeId: r.retentionTimeId,
      dispositionId: r.dispositionId,
      archiveMethodId: r.archiveMethodId,
      custodianId: r.custodianId,
      reviewerId: r.reviewerId,
      reviewStatus: r.reviewStatus,
      reviewComment: r.reviewComment,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
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
      title: e.title,
      entryDate: e.entryDate.toISOString(),
      status: e.status,
      responsibleId: e.responsibleId,
      enteredAt: e.enteredAt.toISOString(),
    })),
    clauses: clauses.map((clause) => ({ id: clause.id, code: clause.code, title: clause.title, standardCode: clause.standard.code, standardName: clause.standard.name })),
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
  /* La preferencia de avisos existía en el esquema y la respetaba el envío,
     pero nadie la leía para la pantalla: sin esto no había forma de saber qué
     tenía marcado el usuario. Ausente = los valores por defecto que ya aplica
     `notify.ts`, para que la pantalla no discrepe del comportamiento real. */
  const preference = await prisma.notificationPreference.findUnique({
    where: { organizationId_userId: { organizationId: ctx.organization.id, userId: ctx.user.id } },
    select: { emailEnabled: true, disabledTypes: true },
  });
  return {
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    /* Se entrega firmada, no como ruta: el cliente no puede firmar y una ruta
       cruda no es cargable desde el navegador. */
    avatarUrl: ctx.user.avatarUrl
      ? await createSignedAvatarUrl(ctx.user.avatarUrl, ctx.organization.id)
      : null,
    organizationId: ctx.organization.id,
    organizationName: ctx.organization.name,
    role: ctx.role,
    notifications: {
      emailEnabled: preference?.emailEnabled ?? true,
      disabledTypes: preference?.disabledTypes ?? [],
    },
    delegations: (await delegationsFor(ctx.organization.id, ctx.user.id)).map((row) => ({
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reason: row.reason,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      toUser: row.toUser,
    })),
    /* Compañeros de la organización, para elegir suplente. Se excluye uno
       mismo: delegarse a sí mismo no significa nada. */
    sessions: await listUserSessions(ctx.user.authUserId),
    colleagues: (await prisma.user.findMany({
      where: {
        id: { not: ctx.user.id },
        memberships: { some: { organizationId: ctx.organization.id, active: true } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 200,
    })),
  };
}

export async function getBillingPayload() {
  const { ctx, can } = await requireAuthorization("billing:read");
  const organizationId = ctx.organization.id;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [subscription, invoices, users, documents, audits, exportsThisMonth, storageUsage] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId } }),
    prisma.billingInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.membership.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.audit.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    prisma.reportExport.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { storageBytes: true } }),
  ]);
  const plan = subscription?.plan ?? ctx.organization.plan;
  const limits = PLANS[plan].limits;
  const entitlements = planEntitlements(plan, ctx.organization.trialEndsAt);
  const storageBytes = storageUsage.storageBytes;
  return {
    plan,
    status: subscription?.status ?? null,
    hasStripeSubscription: Boolean(subscription?.stripeSubscriptionId),
    trialActive: isTrialActive(ctx.organization.trialEndsAt),
    trialEndsAt: ctx.organization.trialEndsAt?.toISOString() ?? null,
    trialDaysRemaining: ctx.organization.trialEndsAt ? Math.max(0, Math.ceil((ctx.organization.trialEndsAt.getTime() - Date.now()) / 86400000)) : null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    stripeConfigured: isStripeConfigured(),
    checkoutConfigured: { STARTER: isPlanCheckoutConfigured("STARTER"), GROWTH: isPlanCheckoutConfigured("GROWTH") },
    canManage: can("billing:*"),
    entitlements,
    plans: Object.entries(PLANS).map(([key, item]) => ({
      key,
      name: item.name,
      price: item.price,
      currency: item.currency,
      features: item.features,
      checkoutConfigured: key === "STARTER" || key === "GROWTH" ? isPlanCheckoutConfigured(key as "STARTER" | "GROWTH") : false,
    })),
    usage: {
      users,
      userLimit: limits.users,
      storageBytes,
      storageLimitGb: limits.storage,
      documents,
      auditsThisMonth: audits,
      exportsThisMonth,
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
    select: { id: true, reportType: true, format: true, dateFrom: true, dateTo: true, rowCount: true, fileName: true, mimeType: true, storagePath: true, fileSize: true, checksum: true, status: true, error: true, completedAt: true, title: true, filters: true, createdAt: true, generatedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return {
    canExport: can("reporting:export"),
    organizationName: ctx.organization.name,
    logoUrl: ctx.organization.logoUrl,
    currentUser: ctx.user.name,
    standards: await prisma.organizationStandard.findMany({ where: { organizationId: ctx.organization.id }, select: { standard: { select: { code: true, name: true } } }, orderBy: { standard: { code: "asc" } } }),
    exports: exports.map(item => ({
      id: item.id,
      reportType: item.reportType,
      format: item.format,
      dateFrom: item.dateFrom.toISOString(),
      dateTo: item.dateTo.toISOString(),
      rowCount: item.rowCount,
      fileName: item.fileName,
      title: item.title,
      filters: item.filters,
      hasContent: Boolean(item.storagePath),
      status: item.status,
      fileSize: item.fileSize,
      checksum: item.checksum,
      error: item.error,
      completedAt: item.completedAt?.toISOString() ?? null,
      generatedBy: item.generatedBy?.name ?? "Sistema",
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export type ReportingPayload = Awaited<ReturnType<typeof getReportingPayload>>;

export async function getManagementReviewPayload() {
  const { ctx, can } = await requireAuthorization("mgmt-review:read");
  assertPlanModule(ctx, "management-review");
  const organizationId = ctx.organization.id;
  const canManage = can("mgmt-review:*");
  const [reviews, members, standards, evidenceFiles, audits, indicators, risks, nonconformities, actions, capas] = await Promise.all([
    prisma.managementReview.findMany({
      where: { organizationId },
      include: {
        inputs: { orderBy: { createdAt: "asc" } },
        decisions: { orderBy: { createdAt: "asc" }, include: { action: { select: { id: true, title: true, status: true, ownerId: true, dueDate: true } } } },
        participants: { include: { user: { select: { id: true, name: true } } } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true, evidenceType: true } } } },
        _count: { select: { actions: true } },
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    }),
    getOrganizationMembers(organizationId),
    canManage ? prisma.organizationStandard.findMany({ where: { organizationId }, select: { standard: { select: { code: true, name: true, version: true } } }, orderBy: { standard: { code: "asc" } } }) : Promise.resolve([]),
    canManage ? prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true, evidenceType: true }, orderBy: { createdAt: "desc" }, take: 500 }) : Promise.resolve([]),
    canManage ? prisma.audit.findMany({ where: { organizationId }, select: { id: true, title: true, standardCode: true }, orderBy: { createdAt: "desc" }, take: 200 }) : Promise.resolve([]),
    canManage ? prisma.indicator.findMany({ where: { organizationId }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" }, take: 200 }) : Promise.resolve([]),
    canManage ? prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true, status: true }, orderBy: { title: "asc" }, take: 200 }) : Promise.resolve([]),
    canManage ? prisma.nonconformity.findMany({ where: { organizationId }, select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 200 }) : Promise.resolve([]),
    canManage ? prisma.action.findMany({ where: { organizationId }, select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 200 }) : Promise.resolve([]),
    canManage ? prisma.cAPA.findMany({ where: { organizationId }, select: { id: true, code: true, title: true, stage: true }, orderBy: { createdAt: "desc" }, take: 200 }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map(m => [m.id, m.name]));
  return {
    access: { canManage, canExport: can("mgmt-review:export"), canCreateAction: can("actions:create") },
    members: canManage && can("members:directory") ? members : [],
    standards: standards.map((item) => ({ code: item.standard.code, name: item.standard.name, version: item.standard.version })),
    evidenceFiles,
    sources: { audits, indicators, risks, nonconformities, actions, capas },
    reviews: reviews.map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      scheduledDate: r.scheduledDate?.toISOString() ?? null,
      heldAt: r.heldAt?.toISOString() ?? null,
      chairId: r.chairId,
      chairName: r.chairId ? memberNames.get(r.chairId) ?? null : null,
      attendees: r.attendees,
      standards: r.standards,
      participants: r.participants.map((participant) => ({ id: participant.user.id, name: participant.user.name, role: participant.role })),
      evidenceLinks: r.evidenceLinks.map((link) => ({ id: link.evidence.id, title: link.evidence.title, evidenceType: link.evidence.evidenceType })),
      summary: r.summary,
      actionCount: r._count.actions,
      inputs: r.inputs.map(i => ({ id: i.id, topic: i.topic, content: i.content, auditId: i.auditId, indicatorId: i.indicatorId, riskId: i.riskId, nonconformityId: i.nonconformityId, actionId: i.actionId, capaId: i.capaId })),
      decisions: r.decisions.map(d => ({
        id: d.id,
        topic: d.topic,
        decision: d.decision,
        ownerId: d.ownerId,
        ownerName: d.ownerId ? memberNames.get(d.ownerId) ?? null : null,
        dueDate: d.dueDate?.toISOString() ?? null,
        actionId: d.action?.id ?? null,
        actionTitle: d.action?.title ?? null,
        actionStatus: d.action?.status ?? null,
        actionOwnerId: d.action?.ownerId ?? null,
      })),
    })),
  };
}

export type ManagementReviewPayload = Awaited<ReturnType<typeof getManagementReviewPayload>>;

export async function getAuditProgramPayload() {
  const { ctx, can } = await requireAuthorization("audit-program:read");
  const organizationId = ctx.organization.id;
  const canManage = can("audit-program:*");
  const [programs, members, processes, standards] = await Promise.all([
    prisma.auditProgram.findMany({
      where: { organizationId },
      include: {
        responsible: { select: { id: true, name: true } },
        audits: {
          select: { id: true, title: true, status: true, progress: true, plannedDate: true, scheduledDate: true, type: true, processId: true, process: { select: { id: true, code: true, name: true } }, auditorId: true },
          orderBy: [{ plannedDate: "asc" }, { scheduledDate: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ year: "desc" }, { title: "asc" }],
    }),
    getOrganizationMembers(organizationId),
    canManage ? prisma.process.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }) : Promise.resolve([]),
    prisma.organizationStandard.findMany({ where: { organizationId }, select: { standard: { select: { code: true, name: true, version: true } } } }),
  ]);
  const memberNames = new Map(members.map(m => [m.id, m.name]));
  return {
    access: { canManage, canExport: can("audit-program:export") },
    members: canManage && can("members:directory") ? members : [],
    processes,
    standards: standards.map((row) => row.standard),
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
        standards: p.standards,
        criteria: p.criteria,
        responsibleId: p.responsibleId,
        responsibleName: p.responsible?.name ?? null,
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
          plannedDate: a.plannedDate?.toISOString() ?? null,
          scheduledDate: a.scheduledDate?.toISOString() ?? null,
          processId: a.processId,
          processName: a.process?.name ?? null,
          processCode: a.process?.code ?? null,
          auditorId: a.auditorId,
        })),
      };
    }),
  };
}

export type AuditProgramPayload = Awaited<ReturnType<typeof getAuditProgramPayload>>;

// ─── Trial onboarding / activation ─────────────────────────────────────

export async function getOnboardingPayload() {
  const { ctx, can } = await requireAuthorization("dashboard:read");
  const organizationId = ctx.organization.id;
  const [org, standards, processes, documents, answers, risks, actions, templates, metricEvents] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true, industry: true, country: true, size: true, logoUrl: true, contactEmail: true,
        onboardingStatus: true, onboardingStep: true, onboardingGoal: true, onboardingStartedAt: true,
        onboardingCompletedAt: true, activationAt: true, trialEndsAt: true, plan: true,
      },
    }),
    prisma.organizationStandard.findMany({ where: { organizationId }, select: { standard: { select: { code: true, name: true, version: true } } }, orderBy: { standard: { code: "asc" } } }),
    prisma.process.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.assessmentAnswer.count({ where: { assessment: { organizationId } } }),
    prisma.risk.count({ where: { organizationId } }),
    prisma.action.count({ where: { organizationId } }),
    prisma.organizationCatalogItem.count({ where: { organizationId, kind: "DOCUMENT_TEMPLATE", active: true } }),
    prisma.onboardingMetricEvent.findMany({ where: { organizationId }, select: { event: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  if (!org) throw new Error("Organización no encontrada.");

  const items = [
    { id: "org-profile", title: "Completa el perfil de tu organización", description: "Añade sector y tamaño para contextualizar informes y auditorías.", href: "/app/settings/organization", done: Boolean(org.industry || org.contactEmail), weight: 1 },
    { id: "process", title: "Crea o confirma tu primer proceso", description: "Los procesos conectan documentos, riesgos, indicadores y auditorías.", href: "/app/processes", done: processes > 0, weight: 1 },
    { id: "document", title: "Carga tu primer documento", description: "Empieza por tu política, manual o procedimiento más importante.", href: "/app/documents", done: documents > 0, weight: 2 },
    { id: "gap", title: "Responde tu primer GAP", description: "Obtén una línea base de cumplimiento por cláusula ISO.", href: "/app/gap", done: answers > 0, weight: 2 },
    { id: "risk", title: "Registra tu primer riesgo", description: "Prioriza las amenazas y oportunidades que afectan tus objetivos.", href: "/app/risks", done: risks > 0, weight: 1 },
    { id: "action", title: "Crea tu primera acción", description: "Convierte una brecha o riesgo en una tarea con responsable y fecha.", href: "/app/actions", done: actions > 0, weight: 1 },
  ];
  const completed = items.filter((item) => item.done).length;
  const progressPct = Math.round((completed / items.length) * 100);
  const trialDaysRemaining = org.trialEndsAt ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86400000)) : null;

  return {
    organization: {
      name: org.name,
      industry: org.industry,
      country: org.country,
      size: org.size,
      contactEmail: org.contactEmail,
      standards: standards.map((item) => item.standard),
      plan: org.plan,
      status: org.onboardingStatus,
      step: org.onboardingStep,
      goal: org.onboardingGoal,
      startedAt: org.onboardingStartedAt?.toISOString() ?? null,
      completedAt: org.onboardingCompletedAt?.toISOString() ?? null,
      activationAt: org.activationAt?.toISOString() ?? null,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    },
    items,
    completed,
    progressPct,
    counts: { processes, documents, answers, risks, actions, templates },
    trialDaysRemaining,
    metrics: metricEvents.map((event) => ({ event: event.event, createdAt: event.createdAt.toISOString() })),
    billing: {
      canManage: can("billing:*") || can("org:*") || can("billing:update"),
      stripeConfigured: isStripeConfigured(),
      checkoutConfigured: { STARTER: isPlanCheckoutConfigured("STARTER"), GROWTH: isPlanCheckoutConfigured("GROWTH") },
      plans: Object.entries(PLANS).map(([key, plan]) => ({ key, name: plan.name, price: plan.price, features: plan.features })),
    },
  };
}

export type OnboardingPayload = Awaited<ReturnType<typeof getOnboardingPayload>>;

// ─── Setup / implementación guiada ─────────────────────────────────────

/**
 * Checklist de implementación derivado automáticamente de los datos reales
 * de la organización — cada paso se marca solo cuando el dato existe en la DB.
 */
export async function getSetupPayload() {
  const ctx = await requirePermission("dashboard:read");
  const organizationId = ctx.organization.id;

  const [
    standardsCount,
    membersCount,
    personnelCount,
    processesCount,
    documentsCount,
    approvedDocsCount,
    recordsCount,
    risksCount,
    indicatorsCount,
    trainingCount,
    auditsCount,
    actionsCount,
    reviewsCount,
    org,
  ] = await Promise.all([
    prisma.organizationStandard.count({ where: { organizationId } }),
    prisma.membership.count({ where: { organizationId } }),
    prisma.personnel.count({ where: { organizationId } }),
    prisma.process.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId, status: "APPROVED" } }),
    prisma.record.count({ where: { organizationId } }),
    prisma.risk.count({ where: { organizationId } }),
    prisma.indicator.count({ where: { organizationId } }),
    prisma.trainingCourse.count({ where: { organizationId } }),
    prisma.audit.count({ where: { organizationId } }),
    prisma.action.count({ where: { organizationId } }),
    prisma.managementReview.count({ where: { organizationId } }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { industry: true, logoUrl: true },
    }),
  ]);

  const items = [
    { id: "adopt-standard", block: "foundation" as const, title: "Activa tus normas ISO", description: "Adopta ISO 9001 / ISO 27001 para generar la evaluación GAP inicial con todas las cláusulas.", href: "/app/gap", weight: 3, done: standardsCount > 0 },
    { id: "org-profile", block: "foundation" as const, title: "Completa el perfil de la organización", description: "Sector y logo — aparecen en informes y exportaciones.", href: "/app/settings/organization", weight: 1, done: Boolean(org?.industry || org?.logoUrl) },
    { id: "invite-team", block: "foundation" as const, title: "Invita a tu equipo", description: "Añade al menos un miembro más con su rol (auditor, gestor de cumplimiento…).", href: "/app/settings/users", weight: 2, done: membersCount > 1 },
    { id: "personnel", block: "foundation" as const, title: "Registra el personal", description: "Fichas de personal para formación, cargos y firmas de documentos.", href: "/app/info/personnel", weight: 2, done: personnelCount > 0 },
    { id: "processes", block: "foundation" as const, title: "Mapea tus procesos", description: "El mapa de procesos es la columna vertebral del SGC.", href: "/app/processes", weight: 2, done: processesCount > 0 },
    { id: "first-document", block: "docs" as const, title: "Sube tu primer documento", description: "Política, manual o procedimiento — con control de versiones.", href: "/app/documents", weight: 2, done: documentsCount > 0 },
    { id: "approved-document", block: "docs" as const, title: "Aprueba un documento", description: "Completa el flujo borrador → revisión → aprobación.", href: "/app/documents", weight: 3, done: approvedDocsCount > 0 },
    { id: "records", block: "docs" as const, title: "Crea un registro controlado", description: "Registros con retención, disposición y archivo definidos.", href: "/app/records", weight: 1, done: recordsCount > 0 },
    { id: "risks", block: "ops" as const, title: "Evalúa tus riesgos", description: "Matriz de riesgos con probabilidad, impacto y tratamiento.", href: "/app/risks", weight: 2, done: risksCount > 0 },
    { id: "indicators", block: "ops" as const, title: "Define indicadores (KPIs)", description: "Objetivos medibles con metas y seguimiento periódico.", href: "/app/indicators", weight: 2, done: indicatorsCount > 0 },
    { id: "training", block: "ops" as const, title: "Planifica la formación", description: "Cursos y asignaciones de formación al personal.", href: "/app/training", weight: 1, done: trainingCount > 0 },
    { id: "audit", block: "assurance" as const, title: "Programa una auditoría interna", description: "Con plan, checklist y hallazgos.", href: "/app/audits", weight: 2, done: auditsCount > 0 },
    { id: "acpm", block: "assurance" as const, title: "Abre tu primera acción (ACPM)", description: "Acciones correctivas/preventivas con flujo de aprobación.", href: "/app/actions", weight: 2, done: actionsCount > 0 },
    { id: "mgmt-review", block: "assurance" as const, title: "Realiza la revisión por la dirección", description: "Entradas, decisiones y acciones derivadas.", href: "/app/management-review", weight: 2, done: reviewsCount > 0 },
  ];

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const doneWeight = items.filter((item) => item.done).reduce((sum, item) => sum + item.weight, 0);

  return {
    items,
    progressPct: totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0,
    counts: {
      documents: documentsCount,
      personnel: personnelCount,
      risks: risksCount,
      audits: auditsCount,
    },
  };
}

export type SetupPayload = Awaited<ReturnType<typeof getSetupPayload>>;
