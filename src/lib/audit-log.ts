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
