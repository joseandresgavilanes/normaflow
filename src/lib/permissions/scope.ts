import "server-only";

import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import type { LiveAppContext } from "@/lib/app-context";

export type CollaboratorScope = {
  processIds: string[];
  riskIds: string[];
  auditIds: string[];
  nonconformityIds: string[];
  actionIds: string[];
  documentIds: string[];
  recordIds: string[];
  indicatorIds: string[];
  opportunityIds: string[];
  changeIds: string[];
  trainingAssignmentIds: string[];
  trainingCourseIds: string[];
  personnelIds: string[];
  supplierIds: string[];
  isScoped: boolean;
};

/**
 * Alcance con el que nace una membresía.
 *
 * Es solo el punto de partida —después se cambia por membresía— pero tiene que
 * existir: una persona invitada como contribuidor debe quedar acotada sin que
 * nadie se acuerde de marcarlo, que es como funcionaba cuando el alcance se
 * deducía del nombre del rol.
 */
export function defaultScopedFor(role: Role): boolean {
  return role === "CONTRIBUTOR";
}

const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];

/**
 * Data scope for contributors. Permissions answer what a role may do; this
 * scope answers which records that role may see. Admins and auditors keep the
 * existing organization-wide behavior.
 */
export async function getCollaboratorScope(ctx: LiveAppContext): Promise<CollaboratorScope> {
  if (!ctx.scoped) {
    return {
      processIds: [], riskIds: [], auditIds: [], nonconformityIds: [], actionIds: [],
      documentIds: [], recordIds: [], indicatorIds: [], opportunityIds: [], changeIds: [],
      trainingAssignmentIds: [], trainingCourseIds: [], personnelIds: [], supplierIds: [], isScoped: false,
    };
  }

  const organizationId = ctx.organization.id;
  const userId = ctx.user.id;
  const [ownedProcesses, groupProcesses, reviewedRecords, directDocuments, directRisks, directIndicators, directTraining, directChanges] = await Promise.all([
    prisma.process.findMany({ where: { organizationId, ownerId: userId }, select: { id: true } }),
    // Ser dueño del proceso no es la única forma de estar asignado a él: la vía
    // normal es meter a la persona en un grupo y ligar el grupo a los procesos
    // (GroupMembership + GroupProcess, lo que escribe `setGroupAssociations`).
    // Sin leerlo aquí esa asignación no daba acceso a nada —el grupo solo servía
    // para conceder permisos extra—, así que invitar a alguien a un proceso se
    // quedaba en un gesto sin efecto.
    prisma.groupProcess.findMany({
      where: { group: { organizationId, members: { some: { userId } } } },
      select: { processId: true },
    }),
    prisma.record.findMany({ where: { organizationId, reviewerId: userId }, select: { id: true, processId: true } }),
    prisma.document.findMany({ where: { organizationId, OR: [{ ownerId: userId }, { approvals: { some: { approverId: userId } } }] }, select: { id: true, processId: true } }),
    prisma.risk.findMany({ where: { organizationId, ownerId: userId }, select: { id: true, processId: true } }),
    prisma.indicator.findMany({ where: { organizationId, ownerId: userId }, select: { id: true, processId: true } }),
    prisma.trainingAssignment.findMany({ where: { organizationId, personnel: { email: { equals: ctx.user.email, mode: "insensitive" } } }, select: { id: true, processId: true, courseId: true, personnelId: true } }),
    prisma.changeRequest.findMany({ where: { organizationId, OR: [{ requesterId: userId }, { approvers: { some: { userId } } }] }, select: { id: true, processes: { select: { processId: true } } } }),
  ]);

  const processIds = unique([
    ...ownedProcesses.map((row) => row.id),
    ...groupProcesses.map((row) => row.processId),
    ...reviewedRecords.map((row) => row.processId),
    ...directDocuments.map((row) => row.processId),
    ...directRisks.map((row) => row.processId),
    ...directIndicators.map((row) => row.processId),
    ...directTraining.map((row) => row.processId),
    ...directChanges.flatMap((row) => row.processes.map((link) => link.processId)),
  ]);

  const [risks, audits, nonconformities, actions, documents, records, indicators, opportunities, changes, trainingAssignments] = await Promise.all([
    prisma.risk.findMany({ where: { organizationId, OR: [{ ownerId: userId }, ...(processIds.length ? [{ processId: { in: processIds } }] : [])] }, select: { id: true } }),
    prisma.audit.findMany({ where: { organizationId, auditorId: userId }, select: { id: true } }),
    prisma.nonconformity.findMany({ where: { organizationId, OR: [{ ownerId: userId }, { audit: { auditorId: userId } }] }, select: { id: true } }),
    prisma.action.findMany({ where: { organizationId, OR: [{ ownerId: userId }, { requestedById: userId }, { requestApproverId: userId }, { solutionApproverId: userId }] }, select: { id: true } }),
    prisma.document.findMany({ where: { organizationId, OR: [{ ownerId: userId }, { approvals: { some: { approverId: userId } } }, ...(processIds.length ? [{ processId: { in: processIds } }] : [])] }, select: { id: true } }),
    prisma.record.findMany({ where: { organizationId, OR: [{ reviewerId: userId }, ...(processIds.length ? [{ processId: { in: processIds } }] : [])] }, select: { id: true } }),
    prisma.indicator.findMany({ where: { organizationId, OR: [{ ownerId: userId }, ...(processIds.length ? [{ processId: { in: processIds } }] : [])] }, select: { id: true } }),
    prisma.opportunity.findMany({ where: { organizationId, OR: [{ ownerId: userId }, { reviewerId: userId }] }, select: { id: true } }),
    prisma.changeRequest.findMany({ where: { organizationId, OR: [{ requesterId: userId }, { approvers: { some: { userId } } }, ...(processIds.length ? [{ processes: { some: { processId: { in: processIds } } } }] : [])] }, select: { id: true } }),
    prisma.trainingAssignment.findMany({ where: { organizationId, OR: [{ personnel: { email: { equals: ctx.user.email, mode: "insensitive" } } }, ...(processIds.length ? [{ processId: { in: processIds } }] : [])] }, select: { id: true, courseId: true, personnelId: true } }),
  ]);

  const riskIds = unique(risks.map((row) => row.id));
  const auditIds = unique(audits.map((row) => row.id));
  const nonconformityIds = unique(nonconformities.map((row) => row.id));
  const directActionIds = unique(actions.map((row) => row.id));

  const relatedActions = await prisma.action.findMany({
    where: {
      organizationId,
      OR: [
        ...(riskIds.length ? [{ riskId: { in: riskIds } }] : []),
        ...(nonconformityIds.length ? [{ nonconformityId: { in: nonconformityIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
      OR: [
        { ownerId: userId },
        ...(riskIds.length ? [{ risks: { some: { riskId: { in: riskIds } } } }] : []),
        ...(nonconformityIds.length ? [{ nonconformities: { some: { nonconformityId: { in: nonconformityIds } } } }] : []),
      ],
    },
    select: { id: true },
  });

  return {
    processIds,
    riskIds,
    auditIds,
    nonconformityIds,
    actionIds: unique([...directActionIds, ...relatedActions.map((row) => row.id)]),
    documentIds: unique(documents.map((row) => row.id)),
    recordIds: unique(records.map((row) => row.id)),
    indicatorIds: unique(indicators.map((row) => row.id)),
    opportunityIds: unique(opportunities.map((row) => row.id)),
    changeIds: unique(changes.map((row) => row.id)),
    trainingAssignmentIds: unique(trainingAssignments.map((row) => row.id)),
    trainingCourseIds: unique(trainingAssignments.map((row) => row.courseId)),
    personnelIds: unique(trainingAssignments.map((row) => row.personnelId)),
    supplierIds: unique(suppliers.map((row) => row.id)),
    isScoped: true,
  };
}

export function isCollaboratorScope(scope: CollaboratorScope) {
  return scope.isScoped;
}

export async function assertCollaboratorCanAccess(
  ctx: LiveAppContext,
  module: keyof Omit<CollaboratorScope, "isScoped">,
  id: string,
) {
  if (!ctx.scoped) return;
  const scope = await getCollaboratorScope(ctx);
  const ids = scope[module];
  if (!Array.isArray(ids) || !ids.includes(id)) {
    throw new Error("No tienes acceso a este registro porque no está asignado a tu usuario ni relacionado con tu revisión.");
  }
}

export async function assertCollaboratorProcessAccess(ctx: LiveAppContext, processId?: string | null) {
  if (!ctx.scoped || !processId) return;
  const scope = await getCollaboratorScope(ctx);
  if (!scope.processIds.includes(processId)) {
    throw new Error("Solo puedes trabajar con procesos asignados a tu usuario.");
  }
}
