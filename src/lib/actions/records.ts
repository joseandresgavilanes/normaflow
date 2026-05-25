"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const PATH = "/app/records";

export type RecordInput = {
  code: string;
  name: string;
  processName?: string;
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

export async function createRecord(input: RecordInput): Promise<void> {
  const ctx = await requirePermission("records:create");
  const data = normalize(input);

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
  const existing = await prisma.record.findUnique({ where: { id } });
  if (!existing) throw new Error("Registro no encontrado.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");

  const patch: Record<string, unknown> = {};
  if (input.code !== undefined) patch.code = input.code.trim();
  if (input.name !== undefined) patch.name = input.name.trim();
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
  const existing = await prisma.record.findUnique({ where: { id } });
  if (!existing) throw new Error("Registro no encontrado.");
  if (existing.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");

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
  input: { reference: string; description?: string; fileName?: string }
): Promise<void> {
  const ctx = await requirePermission("records:create");
  const reference = input.reference.trim();
  if (!reference) throw new Error("La referencia es obligatoria.");

  const record = await prisma.record.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("Registro no encontrado.");
  if (record.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");

  await prisma.recordEntry.create({
    data: {
      recordId,
      reference,
      description: input.description?.trim() || null,
      // El field "fileName" no existe en RecordEntry; usamos un placeholder en metadata.
      // Si más adelante se sube a Storage, fileUrl/mimeType/fileSize se llenan ahí.
      fileUrl: input.fileName?.trim() || null,
      enteredById: ctx.user.id,
    },
  });

  await logAuditEvent({
    ctx,
    action: "add_entry",
    module: "record_entry",
    recordId,
    extra: { reference, fileName: input.fileName },
  });
  revalidatePath(PATH);
  revalidatePath("/app/activity");
}

export async function deleteRecordEntry(entryId: string): Promise<void> {
  const ctx = await requirePermission("records:*");
  const entry = await prisma.recordEntry.findUnique({
    where: { id: entryId },
    include: { record: true },
  });
  if (!entry) throw new Error("Entrada no encontrada.");
  if (entry.record.organizationId !== ctx.organization.id) throw new Error("Acceso denegado.");

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
