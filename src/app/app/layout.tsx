import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { isSupabaseConfigured } from "@/lib/env";
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

  // Hidratamos los datos admin (usuarios, grupos, cargos, personal,
  // catálogos, registros, ACPM) cuando estamos en modo live + Supabase.
  // En modo demo o si Prisma falla, pasamos null y el provider mock se hace cargo.
  let adminPayload: AdminPayload | null = null;
  if (ctx.mode === "live" && isSupabaseConfigured()) {
    try {
      adminPayload = await getAdminPayload(ctx.organization.id, ctx.user.id);
    } catch (err) {
      console.warn("[app-layout] getAdminPayload failed, falling back to mock:", err);
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
