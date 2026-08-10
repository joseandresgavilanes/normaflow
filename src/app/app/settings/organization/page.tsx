import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import OrgSettingsClient from "@/components/admin/OrgSettingsClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Organización" };

export default function OrganizationSettingsPage() {
  return (
    <ServerPermissionGate permission="org:*">
      <AdminDataProvider><OrgSettingsClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
