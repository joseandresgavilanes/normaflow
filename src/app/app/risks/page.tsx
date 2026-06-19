import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import RisksModule from "@/components/modules/RisksModule";
import { RisksLiveClient } from "@/components/operations/ProcessRiskLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getRisksPayload } from "@/lib/server-queries";

export const metadata = { title: "Gestión de Riesgos" };
export const dynamic = "force-dynamic";

export default async function RisksPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <RisksLiveClient initial={await getRisksPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[risks] live payload failed:", error);
      return <LiveDataUnavailable section="Gestión de riesgos" />;
    }
  }

  return <RisksModule />;
}
