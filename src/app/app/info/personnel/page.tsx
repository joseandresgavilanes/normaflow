import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import PersonnelClient from "@/components/admin/PersonnelClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Personal" };

export default function PersonnelPage() {
  return (
    <ServerPermissionGate permission="personnel:read">
      <AdminDataProvider><PersonnelClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
