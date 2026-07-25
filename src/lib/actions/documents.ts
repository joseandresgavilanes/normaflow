"use server";

import { revalidatePath } from "next/cache";
import { DocumentStatus, DocumentType, Prisma, ReportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization, requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { logAuditEvent, writeAuditLog, diff } from "@/lib/audit-log";
import {
  createSignedDownloadUrl,
  deleteDocumentFile,
  uploadDocumentFile,
  releaseStorageQuota,
} from "@/lib/storage";
import { assignTrainingForApprovedDocument } from "@/lib/training-automation";
import { notifyPersonnel, notifyUsers } from "@/lib/notify";
import { assertCollaboratorCanAccess, assertCollaboratorProcessAccess, getCollaboratorScope } from "@/lib/permissions/scope";
import { roleOrGroupCan } from "@/lib/permissions/matrix";
import { nextDocumentVersion } from "@/lib/document-version";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { renderTemplateContent, type TemplateField } from "@/lib/document-templates";
import { canPublishApprovedDocument, hasPendingAssignedApproval } from "@/lib/document-approval-workflow";
import { persistWithStorageCompensation } from "@/lib/storage-compensation";
import { parseId, parseInput } from "@/lib/validation/common";
import { documentContentSchema, documentInputSchema, documentReviewSchema } from "@/lib/validation/workflows";

/**
 * Server actions para Control de Documentos (Phase 1.2).
 *
 * Workflow: DRAFT → IN_REVIEW → APPROVED → OBSOLETE
 *
 * Reglas:
 *  - DRAFT puede editarse por cualquiera con documents:create / documents:*
 *  - Solo documents:* puede submit_review, approve, reject, obsolete
 *  - Versiones se acumulan en DocumentVersion (nunca se borran las aprobadas)
 *  - Cada acción emite AuditLog
 *  - Archivos viven en Supabase Storage bajo org-{id}/documents/{docId}/v{n}-...
 */

const PATH = "/app/documents";

// ─── Helpers internos ─────────────────────────────────────────────────

async function loadDocument(documentId: string, organizationId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    include: { versions: { orderBy: { createdAt: "desc" } }, approvals: true },
  });
  if (!doc) throw new Error("Documento no encontrado.");
  return doc;
}

/** Owner user id of the process a document belongs to (the "process owner"), if any. */
async function documentProcessOwnerId(processId: string | null, organizationId: string): Promise<string | null> {
  if (!processId) return null;
  const process = await prisma.process.findFirst({
    where: { id: processId, organizationId },
    select: { ownerId: true },
  });
  return process?.ownerId ?? null;
}

// ─── CRUD básico ──────────────────────────────────────────────────────

export type CreateDocumentInput = {
  code: string;
  title: string;
  type: DocumentType;
  ownerId?: string;
  processId?: string;
  clauseId?: string;
  standardCode?: string;
  reviewDate?: string;
  tags?: string[];
  observations?: string;
  distributionList?: string[];
  locationId?: string;
  physicalLocation?: string;
  responsibleElaborationId?: string;
  responsibleApprovalId?: string;
  custodianId?: string;
  isExternal?: boolean;
  externalLink?: string;
};

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha de revisión no es válida.");
  return date;
}

function normalizedTags(tags?: string[]) {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

async function assertDocumentReferences(input: Partial<CreateDocumentInput>, organizationId: string) {
  const personnelIds = [...new Set([
    input.responsibleElaborationId,
    input.responsibleApprovalId,
    input.custodianId,
  ].filter((id): id is string => Boolean(id)))];
  const [process, location, personnelCount, owner, clause, standard] = await Promise.all([
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId }, select: { id: true } }) : null,
    input.locationId ? prisma.location.findFirst({ where: { id: input.locationId, organizationId }, select: { id: true } }) : null,
    personnelIds.length ? prisma.personnel.count({ where: { id: { in: personnelIds }, organizationId } }) : 0,
    input.ownerId ? prisma.membership.findFirst({ where: { userId: input.ownerId, organizationId }, select: { id: true } }) : null,
    input.clauseId ? prisma.standardRequirement.findFirst({
      where: { id: input.clauseId, standard: { orgStandards: { some: { organizationId } } } },
      select: { id: true, standard: { select: { family: { select: { code: true } } } } },
    }) : null,
    input.standardCode ? prisma.standardEdition.findFirst({
      where: { family: { code: input.standardCode }, orgStandards: { some: { organizationId } } },
      select: { code: true },
    }) : null,
  ]);
  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.locationId && !location) throw new Error("La ubicación no pertenece a la organización.");
  if (personnelCount !== personnelIds.length) throw new Error("Una de las personas seleccionadas no pertenece a la organización.");
  if (input.ownerId && !owner) throw new Error("El responsable no pertenece a la organización.");
  if (input.clauseId && !clause) throw new Error("La cláusula no pertenece a una norma habilitada para la organización.");
  if (input.standardCode && !standard) throw new Error("La norma no está habilitada para la organización.");
  if (clause && input.standardCode && clause.standard.family.code !== input.standardCode) {
    throw new Error("La cláusula seleccionada no corresponde a la norma indicada.");
  }
  dateOrNull(input.reviewDate);
}

