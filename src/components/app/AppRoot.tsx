"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import AIPanel from "@/components/modules/AIPanel";
import WorkspaceToast from "@/components/workspace/WorkspaceToast";
import { WorkspaceProvider } from "@/context/WorkspaceStore";
import { ROLES } from "@/lib/constants";
import type { AppRoleKey } from "@/lib/permissions/frontend";

function normalizeRoleKey(role: string | undefined): AppRoleKey {
  if (!role) return "COMPLIANCE_MANAGER";
  const k = role.toUpperCase().replace(/\s+/g, "_") as AppRoleKey;
  return k in ROLES ? k : "COMPLIANCE_MANAGER";
}

type SerializedCtx =
  | {
      mode: "live";
      user: { id: string; name: string; email: string };
      organization: { id: string; name: string; plan: string };
      role: string;
      memberships: { organizationId: string; organizationName: string; role: string }[];
    }
  | { mode: "demo"; email: string }
  | { mode: "needs_organization"; user: { id: string; name: string; email: string } };

export default function AppRoot({
  initial,
  children,
}: {
  initial: SerializedCtx;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (initial.mode === "needs_organization" && pathname !== "/app/onboarding") {
      router.replace("/app/onboarding");
    }
    if (initial.mode !== "needs_organization" && pathname === "/app/onboarding") {
      router.replace("/app/dashboard");
    }
  }, [initial.mode, pathname, router]);

  if (initial.mode === "needs_organization") {
    if (pathname !== "/app/onboarding") {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F9FC" }}>
          <p style={{ color: "#5E6B7A" }}>Preparando tu espacio…</p>
        </div>
      );
    }
    return <>{children}</>;
  }

  const orgName = initial.mode === "live" ? initial.organization.name : "Tecnoserv Industrial S.A.";
  const userName = initial.mode === "live" ? initial.user.name : "Ana García";
  const roleKey = normalizeRoleKey(initial.mode === "live" ? initial.role : "COMPLIANCE_MANAGER");
  const roleLabel = ROLES[roleKey];
  const memberships = initial.mode === "live" ? initial.memberships : [];
  const activeOrgId =
    initial.mode === "live" ? initial.organization.id : "org_tecnoserv";

  const aiContext =
    pathname.includes("/gap") ? "gap"
    : pathname.includes("/risks") ? "risk"
    : pathname.includes("/documents") ? "document"
    : pathname.includes("/audits") ? "audit"
    : pathname.includes("/nonconformities") ? "nc"
    : "gap";

  const profile = useMemo(
    () => ({
      name: userName,
      email: initial.mode === "live" ? initial.user.email : "demo@normaflow.io",
      orgName,
      roleLabel,
      roleKey,
      activeOrgId,
    }),
    [userName, initial.mode, initial, orgName, roleLabel, roleKey, activeOrgId]
  );

  return (
    <WorkspaceProvider key={profile.email + activeOrgId} profile={profile}>
      <div style={{ display: "flex", background: "#F7F9FC", minHeight: "100vh", fontFamily: "Inter, -apple-system, sans-serif" }}>
        <AppSidebar
          onAI={() => setAiOpen(true)}
          orgName={orgName}
          userName={userName}
          roleLabel={roleLabel}
          memberships={memberships}
          demoSession={initial.mode === "demo"}
          currentOrgId={initial.mode === "live" ? initial.organization.id : undefined}
          onOrgChange={async orgId => {
            await fetch("/api/auth/set-org", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: orgId }),
            });
            router.refresh();
          }}
        />
        <div style={{ flex: 1, marginLeft: 224, minWidth: 0 }}>
          <AppTopbar userName={userName} roleLabel={roleLabel} />
          <main style={{ padding: "28px 32px", maxWidth: 1280 }}>{children}</main>
        </div>
        <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} />
        <WorkspaceToast />
      </div>
    </WorkspaceProvider>
  );
}
