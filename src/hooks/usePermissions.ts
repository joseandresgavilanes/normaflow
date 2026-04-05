"use client";
import { PERMISSIONS } from "@/lib/constants";
import { useUser } from "./useUser";

export function usePermissions() {
  const { user } = useUser();

  function can(action: string): boolean {
    const perms = PERMISSIONS[user.role] as readonly string[];
    return perms.includes("*") || perms.includes(action);
  }

  function canAny(...actions: string[]): boolean {
    return actions.some(a => can(a));
  }

  return { can, canAny, role: user.role };
}