/** Only users with an explicit document approval grant may be assigned as approvers. */
async function assertDocumentApprovers(organizationId: string, approverIds: string[]) {
  const ids = [...new Set(approverIds.filter(Boolean))];
  if (ids.length === 0) throw new Error("Indica al menos una persona aprobadora.");

  const memberships = await prisma.membership.findMany({
    where: { organizationId, active: true, userId: { in: ids } },
    select: { userId: true, role: true },
  });
  if (memberships.length !== ids.length) throw new Error("Una de las personas aprobadoras no pertenece a la organización.");

  const groupMemberships = await prisma.groupMembership.findMany({
    where: { userId: { in: ids }, group: { organizationId } },
    select: { userId: true, group: { select: { permissions: { select: { permission: true } } } } },
  });
  const permissionsByUser = new Map<string, string[]>();
  for (const membership of groupMemberships) {
    const current = permissionsByUser.get(membership.userId) ?? [];
    current.push(...membership.group.permissions.map((permission) => permission.permission));
    permissionsByUser.set(membership.userId, current);
  }

  const unauthorized = memberships.find((membership) => {
    const groupPermissions = permissionsByUser.get(membership.userId) ?? [];
    return !roleOrGroupCan(membership.role, groupPermissions, "documents:approve");
  });
  if (unauthorized) throw new Error("Todos los revisores deben tener permiso para aprobar documentos.");
  return ids;
}

export async function createDocument(input: CreateDocumentInput): Promise<{ id: string }> {
  input = parseInput(documentInputSchema, input) as CreateDocumentInput;
  const ctx = await requirePermission("documents:create");
  if (ctx.role === "CONTRIBUTOR") {
    await assertCollaboratorProcessAccess(ctx, input.processId);
    input = { ...input, ownerId: ctx.user.id };
  }
  await assertDocumentReferences(input, ctx.organization.id);

  const code = input.code.trim();
  const title = input.title.trim();
  if (!code) throw new Error("El código es obligatorio.");
  if (!title) throw new Error("El título es obligatorio.");

  const existing = await prisma.document.findUnique({
    where: { organizationId_code: { organizationId: ctx.organization.id, code } },
  });
  if (existing) throw new Error(`Ya existe un documento con código ${code}.`);

  const created = await prisma.document.create({
    data: {
      organizationId: ctx.organization.id,
      code,
      title,
      type: input.type,
      status: DocumentStatus.DRAFT,
      processId: input.processId ?? null,
      clauseId: input.clauseId ?? null,
      standardCode: input.standardCode ?? null,
      ownerId: input.ownerId || ctx.user.id,
      reviewDate: dateOrNull(input.reviewDate),
      tags: normalizedTags(input.tags),
      observations: input.observations?.trim() || null,
      distributionList: input.distributionList ?? [],
      locationId: input.locationId ?? null,
      physicalLocation: input.physicalLocation?.trim() || null,
      responsibleElaborationId: input.responsibleElaborationId ?? null,
      responsibleApprovalId: input.responsibleApprovalId ?? null,
      custodianId: input.custodianId ?? null,
      isExternal: input.isExternal ?? false,
      externalLink: input.externalLink?.trim() || null,
      currentVersion: "1.0",
    },
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: "document",
    recordId: created.id,
    after: { code, title, type: input.type, status: "DRAFT" },
  });

  await notifyUsers(
    [created.ownerId],
    {
      organizationId: ctx.organization.id,
      title: "Se te asignó un documento",
      body: `${created.code} - «${created.title}» quedó bajo tu responsabilidad. Revisa sus metadatos y envíalo a revisión cuando tenga una versión cargada.`,
      type: "INFO",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  await notifyPersonnel({
    organizationId: ctx.organization.id,
    personnelIds: [created.responsibleElaborationId, created.responsibleApprovalId, created.custodianId],
    title: "Responsabilidad documental asignada",
    body: `${created.code} - «${created.title}» te fue asignado dentro del control documental. Revisa tu responsabilidad en NormaFlow.`,
    link: PATH,
  });

  revalidatePath(PATH);
  return { id: created.id };
}

export type CreateDocumentFromTemplateInput = {
  code: string;
  title?: string;
  processId?: string;
  ownerId?: string;
  reviewDate?: string;
  fields?: Record<string, string>;
};

/** Creates a controlled draft and its first version from the global template catalog. */
export async function createDocumentFromTemplate(
  templateId: string,
  input: CreateDocumentFromTemplateInput,
): Promise<{ id: string; version: string }> {
  const ctx = await requirePermission("documents:create");
  const template = await prisma.documentTemplate.findFirst({ where: { id: templateId, isActive: true } });
  if (!template) throw new Error("La plantilla no existe o está inactiva.");

  const code = input.code.trim();
  const title = (input.title?.trim() || template.title).trim();
  if (!code) throw new Error("El código es obligatorio.");
  if (!title) throw new Error("El título es obligatorio.");
  if (code.length > 80 || title.length > 240) throw new Error("El código o título supera el límite permitido.");
  const duplicate = await prisma.document.findUnique({ where: { organizationId_code: { organizationId: ctx.organization.id, code } } });
  if (duplicate) throw new Error(`Ya existe un documento con código ${code}.`);

  const ownerId = ctx.role === "CONTRIBUTOR" ? ctx.user.id : (input.ownerId || ctx.user.id);
  const fields = input.fields ?? {};
  const schema = Array.isArray(template.fieldSchema) ? template.fieldSchema as unknown as TemplateField[] : [];
  for (const field of schema) {
    if (field.required && !fields[field.key]?.trim()) throw new Error(`Completa el campo «${field.label}».`);
  }
  await assertDocumentReferences({ processId: input.processId, ownerId, clauseId: template.clauseId ?? undefined, standardCode: template.standardCode, reviewDate: input.reviewDate }, ctx.organization.id);

  const organization = ctx.organization as typeof ctx.organization & { industry?: string | null; country?: string | null };
  const values: Record<string, string | undefined> = {
    ORGANIZATION_NAME: organization.name,
    ORGANIZATION_INDUSTRY: organization.industry ?? undefined,
    ORGANIZATION_COUNTRY: organization.country ?? undefined,
    DOCUMENT_CODE: code,
    VERSION: "1.0",
    EFFECTIVE_DATE: fields.EFFECTIVE_DATE || new Date().toISOString().slice(0, 10),
    OWNER_NAME: fields.OWNER_NAME || ctx.user.name,
    APPROVER_NAME: fields.APPROVER_NAME,
    ...fields,
  };
  const content = renderTemplateContent(template.content, values);
  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        organizationId: ctx.organization.id,
        code,
        title,
        type: template.documentType,
        status: DocumentStatus.DRAFT,
        clauseId: template.clauseId,
        standardCode: template.standardCode,
        processId: input.processId ?? null,
        ownerId,
        reviewDate: dateOrNull(input.reviewDate),
        content,
        templateId: template.id,
        currentVersion: "1.0",
        tags: template.tags,
        observations: `Creado desde la plantilla ${template.code}. Edita el contenido antes de enviarlo a revisión.`,
      },
    });
    await tx.documentVersion.create({
      data: {
        documentId: document.id,
        version: "1.0",
        status: "DRAFT",
        content,
        changeDescription: `Creación desde plantilla ${template.code}`,
        changeLog: `Creación desde plantilla ${template.code}`,
        createdById: ctx.user.id,
      },
    });
    return document;
  });

  await logAuditEvent({
    ctx,
    action: "create_from_template",
    module: "document",
    recordId: created.id,
    after: { code, title, templateId: template.id, templateCode: template.code, version: "1.0", status: "DRAFT" },
  });
  revalidatePath(PATH);
  return { id: created.id, version: "1.0" };
}

