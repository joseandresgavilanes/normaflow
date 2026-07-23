import { redirect } from "next/navigation";
import { getServerAuthorization } from "@/lib/permissions/server";
import { getAppContext } from "@/lib/app-context";
import { roleOrGroupCan } from "@/lib/permissions/matrix";

/** Server-side route guard. Client AdminGate remains presentation only. */
export default async function ServerPermissionGate({ permission, children }: { permission: string; children: React.ReactNode }) {
  const appContext = await getAppContext();
  if (!appContext) redirect("/login");
  const allowed = appContext.mode === "demo"
    ? roleOrGroupCan(appContext.role, [], permission)
    : appContext.mode === "live" && (await getServerAuthorization()).can(permission);
  if (!allowed) redirect("/app/dashboard?error=forbidden");
  return <>{children}</>;
}
