import { PERMISSIONS, ROLES } from "@/lib/constants";

export type AppRoleKey = keyof typeof ROLES;

/** Comprueba permiso demo en frontend (sin enforcement servidor) */
export function canDemo(roleKey: string, permission: string): boolean {
  const perms = PERMISSIONS[roleKey as AppRoleKey] as readonly string[] | undefined;
  if (!perms) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const [res, action] = permission.split(":");
  return perms.some(p => p === `${res}:*` || p === permission);
}

export function canCreateDocuments(roleKey: string): boolean {
  return canDemo(roleKey, "documents:create") || canDemo(roleKey, "documents:*");
}

export function canEditDocuments(roleKey: string): boolean {
  return canDemo(roleKey, "documents:*");
}

export function canApproveDocuments(roleKey: string): boolean {
  return roleKey === "ORG_ADMIN" || roleKey === "COMPLIANCE_MANAGER" || roleKey === "SUPER_ADMIN";
}

export function canManageRisks(roleKey: string): boolean {
  return canDemo(roleKey, "risks:*");
}

export function canManageAudits(roleKey: string): boolean {
  return canDemo(roleKey, "audits:*");
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
  return roleKey === "ORG_ADMIN" || roleKey === "SUPER_ADMIN";
}
