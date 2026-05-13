import { AdminGate } from "@/components/admin/AdminPageGate";
import GroupsClient from "@/components/admin/GroupsClient";

export const metadata = { title: "Grupos y permisos — NormaFlow" };

export default function GroupsPage() {
  return (
    <AdminGate permission="groups:read">
      <GroupsClient />
    </AdminGate>
  );
}
