import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppContext, type LiveAppContext } from "@/lib/app-context";
import { GROUP_PERMISSION_ALLOWLIST, roleOrGroupCan } from "./matrix";

export type ServerAuthorization = {
  ctx: LiveAppContext;
  groupPermissions: readonly string[];
  can: (permission: string) => boolean;
};

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
 * Resolve the authenticated tenant and every permission grant before any
 * business-data query is executed. The only query performed here reads the
 * caller's own authorization metadata, scoped to the selected organization.
 */
export async function getServerAuthorization(): Promise<ServerAuthorization> {
  const ctx = await requireLiveContext();
  const rows = await prisma.groupPermission.findMany({
    where: {
      group: {
        organizationId: ctx.organization.id,
        members: { some: { userId: ctx.user.id } },
      },
    },
    select: { permission: true },
  });
  const groupPermissions = rows
    .map((row) => row.permission)
    .filter((permission) => GROUP_PERMISSION_ALLOWLIST.has(permission));

  return {
    ctx,
    groupPermissions,
    can: (permission) => roleOrGroupCan(ctx.role, groupPermissions, permission),
  };
}

/**
 * Require a permission for the current user in the current organization.
 * Checks role permissions and merges in any explicit GroupPermission rows.
 * Throws `PermissionError` if denied.
 */
export async function requirePermission(permission: string): Promise<LiveAppContext> {
  return (await requireAuthorization(permission)).ctx;
}

export async function requireAuthorization(permission: string): Promise<ServerAuthorization> {
  const authorization = await getServerAuthorization();
  if (!authorization.can(permission)) throw new PermissionError(permission);
  return authorization;
}

export function isAuthorizationError(error: unknown): boolean {
  return error instanceof PermissionError || error instanceof UnauthenticatedError;
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