export async function updateDocumentContent(
  documentId: string,
  args: { content: string; changeDescription: string; bump?: "minor" | "major" },
): Promise<{ version: string }> {
  documentId = parseId(documentId);
  args = parseInput(documentContentSchema, args);
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const existing = await loadDocument(documentId, ctx.organization.id);
  await assertCollaboratorCanAccess(ctx, "documentIds", documentId);
  if (existing.status === DocumentStatus.OBSOLETE) throw new Error("No se puede editar un documento obsoleto.");
  if (existing.status === DocumentStatus.APPROVED && !can("documents:*") ) throw new Error("Un documento aprobado requiere una nueva versión gestionada por un administrador.");
  const content = args.content.trim();
  const changeDescription = args.changeDescription.trim();
  if (!content) throw new Error("El contenido es obligatorio.");
  if (!changeDescription) throw new Error("Describe el cambio para mantener la trazabilidad.");
  if (content.length > 500_000) throw new Error("El contenido supera el límite permitido.");
  const version = nextDocumentVersion(existing.currentVersion, existing.versions, args.bump ?? "minor");
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: documentId }, data: { content, currentVersion: version } });
    await tx.documentVersion.create({
      data: {
        documentId,
        version,
        status: existing.status === DocumentStatus.IN_REVIEW ? "PENDING" : "DRAFT",
        content,
        previousVersion: existing.currentVersion,
        changeDescription,
        changeLog: changeDescription,
        createdById: ctx.user.id,
      },
    });
  });
  await logAuditEvent({ ctx, action: "update_content", module: "document_version", recordId: documentId, extra: { version, previousVersion: existing.currentVersion, changeDescription } });
  revalidatePath(PATH);
  return { version };
}

