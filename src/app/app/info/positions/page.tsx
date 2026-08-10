import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Cargos" };

export default function PositionsPage() {
  return (
    <ServerPermissionGate permission="positions:read">
      <AdminDataProvider>
        <SimpleCatalogClient
          catalog="position"
          title="Cargos"
          subtitle="Estructura organizacional. Cada miembro del personal puede asociarse a un cargo (ISOTech § 11.1)."
          permission="positions:*"
          withDescription
        />
      </AdminDataProvider>
    </ServerPermissionGate>
  );
}
