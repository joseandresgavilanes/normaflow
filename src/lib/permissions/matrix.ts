/**
 * Single source of truth for role → permissions mapping.
 *
 * Permission shape: "<resource>:<action>"
 *   - resource: dashboard, notifications, documents, processes, evidence,
 *               records, risks, audits, nc, actions, indicators, gap, training,
 *               changes, suppliers, opportunities, integrations, reporting, activity,
 *               positions, personnel, locations, catalogs, groups,
 *               mgmt-review, audit-program, org, members, billing
 *   - action:   directory | view | create | update | approve | delete | export | *
 *               (`read` remains a backwards-compatible alias for `view`)
 *
 * `members` tiene tres grados y no son intercambiables:
 *   members:directory → nombre y rol, para poder asignar trabajo
 *   members:view      → además el correo y la ficha, en lectura
 *   members:*         → invitar, cambiar rol y desactivar cuentas
 *
 * Used by both `src/lib/permissions/frontend.ts` (client gating) and
 * `src/lib/permissions/server.ts` (server-action enforcement).
 */

import type { Role } from "@prisma/client";

/** Actions supported by the live authorization contract. `read` and
 * `manage` are legacy aliases kept for existing server actions and groups. */
export const PERMISSION_ACTIONS = [
  // `directory` es más estrecho que `view`: da los nombres necesarios para
  // asignar trabajo, sin la ficha de la persona. Existe porque leer un nombre
  // y administrar la plantilla no deberían ser la misma concesión.
  "directory",
  "view",
  "create",
  "update",
  "approve",
  "delete",
  "export",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_MODULES = [
  "dashboard", "notifications", "org", "members", "groups", "documents",
  "processes", "evidence", "records", "risks", "audits", "audit-program",
  "nc", "actions", "indicators", "gap", "training", "changes", "suppliers",
  "opportunities", "integrations", "reporting", "activity", "positions",
  "personnel", "locations", "catalogs", "mgmt-review", "billing", "security-controls",
  "soa", "risk-treatment", "assets", "incidents", "vulnerabilities", "continuity",
  "standards", "packs", "environment", "safety", "integrated", "aims",
  // `speakup` es un módulo aparte de `compliance` a propósito: quien gestiona el
  // programa de cumplimiento no accede por ello al canal de denuncias.
  "compliance", "speakup", "energy", "food-safety", "itsm", "medical-devices", "md-sensitive",
  "quality-ops", "design-dev", "safety-sensitive", "antibribery-sensitive",
] as const;

export function normalizePermission(permission: string): string {
  const separator = permission.indexOf(":");
  if (separator < 0) return permission;
  const resource = permission.slice(0, separator);
  const action = permission.slice(separator + 1);
  return `${resource}:${action === "read" ? "view" : action}`;
}

export function permissionMatches(granted: string, requested: string): boolean {
  const normalizedGranted = normalizePermission(granted);
  const normalizedRequested = normalizePermission(requested);
  if (normalizedGranted === "*") return true;
  if (normalizedGranted === normalizedRequested) return true;
  const [resource] = normalizedRequested.split(":");
  return normalizedGranted === `${resource}:*`;
}

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
  "opportunities:*",
  "integrations:*",
  "reporting:*",
  "activity:*",
  "positions:*",
  "personnel:*",
  "locations:*",
  "catalogs:*",
  "mgmt-review:*",
  "billing:*",
  "security-controls:*",
  "soa:*",
  "risk-treatment:*",
  "assets:*",
  "incidents:*",
  "vulnerabilities:*",
  "continuity:*",
  "standards:*",
  "environment:*",
  "safety:*",
  "integrated:*",
  "aims:*",
  "compliance:*",
  // Administrar la organización no da acceso a las denuncias: solo a presentarlas.
  // Un expediente se abre con una autorización explícita en `SpeakUpCaseAccess`.
  "speakup:create",
  "energy:*",
  "food-safety:*",
  "itsm:*",
  "medical-devices:*",
  "md-sensitive:*",
  "quality-ops:*",
  "design-dev:*",
  "safety-sensitive:*",
  "antibribery-sensitive:*",
];

