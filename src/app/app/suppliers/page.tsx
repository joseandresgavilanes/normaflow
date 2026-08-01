import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import SuppliersModule from "@/components/modules/SuppliersModule";
import { SuppliersLiveClient } from "@/components/operations/GovernanceLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getSuppliersPayload } from "@/lib/server-queries";
import { PlanLimitError } from "@/lib/plan-entitlements";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";

export const metadata = { title: "Proveedores" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <SuppliersLiveClient initial={await getSuppliersPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Proveedores" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[suppliers] live payload failed:", error);
      return <LiveDataUnavailable section="Gestión de proveedores" />;
    }
  }
  return <SuppliersModule />;
}
