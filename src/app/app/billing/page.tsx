import BillingModule from "@/components/modules/BillingModule";
import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { getAppContext } from "@/lib/app-context";
import { isAuthorizationError } from "@/lib/permissions/server";
import { getBillingPayload } from "@/lib/server-queries";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
export const metadata = { title: "Billing" };
export default async function BillingPage() {
  const ctx = await getAppContext();
  if (ctx?.mode === "live") {
    return <ServerPermissionGate permission="billing:read">{await renderLiveBilling()}</ServerPermissionGate>;
  }
  return <BillingModule />;
}

async function renderLiveBilling() {
  try { return <BillingModule liveData={await getBillingPayload()} />; }
  catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[billing] live payload failed:", error);
    return <LiveDataUnavailable section="billing" />;
  }
}
