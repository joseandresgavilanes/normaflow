import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import AuditsModule from "@/components/modules/AuditsModule";
import { AuditsLiveClient } from "@/components/operations/AuditNcLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getAuditsPayload } from "@/lib/server-queries";

export const metadata = { title: "Auditorías" };
export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <AuditsLiveClient initial={await getAuditsPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[audits] live payload failed:", error);
      return <LiveDataUnavailable section="Auditorías" />;
    }
  }

  return <AuditsModule />;
}
