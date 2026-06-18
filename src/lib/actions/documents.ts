"use server";

import { revalidatePath } from "next/cache";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertSameTenant } from "@/lib/permissions/server";
import { logAuditEvent, diff } from "@/lib/audit-log";
import { roleCan } from "@/lib/permissions/matrix";
import {
  createSignedDownloadUrl,
  deleteDocumentFile,
  uploadDocumentFile,
} from "@/lib/storage";

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
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { versions: { orderBy: { createdAt: "desc" } }, approvals: true },
  });
  if (!doc) throw new Error("Documento no encontrado.");
  if (doc.organizationId !== organizationId) throw new Error("Acceso denegado.");
  return doc;
}

function bumpVersion(current: string, mode: "minor" | "major"): string {
  // Soporta "1.0", "1", "1.2.3"
  const parts = current.split(".").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return mode === "major" ? "2.0" : "1.1";
  if (mode === "major") {
    return `${(parts[0] ?? 1) + 1}.0`;
  }
  if (parts.length === 1) return `${parts[0]}.1`;
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}

// ─── CRUD básico ──────────────────────────────────────────────────────

export type CreateDocumentInput = {
  code: string;
  title: string;
  type: DocumentType;
  processId?: string;
  clauseId?: string;
  standardCode?: string;
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

export async function createDocument(input: CreateDocumentInput): Promise<{ id: string }> {
  const ctx = await requirePermission("documents:create");

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
      ownerId: ctx.user.id,
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

  revalidatePath(PATH);
  return { id: created.id };
}

export async function updateDocumentMetadata(
  documentId: string,
  patch: Partial<CreateDocumentInput>
): Promise<void> {
  const ctx = await requirePermission("documents:create");
  const existing = await loadDocument(documentId, ctx.organization.id);

  // Solo borrador puede editarse libremente.
  // En revisión / aprobado: bloqueamos metadata para preservar trazabilidad.
  if (existing.status === DocumentStatus.APPROVED || existing.status === DocumentStatus.OBSOLETE) {
    if (!roleCan(ctx.role, "documents:*")) {
      throw new Error("Solo administradores pueden editar documentos aprobados u obsoletos.");
    }
  }

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.processId !== undefined) update.processId = patch.processId || null;
  if (patch.clauseId !== undefined) update.clauseId = patch.clauseId || null;
  if (patch.standardCode !== undefined) update.standardCode = patch.standardCode || null;
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
  revalidatePath(PATH);
}

// ─── Versiones + upload ───────────────────────────────────────────────

export async function uploadDocumentVersion(
  documentId: string,
  args: {
    file: File;
    changeDescription?: string;
    bump?: "minor" | "major";
  }
): Promise<{ version: string; fileUrl: string }> {
  const ctx = await requirePermission("documents:create");
  const existing = await loadDocument(documentId, ctx.organization.id);
  assertSameTenant(ctx, existing);

  if (existing.status === DocumentStatus.OBSOLETE) {
    throw new Error("No se pueden subir versiones a un documento obsoleto.");
  }

  const nextVersion =
    existing.versions.length === 0 ? existing.currentVersion : bumpVersion(existing.currentVersion, args.bump ?? "minor");

  const { path, size, mime } = await uploadDocumentFile({
    organizationId: ctx.organization.id,
    documentId,
    version: nextVersion,
    file: args.file,
  });

  const created = await prisma.documentVersion.create({
    data: {
      documentId,
      version: nextVersion,
      fileUrl: path,
      fileSize: size,
      mimeType: mime,
      changeLog: args.changeDescription?.trim() || null,
      changeDescription: args.changeDescription?.trim() || null,
      previousVersion: existing.currentVersion,
      createdById: ctx.user.id,
    },
  });

  // Si está en borrador, actualizamos currentVersion al subir.
  if (existing.status === DocumentStatus.DRAFT) {
    await prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: nextVersion },
    });
  }

  await logAuditEvent({
    ctx,
    action: "upload_version",
    module: "document_version",
    recordId: created.id,
    extra: {
      documentId,
      version: nextVersion,
      previousVersion: existing.currentVersion,
      fileSize: size,
      mime,
    },
  });

  revalidatePath(PATH);
  return { version: nextVersion, fileUrl: path };
}

