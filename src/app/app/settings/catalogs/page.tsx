import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import AdminCatalogsClient from "@/components/admin/AdminCatalogsClient";

export const metadata = { title: "Catálogos base — NormaFlow" };

export default function AdminCatalogsPage() {
  return <ServerPermissionGate permission="catalogs:read"><AdminCatalogsClient /></ServerPermissionGate>;
}
