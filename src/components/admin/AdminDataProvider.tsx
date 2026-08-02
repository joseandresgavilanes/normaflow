import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { AdminLiveProvider } from "@/context/AdminLiveProvider";
import { getAppContext } from "@/lib/app-context";
import { getAdminPayload } from "@/lib/server-queries";

/**
 * The admin payload is intentionally scoped to admin/info/catalog routes.
 * Loading it from the global app layout made every first paint wait for all
 * records, catalogs, memberships and action history, even on the dashboard.
 */
export default async function AdminDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();
  if (!ctx || ctx.mode !== "live") return <>{children}</>;

  try {
    const payload = await getAdminPayload();
    return (
      <AdminLiveProvider initialData={payload} currentUserId={ctx.user.id}>
        {children}
      </AdminLiveProvider>
    );
  } catch (error) {
    console.error("[admin-data] payload failed:", error);
    return <LiveDataUnavailable section="los datos administrativos" />;
  }
}
