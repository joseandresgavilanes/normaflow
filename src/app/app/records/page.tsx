import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import RecordsClient from "@/components/admin/RecordsClient";

export const metadata = { title: "Control de Registros — NormaFlow" };

export default function RecordsPage() {
  return (
    <ServerPermissionGate permission="records:read">
      <RecordsClient />
    </ServerPermissionGate>
  );
}
