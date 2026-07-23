import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import OpportunitiesModule from "@/components/modules/OpportunitiesModule";
import { OpportunitiesLive } from "@/components/operations/OpportunitiesLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getOpportunitiesPayload } from "@/lib/server-queries";
import { PlanLimitError } from "@/lib/plan-entitlements";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";

export const metadata = { title: "Oportunidades" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <OpportunitiesLive initial={await getOpportunitiesPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Oportunidades" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[opportunities] live payload failed:", error);
      return <LiveDataUnavailable section="Oportunidades" />;
    }
  }
  return <OpportunitiesModule />;
}
