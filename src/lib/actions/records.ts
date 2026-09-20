"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, RecordEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization, requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { getCollaboratorScope } from "@/lib/permissions/scope";
import { logAuditEvent, writeAuditLog } from "@/lib/audit-log";
import { createSignedRecordUrl, deleteRecordFile, releaseStorageQuota, uploadRecordFile, uploadRecordFormatFile } from "@/lib/storage";
import { nextDocumentVersion } from "@/lib/document-version";
import { notifyPersonnel, notifyUsers } from "@/lib/notify";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { queueReportForContext } from "@/lib/report-queue";
import { parseId, parseInput } from "@/lib/validation/common";
import { recordInputSchema } from "@/lib/validation/workflows";
import { actionResult, type ActionResult } from "@/lib/actions/action-result";

const PATH = "/app/records";

export type RecordInput = {
  code: string;
  name: string;
  processId?: string;
  clauseId?: string;
  recordTypeId?: string;
  retentionTimeId?: string;
  dispositionId?: string;
  archiveMethodId?: string;
  custodianId?: string;
  reviewerId?: string;
  physicalLocation?: string;
  digitalLocation?: string;
  observations?: string;
};

function normalize(input: RecordInput) {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) throw new Error("El código es obligatorio.");
  if (!name) throw new Error("El nombre es obligatorio.");
  return {
    code,
    name,
    processId: input.processId || null,
    clauseId: input.clauseId || null,
    recordTypeId: input.recordTypeId || null,
    retentionTimeId: input.retentionTimeId || null,
    dispositionId: input.dispositionId || null,
    archiveMethodId: input.archiveMethodId || null,
    custodianId: input.custodianId || null,
    reviewerId: input.reviewerId || null,
    physicalLocation: input.physicalLocation?.trim() || null,
    digitalLocation: input.digitalLocation?.trim() || null,
    observations: input.observations?.trim() || null,
  };
}

async function assertContributorProcessAccess(
  ctx: Awaited<ReturnType<typeof getServerAuthorization>>["ctx"],
  can: (permission: string) => boolean,
  record: { organizationId: string; processId: string | null },
) {
  if (ctx.role !== "CONTRIBUTOR" || can("records:*")) return;
  if (!record.processId) throw new Error("Solo puedes trabajar con registros vinculados a un proceso asignado.");
  const assignedProcess = await prisma.process.findFirst({
    where: { id: record.processId, organizationId: ctx.organization.id, ownerId: ctx.user.id },
    select: { id: true },
  });
  if (!assignedProcess) throw new Error("Este registro no pertenece a un proceso asignado a tu usuario.");
}

async function assertRecordReferences(input: Partial<RecordInput>, organizationId: string) {
  const [process, clause, recordType, retentionTime, disposition, archiveMethod, custodian, reviewer] = await Promise.all([
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId }, select: { id: true } }) : null,
    input.clauseId ? prisma.standardRequirement.findFirst({ where: { id: input.clauseId, standard: { orgStandards: { some: { organizationId } } } }, select: { id: true } }) : null,
    input.recordTypeId ? prisma.recordType.findFirst({ where: { id: input.recordTypeId, organizationId }, select: { id: true } }) : null,
    input.retentionTimeId ? prisma.retentionTime.findFirst({ where: { id: input.retentionTimeId, organizationId }, select: { id: true } }) : null,
    input.dispositionId ? prisma.disposition.findFirst({ where: { id: input.dispositionId, organizationId }, select: { id: true } }) : null,
    input.archiveMethodId ? prisma.archiveMethod.findFirst({ where: { id: input.archiveMethodId, organizationId }, select: { id: true } }) : null,
    input.custodianId ? prisma.personnel.findFirst({ where: { id: input.custodianId, organizationId }, select: { id: true } }) : null,
    input.reviewerId ? prisma.membership.findFirst({ where: { userId: input.reviewerId, organizationId }, select: { id: true } }) : null,
  ]);
  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.clauseId && !clause) throw new Error("La cláusula no pertenece a una norma habilitada para la organización.");
  if (input.recordTypeId && !recordType) throw new Error("El tipo de registro no pertenece a la organización.");
  if (input.retentionTimeId && !retentionTime) throw new Error("El tiempo de retención no pertenece a la organización.");
  if (input.dispositionId && !disposition) throw new Error("La disposición no pertenece a la organización.");
  if (input.archiveMethodId && !archiveMethod) throw new Error("El método de archivo no pertenece a la organización.");
  if (input.custodianId && !custodian) throw new Error("El custodio no pertenece a la organización.");
  if (input.reviewerId && !reviewer) throw new Error("El revisor no pertenece a la organización.");
}

