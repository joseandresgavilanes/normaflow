import { NextResponse, type NextRequest } from "next/server";
import { processNotificationDeliveryJobs } from "@/lib/notification-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no está configurado." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await processNotificationDeliveryJobs()) });
  } catch (error) {
    console.error("[cron/notification-delivery] failed", error);
    return NextResponse.json({ ok: false, error: "No se pudo procesar la cola de notificaciones." }, { status: 500 });
  }
}
