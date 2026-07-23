import { getAppContext } from "@/lib/app-context";
import { getTrainingPayload } from "@/lib/server-queries";
import TrainingModule from "@/components/modules/TrainingModule";
import TrainingLiveClient from "@/components/training/TrainingLiveClient";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import AccessDenied from "@/components/app/AccessDenied";
import { isAuthorizationError } from "@/lib/permissions/server";
import { PlanLimitError } from "@/lib/plan-entitlements";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";

export const metadata = { title: "Capacitación | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const ctx = await getAppContext();

  if (ctx?.mode === "live") {
    try {
      const payload = await getTrainingPayload();
      return <TrainingLiveClient initial={payload} canManage={payload.access.canManage} />;
    } catch (err) {
      if (err instanceof PlanLimitError) return <PlanUpgradeGate module="Capacitación" />;
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[training] live payload failed:", err);
      return <LiveDataUnavailable section="Gestión de capacitación" />;
    }
  }

  return <TrainingModule />;
}
