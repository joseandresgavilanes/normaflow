import DashboardModule from "@/components/modules/DashboardModule";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { getAppContext } from "@/lib/app-context";
import { getDashboardPayload } from "@/lib/server-queries";
import AccessDenied from "@/components/app/AccessDenied";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Dashboard | NormaFlow" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  let live = null as Awaited<ReturnType<typeof getDashboardPayload>> | null;
  let orgName = "Tecnoserv Industrial S.A.";

  if (ctx?.mode === "demo") {
    orgName = ctx.organization.name;
  }

  if (ctx?.mode === "live") {
    orgName = ctx.organization.name;
    try {
      live = await getDashboardPayload();
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[dashboard] live payload failed:", err);
      return <LiveDataUnavailable section="el Dashboard" />;
    }
  }

  return <DashboardModule orgName={orgName} live={live} />;
}
