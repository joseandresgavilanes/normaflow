import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAppContext } from "@/lib/app-context";
import { getServerAuthorization } from "@/lib/permissions/server";
import AppRoot from "@/components/app/AppRoot";
import { getServerLocale } from "@/lib/i18n/server";
import { translateKnownText } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const title = translateKnownText(locale, "Área privada | NormaFlow");
  return { title: { default: title, template: "%s | NormaFlow" }, robots: { index: false, follow: false } };
}

function serializeContext(
  ctx: NonNullable<Awaited<ReturnType<typeof getAppContext>>>,
  groupPermissions: readonly string[] = [],
) {
  if (ctx.mode === "live") {
    return {
      mode: "live" as const,
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      organization: {
        id: ctx.organization.id,
        name: ctx.organization.name,
        plan: ctx.organization.plan,
        onboardingStatus: ctx.organization.onboardingStatus,
        trialEndsAt: ctx.organization.trialEndsAt?.toISOString() ?? null,
      },
      role: ctx.role,
      memberships: ctx.memberships,
      groupPermissions,
    };
  }
  if (ctx.mode === "needs_organization") {
    return {
      mode: "needs_organization" as const,
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
    };
  }
  return {
    mode: "demo" as const,
    workspaceKind: ctx.workspaceKind,
    user: ctx.user,
    organization: ctx.organization,
    role: ctx.role,
    memberships: ctx.memberships,
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  // The sidebar only needs the lightweight permission list. The large admin
  // payload is loaded lazily by the admin pages that actually consume it.
  const groupPermissions = ctx.mode === "live"
    ? (await getServerAuthorization()).groupPermissions
    : [];

  return (
    <AppRoot
      initial={serializeContext(ctx, groupPermissions)}
    >
      {children}
    </AppRoot>
  );
}
