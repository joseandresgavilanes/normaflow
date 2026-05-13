import { AdminGate } from "@/components/admin/AdminPageGate";
import ACPMClient from "@/components/admin/ACPMClient";

export const metadata = { title: "ACPM — Plan de Acción" };

export default function ActionsPage() {
  return (
    <AdminGate permission="actions:read">
      <ACPMClient />
    </AdminGate>
  );
}
