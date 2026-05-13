import { AdminGate } from "@/components/admin/AdminPageGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Lugares — NormaFlow" };

export default function LocationsPage() {
  return (
    <AdminGate permission="locations:read">
      <SimpleCatalogClient
        catalog="location"
        title="Lugares"
        subtitle="Sedes y ubicaciones desde las que se emiten documentos (ISOTech § 12.1.1)."
        permission="locations:*"
        withDescription
      />
    </AdminGate>
  );
}
