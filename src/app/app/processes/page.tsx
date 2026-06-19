import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ProcessesModule from "@/components/modules/ProcessesModule";
import { ProcessesLiveClient } from "@/components/operations/ProcessRiskLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getProcessesPayload } from "@/lib/server-queries";

export const metadata = { title: "Procesos | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <ProcessesLiveClient initial={await getProcessesPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[processes] live payload failed:", error);
      return <LiveDataUnavailable section="Gestión de procesos" />;
    }
  }

  return <ProcessesModule />;
}
