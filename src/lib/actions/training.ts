"use server";

import { revalidatePath } from "next/cache";
import { TrainingAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyEmail } from "@/lib/notify";

const PATH = "/app/training";

export type TrainingCourseInput = {
  code: string;
  title: string;
  description?: string;
  standardTags?: string[];
  defaultValidityMonths: number;
  defaultDueDays: number;
  mandatory?: boolean;
  autoAssignOnDocApproval?: boolean;
  documentIds?: string[];
  audiencePersonnelIds?: string[];
};

export type TrainingAssignmentInput = {
  courseId: string;
  personnelId: string;
  processId?: string;
  dueAt: string;
  triggeredByDocumentId?: string;
  triggeredByVersion?: string;
};

function integerInRange(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} debe estar entre ${min} y ${max}.`);
  }
  return value;
}

function normalizeCourse(input: TrainingCourseInput) {
  const code = input.code.trim().toUpperCase();
  const title = input.title.trim();
  if (!code) throw new Error("El código del curso es obligatorio.");
  if (!title) throw new Error("El nombre del curso es obligatorio.");
  const documentIds = [...new Set(input.documentIds ?? [])];
  const audiencePersonnelIds = [...new Set(input.audiencePersonnelIds ?? [])];
  if (input.autoAssignOnDocApproval && (!documentIds.length || !audiencePersonnelIds.length)) {
    throw new Error("La asignación automática requiere al menos un documento y una persona destinataria.");
  }
  return {
    code,
    title,
    description: input.description?.trim() || null,
    standardTags: [...new Set((input.standardTags ?? []).map((tag) => tag.trim()).filter(Boolean))],
    defaultValidityMonths: integerInRange(input.defaultValidityMonths, 1, 120, "La vigencia"),
    defaultDueDays: integerInRange(input.defaultDueDays, 1, 365, "El plazo"),
    mandatory: Boolean(input.mandatory),
    autoAssignOnDocApproval: Boolean(input.autoAssignOnDocApproval),
    documentIds,
    audiencePersonnelIds,
  };
}

async function assertReferencesBelongToOrg(
  organizationId: string,
  documentIds: string[],
  personnelIds: string[],
) {
  const [documentCount, personnelCount] = await Promise.all([
    prisma.document.count({ where: { organizationId, id: { in: documentIds } } }),
    prisma.personnel.count({ where: { organizationId, active: true, id: { in: personnelIds } } }),
  ]);
  if (documentCount !== documentIds.length) throw new Error("Uno de los documentos no pertenece a la organización.");
  if (personnelCount !== personnelIds.length) throw new Error("Una de las personas no está activa o no pertenece a la organización.");
}

export async function createTrainingCourse(input: TrainingCourseInput): Promise<{ id: string }> {
  const ctx = await requirePermission("training:*");
  const data = normalizeCourse(input);
  await assertReferencesBelongToOrg(ctx.organization.id, data.documentIds, data.audiencePersonnelIds);

  const duplicate = await prisma.trainingCourse.findUnique({
    where: { organizationId_code: { organizationId: ctx.organization.id, code: data.code } },
  });
  if (duplicate) throw new Error(`Ya existe un curso con el código ${data.code}.`);

  const created = await prisma.trainingCourse.create({
    data: {
      organizationId: ctx.organization.id,
      code: data.code,
      title: data.title,
      description: data.description,
      standardTags: data.standardTags,
      defaultValidityMonths: data.defaultValidityMonths,
      defaultDueDays: data.defaultDueDays,
      mandatory: data.mandatory,
      autoAssignOnDocApproval: data.autoAssignOnDocApproval,
      documentLinks: { create: data.documentIds.map((documentId) => ({ documentId })) },
      audienceLinks: { create: data.audiencePersonnelIds.map((personnelId) => ({ personnelId })) },
    },
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: "training_course",
    recordId: created.id,
    after: {
      code: data.code,
      title: data.title,
      documentIds: data.documentIds,
      audiencePersonnelIds: data.audiencePersonnelIds,
    },
  });
  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateTrainingCourse(id: string, input: TrainingCourseInput): Promise<void> {
  const ctx = await requirePermission("training:*");
  const existing = await prisma.trainingCourse.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { documentLinks: true, audienceLinks: true },
  });
  if (!existing) throw new Error("Curso no encontrado.");

  const data = normalizeCourse(input);
  await assertReferencesBelongToOrg(ctx.organization.id, data.documentIds, data.audiencePersonnelIds);
  const duplicate = await prisma.trainingCourse.findFirst({
    where: { organizationId: ctx.organization.id, code: data.code, id: { not: id } },
  });
  if (duplicate) throw new Error(`Ya existe otro curso con el código ${data.code}.`);

  await prisma.$transaction(async (tx) => {
    await tx.trainingCourse.update({
      where: { id },
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        standardTags: data.standardTags,
        defaultValidityMonths: data.defaultValidityMonths,
        defaultDueDays: data.defaultDueDays,
        mandatory: data.mandatory,
        autoAssignOnDocApproval: data.autoAssignOnDocApproval,
      },
    });
    await tx.trainingCourseDocument.deleteMany({ where: { courseId: id } });
    await tx.trainingCourseAudience.deleteMany({ where: { courseId: id } });
    if (data.documentIds.length) {
      await tx.trainingCourseDocument.createMany({ data: data.documentIds.map((documentId) => ({ courseId: id, documentId })) });
    }
    if (data.audiencePersonnelIds.length) {
      await tx.trainingCourseAudience.createMany({ data: data.audiencePersonnelIds.map((personnelId) => ({ courseId: id, personnelId })) });
    }
  });

  await logAuditEvent({
    ctx,
    action: "update",
    module: "training_course",
    recordId: id,
    before: { code: existing.code, title: existing.title, active: existing.active },
    after: { ...data },
  });
  revalidatePath(PATH);
}

export async function setTrainingCourseActive(id: string, active: boolean): Promise<void> {
  const ctx = await requirePermission("training:*");
  const existing = await prisma.trainingCourse.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Curso no encontrado.");
  await prisma.trainingCourse.update({ where: { id }, data: { active } });
  await logAuditEvent({
    ctx,
    action: active ? "restore" : "archive",
    module: "training_course",
    recordId: id,
    before: { active: existing.active },
    after: { active },
  });
  revalidatePath(PATH);
}

export async function createTrainingAssignment(input: TrainingAssignmentInput): Promise<{ id: string }> {
  const ctx = await requirePermission("training:*");
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new Error("La fecha de vencimiento no es válida.");

  const [course, personnel, process, document] = await Promise.all([
    prisma.trainingCourse.findFirst({ where: { id: input.courseId, organizationId: ctx.organization.id, active: true } }),
    prisma.personnel.findFirst({ where: { id: input.personnelId, organizationId: ctx.organization.id, active: true } }),
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId: ctx.organization.id } }) : null,
    input.triggeredByDocumentId ? prisma.document.findFirst({ where: { id: input.triggeredByDocumentId, organizationId: ctx.organization.id } }) : null,
  ]);
  if (!course) throw new Error("Selecciona un curso activo.");
  if (!personnel) throw new Error("Selecciona una persona activa.");
  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.triggeredByDocumentId && !document) throw new Error("El documento no pertenece a la organización.");

  const openDuplicate = await prisma.trainingAssignment.findFirst({
    where: {
      organizationId: ctx.organization.id,
      courseId: course.id,
      personnelId: personnel.id,
      status: { notIn: [TrainingAssignmentStatus.COMPLETED, TrainingAssignmentStatus.CANCELLED] },
    },
  });
  if (openDuplicate) throw new Error("Esta persona ya tiene una asignación activa para el curso.");

  const created = await prisma.trainingAssignment.create({
    data: {
      organizationId: ctx.organization.id,
      courseId: course.id,
      personnelId: personnel.id,
      processId: process?.id ?? null,
      dueAt,
      triggeredByDocumentId: document?.id ?? null,
      triggeredByVersion: input.triggeredByVersion?.trim() || null,
      createdById: ctx.user.id,
    },
  });
  await logAuditEvent({
    ctx,
    action: "assign",
    module: "training_assignment",
    recordId: created.id,
    after: { courseId: course.id, personnelId: personnel.id, dueAt: dueAt.toISOString(), processId: process?.id ?? null },
  });

  await notifyEmail({
    organizationId: ctx.organization.id,
    to: personnel.email,
    name: `${personnel.firstName} ${personnel.lastName}`.trim(),
    title: `Formación asignada: ${course.title}`,
    body: `Se te ha asignado la formación «${course.title}». Fecha límite: ${dueAt.toLocaleDateString("es")}.`,
    link: "/app/training",
  });

  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateTrainingAssignment(
  id: string,
  patch: {
    status?: TrainingAssignmentStatus;
    processId?: string;
    dueAt?: string;
    evidenceNote?: string;
    evidenceUrl?: string;
  },
): Promise<void> {
  const ctx = await requirePermission("training:*");
  const existing = await prisma.trainingAssignment.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { personnel: true, course: true },
  });
  if (!existing) throw new Error("Asignación no encontrada.");

  if (patch.processId) {
    const process = await prisma.process.findFirst({ where: { id: patch.processId, organizationId: ctx.organization.id } });
    if (!process) throw new Error("El proceso no pertenece a la organización.");
  }

  const data: {
    status?: TrainingAssignmentStatus;
    processId?: string | null;
    dueAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    evidenceNote?: string | null;
    evidenceUrl?: string | null;
  } = {};
  if (patch.processId !== undefined) data.processId = patch.processId || null;
  if (patch.dueAt !== undefined) {
    const dueAt = new Date(patch.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new Error("La fecha de vencimiento no es válida.");
    data.dueAt = dueAt;
  }
  if (patch.evidenceNote !== undefined) data.evidenceNote = patch.evidenceNote.trim() || null;
  if (patch.evidenceUrl !== undefined) data.evidenceUrl = patch.evidenceUrl.trim() || null;
  if (patch.status !== undefined) {
    const allowedTransitions: Record<TrainingAssignmentStatus, TrainingAssignmentStatus[]> = {
      ASSIGNED: [TrainingAssignmentStatus.IN_PROGRESS, TrainingAssignmentStatus.OVERDUE, TrainingAssignmentStatus.CANCELLED],
      IN_PROGRESS: [TrainingAssignmentStatus.COMPLETED, TrainingAssignmentStatus.CANCELLED],
      OVERDUE: [TrainingAssignmentStatus.IN_PROGRESS, TrainingAssignmentStatus.CANCELLED],
      RETRAINING_REQUIRED: [TrainingAssignmentStatus.IN_PROGRESS, TrainingAssignmentStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (patch.status !== existing.status && !allowedTransitions[existing.status].includes(patch.status)) {
      throw new Error(`Transición ${existing.status} → ${patch.status} no permitida.`);
    }
    data.status = patch.status;
    if (patch.status === TrainingAssignmentStatus.IN_PROGRESS && !existing.startedAt) data.startedAt = new Date();
    if (patch.status === TrainingAssignmentStatus.COMPLETED) {
      const evidenceNote = patch.evidenceNote?.trim() || existing.evidenceNote;
      const evidenceUrl = patch.evidenceUrl?.trim() || existing.evidenceUrl;
      if (!evidenceNote && !evidenceUrl) throw new Error("Añade una nota o enlace de evidencia antes de completar.");
      data.completedAt = new Date();
    }
  }

  await prisma.trainingAssignment.update({ where: { id }, data });
  await logAuditEvent({
    ctx,
    action: patch.status ? "status_change" : "update",
    module: "training_assignment",
    recordId: id,
    before: { status: existing.status, dueAt: existing.dueAt.toISOString(), processId: existing.processId },
    after: { ...patch },
  });
  if ((patch.status !== undefined && patch.status !== existing.status) || patch.dueAt !== undefined) {
    const statusLabel = patch.status && patch.status !== existing.status ? ` Estado: ${patch.status.replaceAll("_", " ")}.` : "";
    const dueLabel = patch.dueAt ? ` Nueva fecha límite: ${new Date(patch.dueAt).toLocaleDateString("es")}.` : "";
    await notifyEmail({
      organizationId: ctx.organization.id,
      to: existing.personnel.email,
      name: `${existing.personnel.firstName} ${existing.personnel.lastName}`.trim(),
      title: `Actualización de formación: ${existing.course.title}`,
      body: `La asignación «${existing.course.title}» fue actualizada.${statusLabel}${dueLabel}`,
      link: PATH,
    });
  }
  revalidatePath(PATH);
}