export async function updateDocumentMetadata(
  documentId: string,
  patch: Partial<CreateDocumentInput>
): Promise<void> {
  documentId = parseId(documentId);
  patch = parseInput(documentInputSchema.partial(), patch) as Partial<CreateDocumentInput>;
  const authorization = await requireAuthorization("documents:create");
  const { ctx, can } = authorization;
  const existing = await loadDocument(documentId, ctx.organization.id);
  await assertCollaboratorCanAccess(ctx, "documentIds", documentId);
  if (ctx.role === "CONTRIBUTOR" && patch.processId !== undefined) await assertCollaboratorProcessAccess(ctx, patch.processId);
  if (ctx.role === "CONTRIBUTOR") patch = { ...patch, ownerId: ctx.user.id };
  await assertDocumentReferences(patch, ctx.organization.id);

  // Solo borrador puede editarse libremente.
  // En revisión / aprobado: bloqueamos metadata para preservar trazabilidad.
  if (existing.status === DocumentStatus.APPROVED || existing.status === DocumentStatus.OBSOLETE) {
    if (!can("documents:*")) {
      throw new Error("Solo administradores pueden editar documentos aprobados u obsoletos.");
    }
  }

  const update: Record<string, unknown> = {};
  if (patch.code !== undefined) {
    const code = patch.code.trim();
    if (!code) throw new Error("El código es obligatorio.");
    const duplicate = await prisma.document.findUnique({ where: { organizationId_code: { organizationId: ctx.organization.id, code } } });
    if (duplicate && duplicate.id !== documentId) throw new Error(`Ya existe un documento con código ${code}.`);
    update.code = code;
  }
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("El título es obligatorio.");
    update.title = title;
  }
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.ownerId !== undefined) update.ownerId = patch.ownerId || null;
  if (patch.processId !== undefined) update.processId = patch.processId || null;
  if (patch.clauseId !== undefined) update.clauseId = patch.clauseId || null;
  if (patch.standardCode !== undefined) update.standardCode = patch.standardCode || null;
  if (patch.reviewDate !== undefined) update.reviewDate = dateOrNull(patch.reviewDate);
  if (patch.tags !== undefined) update.tags = normalizedTags(patch.tags);
  if (patch.observations !== undefined) update.observations = patch.observations?.trim() || null;
  if (patch.distributionList !== undefined) update.distributionList = patch.distributionList;
  if (patch.locationId !== undefined) update.locationId = patch.locationId || null;
  if (patch.physicalLocation !== undefined) update.physicalLocation = patch.physicalLocation?.trim() || null;
  if (patch.responsibleElaborationId !== undefined) update.responsibleElaborationId = patch.responsibleElaborationId || null;
  if (patch.responsibleApprovalId !== undefined) update.responsibleApprovalId = patch.responsibleApprovalId || null;
  if (patch.custodianId !== undefined) update.custodianId = patch.custodianId || null;
  if (patch.isExternal !== undefined) update.isExternal = patch.isExternal;
  if (patch.externalLink !== undefined) update.externalLink = patch.externalLink?.trim() || null;

  const after = await prisma.document.update({ where: { id: documentId }, data: update });

  const d = diff(
    existing as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>
  );
  if (d) {
    await logAuditEvent({
      ctx,
      action: "update",
      module: "document",
      recordId: documentId,
      before: d.before,
      after: d.after,
    });
  }
  if (patch.ownerId !== undefined && after.ownerId && after.ownerId !== existing.ownerId) {
    await notifyUsers(
      [after.ownerId],
      {
        organizationId: ctx.organization.id,
        title: "Se te asignó un documento",
        body: `${after.code} - «${after.title}» quedó bajo tu responsabilidad.`,
        type: "INFO",
        link: PATH,
      },
      { skipUserId: ctx.user.id },
    );
  }
  const personnelAssignments = [
    patch.responsibleElaborationId !== undefined && after.responsibleElaborationId !== existing.responsibleElaborationId ? after.responsibleElaborationId : null,
    patch.responsibleApprovalId !== undefined && after.responsibleApprovalId !== existing.responsibleApprovalId ? after.responsibleApprovalId : null,
    patch.custodianId !== undefined && after.custodianId !== existing.custodianId ? after.custodianId : null,
  ];
  await notifyPersonnel({
    organizationId: ctx.organization.id,
    personnelIds: personnelAssignments,
    title: "Responsabilidad documental actualizada",
    body: `${after.code} - «${after.title}» te fue asignado dentro del control documental.`,
    link: PATH,
  });
  revalidatePath(PATH);
}

// ─── Versiones + upload ───────────────────────────────────────────────

export async function uploadDocumentVersion(
  documentId: string,
  args: {
    file: File;
    changeDescription?: string;
    bump?: "minor" | "major";
    approverIds?: string[];
  }
): Promise<{ version: string; fileUrl: string }> {
  const ctx = await requirePermission("documents:create");
  const existing = await loadDocument(documentId, ctx.organization.id);
  await assertCollaboratorCanAccess(ctx, "documentIds", documentId);

  if (existing.status === DocumentStatus.OBSOLETE) {
    throw new Error("No se pueden subir versiones a un documento obsoleto.");
  }

  const approverIds = [...new Set(args.approverIds ?? [])];
  if (existing.status === DocumentStatus.APPROVED && approverIds.length === 0) {
    throw new Error("Selecciona al menos un revisor para enviar la nueva versión a revisión.");
  }
  if (approverIds.length > 0) {
    await assertDocumentApprovers(ctx.organization.id, approverIds);
  }

  const nextVersion = nextDocumentVersion(existing.currentVersion, existing.versions, args.bump ?? "minor");

  const { path, size, mime } = await uploadDocumentFile({
    organizationId: ctx.organization.id,
    documentId,
    version: nextVersion,
    file: args.file,
  });

  let created: { id: string };
  try {
    created = await persistWithStorageCompensation(() => prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.create({
        data: {
          documentId,
          version: nextVersion,
          status: approverIds.length > 0 ? "PENDING" : "DRAFT",
          reviewedFromStatus: existing.status,
          fileUrl: path,
          fileSize: size,
          mimeType: mime,
          changeLog: args.changeDescription?.trim() || null,
          changeDescription: args.changeDescription?.trim() || null,
          previousVersion: existing.currentVersion,
          createdById: ctx.user.id,
        },
      });
      if (approverIds.length > 0) {
        await tx.document.update({ where: { id: documentId }, data: { status: DocumentStatus.IN_REVIEW } });
        await tx.approval.createMany({
          data: approverIds.map((approverId) => ({ documentId, versionId: version.id, approverId, status: "PENDING" as const })),
        });
      }
      await writeAuditLog(tx, { ctx, action: "upload_version", module: "document_version", recordId: version.id, after: { documentId, version: nextVersion, previousVersion: existing.currentVersion, fileSize: size, mime, submittedForReview: approverIds.length > 0 } });
      return version;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), async () => {
      await deleteDocumentFile(path, ctx.organization.id).catch(() => undefined);
      await releaseStorageQuota(ctx.organization.id, size).catch(() => undefined);
    });
  } catch (error) {
    throw error;
  }

  if (approverIds.length > 0) {
    await notifyUsers(
      approverIds,
      {
        organizationId: ctx.organization.id,
        title: "Nueva versión pendiente de aprobación",
        body: `${existing.code} — «${existing.title}» tiene la versión v${nextVersion} pendiente de revisión.`,
        type: "WARNING",
        link: PATH,
      },
      { skipUserId: ctx.user.id },
    );
  }

  revalidatePath(PATH);
  return { version: nextVersion, fileUrl: path };
}

