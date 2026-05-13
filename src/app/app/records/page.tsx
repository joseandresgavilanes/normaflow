import { AdminGate } from "@/components/admin/AdminPageGate";
import RecordsClient from "@/components/admin/RecordsClient";

export const metadata = { title: "Control de Registros — NormaFlow" };

export default function RecordsPage() {
  return (
    <AdminGate permission="records:read">
      <RecordsClient />
    </AdminGate>
  );
}
