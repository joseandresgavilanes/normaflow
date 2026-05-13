import { AdminGate } from "@/components/admin/AdminPageGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Disposición — NormaFlow" };

export default function DispositionPage() {
  return (
    <AdminGate permission="catalogs:read">
      <SimpleCatalogClient
        catalog="disposition"
        title="Disposición"
        subtitle="Qué se hace con un registro una vez cumplido su tiempo de retención (reciclar, eliminar, archivar)."
        permission="catalogs:*"
      />
    </AdminGate>
  );
}
