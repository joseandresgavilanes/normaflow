import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Disposición" };

export default function DispositionPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <AdminDataProvider><SimpleCatalogClient
          catalog="disposition"
          title="Disposición"
          subtitle="Qué se hace con un registro una vez cumplido su tiempo de retención (reciclar, eliminar, archivar)."
          permission="catalogs:*"
        /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
