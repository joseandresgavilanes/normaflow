import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import AdminCatalogsClient from "@/components/admin/AdminCatalogsClient";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

export const metadata = { title: "Catálogos base" };

export default function AdminCatalogsPage() {
  return <ServerPermissionGate permission="catalogs:read"><AdminDataProvider><AdminCatalogsClient /></AdminDataProvider></ServerPermissionGate>;
}
