import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import AppRoot from "@/components/app/AppRoot";

function serializeContext(ctx: NonNullable<Awaited<ReturnType<typeof getAppContext>>>) {
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
  return { mode: "demo" as const, email: ctx.email };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  return <AppRoot initial={serializeContext(ctx)}>{children}</AppRoot>;
}
