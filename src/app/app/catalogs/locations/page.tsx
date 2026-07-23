import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Lugares — NormaFlow" };

export default function LocationsPage() {
  return (
    <ServerPermissionGate permission="locations:read">
      <SimpleCatalogClient
        catalog="location"
        title="Lugares"
        subtitle="Sedes y ubicaciones desde las que se emiten documentos (ISOTech § 12.1.1)."
        permission="locations:*"
        withDescription
      />
    </ServerPermissionGate>
  );
}