export async function createRecord(input: RecordInput): Promise<ActionResult<void>> {
  return actionResult(() => createRecordImpl(input));
}

async function createRecordImpl(input: RecordInput): Promise<void> {
  input = parseInput(recordInputSchema, input) as RecordInput;
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  if (!can("records:create")) throw new Error("No tienes permiso para crear registros.");
  const data = normalize(input);
  await assertRecordReferences(input, ctx.organization.id);
  await assertContributorProcessAccess(ctx, can, { organizationId: ctx.organization.id, processId: data.processId });

  const existing = await prisma.record.findUnique({
    where: { organizationId_code: { organizationId: ctx.organization.id, code: data.code } },
  });
  if (existing) throw new Error(`Ya existe un registro con el código ${data.code}.`);

  const created = await prisma.record.create({
    data: { organizationId: ctx.organization.id, ...data },
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: "record",
    recordId: created.id,
    after: { code: data.code, name: data.name },
  });
  await notifyPersonnel({
    organizationId: ctx.organization.id,
    personnelIds: [created.custodianId],
    title: "Se te asignó un registro",
    body: `Eres custodio del registro «${created.code} - ${created.name}». Revisa su ubicación, retención y disposición.`,
    link: PATH,
  });
  await notifyUsers(
    [created.reviewerId],
    {
      organizationId: ctx.organization.id,
      title: "Se te asignó la revisión de un registro",
      body: `El registro «${created.code} - ${created.name}» quedó pendiente de revisión.`,
      type: "WARNING",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function updateRecord(id: string, input: Partial<RecordInput>): Promise<ActionResult<void>> {
  return actionResult(() => updateRecordImpl(id, input));
}

async function updateRecordImpl(id: string, input: Partial<RecordInput>): Promise<void> {
  id = parseId(id);
  input = parseInput(recordInputSchema.partial(), input) as Partial<RecordInput>;
  const ctx = await requirePermission("records:*");
  const existing = await prisma.record.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");
  await assertRecordReferences(input, ctx.organization.id);

  const patch: Record<string, unknown> = {};
  if (input.code !== undefined) {
    const code = input.code.trim();
    if (!code) throw new Error("El código es obligatorio.");
    const duplicate = await prisma.record.findUnique({ where: { organizationId_code: { organizationId: ctx.organization.id, code } } });
    if (duplicate && duplicate.id !== id) throw new Error(`Ya existe otro registro con el código ${code}.`);
    patch.code = code;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("El nombre es obligatorio.");
    patch.name = name;
  }
  if (input.processId !== undefined) patch.processId = input.processId || null;
  if (input.clauseId !== undefined) patch.clauseId = input.clauseId || null;
  if (input.recordTypeId !== undefined) patch.recordTypeId = input.recordTypeId || null;
  if (input.retentionTimeId !== undefined) patch.retentionTimeId = input.retentionTimeId || null;
  if (input.dispositionId !== undefined) patch.dispositionId = input.dispositionId || null;
  if (input.archiveMethodId !== undefined) patch.archiveMethodId = input.archiveMethodId || null;
  if (input.custodianId !== undefined) patch.custodianId = input.custodianId || null;
  if (input.reviewerId !== undefined) patch.reviewerId = input.reviewerId || null;
  if (input.physicalLocation !== undefined) patch.physicalLocation = input.physicalLocation?.trim() || null;
  if (input.digitalLocation !== undefined) patch.digitalLocation = input.digitalLocation?.trim() || null;
  if (input.observations !== undefined) patch.observations = input.observations?.trim() || null;

  await prisma.record.update({ where: { id }, data: patch });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "record",
    recordId: id,
    before: { code: existing.code, name: existing.name },
    after: patch,
  });
  if (input.custodianId !== undefined && input.custodianId !== existing.custodianId) {
    await notifyPersonnel({
      organizationId: ctx.organization.id,
      personnelIds: [String(patch.custodianId ?? "") || null],
      title: "Custodia de registro actualizada",
      body: `Eres custodio del registro «${String(patch.code ?? existing.code)} - ${String(patch.name ?? existing.name)}». Revisa sus pendientes de conservación.`,
      link: PATH,
    });
  }
  if (input.reviewerId !== undefined && input.reviewerId !== existing.reviewerId) {
    await notifyUsers(
      [String(patch.reviewerId ?? "") || null],
      {
        organizationId: ctx.organization.id,
        title: "Revisor de registro actualizado",
        body: `El registro «${String(patch.code ?? existing.code)} - ${String(patch.name ?? existing.name)}» quedó asignado para tu revisión.`,
        type: "WARNING",
        link: PATH,
      },
      { skipUserId: ctx.user.id },
    );
  }
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

// ─── Formato del registro (versionado) ────────────────────────────────

/**
 * Sube una versión del formato: el impreso en blanco que se rellena.
 *
 * No se aprueba por su cuenta. Queda en DRAFT y es el flujo de revisión del
 * propio registro el que la mueve —enviar a revisión la pone PENDING, aprobar
 * la deja en vigor—, para no montar un segundo circuito de firmas en paralelo
 * al que el registro ya tiene.
 */
export async function uploadRecordFormatVersion(
  recordId: string,
  args: { file: File; changeDescription?: string; bump?: "minor" | "major" },
): Promise<ActionResult<{ version: string }>> {
  return actionResult(() => uploadRecordFormatVersionImpl(recordId, args));
}

async function uploadRecordFormatVersionImpl(
  recordId: string,
  args: { file: File; changeDescription?: string; bump?: "minor" | "major" },
): Promise<{ version: string }> {
  recordId = parseId(recordId);
  const { ctx, can } = await getServerAuthorization();
  if (!can("records:create")) throw new Error("No tienes permiso para subir formatos de registro.");
  const record = await prisma.record.findFirst({
    where: { id: recordId, organizationId: ctx.organization.id },
    include: { formatVersions: { orderBy: { createdAt: "desc" } } },
  });
  if (!record) throw new Error("Registro no encontrado.");
  if (!record.active) throw new Error("No puedes subir formatos a un registro inactivo.");
  await assertContributorProcessAccess(ctx, can, record);
  if (record.reviewStatus === "IN_REVIEW") {
    throw new Error("El registro está en revisión: espera a que se resuelva antes de subir otro formato.");
  }

  const version = nextDocumentVersion(record.currentFormatVersion ?? "1.0", record.formatVersions, args.bump ?? "minor");
  const uploaded = await uploadRecordFormatFile({ organizationId: ctx.organization.id, recordId, version, file: args.file });

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.recordFormatVersion.create({
        data: {
          recordId,
          version,
          status: "DRAFT",
          changeDescription: args.changeDescription?.trim() || null,
          previousVersion: record.currentFormatVersion,
          fileName: uploaded.fileName,
          fileUrl: uploaded.path,
          fileSize: uploaded.size,
          mimeType: uploaded.mime,
          createdById: ctx.user.id,
        },
      });
      /* Subir un formato devuelve el registro a borrador: lo aprobado antes se
         refería a la versión anterior, y arrastrar esa firma daría por revisado
         algo que nadie miró. */
      await tx.record.update({
        where: { id: recordId },
        data: { reviewStatus: "DRAFT", reviewComment: null, reviewedAt: null },
      });
      await writeAuditLog(tx, {
        ctx, action: "upload_format", module: "record_format_version", recordId,
        after: { versionId: created.id, version, previousVersion: record.currentFormatVersion, fileName: uploaded.fileName, fileSize: uploaded.size },
      });
    });
  } catch (error) {
    await deleteRecordFile(uploaded.path, ctx.organization.id).catch(() => undefined);
    await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    throw error;
  }

  revalidatePath(PATH);
  revalidatePath("/app/activity");
  return { version };
}

