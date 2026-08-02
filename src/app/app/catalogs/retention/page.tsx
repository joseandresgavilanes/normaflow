import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import { RetentionCatalogClient } from "@/components/admin/CatalogClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Tiempo de retención" };

export default function RetentionPage() {
  return (
    <ServerPermissionGate permission="catalogs:read">
      <AdminDataProvider><RetentionCatalogClient /></AdminDataProvider>
    </ServerPermissionGate>
  );
}
