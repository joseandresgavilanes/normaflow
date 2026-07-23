import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import GroupsClient from "@/components/admin/GroupsClient";

export const metadata = { title: "Grupos y permisos — NormaFlow" };

export default function GroupsPage() {
  return (
    <ServerPermissionGate permission="groups:read">
      <GroupsClient />
    </ServerPermissionGate>
  );
}
