"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMatchMedia } from "@/hooks/useMatchMedia";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import AIPanel from "@/components/modules/AIPanel";
import WorkspaceToast from "@/components/workspace/WorkspaceToast";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { WorkspaceProvider } from "@/context/WorkspaceStore";
import { AdminMockProvider } from "@/context/AdminMockStore";
import { AdminLiveProvider } from "@/context/AdminLiveProvider";
import { useI18n } from "@/context/I18nProvider";
import type { AdminPayload } from "@/lib/server-queries";
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
      memberships: {
        organizationId: string;
        organizationName: string;
        role: string;
      }[];
    }
  | {
      mode: "demo";
      workspaceKind: "demo" | "blank";
      user: { id: string; name: string; email: string };
      organization: { id: string; name: string; plan: string };
      role: string;
      memberships: {
        organizationId: string;
        organizationName: string;
        role: string;
      }[];
    }
  | {
      mode: "needs_organization";
      user: { id: string; name: string; email: string };
    };

export default function AppRoot({
  initial,
  adminPayload,
  children,
}: {
  initial: SerializedCtx;
  adminPayload?: AdminPayload | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isCompactNav = useMatchMedia("(max-width: 768px)");
  const { t } = useI18n();

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isCompactNav) setNavOpen(false);
  }, [isCompactNav]);

  useEffect(() => {
    if (isCompactNav && navOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [isCompactNav, navOpen]);

  useEffect(() => {
    if (
      initial.mode === "needs_organization" &&
      pathname !== "/app/onboarding"
    ) {
      router.replace("/app/onboarding");
    }
    if (
      initial.mode !== "needs_organization" &&
      pathname === "/app/onboarding"
    ) {
      router.replace("/app/dashboard");
    }
  }, [initial.mode, pathname, router]);

  if (initial.mode === "needs_organization") {
    if (pathname !== "/app/onboarding") {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg)",
          }}
        >
          <p style={{ color: "var(--nf-ink-3)", fontSize: 14 }}>{t("app.preparingWorkspace")}</p>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (initial.mode === "live" && !adminPayload) {
    return <LiveDataUnavailable section={t("app.liveDataUnavailable")} />;
  }

  const orgName = initial.organization.name;
  const userName = initial.user.name;
  const roleKey = normalizeRoleKey(initial.role);
  const roleLabel = t(`role.${roleKey}`);
  const memberships = initial.memberships;
  const activeOrgId = initial.organization.id;
  const workspaceKind = initial.mode === "demo" ? initial.workspaceKind : "blank";

  const aiContext = pathname.includes("/gap")
    ? "gap"
    : pathname.includes("/risks")
      ? "risk"
      : pathname.includes("/documents")
        ? "document"
        : pathname.includes("/audits")
          ? "audit"
          : pathname.includes("/nonconformities")
            ? "nc"
            : "gap";

  const profile = {
    name: userName,
    email: initial.user.email,
    orgName,
    roleLabel,
    roleKey,
    extraPermissions: initial.mode === "live" ? adminPayload?.groupPermissions ?? [] : [],
    activeOrgId,
    workspaceKind,
    plan: initial.organization.plan,
  };

  // El provider mock queda reservado exclusivamente para sesiones demo.
  const adminShell = (children: React.ReactNode) =>
    initial.mode === "live" && adminPayload ? (
      <AdminLiveProvider initialData={adminPayload} currentUserId={initial.user.id}>
        {children}
      </AdminLiveProvider>
    ) : (
      <AdminMockProvider seedMode={workspaceKind} profile={profile}>
        {children}
      </AdminMockProvider>
    );

  return (
    <WorkspaceProvider key={`${profile.email}:${activeOrgId}:${workspaceKind}`} profile={profile}>
      {adminShell(
        <div className="nf-app-shell">
          {isCompactNav && navOpen && (
            <button
              type="button"
              className="nf-sidebar-backdrop"
              aria-label="Cerrar menú de navegación"
              onClick={() => setNavOpen(false)}
            />
          )}
          <AppSidebar
            onAI={() => {
              setNavOpen(false);
              setAiOpen(true);
            }}
            orgName={orgName}
            userName={userName}
            roleLabel={roleLabel}
            memberships={memberships}
            demoSession={initial.mode === "demo" && workspaceKind === "demo"}
            currentOrgId={
              initial.mode === "live" ? initial.organization.id : undefined
            }
            onOrgChange={async (orgId) => {
              await fetch("/api/auth/set-org", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organizationId: orgId }),
              });
              router.refresh();
            }}
            compact={isCompactNav}
            drawerOpen={navOpen}
            onNavigate={() => setNavOpen(false)}
          />
          <div className="nf-app-main">
            <AppTopbar
              userName={userName}
              roleLabel={roleLabel}
              onMenuClick={isCompactNav ? () => setNavOpen(true) : undefined}
            />
            <main className="nf-app-main-inner">{children}</main>
          </div>
          <AIPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            context={aiContext}
          />
          <WorkspaceToast />
          <div id="nf-modal-root" />
        </div>
      )}
    </WorkspaceProvider>
  );
}
