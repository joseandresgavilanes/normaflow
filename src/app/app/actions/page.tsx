import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ACPMClient from "@/components/admin/ACPMClient";
import { getAppContext } from "@/lib/app-context";
import { getCAPAPayload } from "@/lib/server-queries";
import { ACPMLiveClient } from "@/components/acpm/ACPMLiveClient";

export const metadata = { title: "ACPM — Plan de Acción" };

export default async function ActionsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    const payload = await getCAPAPayload();
    return <ServerPermissionGate permission="actions:read"><ACPMLiveClient initial={payload} /></ServerPermissionGate>;
  }
  return <ServerPermissionGate permission="actions:read"><ACPMClient /></ServerPermissionGate>;
}
