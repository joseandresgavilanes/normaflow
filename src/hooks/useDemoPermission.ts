"use client";

import { useMemo } from "react";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import * as P from "@/lib/permissions/frontend";

/** Rol demo desde WorkspaceStore.session.roleKey (fallback COMPLIANCE_MANAGER) */
export function useDemoPermission() {
  const ws = useWorkspaceOptional();
  const roleKey = ws?.state.session.roleKey ?? "COMPLIANCE_MANAGER";

  return useMemo(
    () => ({
      roleKey,
      can: (perm: string) => P.canDemo(roleKey, perm),
      documents: {
        create: P.canCreateDocuments(roleKey),
        edit: P.canEditDocuments(roleKey),
        approve: P.canApproveDocuments(roleKey),
      },
      risks: { manage: P.canManageRisks(roleKey) },
      audits: { manage: P.canManageAudits(roleKey) },
      nc: { manage: P.canManageNc(roleKey) },
      actions: { manage: P.canManageActions(roleKey) },
      gap: { manage: P.canManageGap(roleKey) },
      billing: { manage: P.canAccessBilling(roleKey) },
      training: { manage: P.canManageTraining(roleKey) },
      changes: { manage: P.canManageChanges(roleKey) },
      suppliers: { manage: P.canManageSuppliers(roleKey) },
      reporting: { use: P.canUseReporting(roleKey) },
      activity: { read: P.canReadActivity(roleKey) },
      integrations: { manage: P.canManageIntegrations(roleKey) },
    }),
    [roleKey]
  );
}