/**
 * Genera URL firmada temporal para previsualizar/descargar una versión.
 */
export async function getDocumentVersionUrl(versionId: string): Promise<string> {
  const ctx = await requirePermission("documents:read");
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, document: { organizationId: ctx.organization.id } },
    include: { document: true },
  });
  if (!version) throw new Error("Versión no encontrada.");
  await assertCollaboratorCanAccess(ctx, "documentIds", version.documentId);
  if (!version.fileUrl) throw new Error("Esta versión no tiene archivo asociado.");

  const url = await createSignedDownloadUrl(version.fileUrl, ctx.organization.id, 300);

  await logAuditEvent({
    ctx,
    action: "download",
    module: "document_version",
    recordId: versionId,
    extra: { documentId: version.documentId, version: version.version },
  });

  return url;
}

// ─── Workflow de estado ───────────────────────────────────────────────

export async function submitForReview(
  documentId: string,
  args: { approverIds: string[] }
): Promise<void> {
  documentId = parseId(documentId);
  args = parseInput(documentReviewSchema, args);
  const ctx = await requirePermission("documents:create");
  const existing = await loadDocument(documentId, ctx.organization.id);
  await assertCollaboratorCanAccess(ctx, "documentIds", documentId);

  if (existing.status !== DocumentStatus.DRAFT) {
    throw new Error("Solo se pueden enviar a revisión documentos en borrador.");
  }
  if (existing.versions.length === 0) {
    throw new Error("Sube al menos una versión antes de enviar a revisión.");
  }
  if (args.approverIds.length === 0) {
    throw new Error("Indica al menos una persona aprobadora.");
  }
  const approverIds = await assertDocumentApprovers(ctx.organization.id, args.approverIds);

  const orderedVersions = [...existing.versions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const pendingVersion = orderedVersions.find((version) => version.status === "DRAFT" || version.status === "PENDING")
    ?? (existing.status === DocumentStatus.DRAFT ? orderedVersions[0] : null);
  if (!pendingVersion) throw new Error("No hay una versión nueva pendiente de enviar a revisión.");

  await prisma.$transaction(async (tx) => {
    const changed = await tx.document.updateMany({
      where: { id: documentId, organizationId: ctx.organization.id, status: DocumentStatus.DRAFT },
      data: { status: DocumentStatus.IN_REVIEW },
    });
    if (changed.count !== 1) throw new Error("El documento cambió mientras se enviaba a revisión. Recarga e inténtalo nuevamente.");
    const versionChanged = await tx.documentVersion.updateMany({ where: { id: pendingVersion.id, documentId, status: { in: ["DRAFT", "PENDING"] } }, data: { status: "PENDING" } });
    if (versionChanged.count !== 1) throw new Error("La versión objetivo cambió mientras se enviaba a revisión.");
    await tx.approval.createMany({
      data: approverIds.map((approverId) => ({ documentId, versionId: pendingVersion.id, approverId, status: "PENDING" as const })),
    });
    await writeAuditLog(tx, { ctx, action: "submit_review", module: "document", recordId: documentId, before: { status: existing.status }, after: { status: "IN_REVIEW", versionId: pendingVersion.id, approvers: approverIds.length } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await notifyUsers(
    approverIds,
    {
      organizationId: ctx.organization.id,
      title: "Documento pendiente de tu aprobación",
      body: `${existing.code} — «${existing.title}» fue enviado a revisión y espera tu aprobación.`,
      type: "WARNING",
      link: "/app/documents",
    },
    { skipUserId: ctx.user.id },
  );

  revalidatePath(PATH);
}

export async function approveDocument(
  documentId: string,
  args: { comment?: string }
): Promise<void> {
  documentId = parseId(documentId);
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  if (!can("documents:approve")) {
    throw new Error("No tienes permiso para aprobar documentos.");
  }
  const comment = args.comment?.trim() || null;
  type ApprovalResult = {
    alreadyApproved: boolean;
    published: boolean;
    code: string;
    title: string;
    ownerId: string | null;
    processId: string | null;
    version: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };

  async function runApprovalTransaction(): Promise<ApprovalResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const document = await tx.document.findFirst({
            where: { id: documentId, organizationId: ctx.organization.id },
            select: { id: true, code: true, title: true, status: true, currentVersion: true, ownerId: true, processId: true },
          });
          if (!document) throw new Error("Documento no encontrado.");
          if (document.status === DocumentStatus.APPROVED) {
            return { alreadyApproved: true, published: false, code: document.code, title: document.title, ownerId: document.ownerId, processId: document.processId, version: document.currentVersion, before: { status: document.status }, after: { status: document.status } };
          }
          if (document.status !== DocumentStatus.IN_REVIEW) throw new Error("Solo se pueden aprobar documentos en revisión.");

          // The currently pending version is the only approval target. This
          // prevents an administrator from approving a stale approval row.
          const targetVersion = await tx.documentVersion.findFirst({
            where: { documentId, status: "PENDING" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { id: true, version: true, status: true },
          });
          if (!targetVersion) throw new Error("No existe una versión pendiente de aprobación.");

          const approvalsBefore = await tx.approval.findMany({
            where: { documentId, versionId: targetVersion.id },
            select: { id: true, approverId: true, status: true },
          });
          const myPending = approvalsBefore.find((approval) => approval.approverId === ctx.user.id && approval.status === "PENDING");
          if (!hasPendingAssignedApproval(approvalsBefore, ctx.user.id) || !myPending) {
            throw new Error("Solo un revisor asignado con una aprobación pendiente puede aprobar este documento.");
          }

          await tx.approval.update({
            where: { id: myPending.id },
            data: { status: "APPROVED", comment, decidedAt: new Date() },
          });

          const approvalsAfter = await tx.approval.groupBy({
            by: ["status"],
            where: { documentId, versionId: targetVersion.id },
            _count: { _all: true },
          });
          const count = (status: "PENDING" | "APPROVED" | "REJECTED") => approvalsAfter.find((item) => item.status === status)?._count._all ?? 0;
          const pending = count("PENDING");
          const rejected = count("REJECTED");
          const approved = count("APPROVED");
          if (approved === 0) throw new Error("No hay aprobaciones válidas para la versión pendiente.");

          const published = canPublishApprovedDocument({ pending, approved, rejected });
          if (published) {
            const versionUpdate = await tx.documentVersion.updateMany({
              where: { id: targetVersion.id, status: "PENDING" },
              data: { status: "APPROVED" },
            });
            if (versionUpdate.count !== 1) throw new Error("La versión objetivo cambió durante la aprobación. Intenta nuevamente.");
            const documentUpdate = await tx.document.updateMany({ where: { id: documentId, organizationId: ctx.organization.id, status: DocumentStatus.IN_REVIEW }, data: { status: DocumentStatus.APPROVED, currentVersion: targetVersion.version } });
            if (documentUpdate.count !== 1) throw new Error("El documento cambió durante la publicación. Intenta nuevamente.");
          }

          const after = { status: published ? DocumentStatus.APPROVED : DocumentStatus.IN_REVIEW, currentVersion: published ? targetVersion.version : document.currentVersion, targetVersion: targetVersion.version, approvals: { pending, approved, rejected }, approverId: ctx.user.id, comment };
          await writeAuditLog(tx, { ctx, action: "approve", module: "document", recordId: documentId, before: { status: document.status, currentVersion: document.currentVersion, targetVersion: targetVersion.version, approvals: { pending: approvalsBefore.filter((item) => item.status === "PENDING").length, approved: approvalsBefore.filter((item) => item.status === "APPROVED").length, rejected: approvalsBefore.filter((item) => item.status === "REJECTED").length } }, after });
          if (published) await writeAuditLog(tx, { ctx, action: "publish", module: "document", recordId: documentId, before: { status: DocumentStatus.IN_REVIEW }, after: { status: DocumentStatus.APPROVED, currentVersion: targetVersion.version } });

          return {
            alreadyApproved: false,
            published,
            code: document.code,
            title: document.title,
            ownerId: document.ownerId,
            processId: document.processId,
            version: targetVersion.version,
            before: { status: document.status, currentVersion: document.currentVersion, targetVersion: targetVersion.version, approvals: { pending: approvalsBefore.filter((item) => item.status === "PENDING").length, approved: approvalsBefore.filter((item) => item.status === "APPROVED").length, rejected: approvalsBefore.filter((item) => item.status === "REJECTED").length } },
            after: { status: published ? DocumentStatus.APPROVED : DocumentStatus.IN_REVIEW, currentVersion: published ? targetVersion.version : document.currentVersion, targetVersion: targetVersion.version, approvals: { pending, approved, rejected }, approverId: ctx.user.id, comment },
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt === 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
        throw error;
      }
    }
    throw new Error("No se pudo completar la aprobación del documento.");
  }

  const result = await runApprovalTransaction();
  if (result.alreadyApproved) return;

  if (result.published) {
    const generatedTraining = await assignTrainingForApprovedDocument({
      organizationId: ctx.organization.id,
      documentId,
      version: result.version,
      createdById: ctx.user.id,
    });
    if (generatedTraining.count > 0) {
      await logAuditEvent({
        ctx,
        action: "auto_assign",
        module: "training_assignment",
        recordId: documentId,
        extra: {
          documentId,
          version: result.version,
          assignmentCount: generatedTraining.count,
          courseIds: generatedTraining.courseIds,
        },
      });
    }

    await notifyUsers(
      [result.ownerId, await documentProcessOwnerId(result.processId, ctx.organization.id)],
      {
        organizationId: ctx.organization.id,
        title: "Documento aprobado",
        body: `${result.code} — «${result.title}» fue aprobado y publicado.`,
        type: "SUCCESS",
        link: "/app/documents",
      },
      { skipUserId: ctx.user.id },
    );
  }

  revalidatePath(PATH);
  revalidatePath("/app/training");
}

export async function rejectDocument(
  documentId: string,
  args: { comment: string }
): Promise<void> {
  documentId = parseId(documentId);
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status !== DocumentStatus.IN_REVIEW) {
    throw new Error("Solo se pueden rechazar documentos en revisión.");
  }
  const assignedPending = existing.approvals.some((approval) => approval.approverId === ctx.user.id && approval.status === "PENDING");
  if (!can("documents:approve") || !assignedPending) {
    throw new Error("Solo un revisor asignado con permiso de aprobación puede devolver este documento.");
  }
  if (!args.comment.trim()) throw new Error("Indica el motivo del rechazo.");

  const myPending = existing.approvals.find((a) => a.approverId === ctx.user.id && a.status === "PENDING");
  const targetApproval = myPending;
  const targetVersion = targetApproval?.versionId ? existing.versions.find((version) => version.id === targetApproval.versionId) : null;
  await prisma.$transaction(async (tx) => {
    if (!myPending || !targetVersion) throw new Error("La aprobación pendiente ya fue resuelta.");
    const approvalChanged = await tx.approval.updateMany({ where: { id: myPending.id, documentId, versionId: targetVersion.id, status: "PENDING" }, data: { status: "REJECTED", comment: args.comment.trim(), decidedAt: new Date() } });
    if (approvalChanged.count !== 1) throw new Error("La aprobación pendiente ya fue resuelta.");
    const versionChanged = await tx.documentVersion.updateMany({ where: { id: targetVersion.id, documentId, status: "PENDING" }, data: { status: "REJECTED" } });
    if (versionChanged.count !== 1) throw new Error("La versión de revisión ya fue resuelta.");
    const documentChanged = await tx.document.updateMany({ where: { id: documentId, organizationId: ctx.organization.id, status: DocumentStatus.IN_REVIEW }, data: { status: targetVersion.reviewedFromStatus ?? DocumentStatus.DRAFT } });
    if (documentChanged.count !== 1) throw new Error("El documento ya no está en revisión.");
    await writeAuditLog(tx, { ctx, action: "reject", module: "document", recordId: documentId, before: { status: DocumentStatus.IN_REVIEW, versionId: targetVersion.id }, after: { status: targetVersion.reviewedFromStatus ?? DocumentStatus.DRAFT, versionStatus: "REJECTED" }, extra: { reason: args.comment.trim() } });
  });

  await notifyUsers(
    [existing.ownerId, await documentProcessOwnerId(existing.processId, ctx.organization.id)],
    {
      organizationId: ctx.organization.id,
      title: "Documento devuelto a borrador",
      body: `${existing.code} — «${existing.title}» fue rechazado. Motivo: ${args.comment.trim()}`,
      type: "ALERT",
      link: "/app/documents",
    },
    { skipUserId: ctx.user.id },
  );

  revalidatePath(PATH);
}

/**
 * Reemplaza el documento `oldId` (p. ej. el "01") por `newId` (el "02"):
 * marca el viejo como OBSOLETE, registra el vínculo reemplaza/reemplazado-por,
 * y transfiere el enlace de proceso al nuevo (salvo que el nuevo ya tenga uno).
 * El documento viejo NO se borra: queda como histórico trazable.
 */
export async function supersedeDocument(
  oldId: string,
  newId: string,
  args?: { reason?: string; transferProcess?: boolean },
): Promise<void> {
  const ctx = await requirePermission("documents:*");
  if (oldId === newId) throw new Error("Un documento no puede reemplazarse a sí mismo.");
  const [oldDoc, newDoc] = await Promise.all([
    loadDocument(oldId, ctx.organization.id),
    loadDocument(newId, ctx.organization.id),
  ]);
  if (oldDoc.supersededById) throw new Error("Ese documento ya fue reemplazado por otro.");
  if (newDoc.status === DocumentStatus.OBSOLETE) throw new Error("El documento de reemplazo está obsoleto.");

  const transferProcess = args?.transferProcess !== false;
  const moveProcess = transferProcess && oldDoc.processId && !newDoc.processId;

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: oldId },
      data: { status: DocumentStatus.OBSOLETE, supersededById: newId },
    });
    if (moveProcess) {
      await tx.document.update({ where: { id: newId }, data: { processId: oldDoc.processId } });
    }
  });

  await logAuditEvent({
    ctx,
    action: "supersede",
    module: "document",
    recordId: oldId,
    before: { status: oldDoc.status },
    after: { status: "OBSOLETE", supersededBy: newDoc.code, processMoved: Boolean(moveProcess) },
    extra: args?.reason ? { reason: args.reason } : undefined,
  });

  // Avisar al dueño del documento viejo y al dueño del proceso afectado.
  const processId = oldDoc.processId ?? newDoc.processId;
  await notifyUsers(
    [oldDoc.ownerId, newDoc.ownerId, await documentProcessOwnerId(processId, ctx.organization.id)],
    {
      organizationId: ctx.organization.id,
      title: "Documento reemplazado",
      body: `${oldDoc.code} «${oldDoc.title}» fue reemplazado por ${newDoc.code} «${newDoc.title}» y archivado como obsoleto (histórico).${moveProcess ? " El proceso quedó enlazado al nuevo documento." : ""}`,
      type: "WARNING",
      link: "/app/documents",
    },
    { skipUserId: ctx.user.id },
  );

  revalidatePath(PATH);
}

