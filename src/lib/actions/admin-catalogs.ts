"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  adminCatalogKindSchema,
  catalogItemPatchSchema,
  catalogItemSchema,
  parseActionInput,
  type AdminCatalogKind,
} from "@/lib/validation/admin";

const PAGE_PATH = "/app/settings/catalogs";

function assertCatalogPermission(kind: AdminCatalogKind) {
  // All configurable admin catalogs are governed by the same tenant-level
  // permission. The kind is still validated so callers cannot inject table or
  // module names through a browser request.
  adminCatalogKindSchema.parse(kind);
  return "catalogs:*";
}

export async function listAdminCatalogItems(kind?: AdminCatalogKind) {
  const ctx = await requirePermission("catalogs:read");
  const parsedKind = kind ? parseActionInput(adminCatalogKindSchema, kind) : undefined;
  return prisma.organizationCatalogItem.findMany({
    where: { organizationId: ctx.organization.id, ...(parsedKind ? { kind: parsedKind } : {}) },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createAdminCatalogItem(input: {
  kind: AdminCatalogKind;
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  const ctx = await requirePermission(assertCatalogPermission(input.kind));
  const data = parseActionInput(catalogItemSchema, input);
  const created = await prisma.organizationCatalogItem.create({
    data: {
      organizationId: ctx.organization.id,
      kind: data.kind,
      name: data.name,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await logAuditEvent({ ctx, action: "create", module: "catalog", recordId: created.id, after: data });
  revalidatePath(PAGE_PATH);
  return { id: created.id };
}

export async function updateAdminCatalogItem(input: {
  id: string;
  kind?: AdminCatalogKind;
  name?: string;
  description?: string;
  active?: boolean;
  sortOrder?: number;
}) {
  const ctx = await requirePermission("catalogs:*");
  const data = parseActionInput(catalogItemPatchSchema, input);
  const existing = await prisma.organizationCatalogItem.findFirst({
    where: { id: data.id, organizationId: ctx.organization.id },
  });
  if (!existing) throw new Error("Elemento de catálogo no encontrado.");
  if (data.kind && data.kind !== existing.kind) throw new Error("No se puede cambiar el tipo de catálogo.");

  const patch = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
  };
  await prisma.organizationCatalogItem.update({ where: { id: existing.id }, data: patch });
  await logAuditEvent({ ctx, action: data.active === false ? "deactivate" : "update", module: "catalog", recordId: existing.id, before: existing, after: patch });
  revalidatePath(PAGE_PATH);
}

export async function deleteAdminCatalogItem(id: string) {
  const ctx = await requirePermission("catalogs:*");
  const existing = await prisma.organizationCatalogItem.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Elemento de catálogo no encontrado.");
  await prisma.organizationCatalogItem.update({ where: { id }, data: { active: false } });
  await logAuditEvent({ ctx, action: "deactivate", module: "catalog", recordId: id, before: existing, after: { active: false } });
  revalidatePath(PAGE_PATH);
}
