import { AdminGate } from "@/components/admin/AdminPageGate";
import PersonnelClient from "@/components/admin/PersonnelClient";

export const metadata = { title: "Personal — NormaFlow" };

export default function PersonnelPage() {
  return (
    <AdminGate permission="personnel:read">
      <PersonnelClient />
    </AdminGate>
  );
}
