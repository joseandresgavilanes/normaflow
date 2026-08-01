import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ChangeControlModule from "@/components/modules/ChangeControlModule";
import { ChangesLiveClient } from "@/components/operations/GovernanceLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getChangesPayload } from "@/lib/server-queries";
import { PlanLimitError } from "@/lib/plan-entitlements";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";

export const metadata = { title: "Control de cambios" };
export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <ChangesLiveClient initial={await getChangesPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Control de cambios" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[changes] live payload failed:", error);
      return <LiveDataUnavailable section="Gestión de cambios" />;
    }
  }
  return <ChangeControlModule />;
}
