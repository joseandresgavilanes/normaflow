/**
 * Single source of truth for role → permissions mapping.
 *
 * Permission shape: "<resource>:<action>"
 *   - resource: dashboard, notifications, documents, processes, evidence,
 *               records, audits, nc, actions, indicators, gap, training,
 *               changes, suppliers, integrations, reporting, activity,
 *               positions, personnel, locations, catalogs, groups,
 *               mgmt-review, audit-program, org, members, billing
 *   - action:   read | create | update | delete | approve | * (wildcard)
 *
 * Used by both `src/lib/permissions/frontend.ts` (client gating) and
 * `src/lib/permissions/server.ts` (server-action enforcement).
 */

import type { Role } from "@prisma/client";

const ADMIN_PERMS = [
  "dashboard:read",
  "notifications:read",
  "org:*",
  "members:*",
  "groups:*",
  "documents:*",
  "processes:*",
  "evidence:*",
  "records:*",
  "risks:*",
  "audits:*",
  "audit-program:*",
  "nc:*",
  "actions:*",
  "indicators:*",
  "gap:*",
  "training:*",
  "changes:*",
  "suppliers:*",
  "integrations:*",
  "reporting:*",
  "activity:*",
  "positions:*",
  "personnel:*",
  "locations:*",
  "catalogs:*",
  "mgmt-review:*",
  "billing:*",
];

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  SUPER_ADMIN: ["*"],
  ORG_ADMIN: ADMIN_PERMS,
  COMPLIANCE_MANAGER: [
    "dashboard:read",
    "notifications:read",
    "documents:*",
    "processes:*",
    "evidence:*",
    "records:*",
    "risks:*",
    "audits:*",
    "audit-program:*",
    "nc:*",
    "actions:*",
    "indicators:*",
    "gap:*",
    "training:*",
    "changes:*",
    "suppliers:*",
    "integrations:read",
    "integrations:manage",
    "reporting:*",
    "activity:read",
    "positions:read",
    "personnel:read",
    "locations:read",
    "catalogs:read",
    "mgmt-review:*",
    "groups:read",
  ],
  AUDITOR: [
    "dashboard:read",
    "notifications:read",
    "audits:*",
    "audit-program:read",
    "nc:create",
    "nc:read",
    "documents:read",
    "processes:read",
    "evidence:read",
    "records:read",
    "risks:read",
    "training:read",
    "changes:read",
    "suppliers:read",
    "reporting:read",
    "activity:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
    "mgmt-review:read",
  ],
  CONTRIBUTOR: [
    "dashboard:read",
    "notifications:read",
    "documents:read",
    "documents:create",
    "processes:read",
    "evidence:read",
    "evidence:create",
    "records:read",
    "records:create",
    "actions:read",
    "actions:update",
    "nc:read",
    "training:read",
    "changes:read",
    "suppliers:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
  ],
  VIEWER: [
    "dashboard:read",
    "notifications:read",
    "documents:read",
    "processes:read",
    "evidence:read",
    "records:read",
    "risks:read",
    "audits:read",
    "indicators:read",
    "training:read",
    "changes:read",
    "suppliers:read",
    "reporting:read",
    "activity:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
    "mgmt-review:read",
  ],
};

/** Explicit allowlist for grants stored in GroupPermission. Global `*` is a
 * role-only capability and can never be obtained through a group. */
export const GROUP_PERMISSION_ALLOWLIST = new Set(
  Object.values(ROLE_PERMISSIONS).flat().filter((permission) => permission !== "*"),
);

/**
 * Check whether a role can perform a permission.
 * Supports wildcards: "*" (super-admin), "<resource>:*" (resource-wide).
 */
export function roleCan(role: Role | string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const [resource] = permission.split(":");
  return perms.includes(`${resource}:*`);
}

/**
 * Check role + extra group permissions (for organizations that grant
 * fine-grained group permissions via GroupPermission). Returns true if
 * either source grants the permission.
 */
export function roleOrGroupCan(
  role: Role | string,
  groupPermissions: readonly string[],
  permission: string
): boolean {
  if (roleCan(role, permission)) return true;
  if (groupPermissions.includes(permission)) return true;
  const [resource] = permission.split(":");
  return groupPermissions.includes(`${resource}:*`);
}
