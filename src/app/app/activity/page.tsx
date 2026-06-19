import { AdminGate } from "@/components/admin/AdminPageGate";
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
        <AdminGate permission="activity:read">
          <ActivityClient liveEntries={auditTrail} />
        </AdminGate>
      );
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[activity] getActivityPayload failed:", err);
      return <LiveDataUnavailable section="el historial de actividad" />;
    }
  }

  // Modo demo: el componente lee del AdminMockProvider.
  return (
    <AdminGate permission="activity:read">
      <ActivityClient />
    </AdminGate>
  );
}