const MANAGER_PERMS = [
  "dashboard:view",
  "notifications:view",
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
  "opportunities:*",
  "integrations:view",
  "reporting:*",
  "activity:view",
  "positions:view",
  "personnel:view",
  "locations:view",
  "catalogs:view",
  "mgmt-review:*",
  "groups:view",
  "members:directory",
  "members:view",
  "security-controls:*",
  "soa:*",
  "risk-treatment:*",
  "assets:*",
  "incidents:*",
  "vulnerabilities:*",
  "continuity:*",
  "standards:read",
  "standards:activate",
  "environment:*",
  "safety:*",
  "integrated:*",
  "aims:*",
  "compliance:*",
  "speakup:create",
  "energy:*",
  "food-safety:*",
  "itsm:*",
  "medical-devices:*",
  "md-sensitive:*",
  "quality-ops:*",
  "design-dev:*",
  "safety-sensitive:*",
  "antibribery-sensitive:*",
];

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  OWNER: ["*"],
  ADMIN: ADMIN_PERMS,
  MANAGER: MANAGER_PERMS,
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
    "opportunities:*",
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
    "members:directory",
    "members:view",
    "security-controls:*",
    "soa:*",
    "risk-treatment:*",
    "assets:*",
    "incidents:*",
    "vulnerabilities:*",
    "continuity:*",
    "standards:*",
    "environment:*",
    "safety:*",
    "integrated:*",
    "aims:*",
    "compliance:*",
    // El único rol que opera el canal. Aun así, cada expediente exige su
    // autorización: el permiso abre la bandeja, no los casos.
    "speakup:read",
    "speakup:create",
    "speakup:update",
    "speakup:approve",
    "speakup:export",
    "energy:*",
    "food-safety:*",
    "itsm:*",
    "medical-devices:*",
    "md-sensitive:*",
    "quality-ops:*",
    "design-dev:*",
    "safety-sensitive:*",
    "antibribery-sensitive:*",
  ],
  AUDITOR: [
    "dashboard:read",
    "notifications:read",
    // Nombres para poder asignar; sin correo y sin administrar la plantilla.
    "members:directory",
    "audits:*",
    "audit-program:read",
    "audit-program:export",
    "audits:export",
    "nc:create",
    "nc:read",
    "documents:read",
    "processes:read",
    "evidence:read",
    "records:read",
    "records:export",
    "risks:read",
    "training:read",
    "changes:read",
    "suppliers:read",
    "opportunities:read",
    // Sin `documents:approve` a propósito: un auditor que aprueba el documento
    // que después audita deja de ser independiente de lo que evalúa. Levanta
    // hallazgos y no conformidades; aprobar es de quien opera el sistema.
    "documents:export",
    "actions:read",
    "actions:create",
    "actions:export",
    "evidence:export",
    "reporting:export",
    "reporting:read",
    "activity:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
    "mgmt-review:read",
    "mgmt-review:export",
    "security-controls:read",
    "security-controls:export",
    "security-controls:approve",
    "soa:read",
    "soa:export",
    "soa:approve",
    "risk-treatment:read",
    "risk-treatment:export",
    "assets:read",
    "assets:export",
    "suppliers:export",
    "incidents:read",
    "incidents:export",
    "vulnerabilities:read",
    "vulnerabilities:export",
    "continuity:read",
    "continuity:export",
    "standards:read",
    "standards:export",
    "environment:read",
    "environment:export",
    "safety:read",
    "safety:export",
    "integrated:read",
    "integrated:export",
    "aims:read",
    "aims:export",
    "compliance:read",
    "compliance:export",
    // El auditor ve el canal solo agregado y anonimizado; los expedientes,
    // únicamente si se le autoriza caso por caso.
    "speakup:create",
    "energy:read",
    "energy:export",
    "food-safety:read",
    "food-safety:export",
    "itsm:read",
    "itsm:export",
    "medical-devices:read",
    "medical-devices:export",
    "md-sensitive:read",
    "md-sensitive:export",
    "quality-ops:read",
    "quality-ops:export",
    "design-dev:read",
    "design-dev:export",
    "safety-sensitive:read",
    "safety-sensitive:export",
    "antibribery-sensitive:read",
    "antibribery-sensitive:export",
  ],
  CONTRIBUTOR: [
    "dashboard:read",
    "notifications:read",
    // Nombres para poder asignar; sin correo y sin administrar la plantilla.
    "members:directory",
    "documents:read",
    "documents:create",
    "processes:read",
    "risks:read",
    "risks:create",
    "audits:read",
    "audits:create",
    "indicators:read",
    "indicators:create",
    "evidence:read",
    "evidence:create",
    "records:read",
    "records:create",
    "actions:read",
    "actions:create",
    "actions:update",
    "nc:read",
    "training:read",
    "changes:read",
    "suppliers:read",
    "opportunities:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
    "security-controls:read",
    "soa:read",
    "risk-treatment:read",
    "assets:read",
    "assets:create",
    "incidents:read",
    "incidents:create",
    "vulnerabilities:read",
    "continuity:read",
    "continuity:create",
    "standards:read",
    "environment:read",
    "environment:create",
    "safety:read",
    "safety:create",
    "integrated:read",
    // Puede registrar y enviar a revisión salidas de IA, nunca aprobarlas:
    // `aims:approve` se reserva a los roles de gestión (regla humana).
    "aims:read",
    "aims:create",
    "compliance:read",
    // Cualquiera puede denunciar: es la razón de existir del canal.
    "speakup:create",
    "energy:read",
    "energy:create",
    "food-safety:read",
    "food-safety:create",
    "itsm:read",
    "itsm:create",
    "medical-devices:read",
    "medical-devices:create",
    "quality-ops:read",
    "quality-ops:create",
    "design-dev:read",
    "design-dev:create",
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
    "opportunities:read",
    "reporting:read",
    "activity:read",
    "personnel:read",
    "positions:read",
    "catalogs:read",
    "security-controls:read",
    "mgmt-review:read",
    "soa:read",
    "risk-treatment:read",
    "assets:read",
    "incidents:read",
    "vulnerabilities:read",
    "continuity:read",
    "standards:read",
    "environment:read",
    "safety:read",
    "integrated:read",
    "aims:read",
    "compliance:read",
    "speakup:create",
    "energy:read",
    "food-safety:read",
    "itsm:read",
    "medical-devices:read",
    "quality-ops:read",
    "design-dev:read",
  ],
};

/** Explicit allowlist for grants stored in GroupPermission. Global `*` is a
 * role-only capability and can never be obtained through a group. */
export const GROUP_PERMISSION_ALLOWLIST = new Set(
  [
    ...Object.values(ROLE_PERMISSIONS).flat().filter((permission) => permission !== "*"),
    ...PERMISSION_MODULES.flatMap((module) => PERMISSION_ACTIONS.map((action) => `${module}:${action}`)),
    ...PERMISSION_MODULES.flatMap((module) => [`${module}:read`, `${module}:*`]),
  ],
);

/**
 * Check whether a role can perform a permission.
 * Supports wildcards: "*" (super-admin), "<resource>:*" (resource-wide).
 */
export function roleCan(role: Role | string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.some((granted) => permissionMatches(granted, permission));
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
  return groupPermissions.some((granted) => permissionMatches(granted, permission));
}
