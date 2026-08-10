import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import AuditProgramModule from "@/components/modules/AuditProgramModule";
import { AuditProgramLive } from "@/components/operations/AuditProgramLive";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getAuditProgramPayload } from "@/lib/server-queries";

export const metadata = { title: "Programa de auditorías" };
export const dynamic = "force-dynamic";

export default async function AuditProgramPage() {
  const context = await getAppContext();

  if (context?.mode === "live") {
    try {
      return <AuditProgramLive initial={await getAuditProgramPayload()} />;
    } catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[audit-program] live payload failed:", error);
      return <LiveDataUnavailable section="Programa de auditorías" />;
    }
  }

  return <AuditProgramModule />;
}
