import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppContext, type LiveAppContext } from "@/lib/app-context";
import { roleOrGroupCan } from "./matrix";

export class PermissionError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "PermissionError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export class TenantMismatchError extends Error {
  constructor() {
    super("Resource does not belong to the current organization");
    this.name = "TenantMismatchError";
  }
}

/**
 * Require a live (non-demo) authenticated context with a selected organization.
 * Throws `UnauthenticatedError` otherwise.
 */
export async function requireLiveContext(): Promise<LiveAppContext> {
  const ctx = await getAppContext();
  if (!ctx || ctx.mode !== "live") throw new UnauthenticatedError();
  return ctx;
}

/**
 * Require a permission for the current user in the current organization.
 * Checks role permissions and merges in any explicit GroupPermission rows.
 * Throws `PermissionError` if denied.
 */
export async function requirePermission(permission: string): Promise<LiveAppContext> {
  const ctx = await requireLiveContext();

  const groupPerms = await prisma.groupPermission.findMany({
    where: {
      group: {
        organizationId: ctx.organization.id,
        members: { some: { userId: ctx.user.id } },
      },
    },
    select: { permission: true },
  });

  const allowed = roleOrGroupCan(
    ctx.role,
    groupPerms.map((p) => p.permission),
    permission
  );
  if (!allowed) throw new PermissionError(permission);
  return ctx;
}

/**
 * Assert that a fetched record belongs to the current org. Use this
 * defensively in server actions that load by ID.
 */
export function assertSameTenant(
  ctx: LiveAppContext,
  record: { organizationId: string }
) {
  if (record.organizationId !== ctx.organization.id) {
    throw new TenantMismatchError();
  }
}
