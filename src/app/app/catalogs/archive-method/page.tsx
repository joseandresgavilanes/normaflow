import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Métodos de archivo" };

export default function ArchiveMethodPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <AdminDataProvider><SimpleCatalogClient
          catalog="archiveMethod"
          title="Métodos de archivo"
          subtitle="Cómo se organizan y almacenan los registros (archivador físico, carpeta compartida, repositorio cifrado…)."
          permission="catalogs:*"
        /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
