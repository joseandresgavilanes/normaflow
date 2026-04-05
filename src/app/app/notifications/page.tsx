import NotificationsModule from "@/components/modules/NotificationsModule";
import { getAppContext } from "@/lib/app-context";
import { prisma } from "@/lib/prisma";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";

export const metadata = { title: "Notificaciones | NormaFlow" };

export default async function NotificationsPage() {
  const ctx = await getAppContext();
  let items;

  if (ctx?.mode === "live") {
    const rows = await prisma.notification.findMany({
      where: { organizationId: ctx.organization.id, userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    items = rows.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      read: n.read,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
    }));
  } else {
    items = DEMO_NOTIFICATIONS.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      read: n.read,
      link: n.type === "INFO" ? "/app/audits" : "/app/documents",
      createdAt: n.time,
    }));
  }

  return <NotificationsModule items={items} />;
}
