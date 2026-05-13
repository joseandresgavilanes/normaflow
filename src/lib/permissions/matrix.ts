/**
 * Single source of truth for role → permissions mapping.
 *
 * Permission shape: "<resource>:<action>"
 *   - resource: documents, records, audits, nc, actions, indicators,
 *               gap, training, changes, suppliers, integrations,
 *               reporting, activity, positions, personnel, locations,
 *               catalogs, groups, mgmt-review, audit-program, org, members
 *   - action:   read | create | update | delete | approve | * (wildcard)
 *
 * Used by both `src/lib/permissions/frontend.ts` (client gating) and
 * `src/lib/permissions/server.ts` (server-action enforcement).
 */

import type { Role } from "@prisma/client";

const ADMIN_PERMS = [
  "org:*",
  "members:*",
  "groups:*",
  "documents:*",
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
];

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  SUPER_ADMIN: ["*"],
  ORG_ADMIN: ADMIN_PERMS,
  COMPLIANCE_MANAGER: [
    "documents:*",
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
    "audits:*",
    "audit-program:read",
    "nc:create",
    "nc:read",
    "documents:read",
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
    "documents:read",
    "documents:create",
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
    "documents:read",
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
  if (groupPermissions.includes("*")) return true;
  if (groupPermissions.includes(permission)) return true;
  const [resource] = permission.split(":");
  return groupPermissions.includes(`${resource}:*`);
}
