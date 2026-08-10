import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Lugares" };

export default function LocationsPage() {
  return (
    <ServerPermissionGate permission="locations:read">
      <AdminDataProvider><SimpleCatalogClient
          catalog="location"
          title="Lugares"
          subtitle="Sedes y ubicaciones desde las que se emiten documentos (ISOTech § 12.1.1)."
          permission="locations:*"
          withDescription
        /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