export async function markDocumentObsolete(
  documentId: string,
  args: { reason?: string }
): Promise<void> {
  const ctx = await requirePermission("documents:*");
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status === DocumentStatus.OBSOLETE) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.OBSOLETE },
  });

  await logAuditEvent({
    ctx,
    action: "obsolete",
    module: "document",
    recordId: documentId,
    before: { status: existing.status },
    after: { status: "OBSOLETE" },
    extra: args.reason ? { reason: args.reason } : undefined,
  });
  await notifyUsers(
    [existing.ownerId, await documentProcessOwnerId(existing.processId, ctx.organization.id)],
    {
      organizationId: ctx.organization.id,
      title: "Documento marcado como obsoleto",
      body: `${existing.code} - «${existing.title}» dejó de estar vigente.${args.reason?.trim() ? ` Motivo: ${args.reason.trim()}` : ""}`,
      type: "WARNING",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
}

// ─── Borrar (solo borradores sin aprobaciones) ────────────────────────

export async function deleteDraftDocument(documentId: string): Promise<void> {
  const ctx = await requirePermission("documents:*");
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status !== DocumentStatus.DRAFT) {
    throw new Error("Solo se pueden borrar documentos en borrador. Para documentos aprobados, márcalos como obsoletos.");
  }

  // Limpia archivos físicos del storage
  for (const v of existing.versions) {
    if (v.fileUrl) {
      try {
        await deleteDocumentFile(v.fileUrl, ctx.organization.id);
      } catch {
        // Si falla la limpieza, seguimos — la fila de BD se borrará igual
      }
    }
  }

  await prisma.document.delete({ where: { id: documentId } });

  await logAuditEvent({
    ctx,
    action: "delete",
    module: "document",
    recordId: documentId,
    before: { code: existing.code, title: existing.title, status: existing.status },
  });

  revalidatePath(PATH);
}

