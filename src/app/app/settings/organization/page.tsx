import { AdminGate } from "@/components/admin/AdminPageGate";
import OrgSettingsClient from "@/components/admin/OrgSettingsClient";

export const metadata = { title: "Organización — NormaFlow" };

export default function OrganizationSettingsPage() {
  return (
    <AdminGate permission="org:*">
      <OrgSettingsClient />
    </AdminGate>
  );
}
