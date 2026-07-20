"use client";

import { useMemo } from "react";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import * as P from "@/lib/permissions/frontend";

/** Rol demo desde WorkspaceStore.session.roleKey (fallback COMPLIANCE_MANAGER) */
export function useDemoPermission() {
  const ws = useWorkspaceOptional();
  const roleKey = ws?.state.session.roleKey ?? "COMPLIANCE_MANAGER";
  const extraPermissions = ws?.state.session.extraPermissions ?? [];

  return useMemo(
    () => ({
      roleKey,
      can: (perm: string) => P.canFrontend(roleKey, perm, extraPermissions),
      documents: {
        create: P.canFrontend(roleKey, "documents:create", extraPermissions) || P.canFrontend(roleKey, "documents:*", extraPermissions),
        edit: P.canFrontend(roleKey, "documents:*", extraPermissions),
        approve: P.canApproveDocuments(roleKey) || P.canFrontend(roleKey, "documents:approve", extraPermissions),
      },
      risks: {
        manage:
          P.canFrontend(roleKey, "risks:*", extraPermissions) ||
          P.canFrontend(roleKey, "risks:create", extraPermissions),
      },
      audits: { manage: P.canFrontend(roleKey, "audits:*", extraPermissions) },
      nc: { manage: P.canFrontend(roleKey, "nc:*", extraPermissions) || P.canFrontend(roleKey, "nc:create", extraPermissions) },
      actions: { manage: P.canFrontend(roleKey, "actions:*", extraPermissions) || P.canFrontend(roleKey, "actions:update", extraPermissions) },
      gap: { manage: P.canFrontend(roleKey, "gap:*", extraPermissions) },
      billing: { manage: P.canAccessBilling(roleKey) || P.canFrontend(roleKey, "billing:*", extraPermissions) },
      training: { manage: P.canFrontend(roleKey, "training:*", extraPermissions) },
      changes: { manage: P.canFrontend(roleKey, "changes:*", extraPermissions) },
      suppliers: { manage: P.canFrontend(roleKey, "suppliers:*", extraPermissions) },
      reporting: { use: P.canFrontend(roleKey, "reporting:*", extraPermissions) || P.canFrontend(roleKey, "reporting:read", extraPermissions) },
      activity: { read: P.canFrontend(roleKey, "activity:read", extraPermissions) || P.canFrontend(roleKey, "activity:*", extraPermissions) },
      integrations: { manage: P.canFrontend(roleKey, "integrations:manage", extraPermissions) || P.canFrontend(roleKey, "org:*", extraPermissions) },
    }),
    [roleKey, extraPermissions]
  );
}
