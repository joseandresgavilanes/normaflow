"use client";
import { useUser } from "./useUser";
import { canFrontend } from "@/lib/permissions/frontend";

export function usePermissions() {
  const { user } = useUser();

  function can(action: string): boolean {
    return canFrontend(user.role, action);
  }

  function canAny(...actions: string[]): boolean {
    return actions.some(a => can(a));
  }

  return { can, canAny, role: user.role };
}
