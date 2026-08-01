import NotificationsModule from "@/components/modules/NotificationsModule";
import { getAppContext } from "@/lib/app-context";
import { getNotificationsPayload } from "@/lib/server-queries";
import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const ctx = await getAppContext();

  if (ctx?.mode === "live") {
    try {
      const serverItems = await getNotificationsPayload();
      return <NotificationsModule serverItems={serverItems} />;
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[notifications] live payload failed:", err);
      return <LiveDataUnavailable section="las notificaciones" />;
    }
  }

  return <NotificationsModule />;
}
