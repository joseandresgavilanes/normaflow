import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ManagementReviewModule from "@/components/modules/ManagementReviewModule";
import { ManagementReviewLive } from "@/components/operations/ManagementReviewLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getManagementReviewPayload } from "@/lib/server-queries";
import { PlanLimitError } from "@/lib/plan-entitlements";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";

export const metadata = { title: "Revisión por la dirección | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ManagementReviewPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <ManagementReviewLive initial={await getManagementReviewPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Revisión por la dirección" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[management-review] live payload failed:", error);
      return <LiveDataUnavailable section="Revisión por la dirección" />;
    }
  }

  return <ManagementReviewModule />;
}
