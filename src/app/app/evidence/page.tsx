import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import EvidenceModule from "@/components/modules/EvidenceModule";
import { EvidenceRepositoryLiveClient } from "@/components/evidence/EvidenceRepositoryLiveClient";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getEvidencePayload } from "@/lib/server-queries";

export const metadata = { title: "Evidencias | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <EvidenceRepositoryLiveClient initial={await getEvidencePayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[evidence] live payload failed:", error);
      return <LiveDataUnavailable section="Evidencias" />;
    }
  }

  return <EvidenceModule />;
}
