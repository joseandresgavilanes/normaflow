import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Disposición — NormaFlow" };

export default function DispositionPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <SimpleCatalogClient
        catalog="disposition"
        title="Disposición"
        subtitle="Qué se hace con un registro una vez cumplido su tiempo de retención (reciclar, eliminar, archivar)."
        permission="catalogs:*"
      />
    </ServerPermissionGate>
  );
}
