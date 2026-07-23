import SetupGuideModule from "@/components/modules/SetupGuideModule";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import AccessDenied from "@/components/app/AccessDenied";
import { getAppContext } from "@/lib/app-context";
import { getSetupPayload } from "@/lib/server-queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Implementación | NormaFlow" };

export default async function SetupPage() {
  const ctx = await getAppContext();
  let live = null;
  if (ctx?.mode === "live") {
    if (ctx.role === "CONTRIBUTOR") return <AccessDenied />;
    try {
      live = await getSetupPayload();
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[setup] live payload failed:", err);
      return <LiveDataUnavailable section="la implementación guiada" />;
    }
  }
  return <SetupGuideModule live={live} />;
}
