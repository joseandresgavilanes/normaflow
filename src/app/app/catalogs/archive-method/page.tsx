import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { SimpleCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Métodos de archivo — NormaFlow" };

export default function ArchiveMethodPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <SimpleCatalogClient
        catalog="archiveMethod"
        title="Métodos de archivo"
        subtitle="Cómo se organizan y almacenan los registros (archivador físico, carpeta compartida, repositorio cifrado…)."
        permission="catalogs:*"
      />
    </ServerPermissionGate>
  );
}