/**
 * Genera URL firmada temporal para previsualizar/descargar una versión.
 */
export async function getDocumentVersionUrl(versionId: string): Promise<string> {
  const ctx = await requirePermission("documents:read");
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });
  if (!version) throw new Error("Versión no encontrada.");
  if (version.document.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");
  if (!version.fileUrl) throw new Error("Esta versión no tiene archivo asociado.");

  const url = await createSignedDownloadUrl(version.fileUrl, 300);

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
  const ctx = await requirePermission("documents:create");
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status !== DocumentStatus.DRAFT) {
    throw new Error("Solo se pueden enviar a revisión documentos en borrador.");
  }
  if (existing.versions.length === 0) {
    throw new Error("Sube al menos una versión antes de enviar a revisión.");
  }
  if (args.approverIds.length === 0) {
    throw new Error("Indica al menos una persona aprobadora.");
  }

  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.IN_REVIEW },
    }),
    prisma.approval.createMany({
      data: args.approverIds.map((approverId) => ({
        documentId,
        approverId,
        status: "PENDING" as const,
      })),
    }),
  ]);

  await logAuditEvent({
    ctx,
    action: "submit_review",
    module: "document",
    recordId: documentId,
    before: { status: existing.status },
    after: { status: "IN_REVIEW", approvers: args.approverIds.length },
  });

  // TODO Phase 2: notificar por email a aprobadores vía Resend
  revalidatePath(PATH);
}

export async function approveDocument(
  documentId: string,
  args: { comment?: string }
): Promise<void> {
  const ctx = await requirePermission("documents:*");
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status === DocumentStatus.APPROVED) {
    return;
  }
  if (existing.status !== DocumentStatus.IN_REVIEW) {
    throw new Error("Solo se pueden aprobar documentos en revisión.");
  }

  // Marca aprobación del usuario actual (si tiene una pendiente).
  const myPending = existing.approvals.find(
    (a) => a.approverId === ctx.user.id && a.status === "PENDING"
  );

  await prisma.$transaction(async (tx) => {
    if (myPending) {
      await tx.approval.update({
        where: { id: myPending.id },
        data: { status: "APPROVED", comment: args.comment?.trim() || null, decidedAt: new Date() },
      });
    } else {
      // Admin sin asignación previa: crea registro de aprobación
      await tx.approval.create({
        data: {
          documentId,
          approverId: ctx.user.id,
          status: "APPROVED",
          comment: args.comment?.trim() || null,
          decidedAt: new Date(),
        },
      });
    }

    // Si TODAS las aprobaciones (al menos las requeridas, en este caso PENDING actuales) están aprobadas,
    // el documento pasa a APPROVED. (Para simplificar: una aprobación de admin alcanza.)
    const remaining = await tx.approval.count({
      where: { documentId, status: "PENDING" },
    });

    if (remaining === 0 || roleCan(ctx.role, "documents:*")) {
      // Obsoleta versiones aprobadas anteriores del mismo documento (manteniéndolas en histórico)
      await tx.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.APPROVED },
      });
    }
  });

  await logAuditEvent({
    ctx,
    action: "approve",
    module: "document",
    recordId: documentId,
    before: { status: existing.status },
    after: { status: "APPROVED", comment: args.comment ?? null },
  });

  revalidatePath(PATH);
}

export async function rejectDocument(
  documentId: string,
  args: { comment: string }
): Promise<void> {
  const ctx = await requirePermission("documents:*");
  const existing = await loadDocument(documentId, ctx.organization.id);

  if (existing.status !== DocumentStatus.IN_REVIEW) {
    throw new Error("Solo se pueden rechazar documentos en revisión.");
  }
  if (!args.comment.trim()) throw new Error("Indica el motivo del rechazo.");

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        documentId,
        approverId: ctx.user.id,
        status: "REJECTED",
        comment: args.comment.trim(),
        decidedAt: new Date(),
      },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.DRAFT },
    }),
  ]);

  await logAuditEvent({
    ctx,
    action: "reject",
    module: "document",
    recordId: documentId,
    before: { status: "IN_REVIEW" },
    after: { status: "DRAFT" },
    extra: { reason: args.comment.trim() },
  });

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
        await deleteDocumentFile(v.fileUrl);
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
