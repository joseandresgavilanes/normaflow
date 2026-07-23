import { PERMISSIONS, ROLES } from "@/lib/constants";
import { permissionMatches } from "./matrix";

export type AppRoleKey = keyof typeof ROLES;

/** Comprueba permiso demo en frontend (sin enforcement servidor) */
export function canDemo(roleKey: string, permission: string): boolean {
  const perms = PERMISSIONS[roleKey as AppRoleKey] as readonly string[] | undefined;
  if (!perms) return false;
  return perms.some(p => permissionMatches(p, permission));
}

export function canExplicitPermission(
  permissions: readonly string[] | undefined,
  permission: string,
): boolean {
  if (!permissions?.length) return false;
  return permissions.some(p => permissionMatches(p, permission));
}

export function canFrontend(
  roleKey: string,
  permission: string,
  extraPermissions?: readonly string[],
): boolean {
  return canDemo(roleKey, permission) || canExplicitPermission(extraPermissions, permission);
}

export function canCreateDocuments(roleKey: string): boolean {
  return canDemo(roleKey, "documents:create") || canDemo(roleKey, "documents:*");
}

export function canEditDocuments(roleKey: string): boolean {
  return canDemo(roleKey, "documents:*");
}

export function canApproveDocuments(roleKey: string): boolean {
  return ["OWNER", "ADMIN", "MANAGER", "ORG_ADMIN", "COMPLIANCE_MANAGER", "SUPER_ADMIN"].includes(roleKey) || canDemo(roleKey, "documents:approve");
}

export function canManageRisks(roleKey: string): boolean {
  return canDemo(roleKey, "risks:*") || canDemo(roleKey, "risks:create");
}

export function canManageAudits(roleKey: string): boolean {
  return canDemo(roleKey, "audits:*") || canDemo(roleKey, "audits:create");
}

export function canManageIndicators(roleKey: string): boolean {
  return canDemo(roleKey, "indicators:*") || canDemo(roleKey, "indicators:create");
}

export function canManageNc(roleKey: string): boolean {
  return canDemo(roleKey, "nc:*") || canDemo(roleKey, "nc:create");
}

export function canManageActions(roleKey: string): boolean {
  return canDemo(roleKey, "actions:*") || canDemo(roleKey, "actions:update");
}

export function canManageGap(roleKey: string): boolean {
  return canDemo(roleKey, "gap:*");
}

export function canAccessBilling(roleKey: string): boolean {
  return ["OWNER", "ADMIN", "ORG_ADMIN", "SUPER_ADMIN"].includes(roleKey);
}

export function canManageTraining(roleKey: string): boolean {
  return canDemo(roleKey, "training:*");
}

export function canManageChanges(roleKey: string): boolean {
  return canDemo(roleKey, "changes:*");
}

export function canManageSuppliers(roleKey: string): boolean {
  return canDemo(roleKey, "suppliers:*");
}

export function canReadActivity(roleKey: string): boolean {
  return canDemo(roleKey, "activity:read") || canDemo(roleKey, "activity:*");
}

export function canUseReporting(roleKey: string): boolean {
  return canDemo(roleKey, "reporting:*") || canDemo(roleKey, "reporting:read");
}

export function canManageIntegrations(roleKey: string): boolean {
  return canDemo(roleKey, "integrations:manage") || canDemo(roleKey, "org:*");
}

export function canCloseAudit(roleKey: string): boolean {
  return canManageAudits(roleKey);
}

export function canApproveChange(roleKey: string): boolean {
  return canManageChanges(roleKey);
}
