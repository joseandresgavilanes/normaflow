import ReportingModule from "@/components/modules/ReportingModule";
import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getReportingPayload } from "@/lib/server-queries";

export const metadata = { title: "Informes | NormaFlow" };

export default async function ReportingPage() {
  const ctx = await getAppContext();
  if (ctx?.mode === "live") {
    try { return <ReportingModule liveData={await getReportingPayload()} />; }
    catch (error) {
      if (isAuthorizationError(error)) return <AccessDenied />;
      console.error("[reporting] live payload failed:", error);
      return <LiveDataUnavailable section="los informes" />;
    }
  }
  return <ReportingModule />;
}
