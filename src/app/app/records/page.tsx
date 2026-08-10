import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import RecordsClient from "@/components/admin/RecordsClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Control de Registros" };

export default function RecordsPage() {
  return (
    <ServerPermissionGate permission="records:read">
      <AdminDataProvider><RecordsClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
