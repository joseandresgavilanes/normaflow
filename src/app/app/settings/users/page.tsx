import { AdminGate } from "@/components/admin/AdminPageGate";
import MembersClient from "@/components/admin/MembersClient";

export const metadata = { title: "Usuarios y roles — NormaFlow" };

export default function MembersPage() {
  return (
    <AdminGate permission="members:*">
      <MembersClient />
    </AdminGate>
  );
}
