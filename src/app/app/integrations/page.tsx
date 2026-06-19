import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import IntegrationsModule from "@/components/modules/IntegrationsModule";
import { IntegrationsLiveClient } from "@/components/operations/GovernanceLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getIntegrationsPayload } from "@/lib/server-queries";

export const metadata = { title: "Integraciones | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    try {
      return <IntegrationsLiveClient initial={await getIntegrationsPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[integrations] live payload failed:", error);
      return <LiveDataUnavailable section="Integraciones" />;
    }
  }
  return <IntegrationsModule />;
}
