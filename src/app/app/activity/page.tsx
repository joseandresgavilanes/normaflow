import { AdminGate } from "@/components/admin/AdminPageGate";
import ActivityClient from "@/components/admin/ActivityClient";
import { getAppContext } from "@/lib/app-context";
import { isSupabaseConfigured } from "@/lib/env";
import { getActivityPayload } from "@/lib/server-queries";

export const metadata = { title: "Actividad y audit trail | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const ctx = await getAppContext();

  // Modo live: lee la tabla audit_logs y la pasa al cliente.
  if (ctx?.mode === "live" && isSupabaseConfigured()) {
    try {
      const { auditTrail } = await getActivityPayload(ctx.organization.id);
      return (
        <AdminGate permission="activity:read">
          <ActivityClient liveEntries={auditTrail} />
        </AdminGate>
      );
    } catch (err) {
      console.warn("[activity] getActivityPayload failed, falling back to mock:", err);
    }
  }

  // Modo demo / fallback: el componente lee del AdminMockProvider.
  return (
    <AdminGate permission="activity:read">
      <ActivityClient />
    </AdminGate>
  );
}
