import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { getAdminPayload, type AdminPayload } from "@/lib/server-queries";
import AppRoot from "@/components/app/AppRoot";

function serializeContext(
  ctx: NonNullable<Awaited<ReturnType<typeof getAppContext>>>,
) {
  if (ctx.mode === "live") {
    return {
      mode: "live" as const,
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      organization: {
        id: ctx.organization.id,
        name: ctx.organization.name,
        plan: ctx.organization.plan,
      },
      role: ctx.role,
      memberships: ctx.memberships,
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

  // En modo live el payload administrativo es obligatorio. Si Prisma falla,
  // AppRoot muestra un error explícito y nunca activa el provider mock.
  let adminPayload: AdminPayload | null = null;
  if (ctx.mode === "live") {
    try {
      adminPayload = await getAdminPayload();
    } catch (err) {
      console.error("[app-layout] getAdminPayload failed:", err);
    }
  }

  return (
    <AppRoot
      initial={serializeContext(ctx)}
      adminPayload={adminPayload}
    >
      {children}
    </AppRoot>
  );
}
