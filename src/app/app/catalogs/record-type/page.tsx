import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Tipos de registro — NormaFlow" };

export default function RecordTypePage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <SimpleCatalogClient
        catalog="recordType"
        title="Tipos de registro"
        subtitle="Categorías genéricas de registro: físico, electrónico, mixto…"
        permission="catalogs:*"
      />
    </ServerPermissionGate>
  );
}