// ─── Exportación del listado maestro ──────────────────────────────────

export type DocumentExportFilters = {
  search?: string;
  status?: DocumentStatus | "ALL";
  type?: DocumentType | "ALL";
  standardCode?: string;
  clauseId?: string;
  processId?: string;
  ownerId?: string;
};

function exportFileSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "documentos";
}

export async function exportDocumentsList(input: {
  format: "PDF" | "EXCEL";
  filters?: DocumentExportFilters;
}) {
  if (input.format !== "PDF" && input.format !== "EXCEL") throw new Error("Formato de exportación no válido.");
  const { ctx } = await requireAuthorization("documents:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const filters = input.filters ?? {};
  if (filters.status && filters.status !== "ALL" && !Object.values(DocumentStatus).includes(filters.status)) {
    throw new Error("Estado de documento no válido.");
  }
  if (filters.type && filters.type !== "ALL" && !Object.values(DocumentType).includes(filters.type)) {
    throw new Error("Tipo documental no válido.");
  }
  const scope = await getCollaboratorScope(ctx);
  const where: Prisma.DocumentWhereInput = {
    organizationId: ctx.organization.id,
    ...(scope.isScoped ? { id: { in: scope.documentIds } } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.type && filters.type !== "ALL" ? { type: filters.type } : {}),
    ...(filters.standardCode ? { standardCode: filters.standardCode } : {}),
    ...(filters.clauseId ? { clauseId: filters.clauseId } : {}),
    ...(filters.processId ? { processId: filters.processId } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.search?.trim()
      ? {
          OR: [
            { code: { contains: filters.search.trim(), mode: "insensitive" } },
            { title: { contains: filters.search.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const documents = await prisma.document.findMany({
    where,
    include: {
      clause: { include: { standard: true } },
      process: true,
      owner: true,
    },
    orderBy: [{ code: "asc" }],
  });
  const rows = documents.map((document) => ({
    codigo: document.code,
    titulo: document.title,
    tipo: document.type,
    norma: document.standardCode ?? document.clause?.standard.code ?? "",
    clausula: document.clause ? `${document.clause.code} — ${document.clause.title}` : "",
    proceso: document.process ? `${document.process.code ?? ""} — ${document.process.name}` : "",
    responsable: document.owner?.name ?? "",
    estado: document.status,
    version: document.currentVersion,
    ultima_actividad: document.updatedAt.toISOString().slice(0, 10),
  }));

  const generatedAt = new Date();
  const baseName = `control-documental-${exportFileSlug(ctx.organization.name)}-${generatedAt.toISOString().slice(0, 10)}`;
  const fileName = `${baseName}.${input.format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = input.format === "PDF"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const report = await queueReportForContext({ ctx, reportType: "documents", title: "Control documental", format: input.format, fileName, dateFrom: generatedAt, dateTo: generatedAt, filters: { from: generatedAt.toISOString().slice(0, 10), to: generatedAt.toISOString().slice(0, 10), status: filters.status && filters.status !== "ALL" ? filters.status : undefined, standardCode: filters.standardCode } });

  revalidatePath(PATH);
  revalidatePath("/app/activity");
  return { id: report.id, fileName, mimeType, status: report.status, rowCount: report.rowCount };
}
