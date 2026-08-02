import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import GroupsClient from "@/components/admin/GroupsClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Grupos y permisos" };

export default function GroupsPage() {
  return (
    <ServerPermissionGate permission="groups:read">
      <AdminDataProvider><GroupsClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
