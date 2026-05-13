import { AdminGate } from "@/components/admin/AdminPageGate";
import { RetentionCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Tiempo de retención — NormaFlow" };

export default function RetentionPage() {
  return (
    <AdminGate permission="catalogs:read">
      <RetentionCatalogClient />
    </AdminGate>
  );
}
