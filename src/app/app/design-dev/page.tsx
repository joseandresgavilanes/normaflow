import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";
import { DesignDevelopmentLive } from "@/components/operations/DesignDevelopmentLive";
import DesignDevelopmentModule from "@/components/modules/DesignDevelopmentModule";
import { getAppContext } from "@/lib/app-context";
import { getDesignDevelopmentPayload } from "@/lib/design-development/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import { PlanLimitError } from "@/lib/plan-entitlements";

export const metadata = { title: "Diseño y desarrollo" };
export const dynamic = "force-dynamic";

export default async function DesignDevelopmentPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <DesignDevelopmentLive initial={await getDesignDevelopmentPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Diseño y desarrollo" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[design-dev] live payload failed:", error);
      return <LiveDataUnavailable section="Diseño y desarrollo" />;
    }
  }
  return <DesignDevelopmentModule />;
}
