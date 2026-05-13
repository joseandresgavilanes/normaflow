import { AdminGate } from "@/components/admin/AdminPageGate";
import ActivityClient from "@/components/admin/ActivityClient";

export const metadata = { title: "Actividad y audit trail | NormaFlow" };

export default function ActivityPage() {
  return (
    <AdminGate permission="activity:read">
      <ActivityClient />
    </AdminGate>
  );
}