export async function getRecordFormatVersionUrl(versionId: string): Promise<ActionResult<string>> {
  return actionResult(() => getRecordFormatVersionUrlImpl(versionId));
}

async function getRecordFormatVersionUrlImpl(versionId: string): Promise<string> {
  versionId = parseId(versionId);
  const { ctx, can } = await getServerAuthorization();
  if (!can("records:read")) throw new Error("No tienes permiso para consultar registros.");
  const version = await prisma.recordFormatVersion.findFirst({
    where: { id: versionId, record: { organizationId: ctx.organization.id } },
    include: { record: { select: { id: true, organizationId: true, processId: true } } },
  });
  if (!version) throw new Error("Versión de formato no encontrada.");
  await assertContributorProcessAccess(ctx, can, version.record);
  if (!version.fileUrl) throw new Error("Esta versión no tiene archivo asociado.");
  const url = await createSignedRecordUrl(version.fileUrl, ctx.organization.id, 300);
  await logAuditEvent({ ctx, action: "download", module: "record_format_version", recordId: versionId, extra: { recordId: version.recordId, version: version.version } });
  return url;
}

// ─── Adjuntos de entrada (historial) ──────────────────────────────────

/**
 * Sustituye el archivo de una entrada conservando el anterior.
 *
 * El de antes no se borra: se marca `supersededAt` y sigue descargable. Es la
 * diferencia entre corregir una evidencia y hacer desaparecer la que había,
 * que es justo lo que una auditoría no puede permitir.
 */
