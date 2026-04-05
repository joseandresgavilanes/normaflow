"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppContext } from "@/lib/app-context";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import AIPanel from "@/components/modules/AIPanel";
import { ROLES } from "@/lib/constants";

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
  const roleKey = initial.mode === "live" ? initial.role : "COMPLIANCE_MANAGER";
  const roleLabel = ROLES[roleKey as keyof typeof ROLES] ?? roleKey;
  const memberships = initial.mode === "live" ? initial.memberships : [];

  const aiContext =
    pathname.includes("/gap") ? "gap"
    : pathname.includes("/risks") ? "risk"
    : pathname.includes("/documents") ? "document"
    : pathname.includes("/audits") ? "audit"
    : pathname.includes("/nonconformities") ? "nc"
    : "gap";

  return (
    <div style={{ display: "flex", background: "#F7F9FC", minHeight: "100vh", fontFamily: "Inter, -apple-system, sans-serif" }}>
      <AppSidebar
        onAI={() => setAiOpen(true)}
        orgName={orgName}
        userName={userName}
        roleLabel={roleLabel}
        memberships={memberships}
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
    </div>
  );
}
