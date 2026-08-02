import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";
import { QualityOperationsLive } from "@/components/operations/QualityOperationsLive";
import QualityOperationsModule from "@/components/modules/QualityOperationsModule";
import { getAppContext } from "@/lib/app-context";
import { getQualityOperationsPayload } from "@/lib/quality-operations/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import { PlanLimitError } from "@/lib/plan-entitlements";

export const metadata = { title: "Requisitos operativos" };
export const dynamic = "force-dynamic";

export default async function QualityOperationsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <QualityOperationsLive initial={await getQualityOperationsPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Requisitos operativos" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[quality-ops] live payload failed:", error);
      return <LiveDataUnavailable section="Requisitos operativos" />;
    }
  }
  return <QualityOperationsModule />;
}