export async function replaceRecordEntryFile(
  entryId: string,
  args: { file: File },
): Promise<ActionResult<{ version: number }>> {
  return actionResult(() => replaceRecordEntryFileImpl(entryId, args));
}

async function replaceRecordEntryFileImpl(entryId: string, args: { file: File }): Promise<{ version: number }> {
  entryId = parseId(entryId);
  const { ctx, can } = await getServerAuthorization();
  if (!can("records:create")) throw new Error("No tienes permiso para modificar entradas de registros.");
  const entry = await prisma.recordEntry.findFirst({
    where: { id: entryId, record: { organizationId: ctx.organization.id } },
    include: { record: true, attachments: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!entry) throw new Error("Entrada no encontrada.");
  if (!entry.record.active) throw new Error("No puedes modificar entradas de un registro inactivo.");
  await assertContributorProcessAccess(ctx, can, entry.record);

  const nextVersion = (entry.attachments[0]?.version ?? 0) + 1;
  const uploaded = await uploadRecordFile({ organizationId: ctx.organization.id, recordId: entry.recordId, entryId, file: args.file });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.recordEntryAttachment.updateMany({
        where: { entryId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.recordEntryAttachment.create({
        data: {
          entryId,
          version: nextVersion,
          fileName: uploaded.fileName,
          fileUrl: uploaded.path,
          fileSize: uploaded.size,
          mimeType: uploaded.mime,
          uploadedById: ctx.user.id,
        },
      });
      /* Las columnas de la entrada siguen apuntando al adjunto vigente: es lo
         que leen el listado y la vista previa, que no necesitan el historial. */
      await tx.recordEntry.update({
        where: { id: entryId },
        data: { fileName: uploaded.fileName, fileUrl: uploaded.path, fileSize: uploaded.size, mimeType: uploaded.mime },
      });
      await writeAuditLog(tx, {
        ctx, action: "replace_attachment", module: "record_entry", recordId: entry.recordId,
        before: { entryId, fileName: entry.fileName },
        after: { entryId, version: nextVersion, fileName: uploaded.fileName, fileSize: uploaded.size },
      });
    });
  } catch (error) {
    await deleteRecordFile(uploaded.path, ctx.organization.id).catch(() => undefined);
    await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    throw error;
  }

  revalidatePath(PATH);
  return { version: nextVersion };
}

export async function getRecordEntryAttachmentUrl(attachmentId: string): Promise<ActionResult<string>> {
  return actionResult(() => getRecordEntryAttachmentUrlImpl(attachmentId));
}

async function getRecordEntryAttachmentUrlImpl(attachmentId: string): Promise<string> {
  attachmentId = parseId(attachmentId);
  const { ctx, can } = await getServerAuthorization();
  if (!can("records:read")) throw new Error("No tienes permiso para consultar registros.");
  const attachment = await prisma.recordEntryAttachment.findFirst({
    where: { id: attachmentId, entry: { record: { organizationId: ctx.organization.id } } },
    include: { entry: { include: { record: { select: { id: true, organizationId: true, processId: true } } } } },
  });
  if (!attachment) throw new Error("Adjunto no encontrado.");
  await assertContributorProcessAccess(ctx, can, attachment.entry.record);
  const url = await createSignedRecordUrl(attachment.fileUrl, ctx.organization.id, 300);
  await logAuditEvent({ ctx, action: "download", module: "record_entry_attachment", recordId: attachmentId, extra: { entryId: attachment.entryId, version: attachment.version } });
  return url;
}

export async function submitRecordForReview(recordId: string): Promise<ActionResult<void>> {
  return actionResult(() => submitRecordForReviewImpl(recordId));
}

async function submitRecordForReviewImpl(recordId: string): Promise<void> {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  if (!can("records:create")) throw new Error("No tienes permiso para enviar registros a revisión.");
  const record = await prisma.record.findFirst({ where: { id: recordId, organizationId: ctx.organization.id } });
  if (!record) throw new Error("Registro no encontrado.");
  if (!record.active) throw new Error("No puedes cargar entradas en un registro inactivo.");
  await assertContributorProcessAccess(ctx, can, record);
  if (record.reviewStatus === "IN_REVIEW") throw new Error("El registro ya está en revisión.");
  if (!record.reviewerId) throw new Error("Asigna un revisor antes de enviar el registro a revisión.");

  await prisma.$transaction(async (tx) => {
    await tx.record.update({
      where: { id: recordId },
      data: { reviewStatus: "IN_REVIEW", reviewComment: null, reviewedAt: null },
    });
    /* La versión de formato en borrador entra a revisión con el registro: es
       lo que el revisor va a mirar. Sin formato subido el registro se revisa
       igual —hay registros que solo tienen ficha y ubicación—, así que no se
       exige ninguna. */
    const pendiente = await tx.recordFormatVersion.findFirst({
      where: { recordId, status: "DRAFT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (pendiente) {
      await tx.recordFormatVersion.update({ where: { id: pendiente.id }, data: { status: "PENDING" } });
    }
  });
  await logAuditEvent({
    ctx,
    action: "submit_review",
    module: "record",
    recordId,
    before: { reviewStatus: record.reviewStatus },
    after: { reviewStatus: "IN_REVIEW", reviewerId: record.reviewerId },
  });
  await notifyUsers(
    [record.reviewerId],
    {
      organizationId: ctx.organization.id,
      title: "Registro pendiente de aprobación",
      body: `El registro «${record.code} - ${record.name}» fue enviado a revisión.`,
      type: "WARNING",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

async function reviewRecord(recordId: string, status: "APPROVED" | "REJECTED", comment?: string): Promise<void> {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  const record = await prisma.record.findFirst({ where: { id: recordId, organizationId: ctx.organization.id } });
  if (!record) throw new Error("Registro no encontrado.");
  if (record.reviewStatus !== "IN_REVIEW") throw new Error("Solo se pueden revisar registros en estado En revisión.");
  if (!can("records:*") && record.reviewerId !== ctx.user.id) {
    throw new Error("Solo el revisor asignado puede aprobar o rechazar este registro.");
  }
  if (status === "REJECTED" && !comment?.trim()) throw new Error("Indica el motivo del rechazo.");

  await prisma.$transaction(async (tx) => {
    await tx.record.update({
      where: { id: recordId },
      data: { reviewStatus: status, reviewComment: comment?.trim() || null, reviewedAt: new Date() },
    });
    const enRevision = await tx.recordFormatVersion.findFirst({
      where: { recordId, status: "PENDING" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, version: true },
    });
    if (!enRevision) return;
    if (status === "APPROVED") {
      /* La versión aprobada pasa a ser la vigente y las anteriores dejan de
         serlo: `currentFormatVersion` es la que se reparte y se imprime. */
      await tx.recordFormatVersion.update({ where: { id: enRevision.id }, data: { status: "APPROVED" } });
      await tx.record.update({ where: { id: recordId }, data: { currentFormatVersion: enRevision.version } });
    } else {
      await tx.recordFormatVersion.update({ where: { id: enRevision.id }, data: { status: "REJECTED" } });
    }
  });
  await logAuditEvent({
    ctx,
    action: status === "APPROVED" ? "approve" : "reject",
    module: "record",
    recordId,
    before: { reviewStatus: record.reviewStatus },
    after: { reviewStatus: status, comment: comment?.trim() || null },
  });
  await notifyUsers(
    [record.reviewerId, ctx.user.id],
    {
      organizationId: ctx.organization.id,
      title: status === "APPROVED" ? "Registro aprobado" : "Registro devuelto a borrador",
      body: `El registro «${record.code} - ${record.name}» ${status === "APPROVED" ? "fue aprobado" : "requiere ajustes"}.${comment?.trim() ? ` Motivo: ${comment.trim()}` : ""}`,
      type: status === "APPROVED" ? "SUCCESS" : "WARNING",
      link: PATH,
    },
    { skipUserId: ctx.user.id },
  );
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function approveRecord(recordId: string, comment?: string): Promise<ActionResult<void>> {
  return actionResult(() => approveRecordImpl(recordId, comment));
}

async function approveRecordImpl(recordId: string, comment?: string): Promise<void> {
  return reviewRecord(recordId, "APPROVED", comment);
}

export async function rejectRecord(recordId: string, comment: string): Promise<ActionResult<void>> {
  return actionResult(() => rejectRecordImpl(recordId, comment));
}

async function rejectRecordImpl(recordId: string, comment: string): Promise<void> {
  return reviewRecord(recordId, "REJECTED", comment);
}

export async function deactivateRecord(id: string): Promise<ActionResult<void>> {
  return actionResult(() => deactivateRecordImpl(id));
}

async function deactivateRecordImpl(id: string): Promise<void> {
  const ctx = await requirePermission("records:*");
  const existing = await prisma.record.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");

  await prisma.record.update({ where: { id }, data: { active: false } });
  await logAuditEvent({
    ctx,
    action: "deactivate",
    module: "record",
    recordId: id,
    before: { code: existing.code, name: existing.name },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function addRecordEntry(
  recordId: string,
  input: { title: string; reference?: string; description?: string; entryDate?: string; status?: RecordEntryStatus; responsibleId?: string; file?: File }
): Promise<ActionResult> {
  return actionResult(() => addRecordEntryImpl(recordId, input));
}

async function addRecordEntryImpl(
  recordId: string,
  input: { title: string; reference?: string; description?: string; entryDate?: string; status?: RecordEntryStatus; responsibleId?: string; file?: File }
): Promise<void> {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  if (!can("records:create")) throw new Error("No tienes permiso para cargar entradas en registros.");
  const title = input.title.trim();
  if (!title) throw new Error("El título de la entrada es obligatorio.");
  const reference = input.reference?.trim() || null;
  const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
  if (Number.isNaN(entryDate.getTime())) throw new Error("La fecha de la entrada no es válida.");
  if (input.status && !Object.values(RecordEntryStatus).includes(input.status)) throw new Error("Estado de entrada no válido.");

  const record = await prisma.record.findFirst({ where: { id: recordId, organizationId: ctx.organization.id } });
  if (!record) throw new Error("Registro no encontrado.");
  if (!record.active) throw new Error("No puedes cargar entradas en un registro inactivo.");
  await assertContributorProcessAccess(ctx, can, record);
  const responsibleId = input.responsibleId || ctx.user.id;
  const responsible = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: responsibleId, active: true }, select: { userId: true } });
  if (!responsible) throw new Error("El responsable de la entrada no pertenece a la organización.");

  const id = randomUUID();
  const uploaded = input.file ? await uploadRecordFile({ organizationId: ctx.organization.id, recordId, entryId: id, file: input.file }) : null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.recordEntry.create({
        data: {
          id,
          recordId,
          title,
          reference,
          description: input.description?.trim() || null,
          entryDate,
          status: input.status ?? RecordEntryStatus.VALID,
          responsibleId,
          fileName: uploaded?.fileName ?? null,
          fileUrl: uploaded?.path ?? null,
          fileSize: uploaded?.size ?? null,
          mimeType: uploaded?.mime ?? null,
          enteredById: ctx.user.id,
        },
      });
      /* El adjunto inicial entra también en el historial: si no, la primera
         versión de la evidencia sería la única que no aparece en él. */
      if (uploaded) {
        await tx.recordEntryAttachment.create({
          data: {
            entryId: id,
            version: 1,
            fileName: uploaded.fileName,
            fileUrl: uploaded.path,
            fileSize: uploaded.size,
            mimeType: uploaded.mime,
            uploadedById: ctx.user.id,
          },
        });
      }
      await writeAuditLog(tx, { ctx, action: "add_entry", module: "record_entry", recordId, after: { entryId: id, title, reference, entryDate: entryDate.toISOString(), status: input.status ?? RecordEntryStatus.VALID, responsibleId, fileName: uploaded?.fileName, fileSize: uploaded?.size, mimeType: uploaded?.mime } });
    });
  } catch (error) {
    if (uploaded) {
      await deleteRecordFile(uploaded.path, ctx.organization.id).catch(() => undefined);
      await releaseStorageQuota(ctx.organization.id, uploaded.size).catch(() => undefined);
    }
    throw error;
  }

  await notifyPersonnel({
    organizationId: ctx.organization.id,
    personnelIds: [record.custodianId],
    title: "Nueva entrada en un registro bajo tu custodia",
    body: `Se añadió la entrada «${reference ?? title}» al registro «${record.code} - ${record.name}».`,
    link: PATH,
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function getRecordEntryUrl(entryId: string): Promise<ActionResult<string>> {
  return actionResult(() => getRecordEntryUrlImpl(entryId));
}

async function getRecordEntryUrlImpl(entryId: string): Promise<string> {
  const authorization = await getServerAuthorization();
  const { ctx, can } = authorization;
  if (!can("records:read")) throw new Error("No tienes permiso para leer registros.");
  const entry = await prisma.recordEntry.findFirst({ where: { id: entryId, record: { organizationId: ctx.organization.id } }, include: { record: true } });
  if (!entry) throw new Error("Entrada no encontrada.");
  await assertContributorProcessAccess(ctx, can, entry.record);
  if (!entry.fileUrl) throw new Error("Esta entrada no tiene un archivo almacenado.");
  const url = await createSignedRecordUrl(entry.fileUrl, ctx.organization.id, 300);
  await logAuditEvent({ ctx, action: "download", module: "record_entry", recordId: entry.recordId, extra: { entryId, fileName: entry.fileName, fileSize: entry.fileSize } });
  return url;
}

export async function deleteRecordEntry(entryId: string): Promise<ActionResult<void>> {
  return actionResult(() => deleteRecordEntryImpl(entryId));
}

async function deleteRecordEntryImpl(entryId: string): Promise<void> {
  const ctx = await requirePermission("records:*");
  const entry = await prisma.recordEntry.findFirst({
    where: { id: entryId, record: { organizationId: ctx.organization.id } },
    include: { record: true },
  });
  if (!entry) throw new Error("Entrada no encontrada.");

  if (entry.fileUrl) {
    await deleteRecordFile(entry.fileUrl, ctx.organization.id);
    await releaseStorageQuota(ctx.organization.id, entry.fileSize ?? 0);
  }
  await prisma.recordEntry.delete({ where: { id: entryId } });
  await logAuditEvent({
    ctx,
    action: "delete",
    module: "record_entry",
    recordId: entry.recordId,
    before: { reference: entry.reference },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export type RecordExportFilters = {
  search?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE" | "DUE_SOON" | "OVERDUE";
  processId?: string;
  recordTypeId?: string;
  clauseId?: string;
};

export async function exportRecordsMatrix(input: { format: "PDF" | "EXCEL"; filters?: RecordExportFilters }) {
  return actionResult(() => exportRecordsMatrixImpl(input));
}

async function exportRecordsMatrixImpl(input: { format: "PDF" | "EXCEL"; filters?: RecordExportFilters }) {
  if (input.format !== "PDF" && input.format !== "EXCEL") throw new Error("Formato de exportación no válido.");
  const { ctx } = await requireAuthorization("records:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  const filters = input.filters ?? {};
  const scope = await getCollaboratorScope(ctx);
  const where: Prisma.RecordWhereInput = {
    organizationId: ctx.organization.id,
    ...(scope.isScoped ? { id: { in: scope.recordIds } } : {}),
    ...(filters.status === "ACTIVE" ? { active: true } : {}),
    ...(filters.status === "INACTIVE" ? { active: false } : {}),
    ...(filters.processId && filters.processId !== "ALL" ? { processId: filters.processId } : {}),
    ...(filters.recordTypeId && filters.recordTypeId !== "ALL" ? { recordTypeId: filters.recordTypeId } : {}),
    ...(filters.clauseId && filters.clauseId !== "ALL" ? { clauseId: filters.clauseId } : {}),
    ...(filters.search?.trim() ? { OR: [
      { code: { contains: filters.search.trim(), mode: "insensitive" } },
      { name: { contains: filters.search.trim(), mode: "insensitive" } },
      { observations: { contains: filters.search.trim(), mode: "insensitive" } },
    ] } : {}),
  };
  const generatedAt = new Date();
  const fileName = `matriz-control-registros-${generatedAt.toISOString().slice(0, 10)}.${input.format === "PDF" ? "pdf" : "xlsx"}`;
  const mimeType = input.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const report = await queueReportForContext({ ctx, reportType: "records", title: "Matriz de control de registros", format: input.format, fileName, dateFrom: generatedAt, dateTo: generatedAt, filters: { from: generatedAt.toISOString().slice(0, 10), to: generatedAt.toISOString().slice(0, 10), status: filters.status, ownerId: scope.isScoped ? ctx.user.id : undefined } });
  revalidatePath("/app/activity");
  return { id: report.id, fileName, mimeType, status: report.status, rowCount: report.rowCount };
}
