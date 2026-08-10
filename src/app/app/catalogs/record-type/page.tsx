import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Tipos de registro" };

export default function RecordTypePage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <AdminDataProvider><SimpleCatalogClient
          catalog="recordType"
          title="Tipos de registro"
          subtitle="Categorías genéricas de registro: físico, electrónico, mixto…"
          permission="catalogs:*"
        /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
