import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import OrgSettingsClient from "@/components/admin/OrgSettingsClient";

export const metadata = { title: "Organización — NormaFlow" };

export default function OrganizationSettingsPage() {
  return (
    <ServerPermissionGate permission="org:*">
      <OrgSettingsClient />
    </ServerPermissionGate>
  );
}
