"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createSignedRecordUrl, deleteRecordFile, uploadRecordFile } from "@/lib/storage";

const PATH = "/app/records";

export type RecordInput = {
  code: string;
  name: string;
  processId?: string;
  recordTypeId?: string;
  retentionTimeId?: string;
  dispositionId?: string;
  archiveMethodId?: string;
  custodianId?: string;
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
    recordTypeId: input.recordTypeId || null,
    retentionTimeId: input.retentionTimeId || null,
    dispositionId: input.dispositionId || null,
    archiveMethodId: input.archiveMethodId || null,
    custodianId: input.custodianId || null,
    physicalLocation: input.physicalLocation?.trim() || null,
    digitalLocation: input.digitalLocation?.trim() || null,
    observations: input.observations?.trim() || null,
  };
}

async function assertRecordReferences(input: Partial<RecordInput>, organizationId: string) {
  const [process, recordType, retentionTime, disposition, archiveMethod, custodian] = await Promise.all([
    input.processId ? prisma.process.findFirst({ where: { id: input.processId, organizationId }, select: { id: true } }) : null,
    input.recordTypeId ? prisma.recordType.findFirst({ where: { id: input.recordTypeId, organizationId }, select: { id: true } }) : null,
    input.retentionTimeId ? prisma.retentionTime.findFirst({ where: { id: input.retentionTimeId, organizationId }, select: { id: true } }) : null,
    input.dispositionId ? prisma.disposition.findFirst({ where: { id: input.dispositionId, organizationId }, select: { id: true } }) : null,
    input.archiveMethodId ? prisma.archiveMethod.findFirst({ where: { id: input.archiveMethodId, organizationId }, select: { id: true } }) : null,
    input.custodianId ? prisma.personnel.findFirst({ where: { id: input.custodianId, organizationId }, select: { id: true } }) : null,
  ]);
  if (input.processId && !process) throw new Error("El proceso no pertenece a la organización.");
  if (input.recordTypeId && !recordType) throw new Error("El tipo de registro no pertenece a la organización.");
  if (input.retentionTimeId && !retentionTime) throw new Error("El tiempo de retención no pertenece a la organización.");
  if (input.dispositionId && !disposition) throw new Error("La disposición no pertenece a la organización.");
  if (input.archiveMethodId && !archiveMethod) throw new Error("El método de archivo no pertenece a la organización.");
  if (input.custodianId && !custodian) throw new Error("El custodio no pertenece a la organización.");
}

export async function createRecord(input: RecordInput): Promise<void> {
  const ctx = await requirePermission("records:create");
  const data = normalize(input);
  await assertRecordReferences(input, ctx.organization.id);

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
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function updateRecord(id: string, input: Partial<RecordInput>): Promise<void> {
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
  if (input.recordTypeId !== undefined) patch.recordTypeId = input.recordTypeId || null;
  if (input.retentionTimeId !== undefined) patch.retentionTimeId = input.retentionTimeId || null;
  if (input.dispositionId !== undefined) patch.dispositionId = input.dispositionId || null;
  if (input.archiveMethodId !== undefined) patch.archiveMethodId = input.archiveMethodId || null;
  if (input.custodianId !== undefined) patch.custodianId = input.custodianId || null;
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
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function deactivateRecord(id: string): Promise<void> {
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
  input: { reference: string; description?: string; file?: File }
): Promise<void> {
  const ctx = await requirePermission("records:create");
  const reference = input.reference.trim();
  if (!reference) throw new Error("La referencia es obligatoria.");

  const record = await prisma.record.findFirst({ where: { id: recordId, organizationId: ctx.organization.id } });
  if (!record) throw new Error("Registro no encontrado.");

  const id = randomUUID();
  const uploaded = input.file ? await uploadRecordFile({ organizationId: ctx.organization.id, recordId, entryId: id, file: input.file }) : null;
  try {
    await prisma.recordEntry.create({
      data: {
        id,
        recordId,
        reference,
        description: input.description?.trim() || null,
        fileName: uploaded?.fileName ?? null,
        fileUrl: uploaded?.path ?? null,
        fileSize: uploaded?.size ?? null,
        mimeType: uploaded?.mime ?? null,
        enteredById: ctx.user.id,
      },
    });
  } catch (error) {
    if (uploaded) await deleteRecordFile(uploaded.path).catch(() => undefined);
    throw error;
  }

  await logAuditEvent({
    ctx,
    action: "add_entry",
    module: "record_entry",
    recordId,
    extra: { reference, fileName: uploaded?.fileName, fileSize: uploaded?.size, mimeType: uploaded?.mime },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function getRecordEntryUrl(entryId: string): Promise<string> {
  const ctx = await requirePermission("records:read");
  const entry = await prisma.recordEntry.findFirst({ where: { id: entryId, record: { organizationId: ctx.organization.id } } });
  if (!entry) throw new Error("Entrada no encontrada.");
  if (!entry.fileUrl) throw new Error("Esta entrada no tiene un archivo almacenado.");
  return createSignedRecordUrl(entry.fileUrl, 300);
}

export async function deleteRecordEntry(entryId: string): Promise<void> {
  const ctx = await requirePermission("records:*");
  const entry = await prisma.recordEntry.findFirst({
    where: { id: entryId, record: { organizationId: ctx.organization.id } },
    include: { record: true },
  });
  if (!entry) throw new Error("Entrada no encontrada.");

  if (entry.fileUrl) await deleteRecordFile(entry.fileUrl);
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
