import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import PlanUpgradeGate from "@/components/app/PlanUpgradeGate";
import { ContextLive } from "@/components/operations/ContextLive";
import ContextModule from "@/components/modules/ContextModule";
import { getAppContext } from "@/lib/app-context";
import { getOrganizationalContextPayload } from "@/lib/context/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import { PlanLimitError } from "@/lib/plan-entitlements";

export const metadata = { title: "Contexto de la organización" };
export const dynamic = "force-dynamic";

export default async function ContextPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <ContextLive initial={await getOrganizationalContextPayload()} />;
    } catch (error) {
      if (error instanceof PlanLimitError) return <PlanUpgradeGate module="Contexto de la organización" />;
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[context] live payload failed:", error);
      return <LiveDataUnavailable section="Contexto de la organización" />;
    }
  }
  return <ContextModule />;
}
