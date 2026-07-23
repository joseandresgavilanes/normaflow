import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ActivityClient from "@/components/admin/ActivityClient";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { getAppContext } from "@/lib/app-context";
import { getActivityPayload } from "@/lib/server-queries";
import AccessDenied from "@/components/app/AccessDenied";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Actividad y audit trail | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const ctx = await getAppContext();

  if (ctx?.mode === "live") {
    try {
      const { auditTrail } = await getActivityPayload();
      return (
        <ServerPermissionGate permission="activity:read">
          <ActivityClient liveEntries={auditTrail} />
        </ServerPermissionGate>
      );
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[activity] getActivityPayload failed:", err);
      return <LiveDataUnavailable section="el historial de actividad" />;
    }
  }

  // Modo demo: el componente lee del AdminMockProvider.
  return (
    <ServerPermissionGate permission="activity:read">
      <ActivityClient />
    </ServerPermissionGate>
  );
}
