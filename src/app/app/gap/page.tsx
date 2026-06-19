import GapModule from "@/components/modules/GapModule";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { getAppContext } from "@/lib/app-context";
import { getGapPayload } from "@/lib/server-queries";
import AccessDenied from "@/components/app/AccessDenied";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "GAP Assessment | NormaFlow" };

export default async function GapPage() {
  const ctx = await getAppContext();
  let live = null;
  if (ctx?.mode === "live") {
    try {
      live = await getGapPayload();
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[gap] live payload failed:", err);
      return <LiveDataUnavailable section="el GAP Assessment" />;
    }
  }
  return <GapModule live={live} />;
}
