import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import MembersClient from "@/components/admin/MembersClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Usuarios y roles" };

export default function MembersPage() {
  return (
    <ServerPermissionGate permission="members:*">
      <AdminDataProvider><MembersClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
