import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import IndicatorsModule from "@/components/modules/IndicatorsModule";
import { IndicatorsLiveClient } from "@/components/operations/IndicatorEvidenceLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getIndicatorsPayload } from "@/lib/server-queries";

export const metadata = { title: "Indicadores y KPIs" };
export const dynamic = "force-dynamic";

export default async function IndicatorsPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <IndicatorsLiveClient initial={await getIndicatorsPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[indicators] live payload failed:", error);
      return <LiveDataUnavailable section="Indicadores y KPIs" />;
    }
  }

  return <IndicatorsModule />;
}
