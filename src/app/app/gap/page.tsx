import GapModule from "@/components/modules/GapModule";
import { getAppContext } from "@/lib/app-context";
import { getGapPayload } from "@/lib/server-queries";

export const metadata = { title: "GAP Assessment | NormaFlow" };

export default async function GapPage() {
  const ctx = await getAppContext();
  let live = null;
  if (ctx?.mode === "live") {
    try {
      live = await getGapPayload(ctx.organization.id);
    } catch {
      live = null;
    }
  }
  return <GapModule live={live} />;
}
