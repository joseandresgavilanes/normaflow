import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import PersonnelClient from "@/components/admin/PersonnelClient";

export const metadata = { title: "Personal — NormaFlow" };

export default function PersonnelPage() {
  return (
    <ServerPermissionGate permission="personnel:read">
      <PersonnelClient />
    </ServerPermissionGate>
  );
}
