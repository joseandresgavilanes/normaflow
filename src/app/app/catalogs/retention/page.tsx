import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { RetentionCatalogClient } from "@/components/admin/CatalogClient";

export const metadata = { title: "Tiempo de retención — NormaFlow" };

export default function RetentionPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <RetentionCatalogClient />
    </ServerPermissionGate>
  );
}
