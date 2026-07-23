"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * Generic CRUD server actions for the manual-required catalogs.
 * Every action:
 *  - requires permission
 *  - scopes by ctx.organization.id (no cross-tenant access)
 *  - emits an AuditLog row
 *  - revalidates the catalog page
 */

type SimpleCatalog =
  | "location"
  | "disposition"
  | "archiveMethod"
  | "recordType"
  | "position";

const CATALOG_META: Record<
  SimpleCatalog,
  { module: string; permission: string; pagePath: string; label: string }
> = {
  location:      { module: "location",       permission: "locations:*",  pagePath: "/app/catalogs/locations",     label: "Lugar" },
  disposition:   { module: "disposition",    permission: "catalogs:*",   pagePath: "/app/catalogs/disposition",   label: "Disposición" },
  archiveMethod: { module: "archive_method", permission: "catalogs:*",   pagePath: "/app/catalogs/archive-method", label: "Método de archivo" },
  recordType:    { module: "record_type",    permission: "catalogs:*",   pagePath: "/app/catalogs/record-type",   label: "Tipo de registro" },
  position:      { module: "position",       permission: "positions:*",  pagePath: "/app/info/positions",          label: "Cargo" },
};

type GenericDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  findFirst: (args: { where: { id: string; organizationId: string } }) => Promise<
    { id: string; organizationId: string; name: string; description?: string | null; active: boolean } | null
  >;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
};

function delegateFor(c: SimpleCatalog): GenericDelegate {
  switch (c) {
    case "location":      return prisma.location as unknown as GenericDelegate;
    case "disposition":   return prisma.disposition as unknown as GenericDelegate;
    case "archiveMethod": return prisma.archiveMethod as unknown as GenericDelegate;
    case "recordType":    return prisma.recordType as unknown as GenericDelegate;
    case "position":      return prisma.position as unknown as GenericDelegate;
  }
}

// ─── Simple catalogs (name + optional description) ────────────────────

export async function createSimpleCatalog(
  catalog: SimpleCatalog,
  data: { name: string; description?: string; code?: string }
) {
  const meta = CATALOG_META[catalog];
  const ctx = await requirePermission(meta.permission);
  const name = data.name.trim();
  if (!name) throw new Error(`El nombre de ${meta.label} es obligatorio.`);
  const code = catalog === "recordType" ? data.code?.trim() || null : null;
  if (catalog === "recordType" && !code) throw new Error("El código del tipo de registro es obligatorio.");

  const delegate = delegateFor(catalog);

  const created = await delegate.create({
    data: {
      organizationId: ctx.organization.id,
      ...(catalog === "recordType" ? { code } : {}),
      name,
      description: catalog === "location" || catalog === "position" ? data.description?.trim() || null : undefined,
    },
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: meta.module,
    recordId: created.id,
    after: { name, code, description: data.description },
  });
  revalidatePath(meta.pagePath);
}

export async function updateSimpleCatalog(
  catalog: SimpleCatalog,
  id: string,
  data: { name?: string; code?: string; description?: string; active?: boolean }
) {
  const meta = CATALOG_META[catalog];
  const ctx = await requirePermission(meta.permission);

  const delegate = delegateFor(catalog);

  const existing = await delegate.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");

  const updatePayload: Record<string, unknown> = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (catalog === "recordType" && data.code !== undefined) {
    const code = data.code.trim();
    if (!code) throw new Error("El código del tipo de registro es obligatorio.");
    updatePayload.code = code;
  }
  if (data.active !== undefined) updatePayload.active = data.active;
  if ((catalog === "location" || catalog === "position") && data.description !== undefined) {
    updatePayload.description = data.description.trim() || null;
  }

  await delegate.update({ where: { id }, data: updatePayload });

  await logAuditEvent({
    ctx,
    action: "update",
    module: meta.module,
    recordId: id,
    before: { name: existing.name, description: existing.description, active: existing.active },
    after: updatePayload,
  });
  revalidatePath(meta.pagePath);
}

export async function deleteSimpleCatalog(catalog: SimpleCatalog, id: string) {
  const meta = CATALOG_META[catalog];
  const ctx = await requirePermission(meta.permission);

  const delegate = delegateFor(catalog);

  const existing = await delegate.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");

  // Soft-delete: catalogs are referenced by other records; deactivate instead of physical delete.
  await delegate.update({ where: { id }, data: { active: false } });

  await logAuditEvent({
    ctx,
    action: "deactivate",
    module: meta.module,
    recordId: id,
    before: { name: existing.name },
  });
  revalidatePath(meta.pagePath);
}

// ─── RetentionTime (has `months` field) ───────────────────────────────

export async function createRetentionTime(data: { name: string; months: number }) {
  const ctx = await requirePermission("catalogs:*");
  const name = data.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  if (!Number.isFinite(data.months) || data.months < 0) throw new Error("Los meses deben ser un número no negativo.");

  const created = await prisma.retentionTime.create({
    data: { organizationId: ctx.organization.id, name, months: Math.round(data.months) },
  });
  await logAuditEvent({ ctx, action: "create", module: "retention_time", recordId: created.id, after: { name, months: data.months } });
  revalidatePath("/app/catalogs/retention");
}

export async function updateRetentionTime(
  id: string,
  data: { name?: string; months?: number; active?: boolean }
) {
  const ctx = await requirePermission("catalogs:*");
  const existing = await prisma.retentionTime.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.months !== undefined) {
    if (!Number.isFinite(data.months) || data.months < 0) throw new Error("Los meses deben ser un número no negativo.");
    patch.months = Math.round(data.months);
  }
  if (data.active !== undefined) patch.active = data.active;

  await prisma.retentionTime.update({ where: { id }, data: patch });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "retention_time",
    recordId: id,
    before: { name: existing.name, months: existing.months, active: existing.active },
    after: patch,
  });
  revalidatePath("/app/catalogs/retention");
}

export async function deleteRetentionTime(id: string) {
  const ctx = await requirePermission("catalogs:*");
  const existing = await prisma.retentionTime.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Registro no encontrado.");
  await prisma.retentionTime.update({ where: { id }, data: { active: false } });
  await logAuditEvent({ ctx, action: "deactivate", module: "retention_time", recordId: id, before: { name: existing.name } });
  revalidatePath("/app/catalogs/retention");
}
