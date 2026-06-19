import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import NonconformitiesModule from "@/components/modules/NonconformitiesModule";
import { NonconformitiesLiveClient } from "@/components/operations/AuditNcLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getNonconformitiesPayload } from "@/lib/server-queries";

export const metadata = { title: "No Conformidades" };
export const dynamic = "force-dynamic";

export default async function NonconformitiesPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <NonconformitiesLiveClient initial={await getNonconformitiesPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[nonconformities] live payload failed:", error);
      return <LiveDataUnavailable section="No conformidades" />;
    }
  }

  return <NonconformitiesModule />;
}
