import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import MembersClient from "@/components/admin/MembersClient";

export const metadata = { title: "Usuarios y roles — NormaFlow" };

export default function MembersPage() {
  return (
    <ServerPermissionGate permission="members:*">
      <MembersClient />
    </ServerPermissionGate>
  );
}
