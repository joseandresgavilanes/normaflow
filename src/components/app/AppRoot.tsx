"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMatchMedia } from "@/hooks/useMatchMedia";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import WorkspaceToast from "@/components/workspace/WorkspaceToast";
import { WorkspaceProvider } from "@/context/WorkspaceStore";
import { AdminMockProvider } from "@/context/AdminMockStore";
import { useI18n } from "@/context/I18nProvider";
import { ROLES } from "@/lib/constants";
import type { AppRoleKey } from "@/lib/permissions/frontend";

// El panel de IA no participa en la primera pintura ni en la navegación normal.
// Mantenerlo en un chunk separado evita cargar su código hasta que el usuario lo abre.
const AIPanel = dynamic(() => import("@/components/modules/AIPanel"), { ssr: false });
const EMPTY_PERMISSIONS: readonly string[] = [];

function normalizeRoleKey(role: string | undefined): AppRoleKey {
  if (!role) return "COMPLIANCE_MANAGER";
  const k = role.toUpperCase().replace(/\s+/g, "_") as AppRoleKey;
  return k in ROLES ? k : "COMPLIANCE_MANAGER";
}

type SerializedCtx =
  | {
      mode: "live";
      user: { id: string; name: string; email: string };
      organization: { id: string; name: string; plan: string; onboardingStatus: string; trialEndsAt: string | null };
      role: string;
      memberships: {
        organizationId: string;
        organizationName: string;
        role: string;
      }[];
      groupPermissions: readonly string[];
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
  children,
}: {
  initial: SerializedCtx;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isCompactNav = useMatchMedia("(max-width: 768px)");
  const { t } = useI18n();
  const onboardingStatus = initial.mode === "live" ? initial.organization.onboardingStatus : undefined;

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

  // Escape cierra el cajón: toda capa superpuesta debe tener salida por teclado.
  useEffect(() => {
    if (!navOpen) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  useEffect(() => {
    if (
      initial.mode === "needs_organization" &&
      pathname !== "/app/onboarding"
    ) {
      router.replace("/app/onboarding");
    }
    if (
      initial.mode === "live" &&
      pathname === "/app/onboarding"
    ) {
      if (onboardingStatus && ["IN_PROGRESS", "NOT_STARTED"].includes(onboardingStatus)) return;
      router.replace("/app/dashboard");
    }
    if (
      initial.mode === "live" &&
      onboardingStatus !== undefined && ["IN_PROGRESS", "NOT_STARTED"].includes(onboardingStatus) &&
      pathname !== "/app/onboarding"
    ) {
      router.replace("/app/onboarding");
    }
  }, [initial.mode, onboardingStatus, pathname, router]);

  // Derivar estos valores antes del early return permite que el hook de
  // memoización mantenga siempre el mismo orden de ejecución.
  const orgName = initial.mode === "needs_organization" ? "" : initial.organization.name;
  const userName = initial.user.name;
  const roleKey = normalizeRoleKey(initial.mode === "needs_organization" ? undefined : initial.role);
  const roleLabel = t(`role.${roleKey}`);
  const memberships = initial.mode === "needs_organization" ? [] : initial.memberships;
  const activeOrgId = initial.mode === "needs_organization" ? "" : initial.organization.id;
  const workspaceKind = initial.mode === "demo" ? initial.workspaceKind : "blank";
  const plan = initial.mode === "needs_organization" ? "STARTER" : initial.organization.plan;
  const groupPermissions = initial.mode === "live" ? initial.groupPermissions : EMPTY_PERMISSIONS;

  // AppRoot se vuelve a renderizar cuando cambia pathname. Estabilizar este
  // objeto evita que WorkspaceProvider reconstruya y rehidrate todo el estado
  // demo/local en cada navegación.
  const profile = useMemo(() => ({
    name: userName,
    email: initial.user.email,
    orgName,
    roleLabel,
    roleKey,
    extraPermissions: groupPermissions,
    activeOrgId,
    workspaceKind,
    plan,
  }), [
    activeOrgId,
    groupPermissions,
    initial.user.email,
    orgName,
    plan,
    roleKey,
    roleLabel,
    userName,
    workspaceKind,
  ]);

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

  // El provider mock queda reservado exclusivamente para sesiones demo.
  const appContent = (
    <div className="nf-app-shell">
      <a className="nf-skip-link" href="#nf-main">
        {t("nav.skipToContent")}
      </a>
      {isCompactNav && navOpen && (
        <button
          type="button"
          className="nf-nav-backdrop"
          aria-label={t("marketing.closeMenu")}
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
        roleKey={roleKey}
        plan={plan}
        trialActive={initial.mode === "live" && Boolean(initial.organization.trialEndsAt && new Date(initial.organization.trialEndsAt) > new Date())}
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
        drawerOpen={navOpen}
        onNavigate={() => setNavOpen(false)}
        onClose={() => setNavOpen(false)}
      />
      <div className="nf-app-main">
        {/* El botón de menú se muestra/oculta por CSS. Antes dependía de
            `isCompactNav`, que en SSR es false: el servidor pintaba el layout
            de escritorio y la app saltaba al móvil al hidratar. */}
        <AppTopbar
          userName={userName}
          roleLabel={roleLabel}
          onMenuClick={() => setNavOpen(true)}
        />
        <main id="nf-main" className="nf-app-main-inner" tabIndex={-1}>
          {children}
        </main>
      </div>
      {aiOpen && (
        <AIPanel
          open
          onClose={() => setAiOpen(false)}
          context={aiContext}
        />
      )}
      <WorkspaceToast />
      <div id="nf-modal-root" />
    </div>
  );

  return (
    <WorkspaceProvider key={`${profile.email}:${activeOrgId}:${workspaceKind}`} profile={profile}>
      {initial.mode === "demo" ? (
        <AdminMockProvider seedMode={workspaceKind} profile={profile}>
          {appContent}
        </AdminMockProvider>
      ) : appContent}
    </WorkspaceProvider>
  );
}
