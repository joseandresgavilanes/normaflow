import DashboardModule from "@/components/modules/DashboardModule";
import { getAppContext } from "@/lib/app-context";
import { getDashboardPayload } from "@/lib/server-queries";

export const metadata = { title: "Dashboard | NormaFlow" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  let live = null as Awaited<ReturnType<typeof getDashboardPayload>> | null;
  let orgName = "Tecnoserv Industrial S.A.";

  if (ctx?.mode === "live") {
    orgName = ctx.organization.name;
    try {
      live = await getDashboardPayload(ctx.organization.id);
    } catch {
      live = null;
    }
  }

  return <DashboardModule orgName={orgName} live={live} />;
}
