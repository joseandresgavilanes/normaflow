import "server-only";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LiveAppContext } from "@/lib/app-context";

/**
 * System-wide audit-trail emitter. Writes a row to the `AuditLog` table
 * that captures who did what to which record, in which organization,
 * with optional before/after snapshots for field-level diffs.
 *
 * Standard module keys:
 *   document, document_version, approval, record, record_entry,
 *   action, nonconformity, audit, audit_program, finding,
 *   mgmt_review, indicator, risk, control, process, position,
 *   personnel, location, group, group_permission, member, org
 *
 * Standard action verbs (lowercase snake_case):
 *   create, update, delete, status_change, approve, reject,
 *   submit_review, publish, obsolete, archive, restore,
 *   assign_owner, attach_file, download, export, login, logout
 */
export type AuditLogInput = {
  ctx: LiveAppContext;
  action: string;
  module: string;
  recordId?: string | null;
  /** Snapshot of the entity before the change (for diff). */
  before?: Record<string, unknown>;
  /** Snapshot of the entity after the change (for diff). */
  after?: Record<string, unknown>;
  /** Free-form extra metadata (reason, attestation, downstream IDs, ...). */
  extra?: Record<string, unknown>;
};

type AuditLogWriter = Pick<Prisma.TransactionClient, "auditLog">;

async function requestMetadata() {
  let ip: string | undefined;
  let userAgent: string | undefined;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || undefined;
    userAgent = h.get("user-agent") || undefined;
  } catch {
    /* headers() unavailable outside request context — fine */
  }
  return { ip, userAgent };
}

export async function writeAuditLog(writer: AuditLogWriter, input: AuditLogInput, request?: { ip?: string; userAgent?: string }): Promise<void> {
  const { ctx, action, module, recordId, before, after, extra } = input;

  const metadata: Record<string, unknown> = {};
  if (before) metadata.before = before;
  if (after) metadata.after = after;
  if (extra) Object.assign(metadata, extra);

  const requestInfo = request ?? await requestMetadata();
  await writer.auditLog.create({
    data: {
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action,
      module,
      recordId: recordId ?? null,
      metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : undefined,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
    },
  });
}

export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  await prisma.$transaction(async (tx) => writeAuditLog(tx, input));
}

/**
 * Compute a shallow diff between `before` and `after`. Useful for
 * passing to `logAuditEvent` to keep audit rows small.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T
): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  let changed = false;
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const key = k as keyof T;
    const bv = before[key];
    const av = after[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[key] = bv;
      a[key] = av;
      changed = true;
    }
  }
  return changed ? { before: b, after: a } : null;
}

/* ---------------------------------------------------------------------------
 * Historial por entidad
 * ------------------------------------------------------------------------ */

export type EntityHistoryEntry = {
  id: string;
  action: string;
  module: string;
  at: string;
  by: string;
  /** Campos que cambiaron, cuando la mutación guardó before/after. */
  changes: { field: string; from: unknown; to: unknown }[];
};

/**
 * Rastro de una entidad concreta.
 *
 * Generaliza `getAssetHistory`, que era el único historial por entidad del
 * producto: el resto de AuditLog solo se veía agregado en /app/activity.
 *
 * `organizationId` NO sale del argumento sino del contexto autenticado, y la
 * pertenencia del registro se comprueba antes de llamar aquí. Filtrar por
 * `recordId` sin acotar la organización devolvería el rastro de otro
 * inquilino a quien acertara un id.
 */
export async function getEntityHistory({
  organizationId,
  modules,
  recordId,
  limit = 60,
}: {
  organizationId: string;
  /** Claves de módulo relacionadas: la principal más sus satélites. */
  modules: string[];
  recordId: string;
  limit?: number;
}): Promise<EntityHistoryEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: { organizationId, module: { in: modules }, recordId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });

  return logs.map((log) => {
    const metadata = (log.metadata ?? {}) as Record<string, unknown>;
    const before = (metadata.before ?? {}) as Record<string, unknown>;
    const after = (metadata.after ?? {}) as Record<string, unknown>;
    const changes = Object.keys(after)
      .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      .map((field) => ({ field, from: before[field], to: after[field] }));

    return {
      id: log.id,
      action: log.action,
      module: log.module,
      at: log.createdAt.toISOString(),
      by: log.user?.name ?? "Sistema",
      changes,
    };
  });
}
